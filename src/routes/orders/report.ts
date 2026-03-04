// ================================================================
// 다하다 OMS — 보고서 제출 / 사진 관리 v5.0
// State Machine 적용
// ================================================================
import { Hono } from 'hono';
import type { Env, OrderStatus } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { transitionOrder } from '../../lib/state-machine';
import { upsertTeamLeaderDailyStats } from '../../lib/db-helpers';

export function mountReport(router: Hono<Env>) {

  // ─── 보고서 제출 ───
  router.post('/:order_id/reports', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const body = await c.req.json();

    // 보고서 제출은 IN_PROGRESS, REGION_REJECTED, HQ_REJECTED에서 가능
    // State Machine은 SUBMITTED로의 전이만 검증하므로 커스텀 validate 사용
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

    const allowedStatuses: OrderStatus[] = ['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'];
    if (!allowedStatuses.includes(order.status as OrderStatus)) {
      return c.json({ error: `현재 상태(${order.status})에서는 보고서 제출이 불가합니다.` }, 400);
    }

    const reportPolicy = await db.prepare(`
      SELECT * FROM report_policies WHERE service_type = ? AND is_active = 1 ORDER BY version DESC LIMIT 1
    `).bind(order.service_type || 'DEFAULT').first();

    const prevReport = await db.prepare(
      'SELECT MAX(version) as max_ver FROM work_reports WHERE order_id = ?'
    ).bind(orderId).first();
    const newVersion = ((prevReport as any)?.max_ver || 0) + 1;

    // ★ State Machine 적용 — IN_PROGRESS|*_REJECTED → SUBMITTED
    const result = await transitionOrder(db, orderId, 'SUBMITTED', user, {
      note: `보고서 v${newVersion} 제출`,
      afterTransition: async (db) => {
        // 보고서 생성
        const reportResult = await db.prepare(`
          INSERT INTO work_reports (order_id, team_leader_id, policy_id_snapshot, checklist_json, note, version)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(orderId, user.user_id, reportPolicy?.policy_id || null,
          JSON.stringify(body.checklist || {}), body.note || null, newVersion).run();
        const reportId = reportResult.meta.last_row_id;

        // 사진 첨부
        if (body.photos && Array.isArray(body.photos)) {
          for (const photo of body.photos) {
            await db.prepare(`
              INSERT INTO work_report_photos (report_id, category, file_url, file_hash) VALUES (?, ?, ?, ?)
            `).bind(reportId, photo.category, photo.file_url, photo.file_hash || null).run();
          }
        }

        // assignment 동기화
        await db.prepare(`
          UPDATE order_assignments SET status = 'SUBMITTED', updated_at = datetime('now')
          WHERE order_id = ? AND status IN ('IN_PROGRESS','ASSIGNED')
        `).bind(orderId).run();

        // 통계
        await upsertTeamLeaderDailyStats(db, user.user_id, 'submitted_count');
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    // 보고서 ID 조회 (afterTransition에서 생성됨)
    const latestReport = await db.prepare(
      'SELECT report_id, version FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1'
    ).bind(orderId).first();

    return c.json({
      ok: true,
      report_id: latestReport?.report_id,
      version: latestReport?.version || newVersion,
    });
  });
}
