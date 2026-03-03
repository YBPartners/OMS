# 다하다 OMS - 주문관리시스템 v2.0.0

## 프로젝트 개요
- **명칭**: 다하다 OMS (Order Management System)
- **목적**: 원청(아정당) → 다하다(HQ) → 지역법인(4개) → 팀장 구조의 주문 처리/배분/검수/정산/대사/통계 통합 시스템
- **설계 원칙**: 고품질 · 자동화 · 정합성 · 보안 우선
- **기술 스택**: Hono + TypeScript + Cloudflare Workers + D1 (SQLite) + TailwindCSS

## 테스트 계정
| 역할 | 아이디 | 비밀번호 |
|------|--------|----------|
| HQ 슈퍼관리자 | `admin` | `admin123` |
| HQ 운영자 | `hq_operator` | `admin123` |
| 서울법인 관리자 | `seoul_admin` | `admin123` |
| 경기법인 관리자 | `gyeonggi_admin` | `admin123` |
| 인천법인 관리자 | `incheon_admin` | `admin123` |
| 부산법인 관리자 | `busan_admin` | `admin123` |
| 서울 팀장 | `leader_seoul_1` | `admin123` |
| 경기 팀장 | `leader_gyeonggi_1` | `admin123` |

## v2.0.0 변경사항 (보안 강화 + 안정성 개선)

### Phase 0: P0-CRITICAL 보안 수정
- **비밀번호 해싱**: SHA-256 → PBKDF2 (100,000 iterations, 16-byte salt)
  - 기존 SHA-256 해시 자동 마이그레이션 (로그인 시 투명하게 전환)
  - 형식: `pbkdf2:iterations:salt_hex:hash_hex`
- **Rate Limiting**: 메모리 기반 요청 제한
  - 로그인: 아이디당 10회/분
  - OTP 발송: 전화번호당 2회/분
  - OTP 검증: 전화번호당 10회/분
- **OTP 보안**: `_dev_otp`는 DEV_MODE=true 환경에서만 노출 (프로덕션 차단)
- **글로벌 에러 핸들러**: DB 에러 상세 미노출, 잘못된 JSON 처리
- **세션 관리**: 만료 세션 자동 정리, 사용자당 최대 5세션
- **입력값 검증**: 전화번호(01X, 10~11자리), 로그인ID(영문/숫자/밑줄 3~50자), 이메일 형식, 역할 화이트리스트

### Phase 1: P1-HIGH 안정성 개선
- **정산 산출**: try-catch 래핑, 전체 실패 시 롤백, 부분 실패 경고
- **정산 확정**: 주문 상태 재확인 (concurrent access 방어)
- **정산 검증**: period_type 화이트리스트, 날짜 형식/순서 검증
- **주문 등록**: 금액 음수 방지, JSON 파싱 에러 처리
- **페이지네이션**: page/limit 파라미터 유효성 검증 (max 100)

## 구현 완료 기능

### 1. 조직/사용자/권한 (RBAC)
- 다하다 HQ + 지역법인 N개 (현재 4개, 확장 가능)
- 5단계 권한: SUPER_ADMIN, HQ_OPERATOR, REGION_ADMIN, TEAM_LEADER, AUDITOR
- 데이터 스코프 기반 접근 제어 (HQ=전체, REGION=자기지역, TEAM=자기주문)
- PBKDF2 세션 기반 인증

### 2. 인사관리 (HR)
- **사용자 CRUD**: 신규 등록 / 상세 조회 / 수정 / 활성화·비활성화
- **핸드폰 인증**: OTP 6자리 발송 → 3분 유효 → crypto.getRandomValues 기반
- **ID/PW 설정**: PBKDF2 해싱, 비밀번호 초기화/변경/설정
- **조직 관리**: 조직 등록/수정/비활성화 + 소속 인원수/팀장수 표시
- **역할 기반 제어**: REGION_ADMIN은 자기 법인 내 팀장만 관리

### 3. 주문 수신/정규화
- 수동 등록 (필수필드 검증 포함)
- 일괄 수신 (JSON 배치 → order_import_batch)
- `source_fingerprint` (SHA-256) 기반 중복 방지

### 4. 자동 배분 (행정동 기준)
- admin_dong_code → org_territories 매핑 자동 배분
- 배분 정책 버전 관리, 매칭 실패 → 수동 배분

### 5. 팀장 배정 (칸반 드래그앤드롭)
- 지역법인 관리자 칸반 보드 배정
- 재배정 시 REASSIGNED 처리 + 이력 유지

### 6. 보고서 제출
- 체크리스트 + 사진 업로드 + 버전 관리

### 7. 2단계 검수
- 1차: 지역법인 관리자 / 2차: HQ 최종 검수

### 8. 정산 (주정산/월정산)
- Run 생성 → 산출 → 확정 3단계
- 에러 핸들링 + 부분 롤백 보장
- 수수료 정책: 팀장 개별 우선 → 지역 기본값

### 9. 대사 (정합성 검증)
- 7가지 자동 검증 룰 (CRITICAL/HIGH/MEDIUM)

### 10. 통계/리포팅
- 지역별/팀장별 일자별 통계 + CSV 다운로드

### 11. 감사 로그
- 모든 상태 전이/로그인 실패/비밀번호 변경 기록

## 화면 구성
- HQ 콘솔 9개 화면 (대시보드, 주문, 배분, HQ검수, 정산, 대사, 통계, 인사관리, 정책)
- REGION 콘솔 5개 화면 (대시보드, 칸반, 1차검수, 팀장관리, 통계)
- TEAM_LEADER 2개 화면 (내 주문, 내 현황)

## API 엔드포인트 (30+)
- 인증: POST login/logout, GET me/users/organizations/team-leaders
- HR: GET/POST/PUT organizations, GET/POST/PUT users, PATCH status, POST reset-password/set-credentials/change-password, POST send-otp/verify-otp, GET phone/status, GET roles
- 주문: GET list/detail, POST create/import/distribute, PATCH distribution, POST assign/start/reports/review
- 정산: GET/POST runs, POST calculate/confirm, GET details/ledger
- 대사: POST runs, GET runs/issues, PATCH resolve
- 통계: GET dashboard/regions/team-leaders/export/policies/territories

## 데이터 모델 (28개 테이블)
- **조직/권한**: organizations, users, roles, user_roles, sessions
- **지역권**: territories, org_territories
- **정책**: distribution_policies, report_policies, commission_policies, metrics_policies
- **주문**: order_import_batches, orders
- **배분/할당**: order_distributions, order_assignments, order_status_history
- **보고서**: work_reports, work_report_photos
- **검수**: reviews
- **정산**: settlement_runs, settlements, team_leader_ledger_daily
- **대사**: reconciliation_runs, reconciliation_issues
- **통계**: region_daily_stats, team_leader_daily_stats
- **감사/인증**: audit_logs, phone_verifications

## 보안 아키텍처 (v2.0.0)
| 항목 | 구현 | 비고 |
|------|------|------|
| 비밀번호 | PBKDF2 (100K iter, 16B salt) | SHA-256 자동 마이그레이션 |
| Rate Limiting | 메모리 기반 (login, OTP) | 프로덕션: KV/DO 권장 |
| OTP | crypto.getRandomValues, 3분 만료 | DEV_MODE에서만 노출 |
| 세션 | UUID v4, 24시간, HttpOnly 쿠키 | 사용자당 최대 5개 |
| 입력 검증 | 전화/이메일/ID 형식, 역할 화이트리스트 | XSS sanitize 유틸 포함 |
| 에러 처리 | 글로벌 핸들러 + API별 try-catch | DB 에러 상세 미노출 |
| 감사 로그 | 모든 상태 변경/로그인 실패 기록 | audit_logs 테이블 |

## 배포
- **플랫폼**: Cloudflare Pages
- **상태**: Active
- **버전**: v2.0.0
- **최종 업데이트**: 2026-03-03
