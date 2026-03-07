# Edge-First Serverless 개발 방법론

> **이 문서는 Airflow OMS(Airflow) 시스템 구축 경험에서 추출한 개발 방법론이다.**
> 동일한 접근법으로 다른 업무 시스템(ERP, CRM, WMS 등)을 빠르게 구축할 수 있다.

---

## 0. 개발 원칙 (모든 작업에 공통 적용)

> **2026-03-07 제정. 2026-03-07 개정(실행 절차 추가).** 이 원칙은 코드, 데이터, 설정, 문서, 성능, 버그 수정 등 모든 종류의 작업에 예외 없이 적용한다.

### 원칙 1. 완료의 정의

사용자가 실제 사용하는 환경에서 동작을 확인해야 완료다. 빌드 성공, 로컬 테스트 통과, 코드 커밋은 중간 과정이지 완료가 아니다.

### 원칙 2. 만든 것은 끝까지 넣는다

코드를 작성했으면 배포한다. 데이터를 작성했으면 투입한다. 설정을 변경했으면 반영한다. 어떤 산출물이든 최종 환경에 도달하지 않았으면 하지 않은 것과 같다.

### 원칙 3. 주장에는 증거를 붙인다

"빨라졌다", "고쳤다", "완료했다"는 말만으로 보고하지 않는다. 실제 측정값, 실행 결과, 화면 확인 등 검증 가능한 근거를 함께 제시한다.

### 원칙 4. 확인은 만든 곳이 아니라 쓰는 곳에서 한다

로컬에서 되는지가 아니라 프로덕션에서 되는지를 확인한다. 개발 환경과 운영 환경이 다르다는 것을 항상 전제한다.

### 원칙 5. 이전 작업을 신뢰하지 않는다

새 작업을 시작할 때 이전에 완료했다고 보고한 것이 실제로 되어 있는지 확인한다. 기억이나 기록이 아니라 현재 상태를 기준으로 판단한다.

### 실행 절차 — 작업 완료 검증 체크리스트

위 5대 원칙은 선언이다. 아래는 그것을 **매 작업마다 실행하는 절차**다. 작업 종류(코드, 데이터, 설정, 성능, 버그, 문서)에 관계없이 동일하게 적용한다.

**4단계 순서:**

| 단계 | 이름 | 내용 |
|------|------|------|
| ① | 만들기 | 코드/데이터/설정 작성. 빌드 성공 확인. |
| ② | 넣기 | 프로덕션 환경에 배포/투입 완료. |
| ③ | 확인하기 | 실제 환경에서 동작 확인. 증거(측정값, 실행 결과, 화면) 첨부. |
| ④ | 기록하기 | PROGRESS.md에 완료 기록. 체크리스트 전항목 통과 확인. |

**규칙:**
- ③을 통과하지 않으면 ①②는 무의미하다.
- ④를 완료하지 않으면 다음 작업을 시작하지 않는다.
- 체크박스가 하나라도 비어 있으면 해당 작업을 "완료"로 표시하지 않는다.

### PROGRESS.md 완료 기록 형식

모든 작업의 완료 기록은 아래 형식을 따른다:

```markdown
### [작업명] ✅ (날짜)

**변경 내용:**
- ...

**프로덕션 검증:**
- [ ] 빌드: OK/FAIL (시각, 결과)
- [ ] 배포: OK/FAIL (커밋, URL)
- [ ] 동작확인: OK/FAIL (증거: 실행 결과 또는 측정값)
- [ ] 데이터확인: OK/FAIL (증거: 쿼리 결과) 또는 N/A
```

- "N/A"는 해당 항목이 이 작업에 적용되지 않을 때만 쓴다.
- 체크박스가 전부 채워져야 ✅를 부여한다.

### 작업 시작 전 확인 절차

새 작업을 시작할 때:
1. 직전 작업의 PROGRESS.md 체크리스트를 읽는다. 빈 항목이 있으면 그 작업부터 마무리한다.
2. 새 작업과 관련된 기존 기능이 실제 환경에서 동작하는지 확인한다.
3. 확인하지 않고 새 작업에 착수하지 않는다.

---

## 1. 핵심 철학 — "Edge-First Serverless"

| 원칙 | 설명 |
|------|------|
| **서버리스 우선** | 서버 프로비저닝/관리 없이 코드만 배포한다. 인프라는 클라우드 엣지가 담당한다. |
| **단일 코드베이스** | 백엔드(API) + 프론트엔드(SPA)를 하나의 저장소에서 관리한다. |
| **점진적 확장** | 최소 기능(MVP)부터 시작해 마이그레이션 단위로 기능을 추가한다. |
| **Zero-Ops** | 빌드 → 배포 → 라이브가 단일 명령(`npm run deploy`)으로 완료된다. |
| **Edge 성능** | 사용자와 가장 가까운 엣지에서 실행되어 글로벌 저지연을 확보한다. |

---

## 2. 기술 스택 선정 기준

### 2.1 필수 기술 스택

| 계층 | 기술 | 선정 이유 |
|------|------|-----------|
| **Runtime** | Cloudflare Workers | 글로벌 엣지, 무료 시작, 자동 스케일링, 유지보수 제로 |
| **Framework** | Hono | 경량(14KB), TypeScript 네이티브, Workers 최적화, Express 유사 API |
| **Database** | Cloudflare D1 (SQLite) | 서버리스 SQL, 마이그레이션 내장, 로컬 개발 지원 |
| **Session/Cache** | Cloudflare KV | 글로벌 키-값 저장소, TTL 지원, ms 단위 읽기 |
| **Frontend** | Vanilla JS + TailwindCSS | 프레임워크 의존성 제로, CDN 로드, 빌드 불필요 |
| **Build** | Vite | 빠른 빌드, HMR, Cloudflare Pages 플러그인 |
| **Deploy** | Wrangler CLI | 로컬 개발/프로덕션 배포 통합 |

### 2.2 선택 기술 (필요 시)

| 용도 | 기술 | 조건 |
|------|------|------|
| 차트 | Chart.js (CDN) | 대시보드/통계 필요 시 |
| 엑셀 | SheetJS (CDN) | 데이터 내보내기 필요 시 |
| 이메일 | Resend API | 알림/보고서 발송 필요 시 |
| 아이콘 | FontAwesome (CDN) | UI 아이콘 필요 시 |
| 파일저장 | Cloudflare R2 | 이미지/파일 업로드 필요 시 |

### 2.3 기술 선택 시 금기사항

```
X  React, Vue, Angular  → 번들 크기 증가, 빌드 복잡성. Vanilla JS로 충분.
X  Express, Nest.js     → Node.js 전용. Workers에서 동작 불가.
X  PostgreSQL, MySQL    → 서버 필요. D1(SQLite)로 대체.
X  Redis                → 서버 필요. KV로 대체.
X  Docker, Kubernetes   → 불필요. Workers가 인프라를 대체.
X  fs, path, crypto     → Node.js API. Web API로 대체.
```

---

## 3. 프로젝트 구조 설계 패턴

### 3.1 디렉터리 구조 (표준)

```
project/
├── src/                          # Backend (TypeScript)
│   ├── index.tsx                 # Hono 앱 진입점 + SPA HTML 렌더링
│   ├── types/index.ts            # 타입 정의 (Env, 도메인 모델, 상태 Enum)
│   ├── middleware/
│   │   ├── auth.ts               # 세션 인증 미들웨어
│   │   └── security.ts           # 비밀번호 해싱, Rate Limiting
│   ├── lib/                      # 공통 라이브러리
│   │   ├── scope-engine.ts       # 역할별 데이터 접근 범위 결정
│   │   ├── state-machine.ts      # 상태 전이 규칙 엔진
│   │   ├── batch-builder.ts      # D1 batch() 트랜잭션 래퍼
│   │   ├── audit.ts              # 감사 로그 유틸리티
│   │   └── validators.ts         # 입력 검증 + 역할 계층 검증
│   ├── services/                 # 서비스 레이어 (도메인 간 쓰기 전담)
│   │   ├── session-service.ts    # 세션 CRUD + KV 캐시
│   │   ├── notification-service.ts # 알림 생성/배치
│   │   └── [domain]-service.ts   # 도메인별 복합 쓰기 로직
│   └── routes/                   # API 라우트 (도메인별 분리)
│       ├── auth.ts               # 인증 (로그인/로그아웃)
│       ├── [domain]/             # 도메인별 하위 라우트
│       │   ├── index.ts          # 라우트 마운트
│       │   └── [feature].ts      # 기능별 라우트
│       ├── notifications.ts
│       └── system.ts             # 시스템 관리
├── public/                       # Frontend (Static)
│   ├── static/js/
│   │   ├── core/                 # 핵심 모듈 (API, Auth, UI, Router)
│   │   ├── shared/               # 공유 컴포넌트 (테이블, 폼)
│   │   └── pages/                # 페이지별 모듈 (Lazy Load)
│   └── static/css/
├── migrations/                   # D1 마이그레이션 (순번 관리)
│   ├── 0001_initial_schema.sql
│   └── 000N_feature_name.sql
├── seed.sql                      # 초기 데이터
├── wrangler.jsonc                # Cloudflare 설정
├── vite.config.ts                # 빌드 설정
├── ecosystem.config.cjs          # PM2 로컬 개발 서버
└── package.json
```

### 3.2 구조 설계 원칙

1. **수평 분리**: `routes/` → `services/` → `lib/` → DB 순으로 의존성이 흐른다.
2. **도메인 그룹핑**: 관련 기능은 같은 디렉터리에 묶는다 (`routes/orders/`, `routes/hr/`).
3. **서비스 레이어 규칙**: 도메인 간 DB 쓰기는 반드시 서비스를 경유한다. 읽기(SELECT)는 라우트에서 직접 허용.
4. **프론트엔드 3계층**: `core/`(프레임워크) → `shared/`(공유) → `pages/`(페이지) 순 의존.

---

## 4. 설계 패턴 — 7대 핵심 패턴

### 4.1 역할 기반 접근 제어 (RBAC)

```
[요청] → authMiddleware → requireAuth(roles) → Scope Engine → [데이터]
```

- **역할 계층 정의**: 숫자 레벨로 상하 관계를 명확히 한다.
  ```typescript
  const ROLE_HIERARCHY = {
    'SUPER_ADMIN': 1,    // 최상위
    'HQ_OPERATOR': 2,
    'REGION_ADMIN': 3,
    'AGENCY_LEADER': 4,
    'TEAM_LEADER': 5,
    'AUDITOR': 6          // 읽기 전용
  };
  ```
- **Guard 함수**: `requireAuth()`, `requireHQ()`, `requireSuperAdmin()` 등 역할 검증 함수를 미들웨어에 구현.
- **Scope Engine**: 역할에 따라 SQL WHERE 절을 자동 생성하여 데이터 가시성을 제어.
- **계층 불변식**: 하위 역할이 상위 역할을 수정/부여할 수 없도록 검증한다 (`canActorModifyTarget()`).

### 4.2 상태 기계 (State Machine)

비즈니스 객체(주문, 정산 등)의 상태 전이를 선언적으로 정의한다.

```typescript
const STATUS_TRANSITIONS: Record<string, TransitionRule> = {
  'RECEIVED':    { next: ['VALIDATED'],    requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'VALIDATED':   { next: ['DISTRIBUTED'],  requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'DISTRIBUTED': { next: ['ASSIGNED'],     requiredRoles: ['REGION_ADMIN'] },
  // ...
};
```

- **단일 전이 함수** `transitionOrder()`에서 존재 확인, 역할 검증, 낙관적 잠금, 이력 기록을 모두 처리.
- 새 상태 추가 시 전이 맵에 한 줄만 추가하면 된다.

### 4.3 감사 로그 (Audit Trail)

모든 쓰기 작업에 `writeAuditLog()`를 호출한다.

```typescript
await writeAuditLog(db, {
  actor_id: user.user_id,
  entity_type: 'ORDER',
  entity_id: orderId,
  action: 'ORDER.STATUS_CHANGED',
  details: JSON.stringify({ from: oldStatus, to: newStatus }),
});
```

- 누가(actor), 무엇을(entity), 어떤 동작을(action), 상세 내역(details)을 항상 기록.

### 4.4 서비스 레이어 패턴

```
라우트(요청 파싱/검증) → 서비스(비즈니스 로직/트랜잭션) → DB
```

- 라우트: HTTP 요청 파싱, 입력 검증, 응답 포맷팅
- 서비스: 복수 테이블 쓰기, 트랜잭션 관리, 도메인 로직
- D1 `batch()`: 여러 SQL을 원자적으로 실행 (트랜잭션 대체)

### 4.5 세션 관리 (KV 캐시 전략)

```
로그인 → D1 + KV 저장 (TTL 24h)
API 요청 → KV 조회 (hit) → 즉시 반환
          → KV 미스 → D1 조회 → KV 재캐시
로그아웃/비활성화 → D1 + KV 동시 삭제
```

### 4.6 점진적 마이그레이션

```bash
migrations/
  0001_initial_schema.sql     # 핵심 테이블
  0002_hr_management.sql      # 인사 기능 추가
  0003_team_signup.sql        # 가입 기능 추가
  ...
  0022_scheduled_time.sql     # 일정 기능 추가
```

- 각 마이그레이션은 `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN` 사용.
- 기존 데이터를 절대 파괴하지 않는 **추가 전용** 원칙.
- 순번으로 의존 순서를 보장.

### 4.7 SPA + Server-Rendered HTML

```typescript
// Hono에서 HTML을 직접 반환
app.get('/', (c) => c.html(`
  <!DOCTYPE html>
  <html>
    <head>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body>
      <div id="app"></div>
      <script src="/static/js/core/app.js"></script>
    </body>
  </html>
`));
```

- 서버에서 HTML 셸을 반환하고, 프론트엔드 JS가 해시 라우터로 SPA 동작.
- 페이지별 JS는 필요 시점에 동적 로드 (코드 분할).

---

## 5. 보안 설계 원칙

### 5.1 인증/인가

| 항목 | 구현 방식 |
|------|-----------|
| 비밀번호 저장 | PBKDF2 (100,000 iterations, 16byte salt) |
| 세션 | UUID v4, D1 + KV 이중 저장, 24시간 TTL |
| 계정 잠금 | 5회 실패 시 5분 잠금 (메모리 Rate Limiter) |
| 역할 검증 | 모든 API 엔드포인트에 `requireAuth(roles)` 적용 |
| 계층 불변식 | 하위 역할은 상위 역할의 데이터를 수정/부여 불가 |

### 5.2 네트워크 보안

| 항목 | 구현 방식 |
|------|-----------|
| CORS | 허용 도메인 화이트리스트 |
| CSP | Content-Security-Policy 헤더 (CDN 도메인만 허용) |
| 클릭재킹 | X-Frame-Options: DENY |
| MIME 스니핑 | X-Content-Type-Options: nosniff |
| 요청 크기 | 일반 1MB / 업로드 5MB / 벌크 10MB 제한 |

### 5.3 데이터 보안

| 항목 | 구현 방식 |
|------|-----------|
| SQL Injection | Prepared Statement (`db.prepare().bind()`) |
| 에러 노출 방지 | 클라이언트에 일반 메시지만 반환, 서버 로그에 상세 기록 |
| 감사 추적 | 모든 CUD 작업에 감사 로그 기록 |
| 비밀 관리 | `.dev.vars`(로컬), `wrangler secret`(프로덕션) |

---

## 6. 개발 워크플로

### 6.1 신규 프로젝트 시작 (5분 세팅)

```bash
# 1. 프로젝트 생성
npm create -y hono@latest my-system -- --template cloudflare-pages --install --pm npm
cd my-system

# 2. Git 초기화
git init && echo "node_modules/\n.wrangler/\ndist/\n.env\n.dev.vars" > .gitignore
git add . && git commit -m "Initial commit"

# 3. Cloudflare 서비스 생성 (필요 시)
npx wrangler d1 create my-system-production        # D1 데이터베이스
npx wrangler kv:namespace create SESSION_CACHE      # KV (세션)

# 4. wrangler.jsonc에 바인딩 추가
# 5. 마이그레이션 작성 → 적용
mkdir migrations
# 0001_initial_schema.sql 작성
npx wrangler d1 migrations apply my-system-production --local

# 6. 로컬 실행
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000/api/health
```

### 6.2 기능 추가 사이클

```
1. 마이그레이션 작성  →  DB 스키마 변경
2. types/index.ts     →  타입 정의 추가
3. routes/[domain].ts →  API 엔드포인트 구현
4. lib/ 또는 services/ → 비즈니스 로직 (필요 시)
5. public/static/js/  →  프론트엔드 UI
6. npm run build      →  빌드
7. 로컬 테스트        →  curl / 브라우저
8. git commit         →  커밋
9. npm run deploy     →  프로덕션 배포
```

### 6.3 배포 명령

```bash
# 로컬 개발
npm run build && pm2 start ecosystem.config.cjs

# 프로덕션 배포 (단일 명령)
npm run deploy
# = npm run build && wrangler pages deploy dist --project-name my-system

# DB 마이그레이션 (프로덕션)
npx wrangler d1 migrations apply my-system-production --remote
```

---

## 7. 다른 시스템 구축 시 적용 가이드

### 7.1 시스템 유형별 적용 예시

| 시스템 | 도메인 라우트 | 상태 기계 | 핵심 테이블 |
|--------|-------------|----------|------------|
| **주문 관리(OMS)** | orders/, settlements/, review/ | 주문 15단계 전이 | orders, assignments, settlements |
| **고객 관리(CRM)** | contacts/, deals/, activities/ | 딜 파이프라인 전이 | contacts, deals, activities |
| **재고 관리(WMS)** | inventory/, inbound/, outbound/ | 입출고 상태 전이 | products, stock, transactions |
| **프로젝트 관리** | projects/, tasks/, sprints/ | 태스크 상태 전이 | projects, tasks, comments |
| **예약 시스템** | bookings/, resources/, schedules/ | 예약 상태 전이 | bookings, resources, slots |

### 7.2 새 시스템 구축 체크리스트

```
□ 1. 도메인 분석
   - 핵심 엔티티 식별 (주문, 고객, 상품 등)
   - 상태 전이 다이어그램 작성
   - 역할과 권한 정의
   - 조직 계층 구조 정의

□ 2. DB 설계
   - 핵심 테이블 마이그레이션 (0001_initial_schema.sql)
   - 역할/권한 테이블 (roles, user_roles)
   - 감사 로그 테이블 (audit_logs)
   - 시드 데이터 작성 (seed.sql)

□ 3. 백엔드 기반
   - types/index.ts (Env, 도메인 타입, 상태 Enum)
   - middleware/auth.ts (세션 인증)
   - middleware/security.ts (PBKDF2, Rate Limit)
   - lib/scope-engine.ts (역할별 데이터 범위)
   - lib/state-machine.ts (상태 전이 엔진)
   - lib/audit.ts (감사 로그)
   - services/session-service.ts (세션 관리)
   - routes/auth.ts (로그인/로그아웃)

□ 4. 프론트엔드 기반
   - core/api.js (fetch 래퍼, 재시도, 오프라인)
   - core/auth.js (로그인, 권한, 라우팅)
   - core/ui.js (모달, 토스트, 포맷터)
   - core/app.js (SPA 부트스트랩, 해시 라우터)
   - core/constants.js (상태/역할 레이블, 권한 맵)

□ 5. 도메인 기능 (반복)
   - 마이그레이션 추가
   - API 라우트 구현
   - 프론트엔드 페이지 구현
   - 테스트 → 커밋 → 배포

□ 6. 운영 준비
   - ARCHITECTURE.md 작성
   - README.md 작성
   - seed 데이터 정비
   - 프로덕션 배포 + DB 마이그레이션
```

### 7.3 재사용 가능한 모듈 (복사해서 사용)

아래 모듈은 시스템에 무관하게 그대로 재사용할 수 있다:

| 모듈 | 파일 | 역할 |
|------|------|------|
| 인증 미들웨어 | `middleware/auth.ts` | 세션 검증, 역할 가드 |
| 보안 유틸리티 | `middleware/security.ts` | PBKDF2, Rate Limit, 입력 검증 |
| Scope Engine | `lib/scope-engine.ts` | 역할별 SQL WHERE 자동 생성 |
| State Machine | `lib/state-machine.ts` | 상태 전이 엔진 (전이맵만 교체) |
| Batch Builder | `lib/batch-builder.ts` | D1 batch() 트랜잭션 래퍼 |
| 감사 로그 | `lib/audit.ts` | 감사 이벤트 기록 |
| 세션 서비스 | `services/session-service.ts` | D1+KV 세션 CRUD |
| API 래퍼 | `core/api.js` | fetch 래퍼, 재시도, 오프라인 감지 |
| SPA 라우터 | `core/app.js` | 해시 라우터, 레이아웃, 권한 기반 메뉴 |
| UI 유틸리티 | `core/ui.js` | 모달, 토스트, 포맷터, CSV/Excel 내보내기 |

---

## 8. Cloudflare Workers 제약 사항과 대응

| 제약 | 한계 | 대응 전략 |
|------|------|-----------|
| CPU 시간 | 10ms (free), 30ms (paid) | 무거운 연산 회피, 배치 분할 |
| 번들 크기 | 10MB (압축) | 프론트엔드 CDN 분리, 백엔드만 번들 |
| D1 쿼리 | 500건/요청 (free) | batch() 활용, 페이지네이션 |
| KV 쓰기 | 1,000/day (free) | 세션 생성만 KV 쓰기, 읽기는 무제한 |
| 파일 시스템 | 없음 | 빌드 시점 정적 파일만. 런타임 파일 X |
| Node.js API | 없음 | Web Crypto API, Fetch API 사용 |
| WebSocket | 제한적 | REST + 폴링으로 대체 |
| 장시간 처리 | 30초 제한 | 배치 분할, 비동기 패턴 |

---

## 9. 품질 관리 원칙

### 9.1 코드 품질

- **TypeScript 필수**: 백엔드 전체에 타입 적용. `any` 최소화.
- **단일 책임**: 하나의 라우트 파일은 하나의 도메인만 담당.
- **에러 처리**: 글로벌 에러 핸들러 + 라우트별 try-catch.
- **버전 주석**: 각 파일 상단에 버전과 변경 이력 기록.

### 9.2 테스트 전략

```bash
# E2E 테스트: curl 기반 API 통합 테스트
# 각 엔드포인트에 대해 성공/실패 케이스 검증
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login_id":"admin","password":"admin123"}' | jq .

# 권한 테스트: 역할별 접근 검증
# REGION_ADMIN이 SUPER_ADMIN 데이터 수정 시도 → 403 확인
```

### 9.3 문서화

| 문서 | 목적 | 갱신 시점 |
|------|------|-----------|
| `ARCHITECTURE.md` | 전체 구조, 데이터 모델, API 맵 | 구조 변경 시 |
| `README.md` | 프로젝트 개요, 실행 방법, URL | 배포 시 |
| `PROGRESS.md` | 개발 진척도, 버전별 변경 내역 | 매 작업 |
| `DEVELOPMENT_METHOD.md` | 이 문서. 개발 방법론 | 방법론 변경 시 |

---

## 10. 성능 최적화 패턴

| 대상 | 기법 | 효과 |
|------|------|------|
| 세션 검증 | KV 캐시 (D1 조회 0회) | 30ms → 5ms |
| 정적 자산 | Cache-Control 헤더 (24시간) | 반복 요청 제거 |
| API 응답 | 참조 데이터 30초 캐시 | DB 부하 감소 |
| SQL 쿼리 | 인덱스 + 페이지네이션 | 대량 데이터 대응 |
| 프론트엔드 | 페이지별 JS 지연 로드 | 초기 로드 최소화 |
| TailwindCSS | PostCSS 빌드 (minify) | CSS 크기 최적화 |

---

## 11. 요약 — 이 방법론의 강점

```
1. 인프라 비용 제로      Cloudflare 무료 티어로 프로덕션 운영 가능
2. 5분 프로젝트 세팅     hono create → wrangler → deploy
3. 글로벌 성능           엣지 실행으로 어디서나 빠른 응답
4. 단일 코드베이스       백엔드+프론트엔드 하나의 저장소
5. 점진적 확장           마이그레이션 단위로 안전하게 기능 추가
6. 재사용 가능 모듈      인증, 권한, 상태 기계 등 복사해서 사용
7. Zero-Ops 배포         npm run deploy 한 줄로 라이브 반영
8. 타입 안전성           TypeScript로 런타임 에러 사전 방지
9. 보안 내장             RBAC, PBKDF2, CSP, 감사 로그 기본 탑재
10. 37,000줄 실증        실제 프로덕션 시스템으로 검증된 방법론
```

---

> **작성일**: 2026-03-07
> **기반 시스템**: Airflow OMS (Airflow) — https://airflow-oms.pages.dev
> **코드량**: Backend 12,190줄 + Frontend 17,385줄 + SQL 4,476줄 = 총 37,200줄
> **엔드포인트**: ~130개 API, 22개 DB 마이그레이션, 44개 테이블
