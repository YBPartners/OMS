# 다하다 OMS — 구현 추적 문서 (Implementation Tracker)

> **최종 업데이트**: 2026-03-05
> **버전**: v7.0.0
> **이 문서는 대화 압축/토큰 초과 시 컨텍스트 복구용입니다.**
> **항상 이 파일 + ARCHITECTURE.md + PROGRESS.md 를 먼저 읽어 현재 진행 상황을 파악하세요.**

---

## 문서 체계

| 문서 | 경로 | 용도 |
|------|------|------|
| **ARCHITECTURE.md** | `/home/user/webapp/ARCHITECTURE.md` | 시스템 구조, 기술 스택, API 맵, DB 모델, 서비스 레이어 |
| **PROGRESS.md** | `/home/user/webapp/PROGRESS.md` | Phase별 진행 상태, 미구현 목록, 알려진 이슈 |
| **IMPLEMENTATION_TRACKER.md** | 이 파일 | 세부 체크리스트, 설계 결정, 파일 경로 |
| **README.md** | `/home/user/webapp/README.md` | 프로젝트 개요, 테스트 계정, API 요약 |
| **ARCHITECTURE_INNOVATION_v5.0.md** | `/home/user/webapp/docs/` | 10가지 혁신 포인트 상세 설계 |
| **DESIGN_v4.0_team_signup_system.md** | `/home/user/webapp/docs/` | 팀장 가입 시스템 상세 설계 |

---

## 현재 상태 요약

- **전체 Phase**: 0~8 완료 (Phase 8: 데이터 시각화 + CSV 내보내기)
- **프로덕션 배포**: ✅ https://dahada-oms.pages.dev
- **로컬 개발**: ✅ PM2 + wrangler pages dev, port 3000
- **서비스 레이어**: ✅ 5개 서비스, 모듈 간 교차 의존성 해소
- **v7.0 신규**: ✅ 주문 채널 관리, AGENCY_LEADER 역할/스코프/UI
- **v7.1 신규**: ✅ 배분 기능 완성 (일괄/개별 수동배분, 드로어 빠른액션)
- **v8.0 신규**: ✅ Dashboard Chart.js 3종 차트, 주문 CSV 내보내기, 공통 exportToCSV
- **알려진 이슈**: signup SQL 오류 ✅해결 (admin_regions seed 데이터 추가), Tailwind CDN 경고 (경미)
- **총 코드량**: Backend 7,357줄 (45 TS) + Services 634줄 + Frontend 8,318줄 (22 JS) + SQL 921줄 = **16,596줄**

---

## Phase 체크리스트 상세

### ✅ Phase 0: 초기 세팅 + v1.0
- [x] Hono + Cloudflare Pages 템플릿 생성
- [x] D1 초기 스키마 (0001_initial_schema.sql)
- [x] 기본 CRUD API (orders, users, settlements)
- [x] 프론트엔드 기본 UI
- [x] 보안 강화 (PBKDF2, Rate Limiting)

### ✅ Phase 1: DB 마이그레이션 & 코어 엔진
- [x] 0002_hr_management.sql
- [x] 0003_team_signup_system.sql
- [x] 0004_innovation_v5.sql
- [x] admin_regions 전국 읍면동 시드 (~3,500건)
- [x] scope-engine.ts (역할별 데이터 가시성)
- [x] state-machine.ts (13단계 주문 상태 전이)
- [x] batch-builder.ts (D1 batch 원자적 실행)
- [x] types/index.ts 업데이트

### ✅ Phase 2: Admin API, 총판/팀 CRUD
- [x] 행정구역 검색 API (sido/sigungu/eupmyeondong/search)
- [x] 총판 CRUD API (distributors/)
- [x] 조직 관리 API (organizations/)
- [x] 기존 라우트 scope-engine/state-machine 적용
- [x] index.tsx 라우트 마운트 업데이트

### ✅ Phase 3: 자가 가입 워크플로, 알림
- [x] OTP 인증 (개발모드: 화면표시, 토큰 30분)
- [x] 가입 신청/상태조회/재신청 API
- [x] 관리자 승인/반려 API (배치 트랜잭션)
- [x] 추가지역 요청 API (region-add.ts)
- [x] 알림 시스템 (생성/조회/읽음/삭제)
- [x] 0005_signup_enhancements.sql

### ✅ Phase 4: 프론트엔드 UI 전체
- [x] signup-wizard.js (5단계 위자드, ~654줄)
- [x] signup-admin.js (가입승인/반려/추가지역, ~462줄)
- [x] notifications.js (벨/드롭다운/전체페이지, ~283줄)
- [x] dashboard.js, orders.js, kanban.js, review.js
- [x] settlement.js, statistics.js, hr.js, my-orders.js
- [x] audit.js (감사 로그 목록/통계/상세)
- [x] constants.js, api.js, ui.js, auth.js, app.js

### ✅ Phase 5: Kanban 강화 + 감사 + 프로덕션 배포
- [x] Kanban: 다중선택, 배치배정, 배정해제, 드래그, 필터, 통계
- [x] 감사 로그 API + UI (목록/통계/상세)
- [x] Cloudflare Pages 프로덕션 배포
- [x] D1 dahada-production 연결
- [x] E2E 테스트 23/23 PASS

### ✅ Phase 6: 인터랙션 디자인 시스템
- [x] 6-1: Dashboard 인터랙션
- [x] 6-2: Orders 인터랙션 (드로어 상세, 우클릭, 배치바)
- [x] 6-3: Kanban 인터랙션 (카드 우클릭, 호버프리뷰)
- [x] 6-4: Review 인터랙션 (배치 승인/반려, 빠른승인)
- [x] 6-5: Settlement & Reconciliation 인터랙션
- [x] 6-6: HR 인터랙션 (사용자 컨텍스트메뉴)
- [x] 6-7: My Orders + Statistics 인터랙션
- [x] 6-fix: 드로어/팝오버/모달 race condition 수정
- [x] 6-fix: 로그인 실패 수정 (seed.sql 재적용)

### ✅ Phase 6.5: 서비스 레이어 리팩터링
- [x] notification-service.ts (87줄) — 알림 테이블 유일 쓰기 진입점
- [x] session-service.ts (125줄) — 세션 CRUD/검증/만료정리/무효화
- [x] hr-service.ts (123줄) — 팀+리더 원자적 생성 (6테이블 배치)
- [x] order-lifecycle-service.ts (159줄) — 정산 확정 시 주문/통계 일괄 업데이트
- [x] stats-service.ts (111줄) — 일별 통계 upsert + 정산 확정 통계 배치
- [x] services/index.ts (15줄) — 전체 서비스 재수출
- [x] 7개 라우트 파일 리팩터링
- [x] 빌드 검증 + API 전체 테스트

### ✅ Phase 7.0: 다채널 원장 + 대리점(AGENCY) 계층
- [x] 0006_channels_agency.sql — order_channels, agency_team_mappings, AGENCY_LEADER 역할
- [x] orders.channel_id, order_import_batches.channel_id, commission_policies.updated_at 추가
- [x] channels-agency.ts (373줄) — 채널 CRUD 3개 + 대리점 API 7개 엔드포인트
- [x] channels.js (145줄) — 주문 채널 관리 페이지
- [x] agency.js (400줄) — 대리점 대시보드/주문관리/소속 팀장 3개 뷰
- [x] types/index.ts — AGENCY_LEADER 역할, 알림 타입, 감사 이벤트, SessionUser 확장
- [x] scope-engine.ts v7.0 — AGENCY_LEADER 스코프 (자신 + 하위 팀장)
- [x] state-machine.ts — DISTRIBUTED→ASSIGNED, SUBMITTED→검수에 AGENCY_LEADER 허용
- [x] session-service.ts — AGENCY_LEADER 세션에 is_agency, agency_team_ids 로딩
- [x] orders/assign.ts — AGENCY_LEADER 배정/배치배정/해제 + Scope 검증
- [x] orders/crud.ts — channel_id 필터/조회
- [x] orders/review.ts — AGENCY_LEADER 1차 검수
- [x] constants.js — AGENCY 메뉴/권한/역할라벨
- [x] auth.js — 대리점 라우팅, isAgencyLeader()
- [x] app.js — AGENCY 메뉴 그룹
- [x] seed.sql — 대리점 테스트 데이터
- [x] index.tsx — 스크립트 태그, 버전 7.0.0

### ✅ Phase 7.1: 배분 기능 완성
- [x] 주문관리 페이지 일괄배분 버튼 → 실제 모달 구현 (placeholder alert 제거)
- [x] 배분관리 페이지 선택배분(showBatchDistributeModal) 모달
- [x] 수동 배분 모달 UI 개선 (주문번호/고객명/주소 표시)
- [x] 드로어 빠른액션: 미배분 주문에 "수동 배분" 버튼 추가
- [x] POST /api/orders/batch-distribute 연동 (최대 100건)
- [x] PATCH /api/orders/:id/distribution 연동 (개별 수동 재배분)

### ✅ Phase 8: 데이터 시각화 + CSV 내보내기
- [x] Dashboard Chart.js 3종 차트 (도넛/수평바/라인)
- [x] 차트 영역 토글 (expand/collapse)
- [x] 데이터 없을 때 빈 상태 표시
- [x] 주문 목록 CSV 내보내기 (최대 1000건)
- [x] 공통 exportToCSV 유틸리티 (core/ui.js)
- [x] 통계 CSV 내보내기 (지역별/팀장별)

### ✅ 이슈 #4 해결: 가입 SQL 오류
- [x] 원인: admin_regions 테이블 데이터 누락 → FK 제약 위반
- [x] seed.sql에 20개 행정구역 데이터 추가 (서울/경기/인천/부산)
- [x] org_region_mappings 시드 데이터 추가
- [x] 가입 → OTP → 제출 → 승인 전체 플로우 테스트 통과

---

## 핵심 설계 결정 요약

1. **조직 계층**: HQ → REGION(총판) → TEAM(팀) / organizations.parent_org_id
2. **행정구역**: admin_regions (~5000건) + org_region_mappings (총판/팀 ↔ 읍면동)
3. **가입 대상**: 팀장만 자가가입, 총판은 SUPER_ADMIN이 생성
4. **팀-총판**: 기본 1:1, SUPER_ADMIN이 team_distributor_mappings로 추가 가능
5. **승인 흐름**: 팀장 가입 → PENDING → 총판 체크리스트+수수료 → APPROVED → 즉시 로그인
6. **OTP**: 개발모드 (화면 표시), 토큰 기반 30분 만료
7. **배분**: admin_regions 우선 → 레거시 fallback
8. **스코프**: getUserScope() 통합 (SUPER_ADMIN=전체, REGION=자기총판+하위팀, AGENCY=자신+하위팀장, TEAM=자기팀)
9. **트랜잭션**: D1 batch()로 원자적 실행
10. **인증**: PBKDF2 + 레거시 SHA-256 자동 마이그레이션, 세션 24시간, 최대 5개
11. **서비스 레이어**: 도메인 간 DB 쓰기는 서비스 경유 필수, 읽기(SELECT)는 라우트 직접 허용 (v6.5)
12. **대리점 계층**: 별도 org_type 없이 user_roles + agency_team_mappings로 구현 (v7.0)
13. **주문 채널**: order_channels 테이블 + orders.channel_id 연결, N개 원장 관리 (v7.0)

---

## 기술 스택 참조

- Backend: Hono v4 + TypeScript + Cloudflare Workers + D1
- Services: 5개 서비스 파일 (634줄) — 교차 도메인 쓰기 일원화
- Frontend: Vanilla JS + TailwindCSS (CDN) + FontAwesome + Chart.js + CSV export
- Build: Vite + @hono/vite-cloudflare-pages
- Dev: PM2 + wrangler pages dev --local, port 3000
- Deploy: Cloudflare Pages (`wrangler pages deploy dist`)

---

## 파일 경로 참조

- 프로젝트 루트: `/home/user/webapp/`
- 백엔드 소스: `/home/user/webapp/src/` (45파일, 7,357줄)
- **서비스 레이어**: `/home/user/webapp/src/services/` (6파일, 634줄)
- **채널+대리점 API**: `/home/user/webapp/src/routes/hr/channels-agency.ts` (373줄) ← v7.0 신규
- 프론트엔드: `/home/user/webapp/public/static/js/` (22파일, 8,318줄)
- **채널 페이지**: `/home/user/webapp/public/static/js/pages/channels.js` (145줄) ← v7.0
- **대리점 페이지**: `/home/user/webapp/public/static/js/pages/agency.js` (400줄) ← v7.0
- **대시보드 차트**: `/home/user/webapp/public/static/js/pages/dashboard.js` (~250줄) ← v8.0 Chart.js
- **CSV 유틸리티**: `/home/user/webapp/public/static/js/core/ui.js` exportToCSV() ← v8.0
- 마이그레이션: `/home/user/webapp/migrations/` (6파일)
- 시드 데이터: `/home/user/webapp/seed.sql` + `/home/user/webapp/seed/`
- 설계 문서: `/home/user/webapp/docs/`
- 아키텍처: `/home/user/webapp/ARCHITECTURE.md`
- 진척도: `/home/user/webapp/PROGRESS.md`
- wrangler: `/home/user/webapp/wrangler.jsonc`
- PM2: `/home/user/webapp/ecosystem.config.cjs`

---

## 서비스 파일 참조 (v6.5)

| 파일 | 경로 | 줄수 | 주요 export |
|------|------|------|------------|
| notification-service | `src/services/notification-service.ts` | 87 | createNotification, createNotifications, notifySignupApproved, notifyRegionAddComplete |
| session-service | `src/services/session-service.ts` | 125 | createSession, deleteSession, validateSession, invalidateUserSessions, cleanExpiredSessions |
| hr-service | `src/services/hr-service.ts` | 123 | createTeamWithLeader |
| order-lifecycle-service | `src/services/order-lifecycle-service.ts` | 159 | confirmSettlementOrders |
| stats-service | `src/services/stats-service.ts` | 111 | upsertRegionDailyStats, upsertTeamLeaderDailyStats, appendSettlementStatsToBatch |
| index | `src/services/index.ts` | 15 | (전체 재수출) |

---

## v7.0 신규 API 참조

### 채널 API (hr/channels-agency.ts → mountChannels)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/hr/channels | 채널 목록 + 주문 수/금액 통계 |
| POST | /api/hr/channels | 채널 생성 (코드 정규식: `[A-Z0-9_]{2,30}`) |
| PUT | /api/hr/channels/:channel_id | 채널 수정 |

### 대리점 API (hr/channels-agency.ts → mountAgency)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/hr/agencies | 대리점 목록 (REGION Scope 적용) |
| GET | /api/hr/agencies/:user_id | 대리점 상세 + 하위 팀장 (AGENCY 자기만 조회) |
| POST | /api/hr/agencies/promote | TEAM_LEADER → +AGENCY_LEADER 역할 부여 |
| POST | /api/hr/agencies/demote | AGENCY_LEADER 역할 해제 + 매핑 삭제 |
| POST | /api/hr/agencies/:agency_id/add-team | 하위 팀장 추가 (1:1 소속 검증) |
| POST | /api/hr/agencies/:agency_id/remove-team | 하위 팀장 제거 |
| GET | /api/hr/agencies/:agency_id/candidates | 같은 총판, 미소속 팀장 목록 |
