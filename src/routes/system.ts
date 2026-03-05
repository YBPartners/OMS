// ================================================================
// 와이비 OMS — 시스템 관리 API v14.0
// 백업/복원, 데이터 임포트, 글로벌 검색, 주문 타임라인, 푸시 알림
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { writeAuditLog } from '../lib/audit';

const system = new Hono<Env>();

// ─── 시스템 정보 ───
system.get('/info', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const [userCount, orderCount, orgCount, sessionCount, notifCount, migCount] = await Promise.all([
    db.prepare('SELECT COUNT(*) as cnt FROM users').first(),
    db.prepare('SELECT COUNT(*) as cnt FROM orders').first(),
    db.prepare('SELECT COUNT(*) as cnt FROM organizations').first(),
    db.prepare("SELECT COUNT(*) as cnt FROM sessions WHERE expires_at > datetime('now')").first(),
    db.prepare("SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0").first(),
    db.prepare('SELECT COUNT(*) as cnt FROM d1_migrations').first(),
  ]);

  return c.json({
    system: {
      version: '14.0.0',
      name: '와이비 OMS',
      platform: 'Cloudflare Workers + D1',
    },
    stats: {
      users: (userCount as any)?.cnt || 0,
      orders: (orderCount as any)?.cnt || 0,
      organizations: (orgCount as any)?.cnt || 0,
      active_sessions: (sessionCount as any)?.cnt || 0,
      unread_notifications: (notifCount as any)?.cnt || 0,
      applied_migrations: (migCount as any)?.cnt || 0,
    },
  });
});

// ─── 데이터 백업 (테이블별 행 수 + 스키마 정보) ───
system.get('/backup-info', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  // D1 local에서 sqlite_master 접근 불가하므로 알려진 테이블 목록 사용
  const knownTables = [
    'organizations','users','roles','user_roles','territories','org_territories',
    'distribution_policies','report_policies','commission_policies','metrics_policies',
    'order_import_batches','orders','order_distributions','order_assignments',
    'order_status_history','work_reports','work_report_photos','reviews',
    'settlement_runs','settlements','team_leader_ledger_daily',
    'reconciliation_runs','reconciliation_issues','region_daily_stats',
    'team_leader_daily_stats','audit_logs','sessions','phone_verifications',
    'admin_regions','org_region_mappings','signup_requests','signup_request_regions',
    'region_add_requests','team_distributor_mappings','notifications',
    'notification_preferences','order_channels','agency_team_mappings','agency_onboarding',
  ];

  const tableInfo = [];
  for (const name of knownTables) {
    try {
      const count = await db.prepare(`SELECT COUNT(*) as cnt FROM ${name}`).first() as any;
      tableInfo.push({ name, row_count: count?.cnt || 0 });
    } catch { /* table may not exist */ }
  }

  return c.json({
    backup_info: {
      timestamp: new Date().toISOString(),
      tables: tableInfo,
      total_rows: tableInfo.reduce((s, t) => s + t.row_count, 0),
    },
  });
});

// ─── 테이블 데이터 내보내기 (SUPER_ADMIN 전용) ───
system.get('/export/:table', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const table = c.req.param('table');
  const limit = Math.min(Number(c.req.query('limit') || 1000), 5000);
  const offset = Number(c.req.query('offset') || 0);

  // 안전한 테이블명 검증 (화이트리스트)
  const allowedTables = [
    'organizations','users','roles','user_roles','orders','order_distributions',
    'order_assignments','order_status_history','work_reports','reviews',
    'settlement_runs','settlements','audit_logs','notifications','order_channels',
    'agency_team_mappings','agency_onboarding','commission_policies',
  ];
  if (!allowedTables.includes(table)) return c.json({ error: '유효하지 않은 테이블입니다.' }, 400);

  const result = await db.prepare(`SELECT * FROM ${table} LIMIT ? OFFSET ?`).bind(limit, offset).all();
  const countRes = await db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first() as any;

  await writeAuditLog(db, {
    entity_type: 'SYSTEM', entity_id: 0, action: 'DATA_EXPORT',
    actor_id: c.get('user')!.user_id,
    detail_json: JSON.stringify({ table, limit, offset, rows: result.results.length }),
  });

  return c.json({ table, rows: result.results, total: countRes?.cnt || 0, limit, offset });
});

// ─── 세션 관리 ───
system.get('/sessions', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const result = await db.prepare(`
    SELECT s.session_id, s.user_id, s.created_at, s.expires_at,
           u.name as user_name, u.login_id
    FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    WHERE s.expires_at > datetime('now')
    ORDER BY s.created_at DESC
    LIMIT 50
  `).all();

  return c.json({ sessions: result.results });
});

system.delete('/sessions/:session_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const sid = c.req.param('session_id');
  await db.prepare('DELETE FROM sessions WHERE session_id = ?').bind(sid).run();

  await writeAuditLog(db, {
    entity_type: 'SESSION', entity_id: 0, action: 'SESSION_REVOKE',
    actor_id: c.get('user')!.user_id,
    detail_json: JSON.stringify({ revoked_session: sid }),
  });

  return c.json({ ok: true, message: '세션이 강제 종료되었습니다.' });
});

system.delete('/sessions', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const user = c.get('user')!;
  const currentSid = c.req.header('X-Session-Id') || '';

  // 자기 세션 제외하고 모두 삭제
  const result = await db.prepare("DELETE FROM sessions WHERE session_id != ? AND expires_at > datetime('now')")
    .bind(currentSid).run();

  await writeAuditLog(db, {
    entity_type: 'SYSTEM', entity_id: 0, action: 'SESSION_PURGE',
    actor_id: user.user_id,
    detail_json: JSON.stringify({ purged_count: result.meta.changes }),
  });

  return c.json({ ok: true, purged: result.meta.changes });
});

// ─── 글로벌 검색 ───
system.get('/search', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const db = c.env.DB;
  const user = c.get('user')!;
  const q = c.req.query('q')?.trim();
  if (!q || q.length < 2) return c.json({ results: [], message: '2자 이상 입력하세요.' });

  const keyword = `%${q}%`;
  const results: any[] = [];

  // 주문 검색
  const orders = await db.prepare(`
    SELECT order_id, external_order_no, customer_name, address_text, status, base_amount
    FROM orders
    WHERE customer_name LIKE ? OR external_order_no LIKE ? OR address_text LIKE ?
       OR CAST(order_id AS TEXT) = ?
    ORDER BY created_at DESC LIMIT 10
  `).bind(keyword, keyword, keyword, q).all();

  for (const o of orders.results as any[]) {
    results.push({
      type: 'order', id: o.order_id,
      title: `#${o.order_id} ${o.customer_name || ''}`,
      subtitle: o.address_text?.substring(0, 50) || o.external_order_no || '',
      status: o.status, amount: o.base_amount,
      action: `orders`, filter: { order_id: o.order_id },
    });
  }

  // 사용자 검색 (HQ/REGION만)
  if (user.org_type === 'HQ' || user.org_type === 'REGION') {
    const users = await db.prepare(`
      SELECT u.user_id, u.name, u.login_id, u.phone, u.status, o.name as org_name
      FROM users u JOIN organizations o ON u.org_id = o.org_id
      WHERE u.name LIKE ? OR u.login_id LIKE ? OR u.phone LIKE ?
      ORDER BY u.name LIMIT 8
    `).bind(keyword, keyword, keyword).all();

    for (const u of users.results as any[]) {
      results.push({
        type: 'user', id: u.user_id,
        title: `${u.name} (${u.login_id})`,
        subtitle: `${u.org_name} · ${u.phone || ''}`,
        status: u.status,
        action: 'hr-management',
      });
    }
  }

  // 조직 검색
  if (user.org_type === 'HQ') {
    const orgs = await db.prepare(`
      SELECT org_id, name, org_type, code
      FROM organizations
      WHERE name LIKE ? OR code LIKE ?
      ORDER BY name LIMIT 5
    `).bind(keyword, keyword).all();

    for (const o of orgs.results as any[]) {
      results.push({
        type: 'org', id: o.org_id,
        title: o.name,
        subtitle: `${o.org_type} · ${o.code || ''}`,
        action: 'hr-management', filter: { tab: 'orgs' },
      });
    }
  }

  return c.json({ results, query: q, total: results.length });
});

// ─── 주문 타임라인 (활동 이력) ───
system.get('/order-timeline/:order_id', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const db = c.env.DB;
  const orderId = Number(c.req.param('order_id'));
  if (isNaN(orderId)) return c.json({ error: '유효하지 않은 주문 ID입니다.' }, 400);

  // 감사 로그에서 주문 관련 이벤트 조회
  const auditLogs = await db.prepare(`
    SELECT al.*, u.name as actor_name
    FROM audit_logs al
    LEFT JOIN users u ON al.actor_id = u.user_id
    WHERE al.entity_type = 'ORDER' AND al.entity_id = ?
    ORDER BY al.created_at DESC LIMIT 50
  `).bind(orderId).all();

  // 주문 배분 이력
  const distributions = await db.prepare(`
    SELECT od.*, o.name as region_name
    FROM order_distributions od
    JOIN organizations o ON od.region_org_id = o.org_id
    WHERE od.order_id = ?
    ORDER BY od.distributed_at DESC
  `).bind(orderId).all();

  // 주문 배정 이력
  const assignments = await db.prepare(`
    SELECT oa.*, u.name as leader_name
    FROM order_assignments oa
    LEFT JOIN users u ON oa.team_leader_id = u.user_id
    WHERE oa.order_id = ?
    ORDER BY oa.assigned_at DESC
  `).bind(orderId).all();

  // 보고서
  const reports = await db.prepare(`
    SELECT r.*, u.name as leader_name
    FROM work_reports r
    LEFT JOIN users u ON r.team_leader_id = u.user_id
    WHERE r.order_id = ?
    ORDER BY r.created_at DESC
  `).bind(orderId).all();

  // 검수 이력
  const reviews = await db.prepare(`
    SELECT rv.*, u.name as reviewer_name
    FROM reviews rv
    LEFT JOIN users u ON rv.reviewer_id = u.user_id
    WHERE rv.report_id IN (SELECT report_id FROM work_reports WHERE order_id = ?)
    ORDER BY rv.reviewed_at DESC
  `).bind(orderId).all();

  // 정산 이력
  const settlements = await db.prepare(`
    SELECT s.*, u.name as leader_name
    FROM settlements s
    LEFT JOIN users u ON s.team_leader_id = u.user_id
    WHERE s.order_id = ?
    ORDER BY s.created_at DESC
  `).bind(orderId).all();

  // 타임라인 생성 (시간순 정렬)
  const timeline: any[] = [];

  for (const a of auditLogs.results as any[]) {
    timeline.push({
      type: 'audit', time: a.created_at,
      action: a.action, actor: a.actor_name || 'System',
      detail: a.detail_json ? JSON.parse(a.detail_json) : null,
    });
  }
  for (const d of distributions.results as any[]) {
    timeline.push({
      type: 'distribution', time: d.distributed_at || d.created_at,
      action: 'DISTRIBUTED', actor: d.region_name,
      detail: { region: d.region_name, status: d.status },
    });
  }
  for (const a of assignments.results as any[]) {
    timeline.push({
      type: 'assignment', time: a.assigned_at || a.created_at,
      action: 'ASSIGNED', actor: a.leader_name || '-',
      detail: { leader: a.leader_name, status: a.status },
    });
  }
  for (const r of reports.results as any[]) {
    timeline.push({
      type: 'report', time: r.created_at,
      action: 'REPORT_SUBMITTED', actor: r.leader_name || '-',
      detail: { checklist: r.checklist_json ? JSON.parse(r.checklist_json) : null },
    });
  }
  for (const rv of reviews.results as any[]) {
    timeline.push({
      type: 'review', time: rv.reviewed_at,
      action: rv.result === 'APPROVE' ? 'REVIEW_APPROVED' : 'REVIEW_REJECTED',
      actor: rv.reviewer_name || '-',
      detail: { stage: rv.stage, result: rv.result, comment: rv.comment },
    });
  }
  for (const s of settlements.results as any[]) {
    timeline.push({
      type: 'settlement', time: s.created_at,
      action: 'SETTLEMENT', actor: s.leader_name || '-',
      detail: { base: s.base_amount, commission: s.commission_amount, payable: s.payable_amount, status: s.status },
    });
  }

  // 시간 역순 정렬
  timeline.sort((a, b) => (b.time || '').localeCompare(a.time || ''));

  return c.json({ order_id: orderId, timeline, counts: {
    audit: auditLogs.results.length,
    distributions: distributions.results.length,
    assignments: assignments.results.length,
    reports: reports.results.length,
    reviews: reviews.results.length,
    settlements: settlements.results.length,
  }});
});

// ─── 데이터 임포트 (CSV/JSON 기반) ───
system.post('/import/:table', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const user = c.get('user')!;
  const table = c.req.param('table');
  const body = await c.req.json();
  const { rows, mode = 'insert' } = body; // mode: insert | upsert

  // 안전한 테이블명 검증 (화이트리스트)
  const importableTables: Record<string, string[]> = {
    orders: ['external_order_no', 'customer_name', 'customer_phone', 'address_text', 'service_type', 'base_amount', 'requested_date', 'memo'],
    users: ['login_id', 'name', 'phone', 'email', 'org_id'],
    organizations: ['name', 'org_type', 'code', 'parent_org_id'],
    commission_policies: ['org_id', 'service_type', 'commission_mode', 'commission_rate'],
  };

  if (!importableTables[table]) return c.json({ error: '임포트 불가능한 테이블입니다.' }, 400);
  if (!Array.isArray(rows) || rows.length === 0) return c.json({ error: '데이터가 비어있습니다.' }, 400);
  if (rows.length > 500) return c.json({ error: '최대 500행까지 임포트 가능합니다.' }, 400);

  const allowedCols = importableTables[table];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cols: string[] = [];
    const vals: any[] = [];

    for (const col of allowedCols) {
      if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
        cols.push(col);
        vals.push(row[col]);
      }
    }

    if (cols.length === 0) { skipped++; continue; }

    try {
      if (mode === 'upsert' && table === 'orders' && row.external_order_no) {
        // Upsert: 기존 주문 업데이트 또는 새 주문 삽입
        const existing = await db.prepare('SELECT order_id FROM orders WHERE external_order_no = ?').bind(row.external_order_no).first();
        if (existing) {
          const setClause = cols.filter(c => c !== 'external_order_no').map(c => `${c} = ?`).join(', ');
          const updateVals = vals.filter((_, idx) => cols[idx] !== 'external_order_no');
          if (setClause) {
            await db.prepare(`UPDATE orders SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE external_order_no = ?`)
              .bind(...updateVals, row.external_order_no).run();
          }
          imported++;
          continue;
        }
      }

      // 주문 기본값: status = 'RECEIVED'
      if (table === 'orders' && !cols.includes('status')) {
        cols.push('status');
        vals.push('RECEIVED');
      }

      const placeholders = cols.map(() => '?').join(',');
      const insertMode = mode === 'upsert' ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
      await db.prepare(`${insertMode} INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`).bind(...vals).run();
      imported++;
    } catch (e: any) {
      errors.push(`행 ${i + 1}: ${e.message}`);
      skipped++;
    }
  }

  await writeAuditLog(db, {
    entity_type: 'SYSTEM', entity_id: 0, action: 'DATA_IMPORT',
    actor_id: user.user_id,
    detail_json: JSON.stringify({ table, mode, total: rows.length, imported, skipped, errors: errors.slice(0, 5) }),
  });

  return c.json({ ok: true, table, mode, total: rows.length, imported, skipped, errors: errors.slice(0, 10) });
});

// ─── 스냅샷 백업 (전체 테이블 데이터 JSON) ───
system.get('/snapshot', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const user = c.get('user')!;
  const tables = (c.req.query('tables') || 'orders,users,organizations,settlements,commission_policies').split(',');

  const allowedTables = [
    'organizations', 'users', 'user_roles', 'orders', 'order_distributions',
    'order_assignments', 'work_reports', 'reviews', 'settlements', 'settlement_runs',
    'commission_policies', 'order_channels', 'agency_team_mappings', 'notifications',
  ];

  const snapshot: Record<string, any[]> = {};
  const meta: Record<string, number> = {};

  for (const table of tables) {
    const t = table.trim();
    if (!allowedTables.includes(t)) continue;
    try {
      const result = await db.prepare(`SELECT * FROM ${t} LIMIT 10000`).all();
      snapshot[t] = result.results;
      meta[t] = result.results.length;
    } catch { /* skip */ }
  }

  await writeAuditLog(db, {
    entity_type: 'SYSTEM', entity_id: 0, action: 'SNAPSHOT_CREATED',
    actor_id: user.user_id,
    detail_json: JSON.stringify({ tables: Object.keys(snapshot), meta }),
  });

  return c.json({
    snapshot,
    meta: {
      tables: meta,
      total_rows: Object.values(meta).reduce((a, b) => a + b, 0),
      created_at: new Date().toISOString(),
      version: '14.0.0',
    },
  });
});

// ─── 스냅샷 복원 (JSON → DB) ───
system.post('/snapshot/restore', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const user = c.get('user')!;
  const { snapshot, options } = await c.req.json();
  const clearBefore = options?.clear_before === true;

  if (!snapshot || typeof snapshot !== 'object') return c.json({ error: '유효하지 않은 스냅샷 데이터입니다.' }, 400);

  const restorableTables = [
    'organizations', 'users', 'user_roles', 'orders', 'order_distributions',
    'order_assignments', 'commission_policies', 'order_channels',
  ];

  const results: Record<string, { cleared: number; restored: number; errors: number }> = {};

  for (const [table, rows] of Object.entries(snapshot)) {
    if (!restorableTables.includes(table) || !Array.isArray(rows)) continue;

    let cleared = 0, restored = 0, errors = 0;

    if (clearBefore) {
      try {
        const res = await db.prepare(`DELETE FROM ${table}`).run();
        cleared = res.meta.changes || 0;
      } catch { /* skip */ }
    }

    for (const row of rows) {
      try {
        const cols = Object.keys(row).filter(k => row[k] !== undefined);
        const vals = cols.map(k => row[k]);
        const placeholders = cols.map(() => '?').join(',');
        await db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`).bind(...vals).run();
        restored++;
      } catch { errors++; }
    }

    results[table] = { cleared, restored, errors };
  }

  await writeAuditLog(db, {
    entity_type: 'SYSTEM', entity_id: 0, action: 'SNAPSHOT_RESTORED',
    actor_id: user.user_id,
    detail_json: JSON.stringify({ tables: Object.keys(results), results, clear_before: clearBefore }),
  });

  return c.json({ ok: true, results });
});

// ─── 푸시 알림 구독 저장 ───
system.post('/push/subscribe', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const db = c.env.DB;
  const user = c.get('user')!;
  const { subscription } = await c.req.json();
  if (!subscription?.endpoint) return c.json({ error: '유효하지 않은 구독 정보입니다.' }, 400);

  // notification_preferences 테이블의 push_subscription 컬럼에 저장
  await db.prepare(
    'INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)'
  ).bind(user.user_id).run();

  await db.prepare(
    'UPDATE notification_preferences SET push_enabled = 1, push_subscription = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
  ).bind(JSON.stringify(subscription), user.user_id).run();

  return c.json({ ok: true, message: '푸시 알림이 활성화되었습니다.' });
});

// ─── 푸시 알림 구독 해제 ───
system.post('/push/unsubscribe', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const db = c.env.DB;
  const user = c.get('user')!;

  await db.prepare(
    'UPDATE notification_preferences SET push_enabled = 0, push_subscription = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?'
  ).bind(user.user_id).run();

  return c.json({ ok: true, message: '푸시 알림이 비활성화되었습니다.' });
});

export default system;
