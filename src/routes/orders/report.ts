// ================================================================
// 다하다 OMS — 보고서 제출 / 사진 관리
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeStatusHistory } from '../../lib/audit';
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

    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
    if (!['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(order.status as string)) {
      return c.json({ error: `현재 상태(${order.status})에서는 보고서 제출이 불가합니다.` }, 400);
    }

    const reportPolicy = await db.prepare(`SELECT * FROM report_policies WHERE service_type = ? AND is_active = 1 ORDER BY version DESC LIMIT 1`).bind(order.service_type || 'DEFAULT').first();

    const prevReport = await db.prepare('SELECT MAX(version) as max_ver FROM work_reports WHERE order_id = ?').bind(orderId).first();
    const newVersion = ((prevReport as any)?.max_ver || 0) + 1;

    const reportResult = await db.prepare(`
      INSERT INTO work_reports (order_id, team_leader_id, policy_id_snapshot, checklist_json, note, version)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(orderId, user.user_id, reportPolicy?.policy_id || null, JSON.stringify(body.checklist || {}), body.note || null, newVersion).run();
    const reportId = reportResult.meta.last_row_id;

    if (body.photos && Array.isArray(body.photos)) {
      for (const photo of body.photos) {
        await db.prepare(`
          INSERT INTO work_report_photos (report_id, category, file_url, file_hash) VALUES (?, ?, ?, ?)
        `).bind(reportId, photo.category, photo.file_url, photo.file_hash || null).run();
      }
    }

    await db.prepare(`UPDATE orders SET status = 'SUBMITTED', updated_at = datetime('now') WHERE order_id = ?`).bind(orderId).run();
    await db.prepare(`UPDATE order_assignments SET status = 'SUBMITTED', updated_at = datetime('now') WHERE order_id = ? AND status IN ('IN_PROGRESS','ASSIGNED')`).bind(orderId).run();
    await writeStatusHistory(db, { order_id: orderId, from_status: order.status as string, to_status: 'SUBMITTED', actor_id: user.user_id, note: `보고서 v${newVersion} 제출` });

    await upsertTeamLeaderDailyStats(db, user.user_id, 'submitted_count');

    return c.json({ ok: true, report_id: reportId, version: newVersion });
  });
}
