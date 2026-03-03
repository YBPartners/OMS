# 다하다 OMS - 주문관리시스템 v1.1

## 프로젝트 개요
- **명칭**: 다하다 OMS (Order Management System)
- **목적**: 원청(아정당) → 다하다(HQ) → 지역법인(4개) → 팀장 구조의 주문 처리/배분/검수/정산/대사/통계 통합 시스템
- **설계 원칙**: 고품질 · 자동화 · 정합성
- **기술 스택**: Hono + TypeScript + Cloudflare Workers + D1 (SQLite) + TailwindCSS

## 라이브 URL
- **서비스**: https://3000-inedg4lr7hnug2y22i9nx-5185f4aa.sandbox.novita.ai

## 테스트 계정
| 역할 | 아이디 | 비밀번호 |
|------|--------|----------|
| HQ 슈퍼관리자 | `admin` | `admin123` |
| HQ 운영자 | `hq_operator` | `admin123` |
| 서울법인 관리자 | `seoul_admin` | `admin123` |
| 경기법인 관리자 | `gyeonggi_admin` | `admin123` |
| 인천법인 관리자 | `incheon_admin` | `admin123` |
| 부산법인 관리자 | `busan_admin` | `admin123` |
| 서울 팀장 (김팀장) | `leader_seoul_1` | `admin123` |
| 경기 팀장 (박팀장) | `leader_gyeonggi_1` | `admin123` |

## 구현 완료 기능

### 1. 조직/사용자/권한 (RBAC)
- 다하다 HQ + 지역법인 N개 (현재 4개, 확장 가능)
- 5단계 권한: SUPER_ADMIN, HQ_OPERATOR, REGION_ADMIN, TEAM_LEADER, AUDITOR
- 데이터 스코프 기반 접근 제어 (HQ=전체, REGION=자기지역, TEAM=자기주문)
- 세션 기반 인증

### 2. 인사관리 (v1.1 신규)
- **사용자 CRUD**: 신규 등록 / 상세 조회 / 수정 / 활성화·비활성화
- **핸드폰 인증**: OTP 6자리 발송 → 3분 유효 → 인증 완료 시 `phone_verified = 1`
  - 도배 방지 (60초 간격), 시도 횟수 제한 (5회), 인증 이력 기록
  - 목적별 분류: REGISTER / LOGIN / RESET_PW
  - 개발환경에서 `_dev_otp` 로 즉시 확인 가능 (운영 시 SMS 연동)
- **ID/PW 설정**: 관리자가 사용자의 로그인 ID와 비밀번호를 직접 설정 가능
  - 초기 비밀번호 자동 생성: 핸드폰 뒷자리 4자리 + "!"
  - 비밀번호 초기화 (관리자), 비밀번호 변경 (본인)
  - 비밀번호 변경 시 기존 세션 모두 삭제
- **조직 관리**: 조직 등록/수정/비활성화 + 소속 인원수/팀장수 표시
- **역할 기반 제어**: REGION_ADMIN은 자기 법인 내 팀장만 관리 가능
- **검색/필터**: 조직별, 역할별, 상태별, 이름/ID/전화번호 검색

### 3. 주문 수신/정규화
- 수동 등록 (개별 주문)
- 일괄 수신 (JSON 배치 → order_import_batch)
- `source_fingerprint` (SHA-256) 기반 중복 방지/경고
- `external_order_no` 미확정 시 fingerprint 운영, 확정 시 마이그레이션 가능

### 4. 자동 배분 (행정동 기준)
- 주소지 admin_dong_code → org_territories 매핑으로 지역법인 자동 배분
- 배분 정책 버전 관리 (distribution_policies)
- 매칭 실패 시 DISTRIBUTION_PENDING → HQ 수동 배분 UI
- 정책 스냅샷: 이미 배분된 주문은 정책 변경에 영향 없음

### 5. 팀장 배정 (칸반 드래그앤드롭)
- 지역법인 관리자가 칸반 보드에서 드래그앤드롭으로 팀장 배정
- 재배정 시 기존 할당 REASSIGNED 처리 + 이력 유지

### 6. 보고서 제출
- 체크리스트 (작업완료/고객서명/현장정리 등)
- 사진 업로드 (BEFORE/AFTER/WASH/RECEIPT/ETC)
- report_policies 스냅샷: 제출 당시 정책 고정
- 반려 시 재제출 → 버전 자동 증가

### 7. 2단계 검수
- **1차 검수**: 지역법인 관리자 (REGION_ADMIN)
- **2차 최종 검수**: 다하다 HQ (HQ_OPERATOR)
- 승인/반려 + 사유 기록 + 완전한 감사 추적

### 8. 정산 (주정산/월정산)
- 정산 Run 생성 → 산출 → 확정 3단계
- HQ_APPROVED 상태인 주문만 정산 대상 (최종 게이트)
- 수수료 정책: 팀장 개별 우선 → 지역 기본값 (정액 FIXED / 정률 PERCENT)
- 정산 확정 시 team_leader_ledger_daily 자동 UPSERT
- 확정 후 수정: CANCELED → 재산출 (감사 추적)

### 9. 대사 (정합성 검증)
- 7가지 자동 검증 룰:
  - DUPLICATE_ORDER / DISTRIBUTION_MISSING / ASSIGNMENT_MISSING
  - REPORT_MISSING / PHOTO_COUNT_INSUFFICIENT
  - STATUS_INCONSISTENT / AMOUNT_MISMATCH
- 퍼널 대사: 수신 → 유효성 → 배분 → 배정 → 제출 → 승인 → 정산 단계별 차이 검출
- 이슈 심각도 (LOW/MEDIUM/HIGH/CRITICAL) + 해결 추적

### 10. 통계/리포팅
- **기준일 정책**: completion_basis / region_intake_basis 설정 가능
- **지역법인별 일자별 통계**: 인입/배정/완료/지역승인/HQ승인/정산확정/금액
- **팀장별 일자별 통계**: 수임/완료/제출/승인/반려/정산/지급액
- **CSV 다운로드**: 지역별/팀장별 기간 지정 내보내기

### 11. 감사 로그
- 모든 상태 전이 기록 (order_status_history)
- 범용 감사 로그 (audit_logs)
- 삭제 금지 원칙: REASSIGNED/CANCELED로만 처리

## 화면 구성

### HQ 콘솔 (9개 화면)
- 대시보드 (퍼널/지역별 현황/이슈 요약)
- 주문관리 (전체 목록/필터/검색/상세/수동등록/일괄수신)
- 배분관리 (자동배분 실행/수동배분/보류건 처리)
- HQ 검수 (2차 최종 검수: 승인/반려)
- 정산관리 (Run 생성/산출/확정/명세/원장)
- 대사 (정합성 검증 실행/이슈 목록/해결)
- 통계 (지역별/팀장별 일자별 통계/CSV 다운로드)
- **인사관리** (사용자 관리/조직 관리/핸드폰 인증) — v1.1 신규
- 정책관리 (배분/보고서/수수료/지역권 현황)

### REGION 콘솔 (5개 화면)
- 대시보드
- 칸반 보드 (드래그앤드롭 팀장 배정)
- 1차 검수 (승인/반려)
- **팀장관리** (자기 법인 팀장 등록/수정/인증) — v1.1 신규
- 통계 (자기 지역 팀장별)

### TEAM_LEADER 화면 (2개)
- 내 주문 (작업시작/보고서제출/상세)
- 내 현황 (일자별 통계/원장)

## API 엔드포인트

### 인증
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 |
| GET | `/api/auth/users` | 사용자 목록 |
| GET | `/api/auth/organizations` | 조직 목록 |
| GET | `/api/auth/team-leaders` | 팀장 목록 |

### 인사관리 (HR) — v1.1 신규
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/hr/organizations` | 조직 목록 (인원수 포함) |
| POST | `/api/hr/organizations` | 조직 등록 |
| PUT | `/api/hr/organizations/:id` | 조직 수정 |
| GET | `/api/hr/users` | 사용자 목록 (필터/검색/페이징) |
| GET | `/api/hr/users/:id` | 사용자 상세 (역할/실적/인증이력) |
| POST | `/api/hr/users` | 사용자 신규 등록 |
| PUT | `/api/hr/users/:id` | 사용자 수정 |
| PATCH | `/api/hr/users/:id/status` | 활성화/비활성화 |
| POST | `/api/hr/users/:id/reset-password` | 비밀번호 초기화 |
| POST | `/api/hr/users/:id/set-credentials` | ID/PW 직접 설정 |
| POST | `/api/hr/users/change-password` | 비밀번호 변경 (본인) |
| GET | `/api/hr/roles` | 역할 목록 |
| POST | `/api/hr/phone/send-otp` | OTP 발송 |
| POST | `/api/hr/phone/verify-otp` | OTP 인증 |
| GET | `/api/hr/phone/status` | 인증 상태 조회 |

### 주문
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/orders` | 주문 목록 (필터/페이징/스코프) |
| GET | `/api/orders/:id` | 주문 상세 (이력/보고서/검수) |
| POST | `/api/orders` | 수동 등록 |
| POST | `/api/orders/import` | 일괄 수신 |
| POST | `/api/orders/distribute` | 자동 배분 실행 |
| PATCH | `/api/orders/:id/distribution` | 수동/재배분 |
| POST | `/api/orders/:id/assign` | 팀장 배정 |
| POST | `/api/orders/:id/start` | 작업 시작 |
| POST | `/api/orders/:id/reports` | 보고서 제출 |
| POST | `/api/orders/:id/review/region` | 1차 검수 |
| POST | `/api/orders/:id/review/hq` | 2차 최종 검수 |
| GET | `/api/orders/stats/funnel` | 퍼널 현황 |

### 정산
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/settlements/runs` | 정산 Run 목록 |
| POST | `/api/settlements/runs` | Run 생성 |
| POST | `/api/settlements/runs/:id/calculate` | 산출 |
| POST | `/api/settlements/runs/:id/confirm` | 확정 |
| GET | `/api/settlements/runs/:id/details` | 명세 |
| GET | `/api/settlements/ledger` | 원장 조회 |

### 대사
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/reconciliation/runs` | 대사 실행 |
| GET | `/api/reconciliation/runs` | Run 이력 |
| GET | `/api/reconciliation/issues` | 이슈 목록 |
| PATCH | `/api/reconciliation/issues/:id/resolve` | 이슈 해결 |

### 통계
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/stats/dashboard` | 대시보드 요약 |
| GET | `/api/stats/regions/daily` | 지역별 일자별 |
| GET | `/api/stats/team-leaders/daily` | 팀장별 일자별 |
| GET | `/api/stats/export/csv` | CSV 다운로드 |
| GET | `/api/stats/policies/*` | 정책 조회 |
| GET | `/api/stats/territories` | 지역권 매핑 |

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
- **감사**: audit_logs
- **인증**: phone_verifications (v1.1 신규)

## 설계 원칙 준수 사항
- **정책 스냅샷**: 배분/보고서/수수료 정책은 주문 단위로 적용 당시 버전 고정
- **감사 추적**: 모든 상태 전이/배분/정산은 이력으로 기록, 삭제 금지
- **중복 방지**: fingerprint 기반 멱등성 운영, external_order_no 확정 시 UNIQUE
- **스코프 기반**: HQ=전체, REGION=자기지역, TEAM=자기주문 데이터 접근
- **확장 가능**: 조직/지역/사용자 수에 하드코딩 없음
- **핸드폰 인증 보안**: OTP 3분 유효, 시도 횟수 제한, 도배 방지, 인증 이력 기록

## 배포
- **플랫폼**: Cloudflare Pages
- **기술 스택**: Hono + TypeScript + D1 (SQLite) + TailwindCSS (CDN)
- **상태**: Active
- **최종 업데이트**: 2026-03-03
- **버전**: v1.1 (인사관리/핸드폰 인증/ID-PW 설정 추가)
