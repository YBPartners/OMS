// ================================================================
// Airflow OMS — 공통 입력 검증 유틸리티
// 각 라우트에서 중복되던 검증 로직을 통합
// ================================================================

import { normalizePhone, isValidPhone, isValidLoginId, isValidEmail } from '../middleware/security';

export { normalizePhone, isValidPhone, isValidLoginId, isValidEmail };

/** 필수값 검증 — 누락 시 { field, message } 반환 */
export function validateRequired(body: Record<string, any>, fields: { name: string; label: string }[]): { field: string; message: string } | null {
  for (const f of fields) {
    if (body[f.name] === undefined || body[f.name] === null || body[f.name] === '') {
      return { field: f.name, message: `${f.label}은(는) 필수입니다.` };
    }
  }
  return null;
}

/** 금액 검증 (0 이상의 숫자) */
export function validateAmount(value: any, label: string = '금액'): string | null {
  if (value === undefined || value === null) return null; // optional
  if (isNaN(Number(value)) || Number(value) < 0) {
    return `${label}은(는) 0 이상의 숫자여야 합니다.`;
  }
  return null;
}

/** 날짜 형식 검증 (YYYY-MM-DD) */
export function isValidDateFormat(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

/** 날짜 범위 검증 — start <= end */
export function validateDateRange(start: string, end: string): string | null {
  if (!isValidDateFormat(start) || !isValidDateFormat(end)) {
    return '날짜 형식은 YYYY-MM-DD입니다.';
  }
  if (start > end) {
    return '시작일이 종료일보다 이후입니다.';
  }
  return null;
}

/** 페이지네이션 파라미터 정규화 */
export function normalizePagination(page?: string, limit?: string, maxLimit: number = 100): { page: number; limit: number; offset: number } {
  const p = Math.max(1, parseInt(page || '1', 10) || 1);
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit || '20', 10) || 20));
  return { page: p, limit: l, offset: (p - 1) * l };
}

/** 역할 유효성 검증 */
const VALID_ROLES = ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'TEAM_LEADER', 'AGENCY_LEADER', 'AUDITOR'] as const;
export function isValidRole(role: string): boolean {
  return VALID_ROLES.includes(role as any);
}

// ================================================================
// 역할 계층 등급 — 숫자가 작을수록 상위 권한
// ================================================================
const ROLE_HIERARCHY: Record<string, number> = {
  'SUPER_ADMIN':   1,
  'HQ_OPERATOR':   2,
  'REGION_ADMIN':  3,
  'AGENCY_LEADER': 4,
  'TEAM_LEADER':   5,
  'AUDITOR':       6,
};

/** 역할 코드의 계층 등급 반환 (낮을수록 강함, 없으면 99) */
export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 99;
}

/**
 * 사용자의 역할 목록에서 최고 등급(가장 강한 권한)을 반환.
 * roles가 비어있으면 99(최하위).
 */
export function getHighestRoleLevel(roles: string[]): number {
  if (!roles || roles.length === 0) return 99;
  return Math.min(...roles.map(r => getRoleLevel(r)));
}

/**
 * 행위자(actor)가 대상(target)보다 상위 권한인지 검증.
 * 동급은 불허 — 반드시 상위만 수정 가능.
 * SUPER_ADMIN은 항상 통과.
 */
export function canActorModifyTarget(actorRoles: string[], targetRoles: string[]): boolean {
  if (actorRoles.includes('SUPER_ADMIN')) return true;
  const actorLevel = getHighestRoleLevel(actorRoles);
  const targetLevel = getHighestRoleLevel(targetRoles);
  return actorLevel < targetLevel; // 숫자가 작을수록 상위
}

/**
 * 행위자가 부여하려는 역할이 자신의 등급보다 하위인지 검증.
 * SUPER_ADMIN만이 SUPER_ADMIN을 부여 가능.
 * HQ_OPERATOR는 REGION_ADMIN 이하만 부여 가능.
 * REGION_ADMIN은 TEAM_LEADER/AGENCY_LEADER만 부여 가능.
 */
export function canActorAssignRole(actorRoles: string[], targetRole: string): boolean {
  if (actorRoles.includes('SUPER_ADMIN')) return true;
  const actorLevel = getHighestRoleLevel(actorRoles);
  const targetLevel = getRoleLevel(targetRole);
  return actorLevel < targetLevel; // 행위자가 부여 역할보다 반드시 상위
}

/**
 * 행위자가 부여하려는 역할 목록 전체를 검증.
 */
export function canActorAssignRoles(actorRoles: string[], targetRoles: string[]): boolean {
  return targetRoles.every(r => canActorAssignRole(actorRoles, r));
}

/** 화이트리스트 검증 */
export function isInWhitelist<T extends string>(value: string, whitelist: readonly T[]): value is T {
  return whitelist.includes(value as T);
}

/** JSON body 안전 파싱 */
export async function safeParseJson(c: any): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try {
    const data = await c.req.json();
    return { ok: true, data };
  } catch {
    return { ok: false, error: '잘못된 요청 형식입니다.' };
  }
}
