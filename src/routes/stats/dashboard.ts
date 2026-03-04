// ================================================================
// 다하다 OMS — 대시보드 집계/퍼널 v5.0 (Scope Engine 적용)
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { getOrderScope } from '../../lib/scope-engine';

export function mountDashboard(router: Hono<Env>) {

  // ─── 대시보드 요약 (Scope Engine 기반) ───
  router.get('/dashboard', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const todayStr = new Date().toISOString().split('T')[0];

    // ★ Scope Engine 적용
    const scope = await getOrderScope(user, db, { tableAlias: 'o' });

    const todayStats = await db.prepare(`
      SELECT
        COUNT(CASE WHEN status = 'RECEIVED' THEN 1 END) as received,
        COUNT(CASE WHEN status = 'VALIDATED' THEN 1 END) as validated,
        COUNT(CASE WHEN status = 'DISTRIBUTED' THEN 1 END) as distributed,
        COUNT(CASE WHEN status = 'ASSIGNED' THEN 1 END) as assigned,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'REGION_APPROVED' THEN 1 END) as region_approved,
        COUNT(CASE WHEN status = 'HQ_APPROVED' THEN 1 END) as hq_approved,
        COUNT(CASE WHEN status = 'SETTLEMENT_CONFIRMED' THEN 1 END) as settlement_confirmed,
        COUNT(CASE WHEN status IN ('REGION_REJECTED','HQ_REJECTED') THEN 1 END) as rejected,
        COUNT(*) as total,
        COALESCE(SUM(base_amount), 0) as total_amount
      FROM orders o WHERE ${scope.where}
    `).bind(...scope.binds).first();

    const todayReceived = await db.prepare(`
      SELECT COUNT(*) as cnt FROM orders o WHERE DATE(created_at) = ? AND ${scope.where}
    `).bind(todayStr, ...scope.binds).first();

    const pendingReview = await db.prepare(`
      SELECT COUNT(*) as cnt FROM orders o WHERE status = 'SUBMITTED' AND ${scope.where}
    `).bind(...scope.binds).first();

    const pendingHQReview = await db.prepare(`
      SELECT COUNT(*) as cnt FROM orders o WHERE status = 'REGION_APPROVED' AND ${scope.where}
    `).bind(...scope.binds).first();

    // 미해결 이슈 (HQ/AUDITOR만)
    let recentIssues: any[] = [];
    if (scope.isGlobal) {
      const issueResult = await db.prepare(`
        SELECT type, severity, COUNT(*) as cnt
        FROM reconciliation_issues WHERE resolved_at IS NULL
        GROUP BY type, severity ORDER BY severity DESC
      `).all();
      recentIssues = issueResult.results;
    }

    // 지역별 요약 (HQ는 전체, REGION은 자기만)
    let regionQuery = `
      SELECT org.name as region_name, org.org_id,
        COUNT(CASE WHEN o.status IN ('DISTRIBUTED','ASSIGNED','IN_PROGRESS') THEN 1 END) as active_orders,
        COUNT(CASE WHEN o.status = 'SUBMITTED' THEN 1 END) as pending_review,
        COUNT(CASE WHEN o.status = 'HQ_APPROVED' THEN 1 END) as ready_for_settlement,
        COUNT(CASE WHEN o.status = 'SETTLEMENT_CONFIRMED' THEN 1 END) as settled
      FROM orders o
      JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
      JOIN organizations org ON od.region_org_id = org.org_id
    `;
    const regionParams: any[] = [];
    if (user.org_type === 'REGION') {
      regionQuery += ' WHERE od.region_org_id = ?';
      regionParams.push(user.org_id);
    }
    regionQuery += ' GROUP BY org.org_id';

    const regionSummary = user.org_type !== 'TEAM'
      ? await db.prepare(regionQuery).bind(...regionParams).all()
      : { results: [] };

    return c.json({
      today: todayStats,
      today_received: (todayReceived as any)?.cnt || 0,
      pending_review: (pendingReview as any)?.cnt || 0,
      pending_hq_review: (pendingHQReview as any)?.cnt || 0,
      recent_issues: recentIssues,
      region_summary: regionSummary.results,
    });
  });
}
