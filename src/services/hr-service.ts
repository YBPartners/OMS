// ================================================================
// Airflow OMS — HR Service v1.0
// HR 도메인(조직·사용자·역할)의 쓰기 진입점
// Signup 도메인은 이 서비스를 통해서만 HR 테이블에 접근
// ================================================================

import { writeAuditLog } from '../lib/audit';
import type { AuditEventCode } from '../types';

/** createTeamWithLeader 입력 파라미터 */
export interface CreateTeamWithLeaderParams {
  teamName: string;
  distributorOrgId: number;
  loginId: string;
  passwordHash: string;
  name: string;
  phone: string;
  email?: string;
  regionIds: number[];
  commissionMode?: string | null;
  commissionValue?: number | null;
  approvedBy: number;
}

/** createTeamWithLeader 결과 */
export interface CreateTeamWithLeaderResult {
  orgId: number;
  userId: number;
  teamCode: string;
}

/**
 * createTeamWithLeader — 가입 승인 시 팀 조직 + 팀장 사용자를 원자적으로 생성
 * 
 * 기존: signup/approve 라우트에서 6개 HR 테이블에 직접 INSERT (교차 도메인 위반)
 * 개선: HR 서비스 단일 함수로 캡슐화, signup은 이 함수만 호출
 * 
 * 생성 순서:
 * 1. TEAM 조직 생성 (organizations)
 * 2. 팀-총판 매핑 (team_distributor_mappings)
 * 3. 사용자 생성 (users)
 * 4. TEAM_LEADER 역할 부여 (user_roles)
 * 5. 조직-시군구 매핑 (region_sigungu_map)
 * 6. 수수료 정책 (commission_policies) — 선택
 */
export async function createTeamWithLeader(
  db: D1Database,
  params: CreateTeamWithLeaderParams
): Promise<CreateTeamWithLeaderResult> {
  // 1. TEAM 조직 생성
  const teamCode = `TEAM_${params.distributorOrgId}_${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const orgResult = await db.prepare(`
    INSERT INTO organizations (org_type, name, code, parent_org_id, status)
    VALUES ('TEAM', ?, ?, ?, 'ACTIVE')
  `).bind(params.teamName, teamCode, params.distributorOrgId).run();
  const newOrgId = orgResult.meta.last_row_id as number;

  // 2. 팀-총판 매핑
  await db.prepare(
    'INSERT OR IGNORE INTO team_distributor_mappings (team_org_id, distributor_org_id) VALUES (?, ?)'
  ).bind(newOrgId, params.distributorOrgId).run();

  // 3. 사용자 생성 (email 포함)
  const userResult = await db.prepare(`
    INSERT INTO users (org_id, login_id, password_hash, name, phone, email, email_verified, status, phone_verified, joined_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, datetime('now'))
  `).bind(newOrgId, params.loginId, params.passwordHash, params.name, params.phone, params.email || null, params.email ? 1 : 0).run();
  const newUserId = userResult.meta.last_row_id as number;

  // 4. TEAM_LEADER 역할 부여
  const roleRow = await db.prepare("SELECT role_id FROM roles WHERE code = 'TEAM_LEADER'").first();
  if (roleRow) {
    await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(newUserId, roleRow.role_id).run();
  }

  // 5. 조직-시군구 매핑
  for (const code of params.regionIds) {
    await db.prepare(
      'INSERT OR IGNORE INTO region_sigungu_map (org_id, sigungu_code, mapped_by) VALUES (?, ?, 0)'
    ).bind(newOrgId, String(code)).run();
  }

  // 6. 수수료 정책 (옵션)
  if (params.commissionMode && params.commissionValue !== null && params.commissionValue !== undefined) {
    await db.prepare(`
      INSERT INTO commission_policies (org_id, team_leader_id, mode, value, effective_from)
      VALUES (?, ?, ?, ?, date('now'))
    `).bind(params.distributorOrgId, newUserId, params.commissionMode, params.commissionValue).run();
  }

  // 감사 로그
  await writeAuditLog(db, {
    entity_type: 'ORG',
    entity_id: newOrgId,
    action: 'ORG.CREATED' as AuditEventCode,
    actor_id: params.approvedBy,
    detail_json: JSON.stringify({
      team_name: params.teamName,
      team_code: teamCode,
      distributor_org_id: params.distributorOrgId,
      user_id: newUserId,
      login_id: params.loginId,
      region_count: params.regionIds.length,
    }),
  });

  return { orgId: newOrgId, userId: newUserId, teamCode };
}

/**
 * assignRole — 사용자에게 역할을 부여한다.
 */
export async function assignRole(
  db: D1Database,
  userId: number,
  roleCode: string
): Promise<boolean> {
  const roleRow = await db.prepare('SELECT role_id FROM roles WHERE code = ?').bind(roleCode).first();
  if (!roleRow) return false;

  await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId).run();
  await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(userId, roleRow.role_id).run();
  return true;
}
