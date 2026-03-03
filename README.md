# 다하다 OMS - 주문관리시스템 v3.1.0

## 프로젝트 개요
- **명칭**: 다하다 OMS (Order Management System)
- **목적**: 원청(아정당) → 다하다(HQ) → 지역법인(4개) → 팀장 구조의 주문 처리/배분/검수/정산/대사/통계 통합 시스템
- **설계 원칙**: 고품질 · 자동화 · 정합성 · 보안 우선 · 기능별 분리 설계
- **기술 스택**: Hono + TypeScript + Cloudflare Workers + D1 (SQLite) + TailwindCSS + Vanilla JS

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

## v3.1.0 변경사항 (2026-03-03)
### 아키텍처 분리 (Phase 1~4)
- **백엔드 6개 도메인 모듈화**: 22개 파일, 2,484줄
  - `routes/hr/` — 조직(organizations), 사용자(users), 폰인증(phone-verify), 수수료(commission)
  - `routes/orders/` — CRUD(crud), 배분(distribute), 배정(assign), 검수(review), 보고서(report)
  - `routes/settlements/` — Run관리(runs), 산출/확정(calculation)
  - `routes/reconciliation/` — 7규칙 엔진(engine), 이슈관리(issues)
  - `routes/stats/` — 대시보드(dashboard), 일별통계(reports), 정책/지역권(policies)
  - `routes/auth.ts` — 인증(로그인, 로그아웃, 세션)
- **공통 레이어**: `lib/audit.ts`, `lib/db-helpers.ts`, `lib/validators.ts`
- **원본 단일 파일 제거**: stats.ts, settlements.ts, reconciliation.ts → 분리 완료

### 프론트엔드 강화 (Phase 5)
- **STATUS 참조 오류 수정**: `const STATUS = OMS.STATUS` alias 추가
- **대시보드 인터랙티브화**: 모든 숫자 카드 클릭 → 해당 페이지/필터로 이동
- **지역법인 상세 모달**: 클릭 시 일별 현황 + 소속 팀장 통계
- **정산 팀장별 그룹핑**: Run 상세에서 팀장별 요약 표시
- **대사 이슈 상세 모달**: detail_json 파싱하여 한글 라벨로 표시
- **이슈 유형별 집계 카드**: 대사 페이지 상단에 시각적 요약
- **비밀번호 변경 페이지**: `my-profile` 페이지 신규 추가
- **권한 기반 버튼 표시**: `canEdit()` 체크로 CRUD 버튼 조건부 렌더링
- **OMS.ISSUE_TYPES, OMS.RUN_STATUS, OMS.SEVERITY**: 상수 확장

### 통합 테스트 (Phase 6)
- 18개 API 엔드포인트 전수 테스트 통과
- 3개 역할(SUPER_ADMIN, REGION_ADMIN, TEAM_LEADER) 접근 제어 검증
- 권한 거부(403) 테스트 통과

## 구현된 기능
1. **RBAC 5단계 권한**: SUPER_ADMIN, HQ_OPERATOR, REGION_ADMIN, TEAM_LEADER, AUDITOR
2. **인사관리**: 조직 CRUD, 사용자 CRUD, OTP 폰인증, 비밀번호 관리, ID/PW 직접 설정
3. **주문 수신**: 수동 등록 + JSON 일괄 수신, fingerprint 중복 방지
4. **자동 배분**: 행정동 코드 기반 4개 지역법인 자동 매칭 + 수동 재배분
5. **칸반 배정**: 드래그&드롭 / 버튼으로 팀장 배정
6. **작업 보고**: 팀장 작업 시작 → 체크리스트 + 메모 + 사진 URL 보고서 제출
7. **2단계 검수**: 지역 1차(REGION_APPROVED) → HQ 2차(HQ_APPROVED), 반려 사유 코드
8. **정산 시스템**: Run 생성 → 산출(수수료 정책 적용) → 확정(원장 반영, 통계 업데이트)
9. **대사(정합성)**: 7가지 규칙(중복, 배분누락, 배정누락, 보고서누락, 사진부족, 상태불일치, 금액불일치)
10. **통계 + CSV**: 지역법인별/팀장별 일별 통계, CSV 내보내기
11. **정책 관리**: 배분/보고서/수수료 정책 조회, 수수료 CRUD
12. **비밀번호 변경**: 사용자 자체 비밀번호 변경 (`my-profile`)

## API 엔드포인트 (30+)
| 경로 | 설명 |
|------|------|
| POST /api/auth/login | 로그인 (rate-limit 10/min) |
| POST /api/auth/logout | 로그아웃 |
| GET /api/auth/me | 현재 사용자 |
| GET /api/auth/organizations | 조직 목록 |
| GET /api/auth/team-leaders | 팀장 목록 |
| GET /api/orders | 주문 목록 (필터, 페이지네이션) |
| GET /api/orders/:id | 주문 상세 (이력, 보고서, 검수) |
| POST /api/orders | 수동 주문 등록 |
| POST /api/orders/import | JSON 일괄 수신 |
| POST /api/orders/distribute | 자동 배분 |
| PATCH /api/orders/:id/distribution | 수동 재배분 |
| POST /api/orders/:id/assign | 팀장 배정 |
| POST /api/orders/:id/start | 작업 시작 |
| POST /api/orders/:id/reports | 보고서 제출 |
| POST /api/orders/:id/review/region | 지역 1차 검수 |
| POST /api/orders/:id/review/hq | HQ 2차 검수 |
| GET /api/orders/stats/funnel | 퍼널 통계 |
| GET /api/settlements/runs | 정산 Run 목록 |
| POST /api/settlements/runs | Run 생성 |
| POST /api/settlements/runs/:id/calculate | 산출 |
| POST /api/settlements/runs/:id/confirm | 확정 |
| GET /api/settlements/runs/:id/details | 정산 명세 |
| GET /api/settlements/ledger | 팀장 원장 |
| POST /api/reconciliation/runs | 대사 실행 |
| GET /api/reconciliation/runs | 대사 이력 |
| GET /api/reconciliation/issues | 이슈 목록 |
| PATCH /api/reconciliation/issues/:id/resolve | 이슈 해결 |
| GET /api/stats/dashboard | 대시보드 요약 |
| GET /api/stats/regions/daily | 지역 일별 통계 |
| GET /api/stats/team-leaders/daily | 팀장 일별 통계 |
| GET /api/stats/export/csv | CSV 내보내기 |
| GET /api/stats/policies/* | 정책 조회 |
| GET /api/stats/territories | 지역권 매핑 |
| GET /api/hr/users | 사용자 목록 |
| POST /api/hr/users | 사용자 등록 |
| PUT /api/hr/users/:id | 사용자 수정 |
| POST /api/hr/phone/send-otp | OTP 발송 |
| POST /api/hr/phone/verify-otp | OTP 검증 |
| POST /api/hr/commission-policies | 수수료 정책 등록 |
| PUT /api/hr/commission-policies/:id | 수수료 정책 수정 |
| DELETE /api/hr/commission-policies/:id | 수수료 정책 삭제 |

## 데이터 모델 (28 테이블)
organizations, users, roles, user_roles, sessions, territories, org_territories, 
distribution_policies, report_policies, commission_policies, orders, order_batches,
order_distributions, order_assignments, order_status_history, work_reports, 
work_report_photos, reviews, settlements, settlement_runs, team_leader_ledger_daily,
reconciliation_runs, reconciliation_issues, team_leader_daily_stats, region_daily_stats,
phone_verifications, audit_logs

## 프로젝트 구조
```
webapp/
├── src/
│   ├── index.tsx                    # 메인 Hono 엔트리 (134줄)
│   ├── types/index.ts               # 타입 + 상수 정의
│   ├── middleware/
│   │   ├── auth.ts                  # 세션 인증, RBAC
│   │   └── security.ts             # PBKDF2, rate-limit, 검증
│   ├── lib/
│   │   ├── audit.ts                # 감사로그, 상태이력
│   │   ├── db-helpers.ts           # 통계 UPSERT, fingerprint
│   │   └── validators.ts          # 공통 입력 검증
│   └── routes/
│       ├── auth.ts                  # 인증 (190줄)
│       ├── hr/                      # 인사관리 (5파일, 812줄)
│       ├── orders/                  # 주문관리 (6파일, 586줄)
│       ├── settlements/            # 정산 (3파일)
│       ├── reconciliation/          # 대사 (3파일)
│       └── stats/                   # 통계/정책 (4파일)
├── public/static/js/
│   ├── core/                       # constants, api, ui, auth, app
│   ├── shared/                     # table, form-helpers
│   └── pages/                      # 8개 페이지 모듈
├── migrations/                     # D1 스키마
├── seed.sql                        # 테스트 데이터
├── wrangler.jsonc                  # Cloudflare 설정
├── ecosystem.config.cjs            # PM2 설정
└── package.json
```

## 배포
- **플랫폼**: Cloudflare Pages
- **상태**: ✅ Active
- **버전**: v3.1.0
- **최종 업데이트**: 2026-03-03

## 미구현 / 향후 개발
- SMS 실제 연동 (현재 DEV_MODE OTP echo)
- HTTPS 강제 리다이렉트
- 정책 CRUD (배분/보고서)
- PAID 상태 처리 (외부 결제 연동)
- CSV/XLSX 파일 파싱 (현재 JSON)
- 사진 업로드 (R2 스토리지, 현재 URL)
- 알림 시스템
- 실시간 푸시
