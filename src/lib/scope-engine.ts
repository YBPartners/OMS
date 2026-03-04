// ================================================================
// 다하다 OMS — Unified Scope Engine v5.0
// 모든 라우트에서 사용하는 단일 데이터 접근 범위 결정기
// 기존: 8개 라우트 × 개별 필터 코드 ≈ 120줄씩
// 혁신: 1개 함수로 통합 → 수정 지점 1곳
// ================================================================

import type { SessionUser, RoleCode, OrgType } from '../types';

/** Scope 결과: SQL WHERE 절에 삽입할 조건과 바인딩값 */
export interface ScopeResult {
  /** SQL WHERE 조건 (이미 괄호로 감싸짐) */
  where: string;
  /** SQL 바인딩 파라미터 */
  binds: any[];
  /** 사용자의 최상위 org_type */
  orgType: OrgType;
  /** 사용자의 org_id */
  orgId: number;
  /** 전체 접근 여부 (HQ 레벨) */
  isGlobal: boolean;
  /** 총판(REGION) org_id (TEAM인 경우 부모) */
  distributorOrgId?: number;
}

/**
 * getUserScope — 사용자의 데이터 접근 범위를 결정한다.
 * 
 * @param user - 인증된 세션 사용자
 * @param db - D1 데이터베이스 인스턴스
 * @param opts - 스코프 옵션
 * @returns ScopeResult - SQL 조건절과 바인딩
 * 
 * 동작 원리:
 * - HQ (SUPER_ADMIN, HQ_OPERATOR): 전체 데이터 접근 → WHERE 1=1
 * - REGION (REGION_ADMIN): 자신의 총판 + 하위 TEAM 데이터 → WHERE org_id IN (...)
 * - TEAM (TEAM_LEADER): 자신의 팀 데이터만 → WHERE team_leader_id = ? 또는 org_id = ?
 * - AUDITOR: 읽기 전용, HQ 레벨과 동일 범위
 */
export async function getUserScope(
  user: SessionUser,
  db: D1Database,
  opts: {
    /** 스코프 적용 대상 테이블의 별칭 (예: 'o' for orders) */
    tableAlias?: string;
    /** org_id 컬럼명 (기본: 'org_id') */
    orgColumn?: string;
    /** team_leader_id 컬럼명 (팀장 레벨에서 사용) */
    leaderColumn?: string;
    /** region_org_id 컬럼명 (배분 테이블에서 사용) */
    regionColumn?: string;
    /** 강제 전역 모드 (특정 API에서 전체 접근이 필요할 때) */
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
    // 하위 TEAM org_id 목록 조회
    const childTeams = await db.prepare(
      `SELECT org_id FROM organizations WHERE parent_org_id = ? AND org_type = 'TEAM' AND status = 'ACTIVE'`
    ).bind(user.org_id).all();

    const orgIds = [user.org_id, ...childTeams.results.map((r: any) => r.org_id)];
    const placeholders = orgIds.map(() => '?').join(',');

    // team_leader_id 컬럼이 있는 테이블용 (orders_assignments 등)
    const teamLeaderIds = await db.prepare(
      `SELECT DISTINCT u.user_id FROM users u WHERE u.org_id IN (${placeholders}) AND u.status = 'ACTIVE'`
    ).bind(...orgIds).all();

    const leaderIds = teamLeaderIds.results.map((r: any) => r.user_id);

    return {
      where: `(${prefix}${regionColumn} = ? OR ${prefix}${orgColumn} IN (${placeholders}))`,
      binds: [user.org_id, ...orgIds],
      orgType: 'REGION',
      orgId: user.org_id,
      isGlobal: false,
      distributorOrgId: user.org_id,
    };
  }

  // ─── TEAM 레벨 (팀장): 자신의 데이터만 ───
  if (user.org_type === 'TEAM') {
    // 부모 총판(REGION) org_id 조회
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
 * getUserScope보다 가볍고 DB 조회 없이 동기적으로 작동
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

  // REGION이면 자기 org + 하위 TEAM (parent_org_id)
  if (user.org_type === 'REGION') {
    return {
      isGlobal: false,
      orgFilter: '(o.org_id = ? OR o.parent_org_id = ?)',
      binds: [user.org_id, user.org_id],
    };
  }

  // TEAM이면 자기 org만
  return {
    isGlobal: false,
    orgFilter: 'o.org_id = ?',
    binds: [user.org_id],
  };
}

/**
 * getOrderScope — 주문 조회용 특화 스코프
 * 주문 테이블은 org_id가 직접 없고, 배분/배정을 통해 연결되므로 별도 처리
 */
export async function getOrderScope(
  user: SessionUser,
  db: D1Database,
  opts: { tableAlias?: string } = {}
): Promise<{ where: string; binds: any[]; isGlobal: boolean }> {
  const alias = opts.tableAlias ? `${opts.tableAlias}.` : '';
  const isHqRole = user.roles.some(r => ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR'].includes(r));

  if (user.org_type === 'HQ' || isHqRole) {
    return { where: '(1=1)', binds: [], isGlobal: true };
  }

  if (user.org_type === 'REGION') {
    // 자기 총판으로 배분된 주문
    return {
      where: `(${alias}order_id IN (SELECT order_id FROM order_distributions WHERE region_org_id = ? AND status = 'ACTIVE'))`,
      binds: [user.org_id],
      isGlobal: false,
    };
  }

  if (user.org_type === 'TEAM') {
    // 자기에게 배정된 주문
    return {
      where: `(${alias}order_id IN (SELECT order_id FROM order_assignments WHERE team_leader_id = ? AND status != 'REASSIGNED'))`,
      binds: [user.user_id],
      isGlobal: false,
    };
  }

  return { where: '(1=0)', binds: [], isGlobal: false };
}
