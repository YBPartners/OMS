// ================================================================
// 와이비 OMS — 행정구역(admin_regions) API
// 시도·시군구·읍면동 계층 검색 + 조직-행정구역 매핑 관리
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
      FROM admin_regions WHERE is_active = 1
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
      SELECT DISTINCT sigungu, COUNT(*) as dong_count
      FROM admin_regions WHERE sido = ? AND is_active = 1
      GROUP BY sigungu ORDER BY sigungu
    `).bind(sido).all();

    return c.json({ sigungu_list: result.results });
  });

  // ─── 읍면동 목록 (3단계: sigungu 선택 후) ───
  router.get('/regions/eupmyeondong', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const { sido, sigungu } = c.req.query();
    if (!sido || !sigungu) return c.json({ error: '시도와 시군구를 선택해주세요.' }, 400);

    const db = c.env.DB;
    const result = await db.prepare(`
      SELECT region_id, sido, sigungu, eupmyeondong, admin_code, legal_code, full_name
      FROM admin_regions WHERE sido = ? AND sigungu = ? AND is_active = 1
      ORDER BY eupmyeondong
    `).bind(sido, sigungu).all();

    return c.json({ regions: result.results });
  });

  // ─── 행정구역 통합 검색 (자동완성용) ───
  router.get('/regions/search', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const q = c.req.query('q');
    if (!q || q.length < 2) return c.json({ error: '검색어는 2글자 이상 입력하세요.' }, 400);

    const db = c.env.DB;
    const result = await db.prepare(`
      SELECT region_id, sido, sigungu, eupmyeondong, admin_code, legal_code, full_name
      FROM admin_regions
      WHERE is_active = 1 AND (
        full_name LIKE ? OR sido LIKE ? OR sigungu LIKE ? OR eupmyeondong LIKE ?
      )
      ORDER BY full_name
      LIMIT 50
    `).bind(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`).all();

    return c.json({ regions: result.results, total: result.results.length });
  });

  // ─── 행정구역 전체 목록 (페이지네이션) ───
  router.get('/regions', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const { sido, sigungu, page, limit } = c.req.query();
    const pg = normalizePagination(page, limit);
    const db = c.env.DB;

    const conditions: string[] = ['is_active = 1'];
    const params: any[] = [];

    if (sido) { conditions.push('sido = ?'); params.push(sido); }
    if (sigungu) { conditions.push('sigungu = ?'); params.push(sigungu); }

    const where = conditions.join(' AND ');

    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM admin_regions WHERE ${where}`
    ).bind(...params).first();

    const result = await db.prepare(`
      SELECT region_id, sido, sigungu, eupmyeondong, admin_code, legal_code, full_name
      FROM admin_regions WHERE ${where}
      ORDER BY sido, sigungu, eupmyeondong
      LIMIT ? OFFSET ?
    `).bind(...params, pg.limit, pg.offset).all();

    return c.json({
      regions: result.results,
      total: (countResult as any)?.total || 0,
      page: pg.page,
      limit: pg.limit,
    });
  });

  // ─── 조직-행정구역 매핑 조회 ───
  router.get('/regions/mappings', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { org_id } = c.req.query();

    let query = `
      SELECT orm.mapping_id, orm.org_id, orm.region_id,
             o.name as org_name, o.org_type, o.code as org_code,
             ar.sido, ar.sigungu, ar.eupmyeondong, ar.full_name, ar.admin_code
      FROM org_region_mappings orm
      JOIN organizations o ON orm.org_id = o.org_id
      JOIN admin_regions ar ON orm.region_id = ar.region_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // REGION 관리자는 자기 조직의 매핑만 조회
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      // 자기 총판 + 하위 TEAM 조직의 매핑 조회
      query += ` AND (orm.org_id = ? OR orm.org_id IN (SELECT org_id FROM organizations WHERE parent_org_id = ?))`;
      params.push(user.org_id, user.org_id);
    } else if (org_id) {
      query += ' AND orm.org_id = ?';
      params.push(Number(org_id));
    }

    query += ' ORDER BY o.name, ar.full_name';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ mappings: result.results });
  });

  // ─── 조직-행정구역 매핑 추가 (다건) ───
  router.post('/regions/mappings', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();

    const { org_id, region_ids } = body;
    if (!org_id) return c.json({ error: '조직 ID는 필수입니다.' }, 400);
    if (!region_ids || !Array.isArray(region_ids) || region_ids.length === 0) {
      return c.json({ error: '행정구역 목록이 필요합니다.' }, 400);
    }

    // 권한 체크: REGION_ADMIN은 자기 조직에만 매핑 추가 가능
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      // 자기 총판이거나 하위 TEAM이어야 함
      const targetOrg = await db.prepare(
        'SELECT org_id, parent_org_id FROM organizations WHERE org_id = ?'
      ).bind(org_id).first();
      if (!targetOrg) return c.json({ error: '조직을 찾을 수 없습니다.' }, 404);
      if (Number(targetOrg.org_id) !== user.org_id && targetOrg.parent_org_id !== user.org_id) {
        return c.json({ error: '자기 조직의 행정구역만 매핑할 수 있습니다.' }, 403);
      }
    }

    // 충돌 체크: 이미 다른 조직에 매핑된 행정구역 확인
    const conflicts: any[] = [];
    let created = 0;

    for (const regionId of region_ids) {
      const existing = await db.prepare(`
        SELECT orm.org_id, o.name as org_name
        FROM org_region_mappings orm
        JOIN organizations o ON orm.org_id = o.org_id
        WHERE orm.region_id = ? AND orm.org_id != ?
      `).bind(regionId, org_id).first();

      if (existing) {
        const regionInfo = await db.prepare(
          'SELECT full_name FROM admin_regions WHERE region_id = ?'
        ).bind(regionId).first();
        conflicts.push({
          region_id: regionId,
          region_name: regionInfo?.full_name,
          existing_org_id: existing.org_id,
          existing_org_name: existing.org_name,
        });
        continue;
      }

      // 이미 같은 조직에 매핑된 경우 스킵
      const selfExisting = await db.prepare(
        'SELECT mapping_id FROM org_region_mappings WHERE org_id = ? AND region_id = ?'
      ).bind(org_id, regionId).first();
      if (selfExisting) continue;

      await db.prepare(
        'INSERT INTO org_region_mappings (org_id, region_id) VALUES (?, ?)'
      ).bind(org_id, regionId).run();
      created++;
    }

    await writeAuditLog(db, {
      entity_type: 'ORG_REGION_MAPPING',
      action: 'BULK_CREATE',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ org_id, region_ids, created, conflicts: conflicts.length }),
    });

    const result: any = { created, total_requested: region_ids.length };
    if (conflicts.length > 0) {
      result.conflicts = conflicts;
      result.warning = `${conflicts.length}건의 충돌이 발견되었습니다.`;
    }

    return c.json(result, created > 0 ? 201 : 200);
  });

  // ─── 조직-행정구역 매핑 삭제 ───
  router.delete('/regions/mappings/:mapping_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const mappingId = Number(c.req.param('mapping_id'));

    const existing = await db.prepare(`
      SELECT orm.*, o.parent_org_id FROM org_region_mappings orm
      JOIN organizations o ON orm.org_id = o.org_id
      WHERE orm.mapping_id = ?
    `).bind(mappingId).first();
    if (!existing) return c.json({ error: '매핑을 찾을 수 없습니다.' }, 404);

    // 권한 체크
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      if (Number(existing.org_id) !== user.org_id && existing.parent_org_id !== user.org_id) {
        return c.json({ error: '자기 조직의 매핑만 삭제할 수 있습니다.' }, 403);
      }
    }

    await db.prepare('DELETE FROM org_region_mappings WHERE mapping_id = ?').bind(mappingId).run();

    await writeAuditLog(db, {
      entity_type: 'ORG_REGION_MAPPING',
      entity_id: mappingId,
      action: 'DELETE',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ org_id: existing.org_id, region_id: existing.region_id }),
    });

    return c.json({ ok: true });
  });
}
