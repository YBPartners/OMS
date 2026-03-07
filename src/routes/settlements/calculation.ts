// ================================================================
// Airflow OMS — 정산 산출/확정 v5.1
// Batch Builder + State Machine 적용
// R3: order_items 기반 confirmed_total_sell/work 반영
// 기존: for문 개별 INSERT → BatchBuilder 1회 batch()
// ================================================================
import { Hono } from 'hono';
import type { Env, CommissionMode } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { buildSettlementBatch, BatchBuilder } from '../../lib/batch-builder';
import type { SettlementItem } from '../../lib/batch-builder';
import { bulkTransitionOrders } from '../../lib/state-machine';
import { today } from '../../lib/db-helpers';
import { confirmSettlementOrders } from '../../services/order-lifecycle-service';

export function mountCalculation(router: Hono<Env>) {

  // ─── 정산 산출 (calculate) — Batch Builder 적용 ───
  router.post('/runs/:run_id/calculate', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const runId = Number(c.req.param('run_id'));
    if (isNaN(runId)) return c.json({ error: '유효하지 않은 Run ID입니다.' }, 400);

    const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first();
    if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);
    if (run.status !== 'DRAFT') return c.json({ error: '이미 산출된 정산입니다. DRAFT 상태에서만 산출 가능합니다.' }, 400);

    // HQ_APPROVED 주문 조회 (정산 대상)
    const approvedOrders = await db.prepare(`
      SELECT o.order_id, o.base_amount, o.requested_date, o.channel_id,
             o.price_confirmed, o.confirmed_total_sell, o.confirmed_total_work,
             od.region_org_id,
             oa.team_leader_id,
             u.org_id as team_org_id
      FROM orders o
      JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
      JOIN order_assignments oa ON o.order_id = oa.order_id AND oa.status = 'HQ_APPROVED'
      LEFT JOIN users u ON oa.team_leader_id = u.user_id
      WHERE o.status = 'HQ_APPROVED'
        AND o.requested_date >= ? AND o.requested_date <= ?
        AND o.order_id NOT IN (SELECT order_id FROM settlements WHERE status IN ('PENDING','CONFIRMED','PAID'))
    `).bind(run.period_start, run.period_end).all();

    if (approvedOrders.results.length === 0) {
      return c.json({ error: '산출 대상 주문이 없습니다.', run_id: runId }, 400);
    }

    // ★ 수수료 정책 일괄 캐싱 (N+1 문제 해결)
    const commPolicies = await db.prepare(`
      SELECT * FROM commission_policies WHERE is_active = 1 ORDER BY effective_from DESC
    `).all();

    const policyMap = new Map<string, any>();
    for (const p of commPolicies.results as any[]) {
      const channelPart = p.channel_id ? `:ch${p.channel_id}` : '';
      const key = p.team_leader_id ? `${p.org_id}:${p.team_leader_id}${channelPart}` : `${p.org_id}:null${channelPart}`;
      if (!policyMap.has(key)) policyMap.set(key, p);
    }

    // 정산 아이템 계산
    const items: SettlementItem[] = [];
    const errors: any[] = [];

    for (const order of approvedOrders.results as any[]) {
      try {
        // 우선순위: 채널+개인 → 채널+조직 → 개인 → 조직 기본
        const chId = order.channel_id;
        let policy = chId ? policyMap.get(`${order.region_org_id}:${order.team_leader_id}:ch${chId}`) : null;
        if (!policy && chId) policy = policyMap.get(`${order.region_org_id}:null:ch${chId}`);
        if (!policy) policy = policyMap.get(`${order.region_org_id}:${order.team_leader_id}`);
        if (!policy) policy = policyMap.get(`${order.region_org_id}:null`);

        const mode: CommissionMode = (policy?.mode || 'PERCENT') as CommissionMode;
        const rate = Number(policy?.value || 0);

        // ★ R3: order_items 기반 정산 (confirmed_total_sell/work 반영)
        // price_confirmed=1: 가격 확정된 주문 → confirmed_total_sell 사용
        // price_confirmed=0: 미확정 → 레거시 base_amount 사용 (하위 호환)
        const isPriceConfirmed = order.price_confirmed === 1;
        const effectiveSellAmount = isPriceConfirmed && order.confirmed_total_sell > 0
          ? Number(order.confirmed_total_sell)
          : Number(order.base_amount);
        const effectiveWorkAmount = isPriceConfirmed && order.confirmed_total_work > 0
          ? Number(order.confirmed_total_work)
          : 0;

        // 수수료: 판매가(sell) 기준 산출
        const commissionAmount = mode === 'FIXED' ? rate : Math.round(effectiveSellAmount * rate / 100);
        // 지급액: 판매가 - 수수료
        const payableAmount = Math.max(0, effectiveSellAmount - commissionAmount);
        // 수익: 판매가 - 수행가 (참고 지표)
        const margin = effectiveWorkAmount > 0 ? effectiveSellAmount - effectiveWorkAmount : 0;

        items.push({
          orderId: order.order_id,
          teamLeaderId: order.team_leader_id,
          teamOrgId: order.team_org_id || undefined,
          regionOrgId: order.region_org_id,
          baseAmount: effectiveSellAmount,
          commissionMode: mode,
          commissionRate: rate,
          commissionAmount,
          payableAmount,
          periodType: run.period_type as string,
          periodStart: run.period_start as string,
          periodEnd: run.period_end as string,
          // R3 추가 메타
          workAmount: effectiveWorkAmount,
          margin,
          priceConfirmed: isPriceConfirmed,
        });
      } catch (err: any) {
        errors.push({ order_id: order.order_id, error: err.message });
      }
    }

    if (items.length === 0) {
      return c.json({ error: '정산 산출 중 모든 주문에서 오류가 발생했습니다.', errors }, 500);
    }

    // ★ Batch Builder로 원자적 실행 (−98% DB 호출)
    const batch = buildSettlementBatch(db, runId, items);
    await batch.execute();

    // R3: work_amount & margin 집계 (감사 로그에 기록)
    const totalWork = items.reduce((s, i) => s + (i.workAmount || 0), 0);
    const totalMargin = items.reduce((s, i) => s + (i.margin || 0), 0);
    const confirmedCount = items.filter(i => i.priceConfirmed).length;

    await writeAuditLog(db, {
      entity_type: 'SETTLEMENT_RUN', entity_id: runId, action: 'CALCULATE',
      actor_id: user.user_id,
      detail_json: JSON.stringify({
        total_orders: items.length,
        total_payable_amount: items.reduce((s, i) => s + i.payableAmount, 0),
        total_work_amount: totalWork,
        total_margin: totalMargin,
        price_confirmed_count: confirmedCount,
        legacy_fallback_count: items.length - confirmedCount,
        errors: errors.length,
      }),
    });

    const totalBase = items.reduce((s, i) => s + i.baseAmount, 0);
    const totalCommission = items.reduce((s, i) => s + i.commissionAmount, 0);
    const totalPayable = items.reduce((s, i) => s + i.payableAmount, 0);

    const response: any = {
      run_id: runId, total_orders: items.length,
      total_base_amount: totalBase,
      total_commission_amount: totalCommission,
      total_payable_amount: totalPayable,
      // R3: order_items 기반 추가 지표
      total_work_amount: totalWork,
      total_margin: totalMargin,
      price_confirmed_count: confirmedCount,
      legacy_fallback_count: items.length - confirmedCount,
    };
    if (errors.length > 0) {
      response.warnings = `${errors.length}건 산출 실패 (부분 산출 완료)`;
      response.errors = errors;
    }
    return c.json(response);
  });

  // ─── 정산 확정 (confirm) → Order Lifecycle Service 위임 ───
  router.post('/runs/:run_id/confirm', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const runId = Number(c.req.param('run_id'));
    if (isNaN(runId)) return c.json({ error: '유효하지 않은 Run ID입니다.' }, 400);

    const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first();
    if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);
    if (run.status !== 'CALCULATED') return c.json({ error: '산출 완료 상태에서만 확정 가능합니다.' }, 400);

    const pendingSettlements = await db.prepare(`
      SELECT * FROM settlements WHERE run_id = ? AND status = 'PENDING'
    `).bind(runId).all();

    if (pendingSettlements.results.length === 0) {
      return c.json({ error: '확정할 정산 항목이 없습니다.' }, 400);
    }

    // ★ Order Lifecycle Service에 위임 (교차 도메인 분리)
    const items = (pendingSettlements.results as any[]).map(s => ({
      settlement_id: s.settlement_id,
      order_id: s.order_id,
      team_leader_id: s.team_leader_id,
      region_org_id: s.region_org_id,
      payable_amount: s.payable_amount,
    }));

    const { confirmedCount, errors: confirmErrors } = await confirmSettlementOrders(
      db, runId, items, user.user_id
    );

    const response: any = { ok: confirmedCount > 0, confirmed_count: confirmedCount };
    if (confirmErrors.length > 0) {
      response.warnings = `${confirmErrors.length}건 확정 실패`;
      response.errors = confirmErrors;
    }
    return c.json(response);
  });
}
