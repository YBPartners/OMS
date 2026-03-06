// ================================================================
// 와이비 OMS — 대시보드 집계/퍼널 v14.0 (Scope Engine 적용)
// 매출 추이 + 정산 현황 추가
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
    if (user.org_type === 'REGION' && !user.roles.includes('TEAM_LEADER')) {
      regionQuery += ' WHERE od.region_org_id = ?';
      regionParams.push(user.org_id);
    }
    regionQuery += ' GROUP BY org.org_id';

    // TEAM_LEADER / AGENCY_LEADER는 지역총판 요약 불필요 (자기 주문만 보이므로)
    const isTeamRole = user.roles.includes('TEAM_LEADER') && !user.roles.some(r => ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AUDITOR'].includes(r));
    const regionSummary = !isTeamRole
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

  // ─── 매출 추이 (최근 30일) ───
  router.get('/revenue-trend', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AUDITOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const days = Math.min(Number(c.req.query('days') || 30), 90);

    let regionFilter = '';
    const params: any[] = [];
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      regionFilter = ' AND rds.region_org_id = ?';
      params.push(user.org_id);
    }

    // 일별 매출 추이
    const dailyRevenue = await db.prepare(`
      SELECT rds.date,
        SUM(rds.intake_count) as orders,
        SUM(rds.base_amount_sum) as revenue,
        SUM(rds.payable_amount_sum) as payable,
        SUM(rds.settlement_confirmed_count) as settled
      FROM region_daily_stats rds
      WHERE rds.date >= date('now', '-${days} days')${regionFilter}
      GROUP BY rds.date
      ORDER BY rds.date ASC
    `).bind(...params).all();

    // 월별 매출 추이
    const monthlyRevenue = await db.prepare(`
      SELECT substr(rds.date, 1, 7) as month,
        SUM(rds.intake_count) as orders,
        SUM(rds.base_amount_sum) as revenue,
        SUM(rds.payable_amount_sum) as payable,
        SUM(rds.settlement_confirmed_count) as settled
      FROM region_daily_stats rds
      WHERE rds.date >= date('now', '-12 months')${regionFilter}
      GROUP BY substr(rds.date, 1, 7)
      ORDER BY month ASC
    `).bind(...params).all();

    // 지역별 매출 (누적)
    const regionRevenue = await db.prepare(`
      SELECT o.name as region_name, rds.region_org_id,
        SUM(rds.base_amount_sum) as revenue,
        SUM(rds.payable_amount_sum) as payable,
        SUM(rds.intake_count) as orders,
        SUM(rds.settlement_confirmed_count) as settled
      FROM region_daily_stats rds
      JOIN organizations o ON rds.region_org_id = o.org_id
      WHERE rds.date >= date('now', '-${days} days')${regionFilter}
      GROUP BY rds.region_org_id
      ORDER BY revenue DESC
    `).bind(...params).all();

    return c.json({
      daily: dailyRevenue.results,
      monthly: monthlyRevenue.results,
      by_region: regionRevenue.results,
      period_days: days,
    });
  });

  // ─── 정산 현황 ───
  router.get('/settlement-summary', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AUDITOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;

    let regionFilter = '';
    const params: any[] = [];
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      regionFilter = ' AND s.region_org_id = ?';
      params.push(user.org_id);
    }

    // 정산 상태별 현황
    const statusSummary = await db.prepare(`
      SELECT s.status,
        COUNT(*) as count,
        COALESCE(SUM(s.base_amount), 0) as base_total,
        COALESCE(SUM(s.commission_amount), 0) as commission_total,
        COALESCE(SUM(s.payable_amount), 0) as payable_total
      FROM settlements s
      WHERE 1=1${regionFilter}
      GROUP BY s.status
    `).bind(...params).all();

    // 최근 정산 Run 목록
    const recentRuns = await db.prepare(`
      SELECT sr.run_id, sr.period_start, sr.period_end, sr.period_type, sr.status, sr.created_at,
        COUNT(s.settlement_id) as settlement_count,
        COALESCE(SUM(s.base_amount), 0) as total_base,
        COALESCE(SUM(s.payable_amount), 0) as total_payable
      FROM settlement_runs sr
      LEFT JOIN settlements s ON sr.run_id = s.run_id
      ${user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') ? 'AND s.region_org_id = ?' : ''}
      GROUP BY sr.run_id
      ORDER BY sr.created_at DESC
      LIMIT 10
    `).bind(...(user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') ? [user.org_id] : [])).all();

    // 지역별 정산 현황
    const regionSettlement = await db.prepare(`
      SELECT org.name as region_name, s.region_org_id,
        COUNT(CASE WHEN s.status = 'CALCULATED' THEN 1 END) as calculated,
        COUNT(CASE WHEN s.status = 'CONFIRMED' THEN 1 END) as confirmed,
        COUNT(CASE WHEN s.status = 'PAID' THEN 1 END) as paid,
        COALESCE(SUM(CASE WHEN s.status = 'CONFIRMED' THEN s.payable_amount ELSE 0 END), 0) as confirmed_amount,
        COALESCE(SUM(CASE WHEN s.status = 'PAID' THEN s.payable_amount ELSE 0 END), 0) as paid_amount
      FROM settlements s
      JOIN organizations org ON s.region_org_id = org.org_id
      WHERE 1=1${regionFilter}
      GROUP BY s.region_org_id
      ORDER BY confirmed_amount DESC
    `).bind(...params).all();

    return c.json({
      status_summary: statusSummary.results,
      recent_runs: recentRuns.results,
      by_region: regionSettlement.results,
    });
  });
}
