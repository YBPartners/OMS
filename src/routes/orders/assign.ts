// ================================================================
// 다하다 OMS — 팀장 배정 (칸반) + 작업 시작 v5.0
// State Machine 적용 — transitionOrder()로 통합
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { transitionOrder } from '../../lib/state-machine';
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

    if (!team_leader_id) return c.json({ error: '팀장 ID는 필수입니다.' }, 400);

    // ★ Scope 검증: REGION은 자기 배분 주문만
    if (user.org_type === 'REGION') {
      const dist = await db.prepare(
        "SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = 'ACTIVE'"
      ).bind(orderId).first();
      if (!dist || dist.region_org_id !== user.org_id) {
        return c.json({ error: '해당 주문에 대한 권한이 없습니다.' }, 403);
      }
    }

    // ★ State Machine 적용 — DISTRIBUTED → ASSIGNED
    const result = await transitionOrder(db, orderId, 'ASSIGNED', user, {
      note: `팀장 배정 → user_id:${team_leader_id}`,
      afterTransition: async (db, order) => {
        // 기존 배정 해제
        await db.prepare(`
          UPDATE order_assignments SET status = 'REASSIGNED', updated_at = datetime('now')
          WHERE order_id = ? AND status NOT IN ('REASSIGNED','SETTLEMENT_CONFIRMED')
        `).bind(orderId).run();

        // 새 배정 생성
        await db.prepare(`
          INSERT INTO order_assignments (order_id, team_leader_id, assigned_by, status) VALUES (?, ?, ?, 'ASSIGNED')
        `).bind(orderId, team_leader_id, user.user_id).run();

        // 통계 업데이트
        await upsertTeamLeaderDailyStats(db, team_leader_id, 'intake_count');
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json({ ok: true, order_id: orderId, team_leader_id });
  });

  // ─── 작업 시작 ───
  router.post('/:order_id/start', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    // ★ State Machine 적용 — ASSIGNED → IN_PROGRESS
    const result = await transitionOrder(db, orderId, 'IN_PROGRESS', user, {
      afterTransition: async (db) => {
        await db.prepare(`
          UPDATE order_assignments SET status = 'IN_PROGRESS', updated_at = datetime('now')
          WHERE order_id = ? AND status = 'ASSIGNED'
        `).bind(orderId).run();
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json({ ok: true });
  });
}
