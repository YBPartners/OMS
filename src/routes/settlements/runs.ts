// ================================================================
// 다하다 OMS — 정산 Run 관리 (생성·목록)
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';

export function mountRuns(router: Hono<Env>) {

  // ─── 정산 Run 목록 ───
  router.get('/runs', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const db = c.env.DB;
    const result = await db.prepare(`
      SELECT sr.*, u.name as created_by_name
      FROM settlement_runs sr
      LEFT JOIN users u ON sr.created_by = u.user_id
      ORDER BY sr.created_at DESC
    `).all();

    return c.json({ runs: result.results });
  });

  // ─── 정산 Run 생성 ───
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

    await writeAuditLog(db, { entity_type: 'SETTLEMENT_RUN', entity_id: result.meta.last_row_id as number, action: 'CREATE', actor_id: user.user_id, detail_json: JSON.stringify({ period_type, period_start, period_end }) });

    return c.json({ run_id: result.meta.last_row_id }, 201);
  });

  // ─── 정산 명세 조회 ───
  router.get('/runs/:run_id/details', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const runId = Number(c.req.param('run_id'));
    if (isNaN(runId)) return c.json({ error: '유효하지 않은 Run ID입니다.' }, 400);
    const db = c.env.DB;

    const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first();
    if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);

    const details = await db.prepare(`
      SELECT s.*, o.external_order_no, o.customer_name, o.address_text, o.service_type,
             u.name as team_leader_name, org.name as region_name
      FROM settlements s
      JOIN orders o ON s.order_id = o.order_id
      JOIN users u ON s.team_leader_id = u.user_id
      JOIN organizations org ON s.region_org_id = org.org_id
      WHERE s.run_id = ?
      ORDER BY s.region_org_id, s.team_leader_id
    `).bind(runId).all();

    return c.json({ run, settlements: details.results });
  });

  // ─── 팀장 원장 조회 ───
  router.get('/ledger', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { from, to, team_leader_id } = c.req.query();

    let leaderId = team_leader_id ? Number(team_leader_id) : null;
    if (user.roles.includes('TEAM_LEADER')) leaderId = user.user_id;

    let query = `SELECT l.*, u.name as team_leader_name FROM team_leader_ledger_daily l JOIN users u ON l.team_leader_id = u.user_id WHERE 1=1`;
    const params: any[] = [];

    if (leaderId) { query += ' AND l.team_leader_id = ?'; params.push(leaderId); }
    if (from) { query += ' AND l.date >= ?'; params.push(from); }
    if (to) { query += ' AND l.date <= ?'; params.push(to); }
    query += ' ORDER BY l.date DESC, l.team_leader_id LIMIT 100';

    const result = await db.prepare(query).bind(...params).all();
    return c.json({ ledger: result.results });
  });
}
