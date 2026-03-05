# 와이비 OMS — 시스템 아키텍처 (v16.0)

> **최종 업데이트**: 2026-03-05
> **현재 버전**: v16.0.0
> **프로덕션**: https://dahada-oms.pages.dev
> **이 문서는 새 대화에서 컨텍스트 복구용 — 반드시 먼저 읽을 것**

---

## 1. 기술 스택

| 계층 | 기술 | 비고 |
|------|------|------|
| Runtime | Cloudflare Workers (Edge) | 10ms CPU 제한 (free) |
| Framework | Hono v4 | TypeScript, 경량 라우팅 |
| Database | Cloudflare D1 (SQLite) | 로컬: `--local` 모드, 41개 테이블, 10개 마이그레이션 |
| Frontend | Vanilla JS + TailwindCSS (CDN) | SPA, 23개 JS 모듈 |
| Icons | FontAwesome 6.5 (CDN) | |
| Charts | Chart.js 4.4 (CDN) | 대시보드 5종 차트 |
| Excel | SheetJS (CDN) | xlsx 내보내기 |
| Build | Vite + @hono/vite-cloudflare-pages | `dist/_worker.js` 산출 |
| Dev Server | wrangler pages dev (PM2 관리) | port 3000 |
| Deployment | Cloudflare Pages | `wrangler pages deploy dist` |

---

## 2. 프로젝트 디렉터리 구조

```
/home/user/webapp/
├── src/                          # Backend (TypeScript) — 47 파일, 8,902줄
│   ├── index.tsx                 # Hono 앱 진입점, 라우트 마운트, SPA HTML
│   ├── types/index.ts            # 타입 정의 v6.0 (Env, SessionUser, RoleCode, OrderStatus 등)
│   ├── middleware/
│   │   ├── auth.ts               # 세션 인증 미들웨어 (→ session-service 위임)
│   │   └── security.ts           # PBKDF2 비밀번호, Rate Limiting, 계정 잠금
│   ├── lib/
│   │   ├── scope-engine.ts       # 역할별 데이터 가시성 v7.0 (HQ→REGION→AGENCY→TEAM)
│   │   ├── state-machine.ts      # 주문 상태 전이 규칙 (15단계, READY_DONE/DONE 포함)
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
│       ├── auth.ts               # 로그인/로그아웃/계정잠금 (→ session-service)
│       ├── orders/               # 주문 CRUD, 배분, 배정, 보고서, 검수
│       │   ├── index.ts, crud.ts, distribute.ts, assign.ts, report.ts, review.ts
│       ├── settlements/          # 정산 Run, 산출, 확정, 보고서 (→ order-lifecycle-service)
│       │   ├── index.ts, runs.ts, calculation.ts, report.ts
│       ├── reconciliation/       # 대사 실행, 이슈 관리
│       │   ├── index.ts, engine.ts, issues.ts
│       ├── hr/                   # 인사 (→ session-service로 세션 무효화)
│       │   ├── index.ts, users.ts, organizations.ts, commission.ts,
│       │   │   admin-regions.ts, distributors.ts, phone-verify.ts,
│       │   │   channels-agency.ts    ★ v7.0: 채널 + 대리점 + 온보딩 API
│       ├── signup/               # 팀장 자가 가입 (→ hr-service, notification-service)
│       │   ├── index.ts, region-add.ts
│       ├── stats/                # 통계: 대시보드, 리포트, 정책
│       │   ├── index.ts, dashboard.ts, reports.ts, policies.ts
│       ├── notifications.ts      # 알림 CRUD + 설정
│       ├── system.ts             # 시스템 관리 + 검색 + 타임라인 + 임포트/백업
│       └── audit.ts              # 감사 로그 조회/통계
├── public/                       # Frontend — 23 JS + 1 CSS + SW
│   ├── sw.js                     # Service Worker (오프라인 + 푸시 알림)
│   ├── static/js/core/
│   │   ├── constants.js          # OMS.STATUS (15상태), OMS.PERMISSIONS, ROLE_LABELS
│   │   ├── api.js                # fetch 래퍼 v4.0: 재시도, 오프라인 감지, 타임아웃, cachedApi
│   │   ├── ui.js                 # 모달, 토스트, 포맷터, 뱃지, exportToCSV/Excel
│   │   ├── interactions.js       # 팝오버, 컨텍스트메뉴, 드로어, 호버프리뷰, 배치바, 스와이프
│   │   ├── auth.js               # 로그인, 로그아웃, 권한, 라우팅, 글로벌검색
│   │   └── app.js                # 부트스트랩: 레이아웃, 바텀네비, 알림폴링, 해시 라우터
│   ├── static/js/shared/
│   │   ├── form-helpers.js       # 필터바, 폼필드, 페이지헤더, 액션버튼
│   │   └── table.js              # 테이블 헬퍼
│   ├── static/js/pages/
│   │   ├── dashboard.js          # 대시보드 (5종 차트, 실시간 폴링)
│   │   ├── orders.js             # 주문관리 + 자동/수동배분 + CSV/xlsx 내보내기
│   │   ├── kanban.js             # 칸반 보드 (드래그, 다중선택, READY_DONE)
│   │   ├── review.js             # 검수 (DONE 상태 포함)
│   │   ├── settlement.js         # 정산+대사 (인쇄보고서, CSV/xlsx)
│   │   ├── statistics.js         # 통계 + 정책관리 CRUD
│   │   ├── hr.js                 # 인사관리 + 온보딩
│   │   ├── my-orders.js          # 팀장 전용 (READY_DONE/DONE 플로우, 프로필, 통계)
│   │   ├── signup-wizard.js      # 팀장 자가 가입 5단계 위자드
│   │   ├── signup-admin.js       # 관리자 가입 승인/반려
│   │   ├── notifications.js      # 알림 센터
│   │   ├── audit.js              # 감사 로그
│   │   ├── channels.js           # 주문 채널 관리
│   │   ├── agency.js             # 대리점 대시보드/주문/팀장/내역서
│   │   └── system.js             # 시스템 관리 (세션/DB/임포트/백업)
│   └── static/css/
│       └── mobile.css            # 모바일 반응형 (419줄)
├── migrations/                   # D1 마이그레이션 (10개)
│   ├── 0001_initial_schema.sql ~ 0010_ready_done_status.sql
├── seed.sql                      # 기본 시드 데이터
├── seed_test_orders.sql          # 테스트 주문 데이터
├── tests/
│   └── e2e.sh                    # E2E 통합 테스트 (50개, v16.0)
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
┌──────────────────────────────────────────────────────────────────────────┐
│                            Routes (라우트)                                │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬───────┤
│ auth.ts  │signup/   │hr/users  │settle/   │region-   │channels- │system │
│          │index.ts  │.ts       │calc.ts   │add.ts    │agency.ts │.ts    │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴───┬──┘
     │          │          │          │          │          │         │
     ▼          ▼          ▼          ▼          ▼          ▼         ▼
┌─────────┐┌─────────┐┌─────────┐┌──────────┐┌──────────┐
│session-  ││hr-      ││session- ││order-    ││notific-  │
│service   ││service  ││service  ││lifecycle ││ation-    │
│          ││         ││         ││-service  ││service   │
└────┬─────┘└────┬────┘└────┬────┘└────┬─────┘└────┬─────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Database Tables (D1) — 41개                         │
│  sessions | organizations | users | orders | stats | notifications      │
│  user_roles | commission_policies | order_channels | agency_team_mappings│
│  notification_preferences | agency_onboarding | push_subscriptions      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 서비스별 책임

| 서비스 | 소유 테이블 (쓰기) | 호출자 |
|--------|-------------------|--------|
| notification-service | notifications | signup, region-add, channels-agency, assign, report, review |
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
notification_preferences (user_id, pref_order_status, pref_assignment, ...) — 유형별 on/off
```

### 4.3 주문 채널 (v7.0)
```
order_channels (channel_id, name, code, description, contact_info, is_active, priority)
  - 다수 주문원장(채널) 관리
  - orders.channel_id로 주문과 연결
  - commission_policies.channel_id로 채널별 수수료 정책
```

### 4.4 대리점 매핑 (v7.0)
```
agency_team_mappings (agency_user_id, team_user_id, created_at)
agency_onboarding (id, user_id, requested_region_id, status, ...) — v12.0 온보딩 워크플로
```

### 4.5 주문 상태 전이 (State Machine v6.0)
```
RECEIVED → VALIDATED → DISTRIBUTED → ASSIGNED → READY_DONE → IN_PROGRESS
→ SUBMITTED → DONE → REGION_APPROVED → HQ_APPROVED → SETTLEMENT_CONFIRMED → PAID

분기: SUBMITTED → REGION_REJECTED → (재제출)
      REGION_APPROVED → HQ_REJECTED → (재제출)
      RECEIVED/VALIDATED → DISTRIBUTION_PENDING (행정동 매칭 실패)

v15.0 신규 상태:
  - READY_DONE: 팀장 준비완료 (scheduled_date 설정)
  - DONE: 최종완료 (영수증 첨부)

역할별 허용 전이:
  - AGENCY_LEADER: DISTRIBUTED→ASSIGNED, SUBMITTED→검수
  - TEAM_LEADER: ASSIGNED→READY_DONE, READY_DONE→IN_PROGRESS, IN_PROGRESS→SUBMITTED, SUBMITTED→DONE
```

### 4.6 주문 관련
```
orders (order_id, external_order_no, customer_name, address_text, admin_dong_code,
        base_amount, status, scheduled_date, channel_id, ...)
order_distributions (order_id → region_org_id)
order_assignments (order_id → team_leader_id, status)
work_reports (report_id, order_id, version, note, receipt_url, submitted_at)
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
commission_policies — 수수료 정책 (channel_id v12.0, updated_at v7.0)
notifications — 알림 (type, title, message, is_read)
audit_logs — 감사 로그 (entity_type, entity_id, action, actor_id, detail_json)
signup_requests — 팀장 자가 가입 신청
push_subscriptions — 웹 푸시 알림 구독 (v14.0)
distribution_policies, report_policies, commission_policies — 정책 관리 테이블
```

---

## 5. 인증/권한/보안 체계

### 5.1 인증 흐름
```
POST /api/auth/login {login_id, password}
→ 계정 잠금 검사 (5회 실패 시 5분 잠금, v13.0)
→ PBKDF2 검증 (레거시 SHA-256 자동 마이그레이션)
→ session-service.createSession() → sessions 테이블에 UUID 저장 (24시간)
→ Set-Cookie: session_id + JSON 응답 {session_id, user}
→ AGENCY_LEADER인 경우 is_agency=true, agency_team_ids 포함
```

### 5.2 보안 체계 (v13.0)
```
- 계정 잠금: 5회 연속 실패 → 5분 잠금 (423 응답)
- 비밀번호 정책: 최소 6자 + 영문+숫자 + 이전 비밀번호 재사용 불가
- Rate Limiting: IP 기반 10회/분
- 세션 강제 종료: 개별/전체 (SUPER_ADMIN)
- 감사 로그: LOGIN_FAILED, SESSION_REVOKE, SESSION_PURGE, DATA_EXPORT
```

### 5.3 미들웨어 체인
```
모든 /api/* → authMiddleware → session-service.validateSession() (세션→user 세팅)
각 라우트 내부 → requireAuth(roles?) 로 권한 체크
```

### 5.4 역할별 권한 (PERMISSIONS 맵)
```
SUPER_ADMIN: 전체 접근 + 시스템관리
HQ_OPERATOR: dashboard, orders, distribute, channels, review-hq, settlement, reconciliation, statistics, policies, kanban, hr-management, audit-log, notifications
REGION_ADMIN: dashboard, orders, kanban, review-region, settlement, statistics, hr-management, notifications
AGENCY_LEADER: agency-dashboard, agency-orders, agency-team, agency-statement, review-region, kanban, my-orders, my-stats, notifications
TEAM_LEADER: dashboard, my-orders, my-stats, my-profile, kanban, notifications
AUDITOR: dashboard, statistics, audit-log, notifications
```

### 5.5 Scope Engine v7.0
```
getUserScope(user) → { orgFilter, userFilter, orgIds, agencyTeamIds }
SUPER_ADMIN: 전체 데이터
REGION_ADMIN: 자기 지역법인 + 하위 팀 데이터
AGENCY_LEADER: 자신 + agency_team_mappings 하위 팀장 데이터
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
1. constants.js  — OMS.STATUS (15상태), OMS.PERMISSIONS, OMS.ROLE_LABELS, OMS.MENU_ITEMS
2. api.js        — api() 함수, 세션 관리, cachedApi, debounce, throttle
3. ui.js         — showModal, showToast, formatAmount, exportToCSV, exportToExcel
4. interactions.js — showDrawer, showContextMenu, showPopover, 스와이프, 스켈레톤
5. auth.js       — login, logout, navigateTo, renderContent, isAgencyLeader(), 글로벌검색
6. shared/*.js   — form-helpers, table
7. pages/*.js    — 각 페이지 렌더 함수 (15개 페이지 모듈)
8. app.js        — render(), renderLayout(), 바텀네비, 풀투리프레시, 알림폴링
```

### 6.3 메뉴 체계
```
OMS.MENU_ITEMS:
  HQ: [dashboard, orders, distribute, channels, review-hq, settlement, reconciliation, statistics, hr-management, policies, audit-log, notifications, system(adminOnly)]
  REGION: [dashboard, kanban, review-region, hr-management, statistics, notifications]
  AGENCY: [agency-dashboard, agency-orders, agency-team, agency-statement, kanban, review-region, my-orders, my-stats, notifications]
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
- renderStatusFlowLarge(status, history) — 상세 상태 플로우 (READY_DONE/DONE 포함)
- showSkeletonLoading(el, type) — 스켈레톤 로딩
- initSwipeAction() — 터치 스와이프
```

---

## 7. API 엔드포인트 전체 맵 (~100개)

### 인증 (auth.ts → session-service)
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/auth/login | 로그인 (계정잠금 검사 포함) |
| POST | /api/auth/logout | 로그아웃 |
| GET | /api/auth/me | 세션 사용자 정보 |
| GET | /api/auth/users | 사용자 목록 |
| GET | /api/auth/organizations | 조직 목록 |
| GET | /api/auth/team-leaders | 팀장 목록 |

### 주문 (orders/)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/orders | 목록 (필터/페이지네이션, channel_id) |
| GET | /api/orders/:id | 상세 (order + history + reports + reviews) |
| POST | /api/orders | 수동 등록 |
| POST | /api/orders/import | 일괄 수신 (JSON) |
| POST | /api/orders/distribute | 자동 배분 |
| POST | /api/orders/batch-distribute | 일괄 배분 |
| PATCH | /api/orders/:id/distribution | 수동 배분 |
| POST | /api/orders/:id/assign | 팀장 배정 |
| POST | /api/orders/batch-assign | 배치 배정 (최대 50건) |
| POST | /api/orders/:id/unassign | 배정 해제 |
| POST | /api/orders/:id/ready-done | **준비완료 (v15.0)** |
| POST | /api/orders/:id/start | 작업 시작 |
| POST | /api/orders/:id/reports | 보고서 제출 |
| POST | /api/orders/:id/complete | **최종완료 + 영수증 (v15.0)** |
| POST | /api/orders/:id/review/region | 지역 1차 검수 |
| POST | /api/orders/:id/review/hq | HQ 2차 검수 |

### 정산 (settlements/)
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | /api/settlements/runs | Run 목록/생성 |
| POST | /api/settlements/runs/:id/calculate | 산출 |
| POST | /api/settlements/runs/:id/confirm | 확정 |
| GET | /api/settlements/runs/:id/details | 상세 |
| GET | /api/settlements/runs/:id/report | 보고서 데이터 |
| GET | /api/settlements/runs/:id/export | CSV 내보내기 데이터 |
| GET | /api/settlements/agency-statement | 대리점 정산 내역서 |

### 통계/정책 (stats/)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/stats/dashboard | 대시보드 요약 |
| GET | /api/stats/regions/daily | 지역별 일별 통계 |
| GET | /api/stats/team-leaders/daily | 팀장별 일별 통계 |
| GET | /api/stats/export/csv | CSV 내보내기 |
| GET | /api/stats/revenue-trend | 매출 추이 (v14.0) |
| GET | /api/stats/settlement-summary | 정산 현황 (v14.0) |
| GET | /api/stats/policies/distribution | 배분 정책 목록 |
| GET | /api/stats/policies/report | 보고서 정책 목록 |
| GET | /api/stats/policies/commission | 수수료 정책 목록 |
| GET | /api/stats/territories | 지역-법인 매핑 |
| POST | /api/stats/policies/distribution | 배분 정책 생성 (v15.0) |
| PUT | /api/stats/policies/distribution/:id | 배분 정책 수정 (v15.0) |
| POST | /api/stats/policies/report | 보고서 정책 생성 (v15.0) |
| PUT | /api/stats/policies/report/:id | 보고서 정책 수정 (v15.0) |
| POST | /api/stats/policies/commission | 수수료 정책 생성 (v15.0) |
| PUT | /api/stats/policies/commission/:id | 수수료 정책 수정 (v15.0) |

### 시스템 관리 (system.ts — v13.0~v14.0)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/system/info | 시스템 정보 |
| GET | /api/system/backup-info | DB 테이블 현황 |
| GET | /api/system/export/:table | 테이블 데이터 내보내기 |
| GET | /api/system/sessions | 활성 세션 목록 |
| DELETE | /api/system/sessions/:id | 세션 강제 종료 |
| DELETE | /api/system/sessions | 전체 세션 초기화 |
| GET | /api/system/search | 글로벌 통합 검색 |
| GET | /api/system/order-timeline/:id | 주문 활동 타임라인 |
| POST | /api/system/import/:table | 데이터 임포트 (v14.0) |
| GET | /api/system/snapshot | 스냅샷 백업 (v14.0) |
| POST | /api/system/snapshot/restore | 스냅샷 복원 (v14.0) |
| POST | /api/system/push/subscribe | 푸시 알림 구독 (v14.0) |
| POST | /api/system/push/unsubscribe | 푸시 알림 해제 (v14.0) |

### 알림 (notifications.ts)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/notifications | 알림 목록 |
| GET | /api/notifications/unread-count | 미읽음 수 |
| PATCH | /api/notifications/:id/read | 읽음 처리 |
| POST | /api/notifications/read-all | 전체 읽음 |
| DELETE | /api/notifications/:id | 삭제 |
| GET | /api/notifications/preferences | 알림 설정 조회 (v10.0) |
| PUT | /api/notifications/preferences | 알림 설정 수정 (v10.0) |

*(HR, 가입, 채널, 대리점, 대사, 감사로그 API 등 나머지는 이전 버전과 동일)*

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
npx wrangler d1 migrations apply dahada-production --local  # 마이그레이션 (10개)
npx wrangler d1 execute dahada-production --local --file=./seed.sql  # 시드
npx wrangler d1 execute dahada-production --local --command="SELECT ..."  # 쿼리
```

### 8.3 프로덕션 배포
```bash
npm run build
npx wrangler pages deploy dist --project-name dahada-oms
npx wrangler d1 migrations apply dahada-production --remote  # 프로덕션 DB
```

### 8.4 wrangler.jsonc
```jsonc
{
  "name": "dahada-oms",
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

---

## 10. 코드량 통계

| 영역 | 파일 수 | 줄수 |
|------|---------|------|
| Backend (TypeScript) | 47 | 8,902 |
| Frontend (JavaScript) | 23 | 10,722 |
| Service Worker | 1 | 143 |
| CSS | 1 | 419 |
| SQL (migrations + seed) | 12 | 1,112 |
| E2E Test (Shell) | 1 | 386 |
| **총계** | **85** | **21,684** |

---

## 11. E2E 통합 테스트 (v16.0)

> **파일**: `/home/user/webapp/tests/e2e.sh` (386줄, 50개 테스트)
> **실행**: `cd /home/user/webapp && bash tests/e2e.sh`

### 테스트 영역 (15개 그룹)
| # | 영역 | 테스트 수 | 내용 |
|---|------|-----------|------|
| 1 | 헬스체크 | 2 | health API, 버전 확인 |
| 2 | 인증 | 5 | 3역할 로그인, 실패 거부, 세션 조회 |
| 3 | 주문 CRUD | 3 | 목록, 수동 등록(고유 데이터), 상세 |
| 4 | 주문 라이프사이클 | 10 | RECEIVED→자동배분→수동배분→배정→READY_DONE→IN_PROGRESS→SUBMITTED→DONE→REGION_APPROVED→HQ_APPROVED |
| 5 | 배치 작업 | 1 | 일괄 수신 (batch import) |
| 6 | 정산 | 3 | Run 목록/생성/산출 |
| 7 | 통계/대시보드 | 2 | 대시보드, 지역별 일별 |
| 8 | 정책 | 4 | 배분/보고서/수수료 정책, 지역매핑 |
| 9 | 알림 | 3 | 목록, 미읽음, 설정 |
| 10 | 시스템 | 3 | 시스템 정보, 글로벌 검색, DB 현황 |
| 11 | HR/감사 | 4 | 사용자, 조직, 감사 로그/통계 |
| 12 | 채널/대리점 | 2 | 채널 목록, 대리점 목록 |
| 13 | RBAC 권한 | 2 | TEAM_LEADER 시스템 거부, 비인증 거부 |
| 14 | 매출/정산 차트 | 2 | 매출 추이, 정산 현황 |
| 15 | 로그아웃 | 4 | 세션 생성→유효 확인→로그아웃→무효 확인 |

### 주요 특징
- **반복 실행 안정**: 타임스탬프 기반 고유 주문 데이터 생성
- **주문 전체 흐름**: 13단계 상태 전이 완전 커버 (RECEIVED→HQ_APPROVED)
- **3역할 교차**: SUPER_ADMIN, REGION_ADMIN, TEAM_LEADER 세션 동시 사용

---

## 12. v16.0 주요 변경사항

### 버그 수정
- **로그아웃 API**: Cookie에서 session_id 미추출 → `getSessionCookie()` 헬퍼 추가로 쿠키 기반 세션 삭제 정상화
- **보고서 사진 업로드**: `photo.url` / `photo.file_url` 양쪽 수용 (하위 호환)

### 에러 처리 강화
- **프론트엔드 (api.js v4.0)**:
  - API 재시도: GET 요청 2회, 5xx 서버 에러 자동 재시도 (지수 백오프)
  - 오프라인 감지: `navigator.onLine` + 이벤트 리스너, 상단 배너 표시
  - 요청 타임아웃: `AbortController` 30초 기본 (설정 가능)
  - 글로벌 에러: `window.error`, `unhandledrejection` 핸들러
- **백엔드 (index.tsx)**:
  - 에러 자동 분류: DB 에러, 검증 에러, 타임아웃, 404 → 적절한 HTTP 상태 코드
  - 에러 코드 표준화: `INTERNAL_ERROR`, `DB_ERROR`, `VALIDATION_ERROR`, `TIMEOUT`, `NOT_FOUND`
  - `_debug` 필드에 원본 에러 메시지 포함 (200자 제한)
