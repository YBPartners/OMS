// ================================================================
// 와이비 OMS — 검수 (1차 지역검수 / 2차 HQ검수) v5.0
// State Machine 적용 — transitionOrder()로 통합
// ================================================================
import { Hono } from 'hono';
import type { Env, OrderStatus } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { transitionOrder } from '../../lib/state-machine';
import { upsertRegionDailyStats, upsertTeamLeaderDailyStats } from '../../lib/db-helpers';

export function mountReview(router: Hono<Env>) {

  // ─── 1차 검수 (REGION) ───
  router.post('/:order_id/review/region', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'REGION_ADMIN', 'AGENCY_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const { result: reviewResult, comment, reason_codes } = await c.req.json();

    if (!['APPROVE', 'REJECT'].includes(reviewResult)) {
      return c.json({ error: '결과는 APPROVE 또는 REJECT입니다.' }, 400);
    }

    // 보고서 확인
    const report = await db.prepare(
      'SELECT * FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1'
    ).bind(orderId).first();
    if (!report) return c.json({ error: '보고서가 없습니다.' }, 404);

    const targetStatus: OrderStatus = reviewResult === 'APPROVE' ? 'REGION_APPROVED' : 'REGION_REJECTED';

    // ★ State Machine 적용 — SUBMITTED → REGION_APPROVED | REGION_REJECTED
    const result = await transitionOrder(db, orderId, targetStatus, user, {
      note: comment,
      afterTransition: async (db, order) => {
        // 검수 기록 삽입
        await db.prepare(`
          INSERT INTO reviews (report_id, order_id, stage, reviewer_id, result, reason_codes_json, comment)
          VALUES (?, ?, 'REGION', ?, ?, ?, ?)
        `).bind(report.report_id, orderId, user.user_id, reviewResult,
          JSON.stringify(reason_codes || []), comment || null).run();

        // assignment 상태 동기화
        await db.prepare(`
          UPDATE order_assignments SET status = ?, updated_at = datetime('now')
          WHERE order_id = ? AND status = 'SUBMITTED'
        `).bind(targetStatus, orderId).run();

        // 통계
        if (reviewResult === 'APPROVE') {
          await upsertRegionDailyStats(db, user.org_id, 'region_approved_count');
        }
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json({ ok: true, new_status: targetStatus });
  });

  // ─── 2차 최종 검수 (HQ) ───
  router.post('/:order_id/review/hq', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const { result: reviewResult, comment, reason_codes } = await c.req.json();

    if (!['APPROVE', 'REJECT'].includes(reviewResult)) {
      return c.json({ error: '결과는 APPROVE 또는 REJECT입니다.' }, 400);
    }

    const report = await db.prepare(
      'SELECT * FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1'
    ).bind(orderId).first();
    if (!report) return c.json({ error: '보고서가 없습니다.' }, 404);

    const targetStatus: OrderStatus = reviewResult === 'APPROVE' ? 'HQ_APPROVED' : 'HQ_REJECTED';

    // ★ State Machine 적용 — REGION_APPROVED → HQ_APPROVED | HQ_REJECTED
    const result = await transitionOrder(db, orderId, targetStatus, user, {
      note: comment,
      afterTransition: async (db, order) => {
        await db.prepare(`
          INSERT INTO reviews (report_id, order_id, stage, reviewer_id, result, reason_codes_json, comment)
          VALUES (?, ?, 'HQ', ?, ?, ?, ?)
        `).bind(report.report_id, orderId, user.user_id, reviewResult,
          JSON.stringify(reason_codes || []), comment || null).run();

        await db.prepare(`
          UPDATE order_assignments SET status = ?, updated_at = datetime('now')
          WHERE order_id = ? AND status = 'REGION_APPROVED'
        `).bind(targetStatus, orderId).run();

        if (reviewResult === 'APPROVE') {
          const dist = await db.prepare(
            "SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = 'ACTIVE'"
          ).bind(orderId).first();
          if (dist) await upsertRegionDailyStats(db, dist.region_org_id as number, 'hq_approved_count');

          const assign = await db.prepare(
            `SELECT team_leader_id FROM order_assignments WHERE order_id = ? AND status = '${targetStatus}'`
          ).bind(orderId).first();
          if (assign) await upsertTeamLeaderDailyStats(db, assign.team_leader_id as number, 'hq_approved_count');
        }
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json({ ok: true, new_status: targetStatus });
  });
}
