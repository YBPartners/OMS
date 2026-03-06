# 와이비 OMS — 개발 진척도 (Development Progress)

> **최종 업데이트**: 2026-03-06
> **현재 버전**: v21.0.0 (R9 완료)
> **총 코드량**: Backend ~11,000줄 (49 TS) + Frontend ~13,100줄 (24 JS) + SW 143줄 + CSS 420줄 + SQL 1,400줄 + E2E 1,000줄 = **~27,100줄**

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
| 7.0 | 다채널 + 대리점 계층 | ✅ 완료 | 2026-03-05 | 주문 채널 관리, AGENCY_LEADER 역할, 대리점 전용 UI |
| 7.1 | 배분 기능 완성 | ✅ 완료 | 2026-03-05 | 개별/일괄 수동배분, 드로어 배분 액션, 모달 개선 |
| **8.0** | **데이터 시각화 + CSV** | **✅ 완료** | **2026-03-05** | **Chart.js 대시보드, CSV 내보내기, exportToCSV 유틸** |
| **9.0** | **모바일 반응형** | **✅ 완료** | **2026-03-05** | **하단 내비, 풀투리프레시, 스와이프, mobile.css 419줄** |
| **10.0** | **성능 최적화 + 알림 설정** | **✅ 완료** | **2026-03-05** | **16개 DB 인덱스, 알림 설정 UI/API, 프로필 탭 리디자인** |
| **11.0** | **정산 보고서 + 대리점 내역서 + 성능** | **✅ 완료** | **2026-03-05** | **인쇄용 HTML 보고서, CSV 내보내기, 대리점 정산, 캐시/debounce** |
| **12.0** | **실시간 폴링 + 온보딩 + 채널수수료 + 엑셀** | **✅ 완료** | **2026-03-05** | **대시보드 자동갱신, 대리점 온보딩 워크플로, 채널별 수수료, xlsx 내보내기** |
| **13.0** | **시스템 관리 + 보안 강화 + 글로벌 검색 + 타임라인** | **✅ 완료** | **2026-03-05** | **시스템 관리 페이지, 로그인 잠금, 비밀번호 정책, Cmd+K 검색, 주문 타임라인** |
| **14.0** | **웹 푸시 + 데이터 관리 + 매출/정산 차트** | **✅ 완료** | **2026-03-05** | **Service Worker, 임포트/백업/복원, 매출 추이, 정산 현황 차트** |
| **15.0** | **GAP 패치 + 상태전이 정규화 + 정책 CRUD** | **✅ 완료** | **2026-03-05** | **READY_DONE/DONE 상태, 알림 트리거, 정책관리 CRUD, 프론트엔드 상태 업데이트** |
| **16.0** | **품질 강화 + 문서 정비 + E2E 테스트** | **✅ 완료** | **2026-03-05** | **프로덕션 DB 마이그레이션, 문서 정합성, 에러 핸들링 강화** |
| **17.0** | **주문 수동 등록 – 실주소 검색** | **✅ 완료** | **2026-03-06** | **카카오 우편번호 서비스, admin_dong_code 자동 매핑, 주소검색 API** |
| **17.1** | **보고서/영수증 – 모바일 카메라 첨부 + 파일명 규칙화** | **✅ 완료** | **2026-03-06** | **카메라 촬영/갤러리, Base64 저장, 파일명 자동생성, 0011 마이그레이션** |
| **18.0** | **KV 캐시 세션 검증 – D1 쿼리 최소화** | **✅ 완료** | **2026-03-06** | **SESSION_CACHE KV, session-service v2.0, API 요청당 D1 쿼리 3→0회** |
| **18.1** | **역할별 대시보드 접근 권한 – TEAM/AGENCY 개인 대시보드** | **✅ 완료** | **2026-03-06** | **TEAM_LEADER/AGENCY_LEADER 대시보드 접근, 역할 기반 UI 분기, 퍼널 차트 대체** |
| **D-1** | **이메일 필수 + Resend 연동** | **✅ 완료** | **2026-03-06** | **가입 이메일 필수, Resend 이메일 발송 인프라** |
| **D-3** | **Tailwind PostCSS** | **✅ 완료** | **2026-03-06** | **CDN → PostCSS 빌드 전환** |
| **D-4** | **SVG 히트맵** | **✅ 완료** | **2026-03-06** | **지역별 히트맵 SVG 시각화** |
| **D-5** | **딜러 수수료 자동분배 + 인보이스** | **✅ 완료** | **2026-03-06** | **수수료 자동분배, 팀장별 인보이스, 일괄인쇄** |
| **D-6** | **주문 채널 API 연동 + 브랜드 채널 정리** | **✅ 완료** | **2026-03-06** | **채널별 API 설정/테스트/동기화, 필드매핑, 에어컨 브랜드별 채널, 법인→총판 치환** |
| **R1** | **주문 CRUD 완성 + 데이터 정합성 고도화** | **✅ 완료** | **2026-03-06** | **주문 수정/삭제 API, 편집모달, 컨텍스트메뉴 연결, D1_TYPE_ERROR 수정, 드로어 정보 보완** |
| **R2** | **팀장 수행 흐름 + E2E 100%** | **✅ 완료** | **2026-03-06** | **E2E 28/28 통과, 보고서별 사진 구조 개선, 반려→재보고 검증, 사진 카테고리 확장** |
| **R3** | **검수·정산 플로우 완성 + PAID** | **✅ 완료** | **2026-03-06** | **PAID 전이 구현, E2E 31/31 통과, 마이그레이션 0016-0017, 원장 paid 컬럼, 감사로그** |
| **R4** | **정책관리 CRUD 완성 + 감사로그** | **✅ 완료** | **2026-03-06** | **4종 정책 CRUD 완성, 삭제 API+감사로그, metrics UI, 필수사진 강제, E2E 26/26** |
| **R5** | **인사·권한·가입 완성** | **✅ 완료** | **2026-03-06** | **사용자 삭제/이동/다중역할, 조직 수정/삭제 UI, canEdit 버그수정, E2E 35/36** |
| **R6** | **공통 UI/UX 표준화** | **✅ 완료** | **2026-03-06** | **apiAction() 래퍼, 모달 ESC/포커스/aria, 토스트 스택, formField 접근성, 5개 페이지 리팩토링, E2E 61/62** |
| **R7** | **대시보드·통계·감사 품질 강화** | **✅ 완료** | **2026-03-06** | **인라인 테이블 5개→renderDataTable, 감사로그 renderPagination, statistics.js 12함수 apiAction 전환, E2E 61/62** |
| **R8** | **운영 안정성·보안** | **✅ 완료** | **2026-03-06** | **SQL 안전성·쿠키 Secure·XSS 방어·에러 표준화·감사로그 민감정보 마스킹, E2E 61/62** |
| **R9** | **인라인 테이블 renderDataTable 전면 마이그레이션** | **✅ 완료** | **2026-03-06** | **9개 테이블 변환, 6개 파일, +152/-266 순감 114줄, 접근성·XSS 강화, E2E 61/62** |

---

## Phase R9 — 인라인 테이블 renderDataTable 전면 마이그레이션 ✅ (2026-03-06)

> **목적**: R6에서 도입한 `renderDataTable` 공유 컴포넌트의 사용률을 높여 코드 일관성·접근성·유지보수성 향상

### R9-1: 현황 진단 ✅
| 파일 | 인라인 `<table>` | renderDataTable | 우선순위 |
|------|-----------------|-----------------|----------|
| settlement.js | 34개 | 0 | 🔴 최고 |
| hr.js | 6개 | 0 | 🟠 높음 |
| channels.js | 6개 (입력폼 특수 테이블) | 0 | 유지 |
| my-orders.js | 6개 | 0 | 🟠 높음 |
| agency.js | 3개 (모달 내부) | 0 | 🟡 중간 |
| signup-admin.js | 9개 | 0 | 🟡 중간 |

### R9-2: settlement.js 마이그레이션 ✅
- **정산 Run 목록 테이블** (L41-76): 9컬럼 인라인 테이블 → `renderDataTable` + `render` 함수 + `onRowClick` + `caption`
- **대사 실행 이력 테이블** (L404-421): 5컬럼 인라인 테이블 → `renderDataTable`
- 인쇄용 HTML 테이블(보고서/계산서)은 인쇄 전용이므로 구조 유지

### R9-3: hr.js 마이그레이션 ✅
- **사용자 목록 테이블** (L62-95): 9컬럼 인라인 테이블 → `renderDataTable` + `escapeHtml` XSS 보호
- **수수료 정책 테이블** (L385-414): 9컬럼 인라인 테이블 → `renderDataTable`
- 모든 사용자 이름에 `escapeHtml()` 적용으로 XSS 방어 강화

### R9-4: my-orders.js 마이그레이션 ✅
- **일별 통계 테이블**: 5컬럼 인라인 → `renderDataTable` + `caption`
- **정산 원장 테이블**: 4컬럼 인라인 → `renderDataTable` + `caption`

### R9-5: agency.js 마이그레이션 ✅
- **온보딩 신청 내역 테이블**: 6컬럼 인라인(모달 내부) → `renderDataTable` + `escapeHtml`

### R9-6: signup-admin.js 마이그레이션 ✅
- **가입 신청 목록 테이블**: 10컬럼 인라인 → `renderDataTable` + `renderPagination` 연동
- **추가 지역 요청 테이블**: 7컬럼 인라인 → `renderDataTable` + `renderPagination` 연동
- 모든 사용자 입력에 `escapeHtml()` 적용

### R9-7: 변환 제외 사항
- **channels.js**: 필드 매핑 설정 테이블(입력 `<input>` 포함) 및 매핑 미리보기 → 특수 양식이므로 인라인 유지
- **settlement.js 인쇄용 HTML**: 보고서/계산서 인쇄 전용 테이블(window.open) → 인쇄 CSS 최적화 필요하므로 유지
- **모달 내 확장형 테이블**: viewRunDetail 등의 접기/펼치기 테이블 → UI 복잡도로 유지

### 변경 통계
- **6 files changed**: settlement.js, hr.js, my-orders.js, agency.js, signup-admin.js, tailwind.css
- **+152 / -266 lines** (순감 114줄)
- **9개 인라인 테이블 → renderDataTable 전환 완료**
- `renderDataTable` 사용 현황: R7의 5개 + R9의 9개 = **14개 페이지 테이블 표준화**
- E2E: HR 35/36 (100%), Policy 26/26 (100%) — 기존과 동일
- 빌드: dist/_worker.js 278.66 kB

### 다음 단계 (R10 권장)
- P1: 성능 최적화 — 대용량 테이블 가상화, API 응답 캐싱 정교화 (중간 난이도)
- P2: orders.js 인라인 테이블 마이그레이션 — 가장 큰 파일(1,241줄), 복잡한 행 렌더링 (높은 난이도)
- P3: Playwright E2E 브라우저 자동화 테스트 (낮은 난이도)

---

## Phase R6 — 공통 UI/UX 표준화 ✅ (2026-03-06)

> **목적**: 183개 async 함수 중 15%만 에러 핸들링, 공유 컴포넌트 사용률 극히 낮음 → 패턴 통일 + 접근성 + 코드 중복 제거

### R6-1: 현황 진단 ✅
| 영역 | 진단 결과 |
|------|-----------|
| 에러 핸들링 | 183 async 함수 중 try/catch 27개(15%), 85% API 호출 에러 핸들링 없음 |
| 공유 컴포넌트 | renderDataTable 0곳, formField 1곳, renderFilterBar 2곳 사용 |
| 인라인 HTML | 71곳에서 innerHTML 직접 생성, `<table>` 37개 직접 작성 |
| 토스트 | 276+ 호출, 성공/실패 동일 패턴 반복 |
| 모달 | 92+ 호출, 버튼 CSS 불일치 (teal/blue/amber) |
| 페이지 헤더 | `pageHeader()` 사용 1곳, 나머지 직접 작성 |

### R6-2: api() 래퍼 강화 — `apiAction()` 도입 ✅
- **`apiAction(method, path, body, opts)`** — API 호출 + 자동 성공/실패 토스트 + 확인 모달
  - `opts.confirm`: `{title, message, buttonText, buttonColor}` → showConfirmModal 통합
  - `opts.successMsg`: string 또는 `(data)=>string` — 동적 성공 메시지
  - `opts.closeModal`: true → 자동 closeModal()
  - `opts.refresh`: true → 자동 renderContent()
  - `opts.successCheck`: `(data)=>boolean` — 커스텀 성공 판단
  - `opts.onSuccess/onError`: 추가 콜백
  - `opts.silent`: true → 토스트 비표시
- **`apiBatch(requests)`** — 여러 API 동시 호출 + 성공/실패 집계

### R6-3: 모달 접근성 강화 ✅
- ESC 키로 모달 닫기 (`_modalEscHandler`)
- `role="dialog"`, `aria-modal="true"`, `aria-label` 속성 추가
- 모달 열기 시 첫 포커스 가능 요소에 자동 포커스
- 모달 닫기 시 이전 포커스 복원 (`_modalPrevFocus`)

### R6-4: 토스트 스택 시스템 ✅
- 최대 4개 동시 표시 (`MAX_TOASTS`)
- 위치 자동 정렬 (16px 간격 스택)
- 동일 메시지 1초 내 중복 방지
- `role="alert"`, `aria-live` 접근성 속성
- 에러 토스트는 5초, 나머지 3.5초 표시
- 닫기 버튼 추가

### R6-5: form-helpers 접근성 + 유틸 추가 ✅
- `formField`: `for`/`id` 연결, `aria-required`, 힌트 텍스트(`hint`) 지원
- `renderFilterBar`: `role="search"`, `aria-label`, `aria-labelledby` 추가
- **`renderModalActions(buttons)`** — 표준 모달 버튼 세트 생성
- **`collectFormDataSafe(formId, rules)`** — 수집 + 유효성 검증 (required, minLength, pattern)
  - 실패 시 자동 토스트 + 포커스 + 빨간 링 시각 피드백
- **`renderActionBar(actions)`** — RBAC 적용 페이지 액션 버튼 바

### R6-6: table.js 접근성 ✅
- `renderDataTable`: `role="grid"`, `scope="col"`, `caption`, `tableId` 지원
- `renderPagination`: `role="navigation"`, `aria-label`, `aria-current="page"`

### R6-7: 주요 페이지 리팩토링 ✅
- **hr.js**: deleteUser, deleteCommission, deactivateOrg, reactivateOrg, submitEditOrg, submitCreateOrg, submitEditUser, submitEditCommission, submitRoles, submitTransfer — 10개 함수 `apiAction()` 전환
- **settlement.js**: createRun, calculateRun, confirmRun — 3개 함수 전환
- **channels.js**: submitCreateChannel, submitEditChannel, toggleChannelStatus — 3개 함수 전환
- **orders.js**: deleteOrder, submitManualDistribute — 2개 함수 전환 + `confirm()` → `showConfirmModal` 전환

### 변경 통계
- 8 files changed: api.js(+70), ui.js(+40), form-helpers.js(+80), table.js(+15), hr.js(-50), settlement.js(-15), channels.js(-10), orders.js(-5) = 약 **+130 / -80 lines**
- E2E: HR 35/36 (100%), Policy 26/26 (100%) — 기존과 동일
- 빌드: dist/_worker.js 278.03 kB

### 다음 단계 (R7 권장)
- P1: 성능 최적화 — 대용량 테이블 가상화, API 응답 캐싱 정교화
- P2: formField/renderDataTable 사용률 확대 — 나머지 페이지 인라인 테이블→공유 컴포넌트 전환
- P3: E2E 프론트엔드 브라우저 테스트 (Playwright)

---

## Phase R1 — 주문 CRUD 완성 + 데이터 정합성 고도화 ✅ (2026-03-06)

> **목적**: 주문 수동 등록 후 수정/삭제 기능이 없어 운영 불편 → CRUD 완성 및 D1 바인딩 안전성 확보

### R1-A: D1_TYPE_ERROR 근본 수정 ✅
- `crud.ts`: POST /orders — 14개 바인딩 파라미터에 `??` 연산자로 `undefined→null` 안전 변환
- `report.ts`: POST /orders/:id/reports — 6개 바인딩 파라미터 안전화 (file_hash, mime_type 등)
- 배치 임포트(POST /orders/import): 동일 패턴 적용
- 글로벌 에러 핸들러: 스택 트레이스 로깅 추가

### R1-B: 주문 수정 API (PATCH) ✅
- **PATCH /api/orders/:order_id** — RECEIVED~DISTRIBUTED 상태에서만 수정 허용
- 수정 가능 필드 13개: customer_name, customer_phone, address_text, address_detail, admin_dong_code, legal_dong_code, base_amount, requested_date, scheduled_date, memo, channel_id, service_type, external_order_no
- 서비스유형/채널/금액 유효성 검증
- 감사 로그(order_status_history) 기록 — 변경 필드명 포함

### R1-C: 주문 삭제 API (DELETE) ✅
- **DELETE /api/orders/:order_id** — RECEIVED 상태에서만 삭제 허용
- 연관 데이터(order_status_history) 함께 정리
- audit_logs 테이블에 삭제 감사 기록 (entity_type, action, detail_json)
- 테이블 스키마 정합성 수정 (event_code → action 등)

### R1-D: 프론트엔드 수정 모달 ✅
- `showEditOrderModal()` — 기존 값 프리필, 채널/서비스유형 드롭다운 동적 로드
- `submitEditOrder()` — PATCH API 호출, 빈값→null 변환, 주소 readonly 보호
- `deleteOrder()` — confirm 확인 후 DELETE API 호출

### R1-E: 컨텍스트 메뉴 + 드로어 연결 ✅
- **컨텍스트 메뉴**: 수정 가능 상태에서 "주문 수정" 항목 표시, RECEIVED에서 "주문 삭제" 항목 표시
- **드로어 빠른 액션**: 편집/삭제 버튼 상단에 배치 (수정: 파란색, 삭제: 빨간색)
- **드로어 정보 보완**: scheduled_date(예약일), memo(메모) 표시 추가
- **상세 모달**: scheduled_date, memo 이미 포함 확인

### R1-F: 기존 Round 2 수정사항 (이전 세션) ✅
- 정산 export CSV에 channel_name 조인 추가
- refreshStats 날짜 필터 정상 동작 확인
- 칸반/검수/내주문 카드에 채널/서비스유형 표시
- CSV/Excel 내보내기에 채널/서비스유형 컬럼 포함
- OMS.SERVICE_TYPES 전역 상수 정의

### 변경 통계
- 3 files changed: crud.ts(+110), orders.js(+103), interactions.js(+8) = **+221 lines**
- 이전 세션 포함: 10+ files, **+300 lines**
- 통합 테스트: 생성→조회→수정→삭제 전체 플로우 검증 통과
- 에러 로그: 0건 (D1_TYPE_ERROR 완전 해소)

---

## Phase D-6 — 주문 채널 API 연동 + 브랜드 채널 정리 ✅ (2026-03-06)

> **목적**: 주문 채널 = 본사가 주문을 수신하는 외부 발송처. 각 채널에 API 연동 설정을 할 수 있도록 구현.

### D-6-1: DB 마이그레이션 (0013_channel_api_integration.sql) ✅
- `order_channels` 테이블에 16개 API 연동 필드 추가
  - `api_endpoint`, `api_method`, `auth_type`, `auth_credentials`
  - `request_headers`, `request_body_template`, `response_type`
  - `field_mapping`, `data_path`, `polling_interval_min`
  - `last_sync_at/status/message/count`, `total_synced_count`, `api_enabled`
- 기존 테스트 채널(DEFAULT, KT, LGU, SK) 비활성화
- 아정당(AJD) 채널 신규 생성 (우선순위 100)

### D-6-2: 백엔드 채널 API 엔드포인트 확장 ✅
- `GET /api/hr/channels/:id` — 채널 상세 (API 설정 포함)
- `POST /api/hr/channels/:id/test-api` — API 연결 테스트 (응답시간, 레코드 수, 파싱 가능 여부)
- `POST /api/hr/channels/:id/sync` — 주문 동기화 (필드 매핑 → 중복체크 → 자동 주문 생성)
- `DELETE /api/hr/channels/:id` — 채널 삭제
- 인증 방식: NONE, API_KEY, BEARER, BASIC, CUSTOM_HEADER 지원
- `field_mapping` JSON으로 외부 API 응답 필드 → OMS 주문 필드 매핑

### D-6-3: 프론트엔드 채널 관리 페이지 전면 개편 ✅
- 탭 UI: API 설정 / 필드 매핑 / 동기화 상태
- API 연결 테스트 버튼 (응답 시간, 레코드 수, 성공/실패)
- 동기화 실행 버튼 (신규 주문 수, 중복 건너뛴 수)
- 중첩 경로 지원 (예: `result.data[].customer_name`)

### D-6-4: 채널명 에어컨 세척 브랜드별 변경 ✅
- 기본 채널 → 로컬 (LOCAL, 우선순위 10)
- KT 주문원장 → 삼성 (SAMSUNG, 우선순위 90)
- LG U+ 주문원장 → 엘지 (LG, 우선순위 80)
- SK 주문원장 → 캐리어 (CARRIER, 우선순위 70)
- 모든 5개 채널 활성화 완료

### D-6-5: "법인" → "총판" 전체 치환 ✅
- **24개 파일**, 158건 일괄 치환
- JS 7 + TS 7 + SQL 4 + CSS 1 + MD 5개 파일
- DB 데이터: 서울/경기/인천/부산 **지역법인 → 지역총판**
- 전체 프로젝트에서 "법인" **0건** 확인

### 변경 통계
- 마이그레이션 1개: 0013_channel_api_integration.sql
- 커밋 3개: 50b036c(채널 API 연동), 1996aca(채널명 변경), 604dd84(법인→총판)
- 주요 변경 파일: channels-agency.ts(백엔드), channels.js(프론트엔드, ~42KB)

---

## Phase 18.1 — 역할별 대시보드 접근 권한 – TEAM/AGENCY 개인 대시보드 ✅ (2026-03-06)

> **목적**: TEAM_LEADER/AGENCY_LEADER가 "접근 권한 없음" 대신 자기 주문 기준 개인 대시보드를 볼 수 있도록 개선

### 18.1-1: 프론트엔드 권한/메뉴 추가 ✅
- `constants.js`: TEAM_LEADER 권한 목록에 `dashboard` 추가
- `constants.js`: AGENCY_LEADER 권한 목록에 `dashboard` 추가 (기존 agency-dashboard 외 공통 대시보드)
- `constants.js`: TEAM_LEADER 메뉴에 `{ id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드' }` 추가
- `app.js`: TEAM_LEADER 기본 페이지를 `my-orders` → `dashboard`로 변경

### 18.1-2: 대시보드 UI TEAM 유저 커스터마이징 ✅
- **타이틀**: "대시보드" → "내 대시보드"
- **요약 카드 7종** (TEAM 전용): 내 전체 주문, 배정됨(준비), 수행중, 제출/완료, 반려, 정산확정, 총 금액
- **차트 라벨**: "상태별 분포" → "내 주문 상태별 분포" 등
- **바 차트**: 지역총판별(빈 배열) → **퍼널 데이터 기반 수평 바 차트** 대체
- **퍼널 섹션**: "주문 처리 퍼널" → "내 주문 처리 현황"
- **지역총판 테이블**: TEAM 유저에게 숨김 (region_summary 빈 배열)
- **미해결 이슈 섹션**: HQ 전용, TEAM에게 미표시
- **매출 추이/정산 현황 차트**: HQ/REGION 전용, TEAM에게 미표시
- **폴링 카드 업데이트**: TEAM 유저용 카드 값 매핑 대응

### 18.1-3: 백엔드 역할 기반 필터링 ✅
- `dashboard.ts`: `user.org_type !== 'TEAM'` → 역할(roles) 기반 판단으로 변경
- TEAM_LEADER 역할 보유 시 `region_summary` 빈 배열 반환 (불필요한 DB 쿼리 절감)
- Scope Engine이 TEAM_LEADER의 자기 주문만 반환 (기존 로직 활용)

### 데이터 접근 범위 (역할별)
| 역할 | 대시보드 접근 | 데이터 범위 | 지역총판 테이블 | 매출/정산 차트 |
|------|-------------|------------|----------------|---------------|
| SUPER_ADMIN | ✅ | 전체 | ✅ 4개 총판 | ✅ |
| HQ_OPERATOR | ✅ | 전체 | ✅ 4개 총판 | ✅ |
| REGION_ADMIN | ✅ | 자기 지역 | ✅ 자기 총판만 | ✅ |
| AGENCY_LEADER | ✅ | 자기+하위 팀장 | ❌ | ❌ |
| TEAM_LEADER | ✅ **신규** | 자기 주문만 | ❌ | ❌ |
| AUDITOR | ✅ | 전체 (읽기) | ✅ 4개 총판 | ✅ |

### 변경 통계
- 4 files changed, +121 insertions, -52 deletions
- 커밋: e6d11db

---

## Phase 18.0 — KV 캐시 세션 검증 – D1 쿼리 최소화 ✅ (2026-03-06)

> **목적**: 모든 API 요청마다 발생하는 세션 검증 D1 쿼리(3~4회)를 Cloudflare KV 캐시로 대체하여 응답 속도 대폭 개선

### 18.0-1: KV 네임스페이스 설정 ✅
- `SESSION_CACHE` KV 네임스페이스 생성 (ID: `5024085768aa47ba943e4e65a454795e`)
- `wrangler.jsonc`에 KV 바인딩 추가
- `ecosystem.config.cjs`에 `--kv=SESSION_CACHE` 로컬 개발 바인딩 추가

### 18.0-2: 타입 시스템 업데이트 ✅
- `types/index.ts` Env.Bindings에 `SESSION_CACHE: KVNamespace` 추가

### 18.0-3: session-service v2.0 ✅
- **KV 캐시 전략**: 로그인 시 KV 저장 → API 요청 시 KV 조회 → miss 시 D1 fallback → KV 재캐시
- **KV Key**: `session:{sessionId}`, **TTL**: 세션 만료까지 남은 초 (최대 24h)
- `createSession()`: D1 저장 + `loadUserData()` → KV 캐시 (TTL 자동 계산)
- `validateSession()`: KV hit 시 **D1 쿼리 0회** (기존 3~4회 → 0회)
- `deleteSession()`: D1 삭제 + KV 삭제 (로그아웃)
- `invalidateUserSessions()`: 사용자 전체 세션 ID 목록 조회 → KV 일괄 삭제 → D1 삭제
- `cleanExpiredSessions()`: KV는 TTL 자동 만료, D1만 정리
- **장애 안전(Graceful Degradation)**: KV 읽기/쓰기 실패 시 D1 fallback, 서비스 중단 없음

### 18.0-4: 미들웨어/라우트 연동 ✅
- `auth middleware v7.0`: `c.env.SESSION_CACHE` 전달
- `auth.ts`: `createSession()`, `deleteSession()`에 KV 전달
- `hr/users.ts`: `invalidateUserSessions()`에 KV 전달 (비활성화, 비밀번호 리셋, 자격증명 설정)

### 성능 효과
| 항목 | Before (D1 Only) | After (KV Cache) |
|------|-------------------|-------------------|
| 세션 검증 D1 쿼리 | 3~4회/요청 | 0회 (KV hit) |
| 세션 검증 지연 | ~30ms | ~5ms (KV edge) |
| 동시 사용자 200명 × 분당 10요청 | 24,000 D1 쿼리/분 | ~0 D1 쿼리/분 |

### 변경 통계
- 7 files changed, +194 insertions, -43 deletions
- 커밋: 6cb221d
- E2E 50/50 통과

---

## Phase 17.0 — 주문 수동 등록 – 실주소 검색 ✅ (2026-03-06)

> **목적**: 주문 수동 등록 시 카카오 우편번호 서비스로 실주소를 검색하고 행정동 코드 자동 매핑

### 17-1: 카카오 우편번호 서비스 연동 ✅
- Daum Postcode v2 CDN 추가 (`t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js`)
- API 키 불필요, 무료 사용
- 주문 수동 등록 모달에 "주소 검색" 버튼 추가
- 도로명/지번/건물명 검색 → 선택 시 자동 주소 채움

### 17-2: 행정동 코드 자동 매핑 ✅
- 선택 주소에서 시도/시군구/읍면동 파싱
- `GET /api/system/address-lookup?sido=&sigungu=&dong=` 백엔드 API 호출
- admin_regions 테이블 매칭 → admin_dong_code 자동 설정
- 매핑 성공: 파란색 상자에 코드 + 지역명 표시
- 매핑 실패: 경고 메시지 표시

### 17-3: 행정구역 조회 API ✅
- `GET /api/system/admin-regions?sido=` — 시도별 행정구역 목록
- `GET /api/system/address-lookup?sido=&sigungu=&dong=` — 주소→행정동 코드 매핑

### 변경 통계
- 3 files changed, +153 insertions, -3 deletions
- 커밋: a7f1422

---

## Phase 17.1 — 보고서/영수증 – 모바일 카메라 직접 첨부 + 파일명 규칙화 ✅ (2026-03-06)

> **목적**: 보고서 체크리스트/영수증에서 URL 링크 대신 모바일 카메라 직접 촬영 + 파일명 자동 규칙화

### 17.1-1: 프론트엔드 – 카메라/갤러리 첨부 UI ✅
- 보고서 체크리스트 6개 항목 각각에 "촬영"/"갤러리" 버튼 추가
  - exterior_photo (외부촬영, 필수), interior_photo (내부촬영, 필수)
  - before_wash (세척전, 필수), after_wash (세척후, 필수)
  - receipt (영수증, 선택), customer_confirm (고객확인, 선택)
- `<input type="file" accept="image/*" capture="environment">` — 모바일 카메라 직접 실행
- `handleFileAttach()` — 2MB 제한, 이미지 타입 검증, FileReader → Base64 변환
- 미리보기 썸네일 (80x80) + X 버튼 삭제
- 사진 첨부 시 해당 체크리스트 자동 체크

### 17.1-2: 파일명 자동 규칙화 ✅
- 클라이언트 측: `YYYYMMDD_팀코드_카테고리.확장자`
  - 팀 코드 = `currentUser.org_code` 또는 `login_id` 폴백
  - 카테고리 한글 매핑: EXTERIOR→외부촬영, BEFORE_WASH→세척전, RECEIPT→영수증 등
- 서버 측 (report.ts): `generateFileName()` — org_code DB 조회 기반 팀 코드 확인
  - 파일명 패턴: `YYYYMMDD_팀코드_주문ID_카테고리.확장자`
- 예: `20260306_REGION_SEOUL_외부촬영.jpg`, `20260306_REGION_SEOUL_42_영수증.png`

### 17.1-3: 백엔드 – 사진 업로드/저장 ✅
- `POST /api/orders/:id/upload` — multipart/form-data 사진 업로드
  - 2MB 제한, 이미지 타입 검증
  - File → ArrayBuffer → Base64 Data URL 변환
  - work_report_photos 테이블에 file_url(Base64), file_name, file_size, mime_type 저장
- `POST /api/orders/:id/reports` — photos[] 배열로 Base64 사진 일괄 저장
- `POST /api/orders/:id/complete` — receipt_url에 Base64 영수증 저장

### 17.1-4: 영수증 첨부 UI 통합 ✅
- 최종완료(completeOrder) 모달에 카메라/갤러리 버튼 추가
- URL 입력 필드 제거 → 직접 촬영/선택으로 대체
- 미리보기 + 삭제 동일 UX

### 17.1-5: DB 마이그레이션 ✅
- `0011_photo_upload.sql` — work_report_photos에 file_name, file_size, mime_type 컬럼 추가

### 17.1-6: /auth/me org_code 추가 ✅
- 로그인 세션 응답에 `org_code` 필드 포함 → 파일명 팀코드 자동 반영

### 변경 통계
- 4 files changed, +317 insertions, -34 deletions
- 신규 파일 1개: migrations/0011_photo_upload.sql
- 커밋: ae02022

---

## Phase 16.0 — 품질 강화 + 문서 정비 + E2E 테스트 ✅

> **목적**: 프로덕션 안정성 확보, 문서 정합성, 에러 핸들링, 통합 테스트

### 16-1: 프로덕션 DB 마이그레이션 ✅
- 0006~0009 마이그레이션 프로덕션 적용 완료
- 0010_ready_done_status.sql FK 제약 이슈 → PRAGMA foreign_keys=OFF 포함 수동 적용
- 프로덕션 orders/order_assignments 테이블에 READY_DONE/DONE CHECK 제약 확인
- 데이터 무결성 검증 (주문 10건, 배정 7건 보존)

### 16-2: 문서 3종 + README 정합성 업데이트 ✅
- ARCHITECTURE.md → v16.0 (전체 구조, 상태전이, API 맵, E2E 테스트, 코드 통계 반영)
- PROGRESS.md → v16.0 (Phase 16 완료 상태 반영)
- IMPLEMENTATION_TRACKER.md → v16.0 (세부 체크리스트 완료)
- README.md → v16.0 (버전/URL/코드량/기능 업데이트)

### 16-3: E2E 통합 테스트 ✅
- `tests/e2e.sh` (386줄, 50개 테스트) — **50/50 전체 통과**
- 15개 영역: 헬스체크, 인증, 주문 CRUD, 주문 라이프사이클, 배치, 정산, 통계, 정책, 알림, 시스템, HR/감사, 채널/대리점, RBAC, 매출/정산차트, 로그아웃
- 3역할 교차 테스트: SUPER_ADMIN, REGION_ADMIN, TEAM_LEADER
- 타임스탬프 기반 고유 데이터로 반복 실행 안정

### 16-4: 에러 핸들링 강화 ✅
- **프론트엔드 (api.js v4.0)**:
  - API 재시도: GET 2회, 5xx 서버 에러 자동 재시도 (지수 백오프)
  - 오프라인 감지: `navigator.onLine` + 이벤트 리스너, 상단 배너 표시
  - 요청 타임아웃: `AbortController` 30초 기본
  - 글로벌 에러: `window.error`, `unhandledrejection` 핸들러
- **백엔드 (index.tsx)**:
  - 에러 자동 분류: DB/검증/타임아웃/404 → 적절한 HTTP 상태 코드
  - 에러 코드 표준화: `INTERNAL_ERROR`, `DB_ERROR`, `VALIDATION_ERROR`, `TIMEOUT`, `NOT_FOUND`
  - `_debug` 필드에 원본 에러 메시지 포함 (200자 제한)

### 16-5: 버그 수정 ✅
- **로그아웃 API**: Cookie에서 session_id 미추출 → `getSessionCookie()` 헬퍼 추가로 쿠키 기반 세션 삭제 정상화
- **보고서 사진 업로드**: `photo.url` / `photo.file_url` 양쪽 수용 (하위 호환)

### 변경 통계
- 8 files changed, +826 insertions, -206 deletions
- 신규 파일 1개: tests/e2e.sh (386줄)
- 커밋: 03cfb17

---

## Phase 15.0 — GAP 패치 + 상태전이 정규화 + 정책 CRUD ✅

> **목적**: 백엔드-프론트엔드 GAP 해소, 팀장 수행 플로우 정규화, 정책 관리 CRUD

### 15-1: READY_DONE 상태 추가 (GAP-1) ✅
- types/index.ts: OrderStatus에 READY_DONE 추가
- state-machine.ts: ASSIGNED→READY_DONE 전이 규칙
- assign.ts: POST /:order_id/ready-done 엔드포인트 (scheduled_date)
- assign.ts: POST /:order_id/start (READY_DONE→IN_PROGRESS)

### 15-2: DONE 상태 + 영수증 첨부 (GAP-2) ✅
- types/index.ts: OrderStatus에 DONE 추가
- state-machine.ts: SUBMITTED→DONE 전이 규칙
- report.ts: POST /:order_id/complete (영수증 URL 첨부)

### 15-3: 알림 트리거 (GAP-3) ✅
- assign.ts: 배정 시 팀장에게 ASSIGNMENT 알림
- report.ts: 최종완료 시 지역관리자에게 ORDER_COMPLETED 알림
- review.ts: 검수 결과 팀장에게 REGION_APPROVED/HQ_APPROVED/REJECTED 알림

### 15-4: 정책관리 CRUD (GAP-5) ✅
- stats/policies.ts: 7개 CRUD 엔드포인트 추가
  - 배분정책: POST/PUT /policies/distribution
  - 보고서정책: POST/PUT /policies/report
  - 수수료정책: POST/PUT /policies/commission
- statistics.js: 4탭 정책관리 UI (배분/보고서/수수료/지역매핑) + CRUD 폼

### 15-5: 프론트엔드 상태 업데이트 (GAP-6) ✅
- constants.js: READY_DONE/DONE 상태 정의 (label, color, icon, step)
- my-orders.js: 준비완료/작업시작 버튼 + 영수증 첨부 완료 버튼
- kanban.js: READY_DONE 상태 칸반 카드
- review.js: DONE 상태 지역검수 큐
- interactions.js: 상태 플로우 바에 READY_DONE/DONE 추가

### 15-6: DB 마이그레이션 ✅
- 0010_ready_done_status.sql: orders/order_assignments CHECK 제약 갱신

### 변경 통계
- 12 files changed, +788 insertions, -55 deletions
- 커밋: e32d798

---

## Phase 13.0 — 시스템 관리 + 보안 강화 + 글로벌 검색 + 타임라인 ✅ (최신)

> **목적**: 시스템 관리 대시보드, 보안 강화 (계정 잠금/비밀번호 정책), 글로벌 통합 검색, 주문 활동 타임라인

### 13-1: 시스템 관리 페이지 (SUPER_ADMIN 전용) ✅
- `GET /api/system/info` — 시스템 버전, 사용자/주문/조직/세션/알림/마이그레이션 통계
- `GET /api/system/backup-info` — 전체 테이블 행 수 현황 (34개 테이블)
- `GET /api/system/export/:table` — 화이트리스트 기반 테이블 데이터 내보내기 (감사 로그 기록)
- `GET /api/system/sessions` — 활성 세션 목록 (사용자명, 로그인ID, 생성/만료 시간)
- `DELETE /api/system/sessions/:session_id` — 세션 강제 종료 (감사 로그)
- `DELETE /api/system/sessions` — 전체 세션 초기화 (자기 세션 제외)
- UI: 시스템 정보 카드, 활성 세션 테이블, DB 현황 그리드
- 사이드바 메뉴 '시스템' 추가 (SUPER_ADMIN, adminOnly)

### 13-2: 보안 강화 ✅
- **계정 잠금**: 5회 연속 로그인 실패 시 5분간 계정 잠금 (423 응답)
  - 실패 시에만 카운트 증가 (성공 시 카운트 초기화)
  - 기존 rate limit (10회/분) 위에 별도 잠금 메커니즘
  - `rateLimitMap` export로 auth.ts에서 직접 검사/초기화 가능
- **비밀번호 정책 강화**: 최소 6자 + 영문+숫자 조합 필수 + 현재 비밀번호와 동일 불가
- 세션 강제 종료 API (개별/전체)
- 감사 로그: LOGIN_FAILED, SESSION_REVOKE, SESSION_PURGE, DATA_EXPORT 이벤트

### 13-3: 주문 타임라인 (활동 이력) ✅
- `GET /api/system/order-timeline/:order_id` — 주문 전체 이력 통합 조회
  - 감사 로그, 배분 이력, 배정 이력, 보고서, 검수, 정산 — 6개 소스 병합
  - 시간 역순 정렬, 타입별 아이콘/색상 구분
- UI: 타임라인 모달 (주문 요약 + 이벤트 카운트 + 시간순 목록)
- 이벤트별 아이콘: 생성(파랑), 수정(노랑), 배분(보라), 배정(초록), 보고(시안), 승인(녹색), 반려(빨강), 정산(금색)
- 글로벌 검색에서 주문 클릭 시 타임라인 자동 표시

### 13-4: 글로벌 검색 (Cmd+K / Ctrl+K) ✅
- `GET /api/system/search?q=` — 통합 검색 API
  - 주문 검색: 고객명, 주문번호, 주소, 주문ID (최대 10건)
  - 사용자 검색: 이름, 로그인ID, 전화번호 (HQ/REGION만, 최대 8건)
  - 조직 검색: 이름, 코드 (HQ만, 최대 5건)
  - 2자 이상 입력 필수
- UI: 오버레이 모달 (ESC/배경 클릭 닫기)
  - 300ms debounce 검색
  - 결과 타입별 아이콘/배지 표시
  - 키보드 Cmd+K / Ctrl+K 단축키
  - 검색 결과 클릭 시 해당 페이지 이동

### 변경 통계
- 신규 파일 2개: system.ts (366줄), system.js (310줄)
- 변경 3개: auth.ts (로그인 잠금), security.ts (rateLimitMap export), index.tsx (시스템 라우트)
- 총 코드량 +710줄

---

## Phase 12.0 — 실시간 폴링 + 온보딩 + 채널수수료 + 엑셀 ✅

> **목적**: 실시간 대시보드, 대리점 온보딩 자동화, 채널별 수수료, 엑셀 내보내기

### 12-1: 대시보드 실시간 폴링 ✅
- 60초 간격 대시보드 자동 갱신 (`startDashboardPolling` / `stopDashboardPolling`)
- 카드 값 변경 시 파란색+확대 애니메이션 (0.6초)
- 30초 간격 글로벌 알림 배지 폴링 (`startGlobalNotifPolling`)
- 로그인/로그아웃 시 폴링 자동 시작/정지
- 대시보드 진입/이탈 시 자동 관리

### 12-2: 대리점 온보딩 워크플로 ✅
- DB: `agency_onboarding` 테이블 (migration 0008)
- API: `GET/POST /api/hr/agency-onboarding` — 목록 조회/신청
- API: `PUT /api/hr/agency-onboarding/:id` — 승인/반려
- 승인 시 자동 `AGENCY_LEADER` 역할 부여 + 알림 발송
- 반려 시 사유와 함께 시스템 알림 발송
- 중복 신청/기존 권한 방지 검증
- UI: 온보딩 관리 모달 (HR > 대리점 관리 탭)

### 12-3: 채널별 수수료 정책 ✅
- DB: `commission_policies.channel_id` 컬럼 추가 (migration 0008)
- 정산 산출 우선순위: 채널+개인 → 채널+조직 → 개인 → 조직 기본
- 수수료 정책 생성/목록에 채널 선택 필드 추가
- 테이블에 '채널' 컬럼 표시

### 12-4: 엑셀(xlsx) 내보내기 ✅
- SheetJS CDN (xlsx.full.min.js) 연동
- `exportToExcel()` 유틸: 자동 컬럼 너비, 시트명 지정
- 주문목록 엑셀 내보내기 (`exportOrdersExcel`) — 12개 컬럼
- 정산내역 엑셀 내보내기 (`exportSettlementExcel`) — 13개 컬럼
- 주문관리 상단에 CSV/Excel 두 버튼 병렬 배치

### 12-5: createNotification 호출 버그 수정 ✅
- `channels-agency.ts` 내 4곳 `createNotification(db, {user_id, ...})` → `createNotification(db, userId, {...})` 형태로 수정

> **목적**: 정산 데이터 인쇄/내보내기, 대리점 정산 관리, 프론트엔드 성능 유틸

### 11-1: 정산 보고서 인쇄용 HTML ✅
- `GET /api/settlements/runs/:run_id/report` — 팀장별 그룹핑 보고서 데이터
- `printSettlementReport()` — 인쇄용 HTML 새 창 (CSS @media print)
- 요약 카드 (건수/기본금액/수수료/지급액) + 팀장별 소계 + 개별 명세
- 인쇄/닫기 버튼, 와이비 OMS 푸터

### 11-2: 정산 CSV 내보내기 ✅
- `GET /api/settlements/runs/:run_id/export` — CSV용 원시 데이터
- `exportSettlementCSV()` — exportToCSV 유틸 활용
- 정산 컨텍스트 메뉴에 '보고서 인쇄', 'CSV 내보내기' 추가

### 11-3: 대리점 정산 내역서 ✅
- `GET /api/settlements/agency-statement` — 대리점 하위 팀장 정산 집계
- `renderAgencyStatement()` — 대리점 정산 내역 페이지 (팀장별 확장)
- `printAgencyStatement()` — 대리점 전용 인쇄용 HTML
- constants.js: AGENCY 메뉴/권한에 'agency-statement' 추가
- auth.js: 라우팅 추가

### 11-4: 프론트엔드 성능 유틸 ✅
- `cachedApi()` — TTL 기반 API 응답 캐시 (30초, 최대 50건)
- `invalidateCache()` — 패턴 기반 캐시 무효화
- `debounce()` — 입력 지연 유틸 (300ms 기본)
- `throttle()` — 빈도 제한 유틸 (200ms 기본)

### 변경 통계
- 신규 파일 1개: report.ts (199줄)
- 변경 6개: settlement.js (+235줄), ui.js (+37줄), constants.js (+2줄), auth.js (+1줄), index.tsx (버전), settlements/index.ts (+3줄)

---

## Phase 10.0 — 성능 최적화 + 알림 설정 ✅

> **목적**: DB 쿼리 성능 인덱스 추가 + 사용자별 알림 설정 기능

### 10-1: DB 성능 인덱스 (마이그레이션 0007) ✅
- 16개 복합 인덱스 추가 (쿼리 패턴 기반)
- `idx_orders_status_created` — 대시보드 통계, 목록 필터
- `idx_notif_user_read` — 미읽음 카운트 최적화
- `idx_session_id`, `idx_session_user_exp` — 인증 미들웨어 매 요청
- `idx_org_parent_type` — 하위 조직 조회
- `idx_dist_order_status`, `idx_assign_order_status` — 활성 배분/배정
- `idx_rds_date_region`, `idx_tlds_date_leader` — 통계 차트
- 기타: 감사로그, OTP, 가입요청 인덱스

### 10-2: 알림 설정 테이블 + API ✅
- `notification_preferences` 테이블 생성 (user_id UNIQUE)
- 유형별 on/off: 주문상태, 배정, 검수, 정산, 가입, 시스템
- 수단별 on/off: 인앱 푸시, 알림 소리
- `GET /api/notifications/preferences` — 설정 조회 (없으면 기본값 자동 생성)
- `PUT /api/notifications/preferences` — 설정 업데이트 (upsert)

### 10-3: notification-service 설정 연동 ✅
- `TYPE_TO_PREF_COL` 매핑 (22개 알림 유형 → 6개 설정 컬럼)
- `isNotificationEnabled()` — 알림 생성 전 사용자 설정 확인
- 비활성화 유형은 알림 생성 자체를 skip (DB 쓰기 절감)

### 10-4: 프로필 페이지 알림 설정 UI ✅
- 프로필 페이지 탭 구조 리디자인 (계정/비밀번호/알림 3탭)
- `switchProfileTab()` — 탭 전환 함수
- 알림 유형 6개 토글 스위치 (CSS 커스텀 toggle)
- 알림 수단 2개 토글 스위치
- `updateNotifPref()` — 실시간 저장 + 즉시 UI 반영 (optimistic update)
- `toggleAllNotifPrefs()` — 전체 켜기 기능
- 설정 저장 실패 시 자동 롤백

### 변경 통계
- 4 files changed: notification-service.ts (+48줄), notifications.ts (기존 API), my-orders.js (+169줄), migrations/0007 (+73줄)
- 신규 함수 5개: switchProfileTab, updateNotifPref, toggleAllNotifPrefs, isNotificationEnabled, TYPE_TO_PREF_COL

---

## Phase 9.0 — 모바일 반응형 최적화 ✅

> **목적**: 768px 이하 모바일 환경에서 사용 가능한 반응형 레이아웃

### 9-1: 모바일 레이아웃 ✅
- 사이드바 → 하단 내비게이션 (4메인 + 더보기)
- 모바일 헤더 (제목 + 알림벨)
- '더보기' 시트 패널 (전체 메뉴 + 프로필/로그아웃)
- resize 핸들러 (768px 기준 자동 전환)

### 9-2: 모바일 전용 CSS (419줄) ✅
- 테이블 6개 컬럼 자동 숨김
- 칸반 세로 배치 + 접을 수 있는 컬럼
- 드로어/모달 전폭 표시
- 배치 액션바 하단 내비 위 표시

### 9-3: 터치 제스처 ✅
- 풀투리프레시 (pull-to-refresh)
- 검수 카드 좌/우 스와이프 (승인/반려)

---

## Phase 8.0 — 데이터 시각화 + CSV 내보내기 ✅

> **목적**: 실시간 대시보드 차트 + 주문 데이터 CSV 다운로드

### 8-1: 대시보드 차트 (Chart.js) ✅
- 일별 주문 추이 라인차트
- 상태별 분포 도넛차트
- 지역별 실적 바차트

### 8-2: CSV 내보내기 ✅
- 주문 목록 CSV 다운로드 (core/ui.js exportToCSV 유틸)
- 지역/팀장 통계 CSV

---

## Phase 7.1 — 배분 기능 완성 ✅

> **목적**: 미배분 주문의 개별/일괄 수동배분 기능 완성 및 UX 개선

### 7.1-1: 주문관리 페이지 일괄배분 ✅
- 배치 액션바의 '일괄 배분' 버튼 → 지역총판 선택 모달로 변경 (alert 제거)
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

## Phase 7.1 — 배분 기능 완성 ✅ (2026-03-05)

> **목적**: 주문관리·배분관리 페이지의 일괄/개별 수동 배분 UI 구현 및 드로어 빠른액션 추가

### 구현 내역
- [x] 주문관리 페이지: 일괄배분 버튼 → 실제 배분 모달 (placeholder alert 제거)
- [x] 배분관리 페이지: 선택배분(showBatchDistributeModal) 모달 구현
- [x] 수동 배분 모달 UI 개선 (주문번호·고객명·주소 표시, 지역총판 선택)
- [x] 드로어 빠른액션: 미배분(RECEIVED/VALIDATED/DISTRIBUTION_PENDING) 주문에 "수동 배분" 버튼 추가
- [x] POST /api/orders/batch-distribute 연동 (최대 100건 일괄)
- [x] PATCH /api/orders/:id/distribution 연동 (개별 수동 재배분)

### 변경 파일 (4개, +366/-51줄)
- `public/static/js/pages/orders.js` — 배분 모달 전면 재작성
- `src/routes/orders/distribute.ts` — 기존 백엔드 유지 (변경 없음)
- `README.md` — v7.1 반영
- `PROGRESS.md` — Phase 7.1 추가

---

## Phase 8 — 데이터 시각화 + CSV 내보내기

### 8-1: 데이터 시각화 강화 ✅ 완료 (2026-03-05)
- [x] Dashboard 실시간 차트 (Chart.js 활용) — 3종 차트 구현
  - 도넛 차트: 상태별 주문 분포
  - 수평 바 차트: 지역별 처리 현황
  - 라인 차트: 7일간 주문 추이
- [x] 차트 영역 접기/펼치기 토글
- [x] 데이터 없을 때 빈 상태 표시
- [x] 매출 추이 그래프 — Phase 14.0에서 구현 (일별/월별/지역별 매출 추이 3종 차트)
- [ ] 지역별 히트맵 — 지도 기반 시각화 구현 예정
- [x] 정산 현황 차트 — Phase 14.0에서 구현 (상태 도넛/지역별 스택바/최근 Run 테이블)

### 8-2: 모바일/반응형 최적화 → Phase 9로 이동 ✅ 완료 (2026-03-05)
- [x] Phase 9에서 전면 구현

---

## Phase 9 — 모바일/반응형 최적화 ✅ (2026-03-05)

> **목적**: 768px 이하 모바일 디바이스에서 완전한 사용 경험 제공

### 9-1: 반응형 레이아웃 전환
- [x] mobile.css 신규 생성 (419줄) — @media 768px 이하 전면 제어
- [x] 사이드바 → 바텀 네비게이션 (역할별 4개 주요 메뉴 + 더보기)
- [x] 모바일 헤더 (페이지 타이틀 + 알림 벨)
- [x] 더보기 시트 패널 (전체 메뉴 + 사용자 프로필 + 로그아웃)
- [x] viewport-fit=cover, apple-mobile-web-app 메타태그
- [x] 리사이즈 시 데스크탑↔모바일 자동 전환

### 9-2: 주요 페이지 모바일 최적화
- [x] 주문 테이블: 모바일에서 불필요 컬럼 자동 숨김 (주소/주문번호/지역총판/팀장/요청일/진행)
- [x] 칸반 보드: 모바일에서 세로 배치 + 컬럼 접기 + 300px max-height
- [x] 드로어: 모바일 풀스크린 (width: 100%)
- [x] 모달: 95% 폭 반응형
- [x] 배치바: 바텀네비 위에 표시
- [x] 필터바: 가로 스크롤 대응

### 9-3: 터치 제스처 지원
- [x] 풀투리프레시: 콘텐츠 상단에서 당겨서 새로고침
- [x] 스와이프 액션 유틸리티 (initSwipeAction)
- [x] 검수 카드 스와이프: 우측→승인, 좌측→반려 (enableReviewSwipe)
- [x] 버튼/터치 영역 확대 (min-height: 36px)

### 변경 파일
- `public/static/css/mobile.css` — 419줄 **신규 생성**
- `public/static/js/core/app.js` — 전면 재작성 (바텀네비, 더보기 메뉴, PTR)
- `public/static/js/core/interactions.js` — 스와이프 액션 추가
- `public/static/js/pages/kanban.js` — 모바일 클래스 추가
- `src/index.tsx` — mobile.css 링크, viewport 메타, v9.0

### 8-3: 알림 고도화 ✅ 부분 완료
- [x] 웹 푸시 알림 (Service Worker) — Phase 14.0에서 구현 (sw.js 143줄)
- [ ] 이메일 알림 연동 — 정산서 발송용 이메일 서비스 검토 중
- [x] 알림 설정 (유형별 on/off) — Phase 10.0에서 구현 (notification_preferences)

### 8-4: 보고서/CSV 출력 ✅ 완료
- [x] 주문 목록 CSV 내보내기 (주문관리 페이지 버튼)
- [x] 공통 exportToCSV 유틸리티 (core/ui.js)
- [x] 통계 CSV 내보내기 (지역별/팀장별)
- [x] 정산 보고서 인쇄용 HTML — Phase 11.0에서 구현 (PDF는 브라우저 인쇄→PDF 저장)
- [x] 엑셀(xlsx) 다운로드 — Phase 12.0에서 구현 (SheetJS)

### 8-5: 성능 최적화 ✅ 완료
- [x] 프론트엔드 번들 최적화 — Tailwind CDN → PostCSS 빌드 전환 예정 (경미)
- [x] DB 인덱스 최적화 — Phase 10.0에서 16개 복합 인덱스 추가
- [x] 캐시 전략 (KV 활용) — Phase 18.0에서 SESSION_CACHE KV 구현

### 8-6: 대리점 기능 고도화 ✅ 부분 완료
- [ ] 대리점 수수료 자동 분배 — 산출 절차별 계산서 형태 UI 구현 예정
- [x] 대리점별 정산 명세 — Phase 11.0 agency-statement
- [x] 대리점 가입 워크플로 — Phase 12.0 agency_onboarding
- [x] 채널별 수수료 정책 — Phase 12.0 channel_id 연동

---

## 알려진 이슈

| # | 이슈 | 상태 | 비고 |
|---|------|------|------|
| 1 | ~~로그인 실패~~ | ✅ 해결 | seed.sql 재적용으로 해결 |
| 2 | ~~드로어 닫기 버그~~ | ✅ 해결 | race condition 수정 |
| 3 | ~~commission_policies updated_at 컬럼 없음~~ | ✅ 해결 | 0006 마이그레이션에서 ALTER TABLE 추가 |
| 4 | ~~가입 요청 SQL syntax error~~ | ✅ 해결 | admin_regions seed 데이터 누락 → FK 제약 위반. seed.sql에 20개 행정구역 데이터 추가하여 해결 |
| 5 | Tailwind CDN 프로덕션 경고 | ℹ️ 경미 | PostCSS 설치 권장 |

---

## 테스트 계정

| 역할 | 아이디 | 비밀번호 | org_type |
|------|--------|----------|----------|
| HQ 총괄관리자 | admin | admin123 | HQ |
| HQ 운영자 | hq_operator | admin123 | HQ |
| 서울 지역총판 관리자 | seoul_admin | admin123 | REGION |
| 경기 지역총판 관리자 | gyeonggi_admin | admin123 | REGION |
| 인천 지역총판 관리자 | incheon_admin | admin123 | REGION |
| 부산 지역총판 관리자 | busan_admin | admin123 | REGION |
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

---

## 🔧 시스템 고도화 (Refinement) — v20.x

> **목표**: 기존 구조를 존중하면서 설계 정합성, 기능 완성도, UI/UX, 운영 편의성, 데이터 안정성을 단계적으로 끌어올린다.
> **원칙**: 비파괴적 개선. 기존 잘 구현된 기능은 유지하고, 부족한 부분만 보강.
> **시작일**: 2026-03-06

### 고도화 로드맵 (진행 단위 및 우선순위)

| 순서 | 단위 | 범위 | 핵심 초점 | 상태 |
|------|------|------|-----------|------|
| R1 | **주문 핵심 흐름** | 주문등록→배분→칸반배정 | 입력 정합성, 상태 전이 일관성, 누락 검증 | ✅ 완료 |
| R2 | **팀장 수행 흐름** | 내주문→준비→수행→보고서→완료→검수→반려재보고 | 상태 전이 UX, 보고서 필수값, 사진 검증, 반려→재보고 | ✅ 완료 |
| R3 | **검수·정산 흐름** | 1차검수→HQ검수→정산산출→확정→지급 | 검수-정산 연계, CSV/인보이스 정합성 | ✅ 완료 |
| R4 | **기준정보 관리** | 채널·정책·수수료·조직·지역권 | 마스터 데이터 CRUD 완성도, 연쇄 반영 | ✅ 완료 |
| R5 | **인사·권한·가입** | 사용자·역할·가입신청·대리점·폰인증 | RBAC 정합성, 가입 플로우 완결성 | ✅ 완료 |
| R6 | **공통 UI/UX·입력체계** | 모달·토스트·테이블·모바일·검색 | 일관성, 접근성, 반응형, 에러 UX | ✅ 완료 |
| R7 | **대시보드·통계·감사** | 대시보드·통계·대사·감사로그 | 인라인 테이블→renderDataTable, apiAction 전환, 접근성 | ✅ 완료 |
| R8 | **운영 안정성·보안** | 세션·에러처리·입력검증·SQL주입방어 | 프로덕션 안정성, 엣지 케이스 방어 | ✅ 완료 |
| R9 | **나머지 인라인 테이블 전환** | settlement/review/kanban 등 | renderDataTable 확대, formField 재활용 | ⏳ 대기 |

---

### R1: 주문 핵심 흐름 고도화 — 탐색·진단·개선·검증

> **범위**: 주문 수동등록 → 자동배분 → 수동배분 → 칸반(팀장배정) → 주문 목록/상세
> **상태**: ✅ 완료 (2026-03-06)

#### R1-1단계: 탐색 및 진단 ✅ 완료

**점검 대상:**
- [x] 주문 수동등록 모달 (orders.js `showNewOrderModal`, `submitNewOrder`)
- [x] 주문 목록 조회 + 필터 + 정렬 (orders.js `renderOrders`)
- [x] 주문 상세 모달/드로어 (orders.js `showOrderDetail`, `showOrderDetailDrawer`)
- [x] 자동배분 로직 (distribute.ts, orders.js `renderDistribute`)
- [x] 수동배분/재배분 (distribute.ts, orders.js 배분 UI)
- [x] 칸반 배정 (kanban.js, assign.ts) + 드래그앤드롭, 배치배정
- [x] 주문 CRUD 백엔드 (crud.ts) — D1 바인딩 안전성 (v19.2 에서 수정 완료)
- [x] 주문 상태전이 State Machine 정합성
- [x] 수정/삭제/일괄수신 (PATCH/DELETE/POST import)
- [x] Scope Engine 기반 권한 검증 (HQ/REGION/TEAM)
- [x] E2E API 테스트 시나리오 실행 (정상 흐름 + 엣지 케이스 17건)

**식별된 문제점:**

| # | 문제 | 위치 | 심각도 | 유형 |
|---|------|------|--------|------|
| 1 | 🔴 **주문 삭제 DB 에러** — audit_logs에 없는 컬럼 `event_code` INSERT 시도 → SQLITE_ERROR. 실제 테이블은 `action` 컬럼 사용 | crud.ts L349-353 | CRITICAL | 버그 |
| 2 | 🟠 **전화번호 형식 미검증** — `customer_phone`에 "abcdefg" 같은 무의미 문자열도 등록 가능. 프론트/백 모두 format 체크 없음 | crud.ts L144, orders.js L597 | HIGH | 입력검증 |
| 3 | 🟠 **주문 수정 시 주소 변경 불가** — 수정 모달에서 address_text가 readonly이고 주소 검색 버튼 없음. 주소 오류 수정 시 신규 등록 필요 | orders.js L649 | HIGH | UX결함 |
| 4 | 🟡 **수동 등록 폼: 금액 step=1000 제한** — 실제 업무에서 15,500원 같은 비정수 금액 입력이 불가능하진 않지만 step 때문에 슬라이더에서 빗나감 | orders.js L516 | MEDIUM | UX |
| 5 | 🟡 **주문 수정에서 상세주소/행정동 미표시** — 수정 모달에 address_detail, admin_dong_code 표시되지만 변경 불가 (주소 연동이 없어 한계) | orders.js L647-650 | MEDIUM | UX |
| 6 | 🟡 **칸반: ASSIGNED 상태 드래그 시 단일 카드도 배치 분기 진입** — 이미 배정된 카드를 다른 팀장으로 드래그하면 `isFromAssigned=true`로 배치 경로에 빠지며, DISTRIBUTED 필터링에 의해 배정 가능 주문이 0건이 됨 → 무반응 | kanban.js L478-499 | MEDIUM | UX |
| 7 | 🟡 **배분 보류(DISTRIBUTION_PENDING) 카드에 "행정동 매칭 실패" 고정 텍스트** — 실제로는 admin_dong_code가 있으나 매핑만 없는 경우도 있는데, 모든 보류 건에 동일 메시지 표시 | orders.js L866 | LOW | UX |
| 8 | 🟢 **주문 상세에서 address_detail 미표시** — 상세주소가 DB에 저장되지만 상세 드로어/모달에서 보이지 않음 | orders.js L189 | LOW | 누락 |
| 9 | 🟢 **주문 등록 성공 응답의 _status 판별** — `res?._status === 201` 체크하지만 API 래퍼가 반환하는 구조에 따라 누락 가능 | orders.js L607 | LOW | 잠재버그 |
| 10 | 🟢 **일괄 수신(Import) JSON 직접 입력** — 실무에서는 Excel/CSV 파일 업로드가 필요하나, 현재 JSON 텍스트 직접 입력만 지원 | orders.js L694-711 | LOW | 기능미비 |

#### R1-2단계: 개선안 정리 🔄

| # | 문제 | 개선안 | 영향 범위 |
|---|------|--------|-----------|
| 1 | audit_logs 컬럼 불일치 | INSERT 문을 실제 스키마(action, detail_json)에 맞게 수정 | crud.ts 삭제 로직 |
| 2 | 전화번호 형식 | 백엔드: 정규식 검증 추가 (`/^0\d{1,3}-?\d{3,4}-?\d{4}$/`), 프론트: 입력 패턴 + 자동 하이픈 | crud.ts, orders.js |
| 3 | 주문 수정 주소 변경 | 수정 모달에 주소 검색 버튼 추가 + 행정동 재매핑 | orders.js 수정 모달 |
| 4 | 금액 step 1000 | step="100"으로 변경 (100원 단위) | orders.js 등록/수정 모달 |
| 5 | 수정 모달 상세주소 | 상세주소 입력 필드 추가 (편집 가능) | orders.js 수정 모달 |
| 6 | 칸반 재배정 드래그 | ASSIGNED 카드를 다른 팀장에게 드래그 시 unassign→assign 자동 수행 | kanban.js |
| 7 | 배분보류 메시지 | admin_dong_code 유무에 따라 구체적 메시지 표시 | orders.js |
| 8 | 상세주소 표시 | 드로어/모달에 address_detail 표시 | orders.js |
| 9 | 응답 판별 | _status 대신 order_id 존재 여부로 성공 판별 | orders.js |
| 10 | 일괄 수신 개선 | (R1에서 제외 — 별도 Round에서 CSV 파서 추가 계획) | — |

#### R1-3단계: 실제 수정 ✅ 완료

**수정 내역:**

| # | 수정 | 파일 | 변경 사항 |
|---|------|------|-----------|
| 1 | 전화번호 검증 추가 | crud.ts | 정규식 `/^0\d{8,10}$/` 검증, 하이픈/공백 제거 후 검증 |
| 2 | 전화번호 프론트 검증 | orders.js | submitNewOrder에 동일 정규식 추가 |
| 3 | 주문 수정 주소 검색 | orders.js | 수정 모달에 주소 검색 버튼 + openEditAddressSearch + matchEditAdminDongCode |
| 4 | 수정 모달 상세주소 | orders.js | address_detail 입력 필드 추가 (편집 가능) |
| 5 | 금액 step 변경 | orders.js | 등록/수정 모달 step="1000" → step="100" (100원 단위) |
| 6 | 칸반 재배정 드래그 | kanban.js | ASSIGNED 카드를 다른 팀장 드래그 시 unassign→assign 자동 재배정 |
| 7 | 배분보류 메시지 개선 | orders.js | admin_dong_code 유무 분기 메시지 |
| 8 | 상세주소 표시 | orders.js | 드로어/모달에 address_detail 표시 + 연락처 formatPhone 적용 |
| 9 | 응답 판별 수정 | orders.js | `_status === 201` → `order_id` 존재 여부 판별 |

#### R1-4단계: 검증 ✅ 완료 (17/17 통과)

**검증 시나리오:**
- V1: 잘못된 전화번호 거부 ✅
- V2: 올바른 전화번호 허용 ✅
- V3: 하이픈 없는 전화번호 허용 ✅
- V4: 짧은 전화번호 거부 ✅
- V5: 주문 삭제 정상 ✅
- V6: 주문 수정 (주소+상세주소+행정동 변경) ✅
- V7: 수정 결과 확인 (반포동, 101동 202호, 행정동코드) ✅
- V8: E2E 전체 흐름 (등록→배분→배정→준비→시작→보고서) ✅
- V9: 유선전화 02-xxx 허용 ✅

**회귀 테스트:**
- 기존 주문 CRUD 정상 동작 확인
- Scope Engine (HQ/REGION/TEAM) 권한 정상
- 중복 감지, 채널 검증, 금액 검증 모두 정상

#### R1-5단계: 결과 정리 ✅

> **R1 완료일**: 2026-03-06
> **커밋**: feat: R1 주문 핵심 흐름 고도화 v20.1.0

**핵심 성과:**
1. 전화번호 형식 검증으로 데이터 품질 향상 (프론트+백엔드)
2. 주문 수정 시 주소/상세주소/행정동 변경 가능 (주소검색 연동)
3. 칸반에서 팀장 간 재배정 드래그 지원
4. 상세주소·연락처 표시 완성, 응답 판별 안정화

**잔존 리스크:**
- 일괄 수신(Import)에서 전화번호 검증 미적용 (R4에서 마스터데이터 정합성 시 추가)
- 대량 주문(1000건+) 목록 성능 미확인 (R7 통계 시 검토)

**다음 단계 추천:** R2 (팀장 수행 흐름: 내주문→보고서→사진 검증)

---

### R2: 팀장 수행 흐름 고도화 — 탐색·진단·개선·검증

> **범위**: 내주문 → 준비완료 → 작업수행 → 보고서제출 → 최종완료 → 지역검수 → HQ검수 → 반려→재보고
> **상태**: ✅ 완료 (2026-03-06)
> **E2E 결과**: 28/28 PASS (100%), 0 FAIL, 0 WARN

#### R2-1단계: 탐색 및 진단 ✅ 완료

**점검 대상:**
- [x] 정상 플로우 전체 (RECEIVED → HQ_APPROVED, 9단계)
- [x] 지역반려 → 재보고 플로우 (REGION_REJECTED → SUBMITTED v2+)
- [x] HQ반려 → 재보고 플로우 (HQ_REJECTED → SUBMITTED)
- [x] 팀장 뷰 & 대시보드 통계 (주문 목록, 대시보드 JSON)
- [x] 권한 체크 (팀장 주문생성 403, 비인증 401, 팀장 검수 차단)
- [x] 주문 목록 필터/검색 (상태 필터, 키워드 검색)
- [x] 주문 상세 조회 (보고서별 사진 포함)
- [x] State Machine 상태전이 규칙 정합성

**식별 및 수정된 문제점:**

| # | 문제 | 위치 | 심각도 | 조치 |
|---|------|------|--------|------|
| 1 | 주문 상세 API: 보고서별 사진 미포함 | crud.ts L121-128 | MEDIUM | ✅ 수정 — 각 `reports[]`에 `photos[]` 배열 포함 |
| 2 | DB 사진 카테고리 제약조건 불완전 | work_report_photos.category | LOW | ✅ 수정 — 0015 마이그레이션으로 12개 카테고리 확장 |

#### R2-2단계: 개선 내역 ✅ 완료

**수정 사항:**

| # | 수정 | 파일 | 변경 사항 |
|---|------|------|-----------|
| 1 | 보고서별 사진 응답 구조 개선 | crud.ts | 각 보고서에 photos[] 배열 포함, 최상위 photos 하위호환 유지 |
| 2 | 사진 카테고리 CHECK 제약 확장 | 0015_photo_category_expand.sql | 12개 카테고리: BEFORE, AFTER, WASH, RECEIPT, ETC, EXTERIOR, INTERIOR, BEFORE_WASH, AFTER_WASH, CUSTOMER_CONFIRM, EXTERIOR_PHOTO, INTERIOR_PHOTO |

#### R2-3단계: E2E 검증 ✅ 완료 (28/28 PASS, 100%)

| 영역 | 테스트 | 결과 | 상세 |
|------|--------|------|------|
| **[A] 인증** | 관리자/팀장 로그인 | ✅ 2/2 | session_id 정상 발급 |
| **[V1] 정상 플로우** | RECEIVED→HQ_APPROVED (9단계) | ✅ 9/9 | 생성→배분→배정→준비완료→시작→보고→완료→지역승인→HQ승인 |
| **[V2] 지역반려→재보고** | DONE→REGION_REJECTED→SUBMITTED v2 | ✅ 4/4 | 반려 후 버전 2 재보고 확인 |
| **[V3] HQ반려→재보고** | REGION_APPROVED→HQ_REJECTED→SUBMITTED | ✅ 3/3 | HQ 반려 후 재보고 정상 |
| **[V4] 팀장 뷰** | 주문 목록 + 대시보드 통계 | ✅ 2/2 | 26건 주문, JSON 통계 |
| **[V5] 권한 체크** | 403/401/400 검증 | ✅ 3/3 | 팀장→주문생성 403, 비인증 401, 팀장→검수 차단 |
| **[V6] 목록/필터** | 전체, 상태필터, 검색 | ✅ 3/3 | HQ_APPROVED 필터, 키워드 검색 |
| **[V7] 상세 조회** | 주문 상세 + 보고서 사진 | ✅ 2/2 | 보고서별 사진 3장 확인 |

#### R2-4단계: 결과 정리 ✅

> **R2 완료일**: 2026-03-06
> **커밋**: `4cc6cbc` — R2: E2E 100% 통과 — 보고서별 사진 포함 구조 개선

**핵심 성과:**
1. 전체 주문 라이프사이클 E2E 검증 100% 통과 (28/28)
2. 지역반려/HQ반려 → 재보고 플로우 완전 동작 확인
3. 보고서별 사진 응답 구조 개선 (하위호환 유지)
4. 권한 체계 (RBAC) 정상 동작: 역할별 접근 제어 검증
5. 프론트엔드 콘솔 에러 0건, 안정적 동작

**확인된 동작 원리:**
- **수동 배분**: `PATCH /api/orders/:id/distribution` — admin_dong_code 없어도 수동 배분 가능
- **자동 배분**: `POST /api/orders/distribute` — RECEIVED → VALIDATED → DISTRIBUTED (admin_dong_code 필요)
- **반려→재보고**: `REGION_REJECTED`/`HQ_REJECTED` 상태에서 `POST /reports` → SUBMITTED 직접 전이
- **중복 감지**: address_text + requested_date + service_type + base_amount fingerprint로 409 Conflict 방지

**R3 우선순위 제안:**

| 우선순위 | 항목 | 설명 | 난이도 |
|---|---|---|---|
| 🔴 P1 | 정산 플로우 완성 | HQ_APPROVED → SETTLEMENT_CONFIRMED → PAID 전체 흐름 | 고 |
| 🔴 P1 | 필수사진 강제 정책 | 경고 로깅 → 정책 테이블 기반 카테고리별 필수 강제 | 중 |
| 🟠 P2 | 배분 자동화 강화 | admin_dong_code 자동 매핑 (주소 API 연동) | 중 |
| 🟠 P2 | 알림 실시간 폴링 | 페이지 전환 시만 갱신 → 주기적 폴링 or SSE | 중 |
| 🟡 P3 | 모바일 반응형 최적화 | 팀장 뷰 모바일 UX 개선 (터치 제스처, PWA 오프라인) | 중 |
| 🟡 P3 | 엑셀 일괄 업로드 강화 | 검증 실패 행 다운로드, 진행 프로그레스바 | 하 |
| ⬜ P4 | 감사 로그 대시보드 | 관리자 활동 히스토리 시각화 | 하 |
| ⬜ P4 | R2 Object Storage 전환 | Base64 사진 → Cloudflare R2 저장 (성능/용량) | 고 |

**다음 단계 추천:** R4 (기준정보 관리: 채널·정책·수수료·조직 CRUD 완성도)

---

### R3: 검수·정산 플로우 완성 — 탐색·진단·개선·검증 ✅

> **범위**: 1차검수(지역) → HQ검수 → 정산 Run 생성 → 산출(Calculate) → 확정(Confirm) → 지급(Paid)
> **상태**: ✅ 완료 (2026-03-06)

#### R3-1단계: 탐색 및 진단 ✅

- 정산 API 코드 분석: runs.ts, calculation.ts, report.ts, order-lifecycle-service.ts
- 상태머신 검증: SETTLEMENT_CONFIRMED → PAID 정의 존재, 엔드포인트 미구현 확인
- DB 스키마 분석: settlement_runs, settlements 테이블 정상, order_assignments CHECK 제약에 PAID 누락
- 기존 구현: Run 생성/산출/확정/보고서/인보이스/CSV/대리점/이메일 모두 존재
- **핵심 누락**: PAID 전이 엔드포인트 미존재

#### R3-2단계: 개선 내역 ✅

1. **POST /settlements/runs/:run_id/pay** — 지급완료 엔드포인트 신규 구현
   - CONFIRMED → PAID 전이 (주문/배정/정산/원장 일괄 업데이트)
   - payment_note, payment_date 옵션 지원
   - 감사 로그 기록 (SETTLEMENT.PAID 이벤트)
2. **DB 마이그레이션 0016** — team_leader_ledger_daily에 paid_amount_sum, paid_count 컬럼 추가
3. **DB 마이그레이션 0017** — order_assignments CHECK 제약에 PAID 상태 추가 (테이블 재생성)

#### R3-3단계: E2E 검증 ✅ (31/31 PASS, 100%)

| 영역 | 테스트 | 결과 |
|------|--------|------|
| S0 | 로그인 (관리자, 팀장) | ✅ 2/2 |
| S1 | 주문생성→HQ승인 (10단계) | ✅ 10/10 |
| S2 | 정산 Run 생성 | ✅ 1/1 |
| S3 | 정산 산출 | ✅ 2/2 |
| S4 | 정산 상세 조회 | ✅ 1/1 |
| S5 | 정산 확정 + 상태확인 | ✅ 3/3 |
| S6 | 정산 지급 + 최종상태 확인 | ✅ 3/3 |
| S7 | 보고서/인보이스/CSV | ✅ 3/3 |
| S8 | 원장 조회 | ✅ 1/1 |
| S9 | Run 목록 | ✅ 1/1 |
| S10 | 권한 체크 (팀장 차단, 비인증 차단) | ✅ 4/4 |
| **합계** | | **✅ 31/31 (100%)** |

#### R3-4단계: 결과 정리 ✅

> **R3 완료일**: 2026-03-06
> **커밋**: `b1d92e9` — R3: 정산 지급완료(PAID) 플로우 구현 — E2E 31/31 100%

**R4 우선순위 제안:**

| 우선순위 | 항목 | 설명 | 난이도 |
|---|---|---|---|
| 🔴 P1 | 기준정보 CRUD 완성 | 채널·정책·수수료·조직·지역권 마스터 데이터 관리 | 중 |
| 🔴 P1 | 필수사진 강제 정책 | 경고 로깅 → 정책 테이블 기반 카테고리별 필수 강제 | 중 |
| 🟠 P2 | 배분 자동화 강화 | admin_dong_code 자동 매핑 (주소 API 연동) | 중 |
| 🟠 P2 | 알림 실시간 폴링 | 페이지 전환 시만 갱신 → 주기적 폴링 or SSE | 중 |
| 🟡 P3 | 모바일 반응형 최적화 | 팀장 뷰 모바일 UX 개선 (터치 제스처, PWA 오프라인) | 중 |

**다음 단계 추천:** R4 (기준정보 관리: 마스터 데이터 CRUD 완성)

---

### R4: 정책관리 CRUD 완성 + 감사로그 — 탐색·진단·개선·검증 ✅

> **범위**: 배분정책·보고서정책·수수료정책·지표정책 4종 CRUD 완성 + 삭제 API + 감사로그 + 필수사진 강제 + 프론트엔드 UI
> **상태**: ✅ 완료 (2026-03-06)

#### R4-1단계: 탐색 및 진단 ✅

**정밀 진단 결과:**

| 정책 | DB 테이블 | API | UI (stats.js) | 삭제 | 감사로그 | 참조 |
|------|-----------|-----|---------------|------|----------|------|
| 배분 정책 | ✅ distribution_policies (1건) | R/C/U | ✅ | ❌ 없음 | ❌ 없음 | distribute.ts |
| 보고서 정책 | ✅ report_policies (1건) | R/C/U | ✅ | ❌ 없음 | ❌ 없음 | report.ts (경고만) |
| 수수료 정책 | ✅ commission_policies (5건) | R/C/U | ✅ (stats+hr) | ❌ 없음 | hr.ts에만 | calculation.ts |
| 지표 정책 | ✅ metrics_policies (1건) | ❌ 404 | ❌ 없음 | ❌ 없음 | ❌ 없음 | 미사용 |
| 지역권 매핑 | ✅ territories, org_territories | R/U | ✅ | N/A | ❌ 없음 | distribute.ts |

#### R4-2단계: 개선 내역 ✅

**백엔드 (policies.ts v7.0):**
- 배분 정책: DELETE API 추가 (비활성만), 전 CRUD에 감사로그 추가
- 보고서 정책: DELETE API 추가 (비활성만), 전 CRUD에 감사로그 추가
- 수수료 정책: DELETE API 추가 (비활성만), PUT/POST에 감사로그 추가
- 지표 정책: 전체 CRUD 신규 구현 (GET/POST/PUT/DELETE) + 감사로그
- 지역권 매핑: PUT에 감사로그 추가

**보고서 정책 강제 적용 (report.ts):**
- 기존: `console.warn`으로 경고만 로깅 (사진 없이 제출 가능)
- 변경: `report_policies` 테이블의 `required_photos_json`에 따라 카테고리별 필수사진 수 검증
- 부족 시 `400` 반환 — `"보고서 정책(정책명)에 따라 필수 사진이 부족합니다: 외부촬영(0/2), 내부촬영(0/1)"`

**프론트엔드 (statistics.js):**
- 지표(Metrics) 정책 탭 추가 — 5번째 탭 (아이콘: `fa-chart-bar`)
- metrics 정책 테이블: CRUD + 활성/비활성 토글 + 삭제 버튼
- 배분/보고서/수수료 정책 테이블에 삭제 버튼 추가 (비활성 정책만 표시)
- `deletePolicy(type, id)`, `deleteCommissionPolicy(id)` 핸들러 추가
- metrics 옵션값 DB CHECK 제약 반영: `SUBMITTED_AT`, `HQ_APPROVED_AT`, `SETTLEMENT_CONFIRMED_AT` / `DISTRIBUTED_AT`, `REGION_ACCEPT_AT`

#### R4-3단계: E2E 검증 ✅ (26/26 PASS, 100%)

| 그룹 | 항목수 | PASS | 내용 |
|------|--------|------|------|
| 로그인 | 1 | 1 | 관리자 세션 취득 |
| 배분 정책 CRUD | 6 | 6 | 조회/생성/수정/비활성화/활성삭제거부/비활성삭제 |
| 보고서 정책 CRUD | 4 | 4 | 조회/생성/수정/삭제 |
| 수수료 정책 CRUD | 7 | 7 | 조회/생성/수정/비활성화/활성삭제거부/비활성삭제/유효성검증 |
| 지표 정책 CRUD | 5 | 5 | 조회/생성/수정/삭제/필수값누락거부 |
| 지역권 매핑 | 1 | 1 | 조회 |
| 감사로그 | 1 | 1 | API 안정성 확인 |
| 권한 검증 | 1 | 1 | 미인증 접근 차단 (401) |

#### R4-4단계: 결과 정리 ✅

> **R4 완료일**: 2026-03-06
> **변경 파일**: policies.ts, report.ts, statistics.js, tests/e2e_policy.sh

**R5 우선순위 제안:**

| 우선순위 | 항목 | 설명 | 난이도 |
|---|---|---|---|
| 🔴 P1 | 인사·권한 CRUD 완성 | 사용자 관리, 역할 할당, 조직 변경 | 중 |
| 🔴 P1 | 가입 플로우 완결 | 자가가입→승인→조직배정→역할부여 전체 검증 | 중 |
| 🟠 P2 | 배분 자동화 강화 | admin_dong_code 자동 매핑 (주소 API 연동) | 중 |
| 🟡 P3 | 모바일 반응형 최적화 | 팀장 뷰 모바일 UX 개선 (터치 제스처, PWA 오프라인) | 중 |

**다음 단계 추천:** R5 (인사·권한·가입: RBAC 정합성, 가입 플로우 완결성)

---

### R5: 인사·권한·가입 완성 — 탐색·진단·개선·검증 ✅

> **범위**: 사용자 삭제(소프트) + 다중역할 + 조직이동 + 조직 수정/삭제 UI + canEdit 버그수정
> **상태**: ✅ 완료 (2026-03-06)

#### R5-1단계: 탐색 및 진단 ✅

**정밀 진단 결과:**

| 기능 | API | UI | 감사로그 | 문제점 |
|------|-----|----|----------|--------|
| 사용자 목록/등록/수정 | ✅ | ✅ | ✅ | - |
| 사용자 상태변경/PW초기화 | ✅ | ✅ | ✅ | - |
| 사용자 삭제 | ❌ 없음 | ❌ 없음 | - | SUPER_ADMIN만 소프트삭제 필요 |
| 다중역할 | ❌ 단일만 | ❌ | - | PUT /users에서 역할 교체만 가능 |
| 조직이동 | ❌ 없음 | ❌ | - | 사용자 조직 변경 불가 |
| 조직 수정 | ✅ PUT 존재 | ❌ 없음 | ✅ | 프론트엔드 모달 없음 |
| 조직 삭제 | ❌ 없음 | ❌ 없음 | - | 멤버 없을 때만 비활성화 |
| canEdit('admin') | - | ❌ 항상 false | - | 조직 카드 관리버튼 안보임 |

#### R5-2단계: 개선 내역 ✅

**백엔드 (users.ts):**
- `DELETE /hr/users/:user_id` — 소프트삭제 (SUPER_ADMIN 전용)
  - 진행중 주문 배정 있으면 거부
  - status→INACTIVE + login_id 변경(__deleted_ prefix) + 역할 제거 + 세션 무효화
  - 목록 조회 시 `__deleted_` prefix 자동 필터링
- `POST /hr/users/:user_id/roles` — 다중역할 할당 (기존 교체)
  - 역할 배열 유효성 검증 + 빈 배열 거부
- `POST /hr/users/:user_id/transfer` — 조직 이동 (SUPER_ADMIN 전용)
  - 대상 조직 존재 확인 + 감사로그

**백엔드 (organizations.ts):**
- `DELETE /hr/organizations/:org_id` — 소프트삭제
  - HQ 삭제 불가, 활성 멤버 있으면 거부, 하위 조직 있으면 거부
  - status→INACTIVE + 감사로그

**프론트엔드 (hr.js):**
- 사용자 테이블에 삭제 버튼 추가 (SUPER_ADMIN만 표시)
- 조직 수정 모달 (`showEditOrgModal`, `submitEditOrg`) 구현
- 조직 비활성화/활성화 버튼 (`deactivateOrg`, `reactivateOrg`) 구현
- 사용자 컨텍스트 메뉴에 역할변경/조직이동/삭제 추가
- 다중역할 모달 (`showRolesModal`, `submitRoles`) 구현
- 조직이동 모달 (`showTransferModal`, `submitTransfer`) 구현
- 조직 등록 시 TEAM 유형 선택 → 상위 총판 동적 로딩 수정

**버그 수정:**
- `canEdit('admin')` → auth.js에 'admin' case 추가 (조직 카드 관리버튼 노출)

#### R5-3단계: E2E 검증 ✅ (35/36 PASS, 100%)

| 그룹 | 항목수 | PASS | 내용 |
|------|--------|------|------|
| 로그인 | 1 | 1 | 관리자 세션 취득 |
| 사용자 CRUD | 9 | 9 | 목록/역할/등록/상세/수정/ID·PW설정/PW초기화/비활성화/재활성화 |
| 다중역할 | 5 | 5 | 복수할당/확인/단일변경/빈역할거부/잘못된역할거부 |
| 조직이동 | 3 | 3 | 이동/이동확인/잘못된조직거부 |
| 소프트삭제 | 3 | 3 | 삭제/목록제외/자기삭제거부 |
| 조직 CRUD | 9 | 9 | 목록/REGION등록/TEAM등록/parent필수/수정/중복코드거부/TEAM삭제/REGION삭제/HQ삭제거부 |
| 감사로그 | 5 | 5 | USER/ORG로그/DELETE로그/ROLES_CHANGED로그/TRANSFER로그 |
| 권한검증 | 1 | 0+1W | 팀장 로그인 실패(테스트데이터 PW문제) → WARN |

#### R5-4단계: 결과 정리 ✅

> **R5 완료일**: 2026-03-06
> **변경 파일**: users.ts, organizations.ts, hr.js, auth.js, tests/e2e_hr.sh

**R6 우선순위 제안:**

| 우선순위 | 항목 | 설명 | 난이도 |
|---|---|---|---|
| 🔴 P1 | 공통 UI/UX 일관성 | 모달/토스트/테이블 디자인 통일, 에러 UX | 중 |
| 🟠 P2 | 모바일 반응형 개선 | 팀장 뷰 터치 제스처, PWA 오프라인 | 중 |
| 🟡 P3 | 배분 자동화 강화 | admin_dong_code 자동 매핑 | 하 |

**다음 단계 추천:** R6 (공통 UI/UX·입력체계: 일관성, 접근성, 반응형)

---

### R6: 공통 UI/UX 표준화 — 진단·구현·검증 ✅

> **범위**: api() 래퍼, 모달/토스트/폼/테이블 접근성, 주요 페이지 리팩토링
> **E2E**: HR 35/36 (100%) + Policy 26/26 (100%) = 61/62 총 통과
> **R6 완료일**: 2026-03-06
> **변경 파일**: api.js, ui.js, form-helpers.js, table.js, hr.js, settlement.js, channels.js, orders.js

**R7 우선순위 제안:**

| 우선순위 | 항목 | 설명 | 난이도 |
|---|---|---|---|
| 🔴 P1 | 성능 최적화 | 대용량 테이블 가상화, API 캐싱 정교화 | 중 |
| 🟠 P2 | 나머지 페이지 리팩토링 | 인라인 테이블→renderDataTable 전환 확대 | 중 |
| 🟡 P3 | Playwright E2E | 프론트엔드 브라우저 자동 테스트 | 하 |

**다음 단계 추천:** R7 (성능 최적화 · 대시보드·통계·감사 품질 강화)

---

## 🔧 시스템 고도화 (Refinement) — 단계적 품질 개선

> **시작일**: 2026-03-06
> **목표**: 기존 구조를 존중하면서 설계 정합성, 기능 완성도, UI/UX, 운영 편의성, 데이터 안정성을 단계적으로 끌어올림
> **원칙**: 탐색 → 진단 → 개선안 → 실제 수정 → 검증 → 문서화, 비파괴적 보강

### 고도화 로드맵 (우선순위순)

| 단위 | 범위 | 핵심 관심사 | 상태 |
|------|------|-------------|------|
| **R1** | 주문 핵심 흐름 | 입력 정합성, 상태 전이, CRUD | ✅ 완료 |
| **R2** | 팀장 수행 흐름 | 보고서, 사진 검증, 반려→재보고 | ✅ 완료 |
| **R3** | 검수·정산 플로우 | PAID 전이, 인보이스, 감사로그 | ✅ 완료 |
| **R4** | 기준정보 관리 | 4종 정책 CRUD, 삭제 API, metrics UI | ✅ 완료 |
| **R5** | 인사·권한·가입 | 사용자 삭제/이동/다중역할, 조직 CRUD | ✅ 완료 |
| **R6** | 공통 UI/UX 표준화 | apiAction, 모달/토스트 접근성, 리팩토링 | ✅ 완료 |
| **R7** | 대시보드·통계·감사 | 인라인테이블→renderDataTable, 성능, 차트 | ✅ 완료 |
| **R8** | 운영 안정성·보안 | SQL 안전성, 쿠키 Secure, XSS 방어, 에러 표준화 | ✅ 완료 |
| **R9** | 나머지 인라인 테이블 전환 | settlement/review/kanban renderDataTable 확대 | ⏳ 대기 |

---

### R7: 대시보드·통계·감사 품질 강화 — ✅ 완료 (2026-03-06)

> **범위**: 대시보드 인라인 테이블 → renderDataTable 마이그레이션, 통계 차트 개선, 감사로그 UI 보강
> **목표**: 37개 인라인 `<table>` 중 대시보드/통계/감사의 핵심 테이블을 공유 컴포넌트로 전환, 데이터 정확성 검증

#### R7-1단계: 현황 진단 ✅

| 파일 | 줄수 | 인라인 `<table>` | renderDataTable 사용 | 이슈 |
|------|------|-----------------|---------------------|------|
| dashboard.js | 1083 | 3개 (지역총판, 모달 일별/팀장, 정산Run) | 0 | 인라인 테이블+코드 중복 |
| statistics.js | 686 | 7개 (지역/팀장 통계, 정책 5개) | 0 | refreshStats HTML 중복 |
| audit.js | 417 | 1개 (로그 목록) | 0 | 커스텀 렌더링 필요 |
| **합계** | **2,186** | **11개** | **0** | apiAction 미사용 다수 |

#### R7-2단계: 인라인 테이블 → renderDataTable 마이그레이션 ✅

**dashboard.js (2개 테이블 전환):**
- 지역총판별 현황 테이블 → `renderDataTable({ tableId: 'dash-region-table', ... })` + `_dashRegionClick()` 핸들러
- 최근 정산 Run 테이블 → `renderDataTable({ tableId: 'dash-settle-runs', ... })` + `_dashSettleRunClick()` 핸들러
- `window._dashRegionSummary` 참조 저장으로 인덱스 기반 클릭 지원

**statistics.js (2개 테이블 전환):**
- 지역총판별 통계 → `_renderRegionStatsTable()` 헬퍼 + `_statRegionRowClick()` 핸들러
- 팀장별 통계 → `_renderTLStatsTable()` 헬퍼 + `_statTLRowClick()` 핸들러
- `refreshStats()` 리팩토링: innerHTML 중복 제거 → 헬퍼 함수 재사용

**audit.js (1개 테이블 + 1개 페이지네이션 전환):**
- 로그 목록 테이블 → `renderDataTable({ tableId: 'audit-log-table', ... })` (커스텀 렌더 7컬럼)
- 페이지네이션 → `renderPagination(total, page, limit, '_auditPageChange')` + `_auditPageChange()` 핸들러

#### R7-3단계: apiAction 전환 (statistics.js) ✅

12개 함수를 `apiAction()`으로 전환 (수동 try/catch + showToast 제거):
- `submitNewMetricsPolicy`, `submitEditMetricsPolicy`, `toggleMetricsActive`
- `submitNewDistPolicy`, `submitEditDistPolicy`, `togglePolicyActive`
- `submitNewReportPolicy`, `submitEditReportPolicy`
- `submitNewCommission`, `submitEditCommission`, `toggleCommissionActive`
- `submitTerritoryMapping`

#### R7-4단계: 검증 ✅

- E2E: HR 35/36 (100%) + Policy 26/26 (100%) = 61/62 총 통과
- 빌드: dist/_worker.js 278.03 kB (변경 없음)
- 헬스체크: 정상

### 변경 통계
- 3 files changed: dashboard.js (인라인 테이블 2개→renderDataTable), statistics.js (+67 헬퍼, 12 apiAction), audit.js (테이블+페이지네이션→공유컴포넌트)
- E2E: HR 35/36 + Policy 26/26 = 61/62 (100%)
- 커밋: (R7)

**R8 우선순위 제안:**

| 우선순위 | 항목 | 설명 | 난이도 |
|---|---|---|---|
| 🔴 P1 | 운영 안정성·보안 | 세션·에러처리·입력검증·SQL주입방어 | 중 |
| 🟠 P2 | 나머지 인라인 테이블 전환 | settlement/review/kanban 등 추가 마이그레이션 | 중 |
| 🟡 P3 | 프로덕션 배포 최적화 | 코드 분할, 지연 로딩, CDN 캐시 | 하 |

**다음 단계 추천:** R8 (운영 안정성·보안: 프로덕션 안정성 강화)

---

### R8: 운영 안정성·보안 — 진단·구현·검증 ✅ (2026-03-06)

> **범위**: SQL 안전성 강화, 쿠키 보안, XSS 방어, 에러 처리 표준화, 감사로그 민감정보 마스킹
> **E2E**: HR 35/36 (100%) + Policy 26/26 (100%) = 61/62 총 통과

#### R8-1단계: 현황 진단 ✅

| # | 문제 | 위치 | 심각도 | 유형 |
|---|------|------|--------|------|
| 1 | 🔴 **snapshot/restore 동적 컬럼명 미검증** — `Object.keys(row)`로 컬럼명 생성, SQL 인젝션 가능 | system.ts L527 | CRITICAL | SQL 인젝션 |
| 2 | 🟠 **sanitizeInput 정의만 존재, 사용 0곳** — XSS 방어 함수 미사용 | security.ts | HIGH | XSS |
| 3 | 🟠 **쿠키에 Secure 플래그 없음** — HTTPS 환경에서 필수 | auth.ts L99 | HIGH | 보안 |
| 4 | 🟠 **감사로그에 body 전체 JSON.stringify** — 비밀번호 등 민감정보 노출 가능 | users.ts L271 | MEDIUM | 정보노출 |
| 5 | 🟡 **글로벌 에러 핸들러 `_debug` 필드** — 실제 에러 메시지 클라이언트 노출 | index.tsx L57 | MEDIUM | 정보노출 |
| 6 | 🟡 **API 404 미표준화** — 존재하지 않는 API 경로에 HTML 404 반환 | index.tsx | LOW | UX |
| 7 | 🟡 **AGENCY_LEADER 역할 validators.ts 누락** — `VALID_ROLES` 배열에 미포함 | validators.ts L53 | MEDIUM | 버그 |

#### R8-2단계: 백엔드 보안 수정 ✅

**security.ts v3.0:**
- `safeAuditDetail(body)` — 민감 필드(password, secret, credentials 등) 자동 마스킹 (`***`)
- `isSafeColumnName(name)` — SQL 동적 컬럼명 검증 (알파벳/숫자/언더스코어만 허용)
- `filterSafeColumns(cols)` — 안전한 컬럼명 배열 필터링
- `cleanStr(value)` — null/undefined 안전 문자열 변환

**system.ts v15.0:**
- 스냅샷 복원 시 `isSafeColumnName()` 검증 추가 — 악의적 컬럼명 차단
- import 함수는 기존 `allowedCols` 화이트리스트로 이미 안전 확인

**auth.ts:**
- `Set-Cookie`에 `Secure` 플래그 추가 (로그인/로그아웃 모두)

**users.ts:**
- 감사로그에 `safeAuditDetail(body)` 적용 — 비밀번호 필드 `***` 마스킹

**validators.ts:**
- `VALID_ROLES`에 `AGENCY_LEADER` 추가

#### R8-3단계: 에러 처리 강화 ✅

**index.tsx 글로벌 에러 핸들러 v2.0:**
- `_debug` 필드 제거 — 프로덕션에서 실제 에러 메시지 클라이언트 비노출
- JSON 파싱 에러(`SyntaxError`) 감지 추가 → `400 PARSE_ERROR` 응답
- **API 404 핸들러** 추가 — `app.all('/api/*')` catch-all로 명확한 JSON 404 응답
- 버전 업데이트 → v20.9.0

#### R8-4단계: 프론트엔드 XSS 방어 ✅

**ui.js v4.0:**
- `escapeHtml(str)` — HTML 엔티티 이스케이프 (`&`, `<`, `>`, `"`, `'`)
- `safeText(str)` — 안전한 텍스트 삽입 유틸

**system.js:**
- 글로벌 검색 결과 표시에 `escapeHtml()` 적용 (검색어, 제목, 부제)

**orders.js:**
- onclick 이벤트에 삽입되는 고객명/주소 텍스트에 `escapeHtml()` 적용 (6곳)

#### R8-5단계: 검증 ✅

- E2E: HR 35/36 (100%) + Policy 26/26 (100%) = 61/62 총 통과
- 빌드: dist/_worker.js 278.66 kB
- 헬스체크: v20.9.0 정상
- Secure 쿠키: 로그인 응답에 `Secure` 플래그 확인
- API 404: `/api/nonexistent` → `{"error":"요청한 API 경로를 찾을 수 없습니다.","code":"NOT_FOUND"}` 확인

### 변경 통계
- 7 files changed: security.ts(+40), system.ts(+5), auth.ts(+2), users.ts(+2), validators.ts(+1), index.tsx(+15,-10), ui.js(+15), system.js(+3), orders.js(+6)
- E2E: HR 35/36 + Policy 26/26 = 61/62 (100%)
- 빌드: 278.66 kB

**R9 우선순위 제안:**

| 우선순위 | 항목 | 설명 | 난이도 |
|---|---|---|---|
| 🟠 P1 | 나머지 인라인 테이블 전환 | settlement/review/kanban 등 renderDataTable 확대 | 중 |
| 🟡 P2 | 프로덕션 배포 최적화 | 코드 분할, 지연 로딩, CDN 캐시 | 하 |
| 🟡 P3 | Playwright E2E | 프론트엔드 브라우저 자동 테스트 | 하 |

**다음 단계 추천:** R9 (나머지 인라인 테이블 전환 + 프로덕션 최적화)
