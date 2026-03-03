// ================================================================
// 다하다 OMS — 정산 산출/확정 비즈니스 로직
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog, writeStatusHistory } from '../../lib/audit';

export function mountCalculation(router: Hono<Env>) {

  // ─── 정산 산출 (calculate) — 에러 발생 시 정리 보장 ───
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

    const approvedOrders = await db.prepare(`
      SELECT o.order_id, o.base_amount, o.requested_date,
             od.region_org_id,
             oa.team_leader_id
      FROM orders o
      JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
      JOIN order_assignments oa ON o.order_id = oa.order_id AND oa.status = 'HQ_APPROVED'
      WHERE o.status = 'HQ_APPROVED'
        AND o.requested_date >= ? AND o.requested_date <= ?
        AND o.order_id NOT IN (SELECT order_id FROM settlements WHERE status IN ('PENDING','CONFIRMED','PAID'))
    `).bind(run.period_start, run.period_end).all();

    let totalBase = 0, totalCommission = 0, totalPayable = 0, count = 0;
    const errors: any[] = [];

    for (const order of approvedOrders.results as any[]) {
      try {
        let commPolicy = await db.prepare(`
          SELECT * FROM commission_policies
          WHERE org_id = ? AND team_leader_id = ? AND is_active = 1
          ORDER BY effective_from DESC LIMIT 1
        `).bind(order.region_org_id, order.team_leader_id).first();

        if (!commPolicy) {
          commPolicy = await db.prepare(`
            SELECT * FROM commission_policies
            WHERE org_id = ? AND team_leader_id IS NULL AND is_active = 1
            ORDER BY effective_from DESC LIMIT 1
          `).bind(order.region_org_id).first();
        }

        const mode = (commPolicy?.mode || 'PERCENT') as string;
        const rate = (commPolicy?.value || 0) as number;
        let commissionAmount = mode === 'FIXED' ? rate : Math.round(order.base_amount * rate / 100);
        const payableAmount = Math.max(0, order.base_amount - commissionAmount);

        await db.prepare(`
          INSERT INTO settlements (run_id, order_id, team_leader_id, region_org_id,
            base_amount, commission_mode, commission_rate, commission_amount, payable_amount,
            period_type, period_start, period_end, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `).bind(
          runId, order.order_id, order.team_leader_id, order.region_org_id,
          order.base_amount, mode, rate, commissionAmount, payableAmount,
          run.period_type, run.period_start, run.period_end
        ).run();

        totalBase += order.base_amount;
        totalCommission += commissionAmount;
        totalPayable += payableAmount;
        count++;
      } catch (err: any) {
        errors.push({ order_id: order.order_id, error: err.message });
      }
    }

    if (errors.length > 0 && count === 0) {
      await db.prepare('DELETE FROM settlements WHERE run_id = ?').bind(runId).run();
      await db.prepare(`UPDATE settlement_runs SET status = 'DRAFT', updated_at = datetime('now') WHERE run_id = ?`).bind(runId).run();
      return c.json({ error: '정산 산출 중 모든 주문에서 오류가 발생했습니다.', errors }, 500);
    }

    await db.prepare(`
      UPDATE settlement_runs SET status = 'CALCULATED',
        total_base_amount = ?, total_commission_amount = ?, total_payable_amount = ?, total_count = ?,
        updated_at = datetime('now')
      WHERE run_id = ?
    `).bind(totalBase, totalCommission, totalPayable, count, runId).run();

    await writeAuditLog(db, { entity_type: 'SETTLEMENT_RUN', entity_id: runId, action: 'CALCULATE', actor_id: user.user_id, detail_json: JSON.stringify({ total_orders: count, total_payable_amount: totalPayable, errors: errors.length }) });

    const response: any = { run_id: runId, total_orders: count, total_base_amount: totalBase, total_commission_amount: totalCommission, total_payable_amount: totalPayable };
    if (errors.length > 0) {
      response.warnings = `${errors.length}건 산출 실패 (부분 산출 완료)`;
      response.errors = errors;
    }
    return c.json(response);
  });

  // ─── 정산 확정 (confirm) → 원장 반영 ───
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

    const today = new Date().toISOString().split('T')[0];
    let confirmedCount = 0;
    const confirmErrors: any[] = [];

    for (const s of pendingSettlements.results as any[]) {
      try {
        const orderCheck = await db.prepare('SELECT status FROM orders WHERE order_id = ?').bind(s.order_id).first();
        if (orderCheck?.status !== 'HQ_APPROVED') {
          confirmErrors.push({ order_id: s.order_id, error: `주문 상태가 ${orderCheck?.status}로 변경됨 (HQ_APPROVED 필요)` });
          continue;
        }

        await db.prepare(`
          UPDATE settlements SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = datetime('now') WHERE settlement_id = ?
        `).bind(user.user_id, s.settlement_id).run();

        await db.prepare(`UPDATE orders SET status = 'SETTLEMENT_CONFIRMED', updated_at = datetime('now') WHERE order_id = ?`).bind(s.order_id).run();
        await db.prepare(`UPDATE order_assignments SET status = 'SETTLEMENT_CONFIRMED', updated_at = datetime('now') WHERE order_id = ? AND status = 'HQ_APPROVED'`).bind(s.order_id).run();
        await writeStatusHistory(db, { order_id: s.order_id, from_status: 'HQ_APPROVED', to_status: 'SETTLEMENT_CONFIRMED', actor_id: user.user_id, note: `정산확정 run_id:${runId}` });

        await db.prepare(`
          INSERT INTO team_leader_ledger_daily (date, team_leader_id, confirmed_payable_sum, confirmed_count, updated_at)
          VALUES (?, ?, ?, 1, datetime('now'))
          ON CONFLICT(date, team_leader_id) DO UPDATE SET
            confirmed_payable_sum = confirmed_payable_sum + ?,
            confirmed_count = confirmed_count + 1,
            updated_at = datetime('now')
        `).bind(today, s.team_leader_id, s.payable_amount, s.payable_amount).run();

        await db.prepare(`
          INSERT INTO team_leader_daily_stats (date, team_leader_id, settlement_confirmed_count, payable_amount_sum, updated_at)
          VALUES (?, ?, 1, ?, datetime('now'))
          ON CONFLICT(date, team_leader_id) DO UPDATE SET
            settlement_confirmed_count = settlement_confirmed_count + 1,
            payable_amount_sum = payable_amount_sum + ?,
            updated_at = datetime('now')
        `).bind(today, s.team_leader_id, s.payable_amount, s.payable_amount).run();

        await db.prepare(`
          INSERT INTO region_daily_stats (date, region_org_id, settlement_confirmed_count, payable_amount_sum, updated_at)
          VALUES (?, ?, 1, ?, datetime('now'))
          ON CONFLICT(date, region_org_id) DO UPDATE SET
            settlement_confirmed_count = settlement_confirmed_count + 1,
            payable_amount_sum = payable_amount_sum + ?,
            updated_at = datetime('now')
        `).bind(today, s.region_org_id, s.payable_amount, s.payable_amount).run();

        confirmedCount++;
      } catch (err: any) {
        confirmErrors.push({ order_id: s.order_id, settlement_id: s.settlement_id, error: err.message });
      }
    }

    const finalStatus = confirmedCount > 0 ? 'CONFIRMED' : 'CALCULATED';
    await db.prepare(`
      UPDATE settlement_runs SET status = ?, updated_at = datetime('now') WHERE run_id = ?
    `).bind(finalStatus, runId).run();

    await writeAuditLog(db, { entity_type: 'SETTLEMENT_RUN', entity_id: runId, action: 'CONFIRM', actor_id: user.user_id, detail_json: JSON.stringify({ confirmed_count: confirmedCount, errors: confirmErrors.length }) });

    const response: any = { ok: confirmedCount > 0, confirmed_count: confirmedCount };
    if (confirmErrors.length > 0) {
      response.warnings = `${confirmErrors.length}건 확정 실패`;
      response.errors = confirmErrors;
    }
    return c.json(response);
  });
}
