import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth, requireHQ } from '../middleware/auth';

const reconciliation = new Hono<Env>();

// ─── 대사 실행 ───
reconciliation.post('/runs', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const { date_range_start, date_range_end } = await c.req.json();

  const runResult = await db.prepare(`
    INSERT INTO reconciliation_runs (date_range_start, date_range_end, scope, status)
    VALUES (?, ?, 'HQ', 'RUNNING')
  `).bind(date_range_start, date_range_end).run();
  const runId = runResult.meta.last_row_id as number;

  let issueCount = 0;

  // 1. DUPLICATE_ORDER: fingerprint 중복 체크
  const dups = await db.prepare(`
    SELECT source_fingerprint, COUNT(*) as cnt, GROUP_CONCAT(order_id) as order_ids
    FROM orders WHERE requested_date >= ? AND requested_date <= ?
    GROUP BY source_fingerprint HAVING cnt > 1
  `).bind(date_range_start, date_range_end).all();

  for (const d of dups.results as any[]) {
    const orderIds = d.order_ids.split(',');
    for (const oid of orderIds) {
      await db.prepare(`
        INSERT INTO reconciliation_issues (run_id, order_id, type, severity, detail_json)
        VALUES (?, ?, 'DUPLICATE_ORDER', 'HIGH', ?)
      `).bind(runId, Number(oid), JSON.stringify({ fingerprint: d.source_fingerprint, duplicate_count: d.cnt, related_orders: d.order_ids })).run();
      issueCount++;
    }
  }

  // 2. DISTRIBUTION_MISSING: VALIDATED인데 배분 없음
  const distMissing = await db.prepare(`
    SELECT o.order_id FROM orders o
    LEFT JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
    WHERE o.status = 'VALIDATED' AND od.distribution_id IS NULL
    AND o.requested_date >= ? AND o.requested_date <= ?
  `).bind(date_range_start, date_range_end).all();

  for (const o of distMissing.results as any[]) {
    await db.prepare(`
      INSERT INTO reconciliation_issues (run_id, order_id, type, severity, detail_json)
      VALUES (?, ?, 'DISTRIBUTION_MISSING', 'HIGH', '{}')
    `).bind(runId, o.order_id).run();
    issueCount++;
  }

  // 3. ASSIGNMENT_MISSING: DISTRIBUTED인데 할당 없음
  const assignMissing = await db.prepare(`
    SELECT o.order_id FROM orders o
    LEFT JOIN order_assignments oa ON o.order_id = oa.order_id AND oa.status != 'REASSIGNED'
    WHERE o.status = 'DISTRIBUTED' AND oa.assignment_id IS NULL
    AND o.requested_date >= ? AND o.requested_date <= ?
  `).bind(date_range_start, date_range_end).all();

  for (const o of assignMissing.results as any[]) {
    await db.prepare(`
      INSERT INTO reconciliation_issues (run_id, order_id, type, severity, detail_json)
      VALUES (?, ?, 'ASSIGNMENT_MISSING', 'MEDIUM', '{}')
    `).bind(runId, o.order_id).run();
    issueCount++;
  }

  // 4. REPORT_MISSING: SUBMITTED 이상인데 보고서 없음
  const reportMissing = await db.prepare(`
    SELECT o.order_id, o.status FROM orders o
    LEFT JOIN work_reports wr ON o.order_id = wr.order_id
    WHERE o.status IN ('SUBMITTED','REGION_APPROVED','HQ_APPROVED','SETTLEMENT_CONFIRMED')
    AND wr.report_id IS NULL
    AND o.requested_date >= ? AND o.requested_date <= ?
  `).bind(date_range_start, date_range_end).all();

  for (const o of reportMissing.results as any[]) {
    await db.prepare(`
      INSERT INTO reconciliation_issues (run_id, order_id, type, severity, detail_json)
      VALUES (?, ?, 'REPORT_MISSING', 'CRITICAL', ?)
    `).bind(runId, o.order_id, JSON.stringify({ current_status: o.status })).run();
    issueCount++;
  }

  // 5. PHOTO_COUNT_INSUFFICIENT: 보고서 정책 대비 사진 부족
  const reportsWithPolicy = await db.prepare(`
    SELECT wr.report_id, wr.order_id, rp.required_photos_json
    FROM work_reports wr
    JOIN orders o ON wr.order_id = o.order_id
    LEFT JOIN report_policies rp ON wr.policy_id_snapshot = rp.policy_id
    WHERE o.requested_date >= ? AND o.requested_date <= ?
    AND rp.required_photos_json IS NOT NULL
  `).bind(date_range_start, date_range_end).all();

  for (const rp of reportsWithPolicy.results as any[]) {
    try {
      const required = JSON.parse(rp.required_photos_json);
      for (const [category, minCount] of Object.entries(required)) {
        const photoCount = await db.prepare(`
          SELECT COUNT(*) as cnt FROM work_report_photos WHERE report_id = ? AND category = ?
        `).bind(rp.report_id, category).first();
        if ((photoCount as any).cnt < (minCount as number)) {
          await db.prepare(`
            INSERT INTO reconciliation_issues (run_id, order_id, type, severity, detail_json)
            VALUES (?, ?, 'PHOTO_COUNT_INSUFFICIENT', 'MEDIUM', ?)
          `).bind(runId, rp.order_id, JSON.stringify({ report_id: rp.report_id, category, required: minCount, actual: (photoCount as any).cnt })).run();
          issueCount++;
        }
      }
    } catch {}
  }

  // 6. STATUS_INCONSISTENT: 정산 확정인데 HQ_APPROVED 이력 없음
  const statusInconsistent = await db.prepare(`
    SELECT o.order_id FROM orders o
    WHERE o.status = 'SETTLEMENT_CONFIRMED'
    AND o.order_id NOT IN (
      SELECT DISTINCT order_id FROM reviews WHERE stage = 'HQ' AND result = 'APPROVE'
    )
    AND o.requested_date >= ? AND o.requested_date <= ?
  `).bind(date_range_start, date_range_end).all();

  for (const o of statusInconsistent.results as any[]) {
    await db.prepare(`
      INSERT INTO reconciliation_issues (run_id, order_id, type, severity, detail_json)
      VALUES (?, ?, 'STATUS_INCONSISTENT', 'CRITICAL', '{"issue":"정산확정인데 HQ 승인 이력 없음"}')
    `).bind(runId, o.order_id).run();
    issueCount++;
  }

  // 7. AMOUNT_MISMATCH: 정산 금액 검증
  const amountChecks = await db.prepare(`
    SELECT s.settlement_id, s.order_id, s.base_amount as s_base, o.base_amount as o_base,
           s.commission_amount, s.payable_amount
    FROM settlements s
    JOIN orders o ON s.order_id = o.order_id
    WHERE s.status IN ('PENDING','CONFIRMED')
    AND o.requested_date >= ? AND o.requested_date <= ?
  `).bind(date_range_start, date_range_end).all();

  for (const a of amountChecks.results as any[]) {
    if (a.s_base !== a.o_base) {
      await db.prepare(`
        INSERT INTO reconciliation_issues (run_id, order_id, type, severity, detail_json)
        VALUES (?, ?, 'AMOUNT_MISMATCH', 'HIGH', ?)
      `).bind(runId, a.order_id, JSON.stringify({ settlement_base: a.s_base, order_base: a.o_base })).run();
      issueCount++;
    }
    if (Math.abs(a.s_base - a.commission_amount - a.payable_amount) > 1) {
      await db.prepare(`
        INSERT INTO reconciliation_issues (run_id, order_id, type, severity, detail_json)
        VALUES (?, ?, 'AMOUNT_MISMATCH', 'HIGH', ?)
      `).bind(runId, a.order_id, JSON.stringify({ base: a.s_base, commission: a.commission_amount, payable: a.payable_amount, diff: a.s_base - a.commission_amount - a.payable_amount })).run();
      issueCount++;
    }
  }

  // Run 완료
  await db.prepare(`
    UPDATE reconciliation_runs SET status = 'DONE', total_issues = ?, finished_at = datetime('now') WHERE run_id = ?
  `).bind(issueCount, runId).run();

  return c.json({ run_id: runId, total_issues: issueCount });
});

// ─── 대사 Run 목록 ───
reconciliation.get('/runs', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR']);
  if (authErr) return authErr;

  const result = await c.env.DB.prepare('SELECT * FROM reconciliation_runs ORDER BY started_at DESC').all();
  return c.json({ runs: result.results });
});

// ─── 대사 이슈 목록 ───
reconciliation.get('/issues', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR']);
  if (authErr) return authErr;

  const { run_id, type, severity, resolved, page = '1', limit = '50' } = c.req.query();
  const offset = (Number(page) - 1) * Number(limit);
  const conditions: string[] = [];
  const params: any[] = [];

  if (run_id) { conditions.push('ri.run_id = ?'); params.push(Number(run_id)); }
  if (type) { conditions.push('ri.type = ?'); params.push(type); }
  if (severity) { conditions.push('ri.severity = ?'); params.push(severity); }
  if (resolved === 'true') { conditions.push('ri.resolved_at IS NOT NULL'); }
  if (resolved === 'false') { conditions.push('ri.resolved_at IS NULL'); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const result = await c.env.DB.prepare(`
    SELECT ri.*, o.external_order_no, o.customer_name, o.status as order_status
    FROM reconciliation_issues ri
    LEFT JOIN orders o ON ri.order_id = o.order_id
    ${where}
    ORDER BY ri.severity DESC, ri.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, Number(limit), offset).all();

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM reconciliation_issues ri ${where}`).bind(...params).first();

  return c.json({ issues: result.results, total: (countResult as any)?.total || 0 });
});

// ─── 대사 이슈 해결 처리 ───
reconciliation.patch('/issues/:issue_id/resolve', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const issueId = Number(c.req.param('issue_id'));

  await c.env.DB.prepare(`
    UPDATE reconciliation_issues SET resolved_at = datetime('now'), resolver_id = ? WHERE issue_id = ?
  `).bind(user.user_id, issueId).run();

  return c.json({ ok: true });
});

export default reconciliation;
