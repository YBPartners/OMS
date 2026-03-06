# Airflow OMS — 아키텍처 혁신 설계서 v5.0

> **문서 상태**: 설계 리뷰 (승인 대기)
> **작성일**: 2026-03-04
> **범위**: 시스템 전체 아키텍처 혁신 — 코드 6,000줄(BE 2,950 + FE 3,089), DB 28테이블 정밀 분석 기반
> **목표**: v4.0 설계(팀장 가입 시스템)를 포함하여, 시스템 전체의 구조적 한계를 근본적으로 해결

---

## 0. 분석 요약 — 현재 시스템의 구조적 한계

### 코드 분석 결과

```
[백엔드] 28 TypeScript 파일, 2,950줄
  - 6개 도메인 라우터 (auth, hr, orders, settlements, reconciliation, stats)
  - 공통 라이브러리 (audit, db-helpers, validators, security)

[프론트엔드] 20+ JavaScript 파일, 3,089줄
  - 전역 window.OMS 객체에 순차 스크립트 로드
  - 각 페이지 파일이 독립적 렌더 함수 정의

[DB] 28 테이블, 정산/대사/통계 집계 테이블 포함

[문제의 핵심]
  1. 배분 로직이 레거시 territories 테이블에 의존 → 신규 admin_regions와 단절
  2. 모든 쿼리가 org_type='HQ'|'REGION' 2종만 인식 → 'TEAM' 추가 시 8곳 이상 깨짐
  3. 트랜잭션 부재 → 정산 확정/가입 승인 시 중간 실패 = 데이터 불일치
  4. 스코프 필터가 각 라우트에 하드코딩 → 조직 계층 변경 시 전부 수정 필요
  5. 프론트엔드 상태 관리 없음 → 전역 변수 의존, 복잡한 위저드 구현 어려움
```

---

## 1. 혁신 ①: 이벤트 소싱 기반 주문 상태 머신

### 문제

현재 `orders.status` 컬럼을 직접 UPDATE하고, `order_status_history`에 별도 INSERT. 이 두 작업이 분리되어 있어:
- 상태 전이 규칙이 `types/index.ts`에 정의되어 있지만 **런타임에 검증하지 않음** (각 라우트에서 수동 검사)
- 같은 주문의 상태를 2곳에서 동시에 바꾸면 무결성 보장 불가
- `distribute.ts`(33줄), `assign.ts`(30줄), `review.ts`(70줄), `calculation.ts`(90줄) 등에서 동일한 상태 변경 패턴이 반복

### 혁신 설계

```typescript
// src/lib/state-machine.ts — 중앙 상태 머신
export async function transitionOrder(
  db: D1Database,
  orderId: number,
  toStatus: OrderStatus,
  actorId: number,
  options?: {
    note?: string;
    batchStatements?: D1PreparedStatement[]; // batch에 합류
  }
): Promise<{ ok: boolean; error?: string; statements: D1PreparedStatement[] }> {

  const order = await db.prepare('SELECT status FROM orders WHERE order_id = ?')
    .bind(orderId).first();
  if (!order) return { ok: false, error: 'ORDER_NOT_FOUND', statements: [] };

  const current = order.status as OrderStatus;
  const rule = STATUS_TRANSITIONS[current];

  // ① 전이 규칙 검증 (런타임에 반드시)
  if (!rule || !rule.next.includes(toStatus)) {
    return { ok: false, error: `INVALID_TRANSITION:${current}→${toStatus}`, statements: [] };
  }

  // ② batch 가능한 SQL 문 반환 (호출자가 batch()로 원자 실행)
  const statements = [
    db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE order_id = ?`)
      .bind(toStatus, orderId),
    db.prepare(`INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
                VALUES (?, ?, ?, ?, ?)`)
      .bind(orderId, current, toStatus, actorId, options?.note || null),
  ];

  return { ok: true, statements: [...(options?.batchStatements || []), ...statements] };
}
```

### 효과

| 항목 | AS-IS | TO-BE |
|------|-------|-------|
| 상태 전이 코드 | 각 라우트에 분산 (~15곳) | 중앙 1곳 |
| 전이 규칙 검증 | 일부 라우트만 수동 | 100% 런타임 검증 |
| 원자성 | 개별 SQL 실행 | D1 batch() 원자 실행 |
| 감사 이력 | 수동 INSERT (누락 가능) | 자동 보장 |

---

## 2. 혁신 ②: 통합 스코프 엔진 (Scope Engine)

### 문제

현재 **6개 이상의 라우트**에서 동일한 스코프 필터링 로직이 하드코딩:

```typescript
// dashboard.ts (line 21-27) — 하드코딩 패턴
if (user.roles.includes('TEAM_LEADER')) {
  scopeWhere = `AND o.order_id IN (SELECT order_id FROM order_assignments WHERE team_leader_id = ?)`;
  scopeParams = [user.user_id];
} else if (user.org_type === 'REGION') {
  scopeWhere = `AND o.order_id IN (SELECT order_id FROM order_distributions WHERE region_org_id = ? AND status = 'ACTIVE')`;
  scopeParams = [user.org_id];
}

// 이 패턴이 dashboard, orders/crud, orders/report, stats/reports, settlements/runs 등에 반복
// TEAM org_type 추가 시 → 최소 8곳 수정 필요 (실수 위험 극대)
```

### 혁신 설계

```typescript
// src/lib/scope-engine.ts — 통합 스코프 엔진
interface ScopeResult {
  where: string;       // SQL WHERE 절 조각
  params: any[];       // 바인딩 파라미터
  orgIds: number[];    // 접근 가능한 org_id 목록
  regionOrgIds: number[]; // 접근 가능한 총판 org_id 목록
}

export async function getUserScope(
  db: D1Database,
  user: SessionUser,
  context: 'orders' | 'stats' | 'settlements' | 'reconciliation'
): Promise<ScopeResult> {

  // SUPER_ADMIN, HQ_OPERATOR → 전체
  if (user.roles.some(r => ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR'].includes(r))) {
    return { where: '', params: [], orgIds: [], regionOrgIds: [] };
  }

  // REGION_ADMIN(총판) → 자기 총판 + 하위 TEAM 전체
  if (user.roles.includes('REGION_ADMIN')) {
    const childTeams = await db.prepare(`
      SELECT org_id FROM organizations WHERE parent_org_id = ? AND status = 'ACTIVE'
    `).bind(user.org_id).all();

    const teamIds = childTeams.results.map((t: any) => t.org_id);
    const allOrgIds = [user.org_id, ...teamIds];

    switch (context) {
      case 'orders':
        return {
          where: `AND o.order_id IN (SELECT order_id FROM order_distributions WHERE region_org_id = ? AND status = 'ACTIVE')`,
          params: [user.org_id],
          orgIds: allOrgIds,
          regionOrgIds: [user.org_id],
        };
      case 'settlements':
        return {
          where: `AND s.region_org_id = ?`,
          params: [user.org_id],
          orgIds: allOrgIds,
          regionOrgIds: [user.org_id],
        };
      // ... 컨텍스트별 최적 WHERE
    }
  }

  // TEAM_LEADER → 자기 팀 주문만
  if (user.roles.includes('TEAM_LEADER')) {
    return {
      where: `AND o.order_id IN (SELECT order_id FROM order_assignments WHERE team_leader_id = ? AND status != 'REASSIGNED')`,
      params: [user.user_id],
      orgIds: [user.org_id],
      regionOrgIds: [],
    };
  }

  // fallback: 접근 불가
  return { where: 'AND 1=0', params: [], orgIds: [], regionOrgIds: [] };
}
```

### 효과

| 항목 | AS-IS | TO-BE |
|------|-------|-------|
| 스코프 코드 | 8곳에 분산 (~120줄) | 1곳 (~60줄) |
| TEAM 추가 영향 | 8곳 수정 | 1곳 수정 |
| 새 역할 추가 | 전체 검색 후 수정 | scope-engine만 |
| 테스트 | 각 라우트마다 | scope-engine 단위 테스트 |

---

## 3. 혁신 ③: D1 Batch 트랜잭션 레이어

### 문제

현재 정산 확정(`calculation.ts` line 130-171), 배분(`distribute.ts` line 51-79)에서 **for 루프 안에서 개별 SQL 실행**:

```typescript
// calculation.ts — 정산 확정: for 루프 당 6개 SQL (총 N*6회)
for (const s of pendingSettlements.results as any[]) {
  await db.prepare(`UPDATE settlements ...`).run();     // 1
  await db.prepare(`UPDATE orders ...`).run();           // 2
  await db.prepare(`UPDATE order_assignments ...`).run(); // 3
  await writeStatusHistory(db, ...);                      // 4
  await db.prepare(`INSERT INTO team_leader_ledger_daily ...`).run(); // 5
  await db.prepare(`INSERT INTO region_daily_stats ...`).run();       // 6
  // 3번째 SQL에서 실패하면? → 1,2번은 이미 커밋됨 = 불일치!
}
```

### 혁신 설계

```typescript
// src/lib/batch-transaction.ts — D1 batch 래퍼
export class BatchBuilder {
  private statements: D1PreparedStatement[] = [];

  add(stmt: D1PreparedStatement): this {
    this.statements.push(stmt);
    return this;
  }

  addAll(stmts: D1PreparedStatement[]): this {
    this.statements.push(...stmts);
    return this;
  }

  async execute(db: D1Database): Promise<D1Result[]> {
    if (this.statements.length === 0) return [];
    // D1 batch() = 단일 트랜잭션 (all-or-nothing)
    return db.batch(this.statements);
  }
}

// 사용 예시: 정산 확정 (기존 6*N → batch 1회)
const batch = new BatchBuilder();
for (const s of settlements) {
  batch.add(db.prepare('UPDATE settlements SET status = ? ...').bind('CONFIRMED', s.id));
  batch.add(db.prepare('UPDATE orders SET status = ? ...').bind('SETTLEMENT_CONFIRMED', s.order_id));
  // ... 모든 관련 SQL을 batch에 추가
}
await batch.execute(db); // 원자적 실행: 전부 성공 or 전부 롤백
```

### 효과

| 항목 | AS-IS | TO-BE |
|------|-------|-------|
| 트랜잭션 | 없음 (개별 실행) | D1 batch (원자적) |
| 정산 10건 확정 | 60회 DB 호출 | 1회 batch 호출 |
| 중간 실패 | 부분 커밋 (데이터 불일치) | 전체 롤백 |
| 네트워크 왕복 | N*6 RTT | 1 RTT |
| 성능 | O(n) RTT | O(1) RTT |

---

## 4. 혁신 ④: 배분 엔진 통합 (admin_regions 중심)

### 문제

현재 `distribute.ts`가 레거시 `org_territories + territories` 테이블에만 의존:

```typescript
// distribute.ts (line 33-36) — 레거시 매핑만 참조
const mappings = await db.prepare(`
  SELECT ot.org_id, t.admin_dong_code FROM org_territories ot
  JOIN territories t ON ot.territory_id = t.territory_id
  WHERE (ot.effective_to IS NULL OR ot.effective_to > datetime('now'))
`).all();
```

v4.0에서 `admin_regions`와 `org_region_mappings`을 추가하지만, 배분 엔진이 이를 참조하지 않으면 **신규 등록 총판/팀의 권역이 배분에 반영되지 않음**.

### 혁신 설계

```typescript
// src/lib/distribution-engine.ts — 통합 배분 엔진
export async function resolveRegionByDongCode(
  db: D1Database,
  adminDongCode: string
): Promise<{ orgId: number; orgName: string; source: 'new' | 'legacy' } | null> {

  // ① 신규 admin_regions → org_region_mappings (우선)
  const newMapping = await db.prepare(`
    SELECT orm.org_id, o.name as org_name
    FROM admin_regions ar
    JOIN org_region_mappings orm ON ar.region_id = orm.region_id
    JOIN organizations o ON orm.org_id = o.org_id AND o.org_type = 'REGION'
    WHERE ar.admin_code = ? AND ar.is_active = 1 AND o.status = 'ACTIVE'
    LIMIT 1
  `).bind(adminDongCode).first();

  if (newMapping) {
    return { orgId: newMapping.org_id as number, orgName: newMapping.org_name as string, source: 'new' };
  }

  // ② 레거시 fallback (마이그레이션 완료 전 호환)
  const legacyMapping = await db.prepare(`
    SELECT ot.org_id, o.name as org_name
    FROM org_territories ot
    JOIN territories t ON ot.territory_id = t.territory_id
    JOIN organizations o ON ot.org_id = o.org_id
    WHERE t.admin_dong_code = ?
      AND (ot.effective_to IS NULL OR ot.effective_to > datetime('now'))
    LIMIT 1
  `).bind(adminDongCode).first();

  if (legacyMapping) {
    return { orgId: legacyMapping.org_id as number, orgName: legacyMapping.org_name as string, source: 'legacy' };
  }

  return null;
}

// 팀 배정 시에도 같은 엔진 활용
export async function resolveTeamByDongCode(
  db: D1Database,
  adminDongCode: string,
  regionOrgId: number
): Promise<{ teamOrgId: number; teamLeaderId: number; teamName: string } | null> {

  const team = await db.prepare(`
    SELECT o.org_id, o.name, u.user_id as team_leader_id
    FROM org_region_mappings orm
    JOIN admin_regions ar ON orm.region_id = ar.region_id
    JOIN organizations o ON orm.org_id = o.org_id AND o.org_type = 'TEAM'
    JOIN users u ON u.org_id = o.org_id
    JOIN user_roles ur ON u.user_id = ur.user_id
    JOIN roles r ON ur.role_id = r.role_id AND r.code = 'TEAM_LEADER'
    WHERE ar.admin_code = ? AND o.parent_org_id = ? AND o.status = 'ACTIVE'
    LIMIT 1
  `).bind(adminDongCode, regionOrgId).first();

  return team ? {
    teamOrgId: team.org_id as number,
    teamLeaderId: team.team_leader_id as number,
    teamName: team.name as string,
  } : null;
}
```

### 추가: 자동 배정 기능 (Auto-Assign)

현재는 배분(HQ→총판) 후 배정(총판→팀장)이 수동. 신규 시스템에서 **권역 매핑이 정교**해지므로:

```
주문 접수 → admin_dong_code로 총판 자동 매핑 → 같은 코드로 팀 자동 매핑
= RECEIVED → DISTRIBUTED → ASSIGNED 를 한번에 (배정 자동화 옵션)
```

이는 총판 관리에서 "자동배정 활성화" 토글로 제어 가능.

---

## 5. 혁신 ⑤: 인증 체계 확장 (Signup + Phone Token)

### 문제

현재 `phone_verifications` 테이블에서 `verified=1`만 확인하면 누구나 가입 가능 (토큰 기반 검증 없음).

### 혁신 설계

```typescript
// 전화 인증 → 서명된 토큰 반환 → 가입 API에 토큰 첨부

// OTP 검증 성공 시:
const phoneVerifyToken = crypto.randomUUID();
const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30분

await db.prepare(`
  UPDATE phone_verifications SET
    verified = 1, verify_token = ?, verify_token_expires = ?
  WHERE id = ?
`).bind(phoneVerifyToken, expiresAt, verificationId).run();

// 가입 API에서:
const verification = await db.prepare(`
  SELECT * FROM phone_verifications
  WHERE phone = ? AND verify_token = ? AND verify_token_expires > datetime('now') AND verified = 1
`).bind(phone, phoneVerifyToken).first();

if (!verification) return c.json({ error: '유효하지 않은 전화인증입니다.' }, 400);
```

### 추가: 가입 공개 API Rate Limiting

```typescript
// 가입 관련 공개 API에 특화된 rate-limit
const SIGNUP_RATE_LIMITS = {
  'otp-send':     { key: 'phone', max: 3,  windowMs: 86400_000 },  // 일 3회/번호
  'otp-verify':   { key: 'phone', max: 10, windowMs: 600_000 },    // 10분 10회
  'check-login':  { key: 'ip',    max: 20, windowMs: 60_000 },     // 분 20회
  'check-team':   { key: 'ip',    max: 20, windowMs: 60_000 },
  'signup':       { key: 'ip',    max: 5,  windowMs: 3600_000 },   // 시간 5회
};
```

---

## 6. 혁신 ⑥: 프론트엔드 모듈화 & 상태 관리

### 문제

현재 **20개 JS 파일이 전역 함수로 로드**되어:
- 파일 간 의존성이 불명확 (어느 것이 먼저 로드되어야 하는지 주석만으로)
- `currentUser`, `currentPage` 같은 전역 변수에 의존
- 위저드(4단계 가입) 구현 시 단계별 상태 관리가 극히 어려움

### 혁신 설계: 경량 상태 관리자 (Store)

```javascript
// public/static/js/core/store.js — 미니멀 상태 관리
window.OMS = window.OMS || {};

OMS.Store = {
  _state: {},
  _listeners: {},

  get(key) { return this._state[key]; },

  set(key, value) {
    const old = this._state[key];
    this._state[key] = value;
    // 변경 시 구독자 알림
    (this._listeners[key] || []).forEach(fn => fn(value, old));
    return value;
  },

  // 중첩 상태 업데이트
  update(key, updater) {
    const old = this._state[key];
    const next = typeof updater === 'function' ? updater(old) : { ...old, ...updater };
    return this.set(key, next);
  },

  // 구독 (컴포넌트에서 반응형 업데이트)
  on(key, listener) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(listener);
    return () => { // unsubscribe
      this._listeners[key] = this._listeners[key].filter(fn => fn !== listener);
    };
  },

  // 일괄 초기화
  reset(keys) {
    (keys || Object.keys(this._state)).forEach(k => delete this._state[k]);
  },
};

// 위저드 상태 관리 예시
OMS.Store.set('signup', {
  step: 1,
  phone: '',
  phoneVerified: false,
  phoneVerifyToken: null,
  loginId: '',
  password: '',
  name: '',
  teamName: '',
  distributorId: null,
  selectedRegions: [],      // 총판 권역 내 선택
  additionalRegions: [],    // 권역 외 추가 요청
});

// Step 전환
function nextSignupStep() {
  OMS.Store.update('signup', prev => ({ ...prev, step: prev.step + 1 }));
}
```

### 의존성 명시 & 로딩 순서 보장

```javascript
// public/static/js/core/loader.js — 모듈 로더
OMS.Module = {
  _loaded: new Set(),
  _modules: {},

  define(name, deps, factory) {
    this._modules[name] = { deps, factory, resolved: false };
  },

  async load(name) {
    if (this._loaded.has(name)) return;
    const mod = this._modules[name];
    if (!mod) throw new Error(`Module ${name} not found`);

    // 의존성 먼저 로드
    for (const dep of mod.deps) {
      await this.load(dep);
    }

    if (!mod.resolved) {
      await mod.factory();
      mod.resolved = true;
    }
    this._loaded.add(name);
  }
};

// 사용
OMS.Module.define('signup-wizard', ['store', 'api', 'ui'], () => {
  // 가입 위저드 코드
  window.renderSignupPage = function() { /* ... */ };
});
```

---

## 7. 혁신 ⑦: 통합 알림 시스템

### 설계

가입 승인/거절, 권역 추가 요청, 정산 완료 등 **이벤트 기반 알림**:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_user_id INTEGER NOT NULL REFERENCES users(user_id),
  type TEXT NOT NULL, -- 'SIGNUP_APPROVED', 'SIGNUP_REJECTED', 'REGION_ADD_REQUEST', etc.
  title TEXT NOT NULL,
  message TEXT,
  link_url TEXT,        -- 클릭 시 이동할 경로
  is_read INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notif_user ON notifications(recipient_user_id, is_read);
CREATE INDEX idx_notif_date ON notifications(created_at);
```

```typescript
// src/lib/notification.ts — 알림 생성 유틸
export async function notify(
  db: D1Database,
  recipients: number | number[],
  type: string,
  title: string,
  options?: { message?: string; link?: string; metadata?: any }
): Promise<D1PreparedStatement[]> {
  const userIds = Array.isArray(recipients) ? recipients : [recipients];
  return userIds.map(uid =>
    db.prepare(`
      INSERT INTO notifications (recipient_user_id, type, title, message, link_url, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(uid, type, title, options?.message || null, options?.link || null,
            JSON.stringify(options?.metadata || {}))
  );
}

// 사용 예시: 가입 승인 시
const batch = new BatchBuilder();
// ... 가입 승인 SQL ...
batch.addAll(await notify(db, newUserId, 'SIGNUP_APPROVED',
  '가입이 승인되었습니다', { message: '이제 로그인하여 서비스를 이용하세요.', link: '#my-orders' }));
await batch.execute(db);
```

### 프론트엔드 알림 배지

```javascript
// 사이드바 상단에 벨 아이콘 + 읽지 않은 수 배지
async function updateNotificationBadge() {
  const res = await api('GET', '/notifications/unread-count');
  const badge = document.getElementById('notif-badge');
  if (badge && res?.count > 0) {
    badge.textContent = res.count > 99 ? '99+' : res.count;
    badge.classList.remove('hidden');
  } else if (badge) {
    badge.classList.add('hidden');
  }
}
// 30초마다 폴링 (Cloudflare Workers에서 WebSocket 불가)
setInterval(updateNotificationBadge, 30000);
```

---

## 8. 혁신 ⑧: 감사 로그 체계 강화

### 문제

현재 `audit_logs.action`이 자유 텍스트 → 검색/분석 어려움.

### 혁신 설계: 구조화된 이벤트 코드

```typescript
// src/types/audit-events.ts
export const AUDIT_EVENTS = {
  // 인증
  AUTH_LOGIN:                'AUTH.LOGIN',
  AUTH_LOGIN_FAILED:         'AUTH.LOGIN_FAILED',
  AUTH_LOGOUT:               'AUTH.LOGOUT',

  // 가입
  SIGNUP_OTP_SENT:           'SIGNUP.OTP_SENT',
  SIGNUP_OTP_VERIFIED:       'SIGNUP.OTP_VERIFIED',
  SIGNUP_REQUEST_CREATED:    'SIGNUP.REQUEST_CREATED',
  SIGNUP_APPROVED:           'SIGNUP.APPROVED',
  SIGNUP_REJECTED:           'SIGNUP.REJECTED',
  SIGNUP_REAPPLY:            'SIGNUP.REAPPLY',

  // 총판 관리
  DISTRIBUTOR_CREATED:       'DISTRIBUTOR.CREATED',
  DISTRIBUTOR_REGION_ADDED:  'DISTRIBUTOR.REGION_ADDED',
  DISTRIBUTOR_REGION_REMOVED:'DISTRIBUTOR.REGION_REMOVED',
  DISTRIBUTOR_TEAM_MAPPED:   'DISTRIBUTOR.TEAM_MAPPED',

  // 주문
  ORDER_CREATED:             'ORDER.CREATED',
  ORDER_DISTRIBUTED:         'ORDER.DISTRIBUTED',
  ORDER_ASSIGNED:            'ORDER.ASSIGNED',
  ORDER_STATUS_CHANGED:      'ORDER.STATUS_CHANGED',

  // 정산
  SETTLEMENT_CALCULATED:     'SETTLEMENT.CALCULATED',
  SETTLEMENT_CONFIRMED:      'SETTLEMENT.CONFIRMED',

  // 대사
  RECONCILIATION_RUN:        'RECONCILIATION.RUN',
  RECONCILIATION_RESOLVED:   'RECONCILIATION.RESOLVED',

  // 조직
  ORG_CREATED:               'ORG.CREATED',
  ORG_STATUS_CHANGED:        'ORG.STATUS_CHANGED',

  // 사용자
  USER_CREATED:              'USER.CREATED',
  USER_STATUS_CHANGED:       'USER.STATUS_CHANGED',
  USER_PASSWORD_CHANGED:     'USER.PASSWORD_CHANGED',
  USER_ROLE_CHANGED:         'USER.ROLE_CHANGED',
} as const;
```

### 감사 로그 검색 API

```typescript
GET /api/audit-logs?
  event=SIGNUP.*&          // 와일드카드
  actor_id=3&
  from=2026-03-01&
  to=2026-03-04&
  entity_type=SIGNUP_REQUEST&
  page=1&limit=50
```

---

## 9. 혁신 ⑨: 정산 엔진 2.0 — 팀 단위 정산

### 문제

현재 `settlements` 테이블이 `team_leader_id`를 직접 참조 → TEAM org_type 도입 시 **팀 단위 정산**이 불가능 (팀장 교체 시 이전 팀장 정산 이력이 사라짐).

### 혁신 설계

```sql
-- settlements 테이블 변경:
ALTER TABLE settlements ADD COLUMN team_org_id INTEGER REFERENCES organizations(org_id);
-- team_org_id = 팀 조직 (영속), team_leader_id = 실행한 팀장 (시점 기록)
```

```typescript
// 정산 산출 시:
const teamOrg = await db.prepare(`
  SELECT org_id FROM organizations WHERE org_id = (
    SELECT org_id FROM users WHERE user_id = ?
  )
`).bind(order.team_leader_id).first();

// settlement INSERT에 team_org_id 포함
// → 팀장이 바뀌어도 팀 단위 집계는 유지
```

---

## 10. 혁신 ⑩: 대사(Reconciliation) 엔진 확장

### 문제

현재 7개 규칙이 **for 루프 안에서 개별 INSERT** → N건 * 7규칙 = 최악 7N회 DB 호출.
신규 시스템에서 추가해야 할 규칙:

### 추가 규칙

| # | 규칙 | 설명 |
|---|------|------|
| 8 | REGION_MAPPING_CONFLICT | 같은 읍면동이 2개 이상 총판에 매핑 |
| 9 | TEAM_NO_REGION | 팀에 권역 매핑이 0건 |
| 10 | ORPHAN_TEAM | 팀이 존재하나 parent_org가 비활성 |
| 11 | SIGNUP_STALE | 가입 신청 후 7일 이상 미처리 |
| 12 | COMMISSION_MISSING | 활성 팀에 수수료 정책 미설정 |

### batch 기반 최적화

```typescript
// 전체 이슈를 메모리에 수집 → 1회 batch INSERT
const issues: { orderId: number; type: string; severity: string; detail: any }[] = [];

// 1. 중복 검사 (1 쿼리)
const dups = await db.prepare('...').all();
for (const d of dups.results) {
  issues.push({ orderId: d.order_id, type: 'DUPLICATE_ORDER', severity: 'HIGH', detail: {...} });
}
// ... 12개 규칙 모두 issues 배열에 추가

// 최종 batch INSERT (1회)
const batch = new BatchBuilder();
for (const issue of issues) {
  batch.add(db.prepare(`INSERT INTO reconciliation_issues ...`).bind(
    runId, issue.orderId, issue.type, issue.severity, JSON.stringify(issue.detail)
  ));
}
batch.add(db.prepare(`UPDATE reconciliation_runs SET ...`).bind(issues.length, runId));
await batch.execute(db);
```

---

## 11. 전체 아키텍처 다이어그램 (TO-BE)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Pages                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Static HTML  │  │  Frontend JS  │  │  Core Libraries      │  │
│  │  TailwindCSS  │  │  (Pages)      │  │  store.js (state)    │  │
│  │  FontAwesome  │  │  signup.js    │  │  loader.js (deps)    │  │
│  │              │  │  dist.js      │  │  api.js (http)       │  │
│  │              │  │  org-tree.js  │  │  auth.js (session)   │  │
│  │              │  │  approvals.js │  │  ui.js (toast/modal) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                    │                   │               │
│         └────────────────────┼───────────────────┘               │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     Hono API Router                        │  │
│  │                                                            │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐  │  │
│  │  │  auth    │ │  signup   │ │distributors│ │ admin-     │  │  │
│  │  │(login/  │ │(OTP,reg, │ │(CRUD,      │ │ regions    │  │  │
│  │  │ me)     │ │ status)  │ │ regions,   │ │ (search)   │  │  │
│  │  └─────────┘ └──────────┘ │ teams)     │ └────────────┘  │  │
│  │                            └────────────┘                  │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐  │  │
│  │  │ orders  │ │ settle-  │ │ reconcil-  │ │  stats     │  │  │
│  │  │(CRUD,   │ │ ments    │ │ iation     │ │(dashboard, │  │  │
│  │  │ dist,   │ │(runs,    │ │(engine     │ │ reports)   │  │  │
│  │  │ assign, │ │ calc,    │ │ 12 rules)  │ └────────────┘  │  │
│  │  │ review) │ │ confirm) │ └────────────┘                  │  │
│  │  └─────────┘ └──────────┘                                  │  │
│  │                                                            │  │
│  │  ┌───────────────── Shared Libraries ───────────────────┐  │  │
│  │  │ scope-engine │ state-machine │ batch-tx │ dist-engine│  │  │
│  │  │ notification │ audit-events  │ security │ validators │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Cloudflare D1 (SQLite)                   │  │
│  │                                                            │  │
│  │  [Core]           [Signup/Org]        [Business]           │  │
│  │  organizations    admin_regions       orders                │  │
│  │  users            org_region_mappings order_distributions   │  │
│  │  roles            signup_requests     order_assignments     │  │
│  │  user_roles       signup_req_regions  work_reports          │  │
│  │  sessions         region_add_requests reviews               │  │
│  │                   team_dist_mappings  settlements           │  │
│  │  [Notification]                      settlement_runs       │  │
│  │  notifications    [Policy]           reconciliation_*      │  │
│  │                   distribution_pol   *_daily_stats          │  │
│  │  [Audit]          report_policies    team_leader_ledger    │  │
│  │  audit_logs       commission_pol                            │  │
│  │                   metrics_policies                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. 파일 구조 (최종)

```
webapp/src/
├── index.tsx                    # 엔트리 (Hono 앱 + 라우트 마운트)
├── types/
│   ├── index.ts                 # 핵심 타입 (OrgType 'TEAM' 추가)
│   └── audit-events.ts          # [NEW] 감사 이벤트 코드
├── middleware/
│   ├── auth.ts                  # [MODIFY] org_type 'TEAM' 대응
│   └── security.ts              # [MODIFY] 가입 rate-limit 추가
├── lib/
│   ├── scope-engine.ts          # [NEW] 혁신② — 통합 스코프 엔진
│   ├── state-machine.ts         # [NEW] 혁신① — 상태 머신
│   ├── batch-transaction.ts     # [NEW] 혁신③ — D1 batch 래퍼
│   ├── distribution-engine.ts   # [NEW] 혁신④ — 통합 배분 엔진
│   ├── notification.ts          # [NEW] 혁신⑦ — 알림 유틸
│   ├── audit.ts                 # [MODIFY] 구조화된 이벤트 코드
│   ├── db-helpers.ts            # 기존 유지
│   └── validators.ts            # [MODIFY] 가입 검증 추가
├── routes/
│   ├── auth.ts                  # [MODIFY] 가입 링크, TEAM 대응
│   ├── signup/                  # [NEW] v4.0
│   │   ├── index.ts
│   │   ├── phone-verify.ts
│   │   ├── register.ts
│   │   └── validators.ts
│   ├── distributors/            # [NEW] v4.0
│   │   ├── index.ts
│   │   ├── crud.ts
│   │   ├── regions.ts
│   │   └── teams.ts
│   ├── admin-regions/           # [NEW] v4.0
│   │   └── index.ts
│   ├── organizations/           # [NEW] v4.0
│   │   └── index.ts
│   ├── signup-approvals/        # [NEW] v4.0
│   │   └── index.ts
│   ├── notifications/           # [NEW] 혁신⑦
│   │   └── index.ts
│   ├── orders/                  # [MODIFY] scope-engine, state-machine 적용
│   │   ├── index.ts
│   │   ├── crud.ts
│   │   ├── distribute.ts        # distribution-engine 사용
│   │   ├── assign.ts
│   │   ├── report.ts
│   │   └── review.ts
│   ├── settlements/             # [MODIFY] batch-tx 적용
│   │   ├── index.ts
│   │   ├── runs.ts
│   │   └── calculation.ts
│   ├── reconciliation/          # [MODIFY] batch + 추가 규칙
│   │   ├── index.ts
│   │   ├── engine.ts
│   │   └── issues.ts
│   ├── stats/                   # [MODIFY] scope-engine 적용
│   │   ├── index.ts
│   │   ├── dashboard.ts
│   │   ├── reports.ts
│   │   └── policies.ts
│   └── hr/                      # [MODIFY] TEAM org 대응
│       ├── index.ts
│       ├── organizations.ts
│       ├── users.ts
│       ├── phone-verify.ts
│       └── commission.ts

webapp/public/static/js/
├── core/
│   ├── store.js                 # [NEW] 혁신⑥ — 상태 관리
│   ├── loader.js                # [NEW] 혁신⑥ — 모듈 로더
│   ├── constants.js             # [MODIFY] 총판/가입 메뉴 추가
│   ├── api.js
│   ├── auth.js                  # [MODIFY] 가입 링크
│   ├── ui.js                    # [MODIFY] 알림 배지 추가
│   └── app.js                   # [MODIFY] 신규 페이지 라우팅
├── shared/
│   ├── table.js
│   └── form-helpers.js
├── pages/
│   ├── signup.js                # [NEW] 4단계 위저드
│   ├── distributors.js          # [NEW] 총판 관리
│   ├── org-tree.js              # [NEW] 조직 트리/테이블
│   ├── signup-approvals.js      # [NEW] 가입 승인
│   ├── notifications.js         # [NEW] 알림 센터
│   ├── dashboard.js
│   ├── orders.js
│   ├── kanban.js
│   ├── review.js
│   ├── settlement.js
│   ├── statistics.js
│   ├── hr.js
│   └── my-orders.js

webapp/migrations/
├── 0001_initial_schema.sql       # 기존
├── 0002_team_signup_system.sql   # [NEW] v4.0 스키마
└── 0003_innovation_v5.sql        # [NEW] v5.0 (notifications, settlements.team_org_id 등)

webapp/seed/
├── admin_regions_nationwide.sql  # [NEW] 전국 읍면동 ~5000건
└── seed_v2.sql                   # [NEW] 신규 테스트 데이터
```

---

## 13. 구현 우선순위 (갱신)

### Phase 1: 기반 (⭐ 필수)

| 순서 | 작업 | 복잡도 | 혁신 |
|------|------|--------|------|
| 1.1 | DB 마이그레이션 0002 + 0003 | 중 | — |
| 1.2 | admin_regions 전국 시드 | 중 | — |
| 1.3 | 기존 데이터 마이그레이션 (이름+TEAM+재매핑) | 중 | — |
| 1.4 | **scope-engine.ts** | 중 | ② |
| 1.5 | **state-machine.ts** | 중 | ① |
| 1.6 | **batch-transaction.ts** | 낮음 | ③ |

### Phase 2: 총판 & 배분 (⭐ 필수)

| 순서 | 작업 | 복잡도 | 혁신 |
|------|------|--------|------|
| 2.1 | **distribution-engine.ts** | 중 | ④ |
| 2.2 | 행정구역 검색 API | 낮음 | — |
| 2.3 | 총판 CRUD + 권역 관리 API | 높음 | — |
| 2.4 | 기존 라우트 scope-engine 적용 | 중 | ② |
| 2.5 | 기존 라우트 state-machine 적용 | 중 | ① |

### Phase 3: 가입 시스템 (⭐ 필수)

| 순서 | 작업 | 복잡도 | 혁신 |
|------|------|--------|------|
| 3.1 | 가입 OTP API (토큰 기반) | 중 | ⑤ |
| 3.2 | 가입 신청/재신청 API | 중 | — |
| 3.3 | 가입 승인 API (batch 트랜잭션) | 높음 | ③ |
| 3.4 | **notification.ts** + 알림 API | 중 | ⑦ |

### Phase 4: 프론트엔드 (⭐ 필수)

| 순서 | 작업 | 복잡도 | 혁신 |
|------|------|--------|------|
| 4.1 | **store.js** + **loader.js** | 중 | ⑥ |
| 4.2 | 가입 위저드 (4단계) | 높음 | — |
| 4.3 | 총판 관리 페이지 | 높음 | — |
| 4.4 | 조직 트리/테이블 페이지 | 중 | — |
| 4.5 | 가입 승인 페이지 | 높음 | — |
| 4.6 | 로그인 화면 + 메뉴 업데이트 | 낮음 | — |
| 4.7 | 알림 센터 UI | 중 | ⑦ |

### Phase 5: 품질 (권장)

| 순서 | 작업 | 복잡도 | 혁신 |
|------|------|--------|------|
| 5.1 | 정산 엔진 batch 리팩터링 | 중 | ③,⑨ |
| 5.2 | 대사 엔진 확장 (12규칙) | 중 | ⑩ |
| 5.3 | 감사 이벤트 코드 구조화 | 낮음 | ⑧ |
| 5.4 | 통합 테스트 | 중 | — |

---

## 14. 혁신 요약 — 정량적 비교

| # | 혁신 | AS-IS | TO-BE | 개선율 |
|---|------|-------|-------|--------|
| ① | 상태 머신 | 상태 변경 15곳 분산 | 1곳 중앙 | 코드 -93% |
| ② | 스코프 엔진 | 8곳 120줄 하드코딩 | 1곳 60줄 | 코드 -87%, 변경비용 -87% |
| ③ | D1 batch | 정산 10건 = 60회 DB호출 | 1회 batch | DB호출 -98%, RTT -98% |
| ④ | 배분 엔진 | 레거시만 참조 | 신규+레거시 통합 | 정확도 100% |
| ⑤ | 인증 강화 | verified 플래그만 | 서명 토큰+만료 | 보안 ↑↑ |
| ⑥ | FE 상태관리 | 전역 변수 | Store 패턴 | 유지보수 ↑↑ |
| ⑦ | 알림 시스템 | 없음 | 이벤트 기반 알림 | UX ↑↑ |
| ⑧ | 감사 강화 | 자유 텍스트 | 구조화 코드 | 검색성 ↑↑ |
| ⑨ | 팀 단위 정산 | 팀장ID 직접 참조 | team_org_id | 영속성 ↑↑ |
| ⑩ | 대사 확장 | 7규칙, for루프 INSERT | 12규칙, batch | 커버리지 +71%, 성능 ↑ |

---

## 15. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| D1 batch 100개 제한 | 대규모 정산 시 초과 | batch 분할 실행 (chunk 50) |
| 전국 읍면동 시드 (~5000건) | 초기 로드 시간 | 마이그레이션 1회, 이후 캐시 |
| 프론트 Store 마이그레이션 | 기존 페이지 호환성 | 점진적 적용 (신규 페이지 먼저) |
| scope-engine 통합 | 기존 로직 깨질 위험 | 단위 테스트 선행, 병행 운영 후 전환 |

---

## 16. 확정 대기 항목

위 10가지 혁신 포인트에 대해:

1. **전체 적용 승인**: 10가지 혁신 모두 적용할지, 선택적 적용할지?
2. **Phase 구분**: 위 5-Phase 순서 동의하는지?
3. **추가 요구사항**: 위에서 다루지 않은 기능이나 개선 사항이 있는지?

승인 후 Phase 1부터 즉시 구현을 시작합니다.
