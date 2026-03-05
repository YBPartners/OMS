# 다하다 OMS — 개발 진척도 (Development Progress)

> **최종 업데이트**: 2026-03-05
> **현재 버전**: v6.0.0
> **총 코드량**: Backend 6,414줄 (38 TS/TSX) + Frontend 7,141줄 (18 JS) + SQL 1,880줄 = **15,435줄**

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
| 6 | 인터랙션 디자인 시스템 | 🔄 진행중 | - | 드로어/팝오버/컨텍스트메뉴/호버프리뷰 |

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

## Phase 7 이후 — 미구현 / 향후 계획

### 7-1: 데이터 시각화 강화 (미구현)
- [ ] Dashboard 실시간 차트 (Chart.js 활용)
- [ ] 매출 추이 그래프
- [ ] 지역별 히트맵
- [ ] 정산 현황 차트

### 7-2: 모바일/반응형 최적화 (미구현)
- [ ] 사이드바 → 바텀 네비게이션
- [ ] 터치 제스처 지원 (스와이프 승인/반려)
- [ ] 모바일 칸반 뷰

### 7-3: 알림 고도화 (미구현)
- [ ] 웹 푸시 알림 (Service Worker)
- [ ] 이메일 알림 연동
- [ ] 알림 설정 (유형별 on/off)

### 7-4: 보고서/엑셀 출력 (미구현)
- [ ] 정산 보고서 PDF 출력
- [ ] 주문 목록 엑셀 다운로드
- [ ] 통계 CSV 내보내기 (현재 일부 구현)

### 7-5: 성능 최적화 (미구현)
- [ ] 프론트엔드 번들 최적화 (현재 CDN 의존)
- [ ] DB 인덱스 최적화
- [ ] 캐시 전략 (KV 활용)

---

## 알려진 이슈

| # | 이슈 | 상태 | 비고 |
|---|------|------|------|
| 1 | ~~로그인 실패~~ | ✅ 해결 | seed.sql 재적용으로 해결 |
| 2 | ~~드로어 닫기 버그~~ | ✅ 해결 | race condition 수정 |
| 3 | 수수료 정책 updated_at 컬럼 없음 | ⚠️ 미해결 | D1_ERROR: no such column: updated_at |
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
