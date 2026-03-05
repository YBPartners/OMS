// ================================================================
// 다하다 OMS — 시스템 관리 API v13.0
// 백업/복원, 시스템 설정, 글로벌 검색, 주문 타임라인
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
      version: '13.0.0',
      name: '다하다 OMS',
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

export default system;
