// ================================================================
// 다하다 OMS — HR 조직(법인) 관리 라우트
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { safeParseJson, validateRequired } from '../../lib/validators';

export function mountOrganizations(router: Hono<Env>) {

  // 조직 목록 (상세: 소속 인원수 포함)
  router.get('/organizations', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const db = c.env.DB;
    const result = await db.prepare(`
      SELECT o.*,
        (SELECT COUNT(*) FROM users u WHERE u.org_id = o.org_id AND u.status = 'ACTIVE') as active_members,
        (SELECT COUNT(*) FROM users u WHERE u.org_id = o.org_id) as total_members,
        (SELECT COUNT(*) FROM users u 
         JOIN user_roles ur ON u.user_id = ur.user_id 
         JOIN roles r ON ur.role_id = r.role_id 
         WHERE u.org_id = o.org_id AND r.code = 'TEAM_LEADER' AND u.status = 'ACTIVE') as active_leaders
      FROM organizations o
      ORDER BY o.org_type DESC, o.name
    `).all();

    return c.json({ organizations: result.results });
  });

  // 조직 등록
  router.post('/organizations', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();

    if (!body.name || !body.org_type) {
      return c.json({ error: '조직명과 유형은 필수입니다.' }, 400);
    }
    if (!['HQ', 'REGION'].includes(body.org_type)) {
      return c.json({ error: '유형은 HQ 또는 REGION이어야 합니다.' }, 400);
    }
    if (body.name.length > 50) {
      return c.json({ error: '조직명은 50자 이하로 입력하세요.' }, 400);
    }

    if (body.code) {
      if (!/^[A-Z0-9_]{2,30}$/.test(body.code)) {
        return c.json({ error: '조직 코드는 영문대문자, 숫자, 밑줄만 사용 가능합니다 (2~30자).' }, 400);
      }
      const dup = await db.prepare('SELECT org_id FROM organizations WHERE code = ?').bind(body.code).first();
      if (dup) return c.json({ error: '이미 사용 중인 조직 코드입니다.' }, 409);
    }

    const result = await db.prepare(`
      INSERT INTO organizations (org_type, name, code, status) VALUES (?, ?, ?, 'ACTIVE')
    `).bind(body.org_type, body.name, body.code || null).run();

    await writeAuditLog(db, { entity_type: 'ORGANIZATION', entity_id: result.meta.last_row_id as number, action: 'CREATE', actor_id: user.user_id, detail_json: JSON.stringify(body) });

    return c.json({ org_id: result.meta.last_row_id }, 201);
  });

  // 조직 수정
  router.put('/organizations/:org_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orgId = Number(c.req.param('org_id'));
    if (isNaN(orgId)) return c.json({ error: '유효하지 않은 조직 ID입니다.' }, 400);

    const body = await c.req.json();

    const existing = await db.prepare('SELECT * FROM organizations WHERE org_id = ?').bind(orgId).first();
    if (!existing) return c.json({ error: '조직을 찾을 수 없습니다.' }, 404);

    await db.prepare(`
      UPDATE organizations SET name = COALESCE(?, name), code = COALESCE(?, code), 
      status = COALESCE(?, status), updated_at = datetime('now') WHERE org_id = ?
    `).bind(body.name || null, body.code || null, body.status || null, orgId).run();

    await writeAuditLog(db, { entity_type: 'ORGANIZATION', entity_id: orgId, action: 'UPDATE', actor_id: user.user_id, detail_json: JSON.stringify(body) });

    return c.json({ ok: true });
  });
}
