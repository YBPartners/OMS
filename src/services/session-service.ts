// ================================================================
// 와이비 OMS — Session Service v2.0
// v2.0: KV Cache 레이어 추가 — 세션 검증 시 D1 쿼리 제거
//
// 전략:
//   로그인 시 → D1 저장 + KV 캐시 (TTL 24h)
//   API 요청 → KV 조회 (D1 쿼리 0회) → miss 시 D1 fallback → KV 재캐시
//   로그아웃  → D1 삭제 + KV 삭제
//   무효화   → D1 삭제 + KV 삭제 (사용자 전체 세션)
//
// KV Key 형식: session:{sessionId}
// KV Value: JSON.stringify(SessionUser)
// KV TTL: 세션 만료까지 남은 초 (최대 24h = 86400s)
// ================================================================

import type { SessionUser, RoleCode, OrgType } from '../types';

// ─── KV 키 헬퍼 ───
const SESSION_KEY_PREFIX = 'session:';
function kvKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

// ─── 세션 TTL 계산 (초) ───
function calcTtlSeconds(expiresAt: string): number {
  const remaining = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(remaining, 60); // 최소 60초
}

/** 세션 생성 결과 */
export interface CreateSessionResult {
  sessionId: string;
  expiresAt: string;
}

/** 세션에서 복원된 사용자 정보 */
export interface SessionValidationResult {
  valid: boolean;
  user?: SessionUser;
  /** KV 캐시 히트 여부 (디버그용) */
  cacheHit?: boolean;
}

/**
 * createSession — 새 세션을 생성한다.
 * D1에 세션 저장 + KV에 사용자 정보 캐시
 */
export async function createSession(
  db: D1Database,
  userId: number,
  maxSessions: number = 5,
  kv?: KVNamespace
): Promise<CreateSessionResult> {
  // 세션 수 제한
  const sessionCount = await db.prepare(
    "SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ? AND expires_at > datetime('now')"
  ).bind(userId).first();

  if (sessionCount && (sessionCount.cnt as number) >= maxSessions) {
    // 가장 오래된 세션 ID 조회 → D1 + KV 동시 삭제
    const oldest = await db.prepare(
      'SELECT session_id FROM sessions WHERE user_id = ? ORDER BY created_at ASC LIMIT 1'
    ).bind(userId).first();

    if (oldest) {
      await db.prepare('DELETE FROM sessions WHERE session_id = ?')
        .bind(oldest.session_id).run();
      // KV에서도 제거
      if (kv) {
        try { await kv.delete(kvKey(oldest.session_id as string)); } catch {}
      }
    }
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await db.prepare(
    'INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, userId, expiresAt).run();

  // ★ KV 캐시: 사용자 정보를 미리 로드하여 캐시
  if (kv) {
    try {
      const userData = await loadUserData(db, userId);
      if (userData) {
        await kv.put(
          kvKey(sessionId),
          JSON.stringify(userData),
          { expirationTtl: calcTtlSeconds(expiresAt) }
        );
      }
    } catch {
      // KV 쓰기 실패 시 무시 — D1에는 이미 저장됨
    }
  }

  return { sessionId, expiresAt };
}

/**
 * deleteSession — 특정 세션을 삭제한다 (로그아웃).
 * D1 + KV 동시 삭제
 */
export async function deleteSession(
  db: D1Database,
  sessionId: string,
  kv?: KVNamespace
): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE session_id = ?').bind(sessionId).run();
  // ★ KV 삭제
  if (kv) {
    try { await kv.delete(kvKey(sessionId)); } catch {}
  }
}

/**
 * invalidateUserSessions — 특정 사용자의 모든 세션을 삭제한다.
 * D1에서 세션 ID 목록 조회 → KV 일괄 삭제 → D1 일괄 삭제
 */
export async function invalidateUserSessions(
  db: D1Database,
  userId: number,
  kv?: KVNamespace
): Promise<number> {
  // ★ KV 삭제를 위해 먼저 세션 ID 목록 조회
  if (kv) {
    try {
      const sessions = await db.prepare(
        'SELECT session_id FROM sessions WHERE user_id = ?'
      ).bind(userId).all();
      await Promise.allSettled(
        sessions.results.map((s: any) => kv.delete(kvKey(s.session_id)))
      );
    } catch {}
  }

  const result = await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  return result.meta.changes || 0;
}

/**
 * cleanExpiredSessions — 만료 세션 일괄 정리
 * KV는 TTL 기반 자동 만료되므로 D1만 정리
 */
export async function cleanExpiredSessions(
  db: D1Database
): Promise<number> {
  const result = await db.prepare(
    "DELETE FROM sessions WHERE expires_at < datetime('now')"
  ).run();
  return result.meta.changes || 0;
}

/**
 * validateSession — 세션 ID로 사용자 정보를 복원한다.
 * ★ KV 우선 조회 → miss 시 D1 fallback → KV 재캐시
 */
export async function validateSession(
  db: D1Database,
  sessionId: string,
  kv?: KVNamespace
): Promise<SessionValidationResult> {
  // ─── 1단계: KV 캐시 조회 ───
  if (kv) {
    try {
      const cached = await kv.get(kvKey(sessionId));
      if (cached) {
        const user: SessionUser = JSON.parse(cached);
        return { valid: true, user, cacheHit: true };
      }
    } catch {
      // KV 읽기 실패 시 D1 fallback
    }
  }

  // ─── 2단계: D1 fallback ───
  const session = await db.prepare(`
    SELECT s.user_id, s.expires_at, u.org_id, u.login_id, u.name, 
           o.org_type, o.name as org_name
    FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    JOIN organizations o ON u.org_id = o.org_id
    WHERE s.session_id = ? AND s.expires_at > datetime('now') AND u.status = 'ACTIVE'
  `).bind(sessionId).first();

  if (!session) {
    // D1에도 없으면 KV에 잔여 캐시 제거
    if (kv) {
      try { await kv.delete(kvKey(sessionId)); } catch {}
    }
    return { valid: false, cacheHit: false };
  }

  const roles = await db.prepare(
    'SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?'
  ).bind(session.user_id).all();

  const roleCodes = roles.results.map((r: any) => r.code as RoleCode);
  const isAgency = roleCodes.includes('AGENCY_LEADER');

  // 대리점장인 경우 하위 팀장 목록 조회
  let agencyTeamIds: number[] | undefined;
  if (isAgency) {
    const teamMappings = await db.prepare(
      'SELECT team_user_id FROM agency_team_mappings WHERE agency_user_id = ?'
    ).bind(session.user_id).all();
    agencyTeamIds = teamMappings.results.map((r: any) => r.team_user_id as number);
  }

  const user: SessionUser = {
    user_id: session.user_id as number,
    org_id: session.org_id as number,
    org_type: session.org_type as OrgType,
    login_id: session.login_id as string,
    name: session.name as string,
    org_name: session.org_name as string,
    roles: roleCodes,
    is_agency: isAgency,
    agency_team_ids: agencyTeamIds,
  };

  // ─── 3단계: KV 재캐시 (D1 fallback 성공 시) ───
  if (kv) {
    try {
      await kv.put(
        kvKey(sessionId),
        JSON.stringify(user),
        { expirationTtl: calcTtlSeconds(session.expires_at as string) }
      );
    } catch {
      // KV 쓰기 실패 시 무시
    }
  }

  return { valid: true, user, cacheHit: false };
}

/**
 * loadUserData — 사용자 정보를 D1에서 로드 (KV 캐시 세팅용)
 */
async function loadUserData(
  db: D1Database,
  userId: number
): Promise<SessionUser | null> {
  const user = await db.prepare(`
    SELECT u.user_id, u.org_id, u.login_id, u.name,
           o.org_type, o.name as org_name
    FROM users u
    JOIN organizations o ON u.org_id = o.org_id
    WHERE u.user_id = ? AND u.status = 'ACTIVE'
  `).bind(userId).first();

  if (!user) return null;

  const roles = await db.prepare(
    'SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?'
  ).bind(userId).all();

  const roleCodes = roles.results.map((r: any) => r.code as RoleCode);
  const isAgency = roleCodes.includes('AGENCY_LEADER');

  let agencyTeamIds: number[] | undefined;
  if (isAgency) {
    const teamMappings = await db.prepare(
      'SELECT team_user_id FROM agency_team_mappings WHERE agency_user_id = ?'
    ).bind(userId).all();
    agencyTeamIds = teamMappings.results.map((r: any) => r.team_user_id as number);
  }

  return {
    user_id: user.user_id as number,
    org_id: user.org_id as number,
    org_type: user.org_type as OrgType,
    login_id: user.login_id as string,
    name: user.name as string,
    org_name: user.org_name as string,
    roles: roleCodes,
    is_agency: isAgency,
    agency_team_ids: agencyTeamIds,
  };
}
