# 다하다 OMS — 개발 진척도 (Development Progress)

> **최종 업데이트**: 2026-03-05
> **현재 버전**: v7.1.0
> **총 코드량**: Backend 7,357줄 (45 TS) + Services 634줄 + Frontend 8,034줄 (22 JS) + SQL 873줄 = **16,898줄**

---

## Phase 총괄 진행표

| Phase | 이름 | 상태 | 완료일 | 주요 산출물 |
|-------|------|------|--------|-------------|
| 0 | 초기 세팅 + v1.0 | ✅ 완료 | 2026-03-02 | Hono+D1 프로젝트 생성, 기본 CRUD |
| 1 | DB 마이그레이션 & 코어 엔진 | ✅ 완료 | 2026-03-03 | 5개 마이그레이션, Scope/State/Batch 엔진 |
| 2 | Admin API, 총판/팀 CRUD | ✅ 완료 | 2026-03-03 | 행정구역 API, 조직 매핑, 14개 혁신 엔진 적용 |
| 3 | 자가 가입 워크플로, 알림 | ✅ 완료 | 2026-03-04 | OTP 인증, 가입 신청/승인, 알림 시스템 |
| 4 | 프론트엔드 UI 전체 | ✅ 완료 | 2026-03-04 | 15개 페이지 모듈, SPA 구조 |
| 5 | Kanban 강화 + 감사로그 + 배포 | ✅ 완료 | 2026-03-04 | 칸반 개선, 감사 UI, CF Pages 프로덕션 배포 |
| 6 | 인터랙션 디자인 시스템 | ✅ 완료 | 2026-03-05 | 드로어/팝오버/컨텍스트메뉴/호버프리뷰 |
| 6.5 | 서비스 레이어 리팩터링 | ✅ 완료 | 2026-03-05 | 5개 서비스, 모듈 간 교차 의존성 해소 |
| **7.0** | **다채널 + 대리점 계층** | **✅ 완료** | **2026-03-05** | **주문 채널 관리, AGENCY_LEADER 역할, 대리점 전용 UI** |
| **7.1** | **배분 기능 완성** | **✅ 완료** | **2026-03-05** | **개별/일괄 수동배분, 드로어 배분 액션, 모달 개선** |

---

## Phase 7.1 — 배분 기능 완성 ✅ (신규)

> **목적**: 미배분 주문의 개별/일괄 수동배분 기능 완성 및 UX 개선

### 7.1-1: 주문관리 페이지 일괄배분 ✅
- 배치 액션바의 '일괄 배분' 버튼 → 지역법인 선택 모달로 변경 (alert 제거)
- `showOrderBatchDistributeModal()` 함수 신규 구현
- `submitOrderBatchDistribute()` → `POST /api/orders/batch-distribute` API 호출
- 결과 모달: 처리대상/성공/실패 통계 표시

### 7.1-2: 배분관리 페이지 선택 배분 ✅
- `showBatchDistributeModal()` 함수 신규 구현
- 선택된 주문 목록 + 총액 표시
- `submitBatchDistribute()` → `POST /api/orders/batch-distribute` API 호출
- 로딩/결과 모달 지원

### 7.1-3: 수동 배분 모달 UX 개선 ✅
- `showManualDistributeModal(orderId, customerName, addressText)` 파라미터 확장
- 주문 정보 헤더 (ID, 고객명, 주소) 표시
- 안내 문구 추가 (행정동 자동매칭 불가 시 수동 지정 안내)
- UI 디자인 개선 (border, focus ring, icon)

### 7.1-4: 드로어 빠른 배분 액션 ✅
- `_getQuickActions()` 확장: RECEIVED/VALIDATED/DISTRIBUTION_PENDING 상태에 '수동 배분' 빠른 액션 버튼 추가
- 드로어에서 바로 수동 배분 모달 호출 가능

### 변경 통계
- 1 file changed: orders.js (+137줄 신규 함수)
- 신규 함수 6개: showBatchDistributeModal, submitBatchDistribute, showOrderBatchDistributeModal, submitOrderBatchDistribute, showManualDistributeModal(개선), _getQuickActions(확장)

---

## Phase 7.0 — 다채널 원장 + 대리점(AGENCY) 계층 ✅

> **목적**: 다수 주문원장(채널) 관리 + 총판-팀장 사이 대리점 중간 계층 추가

### 7-1: DB 마이그레이션 (0006_channels_agency.sql) ✅
- `order_channels` 테이블 (채널 ID, 이름, 코드, 우선순위, 활성 상태)
- `agency_team_mappings` 테이블 (대리점-팀장 매핑)
- `orders.channel_id` 컬럼 추가 (기존 주문 → 기본 채널 자동 설정)
- `order_import_batches.channel_id` 컬럼 추가
- `commission_policies.updated_at` 컬럼 추가 (기존 이슈 #3 해결)
- `AGENCY_LEADER` 역할 roles 테이블 INSERT

### 7-2: 주문 채널 API ✅
- `GET /api/hr/channels` — 채널 목록 (채널별 주문 수/금액 통계 포함)
- `POST /api/hr/channels` — 채널 생성 (코드 중복 체크, 감사 로그)
- `PUT /api/hr/channels/:channel_id` — 채널 수정

### 7-3: 대리점 API ✅
- `GET /api/hr/agencies` — 대리점 목록 (Scope 적용)
- `GET /api/hr/agencies/:user_id` — 대리점 상세 (하위 팀장 목록)
- `POST /api/hr/agencies/promote` — 대리점 권한 부여 (TEAM_LEADER → +AGENCY_LEADER)
- `POST /api/hr/agencies/demote` — 대리점 권한 해제 (매핑 제거)
- `POST /api/hr/agencies/:agency_id/add-team` — 하위 팀장 추가
- `POST /api/hr/agencies/:agency_id/remove-team` — 하위 팀장 제거
- `GET /api/hr/agencies/:agency_id/candidates` — 배정 가능한 팀장 후보

### 7-4: 타입/Scope/State Machine 확장 ✅
- `RoleCode`에 `AGENCY_LEADER` 추가
- `NotificationType`에 `AGENCY_PROMOTED`, `AGENCY_DEMOTED` 추가
- `AuditEventCode`에 `AGENCY.*`, `CHANNEL.*` 추가
- `SessionUser`에 `is_agency`, `agency_team_ids` 필드 추가
- `STATUS_TRANSITIONS`: DISTRIBUTED→ASSIGNED에 AGENCY_LEADER 허용
- `STATUS_TRANSITIONS`: SUBMITTED→검수에 AGENCY_LEADER 허용
- Scope Engine v7.0: AGENCY_LEADER 스코프 (자신 + 하위 팀장 데이터)

### 7-5: 프론트엔드 ✅
- `channels.js` (145줄) — 주문 채널 관리 페이지
- `agency.js` (400줄) — 대리점 대시보드 + 주문관리 + 소속 팀장
- `constants.js` 업데이트 — AGENCY 메뉴/권한 추가, ROLE_LABELS
- `auth.js` 업데이트 — 대리점 라우팅 3페이지 추가, `isAgencyLeader()` 함수
- `app.js` 업데이트 — AGENCY 메뉴 그룹 감지

### 7-6: 기존 코드 수정 ✅
- `orders/assign.ts` — AGENCY_LEADER 배정/배치배정/해제 권한 추가 + Scope 검증
- `orders/crud.ts` — channel_id 필터/조회 반영
- `orders/review.ts` — AGENCY_LEADER 1차 검수 권한
- `session-service.ts` — AGENCY_LEADER 세션에 is_agency, agency_team_ids 로딩
- `hr/index.ts` — channels-agency 라우트 마운트
- `index.tsx` — agency.js, channels.js 스크립트 태그 추가, 버전 7.0.0
- `seed.sql` — 대리점 테스트 데이터 추가

### 변경 통계
- 14 files changed, 438 insertions(+), 90 deletions(-)
- 신규 파일 3개: channels-agency.ts (373줄), channels.js (145줄), agency.js (400줄)
- 마이그레이션 1개: 0006_channels_agency.sql (48줄)

---

## Phase 6 — 인터랙션 디자인 시스템 상세

### 6-1: Dashboard 인터랙션 ✅
- 카드 hover → description 팝오버
- 카드 우클릭 → 컨텍스트 메뉴
- 퍼널 바 클릭 → 필터 이동
- 행 호버 프리뷰 + 컨텍스트 메뉴

### 6-2: Orders 인터랙션 ✅
- 행 클릭 → 드로어 상세 (500px 사이드 패널)
- 행 우클릭 → 상태 기반 액션 메뉴
- 다중 선택 → 배치 액션 바 (하단)
- ⋮ 메뉴, 상태 프로그레스 바

### 6-3: Kanban 인터랙션 ✅
- 카드 우클릭 → 컨텍스트 메뉴 (배정/해제/상세/이력)
- 호버 프리뷰
- 내장 상태 플로우
- ⋮ 더보기

### 6-4: Review 인터랙션 ✅
- 다중 선택 카드 (체크박스)
- 배치 승인/반려
- 빠른 승인 (코멘트 없이)
- 8개 액션 컨텍스트 메뉴
- 상태 플로우 시각화

### 6-5: Settlement & Reconciliation 인터랙션 ✅
- 행 컨텍스트 메뉴
- 확장 가능 행 (팀장별)
- 행 클릭 → 드로어
- 요약 카드 드릴다운
- 이슈 다중 선택, 배치 해결

### 6-6: HR 인터랙션 ✅
- 사용자행 컨텍스트 메뉴 (편집/ID-PW/리셋/활성화/주문보기)
- 호버 프리뷰 (`data-preview="user"`)
- `ix-table-row` 인터랙션

### 6-7: My Orders + Statistics 인터랙션 ✅
- 카드 클릭 → 드로어
- 컨텍스트 메뉴 (상세/시작/보고/이력)
- 상태 카드 드릴다운
- 호버 프리뷰
- 통계 행 클릭 → 주문 목록 드릴다운

### 6-버그수정 ✅
- 드로어/팝오버/모달 닫기 race condition 수정
- `_forceCloseDrawer()` 추가
- 잔여 DOM 정리 로직 추가
- 로그인 실패 수정 (seed.sql 재적용)

---

## Phase 6.5 — 서비스 레이어 리팩터링 ✅

> **목적**: 모듈 간 직접 DB 접근 → 서비스 계층 경유로 의존성 방향 단일화

### 생성된 서비스 파일 (5개, 총 620줄)
| 서비스 | 줄수 | 책임 |
|--------|------|------|
| notification-service.ts | 87 | 알림 생성/배치 생성 (notifications 테이블 유일 쓰기) |
| session-service.ts | 125 | 세션 생성/삭제/검증/무효화/만료정리 |
| hr-service.ts | 123 | 팀+리더 원자적 생성 (6개 테이블 배치) |
| order-lifecycle-service.ts | 159 | 정산 확정 → 주문 상태 + 배정 + 원장 + 통계 업데이트 |
| stats-service.ts | 111 | 일별 통계 upsert + 정산 확정 통계 배치 |

### 리팩터링된 라우트 파일 (7개)
- `lib/audit.ts` — notification 생성 로직 제거, notification-service 재수출
- `middleware/auth.ts` — 세션 검증을 `validateSession()`으로 위임
- `routes/auth.ts` — `createSession()`, `deleteSession()`, `cleanExpiredSessions()` 사용
- `routes/hr/users.ts` — `DELETE FROM sessions` 3건 → `invalidateUserSessions()` 전환
- `routes/settlements/calculation.ts` — 70줄 인라인 배치 → `confirmSettlementOrders()` 1줄
- `routes/signup/index.ts` — 50줄 HR INSERT → `createTeamWithLeader()` + `notifySignupApproved()`
- `routes/signup/region-add.ts` — 15줄 알림 로직 → `notifyRegionAddComplete()`

---

## Phase 8 이후 — 미구현 / 향후 계획

### 8-1: 데이터 시각화 강화 (미구현)
- [ ] Dashboard 실시간 차트 (Chart.js 활용)
- [ ] 매출 추이 그래프
- [ ] 지역별 히트맵
- [ ] 정산 현황 차트

### 8-2: 모바일/반응형 최적화 (미구현)
- [ ] 사이드바 → 바텀 네비게이션
- [ ] 터치 제스처 지원 (스와이프 승인/반려)
- [ ] 모바일 칸반 뷰

### 8-3: 알림 고도화 (미구현)
- [ ] 웹 푸시 알림 (Service Worker)
- [ ] 이메일 알림 연동
- [ ] 알림 설정 (유형별 on/off)

### 8-4: 보고서/엑셀 출력 (미구현)
- [ ] 정산 보고서 PDF 출력
- [ ] 주문 목록 엑셀 다운로드
- [ ] 통계 CSV 내보내기 (현재 일부 구현)

### 8-5: 성능 최적화 (미구현)
- [ ] 프론트엔드 번들 최적화 (현재 CDN 의존)
- [ ] DB 인덱스 최적화
- [ ] 캐시 전략 (KV 활용)

### 8-6: 대리점 기능 고도화 (미구현)
- [ ] 대리점 수수료 자동 분배
- [ ] 대리점별 정산 명세
- [ ] 대리점 가입 워크플로
- [ ] 채널별 수수료 정책

---

## 알려진 이슈

| # | 이슈 | 상태 | 비고 |
|---|------|------|------|
| 1 | ~~로그인 실패~~ | ✅ 해결 | seed.sql 재적용으로 해결 |
| 2 | ~~드로어 닫기 버그~~ | ✅ 해결 | race condition 수정 |
| 3 | ~~commission_policies updated_at 컬럼 없음~~ | ✅ 해결 | 0006 마이그레이션에서 ALTER TABLE 추가 |
| 4 | 가입 요청 SQL syntax error | ⚠️ 미해결 | near ")": syntax error at offset 98 |
| 5 | Tailwind CDN 프로덕션 경고 | ℹ️ 경미 | PostCSS 설치 권장 |

---

## 테스트 계정

| 역할 | 아이디 | 비밀번호 | org_type |
|------|--------|----------|----------|
| HQ 총괄관리자 | admin | admin123 | HQ |
| HQ 운영자 | hq_operator | admin123 | HQ |
| 서울 지역법인 관리자 | seoul_admin | admin123 | REGION |
| 경기 지역법인 관리자 | gyeonggi_admin | admin123 | REGION |
| 인천 지역법인 관리자 | incheon_admin | admin123 | REGION |
| 부산 지역법인 관리자 | busan_admin | admin123 | REGION |
| 서울 팀장1 | leader_seoul_1 | admin123 | REGION (팀) |
| 서울 팀장2 | leader_seoul_2 | admin123 | REGION (팀) |
| 경기 팀장1 | leader_gyeonggi_1 | admin123 | REGION (팀) |
| 경기 팀장2 | leader_gyeonggi_2 | admin123 | REGION (팀) |
| 인천 팀장1 | leader_incheon_1 | admin123 | REGION (팀) |
| 부산 팀장1 | leader_busan_1 | admin123 | REGION (팀) |

---

## 주요 URL

| 구분 | URL |
|------|-----|
| 프로덕션 | https://dahada-oms.pages.dev |
| 샌드박스 | https://3000-inedg4lr7hnug2y22i9nx-5185f4aa.sandbox.novita.ai |
| D1 Database ID | 0b7aedd5-7510-44d3-8b81-d421b03fffa6 |
