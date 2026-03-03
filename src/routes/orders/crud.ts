// ================================================================
// 다하다 OMS — 주문 CRUD (목록/상세/수동등록/배치임포트)
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeStatusHistory } from '../../lib/audit';
import { generateFingerprint } from '../../lib/db-helpers';
import { normalizePagination } from '../../lib/validators';

export function mountCrud(router: Hono<Env>) {

  // ─── 주문 목록 조회 (스코프 기반) ───
  router.get('/', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { status, page, limit, from, to, search, region_org_id, team_leader_id } = c.req.query();
    const pg = normalizePagination(page, limit);
    const conditions: string[] = [];
    const params: any[] = [];

    if (user.roles.includes('TEAM_LEADER')) {
      conditions.push(`oa.team_leader_id = ?`);
      params.push(user.user_id);
    } else if (user.org_type === 'REGION') {
      conditions.push(`od.region_org_id = ?`);
      params.push(user.org_id);
    }

    if (status) { conditions.push('o.status = ?'); params.push(status); }
    if (from) { conditions.push("o.requested_date >= ?"); params.push(from); }
    if (to) { conditions.push("o.requested_date <= ?"); params.push(to); }
    if (search) { conditions.push("(o.customer_name LIKE ? OR o.address_text LIKE ? OR o.external_order_no LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (region_org_id) { conditions.push('od.region_org_id = ?'); params.push(Number(region_org_id)); }
    if (team_leader_id) { conditions.push('oa.team_leader_id = ?'); params.push(Number(team_leader_id)); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await db.prepare(`
      SELECT COUNT(DISTINCT o.order_id) as total
      FROM orders o
      LEFT JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
      LEFT JOIN order_assignments oa ON o.order_id = oa.order_id AND oa.status != 'REASSIGNED'
      ${where}
    `).bind(...params).first();

    const result = await db.prepare(`
      SELECT o.*, od.region_org_id, org.name as region_name,
             oa.team_leader_id, tl.name as team_leader_name,
             oa.status as assignment_status, oa.assigned_at
      FROM orders o
      LEFT JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
      LEFT JOIN organizations org ON od.region_org_id = org.org_id
      LEFT JOIN order_assignments oa ON o.order_id = oa.order_id AND oa.status != 'REASSIGNED'
      LEFT JOIN users tl ON oa.team_leader_id = tl.user_id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pg.limit, pg.offset).all();

    return c.json({ orders: result.results, total: (countResult as any)?.total || 0, page: pg.page, limit: pg.limit });
  });

  // ─── 주문 상세 ───
  router.get('/:order_id', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const orderId = Number(c.req.param('order_id'));
    const db = c.env.DB;

    const order = await db.prepare(`
      SELECT o.*, od.region_org_id, org.name as region_name, od.distributed_at, od.distribution_policy_version,
             oa.team_leader_id, tl.name as team_leader_name, oa.assigned_at, oa.status as assignment_status
      FROM orders o
      LEFT JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
      LEFT JOIN organizations org ON od.region_org_id = org.org_id
      LEFT JOIN order_assignments oa ON o.order_id = oa.order_id AND oa.status != 'REASSIGNED'
      LEFT JOIN users tl ON oa.team_leader_id = tl.user_id
      WHERE o.order_id = ?
    `).bind(orderId).first();

    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

    const history = await db.prepare(`
      SELECT h.*, u.name as actor_name FROM order_status_history h
      LEFT JOIN users u ON h.actor_id = u.user_id WHERE h.order_id = ? ORDER BY h.created_at DESC
    `).bind(orderId).all();

    const reports = await db.prepare(`
      SELECT wr.*, u.name as team_leader_name FROM work_reports wr
      JOIN users u ON wr.team_leader_id = u.user_id WHERE wr.order_id = ? ORDER BY wr.version DESC
    `).bind(orderId).all();

    const reviews = await db.prepare(`
      SELECT rv.*, u.name as reviewer_name FROM reviews rv
      JOIN users u ON rv.reviewer_id = u.user_id WHERE rv.order_id = ? ORDER BY rv.reviewed_at DESC
    `).bind(orderId).all();

    let photos: any[] = [];
    if (reports.results.length > 0) {
      const latestReportId = (reports.results[0] as any).report_id;
      const photoResult = await db.prepare('SELECT * FROM work_report_photos WHERE report_id = ?').bind(latestReportId).all();
      photos = photoResult.results;
    }

    return c.json({ order, history: history.results, reports: reports.results, reviews: reviews.results, photos });
  });

  // ─── 주문 수동 등록 ───
  router.post('/', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청 형식입니다.' }, 400); }

    if (!body.address_text) return c.json({ error: '주소(address_text)는 필수입니다.' }, 400);
    if (body.base_amount !== undefined && (isNaN(Number(body.base_amount)) || Number(body.base_amount) < 0)) {
      return c.json({ error: '금액은 0 이상의 숫자여야 합니다.' }, 400);
    }

    const fpData = `${body.address_text}|${body.requested_date}|${body.service_type || 'DEFAULT'}|${body.base_amount || 0}`;
    const fingerprint = await generateFingerprint(fpData);

    const dup = await db.prepare(`
      SELECT order_id, status FROM orders WHERE source_fingerprint = ? AND requested_date = ?
    `).bind(fingerprint, body.requested_date).first();
    
    if (dup) {
      return c.json({ warning: '동일한 주문이 이미 존재합니다.', existing_order_id: dup.order_id, existing_status: dup.status }, 409);
    }

    const result = await db.prepare(`
      INSERT INTO orders (external_order_no, source_fingerprint, service_type, customer_name, customer_phone,
        address_text, address_detail, admin_dong_code, legal_dong_code, requested_date, scheduled_date, base_amount, memo, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED')
    `).bind(
      body.external_order_no || null, fingerprint, body.service_type || 'DEFAULT',
      body.customer_name || null, body.customer_phone || null,
      body.address_text, body.address_detail || null,
      body.admin_dong_code || null, body.legal_dong_code || null,
      body.requested_date || new Date().toISOString().split('T')[0],
      body.scheduled_date || null, body.base_amount || 0, body.memo || null
    ).run();

    const orderId = result.meta.last_row_id;
    await writeStatusHistory(db, { order_id: orderId as number, from_status: null, to_status: 'RECEIVED', actor_id: user.user_id, note: '수동 등록' });

    return c.json({ order_id: orderId, fingerprint }, 201);
  });

  // ─── 배치 파싱 (CSV 업로드 시뮬레이션) ───
  router.post('/import', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();
    const rows = body.orders || [];

    const batchResult = await db.prepare(`
      INSERT INTO order_import_batches (source_type, file_name, total_rows, status, created_by)
      VALUES (?, ?, ?, 'PARSING', ?)
    `).bind(body.source_type || 'FILE', body.file_name || 'manual_import', rows.length, user.user_id).run();
    const batchId = batchResult.meta.last_row_id;

    let successCount = 0;
    let failCount = 0;
    const errors: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const fpData = `${row.address_text}|${row.requested_date}|${row.service_type || 'DEFAULT'}|${row.base_amount || 0}`;
        const fingerprint = await generateFingerprint(fpData);

        await db.prepare(`
          INSERT INTO orders (batch_id, external_order_no, source_fingerprint, service_type, customer_name, customer_phone,
            address_text, address_detail, admin_dong_code, requested_date, base_amount, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED')
        `).bind(
          batchId, row.external_order_no || null, fingerprint, row.service_type || 'DEFAULT',
          row.customer_name || null, row.customer_phone || null,
          row.address_text, row.address_detail || null,
          row.admin_dong_code || null, row.requested_date || new Date().toISOString().split('T')[0],
          row.base_amount || 0
        ).run();
        successCount++;
      } catch (e: any) {
        failCount++;
        errors.push({ row: i + 1, error: e.message });
      }
    }

    await db.prepare(`
      UPDATE order_import_batches SET status = 'PARSED', success_rows = ?, fail_rows = ?, error_summary = ? WHERE batch_id = ?
    `).bind(successCount, failCount, errors.length > 0 ? JSON.stringify(errors) : null, batchId).run();

    return c.json({ batch_id: batchId, total: rows.length, success: successCount, fail: failCount, errors });
  });

  // ─── 퍼널 현황 (대시보드) ───
  router.get('/stats/funnel', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    let scopeCondition = '';
    const params: any[] = [];

    if (user.roles.includes('TEAM_LEADER')) {
      scopeCondition = `AND o.order_id IN (SELECT order_id FROM order_assignments WHERE team_leader_id = ?)`;
      params.push(user.user_id);
    } else if (user.org_type === 'REGION') {
      scopeCondition = `AND o.order_id IN (SELECT order_id FROM order_distributions WHERE region_org_id = ? AND status = 'ACTIVE')`;
      params.push(user.org_id);
    }

    const result = await db.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(base_amount), 0) as total_amount
      FROM orders o WHERE 1=1 ${scopeCondition}
      GROUP BY status
      ORDER BY CASE status
        WHEN 'RECEIVED' THEN 1 WHEN 'VALIDATED' THEN 2 WHEN 'DISTRIBUTION_PENDING' THEN 3
        WHEN 'DISTRIBUTED' THEN 4 WHEN 'ASSIGNED' THEN 5 WHEN 'IN_PROGRESS' THEN 6
        WHEN 'SUBMITTED' THEN 7 WHEN 'REGION_APPROVED' THEN 8 WHEN 'REGION_REJECTED' THEN 9
        WHEN 'HQ_APPROVED' THEN 10 WHEN 'HQ_REJECTED' THEN 11 WHEN 'SETTLEMENT_CONFIRMED' THEN 12
        WHEN 'PAID' THEN 13 ELSE 99 END
    `).bind(...params).all();

    return c.json({ funnel: result.results });
  });
}
