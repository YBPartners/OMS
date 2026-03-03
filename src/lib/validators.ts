// ================================================================
// 다하다 OMS — 공통 입력 검증 유틸리티
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
const VALID_ROLES = ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'TEAM_LEADER', 'AUDITOR'] as const;
export function isValidRole(role: string): boolean {
  return VALID_ROLES.includes(role as any);
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
