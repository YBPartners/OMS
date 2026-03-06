# Airflow OMS — 시스템 아키텍처 (v19.0)

> **최종 업데이트**: 2026-03-06
> **현재 버전**: v19.0.0
> **프로덕션**: https://dahada-oms.pages.dev
> **이 문서는 새 대화에서 컨텍스트 복구용 — 반드시 먼저 읽을 것**

---

## 1. 기술 스택

| 계층 | 기술 | 비고 |
|------|------|------|
| Runtime | Cloudflare Workers (Edge) | 10ms CPU 제한 (free) |
| Framework | Hono v4 | TypeScript, 경량 라우팅 |
| Database | Cloudflare D1 (SQLite) | 로컬: `--local` 모드, 44개 테이블, 13개 마이그레이션 |
| Session | Cloudflare KV | SESSION_CACHE, TTL 24h |
| Frontend | Vanilla JS + TailwindCSS (PostCSS) | SPA, 23개 JS 모듈 |
| Icons | FontAwesome 6.5 (CDN) | |
| Charts | Chart.js 4.4 (CDN) | 대시보드 5종 차트 + SVG 히트맵 |
| Excel | SheetJS (CDN) | xlsx 내보내기 |
| Email | Resend API | 정산서/알림 이메일 발송 |
| Build | Vite + @hono/vite-cloudflare-pages | `dist/_worker.js` (~252KB) |
| Dev Server | wrangler pages dev (PM2 관리) | port 3000 |
| Deployment | Cloudflare Pages | `wrangler pages deploy dist` |

---

## 2. 프로젝트 디렉터리 구조

```
/home/user/webapp/
├── src/                          # Backend (TypeScript) — 48 파일, 10,093줄
│   ├── index.tsx                 # Hono 앱 진입점, 라우트 마운트, SPA HTML
│   ├── types/index.ts            # 타입 정의 v6.0 (Env, SessionUser, RoleCode, OrderStatus 등)
│   ├── middleware/
│   │   ├── auth.ts               # 세션 인증 미들웨어 (→ session-service + KV 캐시)
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
│   │   ├── session-service.ts    # 세션 CRUD/KV 캐시/만료정리/무효화
│   │   ├── hr-service.ts         # 팀+리더 원자적 생성 (6테이블)
│   │   ├── order-lifecycle-service.ts # 정산 확정 → 주문/통계 일괄
│   │   └── stats-service.ts      # 통계 upsert/배치 빌더
│   └── routes/
│       ├── auth.ts               # 로그인/로그아웃/계정잠금 (→ session-service)
│       ├── orders/               # 주문 CRUD, 배분, 배정, 보고서, 검수, 사진업로드
│       │   ├── index.ts, crud.ts, distribute.ts, assign.ts, report.ts, review.ts
│       ├── settlements/          # 정산 Run, 산출, 확정, 인보이스, 이메일발송
│       │   ├── index.ts, runs.ts, calculation.ts, report.ts
│       ├── reconciliation/       # 대사 실행, 이슈 관리
│       │   ├── index.ts, engine.ts, issues.ts
│       ├── hr/                   # 인사 (→ session-service로 세션 무효화)
│       │   ├── index.ts, users.ts, organizations.ts, commission.ts,
│       │   │   admin-regions.ts, distributors.ts, phone-verify.ts,
│       │   │   channels-agency.ts    ★ 채널 API 연동 + 대리점 + 온보딩 API
│       ├── signup/               # 팀장 자가 가입 (→ hr-service, notification-service)
│       │   ├── index.ts, region-add.ts
│       ├── stats/                # 통계: 대시보드, 리포트, 정책
│       │   ├── index.ts, dashboard.ts, reports.ts, policies.ts
│       ├── notifications.ts      # 알림 CRUD + 설정
│       ├── system.ts             # 시스템 관리 + 검색 + 타임라인 + 임포트/백업
│       └── audit.ts              # 감사 로그 조회/통계
├── public/                       # Frontend — 23 JS + CSS + SW
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
│   │   ├── dashboard.js          # 대시보드 (5종 차트, SVG 히트맵, 실시간 폴링)
│   │   ├── orders.js             # 주문관리 + 자동/수동배분 + CSV/xlsx 내보내기
│   │   ├── kanban.js             # 칸반 보드 (드래그, 다중선택, READY_DONE)
│   │   ├── review.js             # 검수 (DONE 상태 포함)
│   │   ├── settlement.js         # 정산+대사+인보이스 (인쇄보고서, CSV/xlsx)
│   │   ├── statistics.js         # 통계 + 정책관리 CRUD
│   │   ├── hr.js                 # 인사관리 + 온보딩
│   │   ├── my-orders.js          # 팀장 전용 (READY_DONE/DONE 플로우, 프로필, 카메라첨부)
│   │   ├── signup-wizard.js      # 팀장 자가 가입 5단계 위자드
│   │   ├── signup-admin.js       # 관리자 가입 승인/반려
│   │   ├── notifications.js      # 알림 센터
│   │   ├── audit.js              # 감사 로그
│   │   ├── channels.js           # ★ 주문 채널 관리 (API 연동 설정, 필드매핑, 테스트, 동기화)
│   │   ├── agency.js             # 대리점 대시보드/주문/팀장/내역서
│   │   └── system.js             # 시스템 관리 (세션/DB/임포트/백업)
│   └── static/css/
│       ├── tailwind.css          # PostCSS 빌드된 Tailwind 스타일
│       └── mobile.css            # 모바일 반응형 (420줄)
├── migrations/                   # D1 마이그레이션 (13개)
│   ├── 0001_initial_schema.sql ~ 0013_channel_api_integration.sql
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
│(+KV)     ││         ││         ││-service  ││service   │
└────┬─────┘└────┬────┘└────┬────┘└────┬─────┘└────┬─────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Database Tables (D1) — 44개                        │
│  sessions | organizations | users | orders | stats | notifications      │
│  user_roles | commission_policies | order_channels(+API연동) |          │
│  agency_team_mappings | notification_preferences | push_subscriptions   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 서비스별 책임

| 서비스 | 소유 테이블 (쓰기) | 호출자 |
|--------|-------------------|--------|
| notification-service | notifications | signup, region-add, channels-agency, assign, report, review |
| session-service | sessions + KV | auth, hr/users, middleware/auth |
| hr-service | organizations, users, user_roles, team_distributor_mappings, org_region_mappings, commission_policies | signup |
| order-lifecycle-service | orders, order_assignments, team_leader_ledger_daily, region_daily_stats, team_leader_daily_stats | settlements/calculation |
| stats-service | region_daily_stats, team_leader_daily_stats, team_leader_ledger_daily | order-lifecycle-service |

---

## 4. 데이터 모델 (핵심 테이블)

### 4.1 조직 계층
```
organizations (org_id, org_type, name, code, status, parent_org_id)
  org_type: HQ | REGION | TEAM
  HQ(Airflow 본사) → REGION(서울/경기/인천/부산 지역총판) → TEAM (parent_org_id 참조)
  
  AGENCY 계층은 user_roles + agency_team_mappings로 구현
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

### 4.3 주문 채널 (v19.0 — API 연동 포함)
```
order_channels (
  channel_id, name, code, description, contact_info, is_active, priority,
  -- ★ v19.0 API 연동 필드 (16개)
  api_endpoint, api_method, auth_type, auth_credentials,
  request_headers, request_body_template, response_type,
  field_mapping, data_path, polling_interval_min,
  last_sync_at, last_sync_status, last_sync_message, last_sync_count,
  total_synced_count, api_enabled,
  created_at, updated_at
)

현재 채널:
  아정당(AJD, 우선순위 100) — 1호 채널
  삼성(SAMSUNG, 90) — 삼성전자 에어컨 세척
  엘지(LG, 80) — LG전자 에어컨 세척
  캐리어(CARRIER, 70) — 캐리어 에어컨 세척
  로컬(LOCAL, 10) — 자체 접수/로컬 업체

auth_type: NONE | API_KEY | BEARER | BASIC | CUSTOM_HEADER
```

### 4.4 대리점 매핑
```
agency_team_mappings (agency_user_id, team_user_id, created_at)
agency_onboarding (id, user_id, requested_region_id, status, ...) — 온보딩 워크플로
```

### 4.5 주문 상태 전이 (State Machine v6.0)
```
RECEIVED → VALIDATED → DISTRIBUTED → ASSIGNED → READY_DONE → IN_PROGRESS
→ SUBMITTED → DONE → REGION_APPROVED → HQ_APPROVED → SETTLEMENT_CONFIRMED → PAID

분기: SUBMITTED → REGION_REJECTED → (재제출)
      REGION_APPROVED → HQ_REJECTED → (재제출)
      RECEIVED/VALIDATED → DISTRIBUTION_PENDING (행정동 매칭 실패)

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
work_report_photos (photo_id, report_id, category, file_url, file_name, file_size, mime_type, file_hash)
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

---

## 5. 인증/권한/보안 체계

### 5.1 인증 흐름
```
POST /api/auth/login {login_id, password}
→ 계정 잠금 검사 (5회 실패 시 5분 잠금)
→ PBKDF2 검증 (레거시 SHA-256 자동 마이그레이션)
→ session-service.createSession() → D1 + KV 캐시 저장 (24시간 TTL)
→ Set-Cookie: session_id + JSON 응답 {session_id, user}
→ AGENCY_LEADER인 경우 is_agency=true, agency_team_ids 포함
```

### 5.2 세션 캐시 (KV, v18.0)
```
KV Key: session:{sessionId}
TTL: 세션 만료까지 남은 초 (최대 24h)
전략: 로그인 시 KV 저장 → API 요청 시 KV 조회 → miss 시 D1 fallback → KV 재캐시
성능: 세션 검증 D1 쿼리 3~4회 → 0회, 지연 30ms → 5ms
```

### 5.3 Scope Engine v7.0
```
getUserScope(user) → { orgFilter, userFilter, orgIds, agencyTeamIds }
SUPER_ADMIN: 전체 데이터
REGION_ADMIN: 자기 지역총판 + 하위 팀 데이터
AGENCY_LEADER: 자신 + agency_team_mappings 하위 팀장 데이터
TEAM_LEADER: 자기 팀 데이터만
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

---

## 6. API 엔드포인트 전체 맵 (~125개)

### 인증 (auth.ts)
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/auth/login | 로그인 (계정잠금 검사 포함) |
| POST | /api/auth/logout | 로그아웃 (D1+KV 삭제) |
| GET | /api/auth/me | 세션 사용자 정보 (org_code 포함) |

### 주문 (orders/)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/orders | 목록 (필터/페이지네이션, channel_id) |
| GET | /api/orders/:id | 상세 |
| POST | /api/orders | 수동 등록 |
| POST | /api/orders/import | 일괄 수신 |
| POST | /api/orders/distribute | 자동 배분 |
| POST | /api/orders/batch-distribute | 일괄 배분 |
| PATCH | /api/orders/:id/distribution | 수동 배분 |
| POST | /api/orders/:id/assign | 팀장 배정 |
| POST | /api/orders/batch-assign | 배치 배정 |
| POST | /api/orders/:id/unassign | 배정 해제 |
| POST | /api/orders/:id/ready-done | 준비완료 |
| POST | /api/orders/:id/start | 작업 시작 |
| POST | /api/orders/:id/upload | 사진 업로드 (multipart) |
| POST | /api/orders/:id/reports | 보고서 제출 (Base64 사진) |
| POST | /api/orders/:id/complete | 최종완료 + 영수증 |
| POST | /api/orders/:id/review/region | 지역 1차 검수 |
| POST | /api/orders/:id/review/hq | HQ 2차 검수 |

### 채널 관리 (hr/channels-agency.ts) ★ v19.0 확장
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/hr/channels | 채널 목록 + 주문 수/금액 통계 |
| GET | /api/hr/channels/:id | **채널 상세 (API 설정 포함)** |
| POST | /api/hr/channels | 채널 생성 |
| PUT | /api/hr/channels/:id | 채널 수정 (API 설정 포함) |
| POST | /api/hr/channels/:id/test-api | **API 연결 테스트** |
| POST | /api/hr/channels/:id/sync | **주문 동기화 실행** |
| DELETE | /api/hr/channels/:id | **채널 삭제** |

### 대리점 (hr/channels-agency.ts)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/hr/agencies | 대리점 목록 |
| GET | /api/hr/agencies/:user_id | 대리점 상세 |
| POST | /api/hr/agencies/promote | 대리점 권한 부여 |
| POST | /api/hr/agencies/demote | 대리점 권한 해제 |
| POST | /api/hr/agencies/:id/add-team | 하위 팀장 추가 |
| POST | /api/hr/agencies/:id/remove-team | 하위 팀장 제거 |
| GET | /api/hr/agencies/:id/candidates | 배정 가능 팀장 |
| GET | /api/hr/agency-onboarding | 온보딩 목록 |
| POST | /api/hr/agency-onboarding | 온보딩 신청 |
| PUT | /api/hr/agency-onboarding/:id | 온보딩 승인/반려 |

### 정산 (settlements/)
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | /api/settlements/runs | Run 목록/생성 |
| POST | /api/settlements/runs/:id/calculate | 산출 |
| POST | /api/settlements/runs/:id/confirm | 확정 |
| GET | /api/settlements/runs/:id/details | 상세 |
| GET | /api/settlements/runs/:id/report | 보고서 |
| GET | /api/settlements/runs/:id/export | CSV 내보내기 |
| GET | /api/settlements/agency-statement | 대리점 내역서 |

### 시스템 (system.ts)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/system/info | 시스템 정보 |
| GET | /api/system/search | 글로벌 검색 |
| GET | /api/system/order-timeline/:id | 주문 타임라인 |
| GET | /api/system/address-lookup | 주소→행정동 코드 |
| GET | /api/system/admin-regions | 시도별 행정구역 |
| POST | /api/system/push/subscribe | 푸시 알림 구독 |

*(통계/정책, 알림, HR, 가입, 대사, 감사로그 등 나머지 ~50개 엔드포인트는 기존과 동일)*

---

## 7. 빌드/배포/운영

### 7.1 로컬 개발
```bash
cd /home/user/webapp
npm run build                    # Vite → dist/_worker.js (~252KB)
pm2 start ecosystem.config.cjs   # wrangler pages dev dist --d1=dahada-production --kv=SESSION_CACHE --local
curl http://localhost:3000/api/health
```

### 7.2 DB 관리
```bash
npx wrangler d1 migrations apply dahada-production --local  # 마이그레이션 (13개)
npx wrangler d1 execute dahada-production --local --file=./seed.sql  # 시드
npx wrangler d1 execute dahada-production --local --command="SELECT ..."  # 쿼리
```

### 7.3 프로덕션 배포
```bash
npm run build
npx wrangler pages deploy dist --project-name dahada-oms
npx wrangler d1 migrations apply dahada-production --remote  # 프로덕션 DB
```

### 7.4 wrangler.jsonc
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
  }],
  "kv_namespaces": [{
    "binding": "SESSION_CACHE",
    "id": "5024085768aa47ba943e4e65a454795e"
  }]
}
```

---

## 8. 새 대화에서 이어가기 위한 체크리스트

1. **먼저 읽을 파일들** (순서대로):
   - `/home/user/webapp/ARCHITECTURE.md` (이 파일) — 전체 구조 이해
   - `/home/user/webapp/PROGRESS.md` — 진행 상태 확인
   - `/home/user/webapp/docs/IMPLEMENTATION_TRACKER.md` — 세부 체크리스트
   - `/home/user/webapp/docs/CONVERSATION_CONTEXT.md` — 직전 대화 컨텍스트

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

## 9. 코드량 통계

| 영역 | 파일 수 | 줄수 |
|------|---------|------|
| Backend (TypeScript) | 48 | 10,093 |
| Frontend (JavaScript) | 23 | 12,249 |
| Service Worker | 1 | 143 |
| CSS | 2 | 420 |
| SQL (migrations + seed) | 15 | 1,245 |
| E2E Test (Shell) | 1 | 386 |
| **총계** | **90** | **24,536** |
