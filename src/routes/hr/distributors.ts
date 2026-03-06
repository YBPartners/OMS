// ================================================================
// Airflow OMS — 총판(Distributor) 관리 + 팀(TEAM) 관리 라우트
// 기존 organizations.ts를 확장하여 TEAM org_type, parent_org_id,
// team_distributor_mappings 지원
// ================================================================
import { Hono } from 'hono';
import type { Env, OrgType } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { getSimpleScope } from '../../lib/scope-engine';
import { normalizePagination } from '../../lib/validators';

export function mountDistributors(router: Hono<Env>) {

  // ═══════════════════════════════════════════════════════════════
  // 조직 트리 (전체 계층 구조) — ★ :org_id 와일드카드보다 먼저 등록해야 함
  // ═══════════════════════════════════════════════════════════════
  router.get('/distributors/tree', async (c) => orgTreeHandler(c));
  router.get('/org-tree', async (c) => orgTreeHandler(c));

  // ─── 총판(REGION) 목록 (하위 팀 수·인원수·관할구역 수 포함) ───
  router.get('/distributors', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;

    let where = "WHERE o.org_type = 'REGION'";
    const params: any[] = [];

    // REGION 관리자는 자기 총판만 조회
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      where += ' AND o.org_id = ?';
      params.push(user.org_id);
    }

    const result = await db.prepare(`
      SELECT o.*,
        (SELECT COUNT(*) FROM organizations c WHERE c.parent_org_id = o.org_id AND c.org_type = 'TEAM' AND c.status = 'ACTIVE') as team_count,
        (SELECT COUNT(*) FROM users u WHERE u.org_id = o.org_id AND u.status = 'ACTIVE') as direct_members,
        (SELECT COUNT(*) FROM users u2
         JOIN organizations c2 ON u2.org_id = c2.org_id
         WHERE c2.parent_org_id = o.org_id AND c2.org_type = 'TEAM' AND u2.status = 'ACTIVE') as team_members,
        (SELECT COUNT(*) FROM org_region_mappings orm WHERE orm.org_id = o.org_id) as region_mapping_count
      FROM organizations o
      ${where}
      ORDER BY o.name
    `).bind(...params).all();

    return c.json({ distributors: result.results });
  });

  // ─── 총판(REGION) 상세 (하위 팀 목록 + 관할구역 + 팀장 목록) ───
  router.get('/distributors/:org_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orgId = Number(c.req.param('org_id'));
    if (isNaN(orgId)) return c.json({ error: '유효하지 않은 조직 ID입니다.' }, 400);

    // 권한 체크
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') && user.org_id !== orgId) {
      return c.json({ error: '권한이 없습니다.' }, 403);
    }

    const org = await db.prepare(`
      SELECT * FROM organizations WHERE org_id = ? AND org_type = 'REGION'
    `).bind(orgId).first();
    if (!org) return c.json({ error: '총판을 찾을 수 없습니다.' }, 404);

    // 하위 TEAM 목록
    const teams = await db.prepare(`
      SELECT t.org_id, t.name, t.code, t.status, t.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.org_id = t.org_id AND u.status = 'ACTIVE') as member_count,
        (SELECT GROUP_CONCAT(u.name) FROM users u
         JOIN user_roles ur ON u.user_id = ur.user_id
         JOIN roles r ON ur.role_id = r.role_id
         WHERE u.org_id = t.org_id AND r.code = 'TEAM_LEADER' AND u.status = 'ACTIVE') as leaders
      FROM organizations t
      WHERE t.parent_org_id = ? AND t.org_type = 'TEAM'
      ORDER BY t.name
    `).bind(orgId).all();

    // 관할 행정구역 목록
    const regions = await db.prepare(`
      SELECT ar.region_id, ar.sido, ar.sigungu, ar.eupmyeondong, ar.full_name, ar.admin_code,
             orm.mapping_id, orm.created_at as mapped_at
      FROM org_region_mappings orm
      JOIN admin_regions ar ON orm.region_id = ar.region_id
      WHERE orm.org_id = ?
      ORDER BY ar.sido, ar.sigungu, ar.eupmyeondong
    `).bind(orgId).all();

    // 직속 인원 목록
    const members = await db.prepare(`
      SELECT u.user_id, u.name, u.login_id, u.phone, u.email, u.status, u.phone_verified,
             GROUP_CONCAT(r.code) as role_codes
      FROM users u
      LEFT JOIN user_roles ur ON u.user_id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.role_id
      WHERE u.org_id = ?
      GROUP BY u.user_id
      ORDER BY u.name
    `).bind(orgId).all();

    // 팀-총판 매핑 정보
    const teamMappings = await db.prepare(`
      SELECT tdm.mapping_id, tdm.team_org_id, tdm.distributor_org_id,
             t.name as team_name, d.name as distributor_name
      FROM team_distributor_mappings tdm
      JOIN organizations t ON tdm.team_org_id = t.org_id
      JOIN organizations d ON tdm.distributor_org_id = d.org_id
      WHERE tdm.distributor_org_id = ?
      ORDER BY t.name
    `).bind(orgId).all();

    return c.json({
      distributor: org,
      teams: teams.results,
      regions: regions.results,
      members: members.results.map((m: any) => ({
        ...m,
        roles: m.role_codes ? m.role_codes.split(',') : [],
      })),
      team_mappings: teamMappings.results,
    });
  });

  // ─── 총판 생성 ───
  router.post('/distributors', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();

    if (!body.name) return c.json({ error: '총판명은 필수입니다.' }, 400);
    if (body.name.length > 50) return c.json({ error: '총판명은 50자 이하로 입력하세요.' }, 400);

    if (body.code) {
      if (!/^[A-Z0-9_]{2,30}$/.test(body.code)) {
        return c.json({ error: '코드는 영문대문자, 숫자, 밑줄만 사용 가능합니다 (2~30자).' }, 400);
      }
      const dup = await db.prepare('SELECT org_id FROM organizations WHERE code = ?').bind(body.code).first();
      if (dup) return c.json({ error: '이미 사용 중인 코드입니다.' }, 409);
    }

    const result = await db.prepare(`
      INSERT INTO organizations (org_type, name, code, status) VALUES ('REGION', ?, ?, 'ACTIVE')
    `).bind(body.name, body.code || null).run();
    const newOrgId = result.meta.last_row_id as number;

    // 관할 행정구역 즉시 매핑 (옵션)
    if (body.region_ids && Array.isArray(body.region_ids)) {
      for (const regionId of body.region_ids) {
        try {
          await db.prepare('INSERT INTO org_region_mappings (org_id, region_id) VALUES (?, ?)').bind(newOrgId, regionId).run();
        } catch { /* 중복 무시 */ }
      }
    }

    await writeAuditLog(db, {
      entity_type: 'ORGANIZATION', entity_id: newOrgId, action: 'CREATE',
      actor_id: user.user_id, detail_json: JSON.stringify({ ...body, org_type: 'REGION' }),
    });

    return c.json({ org_id: newOrgId }, 201);
  });

  // ─── 총판 수정 ───
  router.put('/distributors/:org_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orgId = Number(c.req.param('org_id'));
    const body = await c.req.json();

    const existing = await db.prepare(
      "SELECT * FROM organizations WHERE org_id = ? AND org_type = 'REGION'"
    ).bind(orgId).first();
    if (!existing) return c.json({ error: '총판을 찾을 수 없습니다.' }, 404);

    if (body.code) {
      const dup = await db.prepare('SELECT org_id FROM organizations WHERE code = ? AND org_id != ?').bind(body.code, orgId).first();
      if (dup) return c.json({ error: '이미 사용 중인 코드입니다.' }, 409);
    }

    await db.prepare(`
      UPDATE organizations SET
        name = COALESCE(?, name),
        code = COALESCE(?, code),
        status = COALESCE(?, status),
        updated_at = datetime('now')
      WHERE org_id = ?
    `).bind(body.name || null, body.code || null, body.status || null, orgId).run();

    await writeAuditLog(db, {
      entity_type: 'ORGANIZATION', entity_id: orgId, action: 'UPDATE',
      actor_id: user.user_id, detail_json: JSON.stringify(body),
    });

    return c.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // 팀(TEAM) 관리
  // ═══════════════════════════════════════════════════════════════

  // ─── 팀 목록 (전체 또는 특정 총판 하위) ───
  router.get('/teams', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { distributor_org_id, status: filterStatus, search } = c.req.query();

    let query = `
      SELECT t.org_id, t.name, t.code, t.status, t.parent_org_id, t.created_at, t.updated_at,
        p.name as parent_name,
        (SELECT COUNT(*) FROM users u WHERE u.org_id = t.org_id AND u.status = 'ACTIVE') as member_count,
        (SELECT GROUP_CONCAT(u.name) FROM users u
         JOIN user_roles ur ON u.user_id = ur.user_id
         JOIN roles r ON ur.role_id = r.role_id
         WHERE u.org_id = t.org_id AND r.code = 'TEAM_LEADER' AND u.status = 'ACTIVE') as leaders
      FROM organizations t
      LEFT JOIN organizations p ON t.parent_org_id = p.org_id
      WHERE t.org_type = 'TEAM'
    `;
    const params: any[] = [];

    // REGION 관리자는 자기 하위 팀만
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      query += ' AND t.parent_org_id = ?';
      params.push(user.org_id);
    } else if (distributor_org_id) {
      query += ' AND t.parent_org_id = ?';
      params.push(Number(distributor_org_id));
    }

    if (filterStatus) { query += ' AND t.status = ?'; params.push(filterStatus); }
    if (search) { query += ' AND (t.name LIKE ? OR t.code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    query += ' ORDER BY t.parent_org_id, t.name';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ teams: result.results });
  });

  // ─── 팀 생성 (총판 하위에) ───
  router.post('/teams', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();

    if (!body.name) return c.json({ error: '팀명은 필수입니다.' }, 400);
    if (!body.parent_org_id) return c.json({ error: '소속 총판(parent_org_id)은 필수입니다.' }, 400);

    // 부모 조직이 REGION인지 확인
    const parentOrg = await db.prepare(
      "SELECT * FROM organizations WHERE org_id = ? AND org_type = 'REGION' AND status = 'ACTIVE'"
    ).bind(body.parent_org_id).first();
    if (!parentOrg) return c.json({ error: '유효하지 않은 총판입니다.' }, 404);

    // REGION_ADMIN은 자기 총판에만 팀 생성 가능
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') && user.org_id !== Number(body.parent_org_id)) {
      return c.json({ error: '자기 총판에만 팀을 생성할 수 있습니다.' }, 403);
    }

    if (body.code) {
      const dup = await db.prepare('SELECT org_id FROM organizations WHERE code = ?').bind(body.code).first();
      if (dup) return c.json({ error: '이미 사용 중인 코드입니다.' }, 409);
    }

    const code = body.code || `TEAM_${parentOrg.code || 'ORG'}_${Date.now().toString(36).slice(-4).toUpperCase()}`;

    const result = await db.prepare(`
      INSERT INTO organizations (org_type, name, code, parent_org_id, status)
      VALUES ('TEAM', ?, ?, ?, 'ACTIVE')
    `).bind(body.name, code, body.parent_org_id).run();
    const newTeamId = result.meta.last_row_id as number;

    // 팀-총판 매핑 자동 생성
    await db.prepare(
      'INSERT OR IGNORE INTO team_distributor_mappings (team_org_id, distributor_org_id) VALUES (?, ?)'
    ).bind(newTeamId, body.parent_org_id).run();

    await writeAuditLog(db, {
      entity_type: 'ORGANIZATION', entity_id: newTeamId, action: 'CREATE',
      actor_id: user.user_id, detail_json: JSON.stringify({ ...body, org_type: 'TEAM', code }),
    });

    return c.json({ org_id: newTeamId, code }, 201);
  });

  // ─── 팀 수정 ───
  router.put('/teams/:org_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orgId = Number(c.req.param('org_id'));
    const body = await c.req.json();

    const existing = await db.prepare(
      "SELECT * FROM organizations WHERE org_id = ? AND org_type = 'TEAM'"
    ).bind(orgId).first();
    if (!existing) return c.json({ error: '팀을 찾을 수 없습니다.' }, 404);

    // 권한 체크
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') && existing.parent_org_id !== user.org_id) {
      return c.json({ error: '자기 하위 팀만 수정할 수 있습니다.' }, 403);
    }

    await db.prepare(`
      UPDATE organizations SET
        name = COALESCE(?, name),
        status = COALESCE(?, status),
        updated_at = datetime('now')
      WHERE org_id = ?
    `).bind(body.name || null, body.status || null, orgId).run();

    await writeAuditLog(db, {
      entity_type: 'ORGANIZATION', entity_id: orgId, action: 'UPDATE',
      actor_id: user.user_id, detail_json: JSON.stringify(body),
    });

    return c.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // 팀-총판 매핑 관리 (다대다)
  // ═══════════════════════════════════════════════════════════════

  // ─── 팀-총판 매핑 목록 ───
  router.get('/team-distributor-mappings', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { team_org_id, distributor_org_id } = c.req.query();

    let query = `
      SELECT tdm.mapping_id, tdm.team_org_id, tdm.distributor_org_id, tdm.created_at,
             t.name as team_name, t.code as team_code,
             d.name as distributor_name, d.code as distributor_code
      FROM team_distributor_mappings tdm
      JOIN organizations t ON tdm.team_org_id = t.org_id
      JOIN organizations d ON tdm.distributor_org_id = d.org_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      query += ' AND tdm.distributor_org_id = ?';
      params.push(user.org_id);
    } else {
      if (team_org_id) { query += ' AND tdm.team_org_id = ?'; params.push(Number(team_org_id)); }
      if (distributor_org_id) { query += ' AND tdm.distributor_org_id = ?'; params.push(Number(distributor_org_id)); }
    }

    query += ' ORDER BY d.name, t.name';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ mappings: result.results });
  });

  // ─── 팀-총판 매핑 추가 ───
  router.post('/team-distributor-mappings', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { team_org_id, distributor_org_id } = await c.req.json();

    if (!team_org_id || !distributor_org_id) return c.json({ error: 'team_org_id와 distributor_org_id가 필요합니다.' }, 400);

    // 팀과 총판 검증
    const team = await db.prepare("SELECT org_id FROM organizations WHERE org_id = ? AND org_type = 'TEAM'").bind(team_org_id).first();
    if (!team) return c.json({ error: '유효하지 않은 팀입니다.' }, 404);

    const dist = await db.prepare("SELECT org_id FROM organizations WHERE org_id = ? AND org_type = 'REGION'").bind(distributor_org_id).first();
    if (!dist) return c.json({ error: '유효하지 않은 총판입니다.' }, 404);

    try {
      await db.prepare(
        'INSERT INTO team_distributor_mappings (team_org_id, distributor_org_id) VALUES (?, ?)'
      ).bind(team_org_id, distributor_org_id).run();
    } catch {
      return c.json({ error: '이미 존재하는 매핑입니다.' }, 409);
    }

    await writeAuditLog(db, {
      entity_type: 'TEAM_DISTRIBUTOR_MAPPING', action: 'CREATE',
      actor_id: user.user_id, detail_json: JSON.stringify({ team_org_id, distributor_org_id }),
    });

    return c.json({ ok: true }, 201);
  });

  // ─── 팀-총판 매핑 삭제 ───
  router.delete('/team-distributor-mappings/:mapping_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const mappingId = Number(c.req.param('mapping_id'));

    const existing = await db.prepare(
      'SELECT * FROM team_distributor_mappings WHERE mapping_id = ?'
    ).bind(mappingId).first();
    if (!existing) return c.json({ error: '매핑을 찾을 수 없습니다.' }, 404);

    await db.prepare('DELETE FROM team_distributor_mappings WHERE mapping_id = ?').bind(mappingId).run();

    await writeAuditLog(db, {
      entity_type: 'TEAM_DISTRIBUTOR_MAPPING', entity_id: mappingId, action: 'DELETE',
      actor_id: user.user_id, detail_json: JSON.stringify(existing),
    });

    return c.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // 조직 트리 핸들러 함수 (위에서 라우트 등록)
  // ═══════════════════════════════════════════════════════════════
  async function orgTreeHandler(c: any) {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;

    // HQ 조직
    const hqOrgs = await db.prepare(
      "SELECT org_id, name, code, org_type, status FROM organizations WHERE org_type = 'HQ' AND status = 'ACTIVE'"
    ).all();

    // REGION 조직
    let regionQuery = "SELECT org_id, name, code, org_type, status, parent_org_id FROM organizations WHERE org_type = 'REGION'";
    const regionParams: any[] = [];
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') && user.org_type !== 'HQ') {
      regionQuery += ' AND org_id = ?';
      regionParams.push(user.org_id);
    }
    regionQuery += ' AND status = ? ORDER BY name';
    regionParams.push('ACTIVE');
    const regionOrgs = await db.prepare(regionQuery).bind(...regionParams).all();

    // TEAM 조직
    let teamQuery = "SELECT org_id, name, code, org_type, status, parent_org_id FROM organizations WHERE org_type = 'TEAM'";
    const teamParams: any[] = [];
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      teamQuery += ' AND parent_org_id = ?';
      teamParams.push(user.org_id);
    }
    teamQuery += ' AND status = ? ORDER BY name';
    teamParams.push('ACTIVE');
    const teamOrgs = await db.prepare(teamQuery).bind(...teamParams).all();

    // ★ 팀장(사용자) 정보 조회 — 조직별 활성 멤버
    const membersQuery = `
      SELECT u.user_id, u.name, u.login_id, u.phone, u.org_id, u.status,
             GROUP_CONCAT(r.code) as role_codes
      FROM users u
      LEFT JOIN user_roles ur ON u.user_id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.role_id
      WHERE u.status = 'ACTIVE'
      GROUP BY u.user_id
      ORDER BY u.name
    `;
    const members = await db.prepare(membersQuery).all();
    const membersByOrg: Record<number, any[]> = {};
    (members.results as any[]).forEach(m => {
      if (!membersByOrg[m.org_id]) membersByOrg[m.org_id] = [];
      membersByOrg[m.org_id].push({
        user_id: m.user_id, name: m.name, login_id: m.login_id,
        phone: m.phone, roles: m.role_codes ? m.role_codes.split(',') : [], status: m.status,
      });
    });

    // 트리 구성 (멤버 포함)
    const tree = (hqOrgs.results as any[]).map(hq => ({
      ...hq,
      members: membersByOrg[hq.org_id] || [],
      member_count: (membersByOrg[hq.org_id] || []).length,
      children: (regionOrgs.results as any[]).map(region => ({
        ...region,
        members: membersByOrg[region.org_id] || [],
        member_count: (membersByOrg[region.org_id] || []).length,
        children: (teamOrgs.results as any[]).filter(team => team.parent_org_id === region.org_id).map(team => ({
          ...team,
          members: membersByOrg[team.org_id] || [],
          member_count: (membersByOrg[team.org_id] || []).length,
        })),
      })),
    }));

    return c.json({ tree, flat: {
      hq: hqOrgs.results,
      regions: regionOrgs.results,
      teams: teamOrgs.results,
    }});
  }
}
