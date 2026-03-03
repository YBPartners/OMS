import { Hono } from 'hono';
import type { Env, OrderStatus } from '../types';
import { requireAuth, requireHQ, writeStatusHistory, writeAuditLog } from '../middleware/auth';

const orders = new Hono<Env>();

// ─── 주문 목록 조회 (스코프 기반) ───
orders.get('/', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { status, page = '1', limit = '20', from, to, search, region_org_id, team_leader_id } = c.req.query();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;
  const conditions: string[] = [];
  const params: any[] = [];

  // 스코프 제한
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
  `).bind(...params, limitNum, offset).all();

  return c.json({ orders: result.results, total: (countResult as any)?.total || 0, page: pageNum, limit: limitNum });
});

// ─── 주문 상세 ───
orders.get('/:order_id', async (c) => {
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

  // 이력
  const history = await db.prepare(`
    SELECT h.*, u.name as actor_name FROM order_status_history h
    LEFT JOIN users u ON h.actor_id = u.user_id WHERE h.order_id = ? ORDER BY h.created_at DESC
  `).bind(orderId).all();

  // 보고서
  const reports = await db.prepare(`
    SELECT wr.*, u.name as team_leader_name FROM work_reports wr
    JOIN users u ON wr.team_leader_id = u.user_id WHERE wr.order_id = ? ORDER BY wr.version DESC
  `).bind(orderId).all();

  // 검수
  const reviews = await db.prepare(`
    SELECT rv.*, u.name as reviewer_name FROM reviews rv
    JOIN users u ON rv.reviewer_id = u.user_id WHERE rv.order_id = ? ORDER BY rv.reviewed_at DESC
  `).bind(orderId).all();

  // 사진 (최신 보고서)
  let photos: any[] = [];
  if (reports.results.length > 0) {
    const latestReportId = (reports.results[0] as any).report_id;
    const photoResult = await db.prepare('SELECT * FROM work_report_photos WHERE report_id = ?').bind(latestReportId).all();
    photos = photoResult.results;
  }

  return c.json({ order, history: history.results, reports: reports.results, reviews: reviews.results, photos });
});

// ─── 주문 수동 등록 ───
orders.post('/', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청 형식입니다.' }, 400); }

  // 필수 필드 검증
  if (!body.address_text) return c.json({ error: '주소(address_text)는 필수입니다.' }, 400);
  if (body.base_amount !== undefined && (isNaN(Number(body.base_amount)) || Number(body.base_amount) < 0)) {
    return c.json({ error: '금액은 0 이상의 숫자여야 합니다.' }, 400);
  }

  // fingerprint 생성
  const fpData = `${body.address_text}|${body.requested_date}|${body.service_type || 'DEFAULT'}|${body.base_amount || 0}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(fpData));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 중복 체크
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
orders.post('/import', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const body = await c.req.json();
  const rows = body.orders || [];

  // 배치 생성
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
      // fingerprint
      const fpData = `${row.address_text}|${row.requested_date}|${row.service_type || 'DEFAULT'}|${row.base_amount || 0}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(fpData));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

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

// ─── 자동 배분 실행 ───
orders.post('/distribute', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;

  // 현재 활성 배분 정책
  const policy = await db.prepare('SELECT * FROM distribution_policies WHERE is_active = 1 ORDER BY version DESC LIMIT 1').first();
  if (!policy) return c.json({ error: '활성 배분 정책이 없습니다.' }, 400);

  // RECEIVED 또는 VALIDATED 상태인 주문 중 admin_dong_code가 있는 것
  // 먼저 RECEIVED → VALIDATED 자동 전환
  await db.prepare(`UPDATE orders SET status = 'VALIDATED', updated_at = datetime('now') WHERE status = 'RECEIVED' AND address_text IS NOT NULL AND admin_dong_code IS NOT NULL`).run();

  const pendingOrders = await db.prepare(`
    SELECT o.order_id, o.admin_dong_code, o.address_text
    FROM orders o
    LEFT JOIN order_distributions od ON o.order_id = od.order_id AND od.status = 'ACTIVE'
    WHERE o.status IN ('VALIDATED', 'DISTRIBUTION_PENDING') AND od.distribution_id IS NULL
    ORDER BY o.created_at ASC
  `).all();

  // 행정동→지역법인 매핑 로드
  const mappings = await db.prepare(`
    SELECT ot.org_id, t.admin_dong_code FROM org_territories ot
    JOIN territories t ON ot.territory_id = t.territory_id
    WHERE (ot.effective_to IS NULL OR ot.effective_to > datetime('now'))
  `).all();

  const dongToOrg: Record<string, number> = {};
  for (const m of mappings.results as any[]) {
    dongToOrg[m.admin_dong_code] = m.org_id;
  }

  let distributed = 0;
  let pending = 0;
  const results: any[] = [];

  for (const order of pendingOrders.results as any[]) {
    const regionOrgId = dongToOrg[order.admin_dong_code];
    
    if (regionOrgId) {
      await db.prepare(`
        INSERT INTO order_distributions (order_id, region_org_id, distributed_by, distribution_policy_version, status)
        VALUES (?, ?, ?, ?, 'ACTIVE')
      `).bind(order.order_id, regionOrgId, user.user_id, policy.version).run();
      
      await db.prepare(`UPDATE orders SET status = 'DISTRIBUTED', updated_at = datetime('now') WHERE order_id = ?`).bind(order.order_id).run();
      await writeStatusHistory(db, { order_id: order.order_id, from_status: 'VALIDATED', to_status: 'DISTRIBUTED', actor_id: user.user_id, note: `자동배분 → org_id:${regionOrgId}` });
      
      distributed++;
      results.push({ order_id: order.order_id, region_org_id: regionOrgId, result: 'DISTRIBUTED' });
    } else {
      await db.prepare(`UPDATE orders SET status = 'DISTRIBUTION_PENDING', updated_at = datetime('now') WHERE order_id = ?`).bind(order.order_id).run();
      await writeStatusHistory(db, { order_id: order.order_id, from_status: 'VALIDATED', to_status: 'DISTRIBUTION_PENDING', actor_id: user.user_id, note: '행정동 매칭 실패' });
      
      pending++;
      results.push({ order_id: order.order_id, result: 'DISTRIBUTION_PENDING', reason: '행정동 매칭 실패' });
    }
  }

  // 통계 업데이트
  for (const r of results.filter(r => r.result === 'DISTRIBUTED')) {
    const today = new Date().toISOString().split('T')[0];
    await db.prepare(`
      INSERT INTO region_daily_stats (date, region_org_id, intake_count, updated_at)
      VALUES (?, ?, 1, datetime('now'))
      ON CONFLICT(date, region_org_id) DO UPDATE SET intake_count = intake_count + 1, updated_at = datetime('now')
    `).bind(today, r.region_org_id).run();
  }

  return c.json({ distributed, pending, total: pendingOrders.results.length, results });
});

// ─── 수동 배분/재배분 ───
orders.patch('/:order_id/distribution', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const orderId = Number(c.req.param('order_id'));
  const { region_org_id } = await c.req.json();

  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

  // 기존 배분 REASSIGNED 처리
  await db.prepare(`UPDATE order_distributions SET status = 'REASSIGNED' WHERE order_id = ? AND status = 'ACTIVE'`).bind(orderId).run();

  const policy = await db.prepare('SELECT version FROM distribution_policies WHERE is_active = 1 ORDER BY version DESC LIMIT 1').first();
  
  await db.prepare(`
    INSERT INTO order_distributions (order_id, region_org_id, distributed_by, distribution_policy_version, status)
    VALUES (?, ?, ?, ?, 'ACTIVE')
  `).bind(orderId, region_org_id, user.user_id, policy?.version || 1).run();

  await db.prepare(`UPDATE orders SET status = 'DISTRIBUTED', updated_at = datetime('now') WHERE order_id = ?`).bind(orderId).run();
  await writeStatusHistory(db, { order_id: orderId, from_status: order.status as string, to_status: 'DISTRIBUTED', actor_id: user.user_id, note: `수동 배분 → org_id:${region_org_id}` });

  return c.json({ ok: true, order_id: orderId, region_org_id });
});

// ─── 팀장 배정 (칸반 드래그앤드롭) ───
orders.post('/:order_id/assign', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const orderId = Number(c.req.param('order_id'));
  const { team_leader_id } = await c.req.json();

  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

  // REGION 스코프 체크
  if (user.org_type === 'REGION') {
    const dist = await db.prepare('SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = ?').bind(orderId, 'ACTIVE').first();
    if (!dist || dist.region_org_id !== user.org_id) return c.json({ error: '해당 주문에 대한 권한이 없습니다.' }, 403);
  }

  // 기존 할당 REASSIGNED
  await db.prepare(`UPDATE order_assignments SET status = 'REASSIGNED', updated_at = datetime('now') WHERE order_id = ? AND status NOT IN ('REASSIGNED','SETTLEMENT_CONFIRMED')`).bind(orderId).run();

  await db.prepare(`
    INSERT INTO order_assignments (order_id, team_leader_id, assigned_by, status) VALUES (?, ?, ?, 'ASSIGNED')
  `).bind(orderId, team_leader_id, user.user_id).run();

  await db.prepare(`UPDATE orders SET status = 'ASSIGNED', updated_at = datetime('now') WHERE order_id = ?`).bind(orderId).run();
  await writeStatusHistory(db, { order_id: orderId, from_status: order.status as string, to_status: 'ASSIGNED', actor_id: user.user_id, note: `팀장 배정 → user_id:${team_leader_id}` });

  // 팀장 통계 업데이트
  const today = new Date().toISOString().split('T')[0];
  await db.prepare(`
    INSERT INTO team_leader_daily_stats (date, team_leader_id, intake_count, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(date, team_leader_id) DO UPDATE SET intake_count = intake_count + 1, updated_at = datetime('now')
  `).bind(today, team_leader_id).run();

  return c.json({ ok: true, order_id: orderId, team_leader_id });
});

// ─── 작업 시작 ───
orders.post('/:order_id/start', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const orderId = Number(c.req.param('order_id'));

  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
  if (order.status !== 'ASSIGNED') return c.json({ error: `현재 상태(${order.status})에서는 작업 시작이 불가합니다.` }, 400);

  await db.prepare(`UPDATE orders SET status = 'IN_PROGRESS', updated_at = datetime('now') WHERE order_id = ?`).bind(orderId).run();
  await db.prepare(`UPDATE order_assignments SET status = 'IN_PROGRESS', updated_at = datetime('now') WHERE order_id = ? AND status = 'ASSIGNED'`).bind(orderId).run();
  await writeStatusHistory(db, { order_id: orderId, from_status: 'ASSIGNED', to_status: 'IN_PROGRESS', actor_id: user.user_id });

  return c.json({ ok: true });
});

// ─── 보고서 제출 ───
orders.post('/:order_id/reports', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const orderId = Number(c.req.param('order_id'));
  const body = await c.req.json();

  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
  if (!['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'].includes(order.status as string)) {
    return c.json({ error: `현재 상태(${order.status})에서는 보고서 제출이 불가합니다.` }, 400);
  }

  // 현재 활성 보고서 정책
  const reportPolicy = await db.prepare(`SELECT * FROM report_policies WHERE service_type = ? AND is_active = 1 ORDER BY version DESC LIMIT 1`).bind(order.service_type || 'DEFAULT').first();

  // 기존 보고서 버전 확인
  const prevReport = await db.prepare('SELECT MAX(version) as max_ver FROM work_reports WHERE order_id = ?').bind(orderId).first();
  const newVersion = ((prevReport as any)?.max_ver || 0) + 1;

  const reportResult = await db.prepare(`
    INSERT INTO work_reports (order_id, team_leader_id, policy_id_snapshot, checklist_json, note, version)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(orderId, user.user_id, reportPolicy?.policy_id || null, JSON.stringify(body.checklist || {}), body.note || null, newVersion).run();
  const reportId = reportResult.meta.last_row_id;

  // 사진 등록
  if (body.photos && Array.isArray(body.photos)) {
    for (const photo of body.photos) {
      await db.prepare(`
        INSERT INTO work_report_photos (report_id, category, file_url, file_hash) VALUES (?, ?, ?, ?)
      `).bind(reportId, photo.category, photo.file_url, photo.file_hash || null).run();
    }
  }

  await db.prepare(`UPDATE orders SET status = 'SUBMITTED', updated_at = datetime('now') WHERE order_id = ?`).bind(orderId).run();
  await db.prepare(`UPDATE order_assignments SET status = 'SUBMITTED', updated_at = datetime('now') WHERE order_id = ? AND status IN ('IN_PROGRESS','ASSIGNED')`).bind(orderId).run();
  await writeStatusHistory(db, { order_id: orderId, from_status: order.status as string, to_status: 'SUBMITTED', actor_id: user.user_id, note: `보고서 v${newVersion} 제출` });

  // 통계 업데이트
  const today = new Date().toISOString().split('T')[0];
  await db.prepare(`
    INSERT INTO team_leader_daily_stats (date, team_leader_id, submitted_count, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(date, team_leader_id) DO UPDATE SET submitted_count = submitted_count + 1, updated_at = datetime('now')
  `).bind(today, user.user_id).run();

  return c.json({ ok: true, report_id: reportId, version: newVersion });
});

// ─── 1차 검수 (REGION) ───
orders.post('/:order_id/review/region', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const orderId = Number(c.req.param('order_id'));
  const { result, comment, reason_codes } = await c.req.json();

  if (!['APPROVE', 'REJECT'].includes(result)) return c.json({ error: '결과는 APPROVE 또는 REJECT입니다.' }, 400);

  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
  if (order.status !== 'SUBMITTED') return c.json({ error: `현재 상태(${order.status})에서는 지역 검수가 불가합니다.` }, 400);

  // 최신 보고서
  const report = await db.prepare('SELECT * FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1').bind(orderId).first();
  if (!report) return c.json({ error: '보고서가 없습니다.' }, 404);

  await db.prepare(`
    INSERT INTO reviews (report_id, order_id, stage, reviewer_id, result, reason_codes_json, comment)
    VALUES (?, ?, 'REGION', ?, ?, ?, ?)
  `).bind(report.report_id, orderId, user.user_id, result, JSON.stringify(reason_codes || []), comment || null).run();

  const newStatus: OrderStatus = result === 'APPROVE' ? 'REGION_APPROVED' : 'REGION_REJECTED';
  await db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_id = ?`).bind(newStatus, orderId).run();
  await db.prepare(`UPDATE order_assignments SET status = ?, updated_at = datetime('now') WHERE order_id = ? AND status = 'SUBMITTED'`).bind(newStatus, orderId).run();
  await writeStatusHistory(db, { order_id: orderId, from_status: 'SUBMITTED', to_status: newStatus, actor_id: user.user_id, note: comment });

  // 통계
  const today = new Date().toISOString().split('T')[0];
  if (result === 'APPROVE') {
    await db.prepare(`
      INSERT INTO region_daily_stats (date, region_org_id, region_approved_count, updated_at)
      VALUES (?, ?, 1, datetime('now'))
      ON CONFLICT(date, region_org_id) DO UPDATE SET region_approved_count = region_approved_count + 1, updated_at = datetime('now')
    `).bind(today, user.org_id).run();
  }

  return c.json({ ok: true, new_status: newStatus });
});

// ─── 2차 최종 검수 (HQ) ───
orders.post('/:order_id/review/hq', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const orderId = Number(c.req.param('order_id'));
  const { result, comment, reason_codes } = await c.req.json();

  if (!['APPROVE', 'REJECT'].includes(result)) return c.json({ error: '결과는 APPROVE 또는 REJECT입니다.' }, 400);

  const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
  if (order.status !== 'REGION_APPROVED') return c.json({ error: `현재 상태(${order.status})에서는 HQ 검수가 불가합니다. 지역 승인 후 가능합니다.` }, 400);

  const report = await db.prepare('SELECT * FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1').bind(orderId).first();
  if (!report) return c.json({ error: '보고서가 없습니다.' }, 404);

  await db.prepare(`
    INSERT INTO reviews (report_id, order_id, stage, reviewer_id, result, reason_codes_json, comment)
    VALUES (?, ?, 'HQ', ?, ?, ?, ?)
  `).bind(report.report_id, orderId, user.user_id, result, JSON.stringify(reason_codes || []), comment || null).run();

  const newStatus: OrderStatus = result === 'APPROVE' ? 'HQ_APPROVED' : 'HQ_REJECTED';
  await db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_id = ?`).bind(newStatus, orderId).run();
  await db.prepare(`UPDATE order_assignments SET status = ?, updated_at = datetime('now') WHERE order_id = ? AND status = 'REGION_APPROVED'`).bind(newStatus, orderId).run();
  await writeStatusHistory(db, { order_id: orderId, from_status: 'REGION_APPROVED', to_status: newStatus, actor_id: user.user_id, note: comment });

  // 통계
  const today = new Date().toISOString().split('T')[0];
  if (result === 'APPROVE') {
    // 배분된 지역 조회
    const dist = await db.prepare('SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = ?').bind(orderId, 'ACTIVE').first();
    if (dist) {
      await db.prepare(`
        INSERT INTO region_daily_stats (date, region_org_id, hq_approved_count, updated_at)
        VALUES (?, ?, 1, datetime('now'))
        ON CONFLICT(date, region_org_id) DO UPDATE SET hq_approved_count = hq_approved_count + 1, updated_at = datetime('now')
      `).bind(today, dist.region_org_id).run();
    }
    // 팀장 통계
    const assign = await db.prepare('SELECT team_leader_id FROM order_assignments WHERE order_id = ? AND status = ?').bind(orderId, newStatus).first();
    if (assign) {
      await db.prepare(`
        INSERT INTO team_leader_daily_stats (date, team_leader_id, hq_approved_count, updated_at)
        VALUES (?, ?, 1, datetime('now'))
        ON CONFLICT(date, team_leader_id) DO UPDATE SET hq_approved_count = hq_approved_count + 1, updated_at = datetime('now')
      `).bind(today, assign.team_leader_id).run();
    }
  }

  return c.json({ ok: true, new_status: newStatus });
});

// ─── 퍼널 현황 (대시보드) ───
orders.get('/stats/funnel', async (c) => {
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

export default orders;
