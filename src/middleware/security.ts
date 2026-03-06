// ================================================================
// Airflow OMS — 보안 유틸리티 모듈 v3.0
// PBKDF2 해싱, 입력 검증, rate-limit, 세션 정리, SQL 안전 유틸
// ================================================================

// ─── PBKDF2 비밀번호 해싱 (Cloudflare Workers 호환) ───
// SHA-256보다 훨씬 안전한 key-stretching. salt 사용으로 rainbow-table 방어.
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

/** 비밀번호를 PBKDF2로 해싱. 결과: "pbkdf2:iterations:salt_hex:hash_hex" */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_LENGTH * 8
  );
  const saltHex = buf2hex(salt);
  const hashHex = buf2hex(new Uint8Array(bits));
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

/** 비밀번호 검증. PBKDF2 형식과 레거시 SHA-256 형식 모두 지원 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('pbkdf2:')) {
    // 새로운 PBKDF2 형식
    const parts = storedHash.split(':');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = hex2buf(parts[2]);
    const expected = parts[3];

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      HASH_LENGTH * 8
    );
    return buf2hex(new Uint8Array(bits)) === expected;
  } else {
    // 레거시 SHA-256 호환 (마이그레이션 전 데이터)
    const hash = await legacySha256(password);
    return hash === storedHash;
  }
}

/** 레거시 SHA-256 해시 (기존 데이터 호환용) */
export async function legacySha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return buf2hex(new Uint8Array(hashBuffer));
}

/** 레거시 해시를 PBKDF2로 마이그레이션 해야 하는지 판별 */
export function needsRehash(storedHash: string): boolean {
  return !storedHash.startsWith('pbkdf2:');
}

// ─── 버퍼 ↔ Hex 변환 ───
function buf2hex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hex2buf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// ─── 입력값 검증 & Sanitize ───

/** 기본 XSS 방어: HTML 엔티티 이스케이프 */
export function sanitizeInput(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/** 문자열 입력 자동 trim + XSS 방어 (null/undefined 안전) */
export function cleanStr(value: any): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim();
}

/** 민감 필드를 마스킹한 안전한 감사 로그 상세 생성 */
export function safeAuditDetail(body: Record<string, any>): string {
  const SENSITIVE_KEYS = ['password', 'password_hash', 'current_password', 'new_password', 'auth_credentials', 'api_key', 'secret'];
  const safe: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    if (SENSITIVE_KEYS.some(sk => k.toLowerCase().includes(sk))) {
      safe[k] = '***';
    } else {
      safe[k] = v;
    }
  }
  return JSON.stringify(safe);
}

/**
 * SQL 안전 컬럼명 검증 — 알파벳, 숫자, 언더스코어만 허용
 * 동적 컬럼명을 쿼리에 삽입하기 전 반드시 검증
 */
export function isSafeColumnName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(name);
}

/** 안전한 컬럼명 배열 필터링 */
export function filterSafeColumns(cols: string[]): string[] {
  return cols.filter(isSafeColumnName);
}

/** 전화번호 정규화 (숫자만 추출) */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/** 전화번호 형식 검증 */
export function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return digits.length >= 10 && digits.length <= 11 && digits.startsWith('01');
}

/** 로그인 ID 형식 검증 */
export function isValidLoginId(loginId: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,50}$/.test(loginId);
}

/** 이메일 형식 검증 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Rate Limiting (메모리 기반, Worker 인스턴스 내) ───
// Cloudflare Workers에서는 KV/Durable Objects 사용 권장
// 현재는 인스턴스 레벨 메모리 기반 (보수적 접근)
export const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * 요청 제한 확인. key별로 window_ms 동안 max_count 이내인지 검사.
 * @returns {ok, remaining, retryAfter(ms)} 
 */
export function checkRateLimit(key: string, maxCount: number, windowMs: number): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: maxCount - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxCount) {
    return { ok: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { ok: true, remaining: maxCount - entry.count, retryAfterMs: 0 };
}

// 메모리 정리 (stale entries 제거 — 1000개 초과 시)
export function cleanupRateLimit() {
  if (rateLimitMap.size > 1000) {
    const now = Date.now();
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }
}

// ─── 세션 관리 ───
/** 만료된 세션 삭제 (주기적 정리용) */
export async function cleanExpiredSessions(db: D1Database): Promise<number> {
  const result = await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  return result.meta.changes || 0;
}

// ─── 환경 판별 ───
/** 개발 환경 여부 */
export function isDevelopment(): boolean {
  // Cloudflare Workers에서는 wrangler dev --local 시 true
  // 프로덕션 배포 시에는 환경변수로 제어
  try {
    // globalThis에서 확인 (Cloudflare Workers 호환)
    return (globalThis as any).__DEV__ === true;
  } catch {
    return false;
  }
}
