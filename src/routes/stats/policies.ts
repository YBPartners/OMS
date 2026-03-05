// ================================================================
// 와이비 OMS — 정책 조회 v5.0 (Scope Engine 적용)
// 배분·보고서·수수료 정책 + 지역권 매핑
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';

export function mountPolicies(router: Hono<Env>) {

  // ─── 배분 정책 ───
  router.get('/policies/distribution', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const result = await c.env.DB.prepare('SELECT * FROM distribution_policies ORDER BY version DESC').all();
    return c.json({ policies: result.results });
  });

  // ─── 보고서 정책 ───
  router.get('/policies/report', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const result = await c.env.DB.prepare('SELECT * FROM report_policies ORDER BY version DESC').all();
    return c.json({ policies: result.results });
  });

  // ─── 수수료 정책 (Scope Engine 기반) ───
  router.get('/policies/commission', async (c) => {
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

    // ★ Scope: REGION은 자기 총판 + 하위 TEAM 정책만
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      query += ' AND (cp.org_id = ? OR cp.org_id IN (SELECT org_id FROM organizations WHERE parent_org_id = ?))';
      params.push(user.org_id, user.org_id);
    }
    query += ' ORDER BY cp.org_id, cp.team_leader_id';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ policies: result.results });
  });

  // ─── 지역권 매핑 조회 (기존 territories + 신규 admin_regions 통합) ───
  router.get('/territories', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;

    // 기존 territory 매핑
    let query = `
      SELECT t.*, ot.org_id, o.name as org_name, o.org_type
      FROM territories t
      LEFT JOIN org_territories ot ON t.territory_id = ot.territory_id AND (ot.effective_to IS NULL OR ot.effective_to > datetime('now'))
      LEFT JOIN organizations o ON ot.org_id = o.org_id
      WHERE t.status = 'ACTIVE'
    `;
    const params: any[] = [];

    // ★ Scope
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      query += ' AND (ot.org_id = ? OR ot.org_id IN (SELECT org_id FROM organizations WHERE parent_org_id = ?))';
      params.push(user.org_id, user.org_id);
    }
    query += ' ORDER BY t.sido, t.sigungu, t.eupmyeondong';

    const result = await db.prepare(query).bind(...params).all();

    // 신규 admin_regions 매핑도 함께 반환
    let regionMappingQuery = `
      SELECT ar.region_id, ar.sido, ar.sigungu, ar.eupmyeondong, ar.full_name, ar.admin_code,
             orm.org_id, o.name as org_name, o.org_type
      FROM org_region_mappings orm
      JOIN admin_regions ar ON orm.region_id = ar.region_id
      JOIN organizations o ON orm.org_id = o.org_id
      WHERE 1=1
    `;
    const regionParams: any[] = [];

    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      regionMappingQuery += ' AND (orm.org_id = ? OR orm.org_id IN (SELECT org_id FROM organizations WHERE parent_org_id = ?))';
      regionParams.push(user.org_id, user.org_id);
    }
    regionMappingQuery += ' ORDER BY ar.sido, ar.sigungu, ar.eupmyeondong';

    const regionMappings = await db.prepare(regionMappingQuery).bind(...regionParams).all();

    return c.json({
      territories: result.results,
      admin_region_mappings: regionMappings.results,
    });
  });
}
