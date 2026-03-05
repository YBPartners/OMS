# 다하다 OMS - 주문관리시스템 v5.5.0

## 프로젝트 개요
- **명칭**: 다하다 OMS (Order Management System)
- **목적**: 원청(아정당) → 다하다(HQ) → 총판(4개) → 팀 구조의 주문 처리/배분/검수/정산/대사/통계 통합 시스템
- **설계 원칙**: 고품질 · 자동화 · 정합성 · 보안 우선 · 기능별 분리 설계
- **기술 스택**: Hono + TypeScript + Cloudflare Workers + D1 (SQLite) + TailwindCSS + Vanilla JS

## URLs
- **프로덕션**: https://dahada-oms.pages.dev
- **샌드박스**: https://3000-inedg4lr7hnug2y22i9nx-5185f4aa.sandbox.novita.ai

## 테스트 계정
| 역할 | 아이디 | 비밀번호 |
|------|--------|----------|
| HQ 총괄관리자 | admin | admin123 |
| HQ 운영자 | hq_operator | admin123 |
| 서울 파트장 | seoul_admin | admin123 |
| 경기 파트장 | gyeonggi_admin | admin123 |
| 인천 파트장 | incheon_admin | admin123 |
| 부산 파트장 | busan_admin | admin123 |
| 서울 팀장1 | leader_seoul_1 | admin123 |
| 경기 팀장1 | leader_gyeonggi_1 | admin123 |

## 구현 Phase 이력

### Phase 1 — DB 마이그레이션 & 코어 엔진 ✅
- 5개 마이그레이션 (0001~0005): organizations, users, roles, orders, settlements, audit_logs, notifications 등 36개 테이블
- Scope Engine, State Machine, Batch Builder 3대 혁신 엔진

### Phase 2 — Admin API, CRUD, 전체 라우팅 ✅
- 행정구역 API (sido/sigungu/eupmyeondong/search), 조직-지역 매핑
- 총판/팀 CRUD, 팀장 배정, org-tree 뷰
- 14개 혁신 엔진 변경 적용

### Phase 3 — 자가 가입 워크플로, 추가지역, 알림 ✅
- OTP 인증 → 정보 입력 → 지역 선택 → 제출 → 관리자 승인/반려
- 추가지역 요청 (관할권 외 지역 별도 승인)
- 알림 시스템 (생성, 조회, 읽음 처리, 삭제)
- 19개 신규 API 엔드포인트

### Phase 4 — 프론트엔드 UI ✅
- signup-wizard.js (~27KB): 5단계 팀장 자가 가입 위자드
- signup-admin.js (~24KB): 가입 승인/반려, 추가지역 관리, 조직트리
- notifications.js (~11KB): 알림 벨, 드롭다운, 전체 페이지
- 6개 기존 파일 수정 (레이아웃, 라우팅, 상수, HR 탭)

### Phase 5 — Kanban 강화 + 감사로그 + 프로덕션 배포 ✅
**5-1: Kanban 보드 개선**
- `POST /api/orders/batch-assign` — 다중 주문 배치 배정 (최대 50건)
- `POST /api/orders/:id/unassign` — 배정 해제 (ASSIGNED → DISTRIBUTED)
- kanban.js (~25KB) 전면 개편:
  - 다중 선택 + 배치 배정 (클릭 토글, 전체선택 버튼)
  - 드래그 애니메이션 + 드롭 하이라이트 + 배정해제 드롭존
  - 상단 통계 요약 카드 (미배정/배정/금액/팀장수)
  - 주문 검색 필터 + 정렬 (금액순/요청일순)
  - 팀장 컬럼별 배정/작업중 카운트 + 금액 합계
  - 배정 해제 버튼 (hover시 표시) + 확인 모달
- team-leaders API: parent_org_id 기반 하위 팀 팀장 조회 수정

**5-2: 감사 로그 시스템**
- `GET /api/audit` — 목록 조회 (엔티티/액션/실행자/날짜/검색 필터, 페이지네이션)
- `GET /api/audit/stats` — 통계 (엔티티별/액션별/사용자별/일별 집계)
- `GET /api/audit/:id` — 상세 조회
- audit.js (~20KB):
  - 목록 뷰 (필터, 페이지네이션, 엔티티 색상 분류)
  - 통계 뷰 (4-패널: 엔티티/액션/사용자/일별 추이)
  - 상세 모달 (Raw JSON 토글)
  - SUPER_ADMIN / HQ_OPERATOR / AUDITOR 전용

**5-3: E2E 테스트 23/23 ALL PASS**

**5-5: Cloudflare Pages 프로덕션 배포**
- D1 dahada-production (0b7aedd5-...) 생성 + 5개 마이그레이션 + 시드 데이터
- 프로덕션 검증: health ✓, login ✓, dashboard(10주문/1,690,000원) ✓, audit ✓, team-leaders ✓, distribute ✓

## API 엔드포인트 요약

### 인증 (Public)
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/auth/login | 로그인 |
| POST | /api/auth/logout | 로그아웃 |
| GET | /api/auth/me | 현재 세션 사용자 |
| GET | /api/auth/organizations | 조직 목록 |
| GET | /api/auth/team-leaders | 팀장 목록 (parent_org 지원) |

### 주문 관리
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/orders | 주문 목록 (필터, 페이지네이션) |
| GET | /api/orders/:id | 주문 상세 |
| POST | /api/orders | 수동 주문 등록 |
| POST | /api/orders/import | 일괄 수신 |
| POST | /api/orders/distribute | 자동 배분 |
| PATCH | /api/orders/:id/distribution | 수동 배분 |
| POST | /api/orders/:id/assign | 팀장 배정 |
| POST | /api/orders/batch-assign | **배치 배정 (Phase 5)** |
| POST | /api/orders/:id/unassign | **배정 해제 (Phase 5)** |
| POST | /api/orders/:id/start | 작업 시작 |
| POST | /api/orders/:id/reports | 보고서 제출 |
| POST | /api/orders/:id/review/region | 지역 1차 검수 |
| POST | /api/orders/:id/review/hq | HQ 2차 검수 |

### 정산 · 대사
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | /api/settlements/runs | 정산 Run 관리 |
| POST | /api/settlements/runs/:id/calculate | 정산 산출 |
| POST | /api/settlements/runs/:id/confirm | 정산 확정 |
| GET/POST | /api/reconciliation/runs | 대사 실행 |
| GET | /api/reconciliation/issues | 이슈 목록 |
| PATCH | /api/reconciliation/issues/:id/resolve | 이슈 해결 |

### 인사 관리 (HR)
| Method | Path | 설명 |
|--------|------|------|
| GET/POST | /api/hr/users | 사용자 관리 |
| GET/POST | /api/hr/organizations | 조직 관리 |
| GET/POST | /api/hr/commission-policies | 수수료 정책 |
| GET | /api/hr/regions/* | 행정구역 조회/검색/매핑 |
| GET/POST | /api/hr/distributors | 총판 관리 |

### 자가 가입 (Public)
| Method | Path | 설명 |
|--------|------|------|
| POST | /api/signup/check-phone | 전화번호 중복 확인 |
| POST | /api/signup/send-otp | OTP 발송 |
| POST | /api/signup/verify-otp | OTP 검증 |
| POST | /api/signup/submit | 가입 신청 |
| GET | /api/signup/status | 신청 상태 조회 |
| POST | /api/signup/admin/approve | 관리자 승인 |
| POST | /api/signup/admin/reject | 관리자 반려 |

### 감사 로그 (Phase 5)
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/audit | 감사 로그 목록 |
| GET | /api/audit/stats | 감사 로그 통계 |
| GET | /api/audit/:id | 감사 로그 상세 |

### 알림
| Method | Path | 설명 |
|--------|------|------|
| GET | /api/notifications | 알림 목록 |
| GET | /api/notifications/unread-count | 미읽음 수 |
| PATCH | /api/notifications/:id/read | 읽음 처리 |
| POST | /api/notifications/read-all | 전체 읽음 |

## 데이터 아키텍처
- **Cloudflare D1**: SQLite 기반 36개 테이블
- **주요 테이블**: organizations, users, orders, order_distributions, order_assignments, work_reports, reviews, settlements, audit_logs, notifications, admin_regions, signup_requests
- **State Machine**: 13단계 주문 상태 전이 (RECEIVED → PAID)
- **Scope Engine**: 역할별 데이터 가시성 제어 (HQ → REGION → TEAM)

## 배포 정보
- **플랫폼**: Cloudflare Pages + D1
- **상태**: ✅ Active
- **버전**: v5.5.0
- **최종 업데이트**: 2026-03-05
