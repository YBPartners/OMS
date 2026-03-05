// ================================================================
// 와이비 OMS — Unified Scope Engine v7.0
// 모든 라우트에서 사용하는 단일 데이터 접근 범위 결정기
// v7.0: AGENCY_LEADER 계층 추가 — 자신 + 하위 팀장 데이터 접근
// ================================================================

import type { SessionUser, RoleCode, OrgType } from '../types';

/** Scope 결과: SQL WHERE 절에 삽입할 조건과 바인딩값 */
export interface ScopeResult {
  where: string;
  binds: any[];
  orgType: OrgType;
  orgId: number;
  isGlobal: boolean;
  distributorOrgId?: number;
  /** AGENCY_LEADER인 경우 하위 팀장 user_id 목록 */
  agencyTeamIds?: number[];
}

/**
 * getUserScope — 사용자의 데이터 접근 범위를 결정한다.
 * 
 * 동작 원리:
 * - HQ (SUPER_ADMIN, HQ_OPERATOR): 전체 데이터 접근 → WHERE 1=1
 * - REGION (REGION_ADMIN): 자신의 총판 + 하위 TEAM 데이터
 * - AGENCY_LEADER: 자신의 팀 + 하위 팀장 데이터 (agency_team_mappings 기반)
 * - TEAM (TEAM_LEADER): 자신의 팀 데이터만
 * - AUDITOR: 읽기 전용, HQ 레벨과 동일 범위
 */
export async function getUserScope(
  user: SessionUser,
  db: D1Database,
  opts: {
    tableAlias?: string;
    orgColumn?: string;
    leaderColumn?: string;
    regionColumn?: string;
    forceGlobal?: boolean;
  } = {}
): Promise<ScopeResult> {
  const {
    tableAlias,
    orgColumn = 'org_id',
    leaderColumn = 'team_leader_id',
    regionColumn = 'region_org_id',
    forceGlobal = false,
  } = opts;

  const prefix = tableAlias ? `${tableAlias}.` : '';
  const isHqRole = user.roles.some(r => ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR'].includes(r));

  // ─── HQ 레벨: 전체 접근 ───
  if (user.org_type === 'HQ' || isHqRole || forceGlobal) {
    return {
      where: '(1=1)',
      binds: [],
      orgType: 'HQ',
      orgId: user.org_id,
      isGlobal: true,
    };
  }

  // ─── REGION 레벨 (총판): 자신 + 하위 TEAM 접근 ───
  if (user.org_type === 'REGION') {
    const childTeams = await db.prepare(
      `SELECT org_id FROM organizations WHERE parent_org_id = ? AND org_type = 'TEAM' AND status = 'ACTIVE'`
    ).bind(user.org_id).all();

    const orgIds = [user.org_id, ...childTeams.results.map((r: any) => r.org_id)];
    const placeholders = orgIds.map(() => '?').join(',');

    return {
      where: `(${prefix}${regionColumn} = ? OR ${prefix}${orgColumn} IN (${placeholders}))`,
      binds: [user.org_id, ...orgIds],
      orgType: 'REGION',
      orgId: user.org_id,
      isGlobal: false,
      distributorOrgId: user.org_id,
    };
  }

  // ─── AGENCY_LEADER: 자신 + 하위 팀장 데이터 ───
  if (user.roles.includes('AGENCY_LEADER') && user.org_type === 'TEAM') {
    const teamIds = await _getAgencyTeamIds(db, user.user_id);
    const allLeaderIds = [user.user_id, ...teamIds];
    const placeholders = allLeaderIds.map(() => '?').join(',');

    const parentOrg = await db.prepare(
      `SELECT parent_org_id FROM organizations WHERE org_id = ?`
    ).bind(user.org_id).first();

    return {
      where: `(${prefix}${leaderColumn} IN (${placeholders}))`,
      binds: allLeaderIds,
      orgType: 'TEAM',
      orgId: user.org_id,
      isGlobal: false,
      distributorOrgId: parentOrg?.parent_org_id as number | undefined,
      agencyTeamIds: teamIds,
    };
  }

  // ─── TEAM 레벨 (팀장): 자신의 데이터만 ───
  if (user.org_type === 'TEAM') {
    const parentOrg = await db.prepare(
      `SELECT parent_org_id FROM organizations WHERE org_id = ?`
    ).bind(user.org_id).first();

    return {
      where: `(${prefix}${leaderColumn} = ?)`,
      binds: [user.user_id],
      orgType: 'TEAM',
      orgId: user.org_id,
      isGlobal: false,
      distributorOrgId: parentOrg?.parent_org_id as number | undefined,
    };
  }

  // ─── Fallback: 데이터 없음 ───
  return {
    where: '(1=0)',
    binds: [],
    orgType: user.org_type,
    orgId: user.org_id,
    isGlobal: false,
  };
}

/**
 * getSimpleScope — 단순 org_id 기반 필터 (조직 목록 등에서 사용)
 */
export function getSimpleScope(user: SessionUser): {
  isGlobal: boolean;
  orgFilter: string;
  binds: any[];
} {
  const isHqRole = user.roles.some(r => ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR'].includes(r));

  if (user.org_type === 'HQ' || isHqRole) {
    return { isGlobal: true, orgFilter: '1=1', binds: [] };
  }

  if (user.org_type === 'REGION') {
    return {
      isGlobal: false,
      orgFilter: '(o.org_id = ? OR o.parent_org_id = ?)',
      binds: [user.org_id, user.org_id],
    };
  }

  // TEAM (including AGENCY_LEADER) — 자기 org만
  return {
    isGlobal: false,
    orgFilter: 'o.org_id = ?',
    binds: [user.org_id],
  };
}

/**
 * getOrderScope — 주문 조회용 특화 스코프
 * v7.0: AGENCY_LEADER는 자신 + 하위 팀장 주문 접근
 */
export async function getOrderScope(
  user: SessionUser,
  db: D1Database,
  opts: { tableAlias?: string } = {}
): Promise<{ where: string; binds: any[]; isGlobal: boolean; agencyTeamIds?: number[] }> {
  const alias = opts.tableAlias ? `${opts.tableAlias}.` : '';
  const isHqRole = user.roles.some(r => ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR'].includes(r));

  if (user.org_type === 'HQ' || isHqRole) {
    return { where: '(1=1)', binds: [], isGlobal: true };
  }

  if (user.org_type === 'REGION') {
    return {
      where: `(${alias}order_id IN (SELECT order_id FROM order_distributions WHERE region_org_id = ? AND status = 'ACTIVE'))`,
      binds: [user.org_id],
      isGlobal: false,
    };
  }

  // ─── AGENCY_LEADER: 자신 + 하위 팀장 주문 ───
  if (user.roles.includes('AGENCY_LEADER') && user.org_type === 'TEAM') {
    const teamIds = await _getAgencyTeamIds(db, user.user_id);
    const allLeaderIds = [user.user_id, ...teamIds];
    const placeholders = allLeaderIds.map(() => '?').join(',');

    return {
      where: `(${alias}order_id IN (SELECT order_id FROM order_assignments WHERE team_leader_id IN (${placeholders}) AND status != 'REASSIGNED'))`,
      binds: allLeaderIds,
      isGlobal: false,
      agencyTeamIds: teamIds,
    };
  }

  if (user.org_type === 'TEAM') {
    return {
      where: `(${alias}order_id IN (SELECT order_id FROM order_assignments WHERE team_leader_id = ? AND status != 'REASSIGNED'))`,
      binds: [user.user_id],
      isGlobal: false,
    };
  }

  return { where: '(1=0)', binds: [], isGlobal: false };
}

/**
 * _getAgencyTeamIds — 대리점장의 하위 팀장 user_id 목록 조회
 */
async function _getAgencyTeamIds(db: D1Database, agencyUserId: number): Promise<number[]> {
  const result = await db.prepare(
    'SELECT team_user_id FROM agency_team_mappings WHERE agency_user_id = ?'
  ).bind(agencyUserId).all();
  return result.results.map((r: any) => r.team_user_id);
}

/**
 * isAgencyLeader — 사용자가 대리점장인지 확인
 */
export async function isAgencyLeader(db: D1Database, userId: number): Promise<boolean> {
  const result = await db.prepare(
    `SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id 
     WHERE ur.user_id = ? AND r.code = 'AGENCY_LEADER'`
  ).bind(userId).first();
  return !!result;
}
