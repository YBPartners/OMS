// ================================================================
// 다하다 OMS — 검수 (1차 지역검수 / 2차 HQ검수)
// ================================================================
import { Hono } from 'hono';
import type { Env, OrderStatus } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeStatusHistory } from '../../lib/audit';
import { upsertRegionDailyStats, upsertTeamLeaderDailyStats } from '../../lib/db-helpers';

export function mountReview(router: Hono<Env>) {

  // ─── 1차 검수 (REGION) ───
  router.post('/:order_id/review/region', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const { result, comment, reason_codes } = await c.req.json();

    if (!['APPROVE', 'REJECT'].includes(result)) return c.json({ error: '결과는 APPROVE 또는 REJECT입니다.' }, 400);

    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
    if (order.status !== 'SUBMITTED') return c.json({ error: `현재 상태(${order.status})에서는 지역 검수가 불가합니다.` }, 400);

    const report = await db.prepare('SELECT * FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1').bind(orderId).first();
    if (!report) return c.json({ error: '보고서가 없습니다.' }, 404);

    await db.prepare(`
      INSERT INTO reviews (report_id, order_id, stage, reviewer_id, result, reason_codes_json, comment)
      VALUES (?, ?, 'REGION', ?, ?, ?, ?)
    `).bind(report.report_id, orderId, user.user_id, result, JSON.stringify(reason_codes || []), comment || null).run();

    const newStatus: OrderStatus = result === 'APPROVE' ? 'REGION_APPROVED' : 'REGION_REJECTED';
    await db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_id = ?`).bind(newStatus, orderId).run();
    await db.prepare(`UPDATE order_assignments SET status = ?, updated_at = datetime('now') WHERE order_id = ? AND status = 'SUBMITTED'`).bind(newStatus, orderId).run();
    await writeStatusHistory(db, { order_id: orderId, from_status: 'SUBMITTED', to_status: newStatus, actor_id: user.user_id, note: comment });

    if (result === 'APPROVE') {
      await upsertRegionDailyStats(db, user.org_id, 'region_approved_count');
    }

    return c.json({ ok: true, new_status: newStatus });
  });

  // ─── 2차 최종 검수 (HQ) ───
  router.post('/:order_id/review/hq', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const { result, comment, reason_codes } = await c.req.json();

    if (!['APPROVE', 'REJECT'].includes(result)) return c.json({ error: '결과는 APPROVE 또는 REJECT입니다.' }, 400);

    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
    if (order.status !== 'REGION_APPROVED') return c.json({ error: `현재 상태(${order.status})에서는 HQ 검수가 불가합니다.` }, 400);

    const report = await db.prepare('SELECT * FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1').bind(orderId).first();
    if (!report) return c.json({ error: '보고서가 없습니다.' }, 404);

    await db.prepare(`
      INSERT INTO reviews (report_id, order_id, stage, reviewer_id, result, reason_codes_json, comment)
      VALUES (?, ?, 'HQ', ?, ?, ?, ?)
    `).bind(report.report_id, orderId, user.user_id, result, JSON.stringify(reason_codes || []), comment || null).run();

    const newStatus: OrderStatus = result === 'APPROVE' ? 'HQ_APPROVED' : 'HQ_REJECTED';
    await db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_id = ?`).bind(newStatus, orderId).run();
    await db.prepare(`UPDATE order_assignments SET status = ?, updated_at = datetime('now') WHERE order_id = ? AND status = 'REGION_APPROVED'`).bind(newStatus, orderId).run();
    await writeStatusHistory(db, { order_id: orderId, from_status: 'REGION_APPROVED', to_status: newStatus, actor_id: user.user_id, note: comment });

    if (result === 'APPROVE') {
      const dist = await db.prepare('SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = ?').bind(orderId, 'ACTIVE').first();
      if (dist) {
        await upsertRegionDailyStats(db, dist.region_org_id as number, 'hq_approved_count');
      }
      const assign = await db.prepare('SELECT team_leader_id FROM order_assignments WHERE order_id = ? AND status = ?').bind(orderId, newStatus).first();
      if (assign) {
        await upsertTeamLeaderDailyStats(db, assign.team_leader_id as number, 'hq_approved_count');
      }
    }

    return c.json({ ok: true, new_status: newStatus });
  });
}
