// ================================================================
// Airflow OMS — 팀장 배정 (칸반) + 준비완료 + 작업 시작 v6.0
// v6.0: READY_DONE 단계 추가, 알림 트리거, 대리점 Scope 실시간 DB 조회
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { transitionOrder } from '../../lib/state-machine';
import { upsertTeamLeaderDailyStats } from '../../lib/db-helpers';
import { createNotification } from '../../services/notification-service';

export function mountAssign(router: Hono<Env>) {

  // ─── 팀장 배정 (칸반 드래그앤드롭) ───
  router.post('/:order_id/assign', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AGENCY_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const { team_leader_id } = await c.req.json();

    if (!team_leader_id) return c.json({ error: '팀장 ID는 필수입니다.' }, 400);

    // ★ GAP-4 fix: 대리점 Scope 실시간 DB 조회 (session 캐시 대신)
    if (user.roles.includes('AGENCY_LEADER') && user.org_type === 'TEAM' && !user.roles.includes('SUPER_ADMIN')) {
      const liveTeams = await db.prepare(
        'SELECT team_user_id FROM agency_team_mappings WHERE agency_user_id = ?'
      ).bind(user.user_id).all();
      const liveTeamIds = liveTeams.results.map((r: any) => r.team_user_id);
      if (!liveTeamIds.includes(team_leader_id) && team_leader_id !== user.user_id) {
        return c.json({ error: '하위 팀장에게만 배정할 수 있습니다.' }, 403);
      }
    }

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

        // ★ GAP-3: 배정 알림 전송
        await createNotification(db, team_leader_id, {
          type: 'ASSIGNMENT',
          title: '새 주문 배정',
          message: `주문 #${orderId}이(가) 배정되었습니다.`,
          link_url: '#my-orders',
          metadata_json: JSON.stringify({ order_id: orderId }),
        });
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json({ ok: true, order_id: orderId, team_leader_id });
  });

  // ─── 배치 배정 (다중 주문 → 한 팀장) ───
  router.post('/batch-assign', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AGENCY_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { order_ids, team_leader_id } = await c.req.json();

    if (!team_leader_id) return c.json({ error: '팀장 ID는 필수입니다.' }, 400);
    if (!Array.isArray(order_ids) || order_ids.length === 0) return c.json({ error: '주문 ID 목록은 필수입니다.' }, 400);
    if (order_ids.length > 50) return c.json({ error: '한 번에 최대 50건까지 배정할 수 있습니다.' }, 400);

    let success = 0, failed = 0;
    const errors: { order_id: number; error: string }[] = [];

    for (const orderId of order_ids) {
      // Scope 검증
      if (user.org_type === 'REGION') {
        const dist = await db.prepare(
          "SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = 'ACTIVE'"
        ).bind(orderId).first();
        if (!dist || dist.region_org_id !== user.org_id) {
          failed++; errors.push({ order_id: orderId, error: '권한 없음' }); continue;
        }
      }

      const result = await transitionOrder(db, orderId, 'ASSIGNED', user, {
        note: `배치 배정 → user_id:${team_leader_id}`,
        afterTransition: async (db, order) => {
          await db.prepare(`
            UPDATE order_assignments SET status = 'REASSIGNED', updated_at = datetime('now')
            WHERE order_id = ? AND status NOT IN ('REASSIGNED','SETTLEMENT_CONFIRMED')
          `).bind(orderId).run();
          await db.prepare(`
            INSERT INTO order_assignments (order_id, team_leader_id, assigned_by, status) VALUES (?, ?, ?, 'ASSIGNED')
          `).bind(orderId, team_leader_id, user.user_id).run();
          await upsertTeamLeaderDailyStats(db, team_leader_id, 'intake_count');
        },
      });
      if (result.ok) success++;
      else { failed++; errors.push({ order_id: orderId, error: result.error || '전이 실패' }); }
    }

    return c.json({ ok: true, success, failed, total: order_ids.length, errors });
  });

  // ─── 배정 해제 (ASSIGNED → DISTRIBUTED) ───
  router.post('/:order_id/unassign', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AGENCY_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    // Scope 검증
    if (user.org_type === 'REGION') {
      const dist = await db.prepare(
        "SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = 'ACTIVE'"
      ).bind(orderId).first();
      if (!dist || dist.region_org_id !== user.org_id) {
        return c.json({ error: '해당 주문에 대한 권한이 없습니다.' }, 403);
      }
    }

    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
    if (order.status !== 'ASSIGNED') {
      return c.json({ error: `배정 해제는 ASSIGNED 상태에서만 가능합니다. 현재: ${order.status}` }, 400);
    }

    // 수동으로 DISTRIBUTED로 롤백 (state machine 우회 — 역방향 전이)
    await db.prepare(
      "UPDATE orders SET status = 'DISTRIBUTED', updated_at = datetime('now') WHERE order_id = ? AND status = 'ASSIGNED'"
    ).bind(orderId).run();

    await db.prepare(`
      UPDATE order_assignments SET status = 'REASSIGNED', updated_at = datetime('now')
      WHERE order_id = ? AND status = 'ASSIGNED'
    `).bind(orderId).run();

    const { writeStatusHistory } = await import('../../lib/audit');
    await writeStatusHistory(db, {
      order_id: orderId, from_status: 'ASSIGNED', to_status: 'DISTRIBUTED',
      actor_id: user.user_id, note: '배정 해제 (관리자)'
    });

    return c.json({ ok: true, order_id: orderId, new_status: 'DISTRIBUTED' });
  });

  // ─── 준비완료 (ASSIGNED → READY_DONE: 고객통화 + 일정확정) ───
  router.post('/:order_id/ready-done', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    let body: any = {};
    try { body = await c.req.json(); } catch { /* optional body */ }

    // ★ State Machine 적용 — ASSIGNED → READY_DONE
    const result = await transitionOrder(db, orderId, 'READY_DONE', user, {
      note: body.note || '고객 통화 후 일정 확정',
      additionalUpdates: {
        ...(body.scheduled_date ? { scheduled_date: body.scheduled_date } : {}),
        ...(body.scheduled_time ? { scheduled_time: body.scheduled_time } : {}),
      },
      afterTransition: async (db) => {
        await db.prepare(`
          UPDATE order_assignments SET status = 'READY_DONE', updated_at = datetime('now')
          WHERE order_id = ? AND status = 'ASSIGNED'
        `).bind(orderId).run();
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json({ ok: true, scheduled_date: body.scheduled_date || null, scheduled_time: body.scheduled_time || null });
  });

  // ─── 작업 시작 (READY_DONE → IN_PROGRESS) ───
  router.post('/:order_id/start', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    // ★ State Machine 적용 — READY_DONE/CONFIRMED → IN_PROGRESS
    const result = await transitionOrder(db, orderId, 'IN_PROGRESS', user, {
      afterTransition: async (db) => {
        await db.prepare(`
          UPDATE order_assignments SET status = 'IN_PROGRESS', updated_at = datetime('now')
          WHERE order_id = ? AND status IN ('ASSIGNED','READY_DONE','CONFIRMED')
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
