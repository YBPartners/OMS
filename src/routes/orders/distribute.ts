// ================================================================
// Airflow OMS — 주문 배분 (자동배분/수동배분/재배분) v2.0
// try-catch 강화: 배치 연산 부분실패 방어 + 비즈니스 컨텍스트 에러 로깅
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeStatusHistory } from '../../lib/audit';
import { upsertRegionDailyStats } from '../../lib/db-helpers';

export function mountDistribute(router: Hono<Env>) {

  // ─── 자동 배분 실행 ───
  router.post('/distribute', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;

    try {
      const policy = await db.prepare('SELECT * FROM distribution_policies WHERE is_active = 1 ORDER BY version DESC LIMIT 1').first();
      if (!policy) return c.json({ error: '활성 배분 정책이 없습니다.' }, 400);

      await db.prepare(`UPDATE orders SET status = 'VALIDATED', updated_at = datetime('now') WHERE status = 'RECEIVED' AND address_text IS NOT NULL AND admin_dong_code IS NOT NULL`).run();

      const pendingOrders = await db.prepare(`
        SELECT o.order_id, o.admin_dong_code, o.address_text, o.customer_name, o.base_amount
        FROM orders o
        LEFT JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
        WHERE o.status IN ('VALIDATED', 'DISTRIBUTION_PENDING') AND od.distribution_id IS NULL
        ORDER BY o.created_at ASC
      `).all();

      const mappings = await db.prepare(`
        SELECT ot.org_id, t.admin_dong_code FROM org_territories ot
        JOIN territories t ON ot.territory_id = t.territory_id
        WHERE (ot.effective_to IS NULL OR ot.effective_to > datetime('now'))
      `).all();

      const dongToOrg: Record<string, number> = {};
      for (const m of mappings.results as any[]) { dongToOrg[m.admin_dong_code] = m.org_id; }

      const orgNames: Record<number, string> = {};
      const orgsResult = await db.prepare("SELECT org_id, name FROM organizations WHERE org_type = 'REGION'").all();
      for (const o of orgsResult.results as any[]) { orgNames[o.org_id] = o.name; }

      let distributed = 0;
      let pending = 0;
      const results: any[] = [];
      const errors: any[] = [];
      const regionSummary: Record<number, { name: string, count: number, amount: number, orders: any[] }> = {};

      for (const order of pendingOrders.results as any[]) {
        const regionOrgId = dongToOrg[order.admin_dong_code];
        
        if (regionOrgId) {
          try {
            await db.prepare(`
              INSERT INTO order_distributions (order_id, region_org_id, distributed_by, distribution_policy_version, status)
              VALUES (?, ?, ?, ?, 'ACTIVE')
            `).bind(order.order_id, regionOrgId, user.user_id, policy.version).run();
            
            await db.prepare(`UPDATE orders SET status = 'DISTRIBUTED', updated_at = datetime('now') WHERE order_id = ?`).bind(order.order_id).run();
            await writeStatusHistory(db, { order_id: order.order_id, from_status: 'VALIDATED', to_status: 'DISTRIBUTED', actor_id: user.user_id, note: `자동배분 → ${orgNames[regionOrgId] || 'org_id:' + regionOrgId}` });
            
            distributed++;
            const regionName = orgNames[regionOrgId] || `org_id:${regionOrgId}`;
            results.push({ order_id: order.order_id, region_org_id: regionOrgId, region_name: regionName, result: 'DISTRIBUTED', customer_name: order.customer_name, address_text: order.address_text });
            
            if (!regionSummary[regionOrgId]) regionSummary[regionOrgId] = { name: regionName, count: 0, amount: 0, orders: [] };
            regionSummary[regionOrgId].count++;
            regionSummary[regionOrgId].amount += Number(order.base_amount || 0);
            regionSummary[regionOrgId].orders.push({ order_id: order.order_id, customer_name: order.customer_name });

            await upsertRegionDailyStats(db, regionOrgId, 'intake_count');
          } catch (itemErr: any) {
            console.error(`[distribute] 개별 주문 배분 실패 order_id=${order.order_id}:`, itemErr.message);
            errors.push({ order_id: order.order_id, error: '배분 처리 중 오류' });
          }
        } else {
          await db.prepare(`UPDATE orders SET status = 'DISTRIBUTION_PENDING', updated_at = datetime('now') WHERE order_id = ?`).bind(order.order_id).run();
          await writeStatusHistory(db, { order_id: order.order_id, from_status: 'VALIDATED', to_status: 'DISTRIBUTION_PENDING', actor_id: user.user_id, note: '행정동 매칭 실패' });
          pending++;
          results.push({ order_id: order.order_id, result: 'DISTRIBUTION_PENDING', reason: '행정동 매칭 실패', customer_name: order.customer_name, address_text: order.address_text });
        }
      }

      return c.json({ 
        distributed, pending, total: pendingOrders.results.length, results,
        ...(errors.length > 0 ? { errors } : {}),
        region_summary: Object.entries(regionSummary).map(([orgId, data]) => ({
          org_id: Number(orgId), name: data.name, count: data.count, amount: data.amount, orders: data.orders,
        }))
      });
    } catch (err: any) {
      console.error('[distribute] 자동 배분 처리 실패:', err.message);
      return c.json({ error: '자동 배분 처리 중 오류가 발생했습니다.', code: 'DISTRIBUTE_ERROR' }, 500);
    }
  });

  // ─── 수동 배분/재배분 ───
  router.patch('/:order_id/distribution', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const { region_org_id } = await c.req.json();

    try {
      const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
      if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

      await db.prepare(`UPDATE order_distributions SET status = 'REASSIGNED' WHERE order_id = ? AND status = 'ACTIVE'`).bind(orderId).run();

      const policy = await db.prepare('SELECT version FROM distribution_policies WHERE is_active = 1 ORDER BY version DESC LIMIT 1').first();
      
      await db.prepare(`
        INSERT INTO order_distributions (order_id, region_org_id, distributed_by, distribution_policy_version, status)
        VALUES (?, ?, ?, ?, 'ACTIVE')
      `).bind(orderId, region_org_id, user.user_id, policy?.version || 1).run();

      await db.prepare(`UPDATE orders SET status = 'DISTRIBUTED', updated_at = datetime('now') WHERE order_id = ?`).bind(orderId).run();
      await writeStatusHistory(db, { order_id: orderId, from_status: order.status as string, to_status: 'DISTRIBUTED', actor_id: user.user_id, note: `수동 배분 → org_id:${region_org_id}` });

      return c.json({ ok: true, order_id: orderId, region_org_id });
    } catch (err: any) {
      console.error(`[distribution] 수동 배분 실패 order_id=${orderId}:`, err.message);
      return c.json({ error: '배분 처리 중 오류가 발생했습니다.', code: 'DISTRIBUTION_ERROR' }, 500);
    }
  });

  // ─── 일괄 수동 배분 (여러 주문 → 하나의 지역총판) ───
  router.post('/batch-distribute', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { order_ids, region_org_id } = await c.req.json();

    if (!order_ids?.length) return c.json({ error: '주문 ID 목록은 필수입니다.' }, 400);
    if (!region_org_id) return c.json({ error: '지역총판 ID는 필수입니다.' }, 400);
    if (order_ids.length > 100) return c.json({ error: '한 번에 최대 100건까지 배분 가능합니다.' }, 400);

    try {
      // 지역총판 확인
      const org = await db.prepare("SELECT org_id, name FROM organizations WHERE org_id = ? AND org_type = 'REGION'").bind(region_org_id).first();
      if (!org) return c.json({ error: '유효한 지역총판이 아닙니다.' }, 400);

      const policy = await db.prepare('SELECT version FROM distribution_policies WHERE is_active = 1 ORDER BY version DESC LIMIT 1').first();
      const policyVersion = policy?.version || 1;

      let success = 0;
      let fail = 0;
      const results: any[] = [];

      for (const orderId of order_ids) {
        try {
          const order = await db.prepare(
            "SELECT order_id, status, customer_name FROM orders WHERE order_id = ? AND status IN ('RECEIVED', 'VALIDATED', 'DISTRIBUTION_PENDING')"
          ).bind(orderId).first();

          if (!order) {
            fail++;
            results.push({ order_id: orderId, result: 'FAIL', reason: '배분 불가 상태' });
            continue;
          }

          // RECEIVED → VALIDATED 자동 전환
          if (order.status === 'RECEIVED') {
            await db.prepare("UPDATE orders SET status = 'VALIDATED', updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
            await writeStatusHistory(db, { order_id: orderId, from_status: 'RECEIVED', to_status: 'VALIDATED', actor_id: user.user_id, note: '일괄배분 시 자동 검증' });
          }

          // 기존 배분 해제
          await db.prepare("UPDATE order_distributions SET status = 'REASSIGNED' WHERE order_id = ? AND status = 'ACTIVE'").bind(orderId).run();

          // 새 배분 생성
          await db.prepare(`
            INSERT INTO order_distributions (order_id, region_org_id, distributed_by, distribution_policy_version, status)
            VALUES (?, ?, ?, ?, 'ACTIVE')
          `).bind(orderId, region_org_id, user.user_id, policyVersion).run();

          await db.prepare("UPDATE orders SET status = 'DISTRIBUTED', updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
          const fromStatus = order.status as string;
          await writeStatusHistory(db, { order_id: orderId, from_status: fromStatus === 'RECEIVED' ? 'VALIDATED' : fromStatus, to_status: 'DISTRIBUTED', actor_id: user.user_id, note: `일괄 수동배분 → ${org.name}` });

          await upsertRegionDailyStats(db, region_org_id, 'intake_count');
          success++;
          results.push({ order_id: orderId, result: 'DISTRIBUTED', customer_name: order.customer_name });
        } catch (itemErr: any) {
          console.error(`[batch-distribute] 개별 주문 실패 order_id=${orderId}:`, itemErr.message);
          fail++;
          results.push({ order_id: orderId, result: 'FAIL', reason: '처리 중 오류 발생' });
        }
      }

      return c.json({ success, fail, total: order_ids.length, region_name: org.name, results });
    } catch (err: any) {
      console.error('[batch-distribute] 일괄 배분 처리 실패:', err.message);
      return c.json({ error: '일괄 배분 처리 중 오류가 발생했습니다.', code: 'BATCH_DISTRIBUTE_ERROR' }, 500);
    }
  });

  // ─── 배분 취소 (단건: DISTRIBUTED → DISTRIBUTION_PENDING) ───
  router.patch('/:order_id/undistribute', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    try {
      const order = await db.prepare(
        "SELECT * FROM orders WHERE order_id = ? AND status = 'DISTRIBUTED'"
      ).bind(orderId).first();
      if (!order) return c.json({ error: '배분 취소 가능한 주문이 아닙니다. (DISTRIBUTED 상태만 가능)' }, 400);

      // 이미 배정(ASSIGNED 이상)된 주문은 취소 불가
      await db.prepare("UPDATE order_distributions SET status = 'CANCELLED' WHERE order_id = ? AND status = 'ACTIVE'").bind(orderId).run();
      await db.prepare("UPDATE orders SET status = 'DISTRIBUTION_PENDING', updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
      await writeStatusHistory(db, { order_id: orderId, from_status: 'DISTRIBUTED', to_status: 'DISTRIBUTION_PENDING', actor_id: user.user_id, note: '배분 취소 (수동)' });

      return c.json({ ok: true, order_id: orderId, message: '배분이 취소되었습니다.' });
    } catch (err: any) {
      console.error(`[undistribute] 배분 취소 실패 order_id=${orderId}:`, err.message);
      return c.json({ error: '배분 취소 중 오류가 발생했습니다.', code: 'UNDISTRIBUTE_ERROR' }, 500);
    }
  });

  // ─── 일괄 배분 취소 ───
  router.post('/batch-undistribute', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { order_ids } = await c.req.json();

    if (!order_ids?.length) return c.json({ error: '주문 ID 목록은 필수입니다.' }, 400);
    if (order_ids.length > 100) return c.json({ error: '한 번에 최대 100건까지 처리 가능합니다.' }, 400);

    let success = 0, fail = 0;
    const results: any[] = [];

    for (const orderId of order_ids) {
      try {
        const order = await db.prepare(
          "SELECT order_id, status, customer_name FROM orders WHERE order_id = ? AND status = 'DISTRIBUTED'"
        ).bind(orderId).first();
        if (!order) { fail++; results.push({ order_id: orderId, result: 'FAIL', reason: '배분 취소 불가 상태' }); continue; }

        await db.prepare("UPDATE order_distributions SET status = 'CANCELLED' WHERE order_id = ? AND status = 'ACTIVE'").bind(orderId).run();
        await db.prepare("UPDATE orders SET status = 'DISTRIBUTION_PENDING', updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
        await writeStatusHistory(db, { order_id: orderId, from_status: 'DISTRIBUTED', to_status: 'DISTRIBUTION_PENDING', actor_id: user.user_id, note: '일괄 배분 취소' });

        success++;
        results.push({ order_id: orderId, result: 'UNDISTRIBUTED', customer_name: order.customer_name });
      } catch (itemErr: any) {
        fail++;
        results.push({ order_id: orderId, result: 'FAIL', reason: '처리 중 오류' });
      }
    }

    return c.json({ success, fail, total: order_ids.length, results });
  });

  // ─── 배분 현황 요약 (총판별 건수/금액) ───
  router.get('/distribution-summary', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const db = c.env.DB;

    try {
      // 총판별 배분 건수 + 금액
      const summary = await db.prepare(`
        SELECT od.region_org_id, o.name as region_name, o.code as region_code,
          COUNT(*) as order_count,
          COALESCE(SUM(ord.base_amount), 0) as total_amount,
          COUNT(CASE WHEN ord.status = 'DISTRIBUTED' THEN 1 END) as distributed_count,
          COUNT(CASE WHEN ord.status = 'ASSIGNED' THEN 1 END) as assigned_count,
          COUNT(CASE WHEN ord.status IN ('IN_PROGRESS', 'READY_DONE') THEN 1 END) as in_progress_count
        FROM order_distributions od
        JOIN organizations o ON od.region_org_id = o.org_id
        JOIN orders ord ON od.order_id = ord.order_id
        WHERE od.status = 'ACTIVE'
        GROUP BY od.region_org_id
        ORDER BY order_count DESC
      `).all();

      // 미배분 건수
      const undistributed = await db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(base_amount), 0) as amount
        FROM orders
        WHERE status IN ('RECEIVED', 'VALIDATED', 'DISTRIBUTION_PENDING')
      `).first();

      return c.json({
        regions: summary.results,
        undistributed: {
          count: (undistributed as any)?.count || 0,
          amount: (undistributed as any)?.amount || 0,
        },
      });
    } catch (err: any) {
      console.error('[distribution-summary]', err.message);
      return c.json({ error: '배분 현황 조회 중 오류가 발생했습니다.' }, 500);
    }
  });
}
