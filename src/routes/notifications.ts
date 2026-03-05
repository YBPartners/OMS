// ================================================================
// 와이비 OMS — 알림 API v10.0
// 사용자별 알림 조회, 읽음 처리, 삭제, 알림 설정
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { normalizePagination } from '../lib/validators';

const notifications = new Hono<Env>();

// ─── 내 알림 목록 ───
notifications.get('/', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { is_read, type, page, limit } = c.req.query();
  const pg = normalizePagination(page, limit, 50);

  let query = 'SELECT * FROM notifications WHERE recipient_user_id = ?';
  const params: any[] = [user.user_id];

  if (is_read !== undefined && is_read !== '') {
    query += ' AND is_read = ?';
    params.push(is_read === 'true' || is_read === '1' ? 1 : 0);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  // Count
  const countSql = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await db.prepare(countSql).bind(...params).first();

  // 읽지 않은 알림 수
  const unreadResult = await db.prepare(
    'SELECT COUNT(*) as cnt FROM notifications WHERE recipient_user_id = ? AND is_read = 0'
  ).bind(user.user_id).first();

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const result = await db.prepare(query).bind(...params, pg.limit, pg.offset).all();

  return c.json({
    notifications: result.results,
    total: (countResult as any)?.total || 0,
    unread_count: (unreadResult as any)?.cnt || 0,
    page: pg.page,
    limit: pg.limit,
  });
});

// ─── 읽지 않은 알림 수 (뱃지용) ───
notifications.get('/unread-count', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;

  const result = await db.prepare(
    'SELECT COUNT(*) as cnt FROM notifications WHERE recipient_user_id = ? AND is_read = 0'
  ).bind(user.user_id).first();

  return c.json({ unread_count: (result as any)?.cnt || 0 });
});

// ─── 알림 읽음 처리 (단건) ───
notifications.patch('/:id/read', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const id = Number(c.req.param('id'));

  const notif = await db.prepare(
    'SELECT id FROM notifications WHERE id = ? AND recipient_user_id = ?'
  ).bind(id, user.user_id).first();
  if (!notif) return c.json({ error: '알림을 찾을 수 없습니다.' }, 404);

  await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(id).run();

  return c.json({ ok: true });
});

// ─── 전체 읽음 처리 ───
notifications.post('/read-all', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;

  const result = await db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE recipient_user_id = ? AND is_read = 0'
  ).bind(user.user_id).run();

  return c.json({ ok: true, updated: result.meta.changes || 0 });
});

// ─── 알림 삭제 (단건) ───
notifications.delete('/:id', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const id = Number(c.req.param('id'));

  const notif = await db.prepare(
    'SELECT id FROM notifications WHERE id = ? AND recipient_user_id = ?'
  ).bind(id, user.user_id).first();
  if (!notif) return c.json({ error: '알림을 찾을 수 없습니다.' }, 404);

  await db.prepare('DELETE FROM notifications WHERE id = ?').bind(id).run();

  return c.json({ ok: true });
});

// ─── 읽은 알림 일괄 삭제 ───
notifications.delete('/', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;

  const result = await db.prepare(
    'DELETE FROM notifications WHERE recipient_user_id = ? AND is_read = 1'
  ).bind(user.user_id).run();

  return c.json({ ok: true, deleted: result.meta.changes || 0 });
});

// ─── 알림 설정 조회 ───
notifications.get('/preferences', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;

  let prefs = await db.prepare(
    'SELECT * FROM notification_preferences WHERE user_id = ?'
  ).bind(user.user_id).first();

  if (!prefs) {
    // 기본 설정 생성
    await db.prepare(
      'INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)'
    ).bind(user.user_id).run();
    prefs = await db.prepare(
      'SELECT * FROM notification_preferences WHERE user_id = ?'
    ).bind(user.user_id).first();
  }

  return c.json({ preferences: prefs });
});

// ─── 알림 설정 업데이트 ───
notifications.put('/preferences', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const body = await c.req.json();

  const allowed = [
    'notify_order_status', 'notify_assignment', 'notify_review',
    'notify_settlement', 'notify_signup', 'notify_system',
    'push_enabled', 'sound_enabled'
  ];

  const updates: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(body[key] ? 1 : 0);
    }
  }

  if (updates.length === 0) {
    return c.json({ error: '변경할 설정이 없습니다.' }, 400);
  }

  // Upsert
  await db.prepare(
    'INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)'
  ).bind(user.user_id).run();

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(user.user_id);

  await db.prepare(
    `UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = ?`
  ).bind(...values).run();

  const updated = await db.prepare(
    'SELECT * FROM notification_preferences WHERE user_id = ?'
  ).bind(user.user_id).first();

  return c.json({ ok: true, preferences: updated });
});

export default notifications;
