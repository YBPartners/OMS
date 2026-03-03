# 다하다 OMS 개발 문서 v1.1

> 주문처리 / 배분 / 검수 / 정산 / 대사 / 통계 시스템  
> 최종 수정: 2026-03-03

---

## 1. 시스템 아키텍처

### 1.1 기술 스택
| 계층 | 기술 | 비고 |
|------|------|------|
| **Runtime** | Cloudflare Workers (Edge) | V8 Isolates, 10ms CPU free tier |
| **Framework** | Hono v4.12+ | 경량 TypeScript 웹 프레임워크 |
| **Database** | Cloudflare D1 (SQLite) | 로컬 개발은 `--local` 모드 |
| **Build** | Vite + @hono/vite-cloudflare-pages | SSR 번들링 |
| **Frontend** | Vanilla JS + TailwindCSS (CDN) | SPA, 단일 app.js |
| **Auth** | 세션 기반 (SHA-256 해시, Cookie + Header) | 프로덕션: bcrypt/argon2 권장 |

### 1.2 디렉토리 구조
```
webapp/
├── src/
│   ├── index.tsx            # Hono 앱 엔트리, SPA HTML, 미들웨어 등록
│   ├── types/index.ts       # 타입, 상태머신, Env 정의
│   ├── middleware/auth.ts   # 세션 인증, RBAC, 감사로그 헬퍼
│   ├── routes/
│   │   ├── auth.ts          # 로그인/로그아웃/me/users/organizations/team-leaders
│   │   ├── orders.ts        # 주문 CRUD, 배분, 배정, 작업, 보고서, 검수, 퍼널
│   │   ├── settlements.ts   # 정산 Run/산출/확정/명세/원장
│   │   ├── reconciliation.ts # 대사 실행/이력/이슈/해결
│   │   ├── stats.ts         # 통계(지역/팀장/대시보드), CSV, 정책, 지역권
│   │   └── hr.ts            # 인사관리, 조직CRUD, 사용자CRUD, OTP, ID/PW
│   └── services/            # (예비) 비즈니스 로직 분리용
├── public/
│   └── static/js/app.js     # SPA 프론트엔드 (~2200줄)
├── migrations/
│   ├── 0001_initial_schema.sql   # 27 테이블
│   └── 0002_hr_management.sql    # phone_verified, phone_verifications
├── seed.sql                 # 5역할 + 5조직 + 12사용자 + 14지역 + 10주문 + 정책
├── ecosystem.config.cjs     # PM2 설정
├── wrangler.jsonc            # Cloudflare Pages 설정
├── vite.config.ts           # Vite 빌드 설정
├── tsconfig.json
└── package.json
```

### 1.3 요청 흐름
```
[Browser] → HTTP → [Cloudflare Worker / Wrangler Dev]
   ↓
 CORS middleware
   ↓
 authMiddleware (세션 검증, 역할 로딩 → c.set('user'))
   ↓
 Router (auth | orders | settlements | reconciliation | stats | hr)
   ↓
 requireAuth(c, [roles]) — 인증/권한 체크
   ↓
 D1 Database (env.DB) — SQL 쿼리
   ↓
 JSON Response / SPA HTML
```

---

## 2. RBAC (역할 기반 접근 제어)

### 2.1 역할 정의
| 코드 | 한글명 | 범위 | 주요 권한 |
|------|--------|------|-----------|
| `SUPER_ADMIN` | 슈퍼관리자 | 전체 | 모든 기능, 시스템 설정 |
| `HQ_OPERATOR` | HQ운영자 | 본사 | 주문/배분/HQ검수/정산/대사/통계/인사 |
| `REGION_ADMIN` | 지역법인 관리자 | 자기 법인 | 칸반배정/1차검수/팀장관리/통계 |
| `TEAM_LEADER` | 팀장 | 자기 주문 | 작업시작/보고서제출/내 현황 |
| `AUDITOR` | 감사/조회 | 전체(읽기) | 대사/통계/이력 조회 |

### 2.2 스코프 제한 규칙
- **REGION_ADMIN**: `orders` 조회 시 `order_distributions.region_org_id = user.org_id` 필터
- **TEAM_LEADER**: `orders` 조회 시 `order_assignments.team_leader_id = user.user_id` 필터
- **HR 스코프**: REGION_ADMIN은 자기 법인 팀장만 등록/수정 가능

---

## 3. 주문 상태 머신 (13-State FSM)

```
RECEIVED → VALIDATED → DISTRIBUTED → ASSIGNED → IN_PROGRESS → SUBMITTED
                ↓                                                    ↓
       DISTRIBUTION_PENDING                          REGION_APPROVED → HQ_APPROVED → SETTLEMENT_CONFIRMED → PAID
                                                  ↓                      ↓
                                           REGION_REJECTED          HQ_REJECTED
                                                  ↘                      ↘
                                            (→ SUBMITTED, 재제출)   (→ SUBMITTED, 재제출)
```

### 상태 전이표
| 현재 상태 | 다음 상태 | 트리거 | 필요 역할 |
|-----------|-----------|--------|-----------|
| RECEIVED | VALIDATED | 자동 배분 실행 시 자동 전환 | SUPER_ADMIN, HQ_OPERATOR |
| VALIDATED | DISTRIBUTED / DISTRIBUTION_PENDING | 자동/수동 배분 | SUPER_ADMIN, HQ_OPERATOR |
| DISTRIBUTED | ASSIGNED | 팀장 배정 (칸반 D&D) | SUPER_ADMIN, HQ_OPERATOR, REGION_ADMIN |
| ASSIGNED | IN_PROGRESS | 작업 시작 | SUPER_ADMIN, TEAM_LEADER |
| IN_PROGRESS | SUBMITTED | 보고서 제출 | SUPER_ADMIN, TEAM_LEADER |
| SUBMITTED | REGION_APPROVED / REGION_REJECTED | 1차 지역 검수 | SUPER_ADMIN, REGION_ADMIN |
| REGION_APPROVED | HQ_APPROVED / HQ_REJECTED | 2차 HQ 검수 | SUPER_ADMIN, HQ_OPERATOR |
| HQ_APPROVED | SETTLEMENT_CONFIRMED | 정산 확정 | SUPER_ADMIN, HQ_OPERATOR |
| REGION_REJECTED / HQ_REJECTED | SUBMITTED | 보고서 재제출 | SUPER_ADMIN, TEAM_LEADER |
| SETTLEMENT_CONFIRMED | PAID | 지급 처리 | SUPER_ADMIN, HQ_OPERATOR |

---

## 4. 데이터베이스 스키마 (28 Tables)

### 4.1 핵심 테이블 요약
| # | 테이블명 | 설명 | PK |
|---|----------|------|----|
| 1 | `organizations` | 조직 (HQ/REGION) | org_id |
| 2 | `users` | 사용자 | user_id |
| 3 | `roles` | 역할 코드 (5개) | role_id |
| 4 | `user_roles` | 사용자-역할 매핑 | (user_id, role_id) |
| 5 | `territories` | 행정동 지역권 | territory_id |
| 6 | `org_territories` | 조직-지역권 매핑 | (org_id, territory_id, effective_from) |
| 7 | `distribution_policies` | 배분 정책 | policy_id |
| 8 | `report_policies` | 보고서 필수요건 정책 | policy_id |
| 9 | `commission_policies` | 수수료 정책 (정률/정액) | commission_policy_id |
| 10 | `metrics_policies` | 통계 기준 정책 | metrics_policy_id |
| 11 | `order_import_batches` | 주문 배치 수신 | batch_id |
| 12 | `orders` | **주문 (핵심)** | order_id |
| 13 | `order_distributions` | 주문→지역법인 배분 | distribution_id |
| 14 | `order_assignments` | 주문→팀장 배정 | assignment_id |
| 15 | `order_status_history` | 상태 이력 (감사) | id |
| 16 | `work_reports` | 작업 보고서 | report_id |
| 17 | `work_report_photos` | 보고서 사진 | photo_id |
| 18 | `reviews` | 검수 (2단계: REGION/HQ) | review_id |
| 19 | `settlement_runs` | 정산 실행 (주/월) | run_id |
| 20 | `settlements` | 정산 명세 | settlement_id |
| 21 | `team_leader_ledger_daily` | 팀장 일자별 원장 | (date, team_leader_id) |
| 22 | `reconciliation_runs` | 대사 실행 | run_id |
| 23 | `reconciliation_issues` | 대사 이슈 | issue_id |
| 24 | `region_daily_stats` | 지역법인 일자별 통계 | (date, region_org_id) |
| 25 | `team_leader_daily_stats` | 팀장 일자별 통계 | (date, team_leader_id) |
| 26 | `audit_logs` | 범용 감사 로그 | log_id |
| 27 | `sessions` | 세션 | session_id (TEXT) |
| 28 | `phone_verifications` | 핸드폰 OTP 인증 | verification_id |

### 4.2 주요 관계도 (ER 요약)
```
organizations ─1:N─ users ─N:M─ roles (via user_roles)
                    │
organizations ─N:M─ territories (via org_territories)
                    │
orders ─1:1─ order_distributions ─→ organizations (region)
       ─1:1─ order_assignments   ─→ users (team_leader)
       ─1:N─ order_status_history
       ─1:N─ work_reports ─1:N─ work_report_photos
       ─1:N─ reviews
       ─1:1─ settlements ─→ settlement_runs
```

### 4.3 마이그레이션 관리
```bash
# 새 마이그레이션 추가
vi migrations/0003_new_feature.sql

# 로컬 적용
npx wrangler d1 migrations apply dahada-production --local

# 시드 데이터 적용
npx wrangler d1 execute dahada-production --local --file=./seed.sql

# 전체 리셋 (개발용)
npm run db:reset
```

---

## 5. API 명세 (30+ Endpoints)

### 5.1 인증 (`/api/auth`)
| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| POST | `/auth/login` | 공개 | 로그인 (login_id + password) → session_id |
| POST | `/auth/logout` | 인증 | 로그아웃 (세션 삭제) |
| GET | `/auth/me` | 인증 | 현재 사용자 + 조직 정보 |
| GET | `/auth/users` | HQ/REGION | 사용자 목록 (역할 포함) |
| GET | `/auth/organizations` | 인증 | 조직 목록 |
| GET | `/auth/team-leaders` | HQ/REGION | 팀장 목록 (?org_id) |

### 5.2 주문 관리 (`/api/orders`)
| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| GET | `/orders` | 인증(스코프) | 주문 목록 (?status, page, limit, from, to, search, region_org_id, team_leader_id) |
| GET | `/orders/:id` | 인증 | 주문 상세 (이력, 보고서, 검수, 사진) |
| POST | `/orders` | HQ | 수동 주문 등록 (fingerprint 중복 체크) |
| POST | `/orders/import` | HQ | 배치 수신 (JSON 배열) |
| POST | `/orders/distribute` | HQ | **자동 배분** (행정동→지역법인 매핑) |
| PATCH | `/orders/:id/distribution` | HQ | 수동 배분/재배분 |
| POST | `/orders/:id/assign` | HQ/REGION | 팀장 배정 (칸반 D&D) |
| POST | `/orders/:id/start` | TEAM_LEADER | 작업 시작 (ASSIGNED → IN_PROGRESS) |
| POST | `/orders/:id/reports` | TEAM_LEADER | 보고서 제출 (체크리스트 + 사진) |
| POST | `/orders/:id/review/region` | REGION | 1차 지역 검수 (APPROVE/REJECT) |
| POST | `/orders/:id/review/hq` | HQ | 2차 HQ 검수 (APPROVE/REJECT) |
| GET | `/orders/stats/funnel` | 인증(스코프) | 상태별 퍼널 현황 |

### 5.3 정산 (`/api/settlements`)
| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| GET | `/settlements/runs` | HQ | 정산 Run 목록 |
| POST | `/settlements/runs` | HQ | 정산 Run 생성 (WEEKLY/MONTHLY, 기간) |
| POST | `/settlements/runs/:id/calculate` | HQ | **정산 산출** (수수료 계산) |
| POST | `/settlements/runs/:id/confirm` | HQ | **정산 확정** (원장 반영) |
| GET | `/settlements/runs/:id/details` | HQ | 정산 명세 조회 |
| GET | `/settlements/ledger` | 인증 | 팀장 원장 (?from, to, team_leader_id) |

### 5.4 대사 (`/api/reconciliation`)
| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| POST | `/reconciliation/runs` | HQ | **대사 실행** (7가지 규칙 검증) |
| GET | `/reconciliation/runs` | HQ/AUDITOR | 대사 Run 이력 |
| GET | `/reconciliation/issues` | HQ/AUDITOR | 이슈 목록 (?run_id, type, severity, resolved, page) |
| PATCH | `/reconciliation/issues/:id/resolve` | HQ | 이슈 해결 처리 |

### 5.5 통계/정책 (`/api/stats`)
| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| GET | `/stats/dashboard` | 인증(스코프) | 대시보드 요약 (퍼널, 지역별, 이슈) |
| GET | `/stats/regions/daily` | HQ/REGION/AUDITOR | 지역법인 일자별 통계 |
| GET | `/stats/team-leaders/daily` | 인증(스코프) | 팀장 일자별 통계 |
| GET | `/stats/export/csv` | HQ/REGION/AUDITOR | CSV 다운로드 (?group_by, from, to) |
| GET | `/stats/policies/distribution` | HQ | 배분 정책 목록 |
| GET | `/stats/policies/report` | HQ | 보고서 정책 목록 |
| GET | `/stats/policies/commission` | HQ | 수수료 정책 목록 |
| GET | `/stats/territories` | HQ/REGION | 행정동-지역법인 매핑 |

### 5.6 인사관리 (`/api/hr`)
| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| GET | `/hr/organizations` | HQ | 조직 목록 (인원수 포함) |
| POST | `/hr/organizations` | SUPER_ADMIN | 조직 등록 |
| PUT | `/hr/organizations/:id` | SUPER_ADMIN | 조직 수정 |
| GET | `/hr/users` | HQ/REGION | 사용자 목록 (필터, 페이징) |
| GET | `/hr/users/:id` | HQ/REGION | 사용자 상세 (역할, 실적, 인증이력) |
| POST | `/hr/users` | HQ/REGION | **사용자 등록** (자동 ID/PW 생성) |
| PUT | `/hr/users/:id` | HQ/REGION | 사용자 수정 |
| PATCH | `/hr/users/:id/status` | HQ/REGION | 활성화/비활성화 |
| POST | `/hr/users/:id/reset-password` | HQ/REGION | 비밀번호 초기화 (폰뒷4+!) |
| POST | `/hr/users/change-password` | 인증(본인) | 비밀번호 변경 |
| POST | `/hr/users/:id/set-credentials` | HQ/REGION | ID/PW 직접 설정 |
| POST | `/hr/phone/send-otp` | 공개 | OTP 발송 (6자리, 3분, 도배방지) |
| POST | `/hr/phone/verify-otp` | 공개 | OTP 검증 (5회 시도 제한) |
| GET | `/hr/phone/status` | 공개 | 인증 상태 조회 |
| GET | `/hr/roles` | HQ/REGION | 역할 목록 |

---

## 6. 대사 (정합성 검증) 7가지 규칙

| # | 규칙 | 심각도 | 설명 |
|---|------|--------|------|
| 1 | `DUPLICATE_ORDER` | HIGH | fingerprint 중복 주문 |
| 2 | `DISTRIBUTION_MISSING` | HIGH | VALIDATED인데 배분 레코드 없음 |
| 3 | `ASSIGNMENT_MISSING` | MEDIUM | DISTRIBUTED인데 배정 레코드 없음 |
| 4 | `REPORT_MISSING` | CRITICAL | SUBMITTED 이상인데 보고서 없음 |
| 5 | `PHOTO_COUNT_INSUFFICIENT` | MEDIUM | 정책 대비 사진 부족 |
| 6 | `STATUS_INCONSISTENT` | CRITICAL | 정산확정인데 HQ 승인 이력 없음 |
| 7 | `AMOUNT_MISMATCH` | HIGH | 정산금액 ≠ 주문금액, 또는 기본 - 수수료 ≠ 지급 |

---

## 7. 정산 플로우

```
1. Run 생성  : POST /settlements/runs (period_type, period_start, period_end) → DRAFT
2. 산출      : POST /settlements/runs/:id/calculate
               - HQ_APPROVED + 기간내 + 미정산 주문 대상
               - 수수료 계산: 팀장 개별 정책 > 지역 기본 정책 (PERCENT/FIXED)
               - settlements 레코드 INSERT → CALCULATED
3. 확정      : POST /settlements/runs/:id/confirm
               - settlements → CONFIRMED
               - orders → SETTLEMENT_CONFIRMED
               - team_leader_ledger_daily UPSERT
               - 통계 UPDATE (팀장/지역 daily stats)
4. 지급(미구현): CONFIRMED → PAID (외부 결제 시스템 연동)
```

---

## 8. 프론트엔드 UI 화면

### HQ 콘솔 (9개 화면)
1. **대시보드** — 총 주문, 퍼널 차트, 지역별 요약, 미해결 이슈
2. **주문관리** — 목록(필터/페이징), 상세 모달, 수동 등록, 배치 수신
3. **배분관리** — 자동 배분 실행, 유효성통과/보류 목록, 수동 배분
4. **HQ검수** — REGION_APPROVED 주문 목록, 승인/반려
5. **정산관리** — Run 목록, 생성/산출/확정, 명세 상세, 원장
6. **대사(정합성)** — 대사 실행, Run 이력, 미해결 이슈 목록, 해결 처리
7. **통계** — 지역/팀장 일자별 테이블, CSV 다운로드
8. **인사관리** — 사용자 CRUD, 조직 관리, 핸드폰 인증
9. **정책관리** — 배분/보고서/수수료 정책 조회, 지역권 매핑

### REGION 콘솔 (5개 화면)
1. **대시보드** — 스코프 내 현황
2. **칸반(배정)** — 드래그앤드롭 팀장 배정
3. **1차검수** — SUBMITTED 주문 승인/반려
4. **팀장관리** — 자기 법인 팀장 등록/수정/인증
5. **통계** — 스코프 내 통계

### TEAM_LEADER 뷰 (2개 화면)
1. **내 주문** — 배정된 주문 목록, 작업 시작, 보고서 제출
2. **내 현황** — 일자별 통계, 정산 원장

---

## 9. 보안 및 감사

### 9.1 인증 흐름
1. `POST /api/auth/login` → SHA-256 해시 비교 → 세션 생성 (UUID, 24시간 TTL)
2. 모든 `/api/*` 요청에 `authMiddleware` 적용 (Header `X-Session-Id` 또는 Cookie `session_id`)
3. `requireAuth(c, roles?)` — 인증 + 역할 검증
4. 비활성 사용자: 세션 조회 시 `u.status = 'ACTIVE'` 체크

### 9.2 감사 로그
- `audit_logs` 테이블: entity_type, entity_id, action, actor_id, detail_json, ip_address, created_at
- 기록 시점: 로그인, 사용자 생성/수정/비활성화, 비밀번호 변경/초기화, 조직 생성/수정, ID/PW 설정
- `order_status_history`: 주문 상태 전이마다 기록

### 9.3 SHA-256 Fingerprint
- 주문 등록 시: `address_text|requested_date|service_type|base_amount` → SHA-256
- 동일 fingerprint + requested_date 조합 시 409 반환
- 멱등성 보장

---

## 10. 개발 환경 설정

### 10.1 로컬 개발
```bash
# 의존성 설치
npm install

# DB 마이그레이션 + 시드
npm run db:reset

# 빌드
npm run build

# 서비스 시작 (PM2)
pm2 start ecosystem.config.cjs

# 서비스 확인
curl http://localhost:3000/api/health

# 로그 확인
pm2 logs dahada-oms --nostream
```

### 10.2 테스트 계정
| 역할 | ID | PW | 조직 |
|------|----|----|------|
| SUPER_ADMIN | admin | admin123 | 다하다(HQ) |
| HQ_OPERATOR | hq_operator | admin123 | 다하다(HQ) |
| REGION_ADMIN | seoul_admin | admin123 | 서울지역법인 |
| REGION_ADMIN | gyeonggi_admin | admin123 | 경기지역법인 |
| TEAM_LEADER | leader_seoul_1 | admin123 | 서울지역법인 |
| TEAM_LEADER | leader_gyeonggi_1 | admin123 | 경기지역법인 |

### 10.3 npm 스크립트
```bash
npm run dev              # Vite 개발 서버
npm run build            # 프로덕션 빌드
npm run db:reset         # DB 전체 리셋
npm run db:migrate:local # 마이그레이션만 적용
npm run db:seed          # 시드 데이터만 적용
npm run db:console       # D1 콘솔
```

---

## 11. v1.1 변경 이력 (버그 수정 포함)

### v1.1.1 (2026-03-03) - 버그 수정
1. **[FIX] 주문 등록 시 address_text 누락 → 500 에러**
   - `POST /orders`: `address_text` 필수 필드 검증 추가 → 400 반환
2. **[FIX] 사용자 수정 시 역할만 변경하면 "변경할 항목 없음" 오류**
   - `PUT /hr/users/:id`: role-only 변경 시에도 정상 처리되도록 로직 분리

### v1.1.0 (2026-03-03) - 인사관리
- 인사관리 모듈: 사용자/조직 CRUD, 핸드폰 OTP 인증, ID/PW 설정
- DB 마이그레이션 0002: phone_verified, phone_verifications 테이블
- 프론트엔드 HR 탭 (사용자/조직/인증)

### v1.0.0 (2026-03-03) - 초기 릴리스
- 5-level RBAC, 27 DB 테이블, 13-state FSM
- 주문 수신/배분/배정/검수/정산/대사/통계 전체 구현
- SPA 프론트엔드 (HQ 8화면, REGION 4화면, TEAM_LEADER 2화면)
- 30+ REST API, SHA-256 fingerprint, 감사 로그

---

## 12. 미구현 / 고도화 필요 항목

### 12.1 즉시 필요 (P0)
- [ ] 비밀번호 해시: SHA-256 → bcrypt/argon2 마이그레이션
- [ ] SMS 실제 발송 연동 (NHN Cloud / Twilio)
- [ ] HTTPS 강제 리다이렉트 + Secure Cookie
- [ ] 세션 갱신 (sliding window expiry)
- [ ] 정책 CRUD API (현재는 조회만)

### 12.2 기능 고도화 (P1)
- [ ] PAID 상태 처리 (외부 결제 시스템 연동)
- [ ] 주문 배치 수신: 실제 CSV/XLSX 파싱 (R2 업로드)
- [ ] 사진 업로드: R2 Storage 연동 (현재 URL 입력)
- [ ] 반려 사유 코드 체계화 (reason_codes 관리)
- [ ] 수수료 정책 CRUD + 이력 관리
- [ ] 지역권 CRUD (지역 신규/변경/해제)
- [ ] 알림 시스템 (상태 변경 시 알림)

### 12.3 성능 / 운영 (P2)
- [ ] 세션 정리 크론 (만료 세션 삭제)
- [ ] 통계 배치 계산 (현재 실시간 집계)
- [ ] API Rate Limiting
- [ ] 검색 인덱스 최적화 (LIKE → FTS5)
- [ ] 프론트엔드 번들링 (Vite SPA → React/Vue 전환)
- [ ] 에러 핸들링 일원화 (전역 에러 핸들러)
- [ ] API 응답 표준화 (envelope pattern)

### 12.4 UI/UX (P3)
- [ ] 모바일 반응형 완성 (팀장 모바일 뷰)
- [ ] 다크 모드
- [ ] 키보드 단축키
- [ ] 검수 이미지 뷰어 (사진 확대)
- [ ] 실시간 알림 배지
- [ ] 대시보드 차트 개선 (Chart.js 활용)

---

## 13. 커밋 컨벤션

```
feat: 새 기능 추가
fix: 버그 수정
refactor: 리팩토링 (기능 변화 X)
docs: 문서 변경
style: 코드 스타일 (포맷팅)
test: 테스트 추가/수정
chore: 빌드/설정 변경
db: DB 마이그레이션/시드 변경
```

예시:
```
feat: HR 인사관리 모듈 추가 (사용자/조직 CRUD, OTP 인증)
fix: 주문 등록 시 address_text 필수값 검증 누락
db: 0002 마이그레이션 - phone_verified, phone_verifications 추가
```
