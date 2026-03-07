// ================================================================
// Airflow OMS — 시군구 기반 지역 관리 API v3.0 (REFACTOR-1)
// admin_regions → sigungu, org_region_mappings → region_sigungu_map
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { normalizePagination } from '../../lib/validators';

export function mountAdminRegions(router: Hono<Env>) {

  // ─── 시도 목록 (1단계) ───
  router.get('/regions/sido', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const db = c.env.DB;
    const result = await db.prepare(`
      SELECT DISTINCT sido, COUNT(*) as district_count
      FROM sigungu WHERE is_active = 1
      GROUP BY sido ORDER BY sido
    `).all();

    return c.json({ sido_list: result.results });
  });

  // ─── 시군구 목록 (2단계: sido 선택 후) ───
  router.get('/regions/sigungu', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const sido = c.req.query('sido');
    if (!sido) return c.json({ error: '시도(sido)를 선택해주세요.' }, 400);

    const db = c.env.DB;
    const result = await db.prepare(`
      SELECT code, sido, sigungu, full_name
      FROM sigungu WHERE sido = ? AND is_active = 1
      ORDER BY sigungu
    `).bind(sido).all();

    return c.json({ sigungu_list: result.results });
  });

  // ─── 시군구 통합 검색 (자동완성용) ───
  router.get('/regions/search', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const q = c.req.query('q');
    if (!q || q.length < 1) return c.json({ error: '검색어를 입력하세요.' }, 400);

    const db = c.env.DB;
    const result = await db.prepare(`
      SELECT code, sido, sigungu, full_name
      FROM sigungu
      WHERE is_active = 1 AND (
        full_name LIKE ? OR sido LIKE ? OR sigungu LIKE ?
      )
      ORDER BY full_name
      LIMIT 50
    `).bind(`%${q}%`, `%${q}%`, `%${q}%`).all();

    return c.json({ regions: result.results, total: result.results.length });
  });

  // ─── 시군구 전체 목록 (페이지네이션) ───
  router.get('/regions', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const { sido, page, limit } = c.req.query();
    const pg = normalizePagination(page, limit);
    const db = c.env.DB;

    const conditions: string[] = ['is_active = 1'];
    const params: any[] = [];

    if (sido) { conditions.push('sido = ?'); params.push(sido); }

    const where = conditions.join(' AND ');

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM sigungu WHERE ${where}`
    ).bind(...params).first();

    const result = await db.prepare(`
      SELECT code, sido, sigungu, full_name
      FROM sigungu WHERE ${where}
      ORDER BY sido, sigungu
      LIMIT ? OFFSET ?
    `).bind(...params, pg.limit, pg.offset).all();

    return c.json({
      regions: result.results,
      total: (countResult as any)?.total || 0,
      page: pg.page,
      limit: pg.limit,
    });
  });

  // ─── 총판-시군구 매핑 조회 ───
  router.get('/regions/mappings', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { org_id } = c.req.query();

    let query = `
      SELECT rsm.map_id, rsm.region_org_id, rsm.sigungu_code,
             o.name as org_name, o.org_type, o.code as org_code,
             sg.sido, sg.sigungu, sg.full_name
      FROM region_sigungu_map rsm
      JOIN organizations o ON rsm.region_org_id = o.org_id
      JOIN sigungu sg ON rsm.sigungu_code = sg.code
      WHERE (rsm.effective_to IS NULL OR rsm.effective_to > datetime('now'))
    `;
    const params: any[] = [];

    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      query += ` AND rsm.region_org_id = ?`;
      params.push(user.org_id);
    } else if (org_id) {
      query += ' AND rsm.region_org_id = ?';
      params.push(Number(org_id));
    }

    query += ' ORDER BY o.name, sg.full_name';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ mappings: result.results });
  });

  // ─── 총판-시군구 매핑 추가 (다건) ───
  router.post('/regions/mappings', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();

    const { org_id, sigungu_codes } = body;
    if (!org_id) return c.json({ error: '총판 조직 ID는 필수입니다.' }, 400);
    if (!sigungu_codes || !Array.isArray(sigungu_codes) || sigungu_codes.length === 0) {
      return c.json({ error: '시군구 코드 목록이 필요합니다.' }, 400);
    }

    try {
      let created = 0;
      const conflicts: any[] = [];

      for (const code of sigungu_codes) {
        // 이미 다른 총판에 매핑되었는지 확인
        const existing = await db.prepare(`
          SELECT rsm.region_org_id, o.name as org_name
          FROM region_sigungu_map rsm
          JOIN organizations o ON rsm.region_org_id = o.org_id
          WHERE rsm.sigungu_code = ? AND rsm.region_org_id != ?
            AND (rsm.effective_to IS NULL OR rsm.effective_to > datetime('now'))
        `).bind(code, org_id).first();

        if (existing) {
          const sgInfo = await db.prepare('SELECT full_name FROM sigungu WHERE code = ?').bind(code).first();
          conflicts.push({
            sigungu_code: code, sigungu_name: sgInfo?.full_name,
            existing_org_id: existing.region_org_id, existing_org_name: existing.org_name,
          });
          continue;
        }

        // 같은 총판에 이미 매핑된 경우 스킵
        const selfExisting = await db.prepare(
          "SELECT map_id FROM region_sigungu_map WHERE region_org_id = ? AND sigungu_code = ? AND (effective_to IS NULL OR effective_to > datetime('now'))"
        ).bind(org_id, code).first();
        if (selfExisting) continue;

        await db.prepare(
          'INSERT INTO region_sigungu_map (region_org_id, sigungu_code) VALUES (?, ?)'
        ).bind(org_id, code).run();
        created++;
      }

      await writeAuditLog(db, {
        entity_type: 'REGION_SIGUNGU_MAP', action: 'BULK_CREATE', actor_id: user.user_id,
        detail_json: JSON.stringify({ org_id, sigungu_codes, created, conflicts: conflicts.length }),
      });

      const result: any = { created, total_requested: sigungu_codes.length };
      if (conflicts.length > 0) {
        result.conflicts = conflicts;
        result.warning = `${conflicts.length}건의 충돌(이미 다른 총판에 매핑됨)이 발견되었습니다.`;
      }

      return c.json(result, created > 0 ? 201 : 200);
    } catch (err: any) {
      console.error('[admin-regions] 시군구 매핑 추가 실패:', err.message);
      return c.json({ error: '시군구 매핑 중 오류가 발생했습니다.', code: 'REGION_ERROR' }, 500);
    }
  });

  // ─── 총판-시군구 매핑 삭제 ───
  router.delete('/regions/mappings/:map_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const mapId = Number(c.req.param('map_id'));

    try {
      const existing = await db.prepare(
        'SELECT * FROM region_sigungu_map WHERE map_id = ?'
      ).bind(mapId).first();
      if (!existing) return c.json({ error: '매핑을 찾을 수 없습니다.' }, 404);

      // soft-delete: effective_to 설정
      await db.prepare(
        "UPDATE region_sigungu_map SET effective_to = datetime('now') WHERE map_id = ?"
      ).bind(mapId).run();

      await writeAuditLog(db, {
        entity_type: 'REGION_SIGUNGU_MAP', entity_id: mapId, action: 'DELETE', actor_id: user.user_id,
        detail_json: JSON.stringify({ region_org_id: existing.region_org_id, sigungu_code: existing.sigungu_code }),
      });

      return c.json({ ok: true });
    } catch (err: any) {
      console.error(`[admin-regions] 시군구 매핑 삭제 실패 map_id=${mapId}:`, err.message);
      return c.json({ error: '시군구 매핑 삭제 중 오류가 발생했습니다.', code: 'REGION_ERROR' }, 500);
    }
  });

  // ─── 팀장-시군구 매핑 조회 ───
  router.get('/regions/team-mappings', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { user_id, region_org_id } = c.req.query();

    let query = `
      SELECT tsm.map_id, tsm.user_id, tsm.sigungu_code, tsm.region_org_id,
             u.name as user_name, u.login_id,
             o.name as region_name,
             sg.sido, sg.sigungu, sg.full_name
      FROM team_sigungu_map tsm
      JOIN users u ON tsm.user_id = u.user_id
      JOIN organizations o ON tsm.region_org_id = o.org_id
      JOIN sigungu sg ON tsm.sigungu_code = sg.code
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      query += ` AND tsm.region_org_id = ?`;
      params.push(user.org_id);
    }
    if (user_id) { query += ' AND tsm.user_id = ?'; params.push(Number(user_id)); }
    if (region_org_id) { query += ' AND tsm.region_org_id = ?'; params.push(Number(region_org_id)); }

    query += ' ORDER BY u.name, sg.full_name';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ mappings: result.results });
  });

  // ─── 팀장-시군구 매핑 추가 ───
  router.post('/regions/team-mappings', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { user_id, sigungu_codes, region_org_id } = await c.req.json();

    if (!user_id) return c.json({ error: '팀장 ID는 필수입니다.' }, 400);
    if (!sigungu_codes?.length) return c.json({ error: '시군구 코드 목록이 필요합니다.' }, 400);

    const regionId = region_org_id || (user.org_type === 'REGION' ? user.org_id : null);
    if (!regionId) return c.json({ error: '총판 org_id가 필요합니다.' }, 400);

    try {
      let created = 0;
      for (const code of sigungu_codes) {
        const existing = await db.prepare(
          'SELECT map_id FROM team_sigungu_map WHERE user_id = ? AND sigungu_code = ?'
        ).bind(user_id, code).first();
        if (existing) continue;

        await db.prepare(
          'INSERT INTO team_sigungu_map (user_id, sigungu_code, region_org_id, assigned_by) VALUES (?, ?, ?, ?)'
        ).bind(user_id, code, regionId, user.user_id).run();
        created++;
      }

      return c.json({ created, total_requested: sigungu_codes.length }, created > 0 ? 201 : 200);
    } catch (err: any) {
      console.error('[team-mappings] 매핑 추가 실패:', err.message);
      return c.json({ error: '팀장 시군구 매핑 중 오류가 발생했습니다.' }, 500);
    }
  });

  // ─── 팀장-시군구 매핑 삭제 ───
  router.delete('/regions/team-mappings/:map_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const db = c.env.DB;
    const mapId = Number(c.req.param('map_id'));

    const existing = await db.prepare('SELECT * FROM team_sigungu_map WHERE map_id = ?').bind(mapId).first();
    if (!existing) return c.json({ error: '매핑을 찾을 수 없습니다.' }, 404);

    await db.prepare('DELETE FROM team_sigungu_map WHERE map_id = ?').bind(mapId).run();
    return c.json({ ok: true });
  });
}
