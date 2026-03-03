import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth, requireHQ, writeAuditLog, writeStatusHistory } from '../middleware/auth';

const settlements = new Hono<Env>();

// ─── 정산 Run 목록 ───
settlements.get('/runs', async (c) => {
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
settlements.post('/runs', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { period_type, period_start, period_end } = await c.req.json();

  if (!period_type || !period_start || !period_end) {
    return c.json({ error: 'period_type, period_start, period_end가 필요합니다.' }, 400);
  }

  const result = await db.prepare(`
    INSERT INTO settlement_runs (period_type, period_start, period_end, status, created_by)
    VALUES (?, ?, ?, 'DRAFT', ?)
  `).bind(period_type, period_start, period_end, user.user_id).run();

  return c.json({ run_id: result.meta.last_row_id }, 201);
});

// ─── 정산 산출 (calculate) ───
settlements.post('/runs/:run_id/calculate', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const runId = Number(c.req.param('run_id'));

  const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first();
  if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);
  if (run.status !== 'DRAFT') return c.json({ error: '이미 산출된 정산입니다.' }, 400);

  // HQ_APPROVED 상태인 주문 (기간 내)
  const approvedOrders = await db.prepare(`
    SELECT o.order_id, o.base_amount, o.requested_date,
           od.region_org_id,
           oa.team_leader_id
    FROM orders o
    JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
    JOIN order_assignments oa ON o.order_id = oa.order_id AND oa.status = 'HQ_APPROVED'
    WHERE o.status = 'HQ_APPROVED'
      AND o.requested_date >= ? AND o.requested_date <= ?
      AND o.order_id NOT IN (SELECT order_id FROM settlements WHERE status IN ('PENDING','CONFIRMED','PAID'))
  `).bind(run.period_start, run.period_end).all();

  let totalBase = 0;
  let totalCommission = 0;
  let totalPayable = 0;
  let count = 0;

  for (const order of approvedOrders.results as any[]) {
    // 수수료 정책 조회 (팀장 개별 우선 → 지역 기본)
    let commPolicy = await db.prepare(`
      SELECT * FROM commission_policies
      WHERE org_id = ? AND team_leader_id = ? AND is_active = 1
      ORDER BY effective_from DESC LIMIT 1
    `).bind(order.region_org_id, order.team_leader_id).first();

    if (!commPolicy) {
      commPolicy = await db.prepare(`
        SELECT * FROM commission_policies
        WHERE org_id = ? AND team_leader_id IS NULL AND is_active = 1
        ORDER BY effective_from DESC LIMIT 1
      `).bind(order.region_org_id).first();
    }

    const mode = (commPolicy?.mode || 'PERCENT') as string;
    const rate = (commPolicy?.value || 0) as number;
    let commissionAmount = 0;

    if (mode === 'FIXED') {
      commissionAmount = rate;
    } else {
      commissionAmount = Math.round(order.base_amount * rate / 100);
    }
    const payableAmount = order.base_amount - commissionAmount;

    await db.prepare(`
      INSERT INTO settlements (run_id, order_id, team_leader_id, region_org_id,
        base_amount, commission_mode, commission_rate, commission_amount, payable_amount,
        period_type, period_start, period_end, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `).bind(
      runId, order.order_id, order.team_leader_id, order.region_org_id,
      order.base_amount, mode, rate, commissionAmount, payableAmount,
      run.period_type, run.period_start, run.period_end
    ).run();

    totalBase += order.base_amount;
    totalCommission += commissionAmount;
    totalPayable += payableAmount;
    count++;
  }

  await db.prepare(`
    UPDATE settlement_runs SET status = 'CALCULATED',
      total_base_amount = ?, total_commission_amount = ?, total_payable_amount = ?, total_count = ?,
      updated_at = datetime('now')
    WHERE run_id = ?
  `).bind(totalBase, totalCommission, totalPayable, count, runId).run();

  return c.json({ run_id: runId, total_orders: count, total_base_amount: totalBase, total_commission_amount: totalCommission, total_payable_amount: totalPayable });
});

// ─── 정산 확정 (confirm) → 원장 반영 ───
settlements.post('/runs/:run_id/confirm', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const runId = Number(c.req.param('run_id'));

  const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first();
  if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);
  if (run.status !== 'CALCULATED') return c.json({ error: '산출 완료 상태에서만 확정 가능합니다.' }, 400);

  // settlements 확정
  const pendingSettlements = await db.prepare(`
    SELECT * FROM settlements WHERE run_id = ? AND status = 'PENDING'
  `).bind(runId).all();

  const today = new Date().toISOString().split('T')[0];

  for (const s of pendingSettlements.results as any[]) {
    await db.prepare(`
      UPDATE settlements SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = datetime('now') WHERE settlement_id = ?
    `).bind(user.user_id, s.settlement_id).run();

    // 주문 상태 업데이트
    await db.prepare(`UPDATE orders SET status = 'SETTLEMENT_CONFIRMED', updated_at = datetime('now') WHERE order_id = ?`).bind(s.order_id).run();
    await db.prepare(`UPDATE order_assignments SET status = 'SETTLEMENT_CONFIRMED', updated_at = datetime('now') WHERE order_id = ? AND status = 'HQ_APPROVED'`).bind(s.order_id).run();
    await writeStatusHistory(db, { order_id: s.order_id, from_status: 'HQ_APPROVED', to_status: 'SETTLEMENT_CONFIRMED', actor_id: user.user_id, note: `정산확정 run_id:${runId}` });

    // 팀장 일자별 원장 UPSERT
    await db.prepare(`
      INSERT INTO team_leader_ledger_daily (date, team_leader_id, confirmed_payable_sum, confirmed_count, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'))
      ON CONFLICT(date, team_leader_id) DO UPDATE SET
        confirmed_payable_sum = confirmed_payable_sum + ?,
        confirmed_count = confirmed_count + 1,
        updated_at = datetime('now')
    `).bind(today, s.team_leader_id, s.payable_amount, s.payable_amount).run();

    // 통계 업데이트
    await db.prepare(`
      INSERT INTO team_leader_daily_stats (date, team_leader_id, settlement_confirmed_count, payable_amount_sum, updated_at)
      VALUES (?, ?, 1, ?, datetime('now'))
      ON CONFLICT(date, team_leader_id) DO UPDATE SET
        settlement_confirmed_count = settlement_confirmed_count + 1,
        payable_amount_sum = payable_amount_sum + ?,
        updated_at = datetime('now')
    `).bind(today, s.team_leader_id, s.payable_amount, s.payable_amount).run();

    // 지역 통계
    await db.prepare(`
      INSERT INTO region_daily_stats (date, region_org_id, settlement_confirmed_count, payable_amount_sum, updated_at)
      VALUES (?, ?, 1, ?, datetime('now'))
      ON CONFLICT(date, region_org_id) DO UPDATE SET
        settlement_confirmed_count = settlement_confirmed_count + 1,
        payable_amount_sum = payable_amount_sum + ?,
        updated_at = datetime('now')
    `).bind(today, s.region_org_id, s.payable_amount, s.payable_amount).run();
  }

  await db.prepare(`
    UPDATE settlement_runs SET status = 'CONFIRMED', updated_at = datetime('now') WHERE run_id = ?
  `).bind(runId).run();

  return c.json({ ok: true, confirmed_count: pendingSettlements.results.length });
});

// ─── 정산 명세 조회 ───
settlements.get('/runs/:run_id/details', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const runId = Number(c.req.param('run_id'));
  const db = c.env.DB;

  const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first();
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
settlements.get('/ledger', async (c) => {
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
  query += ' ORDER BY l.date DESC, l.team_leader_id';

  const result = await db.prepare(query).bind(...params).all();
  return c.json({ ledger: result.results });
});

export default settlements;
