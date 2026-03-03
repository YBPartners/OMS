import { Context, Next } from 'hono';
import type { Env, RoleCode, SessionUser } from '../types';

// Re-export from lib for backward compatibility
export { writeAuditLog, writeStatusHistory } from '../lib/audit';

// 세션 기반 인증 미들웨어
export async function authMiddleware(c: Context<Env>, next: Next) {
  const sessionId = c.req.header('X-Session-Id') || getCookie(c, 'session_id');
  
  if (!sessionId) {
    c.set('user', null);
    return next();
  }

  try {
    const db = c.env.DB;
    const session = await db.prepare(`
      SELECT s.user_id, s.expires_at, u.org_id, u.login_id, u.name, o.org_type, o.name as org_name
      FROM sessions s
      JOIN users u ON s.user_id = u.user_id
      JOIN organizations o ON u.org_id = o.org_id
      WHERE s.session_id = ? AND s.expires_at > datetime('now') AND u.status = 'ACTIVE'
    `).bind(sessionId).first();

    if (!session) {
      c.set('user', null);
      return next();
    }

    // 역할 조회
    const roles = await db.prepare(`
      SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?
    `).bind(session.user_id).all();

    const user: SessionUser = {
      user_id: session.user_id as number,
      org_id: session.org_id as number,
      org_type: session.org_type as 'HQ' | 'REGION',
      login_id: session.login_id as string,
      name: session.name as string,
      org_name: session.org_name as string,
      roles: roles.results.map((r: any) => r.code as RoleCode),
    };

    c.set('user', user);
  } catch {
    c.set('user', null);
  }

  return next();
}

// 인증 필수 미들웨어
export function requireAuth(c: Context<Env>, roles?: RoleCode[]) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '인증이 필요합니다.' }, 401);
  }
  if (roles && roles.length > 0) {
    const hasRole = user.roles.some((r: string) => roles.includes(r as RoleCode));
    if (!hasRole) {
      return c.json({ error: '권한이 없습니다.', required: roles, current: user.roles }, 403);
    }
  }
  return null;
}

// HQ만 허용
export function requireHQ(c: Context<Env>) {
  const user = c.get('user');
  if (!user) return c.json({ error: '인증이 필요합니다.' }, 401);
  if (user.org_type !== 'HQ' && !user.roles.includes('SUPER_ADMIN')) {
    return c.json({ error: 'HQ 권한이 필요합니다.' }, 403);
  }
  return null;
}

// 쿠키 파싱 헬퍼
function getCookie(c: Context, name: string): string | undefined {
  const cookie = c.req.header('Cookie');
  if (!cookie) return undefined;
  const match = cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : undefined;
}
