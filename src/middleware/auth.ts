// ================================================================
// 와이비 OMS — Auth Middleware v7.0
// v7.0: KV Cache 세션 검증 — D1 쿼리 최소화
// TEAM org_type 지원, 구조화 역할 검증
// Session Service 위임
// ================================================================

import { Context, Next } from 'hono';
import type { Env, RoleCode, OrgType, SessionUser } from '../types';
import { validateSession } from '../services/session-service';

// Re-export from lib for backward compatibility
export { writeAuditLog, writeStatusHistory } from '../lib/audit';

// ─── 세션 기반 인증 미들웨어 ───
export async function authMiddleware(c: Context<Env>, next: Next) {
  const sessionId = c.req.header('X-Session-Id') || getCookie(c, 'session_id');

  if (!sessionId) {
    c.set('user', null);
    return next();
  }

  try {
    // ★ v7.0: KV Cache 우선 조회 → miss 시 D1 fallback
    const result = await validateSession(c.env.DB, sessionId, c.env.SESSION_CACHE);

    if (!result.valid || !result.user) {
      c.set('user', null);
      return next();
    }

    c.set('user', result.user);
  } catch {
    c.set('user', null);
  }

  return next();
}

// ─── 인증 필수 미들웨어 ───
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

// ─── HQ만 허용 ───
export function requireHQ(c: Context<Env>) {
  const user = c.get('user');
  if (!user) return c.json({ error: '인증이 필요합니다.' }, 401);
  if (user.org_type !== 'HQ' && !user.roles.includes('SUPER_ADMIN')) {
    return c.json({ error: 'HQ 권한이 필요합니다.' }, 403);
  }
  return null;
}

// ─── HQ 또는 REGION 허용 ───
export function requireHQorRegion(c: Context<Env>) {
  const user = c.get('user');
  if (!user) return c.json({ error: '인증이 필요합니다.' }, 401);
  if (user.org_type === 'TEAM' && !user.roles.includes('SUPER_ADMIN')) {
    return c.json({ error: 'HQ 또는 총판 권한이 필요합니다.' }, 403);
  }
  return null;
}

// ─── SUPER_ADMIN만 허용 ───
export function requireSuperAdmin(c: Context<Env>) {
  const user = c.get('user');
  if (!user) return c.json({ error: '인증이 필요합니다.' }, 401);
  if (!user.roles.includes('SUPER_ADMIN')) {
    return c.json({ error: '총괄관리자 권한이 필요합니다.' }, 403);
  }
  return null;
}

// ─── 쿠키 파싱 헬퍼 ───
function getCookie(c: Context, name: string): string | undefined {
  const cookie = c.req.header('Cookie');
  if (!cookie) return undefined;
  const match = cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : undefined;
}
