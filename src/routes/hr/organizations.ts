// ================================================================
// 와이비 OMS — HR 조직(총판) 관리 라우트 v6.0
// TEAM org_type, parent_org_id 지원
// try-catch 강화: 조직 CRUD 오류 방어
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

    try {
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
    } catch (err: any) {
      console.error('[organizations] 조직 목록 조회 실패:', err.message);
      return c.json({ error: '조직 목록을 불러오는 중 오류가 발생했습니다.', code: 'ORG_ERROR' }, 500);
    }
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

    try {
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
    } catch (err: any) {
      console.error('[organizations] 조직 등록 실패:', err.message);
      return c.json({ error: '조직 등록 중 오류가 발생했습니다.', code: 'ORG_ERROR' }, 500);
    }
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

    try {
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
    } catch (err: any) {
      console.error(`[organizations] 조직 수정 실패 org_id=${orgId}:`, err.message);
      return c.json({ error: '조직 수정 중 오류가 발생했습니다.', code: 'ORG_ERROR' }, 500);
    }
  });

  // 조직 비활성화/삭제 (멤버 없는 경우만)
  router.delete('/organizations/:org_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orgId = Number(c.req.param('org_id'));
    if (isNaN(orgId)) return c.json({ error: '유효하지 않은 조직 ID입니다.' }, 400);

    try {
      const existing = await db.prepare('SELECT * FROM organizations WHERE org_id = ?').bind(orgId).first() as any;
      if (!existing) return c.json({ error: '조직을 찾을 수 없습니다.' }, 404);

      // HQ는 삭제 불가
      if (existing.org_type === 'HQ') return c.json({ error: '본사(HQ) 조직은 삭제할 수 없습니다.' }, 400);

      // 활성 멤버 체크
      const memberCount = await db.prepare(
        "SELECT COUNT(*) as cnt FROM users WHERE org_id = ? AND status = 'ACTIVE'"
      ).bind(orgId).first() as any;
      if (memberCount?.cnt > 0) {
        return c.json({ error: `활성 멤버가 ${memberCount.cnt}명 있어 삭제할 수 없습니다. 먼저 멤버를 이동하세요.` }, 400);
      }

      // 하위 조직 체크 (REGION인 경우)
      if (existing.org_type === 'REGION') {
        const childCount = await db.prepare(
          "SELECT COUNT(*) as cnt FROM organizations WHERE parent_org_id = ? AND status = 'ACTIVE'"
        ).bind(orgId).first() as any;
        if (childCount?.cnt > 0) {
          return c.json({ error: `활성 하위 조직이 ${childCount.cnt}개 있어 삭제할 수 없습니다.` }, 400);
        }
      }

      // 소프트 삭제
      await db.prepare("UPDATE organizations SET status = 'INACTIVE', updated_at = datetime('now') WHERE org_id = ?").bind(orgId).run();

      await writeAuditLog(db, {
        entity_type: 'ORGANIZATION', entity_id: orgId, action: 'DELETE',
        actor_id: user.user_id, detail_json: JSON.stringify({ name: existing.name, org_type: existing.org_type }),
      });

      return c.json({ ok: true, message: `조직 "${existing.name}"이(가) 비활성화되었습니다.` });
    } catch (err: any) {
      console.error(`[organizations] 조직 삭제 실패 org_id=${orgId}:`, err.message);
      return c.json({ error: '조직 삭제 중 오류가 발생했습니다.', code: 'ORG_ERROR' }, 500);
    }
  });
}
