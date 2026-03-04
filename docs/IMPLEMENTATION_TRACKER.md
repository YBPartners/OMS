# 다하다 OMS — 구현 추적 문서 (Implementation Tracker)

> ⚠️ **이 문서는 대화 압축/토큰 초과 시 컨텍스트 복구용입니다.**
> 항상 이 파일을 먼저 읽어 현재 진행 상황을 파악하세요.

## 최종 승인 상태: ✅ 전체 적용 확정 (2026-03-04)

- v4.0 설계서: `docs/DESIGN_v4.0_team_signup_system.md` — 팀장 가입, 총판 관리, 조직 계층
- v5.0 혁신 설계서: `docs/ARCHITECTURE_INNOVATION_v5.0.md` — 10가지 혁신 포인트
- **10가지 혁신 전체 적용 승인됨**
- **5-Phase 순서 동의됨**

---

## 현재 진행 상황

### ✅ Phase 1: 기반 — COMPLETED
- [x] 1.1 DB 마이그레이션 0002 (team_signup_system) + 0003 (innovation_v5)
- [x] 1.2 admin_regions 전국 읍면동 시드 (~3,500건)
- [x] 1.3 기존 데이터 마이그레이션 (법인→총판 이름변경, TEAM org 생성, 팀장 재매핑)
- [x] 1.4 scope-engine.ts (통합 스코프 엔진)
- [x] 1.5 state-machine.ts (중앙 상태 머신)
- [x] 1.6 batch-transaction.ts (D1 batch 래퍼)
- [x] 1.7 types/index.ts 업데이트 (TEAM org_type, 신규 타입)
- [x] 1.8 types/audit-events.ts (구조화된 감사 이벤트 코드)
- [x] 1.9 seed_v2.sql (신규 테스트 데이터)
- [x] 1.10 DB 적용 및 검증 완료

### 🔄 Phase 2: 총판 & 배분 — IN PROGRESS
- [x] 2.1 distribution-engine.ts
- [x] 2.2 행정구역 검색 API (admin-regions/)
- [x] 2.3 총판 CRUD API (distributors/crud.ts)
- [x] 2.4 총판 권역 관리 API (distributors/regions.ts)
- [x] 2.5 총판-팀 매핑 API (distributors/teams.ts)
- [x] 2.6 조직 관리 API (organizations/)
- [x] 2.7 기존 orders 라우트 scope-engine 적용
- [x] 2.8 기존 orders 라우트 state-machine 적용
- [x] 2.9 기존 settlements 라우트 scope-engine 적용
- [x] 2.10 기존 stats 라우트 scope-engine 적용
- [x] 2.11 index.tsx 라우트 마운트 업데이트
- [x] 2.12 빌드 및 서비스 검증

### ⬜ Phase 3: 가입 시스템 — PENDING
- [ ] 3.1 가입용 OTP API (토큰 기반, phone-verify.ts)
- [ ] 3.2 가입 신청 API (register.ts)
- [ ] 3.3 가입 상태 조회/재신청 API
- [ ] 3.4 가입 승인 API (signup-approvals/, batch 트랜잭션)
- [ ] 3.5 notification.ts + 알림 API (notifications/)
- [ ] 3.6 middleware/auth.ts 가입 라우트 인증 면제

### ⬜ Phase 4: 프론트엔드 — PENDING
- [ ] 4.1 store.js (상태 관리)
- [ ] 4.2 loader.js (모듈 로더)
- [ ] 4.3 constants.js 메뉴/권한 추가
- [ ] 4.4 signup.js (4단계 위저드)
- [ ] 4.5 distributors.js (총판 관리)
- [ ] 4.6 org-tree.js (조직 트리/테이블)
- [ ] 4.7 signup-approvals.js (가입 승인)
- [ ] 4.8 notifications.js (알림 센터)
- [ ] 4.9 auth.js/app.js 업데이트 (가입 링크, 라우팅)
- [ ] 4.10 ui.js 알림 배지 추가

### ⬜ Phase 5: 품질 — PENDING
- [ ] 5.1 정산 엔진 batch 리팩터링
- [ ] 5.2 대사 엔진 확장 (12규칙 + batch)
- [ ] 5.3 감사 이벤트 코드 적용
- [ ] 5.4 통합 테스트

---

## 핵심 설계 결정 요약

1. **조직 계층**: HQ → REGION(총판) → TEAM(팀) / organizations.parent_org_id
2. **행정구역**: admin_regions (~5000건) + org_region_mappings (총판/팀 ↔ 읍면동)
3. **가입 대상**: 팀장만 자가가입, 총판은 SUPER_ADMIN이 생성 (계정+조직 동시)
4. **팀-총판**: 기본 1:1, SUPER_ADMIN이 team_distributor_mappings로 추가 가능
5. **승인 흐름**: 팀장 가입 → PENDING → 총판이 체크리스트+수수료 → APPROVED → 즉시 로그인
6. **거절 시**: SMS(개발모드: 콘솔) + 재신청 가능
7. **OTP**: 개발모드 (화면 표시), 토큰 기반 30분 만료
8. **배분**: admin_regions 우선 → 레거시 fallback
9. **스코프**: getUserScope() 통합 (SUPER_ADMIN=전체, REGION_ADMIN=자기총판+하위팀, TEAM_LEADER=자기팀)
10. **트랜잭션**: D1 batch()로 원자적 실행

---

## 기술 스택

- Backend: Hono + TypeScript + Cloudflare Workers
- DB: Cloudflare D1 (SQLite)
- Frontend: Vanilla JS + TailwindCSS + FontAwesome
- 포트: 3000 (PM2 + wrangler pages dev)

---

## 파일 경로 참조

- 프로젝트 루트: `/home/user/webapp/`
- 마이그레이션: `/home/user/webapp/migrations/`
- 시드 데이터: `/home/user/webapp/seed.sql` (기존), `/home/user/webapp/seed/` (신규)
- 백엔드 소스: `/home/user/webapp/src/`
- 프론트엔드: `/home/user/webapp/public/static/js/`
- 설계 문서: `/home/user/webapp/docs/`
