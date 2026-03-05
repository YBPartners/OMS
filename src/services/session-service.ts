// ================================================================
// 와이비 OMS — Session Service v1.0
// 세션 도메인의 유일한 쓰기/읽기 진입점
// auth 라우트 및 타 도메인은 이 서비스를 통해 sessions 테이블에 접근
// ================================================================

import type { SessionUser, RoleCode, OrgType } from '../types';

/** 세션 생성 결과 */
export interface CreateSessionResult {
  sessionId: string;
  expiresAt: string;
}

/** 세션에서 복원된 사용자 정보 */
export interface SessionValidationResult {
  valid: boolean;
  user?: SessionUser;
}

/**
 * createSession — 새 세션을 생성한다.
 * 사용자당 최대 5개 세션 제한, 초과 시 가장 오래된 세션 삭제
 */
export async function createSession(
  db: D1Database,
  userId: number,
  maxSessions: number = 5
): Promise<CreateSessionResult> {
  // 세션 수 제한
  const sessionCount = await db.prepare(
    "SELECT COUNT(*) as cnt FROM sessions WHERE user_id = ? AND expires_at > datetime('now')"
  ).bind(userId).first();

  if (sessionCount && (sessionCount.cnt as number) >= maxSessions) {
    await db.prepare(`
      DELETE FROM sessions WHERE session_id IN (
        SELECT session_id FROM sessions WHERE user_id = ? ORDER BY created_at ASC LIMIT 1
      )
    `).bind(userId).run();
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await db.prepare(
    'INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, userId, expiresAt).run();

  return { sessionId, expiresAt };
}

/**
 * deleteSession — 특정 세션을 삭제한다 (로그아웃).
 */
export async function deleteSession(
  db: D1Database,
  sessionId: string
): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE session_id = ?').bind(sessionId).run();
}

/**
 * invalidateUserSessions — 특정 사용자의 모든 세션을 삭제한다.
 * 비활성화, 비밀번호 리셋, 자격증명 변경 시 사용
 */
export async function invalidateUserSessions(
  db: D1Database,
  userId: number
): Promise<number> {
  const result = await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  return result.meta.changes || 0;
}

/**
 * cleanExpiredSessions — 만료 세션 일괄 정리
 * 주기적으로 호출하여 stale 세션 제거
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
 * authMiddleware에서 사용
 */
export async function validateSession(
  db: D1Database,
  sessionId: string
): Promise<SessionValidationResult> {
  const session = await db.prepare(`
    SELECT s.user_id, s.expires_at, u.org_id, u.login_id, u.name, 
           o.org_type, o.name as org_name
    FROM sessions s
    JOIN users u ON s.user_id = u.user_id
    JOIN organizations o ON u.org_id = o.org_id
    WHERE s.session_id = ? AND s.expires_at > datetime('now') AND u.status = 'ACTIVE'
  `).bind(sessionId).first();

  if (!session) {
    return { valid: false };
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

  return {
    valid: true,
    user: {
      user_id: session.user_id as number,
      org_id: session.org_id as number,
      org_type: session.org_type as OrgType,
      login_id: session.login_id as string,
      name: session.name as string,
      org_name: session.org_name as string,
      roles: roleCodes,
      is_agency: isAgency,
      agency_team_ids: agencyTeamIds,
    },
  };
}
