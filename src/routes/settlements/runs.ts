// ================================================================
// Airflow OMS — 정산 Run 관리 v5.0 (Scope Engine 적용)
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
             team_org.name as team_name, ch.name as channel_name
      FROM settlements s
      JOIN orders o ON s.order_id = o.order_id
      JOIN users u ON s.team_leader_id = u.user_id
      JOIN organizations org ON s.region_org_id = org.org_id
      LEFT JOIN organizations team_org ON s.team_org_id = team_org.org_id
      LEFT JOIN order_channels ch ON o.channel_id = ch.channel_id
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

  // ─── 정산 지급완료 (SETTLEMENT_CONFIRMED → PAID) ───
  router.post('/runs/:run_id/pay', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const runId = Number(c.req.param('run_id'));
    if (isNaN(runId)) return c.json({ error: '유효하지 않은 Run ID입니다.' }, 400);

    const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first() as any;
    if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);
    if (run.status !== 'CONFIRMED') {
      return c.json({ error: '확정(CONFIRMED) 상태에서만 지급 가능합니다. 현재: ' + run.status }, 400);
    }

    // 옵션: payment_note, payment_date
    let body: any = {};
    try { body = await c.req.json(); } catch { /* optional body */ }
    const paymentNote = body.payment_note || '';
    const paymentDate = body.payment_date || new Date().toISOString().split('T')[0];

    // CONFIRMED 상태인 정산 항목 조회
    const confirmedSettlements = await db.prepare(`
      SELECT s.settlement_id, s.order_id, s.team_leader_id, s.region_org_id, s.payable_amount
      FROM settlements s
      WHERE s.run_id = ? AND s.status = 'CONFIRMED'
    `).bind(runId).all();

    if (confirmedSettlements.results.length === 0) {
      return c.json({ error: '지급 대상 정산 항목이 없습니다.' }, 400);
    }

    const items = confirmedSettlements.results as any[];
    let paidCount = 0;
    const errors: { order_id: number; error: string }[] = [];

    // 주문 현재 상태 일괄 조회
    const orderIds = items.map((s: any) => s.order_id);
    const orderStatuses = await db.prepare(`
      SELECT order_id, status FROM orders WHERE order_id IN (${orderIds.map(() => '?').join(',')})
    `).bind(...orderIds).all();

    const statusMap = new Map<number, string>();
    for (const os of orderStatuses.results as any[]) {
      statusMap.set(os.order_id, os.status);
    }

    // 배치 빌드
    const stmts: D1PreparedStatement[] = [];

    for (const item of items) {
      const currentStatus = statusMap.get(item.order_id);
      if (currentStatus !== 'SETTLEMENT_CONFIRMED') {
        errors.push({ order_id: item.order_id, error: `주문 상태가 ${currentStatus} (SETTLEMENT_CONFIRMED 필요)` });
        continue;
      }

      // 1. 정산 → PAID
      stmts.push(db.prepare(
        `UPDATE settlements SET status = 'PAID', confirmed_at = datetime('now') WHERE settlement_id = ?`
      ).bind(item.settlement_id));

      // 2. 주문 → PAID
      stmts.push(db.prepare(
        `UPDATE orders SET status = 'PAID', updated_at = datetime('now') WHERE order_id = ? AND status = 'SETTLEMENT_CONFIRMED'`
      ).bind(item.order_id));

      // 3. 배정 → PAID
      stmts.push(db.prepare(
        `UPDATE order_assignments SET status = 'PAID', updated_at = datetime('now') WHERE order_id = ? AND status = 'SETTLEMENT_CONFIRMED'`
      ).bind(item.order_id));

      // 4. 상태 이력
      stmts.push(db.prepare(
        `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note) VALUES (?, 'SETTLEMENT_CONFIRMED', 'PAID', ?, ?)`
      ).bind(item.order_id, user.user_id, paymentNote || `지급완료 run_id:${runId} date:${paymentDate}`));

      // 5. 팀장 원장 — paid 관련 컬럼 업데이트
      stmts.push(db.prepare(
        `INSERT INTO team_leader_ledger_daily (date, team_leader_id, paid_amount_sum, paid_count, updated_at)
         VALUES (?, ?, ?, 1, datetime('now'))
         ON CONFLICT(date, team_leader_id) DO UPDATE SET
           paid_amount_sum = paid_amount_sum + ?,
           paid_count = paid_count + 1,
           updated_at = datetime('now')`
      ).bind(paymentDate, item.team_leader_id, item.payable_amount, item.payable_amount));

      paidCount++;
    }

    if (paidCount > 0) {
      // Run 상태 업데이트
      stmts.push(db.prepare(
        `UPDATE settlement_runs SET status = 'PAID', updated_at = datetime('now') WHERE run_id = ?`
      ).bind(runId));

      // 배치 실행
      await db.batch(stmts);
    }

    // 감사 로그
    await writeAuditLog(db, {
      entity_type: 'SETTLEMENT_RUN', entity_id: runId,
      action: 'SETTLEMENT.PAID' as any,
      actor_id: user.user_id,
      detail_json: JSON.stringify({
        paid_count: paidCount, errors: errors.length,
        total_payable: items.filter((_: any, i: number) => i < paidCount).reduce((s: number, it: any) => s + it.payable_amount, 0),
        payment_date: paymentDate, payment_note: paymentNote,
      }),
    });

    return c.json({
      ok: paidCount > 0,
      run_id: runId,
      paid_count: paidCount,
      payment_date: paymentDate,
      ...(errors.length > 0 ? { warnings: `${errors.length}건 지급 실패`, errors } : {}),
    });
  });
}
