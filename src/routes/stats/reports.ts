// ================================================================
// 와이비 OMS — 일별 통계 + CSV 내보내기 v5.0 (Scope Engine 적용)
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';

export function mountReports(router: Hono<Env>) {

  // ─── 지역(총판)별 일자별 통계 ───
  router.get('/regions/daily', async (c) => {
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

    // ★ Scope: REGION은 자기 총판만
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
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

  // ─── 팀장별 일자별 통계 (Scope Engine 기반) ───
  router.get('/team-leaders/daily', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { from, to, team_leader_id, region_org_id } = c.req.query();

    let query = `
      SELECT tls.*, u.name as team_leader_name, u.org_id,
             o.name as org_name, o.org_type, o.parent_org_id,
             COALESCE(p.name, o.name) as distributor_name
      FROM team_leader_daily_stats tls
      JOIN users u ON tls.team_leader_id = u.user_id
      JOIN organizations o ON u.org_id = o.org_id
      LEFT JOIN organizations p ON o.parent_org_id = p.org_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // ★ Scope: TEAM은 자기만, REGION은 자기 총판+하위 팀, HQ는 전체
    if (user.org_type === 'TEAM' || user.roles.includes('TEAM_LEADER')) {
      query += ' AND tls.team_leader_id = ?';
      params.push(user.user_id);
    } else if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      // 자기 총판 직속 + 하위 TEAM 소속 팀장
      query += ' AND (u.org_id = ? OR o.parent_org_id = ?)';
      params.push(user.org_id, user.org_id);
    } else if (region_org_id) {
      query += ' AND (u.org_id = ? OR o.parent_org_id = ?)';
      params.push(Number(region_org_id), Number(region_org_id));
    }

    if (team_leader_id) { query += ' AND tls.team_leader_id = ?'; params.push(Number(team_leader_id)); }
    if (from) { query += ' AND tls.date >= ?'; params.push(from); }
    if (to) { query += ' AND tls.date <= ?'; params.push(to); }
    query += ' ORDER BY tls.date DESC, tls.team_leader_id';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ stats: result.results });
  });

  // ─── CSV 다운로드 (Scope Engine 기반) ───
  router.get('/export/csv', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AUDITOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { scope = 'region', from, to, group_by = 'region' } = c.req.query();

    let rows: any[] = [];
    let headers: string[] = [];

    if (group_by === 'team_leader') {
      headers = ['날짜', '팀장명', '소속조직', '수임건수', '완료건수', '제출건수', '지역승인', 'HQ승인', '반려건수', '정산확정', '기본금액합', '지급금액합'];
      
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
      // ★ Scope: REGION은 자기 총판+하위만
      if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
        query += ' AND (u.org_id = ? OR o.parent_org_id = ?)';
        params.push(user.org_id, user.org_id);
      }
      if (from) { query += ' AND tls.date >= ?'; params.push(from); }
      if (to) { query += ' AND tls.date <= ?'; params.push(to); }
      query += ' ORDER BY tls.date, u.name';

      const result = await db.prepare(query).bind(...params).all();
      rows = result.results;
    } else {
      headers = ['날짜', '총판명', '인입건수', '팀장배정', '완료건수', '지역승인', 'HQ승인', '정산확정', '기본금액합', '지급금액합'];
      
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
      if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
        query += ' AND rds.region_org_id = ?';
        params.push(user.org_id);
      }
      if (from) { query += ' AND rds.date >= ?'; params.push(from); }
      if (to) { query += ' AND rds.date <= ?'; params.push(to); }
      query += ' ORDER BY rds.date, o.name';

      const result = await db.prepare(query).bind(...params).all();
      rows = result.results;
    }

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
}
