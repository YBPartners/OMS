// ================================================================
// 와이비 OMS — 정산 Run 관리 v5.0 (Scope Engine 적용)
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { getOrderScope } from '../../lib/scope-engine';
import { normalizePagination } from '../../lib/validators';

export function mountRuns(router: Hono<Env>) {

  // ─── 정산 Run 목록 (REGION/TEAM도 조회 가능하도록 확장) ───
  router.get('/runs', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;

    // HQ는 전체, REGION/TEAM은 자기 관련 Run만
    let query = `
      SELECT DISTINCT sr.*, u.name as created_by_name
      FROM settlement_runs sr
      LEFT JOIN users u ON sr.created_by = u.user_id
    `;
    const params: any[] = [];

    if (user.org_type === 'REGION') {
      query += ` WHERE sr.run_id IN (SELECT DISTINCT run_id FROM settlements WHERE region_org_id = ?)`;
      params.push(user.org_id);
    } else if (user.org_type === 'TEAM') {
      query += ` WHERE sr.run_id IN (SELECT DISTINCT run_id FROM settlements WHERE team_leader_id = ?)`;
      params.push(user.user_id);
    }

    query += ' ORDER BY sr.created_at DESC';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ runs: result.results });
  });

  // ─── 정산 Run 생성 (HQ only) ───
  router.post('/runs', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;

    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청 형식입니다.' }, 400); }

    const { period_type, period_start, period_end } = body;

    if (!period_type || !period_start || !period_end) {
      return c.json({ error: 'period_type, period_start, period_end가 필요합니다.' }, 400);
    }
    if (!['WEEKLY', 'MONTHLY'].includes(period_type)) {
      return c.json({ error: 'period_type은 WEEKLY 또는 MONTHLY입니다.' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period_start) || !/^\d{4}-\d{2}-\d{2}$/.test(period_end)) {
      return c.json({ error: '날짜 형식은 YYYY-MM-DD입니다.' }, 400);
    }
    if (period_start > period_end) {
      return c.json({ error: '시작일이 종료일보다 이후입니다.' }, 400);
    }

    const result = await db.prepare(`
      INSERT INTO settlement_runs (period_type, period_start, period_end, status, created_by)
      VALUES (?, ?, ?, 'DRAFT', ?)
    `).bind(period_type, period_start, period_end, user.user_id).run();

    await writeAuditLog(db, {
      entity_type: 'SETTLEMENT_RUN', entity_id: result.meta.last_row_id as number,
      action: 'CREATE', actor_id: user.user_id,
      detail_json: JSON.stringify({ period_type, period_start, period_end }),
    });

    return c.json({ run_id: result.meta.last_row_id }, 201);
  });

  // ─── 정산 명세 조회 (Scope Engine 기반) ───
  router.get('/runs/:run_id/details', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const runId = Number(c.req.param('run_id'));
    if (isNaN(runId)) return c.json({ error: '유효하지 않은 Run ID입니다.' }, 400);
    const db = c.env.DB;

    const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first();
    if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);

    // ★ Scope 적용: REGION은 자기 지역, TEAM은 자기 명세만
    let detailQuery = `
      SELECT s.*, o.external_order_no, o.customer_name, o.address_text, o.service_type,
             u.name as team_leader_name, org.name as region_name,
             team_org.name as team_name
      FROM settlements s
      JOIN orders o ON s.order_id = o.order_id
      JOIN users u ON s.team_leader_id = u.user_id
      JOIN organizations org ON s.region_org_id = org.org_id
      LEFT JOIN organizations team_org ON s.team_org_id = team_org.org_id
      WHERE s.run_id = ?
    `;
    const params: any[] = [runId];

    if (user.org_type === 'REGION') {
      detailQuery += ' AND s.region_org_id = ?';
      params.push(user.org_id);
    } else if (user.org_type === 'TEAM') {
      detailQuery += ' AND s.team_leader_id = ?';
      params.push(user.user_id);
    }

    detailQuery += ' ORDER BY s.region_org_id, s.team_leader_id';

    const details = await db.prepare(detailQuery).bind(...params).all();
    return c.json({ run, settlements: details.results });
  });

  // ─── 팀장 원장 조회 (Scope Engine 기반) ───
  router.get('/ledger', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { from, to, team_leader_id } = c.req.query();

    let query = `
      SELECT l.*, u.name as team_leader_name, o.name as org_name
      FROM team_leader_ledger_daily l
      JOIN users u ON l.team_leader_id = u.user_id
      JOIN organizations o ON u.org_id = o.org_id
      WHERE 1=1
    `;
    const params: any[] = [];

    // ★ Scope: TEAM은 자기 원장만, REGION은 하위 팀장, HQ는 전체
    if (user.org_type === 'TEAM' || user.roles.includes('TEAM_LEADER')) {
      query += ' AND l.team_leader_id = ?';
      params.push(user.user_id);
    } else if (user.org_type === 'REGION') {
      query += ' AND u.org_id IN (SELECT org_id FROM organizations WHERE org_id = ? OR parent_org_id = ?)';
      params.push(user.org_id, user.org_id);
      if (team_leader_id) { query += ' AND l.team_leader_id = ?'; params.push(Number(team_leader_id)); }
    } else {
      if (team_leader_id) { query += ' AND l.team_leader_id = ?'; params.push(Number(team_leader_id)); }
    }

    if (from) { query += ' AND l.date >= ?'; params.push(from); }
    if (to) { query += ' AND l.date <= ?'; params.push(to); }
    query += ' ORDER BY l.date DESC, l.team_leader_id LIMIT 100';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ ledger: result.results });
  });
}
