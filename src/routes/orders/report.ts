// ================================================================
// 와이비 OMS — 보고서 제출 / 영수증 첨부 / 사진 관리 v6.0
// State Machine 적용 + SUBMITTED→DONE 전이 (영수증 첨부)
// ================================================================
import { Hono } from 'hono';
import type { Env, OrderStatus } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { transitionOrder } from '../../lib/state-machine';
import { upsertTeamLeaderDailyStats } from '../../lib/db-helpers';
import { createNotification } from '../../services/notification-service';

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

  // ─── 영수증 첨부로 최종완료 (SUBMITTED → DONE) ───
  router.post('/:order_id/complete', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    let body: any = {};
    try { body = await c.req.json(); } catch { /* optional body */ }

    // ★ State Machine 적용 — SUBMITTED → DONE
    const result = await transitionOrder(db, orderId, 'DONE', user, {
      note: body.note || '영수증 첨부 완료 → 최종완료',
      afterTransition: async (db, order) => {
        // 영수증 사진 첨부 (선택적)
        if (body.receipt_url) {
          const report = await db.prepare(
            'SELECT report_id FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1'
          ).bind(orderId).first();
          if (report) {
            await db.prepare(`
              INSERT INTO work_report_photos (report_id, category, file_url, file_hash) VALUES (?, 'RECEIPT', ?, ?)
            `).bind(report.report_id, body.receipt_url, body.file_hash || null).run();
          }
        }

        // assignment 상태 동기화
        await db.prepare(`
          UPDATE order_assignments SET status = 'DONE', updated_at = datetime('now')
          WHERE order_id = ? AND status = 'SUBMITTED'
        `).bind(orderId).run();

        // ★ GAP-3: 검수자(REGION_ADMIN)에게 알림
        const dist = await db.prepare(
          "SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = 'ACTIVE'"
        ).bind(orderId).first();
        if (dist) {
          const reviewers = await db.prepare(`
            SELECT u.user_id FROM users u
            JOIN user_roles ur ON u.user_id = ur.user_id
            JOIN roles r ON ur.role_id = r.role_id
            WHERE u.org_id = ? AND r.code = 'REGION_ADMIN' AND u.status = 'ACTIVE'
          `).bind(dist.region_org_id).all();
          for (const rv of reviewers.results as any[]) {
            await createNotification(db, rv.user_id, {
              type: 'ORDER_COMPLETED',
              title: '검수 대기',
              message: `주문 #${orderId}이(가) 최종완료되어 검수 대기 중입니다.`,
              link_url: '#review-region',
              metadata_json: JSON.stringify({ order_id: orderId }),
            });
          }
        }
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json({ ok: true, order_id: orderId, new_status: 'DONE' });
  });
}
