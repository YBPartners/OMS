// ================================================================
// 와이비 OMS — HR 조직(총판) 관리 라우트 v5.0
// TEAM org_type, parent_org_id 지원
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { getSimpleScope } from '../../lib/scope-engine';

export function mountOrganizations(router: Hono<Env>) {

  // 조직 목록 (스코프 기반: HQ는 전체, REGION은 자기+하위)
  router.get('/organizations', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const scope = getSimpleScope(user);

    let where = '';
    const params: any[] = [];

    if (!scope.isGlobal) {
      where = `WHERE ${scope.orgFilter}`;
      params.push(...scope.binds);
    }

    const result = await db.prepare(`
      SELECT o.*,
        p.name as parent_name,
        (SELECT COUNT(*) FROM users u WHERE u.org_id = o.org_id AND u.status = 'ACTIVE') as active_members,
        (SELECT COUNT(*) FROM users u WHERE u.org_id = o.org_id) as total_members,
        (SELECT COUNT(*) FROM users u 
         JOIN user_roles ur ON u.user_id = ur.user_id 
         JOIN roles r ON ur.role_id = r.role_id 
         WHERE u.org_id = o.org_id AND r.code = 'TEAM_LEADER' AND u.status = 'ACTIVE') as active_leaders,
        (SELECT COUNT(*) FROM organizations c WHERE c.parent_org_id = o.org_id AND c.org_type = 'TEAM') as child_team_count
      FROM organizations o
      LEFT JOIN organizations p ON o.parent_org_id = p.org_id
      ${where}
      ORDER BY 
        CASE o.org_type WHEN 'HQ' THEN 1 WHEN 'REGION' THEN 2 WHEN 'TEAM' THEN 3 END,
        o.parent_org_id NULLS FIRST, o.name
    `).bind(...params).all();

    return c.json({ organizations: result.results });
  });

  // 조직 등록 (TEAM 지원)
  router.post('/organizations', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();

    if (!body.name || !body.org_type) {
      return c.json({ error: '조직명과 유형은 필수입니다.' }, 400);
    }
    if (!['HQ', 'REGION', 'TEAM'].includes(body.org_type)) {
      return c.json({ error: '유형은 HQ, REGION, TEAM 중 하나여야 합니다.' }, 400);
    }
    if (body.name.length > 50) {
      return c.json({ error: '조직명은 50자 이하로 입력하세요.' }, 400);
    }

    // TEAM은 반드시 parent_org_id 필요
    if (body.org_type === 'TEAM') {
      if (!body.parent_org_id) {
        return c.json({ error: 'TEAM 유형은 상위 총판(parent_org_id)이 필수입니다.' }, 400);
      }
      const parent = await db.prepare(
        "SELECT org_id FROM organizations WHERE org_id = ? AND org_type = 'REGION'"
      ).bind(body.parent_org_id).first();
      if (!parent) {
        return c.json({ error: '유효하지 않은 상위 총판입니다.' }, 400);
      }
    }

    if (body.code) {
      if (!/^[A-Z0-9_]{2,30}$/.test(body.code)) {
        return c.json({ error: '조직 코드는 영문대문자, 숫자, 밑줄만 사용 가능합니다 (2~30자).' }, 400);
      }
      const dup = await db.prepare('SELECT org_id FROM organizations WHERE code = ?').bind(body.code).first();
      if (dup) return c.json({ error: '이미 사용 중인 조직 코드입니다.' }, 409);
    }

    const result = await db.prepare(`
      INSERT INTO organizations (org_type, name, code, parent_org_id, status) VALUES (?, ?, ?, ?, 'ACTIVE')
    `).bind(body.org_type, body.name, body.code || null, body.parent_org_id || null).run();

    await writeAuditLog(db, {
      entity_type: 'ORGANIZATION', entity_id: result.meta.last_row_id as number,
      action: 'CREATE', actor_id: user.user_id, detail_json: JSON.stringify(body),
    });

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

    // parent_org_id 변경 시 TEAM 유형만 가능
    if (body.parent_org_id !== undefined && existing.org_type !== 'TEAM') {
      return c.json({ error: '상위 조직 변경은 TEAM 유형에서만 가능합니다.' }, 400);
    }

    await db.prepare(`
      UPDATE organizations SET
        name = COALESCE(?, name),
        code = COALESCE(?, code),
        status = COALESCE(?, status),
        parent_org_id = COALESCE(?, parent_org_id),
        updated_at = datetime('now')
      WHERE org_id = ?
    `).bind(
      body.name || null, body.code || null, body.status || null,
      body.parent_org_id !== undefined ? body.parent_org_id : null,
      orgId
    ).run();

    await writeAuditLog(db, {
      entity_type: 'ORGANIZATION', entity_id: orgId, action: 'UPDATE',
      actor_id: user.user_id, detail_json: JSON.stringify(body),
    });

    return c.json({ ok: true });
  });
}
