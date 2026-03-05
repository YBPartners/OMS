// ================================================================
// 다하다 OMS — 감사 로그 조회 API v5.5
// SUPER_ADMIN, HQ_OPERATOR, AUDITOR만 접근 가능
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { normalizePagination } from '../lib/validators';

const auditRoutes = new Hono<Env>();

// ─── 감사 로그 목록 조회 ───
auditRoutes.get('/', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const { page, limit, offset } = normalizePagination(c.req.query('page'), c.req.query('limit'));
  const entity_type = c.req.query('entity_type') || '';
  const action = c.req.query('action') || '';
  const actor_id = c.req.query('actor_id') || '';
  const from = c.req.query('from') || '';
  const to = c.req.query('to') || '';
  const search = c.req.query('search') || '';
  const entity_id = c.req.query('entity_id') || '';

  let where = '1=1';
  const binds: any[] = [];

  if (entity_type) {
    where += ' AND al.entity_type = ?';
    binds.push(entity_type);
  }
  if (action) {
    where += ' AND al.action LIKE ?';
    binds.push(`%${action}%`);
  }
  if (actor_id) {
    where += ' AND al.actor_id = ?';
    binds.push(Number(actor_id));
  }
  if (entity_id) {
    where += ' AND al.entity_id = ?';
    binds.push(Number(entity_id));
  }
  if (from) {
    where += ' AND al.created_at >= ?';
    binds.push(from);
  }
  if (to) {
    where += " AND al.created_at <= ? || ' 23:59:59'";
    binds.push(to);
  }
  if (search) {
    where += ' AND (al.detail_json LIKE ? OR al.action LIKE ? OR u.name LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // 총 건수
  const countSql = `
    SELECT COUNT(*) as total FROM audit_logs al
    LEFT JOIN users u ON al.actor_id = u.user_id
    WHERE ${where}
  `;
  const countResult = await db.prepare(countSql).bind(...binds).first();
  const total = (countResult as any)?.total || 0;

  // 로그 목록
  const dataSql = `
    SELECT al.log_id, al.entity_type, al.entity_id, al.action, al.actor_id,
           al.detail_json, al.ip_address, al.created_at,
           u.name AS actor_name, u.login_id AS actor_login_id,
           o.name AS actor_org_name
    FROM audit_logs al
    LEFT JOIN users u ON al.actor_id = u.user_id
    LEFT JOIN organizations o ON u.org_id = o.org_id
    WHERE ${where}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const dataResult = await db.prepare(dataSql).bind(...binds, limit, offset).all();

  return c.json({
    logs: dataResult.results,
    total,
    page,
    limit,
  });
});

// ─── 감사 로그 통계 (entity_type별, action별 집계) ───
auditRoutes.get('/stats', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const from = c.req.query('from') || '';
  const to = c.req.query('to') || '';

  let dateWhere = '1=1';
  const binds: any[] = [];
  if (from) { dateWhere += ' AND created_at >= ?'; binds.push(from); }
  if (to) { dateWhere += " AND created_at <= ? || ' 23:59:59'"; binds.push(to); }

  // entity_type별 집계
  const byEntity = await db.prepare(`
    SELECT entity_type, COUNT(*) as count FROM audit_logs WHERE ${dateWhere}
    GROUP BY entity_type ORDER BY count DESC
  `).bind(...binds).all();

  // action별 상위 20
  const byAction = await db.prepare(`
    SELECT action, COUNT(*) as count FROM audit_logs WHERE ${dateWhere}
    GROUP BY action ORDER BY count DESC LIMIT 20
  `).bind(...binds).all();

  // actor별 상위 10
  const byActor = await db.prepare(`
    SELECT al.actor_id, u.name AS actor_name, COUNT(*) as count 
    FROM audit_logs al LEFT JOIN users u ON al.actor_id = u.user_id
    WHERE ${dateWhere.replace(/created_at/g, 'al.created_at')}
    GROUP BY al.actor_id ORDER BY count DESC LIMIT 10
  `).bind(...binds).all();

  // 일별 추이 (최근 30일)
  const daily = await db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count FROM audit_logs
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30
  `).all();

  // 총 건수
  const totalResult = await db.prepare(`SELECT COUNT(*) as total FROM audit_logs WHERE ${dateWhere}`).bind(...binds).first();

  return c.json({
    total: (totalResult as any)?.total || 0,
    by_entity: byEntity.results,
    by_action: byAction.results,
    by_actor: byActor.results,
    daily: daily.results,
  });
});

// ─── 감사 로그 상세 ───
auditRoutes.get('/:log_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const logId = Number(c.req.param('log_id'));

  const log = await db.prepare(`
    SELECT al.*, u.name AS actor_name, u.login_id AS actor_login_id,
           o.name AS actor_org_name
    FROM audit_logs al
    LEFT JOIN users u ON al.actor_id = u.user_id
    LEFT JOIN organizations o ON u.org_id = o.org_id
    WHERE al.log_id = ?
  `).bind(logId).first();

  if (!log) return c.json({ error: '로그를 찾을 수 없습니다.' }, 404);

  return c.json({ log });
});

export default auditRoutes;
