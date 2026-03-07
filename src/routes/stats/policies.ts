// ================================================================
// Airflow OMS — 정책 조회 + CRUD v8.0 (R13 고도화)
// 배분·보고서·수수료·지표 정책 + 지역권 매핑
// v8.0: 정책 복제, 버전 비교, 영향도 분석, 일괄 매핑,
//        수수료 시뮬레이션, 정책 변경 이력 API 추가
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

  // ★ 배분 정책 복제
  router.post('/policies/distribution/:id/clone', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));

    const source = await db.prepare('SELECT * FROM distribution_policies WHERE policy_id = ?').bind(id).first() as any;
    if (!source) return c.json({ error: '원본 정책을 찾을 수 없습니다.' }, 404);

    const latest = await db.prepare('SELECT MAX(version) as max_ver FROM distribution_policies').first();
    const newVersion = ((latest as any)?.max_ver || 0) + 1;

    const result = await db.prepare(`
      INSERT INTO distribution_policies (name, version, rule_json, effective_from, is_active)
      VALUES (?, ?, ?, ?, 0)
    `).bind(
      `${source.name} (복제)`, newVersion, source.rule_json,
      new Date().toISOString().split('T')[0]
    ).run();

    await writeAuditLog(db, { entity_type: 'DISTRIBUTION_POLICY', entity_id: result.meta.last_row_id as number, action: 'CLONE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ source_id: id, new_version: newVersion }) });
    return c.json({ ok: true, policy_id: result.meta.last_row_id, version: newVersion, source_id: id });
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

  // ★ 배분 정책 영향도 분석 (배분 대기 주문 수, 매핑된 지역 수 등)
  router.get('/policies/distribution/:id/impact', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));

    const policy = await db.prepare('SELECT * FROM distribution_policies WHERE policy_id = ?').bind(id).first() as any;
    if (!policy) return c.json({ error: '정책을 찾을 수 없습니다.' }, 404);

    const [pendingOrders, totalSigungu, mappedSigungu, unmappedSigungu, recentDistributed] = await Promise.all([
      db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status IN ('RECEIVED','DISTRIBUTION_PENDING')").first(),
      db.prepare("SELECT COUNT(*) as cnt FROM sigungu WHERE is_active=1").first(),
      db.prepare("SELECT COUNT(DISTINCT sg.code) as cnt FROM sigungu sg JOIN region_sigungu_map rsm ON sg.code=rsm.sigungu_code WHERE sg.is_active=1").first(),
      db.prepare("SELECT COUNT(*) as cnt FROM sigungu sg LEFT JOIN region_sigungu_map rsm ON sg.code=rsm.sigungu_code WHERE sg.is_active=1 AND rsm.region_org_id IS NULL").first(),
      db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status='DISTRIBUTED' AND updated_at > datetime('now','-7 days')").first(),
    ]);

    // 시도별 매핑 현황
    const sidoMapping = await db.prepare(`
      SELECT sg.sido, COUNT(*) as total,
        SUM(CASE WHEN rsm.region_org_id IS NOT NULL THEN 1 ELSE 0 END) as mapped
      FROM sigungu sg
      LEFT JOIN region_sigungu_map rsm ON sg.code=rsm.sigungu_code
      WHERE sg.is_active=1
      GROUP BY sg.sido ORDER BY sg.sido
    `).all();

    return c.json({
      policy,
      impact: {
        pending_orders: (pendingOrders as any)?.cnt || 0,
        total_sigungu: (totalSigungu as any)?.cnt || 0,
        mapped_sigungu: (mappedSigungu as any)?.cnt || 0,
        unmapped_sigungu: (unmappedSigungu as any)?.cnt || 0,
        recent_distributed_7d: (recentDistributed as any)?.cnt || 0,
        mapping_rate: (totalSigungu as any)?.cnt ? Math.round(((mappedSigungu as any)?.cnt / (totalSigungu as any)?.cnt) * 100) : 0,
        sido_mapping: sidoMapping.results,
      },
    });
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

  // ★ 보고서 정책 복제
  router.post('/policies/report/:id/clone', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));

    const source = await db.prepare('SELECT * FROM report_policies WHERE policy_id = ?').bind(id).first() as any;
    if (!source) return c.json({ error: '원본 정책을 찾을 수 없습니다.' }, 404);

    const latest = await db.prepare('SELECT MAX(version) as max_ver FROM report_policies').first();
    const newVersion = ((latest as any)?.max_ver || 0) + 1;

    const result = await db.prepare(`
      INSERT INTO report_policies (name, version, service_type, required_photos_json, required_checklist_json, require_receipt, effective_from, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      `${source.name} (복제)`, newVersion, source.service_type,
      source.required_photos_json, source.required_checklist_json,
      source.require_receipt, new Date().toISOString().split('T')[0]
    ).run();

    await writeAuditLog(db, { entity_type: 'REPORT_POLICY', entity_id: result.meta.last_row_id as number, action: 'CLONE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ source_id: id, new_version: newVersion }) });
    return c.json({ ok: true, policy_id: result.meta.last_row_id, version: newVersion, source_id: id });
  });

  // ★ 보고서 정책 영향도 분석
  router.get('/policies/report/:id/impact', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));

    const policy = await db.prepare('SELECT * FROM report_policies WHERE policy_id = ?').bind(id).first() as any;
    if (!policy) return c.json({ error: '정책을 찾을 수 없습니다.' }, 404);

    const [pendingReports, completedReports, rejectedReports] = await Promise.all([
      db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status IN ('SUBMITTED','IN_REVIEW')").first(),
      db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status IN ('HQ_APPROVED','SETTLEMENT_CONFIRMED','PAID') AND updated_at > datetime('now','-30 days')").first(),
      db.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status='REJECTED' AND updated_at > datetime('now','-30 days')").first(),
    ]);

    let photos: any = {};
    try { photos = JSON.parse(policy.required_photos_json || '{}'); } catch {}
    const totalPhotosRequired = Object.values(photos).reduce((a: number, b: any) => a + Number(b), 0);

    let checklist: any[] = [];
    try { checklist = JSON.parse(policy.required_checklist_json || '[]'); } catch {}

    return c.json({
      policy,
      impact: {
        pending_reports: (pendingReports as any)?.cnt || 0,
        completed_30d: (completedReports as any)?.cnt || 0,
        rejected_30d: (rejectedReports as any)?.cnt || 0,
        total_photos_required: totalPhotosRequired,
        photo_categories: Object.keys(photos).length,
        checklist_items: checklist.length,
        service_type: policy.service_type || 'DEFAULT',
      },
    });
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
    const { mode, value, is_active, channel_id, effective_from, effective_to, memo } = await c.req.json();

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

  // ★ 수수료 복제
  router.post('/policies/commission/:id/clone', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));

    const source = await db.prepare('SELECT * FROM commission_policies WHERE commission_policy_id = ?').bind(id).first() as any;
    if (!source) return c.json({ error: '원본 정책을 찾을 수 없습니다.' }, 404);

    const result = await db.prepare(`
      INSERT INTO commission_policies (org_id, team_leader_id, mode, value, channel_id, effective_from, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).bind(source.org_id, source.team_leader_id, source.mode, source.value, source.channel_id, new Date().toISOString().split('T')[0]).run();

    await writeAuditLog(db, { entity_type: 'COMMISSION_POLICY', entity_id: result.meta.last_row_id as number, action: 'CLONE', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ source_id: id }) });
    return c.json({ ok: true, commission_policy_id: result.meta.last_row_id, source_id: id });
  });

  // ★ 수수료 시뮬레이션 (다양한 금액 기준 시뮬)
  router.post('/policies/commission/simulate', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const { amounts, org_id } = await c.req.json();

    if (!amounts || !Array.isArray(amounts)) return c.json({ error: '시뮬레이션 금액 배열이 필요합니다.' }, 400);

    let query = `SELECT cp.*, o.name as org_name FROM commission_policies cp JOIN organizations o ON cp.org_id=o.org_id WHERE cp.is_active=1`;
    const params: any[] = [];
    if (org_id) { query += ' AND cp.org_id=?'; params.push(org_id); }
    query += ' ORDER BY cp.org_id';

    const policies = await db.prepare(query).bind(...params).all();

    const simResults = (policies.results as any[]).map((p: any) => {
      const sims = amounts.map((amt: number) => {
        let fee = 0;
        if (p.mode === 'PERCENT') fee = Math.round(amt * p.value / 100);
        else fee = Number(p.value);
        return { amount: amt, fee, net: amt - fee, rate: amt > 0 ? ((fee / amt) * 100).toFixed(1) + '%' : '0%' };
      });
      return { commission_policy_id: p.commission_policy_id, org_name: p.org_name, team_leader_id: p.team_leader_id, mode: p.mode, value: p.value, simulations: sims };
    });

    return c.json({ simulations: simResults });
  });

  // ★ 수수료 영향도 분석
  router.get('/policies/commission/:id/impact', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const id = Number(c.req.param('id'));

    const policy = await db.prepare(`
      SELECT cp.*, o.name as org_name, u.name as team_leader_name
      FROM commission_policies cp JOIN organizations o ON cp.org_id=o.org_id
      LEFT JOIN users u ON cp.team_leader_id=u.user_id
      WHERE cp.commission_policy_id=?
    `).bind(id).first() as any;
    if (!policy) return c.json({ error: '정책을 찾을 수 없습니다.' }, 404);

    // 해당 총판의 최근 30일 정산 데이터
    const recentSettlements = await db.prepare(`
      SELECT COUNT(*) as cnt, SUM(CASE WHEN o.base_amount IS NOT NULL THEN o.base_amount ELSE 0 END) as total_amount
      FROM orders o
      JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
      WHERE od.region_org_id=? AND o.status IN ('SETTLEMENT_CONFIRMED','PAID')
      AND o.updated_at > datetime('now','-30 days')
    `).bind(policy.org_id).first() as any;

    // 동일 총판의 다른 수수료 정책
    const siblingPolicies = await db.prepare(`
      SELECT cp.commission_policy_id, cp.mode, cp.value, cp.is_active, cp.team_leader_id, u.name as team_leader_name
      FROM commission_policies cp LEFT JOIN users u ON cp.team_leader_id=u.user_id
      WHERE cp.org_id=? AND cp.commission_policy_id!=?
      ORDER BY cp.is_active DESC, cp.commission_policy_id
    `).bind(policy.org_id, id).all();

    // 해당 총판 소속 팀장 수
    const teamLeaders = await db.prepare(`
      SELECT COUNT(DISTINCT u.user_id) as cnt
      FROM users u
      JOIN user_roles ur ON u.user_id = ur.user_id
      JOIN roles r ON ur.role_id = r.role_id
      WHERE u.org_id=? AND r.code='TEAM_LEADER' AND u.status='ACTIVE'
    `).bind(policy.org_id).first() as any;

    const totalAmt = (recentSettlements as any)?.total_amount || 0;
    let estimated_fee = 0;
    if (policy.mode === 'PERCENT') estimated_fee = Math.round(totalAmt * policy.value / 100);
    else estimated_fee = ((recentSettlements as any)?.cnt || 0) * Number(policy.value);

    return c.json({
      policy,
      impact: {
        recent_orders_30d: (recentSettlements as any)?.cnt || 0,
        recent_amount_30d: totalAmt,
        estimated_monthly_fee: estimated_fee,
        estimated_monthly_net: totalAmt - estimated_fee,
        team_leader_count: (teamLeaders as any)?.cnt || 0,
        sibling_policies: siblingPolicies.results,
      },
    });
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

  // ━━━━━━━━━━ 서비스 가격 정책 (service_prices CRUD) ━━━━━━━━━━

  // 가격 목록 조회 (카테고리 + 채널별)
  router.get('/policies/pricing', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;

    const [prices, categories, channels, options] = await Promise.all([
      db.prepare(`
        SELECT sp.*, sc.code as category_code, sc.name as category_name, sc.group_name,
               ch.name as channel_name
        FROM service_prices sp
        JOIN service_categories sc ON sp.category_id = sc.category_id
        JOIN order_channels ch ON sp.channel_id = ch.channel_id
        WHERE sp.is_active = 1 AND sc.is_active = 1
        ORDER BY sc.sort_order, ch.channel_id
      `).all(),
      db.prepare('SELECT * FROM service_categories WHERE is_active = 1 ORDER BY sort_order').all(),
      db.prepare("SELECT * FROM order_channels WHERE is_active = 1 ORDER BY channel_id").all(),
      db.prepare('SELECT * FROM service_options WHERE is_active = 1 ORDER BY option_id').all(),
    ]);

    return c.json({
      prices: prices.results,
      categories: categories.results,
      channels: channels.results,
      options: options.results,
    });
  });

  // 가격 수정 (단가 업데이트)
  router.put('/policies/pricing/:price_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const user = c.get('user')!;
    const priceId = Number(c.req.param('price_id'));
    const body = await c.req.json();
    const { sell_price, work_price } = body;

    if (sell_price === undefined && work_price === undefined) {
      return c.json({ error: '수정할 항목이 없습니다.' }, 400);
    }

    const existing = await db.prepare('SELECT * FROM service_prices WHERE price_id = ?').bind(priceId).first() as any;
    if (!existing) return c.json({ error: '가격을 찾을 수 없습니다.' }, 404);

    const sets: string[] = [];
    const params: any[] = [];
    if (sell_price !== undefined) { sets.push('sell_price = ?'); params.push(sell_price); }
    if (work_price !== undefined) { sets.push('work_price = ?'); params.push(work_price); }
    sets.push("updated_at = datetime('now')");
    params.push(priceId);

    await db.prepare(`UPDATE service_prices SET ${sets.join(', ')} WHERE price_id = ?`)
      .bind(...params).run();

    await writeAuditLog(db, {
      entity_type: 'SERVICE_PRICE', entity_id: priceId, action: 'UPDATE',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ before: { sell: existing.sell_price, work: existing.work_price }, after: { sell: sell_price ?? existing.sell_price, work: work_price ?? existing.work_price } }),
    });

    return c.json({ ok: true, price_id: priceId });
  });

  // 옵션 가격 수정
  router.put('/policies/pricing/option/:option_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const user = c.get('user')!;
    const optionId = Number(c.req.param('option_id'));
    const body = await c.req.json();

    const existing = await db.prepare('SELECT * FROM service_options WHERE option_id = ?').bind(optionId).first() as any;
    if (!existing) return c.json({ error: '옵션을 찾을 수 없습니다.' }, 404);

    const sets: string[] = [];
    const params: any[] = [];
    if (body.additional_sell_price !== undefined) { sets.push('additional_sell_price = ?'); params.push(body.additional_sell_price); }
    if (body.additional_work_price !== undefined) { sets.push('additional_work_price = ?'); params.push(body.additional_work_price); }
    if (body.name !== undefined) { sets.push('name = ?'); params.push(body.name); }
    if (sets.length === 0) return c.json({ error: '수정할 항목이 없습니다.' }, 400);
    sets.push("updated_at = datetime('now')");
    params.push(optionId);

    await db.prepare(`UPDATE service_options SET ${sets.join(', ')} WHERE option_id = ?`)
      .bind(...params).run();

    await writeAuditLog(db, { entity_type: 'SERVICE_OPTION', entity_id: optionId, action: 'UPDATE', actor_id: user.user_id, detail_json: JSON.stringify({ before: existing, after: body }) });
    return c.json({ ok: true });
  });

  // ━━━━━━━━━━ 정책 대시보드(요약) ━━━━━━━━━━

  router.get('/policies/summary', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;

    const [dist, report, comm, metrics, sigunguStats, regionMappings] = await Promise.all([
      db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM distribution_policies').first(),
      db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM report_policies').first(),
      db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM commission_policies').first(),
      db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM metrics_policies').first(),
      db.prepare("SELECT COUNT(*) as total, COUNT(DISTINCT sido) as sido_cnt FROM sigungu WHERE is_active=1").first(),
      db.prepare("SELECT COUNT(*) as total FROM region_sigungu_map").first(),
    ]);

    const ordersDist = await db.prepare("SELECT COUNT(*) as total FROM orders WHERE status IN ('RECEIVED','DISTRIBUTION_PENDING','DISTRIBUTED','ASSIGNED')").first();

    const recentAudit = await db.prepare(`
      SELECT al.*, u.name as actor_name FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.user_id
      WHERE al.entity_type IN ('DISTRIBUTION_POLICY','REPORT_POLICY','COMMISSION_POLICY','METRICS_POLICY','REGION_MAPPING','SIGUNGU_MAPPING')
      ORDER BY al.created_at DESC LIMIT 10
    `).all();

    return c.json({
      distribution: dist,
      report: report,
      commission: comm,
      metrics: metrics,
      sigungu: sigunguStats,
      region_mappings: regionMappings,
      active_orders: (ordersDist as any)?.total || 0,
      recent_audit: recentAudit.results,
    });
  });

  // ★ 정책 변경 이력 전체 조회 (타입별 필터)
  router.get('/policies/audit', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const entityType = c.req.query('type');
    const limit = Math.min(Number(c.req.query('limit') || 50), 200);

    let query = `
      SELECT al.*, u.name as actor_name FROM audit_logs al
      LEFT JOIN users u ON al.actor_id = u.user_id
      WHERE al.entity_type IN ('DISTRIBUTION_POLICY','REPORT_POLICY','COMMISSION_POLICY','METRICS_POLICY','REGION_MAPPING','SIGUNGU_MAPPING')
    `;
    const params: any[] = [];
    if (entityType) { query += ' AND al.entity_type = ?'; params.push(entityType); }
    query += ` ORDER BY al.created_at DESC LIMIT ?`;
    params.push(limit);

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ audit_logs: result.results, total: result.results.length });
  });

  // ━━━━━━━━━━ 시군구 검색 ━━━━━━━━━━

  router.get('/territories/search', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const q = c.req.query('q');
    const sido = c.req.query('sido');
    const sigungu = c.req.query('sigungu');
    const unmapped_only = c.req.query('unmapped_only');
    const db = c.env.DB;

    let query = `
      SELECT sg.code, sg.sido, sg.sigungu, sg.full_name, sg.is_active,
             rsm.region_org_id, o.name as org_name
      FROM sigungu sg
      LEFT JOIN region_sigungu_map rsm ON sg.code = rsm.sigungu_code
      LEFT JOIN organizations o ON rsm.region_org_id = o.org_id
      WHERE sg.is_active = 1
    `;
    const params: any[] = [];
    if (sido) { query += ' AND sg.sido = ?'; params.push(sido); }
    if (sigungu) { query += ' AND sg.sigungu = ?'; params.push(sigungu); }
    if (q && q.length >= 1) {
      query += ' AND (sg.sido LIKE ? OR sg.sigungu LIKE ? OR sg.full_name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (unmapped_only === '1') { query += ' AND rsm.region_org_id IS NULL'; }
    query += ' ORDER BY sg.sido, sg.sigungu LIMIT 200';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ territories: result.results, total: result.results.length });
  });

  // ★ 시군구 일괄 매핑 (여러 시군구를 한 org에 한꺼번에 매핑)
  router.post('/territories/bulk-mapping', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const { org_id, territory_ids, sigungu_codes } = await c.req.json();
    const codes = sigungu_codes || territory_ids; // 호환성

    if (!org_id) return c.json({ error: '총판 ID는 필수입니다.' }, 400);
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return c.json({ error: '시군구 코드 목록이 필요합니다.' }, 400);
    }
    if (codes.length > 100) return c.json({ error: '한 번에 최대 100건까지 매핑할 수 있습니다.' }, 400);

    let mapped = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const code of codes) {
      try {
        // 기존 매핑 해제
        await db.prepare(
          'DELETE FROM region_sigungu_map WHERE sigungu_code = ?'
        ).bind(String(code)).run();

        // 새 매핑 생성
        await db.prepare(
          'INSERT INTO region_sigungu_map (region_org_id, sigungu_code) VALUES (?, ?)'
        ).bind(org_id, String(code)).run();
        mapped++;
      } catch (e: any) {
        errors.push(`Code ${code}: ${e.message}`);
        skipped++;
      }
    }

    await writeAuditLog(db, { entity_type: 'SIGUNGU_MAPPING', action: 'BULK_MAPPING', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ org_id, count: mapped, skipped, total: codes.length }) });

    return c.json({ ok: true, mapped, skipped, total: codes.length, errors: errors.length ? errors : undefined });
  });

  // ★ 시군구 시도별 통계 (매핑 현황)
  router.get('/territories/sido-stats', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;
    const db = c.env.DB;

    const result = await db.prepare(`
      SELECT sg.sido,
        COUNT(*) as total,
        SUM(CASE WHEN rsm.region_org_id IS NOT NULL THEN 1 ELSE 0 END) as mapped,
        COUNT(DISTINCT rsm.region_org_id) as org_count
      FROM sigungu sg
      LEFT JOIN region_sigungu_map rsm ON sg.code=rsm.sigungu_code
      WHERE sg.is_active=1
      GROUP BY sg.sido ORDER BY sg.sido
    `).all();

    return c.json({ sido_stats: result.results });
  });

  // ★ 시군구 목록 (2단계 드릴다운)
  router.get('/territories/sigungu', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;
    const sido = c.req.query('sido');
    if (!sido) return c.json({ error: '시도를 선택해주세요.' }, 400);
    const db = c.env.DB;

    const result = await db.prepare(`
      SELECT sg.sigungu, sg.code,
        SUM(CASE WHEN rsm.region_org_id IS NOT NULL THEN 1 ELSE 0 END) as mapped
      FROM sigungu sg
      LEFT JOIN region_sigungu_map rsm ON sg.code=rsm.sigungu_code
      WHERE sg.is_active=1 AND sg.sido=?
      GROUP BY sg.sigungu, sg.code ORDER BY sg.sigungu
    `).bind(sido).all();

    return c.json({ sigungu_list: result.results });
  });

  // ━━━━━━━━━━ 시군구 매핑 ━━━━━━━━━━

  // 조회 (시군구 기반 통합)
  router.get('/territories', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;

    let query = `
      SELECT sg.code, sg.sido, sg.sigungu, sg.full_name, sg.is_active,
             rsm.region_org_id, o.name as org_name, o.org_type
      FROM sigungu sg
      LEFT JOIN region_sigungu_map rsm ON sg.code = rsm.sigungu_code
      LEFT JOIN organizations o ON rsm.region_org_id = o.org_id
      WHERE sg.is_active = 1
    `;
    const params: any[] = [];

    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      query += ' AND (rsm.region_org_id = ? OR rsm.region_org_id IN (SELECT org_id FROM organizations WHERE parent_org_id = ?))';
      params.push(user.org_id, user.org_id);
    }
    query += ' ORDER BY sg.sido, sg.sigungu';

    const result = await db.prepare(query).bind(...params).all();

    return c.json({
      territories: result.results,
    });
  });

  // 시군구 매핑 변경 (sigungu_code <-> org)
  router.put('/territories/:territory_id/mapping', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const sigunguCode = c.req.param('territory_id'); // 호환성: territory_id 파라미터로 sigungu code 수용
    const { org_id } = await c.req.json();

    if (!org_id) return c.json({ error: '총판 ID는 필수입니다.' }, 400);

    // 기존 매핑 삭제
    await db.prepare(
      'DELETE FROM region_sigungu_map WHERE sigungu_code = ?'
    ).bind(String(sigunguCode)).run();

    // 새 매핑 생성
    await db.prepare(
      'INSERT INTO region_sigungu_map (region_org_id, sigungu_code) VALUES (?, ?)'
    ).bind(org_id, String(sigunguCode)).run();

    await writeAuditLog(db, { entity_type: 'SIGUNGU_MAPPING', entity_id: 0, action: 'REGION.MAPPED', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ sigungu_code: sigunguCode, org_id }) });
    return c.json({ ok: true, sigungu_code: sigunguCode, org_id });
  });

  // ★ 매핑 해제 (시군구의 org 매핑 제거)
  router.delete('/territories/:territory_id/mapping', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;
    const db = c.env.DB;
    const sigunguCode = c.req.param('territory_id');

    await db.prepare(
      'DELETE FROM region_sigungu_map WHERE sigungu_code = ?'
    ).bind(String(sigunguCode)).run();

    await writeAuditLog(db, { entity_type: 'SIGUNGU_MAPPING', entity_id: 0, action: 'REGION.UNMAPPED', actor_id: c.get('user')!.user_id, detail_json: JSON.stringify({ sigungu_code: sigunguCode }) });
    return c.json({ ok: true, sigungu_code: sigunguCode });
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
