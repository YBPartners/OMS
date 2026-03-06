# Airflow OMS 개발 문서 v7.0.0

> 주문처리 / 배분 / 검수 / 정산 / 대사 / 통계 시스템  
> 최종 수정: 2026-03-05  
> 버전: v7.0.0 (다채널 원장 + 대리점 계층)

---

## 1. 시스템 아키텍처

### 1.1 기술 스택
| 계층 | 기술 | 비고 |
|------|------|------|
| **Runtime** | Cloudflare Workers (Edge) | V8 Isolates, 10ms CPU free tier |
| **Framework** | Hono v4.12+ | 경량 TypeScript 웹 프레임워크 |
| **Database** | Cloudflare D1 (SQLite) | 로컬 개발은 `--local` 모드 |
| **Build** | Vite + @hono/vite-cloudflare-pages | SSR 번들링 |
| **Frontend** | Vanilla JS + TailwindCSS (CDN) | SPA, 모듈 분리 (22개 JS) |
| **Auth** | 세션 기반 (PBKDF2 해시, HttpOnly Cookie + Header) | SHA-256 자동 마이그레이션 |

### 1.2 디렉토리 구조
```
webapp/
├── src/
│   ├── index.tsx            # Hono 앱 엔트리, SPA HTML, 미들웨어 등록
│   ├── types/index.ts       # 타입, 상태머신, Env 정의
│   ├── middleware/auth.ts   # 세션 인증, RBAC, 감사로그 헬퍼
│   ├── middleware/security.ts # PBKDF2 해싱, Rate Limiting, 입력 검증 유틸
│   ├── lib/
│   │   ├── scope-engine.ts  # v7.0: HQ→REGION→AGENCY→TEAM 스코프
│   │   ├── state-machine.ts # 13단계 FSM (AGENCY_LEADER 포함)
│   │   ├── batch-builder.ts # D1 batch() 원자적 래퍼
│   │   ├── audit.ts         # 감사 로그 + 상태 이력
│   │   ├── db-helpers.ts    # DB 쿼리 유틸리티
│   │   └── validators.ts    # 입력 검증
│   ├── services/            # 서비스 레이어 (5개, 교차 도메인 쓰기 일원화)
│   │   ├── index.ts, notification-service.ts, session-service.ts
│   │   ├── hr-service.ts, order-lifecycle-service.ts, stats-service.ts
│   └── routes/
│       ├── auth.ts          # 로그인/로그아웃/me (→ session-service)
│       ├── orders/          # 주문 CRUD, 배분, 배정, 보고서, 검수
│       ├── settlements/     # 정산 (→ order-lifecycle-service)
│       ├── reconciliation/  # 대사
│       ├── hr/              # 인사 + 채널 + 대리점
│       │   └── channels-agency.ts  # ★ v7.0: 채널 + 대리점 API
│       ├── signup/          # 팀장 자가 가입 (→ hr-service)
│       ├── stats/           # 통계
│       ├── notifications.ts # 알림
│       └── audit.ts         # 감사 로그
├── public/static/js/
│   ├── core/                # constants, api, ui, interactions, auth, app
│   ├── shared/              # form-helpers, table
│   └── pages/               # 14개 페이지 (v7.0: +channels.js, agency.js)
├── migrations/              # D1 마이그레이션 (6개, v7.0: +0006)
├── seed.sql                 # 시드 데이터
├── wrangler.jsonc            # Cloudflare Pages 설정
└── package.json
```

### 1.3 요청 흐름
```
[Browser] → HTTP → [Cloudflare Worker / Wrangler Dev]
   ↓
 CORS middleware
   ↓
 authMiddleware (세션 검증 → session-service → c.set('user'))
   ↓
 Router (auth | orders | settlements | reconciliation | stats | hr | signup | audit)
   ↓
 requireAuth(c, [roles]) — 인증/권한 체크
   ↓
 D1 Database (env.DB) — SQL 쿼리
   ↓
 JSON Response / SPA HTML
```

---

## 2. RBAC (역할 기반 접근 제어) — v7.0

### 2.1 역할 정의 (6개)
| 코드 | 한글명 | 범위 | 주요 권한 |
|------|--------|------|-----------|
| `SUPER_ADMIN` | 총괄관리자 | 전체 | 모든 기능, 시스템 설정, 채널관리 |
| `HQ_OPERATOR` | HQ운영자 | 본사 | 주문/배분/HQ검수/정산/대사/통계/인사/채널 |
| `REGION_ADMIN` | 파트장 | 자기 총판 | 칸반배정/1차검수/팀장관리/통계/대리점관리 |
| `AGENCY_LEADER` | 대리점장 | 하위 팀장 | 배정/1차검수/하위팀장관리/내주문 ★ v7.0 |
| `TEAM_LEADER` | 팀장 | 자기 주문 | 작업시작/보고서제출/내 현황 |
| `AUDITOR` | 감사/조회 | 전체(읽기) | 대사/통계/이력 조회 |

### 2.2 스코프 제한 규칙
- **REGION_ADMIN**: 자기 총판 + 하위 팀 데이터
- **AGENCY_LEADER**: 자신의 주문 + agency_team_mappings 하위 팀장 데이터 ★ v7.0
- **TEAM_LEADER**: 자신의 팀 데이터만
- **HR 스코프**: REGION은 자기 총판 팀장만 등록/수정 가능

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

### 상태 전이표 (v7.0: AGENCY_LEADER 추가)
| 현재 상태 | 다음 상태 | 필요 역할 |
|-----------|-----------|-----------|
| RECEIVED | VALIDATED | SUPER_ADMIN, HQ_OPERATOR |
| VALIDATED | DISTRIBUTED / DISTRIBUTION_PENDING | SUPER_ADMIN, HQ_OPERATOR |
| DISTRIBUTED | ASSIGNED | SUPER_ADMIN, HQ_OPERATOR, REGION_ADMIN, **AGENCY_LEADER** |
| ASSIGNED | IN_PROGRESS | SUPER_ADMIN, TEAM_LEADER |
| IN_PROGRESS | SUBMITTED | SUPER_ADMIN, TEAM_LEADER |
| SUBMITTED | REGION_APPROVED / REGION_REJECTED | SUPER_ADMIN, REGION_ADMIN, **AGENCY_LEADER** |
| REGION_APPROVED | HQ_APPROVED / HQ_REJECTED | SUPER_ADMIN, HQ_OPERATOR |
| HQ_APPROVED | SETTLEMENT_CONFIRMED | SUPER_ADMIN, HQ_OPERATOR |
| REGION/HQ_REJECTED | SUBMITTED | SUPER_ADMIN, TEAM_LEADER |
| SETTLEMENT_CONFIRMED | PAID | SUPER_ADMIN, HQ_OPERATOR |

---

## 4. 데이터베이스 스키마 (38 Tables — v7.0: +2)

### 4.1 핵심 테이블 요약
| # | 테이블명 | 설명 | 비고 |
|---|----------|------|------|
| 1-27 | (기존 테이블) | 조직, 사용자, 역할, 주문, 정산, 대사, 통계 등 | |
| 28 | `sessions` | 세션 | |
| 29-36 | (Phase 1-5) | 행정구역, 가입, 알림, 감사 등 | |
| **37** | **`order_channels`** | **주문 채널 (다채널 원장)** | **v7.0** |
| **38** | **`agency_team_mappings`** | **대리점-팀장 매핑** | **v7.0** |

### 4.2 v7.0 신규 테이블
```sql
-- 주문 채널
order_channels (channel_id PK, name, code UNIQUE, description, contact_info, is_active, priority, created_at, updated_at)

-- 대리점-팀장 매핑
agency_team_mappings (agency_user_id FK, team_user_id FK, created_at)
  PK: (agency_user_id, team_user_id)
```

### 4.3 v7.0 컬럼 추가
```sql
orders.channel_id INTEGER           -- 주문 채널 연결
order_import_batches.channel_id     -- 배치 수신 채널
commission_policies.updated_at TEXT  -- (기존 이슈 #3 해결)
```

---

## 5. API 명세 (70+ Endpoints)

### 5.1-5.5 (기존 API — 상세는 ARCHITECTURE.md 참조)
- 인증: 6개, 주문: 13개, 정산: 5개, 대사: 4개, 통계: 7개
- HR: 14개, 가입: 8개, 알림: 5개, 감사: 3개

### 5.6 주문 채널 API ★ v7.0 (`/api/hr/channels`)
| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| GET | `/hr/channels` | 인증 | 채널 목록 (주문 수/금액 통계) |
| POST | `/hr/channels` | HQ | 채널 생성 (코드: `[A-Z0-9_]{2,30}`) |
| PUT | `/hr/channels/:channel_id` | HQ | 채널 수정 |

### 5.7 대리점 API ★ v7.0 (`/api/hr/agencies`)
| Method | Path | 역할 | 설명 |
|--------|------|------|------|
| GET | `/hr/agencies` | HQ/REGION | 대리점 목록 (Scope) |
| GET | `/hr/agencies/:user_id` | HQ/REGION/AGENCY | 상세 + 하위 팀장 |
| POST | `/hr/agencies/promote` | HQ/REGION | 대리점 권한 부여 |
| POST | `/hr/agencies/demote` | HQ/REGION | 대리점 권한 해제 |
| POST | `/hr/agencies/:id/add-team` | HQ/REGION | 팀장 추가 |
| POST | `/hr/agencies/:id/remove-team` | HQ/REGION | 팀장 제거 |
| GET | `/hr/agencies/:id/candidates` | HQ/REGION | 배정 가능 팀장 후보 |

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
| 7 | `AMOUNT_MISMATCH` | HIGH | 정산금액 ≠ 주문금액 |

---

## 7. 프론트엔드 UI 화면 (v7.0: 21개)

### HQ 콘솔 (10개 화면)
1. **대시보드** — 총 주문, 퍼널 차트, 지역별 요약, 미해결 이슈
2. **주문관리** — 목록(필터/페이징), 드로어 상세, 수동 등록, 배치 수신
3. **배분관리** — 자동 배분 실행, 보류 목록, 수동 배분
4. **주문채널** — 채널 CRUD, 채널별 주문 통계 ★ v7.0
5. **HQ검수** — REGION_APPROVED 주문 목록, 승인/반려
6. **정산관리** — Run 목록, 생성/산출/확정, 명세 상세
7. **대사(정합성)** — 대사 실행, 이슈 목록, 해결
8. **통계** — 지역/팀장 일자별, CSV 다운로드
9. **인사관리** — 사용자/조직 CRUD, 대리점 관리
10. **감사로그** — 목록/통계/상세

### REGION 콘솔 (5개 화면)
1. **대시보드** — 스코프 내 현황
2. **칸반(배정)** — 드래그앤드롭 팀장 배정
3. **1차검수** — SUBMITTED 주문 승인/반려
4. **팀장관리** — 자기 총판 팀장/대리점 관리
5. **통계** — 스코프 내 통계

### AGENCY 콘솔 (3개 화면) ★ v7.0
1. **대리점 현황** — 주문 통계 카드, 하위 팀장 현황
2. **주문관리** — 하위 팀장 주문 목록, 배정, 1차 검수
3. **소속 팀장** — 팀장 목록, 활성 주문 수

### TEAM_LEADER 뷰 (2개 화면)
1. **내 주문** — 배정된 주문 목록, 작업 시작, 보고서 제출
2. **내 현황** — 일자별 통계

---

## 8. 보안 및 감사

### 8.1 인증 흐름
1. `POST /api/auth/login` → PBKDF2 해시 검증 → 세션 생성 (UUID, 24시간)
2. 모든 `/api/*` 요청에 `authMiddleware` 적용
3. `requireAuth(c, roles?)` — 인증 + 역할 검증
4. v7.0: AGENCY_LEADER 세션에 `is_agency`, `agency_team_ids` 추가 로딩

### 8.2 감사 로그
- `audit_logs` 테이블: entity_type, entity_id, action, actor_id, detail_json
- v7.0 추가 이벤트: `AGENCY.PROMOTED/DEMOTED/TEAM_ADDED/TEAM_REMOVED`, `CHANNEL.CREATED/UPDATED`

---

## 9. 개발 환경 설정

### 9.1 로컬 개발
```bash
npm install
npm run db:reset      # DB 리셋 + 시드
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000/api/health
pm2 logs airflow-oms --nostream
```

### 9.2 테스트 계정
| 역할 | ID | PW | 조직 |
|------|----|----|------|
| SUPER_ADMIN | admin | admin123 | Airflow(HQ) |
| HQ_OPERATOR | hq_operator | admin123 | Airflow(HQ) |
| REGION_ADMIN | seoul_admin | admin123 | 서울지역총판 |
| REGION_ADMIN | gyeonggi_admin | admin123 | 경기지역총판 |
| TEAM_LEADER | leader_seoul_1 | admin123 | 서울지역총판 |
| TEAM_LEADER | leader_gyeonggi_1 | admin123 | 경기지역총판 |

### 9.3 npm 스크립트
```bash
npm run dev              # Vite 개발 서버
npm run build            # 프로덕션 빌드
npm run db:reset         # DB 전체 리셋
npm run db:migrate:local # 마이그레이션만 적용
npm run db:seed          # 시드 데이터만 적용
npm run db:console       # D1 콘솔
npm run deploy           # 프로덕션 배포
```

---

## 10. 변경 이력

### v7.0.0 (2026-03-05) - 다채널 원장 + 대리점 계층
1. **[FEAT] 주문 채널(다채널 원장)**: order_channels 테이블, 채널 CRUD API, 채널 관리 UI
2. **[FEAT] 대리점(AGENCY_LEADER) 역할**: 팀장 대리점 승격/해제, 하위 팀장 관리 API 7개
3. **[FEAT] 대리점 전용 UI 3페이지**: 대리점 현황, 주문관리, 소속 팀장
4. **[FEAT] Scope Engine v7.0**: AGENCY_LEADER 스코프 (자신 + 하위 팀장)
5. **[FEAT] State Machine 확장**: AGENCY_LEADER 배정/검수 권한
6. **[FIX] commission_policies.updated_at 누락**: 0006 마이그레이션에서 해결
7. **[DB] 0006_channels_agency.sql**: 2테이블 + 3컬럼 + 1역할 추가

### v6.5.0 (2026-03-05) - 서비스 레이어 리팩터링
- 5개 서비스 도입, 모듈 간 교차 의존성 해소

### v6.0.0 (2026-03-05) - 인터랙션 디자인 시스템
- 드로어/팝오버/컨텍스트메뉴/호버프리뷰/배치바 전 페이지 적용

### v5.0.0 (2026-03-04) - Kanban + 감사 + 배포
- 칸반 개선, 감사 로그, Cloudflare Pages 프로덕션 배포

### v4.0.0 (2026-03-04) - 프론트엔드 UI
- 15개 페이지, SPA 구조, 가입 위자드, 알림 시스템

### v1.0-3.0 (2026-03-02~04) - 초기 구현
- 5-level RBAC, 27+ DB 테이블, 13-state FSM, 주문/정산/대사/통계

---

## 11. 미구현 / 고도화 항목

### P0 (즉시)
- [ ] SMS 실제 발송 연동 (NHN Cloud / Twilio)
- [ ] HTTPS 강제 + Secure Cookie
- [ ] 세션 갱신 (sliding window expiry)

### P1 (기능)
- [ ] PAID 상태 처리 (외부 결제 연동)
- [ ] CSV/XLSX 파싱 (R2 업로드)
- [ ] 사진 업로드 R2 연동
- [ ] 대리점 수수료 자동 분배
- [ ] 대리점별 정산 명세
- [ ] 채널별 수수료 정책

### P2 (성능/운영)
- [ ] API Rate Limiting
- [ ] DB 인덱스 최적화
- [ ] 프론트엔드 번들링

### P3 (UI/UX)
- [ ] 모바일 반응형
- [ ] 다크 모드
- [ ] 키보드 단축키

---

## 12. 커밋 컨벤션

```
feat: 새 기능 추가
fix: 버그 수정
refactor: 리팩토링 (기능 변화 X)
docs: 문서 변경
style: 코드 스타일
test: 테스트 추가/수정
chore: 빌드/설정 변경
db: DB 마이그레이션/시드 변경
```
