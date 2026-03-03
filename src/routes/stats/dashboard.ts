// ================================================================
// 다하다 OMS — 대시보드 집계/퍼널
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';

export function mountDashboard(router: Hono<Env>) {

  // ─── 대시보드 요약 (HQ) ───
  router.get('/dashboard', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const today = new Date().toISOString().split('T')[0];

    let scopeWhere = '';
    let scopeParams: any[] = [];
    if (user.roles.includes('TEAM_LEADER')) {
      scopeWhere = `AND o.order_id IN (SELECT order_id FROM order_assignments WHERE team_leader_id = ?)`;
      scopeParams = [user.user_id];
    } else if (user.org_type === 'REGION') {
      scopeWhere = `AND o.order_id IN (SELECT order_id FROM order_distributions WHERE region_org_id = ? AND status = 'ACTIVE')`;
      scopeParams = [user.org_id];
    }

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
      FROM orders o WHERE 1=1 ${scopeWhere}
    `).bind(...scopeParams).first();

    const todayReceived = await db.prepare(`
      SELECT COUNT(*) as cnt FROM orders o WHERE DATE(created_at) = ? ${scopeWhere}
    `).bind(today, ...scopeParams).first();

    const pendingReview = await db.prepare(`
      SELECT COUNT(*) as cnt FROM orders o WHERE status = 'SUBMITTED' ${scopeWhere}
    `).bind(...scopeParams).first();

    const pendingHQReview = await db.prepare(`
      SELECT COUNT(*) as cnt FROM orders o WHERE status = 'REGION_APPROVED' ${scopeWhere}
    `).bind(...scopeParams).first();

    const recentIssues = await db.prepare(`
      SELECT type, severity, COUNT(*) as cnt
      FROM reconciliation_issues WHERE resolved_at IS NULL
      GROUP BY type, severity ORDER BY severity DESC
    `).all();

    const regionSummary = await db.prepare(`
      SELECT org.name as region_name, org.org_id,
        COUNT(CASE WHEN o.status IN ('DISTRIBUTED','ASSIGNED','IN_PROGRESS') THEN 1 END) as active_orders,
        COUNT(CASE WHEN o.status = 'SUBMITTED' THEN 1 END) as pending_review,
        COUNT(CASE WHEN o.status = 'HQ_APPROVED' THEN 1 END) as ready_for_settlement,
        COUNT(CASE WHEN o.status = 'SETTLEMENT_CONFIRMED' THEN 1 END) as settled
      FROM orders o
      JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
      JOIN organizations org ON od.region_org_id = org.org_id
      GROUP BY org.org_id
    `).all();

    return c.json({
      today: todayStats,
      today_received: (todayReceived as any)?.cnt || 0,
      pending_review: (pendingReview as any)?.cnt || 0,
      pending_hq_review: (pendingHQReview as any)?.cnt || 0,
      recent_issues: recentIssues.results,
      region_summary: regionSummary.results,
    });
  });
}
