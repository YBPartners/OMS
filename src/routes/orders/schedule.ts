// ================================================================
// Airflow OMS — Schedule API (캘린더 뷰 데이터)
// GET /orders/schedule — 기간별 일정이 있는 주문 목록
// PATCH /orders/schedule/:order_id — 일정 변경 (드래그 등)
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { getOrderScope } from '../../lib/scope-engine';
import { writeAuditLog } from '../../lib/audit';

export function mountSchedule(router: Hono<Env>) {

  // ─── 캘린더 이벤트 조회 ───
  router.get('/schedule', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AGENCY_LEADER', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const from = c.req.query('from');
    const to = c.req.query('to');

    if (!from || !to) {
      return c.json({ error: 'from, to 파라미터 필요 (YYYY-MM-DD)' }, 400);
    }

    const scope = await getOrderScope(user, db, { tableAlias: 'o' });

    // 스케줄이 있는 주문 + 배정된 주문(스케줄 없어도 보여줌)
    const sql = `
      SELECT o.order_id, o.external_order_no, o.customer_name, o.customer_phone,
             o.address_text, o.scheduled_date, o.scheduled_time,
             o.status, o.base_amount, o.requested_date, o.memo,
             ch.name as channel_name,
             tl.name as team_leader_name, tl.user_id as team_leader_id,
             org.name as region_name
      FROM orders o
      LEFT JOIN order_distributions od ON o.order_id = od.order_id
      LEFT JOIN order_assignments oa ON o.order_id = oa.order_id
      LEFT JOIN users tl ON oa.team_leader_id = tl.user_id
      LEFT JOIN channels ch ON o.channel_id = ch.channel_id
      LEFT JOIN organizations org ON od.region_org_id = org.org_id
      WHERE ${scope.where}
        AND (
          (o.scheduled_date >= ? AND o.scheduled_date <= ?)
          OR (o.scheduled_date IS NULL AND o.status IN ('ASSIGNED','READY_DONE','IN_PROGRESS')
              AND o.requested_date >= ? AND o.requested_date <= ?)
        )
      ORDER BY o.scheduled_date ASC, o.scheduled_time ASC NULLS LAST, o.order_id ASC
    `;

    const result = await db.prepare(sql)
      .bind(...scope.binds, from, to, from, to)
      .all();

    return c.json({ events: result.results || [] });
  });

  // ─── 일정 변경 (드래그&드롭 등) ───
  router.patch('/schedule/:order_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AGENCY_LEADER', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    let body: any = {};
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid body' }, 400); }

    const { scheduled_date, scheduled_time } = body;
    if (!scheduled_date) {
      return c.json({ error: 'scheduled_date 필수' }, 400);
    }

    // 권한 확인: 본인 배정 주문 또는 상위 관리자
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first() as any;
    if (!order) return c.json({ error: '주문 없음' }, 404);

    if (user.role === 'TEAM_LEADER') {
      const assignment = await db.prepare(
        'SELECT 1 FROM order_assignments WHERE order_id = ? AND team_leader_id = ?'
      ).bind(orderId, user.user_id).first();
      if (!assignment) return c.json({ error: '본인 배정 주문만 변경 가능' }, 403);
    }

    const setClauses = ['scheduled_date = ?', "updated_at = datetime('now')"];
    const binds: any[] = [scheduled_date];

    if (scheduled_time !== undefined) {
      setClauses.push('scheduled_time = ?');
      binds.push(scheduled_time || null);
    }

    binds.push(orderId);
    await db.prepare(`UPDATE orders SET ${setClauses.join(', ')} WHERE order_id = ?`)
      .bind(...binds).run();

    await writeAuditLog(db, {
      user_id: user.user_id,
      action: 'SCHEDULE_CHANGE',
      entity_type: 'ORDER',
      entity_id: orderId,
      details: JSON.stringify({ scheduled_date, scheduled_time, prev_date: order.scheduled_date, prev_time: order.scheduled_time }),
    });

    return c.json({ ok: true, scheduled_date, scheduled_time: scheduled_time ?? order.scheduled_time });
  });
}
