# 다하다 OMS — 구현 추적 문서 (Implementation Tracker)

> **최종 업데이트**: 2026-03-05
> **버전**: v6.0.0
> **⚠️ 이 문서는 대화 압축/토큰 초과 시 컨텍스트 복구용입니다.**
> **항상 이 파일 + ARCHITECTURE.md + PROGRESS.md 를 먼저 읽어 현재 진행 상황을 파악하세요.**

---

## 문서 체계

| 문서 | 경로 | 용도 |
|------|------|------|
| **ARCHITECTURE.md** | `/home/user/webapp/ARCHITECTURE.md` | 시스템 구조, 기술 스택, API 맵, DB 모델 |
| **PROGRESS.md** | `/home/user/webapp/PROGRESS.md` | Phase별 진행 상태, 미구현 목록, 알려진 이슈 |
| **IMPLEMENTATION_TRACKER.md** | 이 파일 | 세부 체크리스트, 설계 결정, 파일 경로 |
| **README.md** | `/home/user/webapp/README.md` | 프로젝트 개요, 테스트 계정, API 요약 |
| **ARCHITECTURE_INNOVATION_v5.0.md** | `/home/user/webapp/docs/` | 10가지 혁신 포인트 상세 설계 |
| **DESIGN_v4.0_team_signup_system.md** | `/home/user/webapp/docs/` | 팀장 가입 시스템 상세 설계 |

---

## 현재 상태 요약

- **전체 Phase**: 0~5 완료, Phase 6 (인터랙션 디자인) 7개 서브페이즈 모두 완료
- **프로덕션 배포**: ✅ https://dahada-oms.pages.dev
- **로컬 개발**: ✅ PM2 + wrangler pages dev, port 3000
- **알려진 이슈**: commission_policies updated_at 컬럼 누락, signup SQL syntax error (2건 미해결)

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

---

## 핵심 설계 결정 요약

1. **조직 계층**: HQ → REGION(총판) → TEAM(팀) / organizations.parent_org_id
2. **행정구역**: admin_regions (~5000건) + org_region_mappings (총판/팀 ↔ 읍면동)
3. **가입 대상**: 팀장만 자가가입, 총판은 SUPER_ADMIN이 생성
4. **팀-총판**: 기본 1:1, SUPER_ADMIN이 team_distributor_mappings로 추가 가능
5. **승인 흐름**: 팀장 가입 → PENDING → 총판 체크리스트+수수료 → APPROVED → 즉시 로그인
6. **OTP**: 개발모드 (화면 표시), 토큰 기반 30분 만료
7. **배분**: admin_regions 우선 → 레거시 fallback
8. **스코프**: getUserScope() 통합 (SUPER_ADMIN=전체, REGION_ADMIN=자기총판+하위팀, TEAM_LEADER=자기팀)
9. **트랜잭션**: D1 batch()로 원자적 실행
10. **인증**: PBKDF2 + 레거시 SHA-256 자동 마이그레이션, 세션 24시간, 최대 5개

---

## 기술 스택 참조

- Backend: Hono v4 + TypeScript + Cloudflare Workers + D1
- Frontend: Vanilla JS + TailwindCSS (CDN) + FontAwesome + Chart.js
- Build: Vite + @hono/vite-cloudflare-pages
- Dev: PM2 + wrangler pages dev --local, port 3000
- Deploy: Cloudflare Pages (`wrangler pages deploy dist`)

---

## 파일 경로 참조

- 프로젝트 루트: `/home/user/webapp/`
- 백엔드 소스: `/home/user/webapp/src/` (38파일, 6,414줄)
- 프론트엔드: `/home/user/webapp/public/static/js/` (18파일, 7,141줄)
- 마이그레이션: `/home/user/webapp/migrations/` (5파일)
- 시드 데이터: `/home/user/webapp/seed.sql` + `/home/user/webapp/seed/`
- 설계 문서: `/home/user/webapp/docs/`
- 아키텍처: `/home/user/webapp/ARCHITECTURE.md`
- 진척도: `/home/user/webapp/PROGRESS.md`
- wrangler: `/home/user/webapp/wrangler.jsonc`
- PM2: `/home/user/webapp/ecosystem.config.cjs`
