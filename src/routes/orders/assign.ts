// ================================================================
// 다하다 OMS — 팀장 배정 (칸반) + 작업 시작
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeStatusHistory } from '../../lib/audit';
import { upsertTeamLeaderDailyStats } from '../../lib/db-helpers';

export function mountAssign(router: Hono<Env>) {

  // ─── 팀장 배정 (칸반 드래그앤드롭) ───
  router.post('/:order_id/assign', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const { team_leader_id } = await c.req.json();

    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

    if (user.org_type === 'REGION') {
      const dist = await db.prepare('SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = ?').bind(orderId, 'ACTIVE').first();
      if (!dist || dist.region_org_id !== user.org_id) return c.json({ error: '해당 주문에 대한 권한이 없습니다.' }, 403);
    }

    await db.prepare(`UPDATE order_assignments SET status = 'REASSIGNED', updated_at = datetime('now') WHERE order_id = ? AND status NOT IN ('REASSIGNED','SETTLEMENT_CONFIRMED')`).bind(orderId).run();

    await db.prepare(`
      INSERT INTO order_assignments (order_id, team_leader_id, assigned_by, status) VALUES (?, ?, ?, 'ASSIGNED')
    `).bind(orderId, team_leader_id, user.user_id).run();

    await db.prepare(`UPDATE orders SET status = 'ASSIGNED', updated_at = datetime('now') WHERE order_id = ?`).bind(orderId).run();
    await writeStatusHistory(db, { order_id: orderId, from_status: order.status as string, to_status: 'ASSIGNED', actor_id: user.user_id, note: `팀장 배정 → user_id:${team_leader_id}` });

    await upsertTeamLeaderDailyStats(db, team_leader_id, 'intake_count');

    return c.json({ ok: true, order_id: orderId, team_leader_id });
  });

  // ─── 작업 시작 ───
  router.post('/:order_id/start', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
    if (order.status !== 'ASSIGNED') return c.json({ error: `현재 상태(${order.status})에서는 작업 시작이 불가합니다.` }, 400);

    await db.prepare(`UPDATE orders SET status = 'IN_PROGRESS', updated_at = datetime('now') WHERE order_id = ?`).bind(orderId).run();
    await db.prepare(`UPDATE order_assignments SET status = 'IN_PROGRESS', updated_at = datetime('now') WHERE order_id = ? AND status = 'ASSIGNED'`).bind(orderId).run();
    await writeStatusHistory(db, { order_id: orderId, from_status: 'ASSIGNED', to_status: 'IN_PROGRESS', actor_id: user.user_id });

    return c.json({ ok: true });
  });
}
