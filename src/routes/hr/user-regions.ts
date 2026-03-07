// ================================================================
// Airflow OMS — 사용자별 시군구 매핑 v2.0 (REFACTOR-1)
// user_region_mappings → team_sigungu_map 전환
// (admin-regions.ts의 team-mappings 엔드포인트와 동일 기능, 호환용 유지)
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';

export function mountUserRegions(router: Hono<Env>) {

  // ─── 사용자별 매핑된 시군구 목록 ───
  router.get('/users/:user_id/regions', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const userId = Number(c.req.param('user_id'));
    if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

    const db = c.env.DB;
    try {
      const mappings = await db.prepare(`
        SELECT tsm.map_id, tsm.user_id, tsm.sigungu_code, tsm.region_org_id,
               sg.sido, sg.sigungu, sg.full_name,
               o.name as region_name,
               u2.name as assigned_by_name
        FROM team_sigungu_map tsm
        JOIN sigungu sg ON tsm.sigungu_code = sg.code
        LEFT JOIN organizations o ON tsm.region_org_id = o.org_id
        LEFT JOIN users u2 ON tsm.assigned_by = u2.user_id
        WHERE tsm.user_id = ?
        ORDER BY sg.sido, sg.sigungu
      `).bind(userId).all();

      return c.json({ mappings: mappings.results });
    } catch (err: any) {
      console.error('[user-regions] 조회 실패:', err.message);
      return c.json({ error: '사용자 시군구 매핑 조회 중 오류가 발생했습니다.' }, 500);
    }
  });

  // ─── 사용자에 시군구 매핑 추가 ───
  router.post('/users/:user_id/regions', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const userId = Number(c.req.param('user_id'));
    const db = c.env.DB;
    const { sigungu_codes, region_org_id } = await c.req.json();

    if (!sigungu_codes?.length) return c.json({ error: '시군구 코드 목록이 필요합니다.' }, 400);

    // 총판 ID 결정
    const regionId = region_org_id || (user.org_type === 'REGION' ? user.org_id : null);
    if (!regionId) return c.json({ error: '총판 org_id가 필요합니다.' }, 400);

    try {
      let created = 0;
      for (const code of sigungu_codes) {
        const existing = await db.prepare(
          'SELECT map_id FROM team_sigungu_map WHERE user_id = ? AND sigungu_code = ?'
        ).bind(userId, code).first();
        if (existing) continue;

        await db.prepare(
          'INSERT INTO team_sigungu_map (user_id, sigungu_code, region_org_id, assigned_by) VALUES (?, ?, ?, ?)'
        ).bind(userId, code, regionId, user.user_id).run();
        created++;
      }

      await writeAuditLog(db, {
        entity_type: 'TEAM_SIGUNGU_MAP', action: 'BULK_CREATE', actor_id: user.user_id,
        detail_json: JSON.stringify({ user_id: userId, sigungu_codes, created }),
      });

      return c.json({ created, total_requested: sigungu_codes.length }, created > 0 ? 201 : 200);
    } catch (err: any) {
      console.error('[user-regions] 매핑 추가 실패:', err.message);
      return c.json({ error: '시군구 매핑 추가 중 오류가 발생했습니다.' }, 500);
    }
  });

  // ─── 매핑 삭제 ───
  router.delete('/users/:user_id/regions/:map_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const mapId = Number(c.req.param('map_id'));
    const db = c.env.DB;

    try {
      const existing = await db.prepare('SELECT * FROM team_sigungu_map WHERE map_id = ?').bind(mapId).first();
      if (!existing) return c.json({ error: '매핑을 찾을 수 없습니다.' }, 404);

      await db.prepare('DELETE FROM team_sigungu_map WHERE map_id = ?').bind(mapId).run();

      await writeAuditLog(db, {
        entity_type: 'TEAM_SIGUNGU_MAP', entity_id: mapId, action: 'DELETE', actor_id: user.user_id,
        detail_json: JSON.stringify({ user_id: existing.user_id, sigungu_code: existing.sigungu_code }),
      });

      return c.json({ ok: true });
    } catch (err: any) {
      console.error('[user-regions] 매핑 삭제 실패:', err.message);
      return c.json({ error: '매핑 삭제 중 오류가 발생했습니다.' }, 500);
    }
  });
}
