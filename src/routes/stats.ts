import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';

const stats = new Hono<Env>();

// ─── 지역법인별 일자별 통계 ───
stats.get('/regions/daily', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AUDITOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { from, to, region_org_id } = c.req.query();

  let query = `
    SELECT rds.*, o.name as region_name
    FROM region_daily_stats rds
    JOIN organizations o ON rds.region_org_id = o.org_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // 스코프 제한
  if (user.org_type === 'REGION') {
    query += ' AND rds.region_org_id = ?';
    params.push(user.org_id);
  } else if (region_org_id) {
    query += ' AND rds.region_org_id = ?';
    params.push(Number(region_org_id));
  }

  if (from) { query += ' AND rds.date >= ?'; params.push(from); }
  if (to) { query += ' AND rds.date <= ?'; params.push(to); }
  query += ' ORDER BY rds.date DESC, rds.region_org_id';

  const result = await db.prepare(query).bind(...params).all();
  return c.json({ stats: result.results });
});

// ─── 팀장별 일자별 통계 ───
stats.get('/team-leaders/daily', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { from, to, team_leader_id, region_org_id } = c.req.query();

  let query = `
    SELECT tls.*, u.name as team_leader_name, u.org_id, o.name as org_name
    FROM team_leader_daily_stats tls
    JOIN users u ON tls.team_leader_id = u.user_id
    JOIN organizations o ON u.org_id = o.org_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // 스코프
  if (user.roles.includes('TEAM_LEADER')) {
    query += ' AND tls.team_leader_id = ?';
    params.push(user.user_id);
  } else if (user.org_type === 'REGION') {
    query += ' AND u.org_id = ?';
    params.push(user.org_id);
  } else if (region_org_id) {
    query += ' AND u.org_id = ?';
    params.push(Number(region_org_id));
  }

  if (team_leader_id) { query += ' AND tls.team_leader_id = ?'; params.push(Number(team_leader_id)); }
  if (from) { query += ' AND tls.date >= ?'; params.push(from); }
  if (to) { query += ' AND tls.date <= ?'; params.push(to); }
  query += ' ORDER BY tls.date DESC, tls.team_leader_id';

  const result = await db.prepare(query).bind(...params).all();
  return c.json({ stats: result.results });
});

// ─── 대시보드 요약 (HQ) ───
stats.get('/dashboard', async (c) => {
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

  // 오늘 현황
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

  // 오늘 수신
  const todayReceived = await db.prepare(`
    SELECT COUNT(*) as cnt FROM orders o WHERE DATE(created_at) = ? ${scopeWhere}
  `).bind(today, ...scopeParams).first();

  // 검수 대기(SUBMITTED)
  const pendingReview = await db.prepare(`
    SELECT COUNT(*) as cnt FROM orders o WHERE status = 'SUBMITTED' ${scopeWhere}
  `).bind(...scopeParams).first();

  // HQ 검수 대기(REGION_APPROVED)
  const pendingHQReview = await db.prepare(`
    SELECT COUNT(*) as cnt FROM orders o WHERE status = 'REGION_APPROVED' ${scopeWhere}
  `).bind(...scopeParams).first();

  // 최근 대사 이슈
  const recentIssues = await db.prepare(`
    SELECT type, severity, COUNT(*) as cnt
    FROM reconciliation_issues WHERE resolved_at IS NULL
    GROUP BY type, severity ORDER BY severity DESC
  `).all();

  // 지역별 요약
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

// ─── CSV 다운로드 (통계) ───
stats.get('/export/csv', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AUDITOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { scope = 'region', from, to, group_by = 'region' } = c.req.query();

  let rows: any[] = [];
  let headers: string[] = [];

  if (group_by === 'team_leader') {
    headers = ['날짜', '팀장명', '소속법인', '수임건수', '완료건수', '제출건수', '지역승인', 'HQ승인', '반려건수', '정산확정', '기본금액합', '지급금액합'];
    
    let query = `
      SELECT tls.date, u.name as team_leader_name, o.name as org_name,
        tls.intake_count, tls.completed_count, tls.submitted_count,
        tls.region_approved_count, tls.hq_approved_count, tls.rejected_count,
        tls.settlement_confirmed_count, tls.base_amount_sum, tls.payable_amount_sum
      FROM team_leader_daily_stats tls
      JOIN users u ON tls.team_leader_id = u.user_id
      JOIN organizations o ON u.org_id = o.org_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (user.org_type === 'REGION') { query += ' AND u.org_id = ?'; params.push(user.org_id); }
    if (from) { query += ' AND tls.date >= ?'; params.push(from); }
    if (to) { query += ' AND tls.date <= ?'; params.push(to); }
    query += ' ORDER BY tls.date, u.name';

    const result = await db.prepare(query).bind(...params).all();
    rows = result.results;
  } else {
    headers = ['날짜', '지역법인', '인입건수', '팀장배정', '완료건수', '지역승인', 'HQ승인', '정산확정', '기본금액합', '지급금액합'];
    
    let query = `
      SELECT rds.date, o.name as region_name,
        rds.intake_count, rds.assigned_to_team_count, rds.completed_count,
        rds.region_approved_count, rds.hq_approved_count,
        rds.settlement_confirmed_count, rds.base_amount_sum, rds.payable_amount_sum
      FROM region_daily_stats rds
      JOIN organizations o ON rds.region_org_id = o.org_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (user.org_type === 'REGION') { query += ' AND rds.region_org_id = ?'; params.push(user.org_id); }
    if (from) { query += ' AND rds.date >= ?'; params.push(from); }
    if (to) { query += ' AND rds.date <= ?'; params.push(to); }
    query += ' ORDER BY rds.date, o.name';

    const result = await db.prepare(query).bind(...params).all();
    rows = result.results;
  }

  // CSV 생성
  const BOM = '\uFEFF';
  let csv = BOM + headers.join(',') + '\n';
  for (const row of rows) {
    const values = Object.values(row).map((v: any) => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      return str.includes(',') ? `"${str}"` : str;
    });
    csv += values.join(',') + '\n';
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="stats_${group_by}_${from || 'all'}_${to || 'all'}.csv"`,
    }
  });
});

// ─── 정책 관리 API ───
stats.get('/policies/distribution', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;
  const result = await c.env.DB.prepare('SELECT * FROM distribution_policies ORDER BY version DESC').all();
  return c.json({ policies: result.results });
});

stats.get('/policies/report', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;
  const result = await c.env.DB.prepare('SELECT * FROM report_policies ORDER BY version DESC').all();
  return c.json({ policies: result.results });
});

stats.get('/policies/commission', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const db = c.env.DB;

  let query = `
    SELECT cp.*, o.name as org_name, u.name as team_leader_name
    FROM commission_policies cp
    JOIN organizations o ON cp.org_id = o.org_id
    LEFT JOIN users u ON cp.team_leader_id = u.user_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
    query += ' AND cp.org_id = ?';
    params.push(user.org_id);
  }
  query += ' ORDER BY cp.org_id, cp.team_leader_id';

  const result = await db.prepare(query).bind(...params).all();
  return c.json({ policies: result.results });
});

// ─── 지역권 매핑 조회 ───
stats.get('/territories', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const result = await c.env.DB.prepare(`
    SELECT t.*, ot.org_id, o.name as org_name
    FROM territories t
    LEFT JOIN org_territories ot ON t.territory_id = ot.territory_id AND (ot.effective_to IS NULL OR ot.effective_to > datetime('now'))
    LEFT JOIN organizations o ON ot.org_id = o.org_id
    WHERE t.status = 'ACTIVE'
    ORDER BY t.sido, t.sigungu, t.eupmyeondong
  `).all();

  return c.json({ territories: result.results });
});

export default stats;
