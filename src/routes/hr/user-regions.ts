// ================================================================
// Airflow OMS — 사용자별 지역 매핑 (주문 수취 권한)
// user_region_mappings CRUD
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';

export function mountUserRegions(router: Hono<Env>) {

  // ─── 사용자별 매핑된 지역 목록 ───
  router.get('/users/:user_id/regions', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const userId = Number(c.req.param('user_id'));
    if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

    const db = c.env.DB;
    try {
      const mappings = await db.prepare(`
        SELECT urm.mapping_id, urm.user_id, urm.admin_region_id, urm.assigned_at,
               ar.sido, ar.sigungu, ar.eupmyeondong, ar.admin_dong_code,
               u2.name as assigned_by_name
        FROM user_region_mappings urm
        JOIN admin_regions ar ON urm.admin_region_id = ar.region_id
        LEFT JOIN users u2 ON urm.assigned_by = u2.user_id
        WHERE urm.user_id = ?
        ORDER BY ar.sido, ar.sigungu, ar.eupmyeondong
      `).bind(userId).all();

      const user = await db.prepare(`
        SELECT u.user_id, u.name, u.login_id, u.org_id, o.name as org_name, o.org_type
        FROM users u JOIN organizations o ON u.org_id = o.org_id WHERE u.user_id = ?
      `).bind(userId).first();

      return c.json({ user, mappings: mappings.results, total: mappings.results.length });
    } catch (err: any) {
      console.error(`[user-regions] 목록 조회 실패 user_id=${userId}:`, err.message);
      return c.json({ error: '지역 매핑 조회 중 오류가 발생했습니다.' }, 500);
    }
  });

  // ─── 사용자에게 지역 매핑 추가 (단일 또는 다건) ───
  router.post('/users/:user_id/regions', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const actor = c.get('user')!;
    const userId = Number(c.req.param('user_id'));
    if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

    const db = c.env.DB;
    const body = await c.req.json();
    const regionIds: number[] = Array.isArray(body.region_ids) ? body.region_ids : body.admin_region_id ? [body.admin_region_id] : [];

    if (regionIds.length === 0) {
      return c.json({ error: '매핑할 지역(region_ids)이 필요합니다.' }, 400);
    }

    try {
      let added = 0, duplicates = 0;
      for (const rid of regionIds) {
        try {
          await db.prepare(`
            INSERT INTO user_region_mappings (user_id, admin_region_id, assigned_by) VALUES (?, ?, ?)
          `).bind(userId, rid, actor.user_id).run();
          added++;
        } catch (e: any) {
          if (e.message?.includes('UNIQUE')) duplicates++;
          else throw e;
        }
      }

      await writeAuditLog(db, {
        entity_type: 'USER_REGION_MAPPING', entity_id: userId,
        action: 'ADD_REGIONS', actor_id: actor.user_id,
        detail_json: JSON.stringify({ region_ids: regionIds, added, duplicates }),
      });

      return c.json({ ok: true, added, duplicates, message: `${added}개 지역 매핑 완료${duplicates > 0 ? ` (중복 ${duplicates}건 무시)` : ''}` });
    } catch (err: any) {
      console.error(`[user-regions] 매핑 추가 실패 user_id=${userId}:`, err.message);
      return c.json({ error: '지역 매핑 추가 중 오류가 발생했습니다.' }, 500);
    }
  });

  // ─── 사용자 지역 매핑 삭제 (단일) ───
  router.delete('/users/:user_id/regions/:mapping_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const actor = c.get('user')!;
    const userId = Number(c.req.param('user_id'));
    const mappingId = Number(c.req.param('mapping_id'));
    const db = c.env.DB;

    try {
      const result = await db.prepare(
        'DELETE FROM user_region_mappings WHERE mapping_id = ? AND user_id = ?'
      ).bind(mappingId, userId).run();

      if (result.meta.changes === 0) {
        return c.json({ error: '매핑을 찾을 수 없습니다.' }, 404);
      }

      await writeAuditLog(db, {
        entity_type: 'USER_REGION_MAPPING', entity_id: userId,
        action: 'REMOVE_REGION', actor_id: actor.user_id,
        detail_json: JSON.stringify({ mapping_id: mappingId }),
      });

      return c.json({ ok: true, message: '지역 매핑이 삭제되었습니다.' });
    } catch (err: any) {
      console.error(`[user-regions] 매핑 삭제 실패:`, err.message);
      return c.json({ error: '매핑 삭제 중 오류가 발생했습니다.' }, 500);
    }
  });

  // ─── 사용자 지역 매핑 전체 교체 (벌크) ───
  router.put('/users/:user_id/regions', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const actor = c.get('user')!;
    const userId = Number(c.req.param('user_id'));
    const db = c.env.DB;
    const body = await c.req.json();
    const regionIds: number[] = body.region_ids || [];

    try {
      // 기존 매핑 전체 삭제 후 재삽입
      await db.prepare('DELETE FROM user_region_mappings WHERE user_id = ?').bind(userId).run();

      let added = 0;
      for (const rid of regionIds) {
        await db.prepare(`
          INSERT INTO user_region_mappings (user_id, admin_region_id, assigned_by) VALUES (?, ?, ?)
        `).bind(userId, rid, actor.user_id).run();
        added++;
      }

      await writeAuditLog(db, {
        entity_type: 'USER_REGION_MAPPING', entity_id: userId,
        action: 'REPLACE_REGIONS', actor_id: actor.user_id,
        detail_json: JSON.stringify({ total: added }),
      });

      return c.json({ ok: true, total: added, message: `${added}개 지역으로 교체 완료` });
    } catch (err: any) {
      console.error(`[user-regions] 벌크 교체 실패:`, err.message);
      return c.json({ error: '지역 매핑 교체 중 오류가 발생했습니다.' }, 500);
    }
  });

  // ─── 전체 사용자-지역 매핑 현황 ───
  router.get('/user-region-mappings', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const db = c.env.DB;
    const user = c.get('user')!;

    try {
      let query = `
        SELECT u.user_id, u.name, u.login_id, o.name as org_name, o.org_type,
               COUNT(urm.mapping_id) as mapped_count
        FROM users u
        JOIN organizations o ON u.org_id = o.org_id
        LEFT JOIN user_region_mappings urm ON u.user_id = urm.user_id
        WHERE u.status = 'ACTIVE'
      `;
      const params: any[] = [];

      if (user.org_type === 'REGION') {
        query += ` AND (u.org_id = ? OR u.org_id IN (SELECT org_id FROM organizations WHERE parent_org_id = ?))`;
        params.push(user.org_id, user.org_id);
      }

      query += ' GROUP BY u.user_id ORDER BY mapped_count DESC, u.name';

      const result = await db.prepare(query).bind(...params).all();
      return c.json({ users: result.results });
    } catch (err: any) {
      console.error('[user-region-mappings] 현황 조회 실패:', err.message);
      return c.json({ error: '현황 조회 중 오류가 발생했습니다.' }, 500);
    }
  });
}
