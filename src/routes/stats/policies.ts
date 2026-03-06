// ================================================================
// 와이비 OMS — 정책 조회 + CRUD v7.0 (R4 완성)
// 배분·보고서·수수료·지표 정책 + 지역권 매핑
// v7.0: 삭제 API, 감사로그, 지표(metrics) 정책 CRUD 추가
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';

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
    await writeAuditLog(db, { entity_type: 'DISTRIBUTION_POLICY', entity_id: id, action: 'UPDATE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ name, rule_json, is_active }) });
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

    await writeAuditLog(db, { entity_type: 'DISTRIBUTION_POLICY', entity_id: result.meta.last_row_id as number, action: 'CREATE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ name, version: newVersion }) });
    return c.json({ ok: true, policy_id: result.meta.last_row_id, version: newVersion });
  });

  // 삭제 (비활성 정책만)
  router.delete('/policies/distribution/:id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const existing = await db.prepare('SELECT * FROM distribution_policies WHERE policy_id = ?').bind(id).first() as any;
    if (!existing) return c.json({ error: '정책을 찾을 수 없습니다.' }, 404);
    if (existing.is_active) return c.json({ error: '활성 정책은 삭제할 수 없습니다. 먼저 비활성화 하세요.' }, 400);
    await db.prepare('DELETE FROM distribution_policies WHERE policy_id = ?').bind(id).run();
    await writeAuditLog(db, { entity_type: 'DISTRIBUTION_POLICY', entity_id: id, action: 'DELETE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify(existing) });
    return c.json({ ok: true, message: '배분 정책이 삭제되었습니다.' });
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
    await writeAuditLog(db, { entity_type: 'REPORT_POLICY', entity_id: id, action: 'UPDATE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ name, service_type, is_active }) });
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

    await writeAuditLog(db, { entity_type: 'REPORT_POLICY', entity_id: result.meta.last_row_id as number, action: 'CREATE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ name, service_type: st, version: newVersion }) });
    return c.json({ ok: true, policy_id: result.meta.last_row_id, version: newVersion });
  });

  // 삭제 (비활성 정책만)
  router.delete('/policies/report/:id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const existing = await db.prepare('SELECT * FROM report_policies WHERE policy_id = ?').bind(id).first() as any;
    if (!existing) return c.json({ error: '정책을 찾을 수 없습니다.' }, 404);
    if (existing.is_active) return c.json({ error: '활성 정책은 삭제할 수 없습니다. 먼저 비활성화 하세요.' }, 400);
    await db.prepare('DELETE FROM report_policies WHERE policy_id = ?').bind(id).run();
    await writeAuditLog(db, { entity_type: 'REPORT_POLICY', entity_id: id, action: 'DELETE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify(existing) });
    return c.json({ ok: true, message: '보고서 정책이 삭제되었습니다.' });
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
    await writeAuditLog(db, { entity_type: 'COMMISSION_POLICY', entity_id: id, action: 'UPDATE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ mode, value, is_active, channel_id }) });
    return c.json({ ok: true, commission_policy_id: id });
  });

  // 수수료 신규 추가
  router.post('/policies/commission', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const { org_id, team_leader_id, mode, value, channel_id, effective_from } = await c.req.json();

    if (!org_id || !mode || value === undefined) return c.json({ error: '총판ID, 유형, 값은 필수입니다.' }, 400);
    if (!['FIXED', 'PERCENT'].includes(mode)) return c.json({ error: "유형은 FIXED 또는 PERCENT입니다." }, 400);

    const result = await db.prepare(`
      INSERT INTO commission_policies (org_id, team_leader_id, mode, value, channel_id, effective_from, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(org_id, team_leader_id || null, mode, value, channel_id || null, effective_from || new Date().toISOString().split('T')[0]).run();

    await writeAuditLog(db, { entity_type: 'COMMISSION_POLICY', entity_id: result.meta.last_row_id as number, action: 'CREATE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ org_id, team_leader_id, mode, value }) });
    return c.json({ ok: true, commission_policy_id: result.meta.last_row_id });
  });

  // 수수료 삭제 (비활성 정책만)
  router.delete('/policies/commission/:id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const existing = await db.prepare('SELECT * FROM commission_policies WHERE commission_policy_id = ?').bind(id).first() as any;
    if (!existing) return c.json({ error: '수수료 정책을 찾을 수 없습니다.' }, 404);
    if (existing.is_active) return c.json({ error: '활성 정책은 삭제할 수 없습니다. 먼저 비활성화 하세요.' }, 400);
    await db.prepare('DELETE FROM commission_policies WHERE commission_policy_id = ?').bind(id).run();
    await writeAuditLog(db, { entity_type: 'COMMISSION_POLICY', entity_id: id, action: 'DELETE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify(existing) });
    return c.json({ ok: true, message: '수수료 정책이 삭제되었습니다.' });
  });

  // ━━━━━━━━━━ 정책 대시보드(요약) ━━━━━━━━━━

  router.get('/policies/summary', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;

    const [dist, report, comm, metrics, terr, regions, mappings] = await Promise.all([
      db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM distribution_policies').first(),
      db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM report_policies').first(),
      db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM commission_policies').first(),
      db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM metrics_policies').first(),
      db.prepare("SELECT COUNT(*) as total, COUNT(DISTINCT sido) as sido_cnt FROM territories WHERE status='ACTIVE'").first(),
      db.prepare("SELECT COUNT(*) as total, COUNT(DISTINCT sido) as sido_cnt, COUNT(DISTINCT sigungu) as sigungu_cnt FROM admin_regions WHERE is_active=1").first(),
      db.prepare("SELECT COUNT(*) as total FROM org_region_mappings").first(),
    ]);

    // 배분 정책 적용 중 주문 수
    const ordersDist = await db.prepare("SELECT COUNT(*) as total FROM orders WHERE status IN ('NEW','DISTRIBUTION_PENDING','DISTRIBUTED','ASSIGNED')").first();

    // 최근 정책 변경 이력 (감사로그에서)
    const recentAudit = await db.prepare(`
      SELECT al.*, u.name as actor_name FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.user_id
      WHERE al.entity_type IN ('DISTRIBUTION_POLICY','REPORT_POLICY','COMMISSION_POLICY','METRICS_POLICY','TERRITORY','ORG_REGION_MAPPING')
      ORDER BY al.created_at DESC LIMIT 10
    `).all();

    return c.json({
      distribution: dist,
      report: report,
      commission: comm,
      metrics: metrics,
      territories: terr,
      admin_regions: regions,
      org_region_mappings: mappings,
      active_orders: (ordersDist as any)?.total || 0,
      recent_audit: recentAudit.results,
    });
  });

  // ━━━━━━━━━━ 지역권(territory) 검색 ━━━━━━━━━━

  router.get('/territories/search', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const q = c.req.query('q');
    const sido = c.req.query('sido');
    const db = c.env.DB;

    let query = `
      SELECT t.*, ot.org_id, o.name as org_name
      FROM territories t
      LEFT JOIN org_territories ot ON t.territory_id = ot.territory_id AND (ot.effective_to IS NULL OR ot.effective_to > datetime('now'))
      LEFT JOIN organizations o ON ot.org_id = o.org_id
      WHERE t.status = 'ACTIVE'
    `;
    const params: any[] = [];
    if (sido) { query += ' AND t.sido = ?'; params.push(sido); }
    if (q && q.length >= 1) {
      query += ' AND (t.sido LIKE ? OR t.sigungu LIKE ? OR t.eupmyeondong LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    query += ' ORDER BY t.sido, t.sigungu, t.eupmyeondong LIMIT 100';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ territories: result.results, total: result.results.length });
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

    if (!org_id) return c.json({ error: '총판 ID는 필수입니다.' }, 400);

    // 기존 매핑 종료
    await db.prepare(`
      UPDATE org_territories SET effective_to = datetime('now')
      WHERE territory_id = ? AND (effective_to IS NULL OR effective_to > datetime('now'))
    `).bind(territoryId).run();

    // 새 매핑 생성
    await db.prepare(`
      INSERT INTO org_territories (org_id, territory_id, effective_from) VALUES (?, ?, datetime('now'))
    `).bind(org_id, territoryId).run();

    await writeAuditLog(db, { entity_type: 'TERRITORY', entity_id: territoryId, action: 'REGION.MAPPED', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ territory_id: territoryId, org_id }) });
    return c.json({ ok: true, territory_id: territoryId, org_id });
  });

  // ━━━━━━━━━━ 지표(Metrics) 정책 ━━━━━━━━━━

  // 조회
  router.get('/policies/metrics', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const result = await c.env.DB.prepare('SELECT * FROM metrics_policies ORDER BY metrics_policy_id DESC').all();
    return c.json({ policies: result.results });
  });

  // 수정
  router.put('/policies/metrics/:id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청 형식입니다.' }, 400); }

    const existing = await db.prepare('SELECT * FROM metrics_policies WHERE metrics_policy_id = ?').bind(id).first();
    if (!existing) return c.json({ error: '지표 정책을 찾을 수 없습니다.' }, 404);

    const updates: string[] = [];
    const binds: any[] = [];
    if (body.completion_basis !== undefined) { updates.push('completion_basis = ?'); binds.push(body.completion_basis); }
    if (body.region_intake_basis !== undefined) { updates.push('region_intake_basis = ?'); binds.push(body.region_intake_basis); }
    if (body.is_active !== undefined) { updates.push('is_active = ?'); binds.push(body.is_active ? 1 : 0); }
    if (body.effective_from !== undefined) { updates.push('effective_from = ?'); binds.push(body.effective_from); }

    if (updates.length === 0) return c.json({ error: '변경할 항목이 없습니다.' }, 400);

    binds.push(id);
    await db.prepare(`UPDATE metrics_policies SET ${updates.join(', ')} WHERE metrics_policy_id = ?`).bind(...binds).run();
    await writeAuditLog(db, { entity_type: 'METRICS_POLICY', entity_id: id, action: 'UPDATE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify(body) });
    return c.json({ ok: true, metrics_policy_id: id });
  });

  // 생성
  router.post('/policies/metrics', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청 형식입니다.' }, 400); }

    const { completion_basis, region_intake_basis, effective_from } = body;
    if (!completion_basis || !region_intake_basis) {
      return c.json({ error: '완료 기준(completion_basis)과 지역접수 기준(region_intake_basis)은 필수입니다.' }, 400);
    }

    // 기존 활성 비활성화
    await db.prepare("UPDATE metrics_policies SET is_active = 0").run();

    const result = await db.prepare(`
      INSERT INTO metrics_policies (completion_basis, region_intake_basis, effective_from, is_active)
      VALUES (?, ?, ?, 1)
    `).bind(completion_basis, region_intake_basis, effective_from || new Date().toISOString().split('T')[0]).run();

    await writeAuditLog(db, { entity_type: 'METRICS_POLICY', entity_id: result.meta.last_row_id as number, action: 'CREATE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify(body) });
    return c.json({ ok: true, metrics_policy_id: result.meta.last_row_id });
  });

  // 삭제 (비활성만)
  router.delete('/policies/metrics/:id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));
    const existing = await db.prepare('SELECT * FROM metrics_policies WHERE metrics_policy_id = ?').bind(id).first() as any;
    if (!existing) return c.json({ error: '지표 정책을 찾을 수 없습니다.' }, 404);
    if (existing.is_active) return c.json({ error: '활성 정책은 삭제할 수 없습니다.' }, 400);
    await db.prepare('DELETE FROM metrics_policies WHERE metrics_policy_id = ?').bind(id).run();
    await writeAuditLog(db, { entity_type: 'METRICS_POLICY', entity_id: id, action: 'DELETE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify(existing) });
    return c.json({ ok: true, message: '지표 정책이 삭제되었습니다.' });
  });
}
