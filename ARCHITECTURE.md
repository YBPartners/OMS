# 와이비 OMS — 시스템 아키텍처 (v7.0)

> **최종 업데이트**: 2026-03-05
> **이 문서는 새 대화에서 컨텍스트 복구용 — 반드시 먼저 읽을 것**

---

## 1. 기술 스택

| 계층 | 기술 | 비고 |
|------|------|------|
| Runtime | Cloudflare Workers (Edge) | 10ms CPU 제한 (free) |
| Framework | Hono v4 | TypeScript, 경량 라우팅 |
| Database | Cloudflare D1 (SQLite) | 로컬: `--local` 모드 |
| Frontend | Vanilla JS + TailwindCSS (CDN) | SPA, 모듈 분리 |
| Icons | FontAwesome 6.5 (CDN) | |
| Charts | Chart.js 4.4 (CDN) | 통계 페이지 |
| Build | Vite + @hono/vite-cloudflare-pages | `dist/_worker.js` 산출 |
| Dev Server | wrangler pages dev (PM2 관리) | port 3000 |
| Deployment | Cloudflare Pages | `wrangler pages deploy dist` |

---

## 2. 프로젝트 디렉터리 구조

```
/home/user/webapp/
├── src/                          # Backend (TypeScript)
│   ├── index.tsx                 # Hono 앱 진입점, 라우트 마운트, SPA HTML
│   ├── types/index.ts            # 타입 정의 (Env, SessionUser, RoleCode 등)
│   ├── middleware/
│   │   ├── auth.ts               # 세션 인증 미들웨어 (→ session-service 위임)
│   │   └── security.ts           # PBKDF2 비밀번호, Rate Limiting
│   ├── lib/
│   │   ├── scope-engine.ts       # 역할별 데이터 가시성 v7.0 (HQ→REGION→AGENCY→TEAM)
│   │   ├── state-machine.ts      # 주문 상태 전이 규칙 (13단계, AGENCY_LEADER 포함)
│   │   ├── batch-builder.ts      # D1 batch() 원자적 트랜잭션 래퍼
│   │   ├── audit.ts              # 감사 로그 + 상태 이력 (notification-service 재수출)
│   │   ├── db-helpers.ts         # DB 쿼리 유틸리티
│   │   └── validators.ts         # 입력 검증
│   ├── services/                 # ★ 서비스 레이어 (v6.5)
│   │   ├── index.ts              # 전체 서비스 재수출
│   │   ├── notification-service.ts  # 알림 생성/배치 (유일 쓰기 진입점)
│   │   ├── session-service.ts    # 세션 CRUD/만료정리/무효화 + AGENCY 세션 확장
│   │   ├── hr-service.ts         # 팀+리더 원자적 생성 (6테이블)
│   │   ├── order-lifecycle-service.ts # 정산 확정 → 주문/통계 일괄
│   │   └── stats-service.ts      # 통계 upsert/배치 빌더
│   └── routes/
│       ├── auth.ts               # 로그인/로그아웃 (→ session-service)
│       ├── orders/               # 주문 CRUD, 배분, 배정, 보고서, 검수
│       │   ├── index.ts, crud.ts, distribute.ts, assign.ts, report.ts, review.ts
│       ├── settlements/          # 정산 Run, 산출, 확정 (→ order-lifecycle-service)
│       │   ├── index.ts, runs.ts, calculation.ts
│       ├── reconciliation/       # 대사 실행, 이슈 관리
│       │   ├── index.ts, engine.ts, issues.ts
│       ├── hr/                   # 인사 (→ session-service로 세션 무효화)
│       │   ├── index.ts, users.ts, organizations.ts, commission.ts,
│       │   │   admin-regions.ts, distributors.ts, phone-verify.ts,
│       │   │   channels-agency.ts    ★ v7.0: 채널 + 대리점 API
│       ├── signup/               # 팀장 자가 가입 (→ hr-service, notification-service)
│       │   ├── index.ts, region-add.ts
│       ├── stats/                # 통계: 대시보드, 리포트, 정책
│       │   ├── index.ts, dashboard.ts, reports.ts, policies.ts
│       ├── notifications.ts      # 알림 CRUD
│       └── audit.ts              # 감사 로그 조회/통계
├── public/static/js/             # Frontend (Vanilla JS)
│   ├── core/
│   │   ├── constants.js          # OMS.STATUS, OMS.PERMISSIONS, ROLE_LABELS, 상태맵
│   │   ├── api.js                # fetch 래퍼, 세션 관리
│   │   ├── ui.js                 # 모달, 토스트, 포맷터, 뱃지
│   │   ├── interactions.js       # 팝오버, 컨텍스트메뉴, 드로어, 툴팁, 호버프리뷰, 배치바
│   │   ├── auth.js               # 로그인, 로그아웃, 권한, 라우팅 (AGENCY 포함)
│   │   └── app.js                # 부트스트랩: 레이아웃, 사이드바, 알림폴링, 해시 라우터
│   ├── shared/
│   │   ├── form-helpers.js       # 필터바, 폼필드, 페이지헤더, 액션버튼
│   │   └── table.js              # 테이블 헬퍼
│   └── pages/
│       ├── dashboard.js          # 대시보드
│       ├── orders.js             # 주문관리 + 자동배분
│       ├── kanban.js             # 칸반 보드
│       ├── review.js             # 검수
│       ├── settlement.js         # 정산+대사
│       ├── statistics.js         # 통계
│       ├── hr.js                 # 인사관리
│       ├── my-orders.js          # 팀장 전용 내 주문
│       ├── signup-wizard.js      # 팀장 자가 가입 5단계 위자드
│       ├── signup-admin.js       # 관리자 가입 승인/반려
│       ├── notifications.js      # 알림 센터
│       ├── audit.js              # 감사 로그
│       ├── channels.js           # ★ v7.0: 주문 채널 관리
│       └── agency.js             # ★ v7.0: 대리점 대시보드/주문/팀장
├── migrations/                   # D1 마이그레이션 (6개)
│   ├── 0001_initial_schema.sql
│   ├── 0002_hr_management.sql
│   ├── 0003_team_signup_system.sql
│   ├── 0004_innovation_v5.sql
│   ├── 0005_signup_enhancements.sql
│   └── 0006_channels_agency.sql  # ★ v7.0: 채널 + 대리점 테이블
├── seed.sql                      # 기본 시드 데이터 (대리점 테스트 포함)
├── seed/                         # 추가 시드 (행정구역 등)
├── docs/                         # 설계 문서
├── PROGRESS.md                   # 개발 진척도
├── ARCHITECTURE.md               # 이 문서
├── README.md                     # 프로젝트 개요
├── wrangler.jsonc                # Cloudflare 설정
├── ecosystem.config.cjs          # PM2 설정
├── vite.config.ts                # Vite 빌드 설정
└── package.json                  # 의존성 + 스크립트
```

---

## 3. 서비스 레이어 아키텍처 (v6.5)

> **원칙**: 도메인 간 DB 쓰기는 반드시 서비스 계층을 경유. 읽기(SELECT)는 라우트에서 직접 허용.

### 3.1 의존성 흐름도
```
┌─────────────────────────────────────────────────────────────────┐
│                         Routes (라우트)                           │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ auth.ts  │signup/   │hr/users  │settle/   │region-   │channels- │
│          │index.ts  │.ts       │calc.ts   │add.ts    │agency.ts │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
     │          │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼          ▼
┌─────────┐┌─────────┐┌─────────┐┌──────────┐┌──────────┐│
│session-  ││hr-      ││session- ││order-    ││notific-  ││
│service   ││service  ││service  ││lifecycle ││ation-    ││
│          ││         ││         ││-service  ││service   ││
└────┬─────┘└────┬────┘└────┬────┘└────┬─────┘└────┬─────┘│
     │          │          │          │          │         │
     ▼          ▼          ▼          ▼          ▼         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Tables (D1)                           │
│  sessions | organizations | users | orders | stats              │
│  user_roles | commission_policies | notifications              │
│  order_channels | agency_team_mappings  ← v7.0                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 서비스별 책임

| 서비스 | 소유 테이블 (쓰기) | 호출자 |
|--------|-------------------|--------|
| notification-service | notifications | signup, region-add, channels-agency |
| session-service | sessions | auth, hr/users, middleware/auth |
| hr-service | organizations, users, user_roles, team_distributor_mappings, org_region_mappings, commission_policies | signup |
| order-lifecycle-service | orders, order_assignments, team_leader_ledger_daily, region_daily_stats, team_leader_daily_stats | settlements/calculation |
| stats-service | region_daily_stats, team_leader_daily_stats, team_leader_ledger_daily | order-lifecycle-service |

---

## 4. 데이터 모델 (핵심 테이블)

### 4.1 조직 계층
```
organizations (org_id, org_type, name, code, status, parent_org_id)
  org_type: HQ | REGION | TEAM
  HQ(1) → REGION(2,3,4,5) → TEAM (parent_org_id 참조)
  
  v7.0: AGENCY 계층은 user_roles + agency_team_mappings로 구현
        (별도 org_type 없이, 기존 TEAM 소속 사용자에게 AGENCY_LEADER 역할 부여)
```

### 4.2 사용자/역할
```
users (user_id, org_id, login_id, password_hash, name, phone, email, status)
roles (role_id, code, name) — SUPER_ADMIN, HQ_OPERATOR, REGION_ADMIN, AGENCY_LEADER, TEAM_LEADER, AUDITOR
user_roles (user_id, role_id) — M:N 매핑
sessions (session_id UUID, user_id, expires_at) — 24시간, 사용자당 최대 5개
```

### 4.3 주문 채널 (v7.0)
```
order_channels (channel_id, name, code, description, contact_info, is_active, priority, created_at, updated_at)
  - 다수 주문원장(채널) 관리
  - orders.channel_id로 주문과 연결
```

### 4.4 대리점 매핑 (v7.0)
```
agency_team_mappings (agency_user_id, team_user_id, created_at)
  - 대리점장(AGENCY_LEADER) ↔ 팀장(TEAM_LEADER) 매핑
  - 한 팀장은 하나의 대리점에만 소속
  - 대리점장은 TEAM_LEADER + AGENCY_LEADER 역할 동시 보유
```

### 4.5 주문 상태 전이 (State Machine)
```
RECEIVED → VALIDATED → DISTRIBUTED → ASSIGNED → IN_PROGRESS
→ SUBMITTED → REGION_APPROVED → HQ_APPROVED → SETTLEMENT_CONFIRMED → PAID

분기: SUBMITTED → REGION_REJECTED → (재제출)
      REGION_APPROVED → HQ_REJECTED → (재제출)
      RECEIVED/VALIDATED → DISTRIBUTION_PENDING (행정동 매칭 실패)

v7.0: AGENCY_LEADER 허용 전이:
  - DISTRIBUTED → ASSIGNED (배정)
  - SUBMITTED → REGION_APPROVED/REGION_REJECTED (1차 검수)
```

### 4.6 주문 관련
```
orders (order_id, external_order_no, customer_name, address_text, admin_dong_code,
        base_amount, status, region_org_id, team_leader_id, requested_date, channel_id, ...)
order_distributions (order_id → region_org_id)
order_assignments (order_id → team_leader_id)
work_reports (report_id, order_id, version, note, submitted_at)
reviews (review_id, order_id, stage:REGION|HQ, result:APPROVE|REJECT, comment)
order_status_history (from_status, to_status, actor_id, created_at)
```

### 4.7 정산/대사
```
settlement_runs (run_id, period_start, period_end, status, calculated_at, confirmed_at)
settlements (settlement_id, run_id, order_id, amounts...)
reconciliation_runs (run_id, comparison data)
reconciliation_issues (issue_id, run_id, type, severity, status:OPEN|RESOLVED)
```

### 4.8 기타
```
admin_regions — 행정구역 (sido/sigungu/eupmyeondong, ~5000건)
org_region_mappings — 조직↔행정구역 매핑
commission_policies — 수수료 정책 (updated_at 추가 v7.0)
notifications — 알림 (type, title, message, is_read)
audit_logs — 감사 로그 (entity_type, entity_id, action, actor_id, detail_json)
signup_requests — 팀장 자가 가입 신청
```

---

## 5. 인증/권한 체계

### 5.1 인증 흐름
```
POST /api/auth/login {login_id, password}
→ PBKDF2 검증 (레거시 SHA-256 자동 마이그레이션)
→ session-service.createSession() → sessions 테이블에 UUID 저장 (24시간)
→ Set-Cookie: session_id + JSON 응답 {session_id, user}
→ v7.0: AGENCY_LEADER인 경우 is_agency=true, agency_team_ids 포함
```

### 5.2 미들웨어 체인
```
모든 /api/* → authMiddleware → session-service.validateSession() (세션→user 세팅)
각 라우트 내부 → requireAuth(roles?) 로 권한 체크
```

### 5.3 역할별 권한 (PERMISSIONS 맵)
```
SUPER_ADMIN: 전체 접근 + 채널관리
HQ_OPERATOR: dashboard, orders, distribute, channels, review-hq, settlement, reconciliation, statistics, policies, kanban, hr-management, audit-log, notifications
REGION_ADMIN: dashboard, orders, kanban, review-region, settlement, statistics, hr-management, notifications
AGENCY_LEADER: agency-dashboard, agency-orders, agency-team, review-region, kanban, my-orders, my-stats, notifications  ← v7.0
TEAM_LEADER: dashboard, my-orders, my-stats, my-profile, kanban, notifications
AUDITOR: dashboard, statistics, audit-log, notifications
```

### 5.4 Scope Engine v7.0
```
getUserScope(user) → { orgFilter, userFilter, orgIds, agencyTeamIds }
SUPER_ADMIN: 전체 데이터
REGION_ADMIN: 자기 지역법인 + 하위 팀 데이터
AGENCY_LEADER: 자신 + agency_team_mappings 하위 팀장 데이터  ← v7.0
TEAM_LEADER: 자기 팀 데이터만
```

---

## 6. 프론트엔드 아키텍처

### 6.1 SPA 구조
- `src/index.tsx`의 `getIndexHtml()`이 전체 HTML 셸 반환
- `<script>` 태그로 JS 모듈 순서 로딩 (core → shared → pages → app)
- 해시 라우터: `#dashboard`, `#orders`, `#kanban`, `#agency-dashboard` 등
- `renderContent()`에서 `currentPage`에 따라 분기

### 6.2 JS 로딩 순서 (의존성)
```
1. constants.js  — OMS.STATUS, OMS.PERMISSIONS, OMS.ROLE_LABELS, OMS.MENU_ITEMS
2. api.js        — api() 함수, 세션 관리
3. ui.js         — showModal, showToast, formatAmount 등
4. interactions.js — showDrawer, showContextMenu, showPopover 등
5. auth.js       — login, logout, navigateTo, renderContent, isAgencyLeader()
6. shared/*.js   — form-helpers, table
7. pages/*.js    — 각 페이지 렌더 함수 (agency.js, channels.js 포함)
8. app.js        — render(), renderLayout(), 부트스트랩
```

### 6.3 메뉴 체계 (v7.0)
```
OMS.MENU_ITEMS:
  HQ: [dashboard, orders, distribute, channels, review-hq, settlement, reconciliation, statistics, hr-management, policies, audit-log, notifications]
  REGION: [dashboard, kanban, review-region, hr-management, statistics, notifications]
  AGENCY: [agency-dashboard, agency-orders, agency-team, kanban, review-region, my-orders, my-stats, notifications]  ← v7.0
  TEAM_LEADER: [my-orders, my-stats, notifications]
```

### 6.4 인터랙션 디자인 시스템 (interactions.js)
```
IX 전역 상태: activePopover, activeContextMenu, activeDrawer, activeTooltip, batchBar

컴포넌트:
- showPopover(anchor, content, options) — 요소 근처 풍선
- showContextMenu(x, y, items, options) — 우클릭 메뉴
- showDrawer(content, options) — 사이드 패널 (right/left)
- showTooltip(anchor, text) — 경량 힌트
- initHoverPreview() — data-preview 속성 자동 바인딩 (350ms)
- showBatchActionBar(items, actions) — 하단 배치 액션
- showOrderContextMenu(e, order) — 주문 우클릭 통합 메뉴
- _renderStatusProgress(status) — 상태 진행 바
- renderStatusFlowLarge(status, history) — 상세 상태 플로우
- showSkeletonLoading(el, type) — 스켈레톤 로딩
```

---

## 7. API 엔드포인트 전체 맵

### 인증 (auth.ts → session-service)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | /api/auth/login | X | 로그인 (login_id, password) |
| POST | /api/auth/logout | O | 로그아웃 |
| GET | /api/auth/me | O | 세션 사용자 정보 (v7.0: is_agency, agency_team_ids) |
| GET | /api/auth/users | O (HQ/REGION) | 사용자 목록 |
| GET | /api/auth/organizations | O | 조직 목록 |
| GET | /api/auth/team-leaders | O (HQ/REGION) | 팀장 목록 |

### 주문 (orders/)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/orders | 목록 (필터/페이지네이션, v7.0: channel_id 필터) |
| GET | /api/orders/:id | 상세 (order + history + reports + reviews) |
| POST | /api/orders | 수동 등록 |
| POST | /api/orders/import | 일괄 수신 (JSON) |
| POST | /api/orders/distribute | 자동 배분 (행정동 기반) |
| PATCH | /api/orders/:id/distribution | 수동 배분 |
| POST | /api/orders/:id/assign | 팀장 배정 (v7.0: AGENCY_LEADER 허용) |
| POST | /api/orders/batch-assign | 배치 배정 (최대 50건, v7.0: AGENCY_LEADER 허용) |
| POST | /api/orders/:id/unassign | 배정 해제 (v7.0: AGENCY_LEADER 허용) |
| POST | /api/orders/:id/start | 작업 시작 |
| POST | /api/orders/:id/reports | 보고서 제출 |
| POST | /api/orders/:id/review/region | 지역 1차 검수 (v7.0: AGENCY_LEADER 허용) |
| POST | /api/orders/:id/review/hq | HQ 2차 검수 |

### 주문 채널 (v7.0 — hr/channels-agency.ts)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | /api/hr/channels | O | 채널 목록 (주문 수/금액 통계) |
| POST | /api/hr/channels | O (HQ) | 채널 생성 |
| PUT | /api/hr/channels/:channel_id | O (HQ) | 채널 수정 |

### 대리점 (v7.0 — hr/channels-agency.ts)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | /api/hr/agencies | O (HQ/REGION) | 대리점 목록 |
| GET | /api/hr/agencies/:user_id | O (HQ/REGION/AGENCY) | 대리점 상세 (하위 팀장) |
| POST | /api/hr/agencies/promote | O (HQ/REGION) | 대리점 권한 부여 |
| POST | /api/hr/agencies/demote | O (HQ/REGION) | 대리점 권한 해제 |
| POST | /api/hr/agencies/:agency_id/add-team | O (HQ/REGION) | 팀장 추가 |
| POST | /api/hr/agencies/:agency_id/remove-team | O (HQ/REGION) | 팀장 제거 |
| GET | /api/hr/agencies/:agency_id/candidates | O (HQ/REGION) | 배정 후보 팀장 |

### 정산 (settlements/ → order-lifecycle-service)
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | /api/settlements/runs | Run 목록/생성 |
| POST | /api/settlements/runs/:id/calculate | 산출 |
| POST | /api/settlements/runs/:id/confirm | 확정 |
| GET | /api/settlements/runs/:id/details | 상세 |

### 대사 (reconciliation/)
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | /api/reconciliation/runs | 대사 실행 |
| GET | /api/reconciliation/issues | 이슈 목록 |
| PATCH | /api/reconciliation/issues/:id/resolve | 이슈 해결 |

### HR (hr/ → session-service)
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | /api/hr/users | 사용자 CRUD |
| GET/PUT | /api/hr/users/:id | 상세/수정 |
| POST | /api/hr/users/:id/set-credentials | ID/PW 설정 |
| POST | /api/hr/users/:id/reset-password | 비밀번호 초기화 |
| GET/POST | /api/hr/organizations | 조직 CRUD |
| GET/POST | /api/hr/commission-policies | 수수료 정책 |
| GET | /api/hr/regions/* | 행정구역 (sido/sigungu/dong/search) |
| GET/POST | /api/hr/distributors | 총판 관리 |

### 가입 (signup/ → hr-service, notification-service)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | /api/signup/check-phone | X | 전화번호 중복 확인 |
| POST | /api/signup/send-otp | X | OTP 발송 |
| POST | /api/signup/verify-otp | X | OTP 검증 |
| POST | /api/signup/submit | X | 가입 신청 |
| GET | /api/signup/status | X | 신청 상태 조회 |
| GET | /api/signup/requests | O | 관리자: 신청 목록 |
| POST | /api/signup/admin/approve | O | 승인 |
| POST | /api/signup/admin/reject | O | 반려 |

### 통계 (stats/)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/stats/dashboard | 대시보드 요약 |
| GET | /api/stats/regions/daily | 지역별 일별 통계 |
| GET | /api/stats/team-leaders/daily | 팀장별 일별 통계 |
| GET | /api/stats/export/csv | CSV 내보내기 |
| GET/PUT | /api/stats/policies/* | 정책 관리 |

### 알림/감사
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/notifications | 알림 목록 |
| GET | /api/notifications/unread-count | 미읽음 수 |
| PATCH | /api/notifications/:id/read | 읽음 처리 |
| POST | /api/notifications/read-all | 전체 읽음 |
| DELETE | /api/notifications/:id | 알림 삭제 |
| GET | /api/audit | 감사 로그 목록 |
| GET | /api/audit/stats | 감사 통계 |
| GET | /api/audit/:id | 감사 상세 |

---

## 8. 빌드/배포/운영

### 8.1 로컬 개발
```bash
cd /home/user/webapp
npm run build                    # Vite → dist/_worker.js
pm2 start ecosystem.config.cjs   # wrangler pages dev dist --d1=dahada-production --local
curl http://localhost:3000/api/health
```

### 8.2 DB 관리
```bash
npx wrangler d1 migrations apply dahada-production --local  # 마이그레이션 (6개)
npx wrangler d1 execute dahada-production --local --file=./seed.sql  # 시드
npx wrangler d1 execute dahada-production --local --command="SELECT ..."  # 쿼리
```

### 8.3 프로덕션 배포
```bash
npm run build
npx wrangler pages deploy dist --project-name yb-oms
npx wrangler d1 migrations apply dahada-production  # 프로덕션 DB
```

### 8.4 wrangler.jsonc
```jsonc
{
  "name": "yb-oms",
  "compatibility_date": "2026-03-03",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "dahada-production",
    "database_id": "0b7aedd5-7510-44d3-8b81-d421b03fffa6"
  }]
}
```

---

## 9. 새 대화에서 이어가기 위한 체크리스트

1. **먼저 읽을 파일들** (순서대로):
   - `/home/user/webapp/ARCHITECTURE.md` (이 파일) — 전체 구조 이해
   - `/home/user/webapp/PROGRESS.md` — 진행 상태 확인
   - `/home/user/webapp/docs/IMPLEMENTATION_TRACKER.md` — 세부 체크리스트

2. **현재 상태 확인**:
   ```bash
   cd /home/user/webapp && git log --oneline -5
   cd /home/user/webapp && pm2 list
   curl http://localhost:3000/api/health
   ```

3. **DB 상태 확인**:
   ```bash
   npx wrangler d1 execute dahada-production --local --command="SELECT COUNT(*) FROM users"
   # 결과가 0이면 → seed.sql 재적용 필요
   npx wrangler d1 execute dahada-production --local --file=./seed.sql
   ```

4. **서비스 재시작**:
   ```bash
   cd /home/user/webapp && npm run build
   fuser -k 3000/tcp 2>/dev/null || true
   pm2 delete all 2>/dev/null || true
   pm2 start ecosystem.config.cjs
   ```
