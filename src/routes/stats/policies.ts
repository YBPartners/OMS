// ================================================================
// 와이비 OMS — 정책 조회 + CRUD v6.0 (Scope Engine 적용)
// 배분·보고서·수수료 정책 + 지역권 매핑
// v6.0: CRUD 엔드포인트 추가 (생성/수정/활성화 전환)
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';

export function mountPolicies(router: Hono<Env>) {

  // ━━━━━━━━━━ 배분 정책 ━━━━━━━━━━

  // 조회
  router.get('/policies/distribution', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const result = await c.env.DB.prepare('SELECT * FROM distribution_policies ORDER BY version DESC').all();
    return c.json({ policies: result.results });
  });

  // 수정
  router.put('/policies/distribution/:id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const { name, rule_json, is_active } = await c.req.json();

    const existing = await db.prepare('SELECT * FROM distribution_policies WHERE policy_id = ?').bind(id).first();
    if (!existing) return c.json({ error: '정책을 찾을 수 없습니다.' }, 404);

    const updates: string[] = [];
    const binds: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); binds.push(name); }
    if (rule_json !== undefined) { updates.push('rule_json = ?'); binds.push(typeof rule_json === 'string' ? rule_json : JSON.stringify(rule_json)); }
    if (is_active !== undefined) { updates.push('is_active = ?'); binds.push(is_active ? 1 : 0); }

    if (updates.length === 0) return c.json({ error: '변경할 항목이 없습니다.' }, 400);

    binds.push(id);
    await db.prepare(`UPDATE distribution_policies SET ${updates.join(', ')} WHERE policy_id = ?`).bind(...binds).run();
    return c.json({ ok: true, policy_id: id });
  });

  // 새 버전 생성
  router.post('/policies/distribution', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const { name, rule_json, effective_from } = await c.req.json();
    if (!name) return c.json({ error: '정책명은 필수입니다.' }, 400);

    // 최신 버전 조회
    const latest = await db.prepare('SELECT MAX(version) as max_ver FROM distribution_policies').first();
    const newVersion = ((latest as any)?.max_ver || 0) + 1;

    // 기존 활성 비활성화
    await db.prepare("UPDATE distribution_policies SET is_active = 0").run();

    const result = await db.prepare(`
      INSERT INTO distribution_policies (name, version, rule_json, effective_from, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).bind(name, newVersion, typeof rule_json === 'string' ? rule_json : JSON.stringify(rule_json || {}), effective_from || new Date().toISOString().split('T')[0]).run();

    return c.json({ ok: true, policy_id: result.meta.last_row_id, version: newVersion });
  });

  // ━━━━━━━━━━ 보고서 정책 ━━━━━━━━━━

  // 조회
  router.get('/policies/report', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const result = await c.env.DB.prepare('SELECT * FROM report_policies ORDER BY version DESC').all();
    return c.json({ policies: result.results });
  });

  // 수정
  router.put('/policies/report/:id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const { name, service_type, required_photos_json, required_checklist_json, require_receipt, is_active } = await c.req.json();

    const existing = await db.prepare('SELECT * FROM report_policies WHERE policy_id = ?').bind(id).first();
    if (!existing) return c.json({ error: '정책을 찾을 수 없습니다.' }, 404);

    const updates: string[] = [];
    const binds: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); binds.push(name); }
    if (service_type !== undefined) { updates.push('service_type = ?'); binds.push(service_type); }
    if (required_photos_json !== undefined) { updates.push('required_photos_json = ?'); binds.push(typeof required_photos_json === 'string' ? required_photos_json : JSON.stringify(required_photos_json)); }
    if (required_checklist_json !== undefined) { updates.push('required_checklist_json = ?'); binds.push(typeof required_checklist_json === 'string' ? required_checklist_json : JSON.stringify(required_checklist_json)); }
    if (require_receipt !== undefined) { updates.push('require_receipt = ?'); binds.push(require_receipt ? 1 : 0); }
    if (is_active !== undefined) { updates.push('is_active = ?'); binds.push(is_active ? 1 : 0); }

    if (updates.length === 0) return c.json({ error: '변경할 항목이 없습니다.' }, 400);

    binds.push(id);
    await db.prepare(`UPDATE report_policies SET ${updates.join(', ')} WHERE policy_id = ?`).bind(...binds).run();
    return c.json({ ok: true, policy_id: id });
  });

  // 새 버전 생성
  router.post('/policies/report', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const { name, service_type, required_photos_json, required_checklist_json, require_receipt, effective_from } = await c.req.json();
    if (!name) return c.json({ error: '정책명은 필수입니다.' }, 400);

    const latest = await db.prepare('SELECT MAX(version) as max_ver FROM report_policies').first();
    const newVersion = ((latest as any)?.max_ver || 0) + 1;

    // 같은 service_type의 기존 활성 비활성화
    const st = service_type || 'DEFAULT';
    await db.prepare("UPDATE report_policies SET is_active = 0 WHERE service_type = ?").bind(st).run();

    const result = await db.prepare(`
      INSERT INTO report_policies (name, version, service_type, required_photos_json, required_checklist_json, require_receipt, effective_from, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      name, newVersion, st,
      typeof required_photos_json === 'string' ? required_photos_json : JSON.stringify(required_photos_json || { BEFORE: 1, AFTER: 1, WASH: 1, RECEIPT: 1 }),
      typeof required_checklist_json === 'string' ? required_checklist_json : JSON.stringify(required_checklist_json || []),
      require_receipt !== undefined ? (require_receipt ? 1 : 0) : 1,
      effective_from || new Date().toISOString().split('T')[0]
    ).run();

    return c.json({ ok: true, policy_id: result.meta.last_row_id, version: newVersion });
  });

  // ━━━━━━━━━━ 수수료 정책 ━━━━━━━━━━

  // 조회 (Scope Engine 기반)
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

  // 수수료 수정
  router.put('/policies/commission/:id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const { mode, value, is_active, channel_id } = await c.req.json();

    const existing = await db.prepare('SELECT * FROM commission_policies WHERE commission_policy_id = ?').bind(id).first();
    if (!existing) return c.json({ error: '수수료 정책을 찾을 수 없습니다.' }, 404);

    const updates: string[] = ["updated_at = datetime('now')"];
    const binds: any[] = [];
    if (mode !== undefined) { updates.push('mode = ?'); binds.push(mode); }
    if (value !== undefined) { updates.push('value = ?'); binds.push(value); }
    if (is_active !== undefined) { updates.push('is_active = ?'); binds.push(is_active ? 1 : 0); }
    if (channel_id !== undefined) { updates.push('channel_id = ?'); binds.push(channel_id); }

    binds.push(id);
    await db.prepare(`UPDATE commission_policies SET ${updates.join(', ')} WHERE commission_policy_id = ?`).bind(...binds).run();
    return c.json({ ok: true, commission_policy_id: id });
  });

  // 수수료 신규 추가
  router.post('/policies/commission', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const { org_id, team_leader_id, mode, value, channel_id, effective_from } = await c.req.json();

    if (!org_id || !mode || value === undefined) return c.json({ error: '법인ID, 유형, 값은 필수입니다.' }, 400);
    if (!['FIXED', 'PERCENT'].includes(mode)) return c.json({ error: "유형은 FIXED 또는 PERCENT입니다." }, 400);

    const result = await db.prepare(`
      INSERT INTO commission_policies (org_id, team_leader_id, mode, value, channel_id, effective_from, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(org_id, team_leader_id || null, mode, value, channel_id || null, effective_from || new Date().toISOString().split('T')[0]).run();

    return c.json({ ok: true, commission_policy_id: result.meta.last_row_id });
  });

  // ━━━━━━━━━━ 지역권 매핑 ━━━━━━━━━━

  // 조회 (기존 territories + 신규 admin_regions 통합)
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

  // 지역권 매핑 변경 (territory ↔ org)
  router.put('/territories/:territory_id/mapping', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const territoryId = Number(c.req.param('territory_id'));
    const { org_id } = await c.req.json();

    if (!org_id) return c.json({ error: '법인 ID는 필수입니다.' }, 400);

    // 기존 매핑 종료
    await db.prepare(`
      UPDATE org_territories SET effective_to = datetime('now')
      WHERE territory_id = ? AND (effective_to IS NULL OR effective_to > datetime('now'))
    `).bind(territoryId).run();

    // 새 매핑 생성
    await db.prepare(`
      INSERT INTO org_territories (org_id, territory_id, effective_from) VALUES (?, ?, datetime('now'))
    `).bind(org_id, territoryId).run();

    return c.json({ ok: true, territory_id: territoryId, org_id });
  });
}
