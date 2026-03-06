# 와이비 OMS - 주문관리시스템 v18.0.0

## 프로젝트 개요
- **명칭**: 와이비 OMS (Order Management System)
- **목적**: 원청(아정당) → 와이비(HQ) → 총판(4개) → 대리점(AGENCY) → 팀 구조의 주문 처리/배분/검수/정산/대사/통계 통합 시스템
- **설계 원칙**: 고품질 · 자동화 · 정합성 · 보안 우선 · 기능별 분리 설계 · 서비스 레이어 분리
- **기술 스택**: Hono + TypeScript + Cloudflare Workers + D1 (SQLite) + **KV (Session Cache)** + TailwindCSS + Vanilla JS

## URLs
- **프로덕션**: https://dahada-oms.pages.dev
- **GitHub**: https://github.com/YBPartners/OMS

## 관련 문서 (새 대화에서 이어가기)
> **새 대화를 시작할 때 반드시 아래 파일들을 순서대로 읽으세요:**
1. **`ARCHITECTURE.md`** — 시스템 구조, 기술 스택, 디렉터리, DB 모델, API 전체 맵
2. **`PROGRESS.md`** — Phase별 개발 진행 상태, 미구현 목록, 알려진 이슈
3. **`docs/IMPLEMENTATION_TRACKER.md`** — 세부 체크리스트, 설계 결정, 파일 경로

## 테스트 계정
| 역할 | 아이디 | 비밀번호 |
|------|--------|----------|
| HQ 총괄관리자 | admin | admin123 |
| HQ 운영자 | hq_operator | admin123 |
| 서울 지역법인 | seoul_admin | admin123 |
| 경기 지역법인 | gyeonggi_admin | admin123 |
| 인천 지역법인 | incheon_admin | admin123 |
| 부산 지역법인 | busan_admin | admin123 |
| 서울 팀장1 | leader_seoul_1 | admin123 |
| 서울 팀장2 | leader_seoul_2 | admin123 |
| 경기 팀장1 | leader_gyeonggi_1 | admin123 |
| 경기 팀장2 | leader_gyeonggi_2 | admin123 |
| 인천 팀장1 | leader_incheon_1 | admin123 |
| 부산 팀장1 | leader_busan_1 | admin123 |

## 구현 Phase 이력

| Phase | 이름 | 상태 | 주요 내용 |
|-------|------|------|-----------|
| 0 | 초기 세팅 + v1.0 | ✅ | Hono+D1, 기본 CRUD, 보안 |
| 1 | DB + 코어 엔진 | ✅ | 5개 마이그레이션, Scope/State/Batch 엔진 |
| 2 | Admin API, 총판/팀 | ✅ | 행정구역, 조직 매핑, 14개 엔진 적용 |
| 3 | 가입 워크플로, 알림 | ✅ | OTP, 가입 신청/승인, 알림 시스템 |
| 4 | 프론트엔드 UI | ✅ | 15개 페이지, SPA 구조 |
| 5 | Kanban + 감사 + 배포 | ✅ | 칸반, 감사 UI, CF Pages 배포 |
| 6 | 인터랙션 디자인 | ✅ | 드로어, 팝오버, 컨텍스트메뉴, 호버프리뷰, 배치바 |
| 6.5 | 서비스 레이어 분리 | ✅ | 5개 서비스, 모듈 간 교차 의존성 해소 |
| 7.0 | 다채널 + 대리점 계층 | ✅ | 주문 채널 관리, AGENCY_LEADER 역할, 대리점 전용 UI |
| 7.1 | 배분 기능 완성 | ✅ | 일괄/개별 수동배분, 드로어 빠른액션 |
| 8.0 | 데이터 시각화 + CSV | ✅ | Dashboard Chart.js 3종, CSV 내보내기 |
| 9.0 | 모바일/반응형 | ✅ | 바텀네비, 풀투리프레시, 스와이프, 모바일 UI |
| 10.0 | 성능 최적화 + 알림 설정 | ✅ | 16개 DB 인덱스, 알림 설정 UI/API, 프로필 탭 리디자인 |
| 11.0 | 정산 보고서 + 대리점 내역서 | ✅ | 인쇄용 HTML, CSV, 대리점 정산, 캐시/debounce |
| 12.0 | 실시간 폴링 + 온보딩 + 채널수수료 + 엑셀 | ✅ | 대시보드 자동갱신, 대리점 온보딩, 채널별 수수료, xlsx |
| 13.0 | 시스템 관리 + 보안 강화 + 글로벌 검색 + 타임라인 | ✅ | 시스템 관리 대시보드, 계정 잠금, Cmd+K 검색, 주문 타임라인 |
| 14.0 | 웹 푸시 + 데이터 관리 + 매출/정산 차트 | ✅ | Service Worker, 임포트/백업/복원, 매출 추이, 정산 현황 차트 |
| 15.0 | GAP 패치 + 상태전이 정규화 + 정책 CRUD | ✅ | READY_DONE/DONE 상태, 알림 트리거, 정책관리 CRUD |
| 16.0 | 품질 강화 + E2E 테스트 + 문서 정비 | ✅ | E2E 50/50, 로그아웃/보고서 버그 수정, 에러 핸들링 강화 |
| **17.0** | **주문 수동 등록 – 실주소 검색** | **✅** | **카카오 우편번호 서비스 연동, admin_dong_code 자동 매핑** |
| **17.1** | **보고서/영수증 – 모바일 카메라 직접 첨부 + 파일명 자동 규칙화** | **✅** | **모바일 카메라 촬영/갤러리, Base64 첨부, 파일명 `YYYYMMDD_팀코드_카테고리.ext`** |
| **18.0** | **KV 캐시 세션 검증 – D1 쿼리 최소화** | **✅** | **SESSION_CACHE KV, session-service v2.0, API 요청당 D1 쿼리 3→0회** |

## v18.0 주요 변경사항

### Phase 18.0: KV 캐시 세션 검증 – D1 쿼리 최소화
- **Cloudflare KV** `SESSION_CACHE` 네임스페이스 추가
- **session-service v2.0**: KV 우선 조회 → miss 시 D1 fallback → KV 재캐시
- **로그인 시**: D1 세션 저장 + KV에 사용자 정보 캐시 (TTL 24h)
- **API 요청마다**: KV hit 시 **D1 쿼리 0회** (기존 3~4회 → 0회)
- **로그아웃/무효화**: D1 + KV 동시 삭제로 일관성 보장
- **장애 안전(Graceful Degradation)**: KV 실패 시 D1 자동 fallback
- **성능 효과**: 동시 200명 × 분당 10요청 시 D1 쿼리 24,000건/분 → ~0건/분

## v17.0~17.1 주요 변경사항

### Phase 17.0: 주문 수동 등록 – 실주소 검색
- **카카오 우편번호 서비스** (Daum Postcode v2) CDN 연동 — API 키 불필요
- 주문 수동 등록 모달에 **"주소 검색" 버튼** 추가 → 도로명/지번/건물명 검색
- 선택한 주소에서 시도/시군구/읍면동 파싱 → `GET /api/system/address-lookup` 호출
- **행정동 코드(admin_dong_code) 자동 매핑** → 파란색 매핑 결과 표시 (코드 + 지역명)
- 매핑 실패 시 경고 표시, 상세주소 별도 입력 가능
- 백엔드: `GET /api/system/address-lookup?sido=&sigungu=&dong=` API 추가
- 백엔드: `GET /api/system/admin-regions?sido=` 시도별 행정구역 목록 API 추가

### Phase 17.1: 보고서/영수증 – 모바일 카메라 직접 첨부 + 파일명 자동 규칙화
- **보고서 체크리스트 각 항목별 카메라 촬영/갤러리 선택** UI 구현
  - 외부촬영, 내부촬영, 세척전, 세척후 (필수) / 영수증, 고객확인 (선택)
- **`<input type="file" accept="image/*" capture="environment">`** — 모바일에서 카메라 직접 실행
- **파일명 자동 규칙화**: `YYYYMMDD_팀코드_카테고리.확장자`
  - 예: `20260306_REGION_SEOUL_외부촬영.jpg`, `20260306_REGION_SEOUL_영수증.png`
- **파일 크기 2MB 제한**, 이미지 타입만 허용, Base64 Data URL로 D1 저장
- **미리보기 + 삭제** 기능, 사진 첨부 시 체크리스트 자동 체크
- **영수증 첨부**도 동일 카메라/갤러리 UI로 통합
- 백엔드: `POST /api/orders/:id/upload` multipart 사진 업로드 API
- 백엔드: 서버 측 파일명 규칙화 (org_code 기반 팀 코드 조회)
- DB: `0011_photo_upload.sql` — work_report_photos에 file_name, file_size, mime_type 컬럼 추가
- `/auth/me` 응답에 `org_code` 필드 추가

## 핵심 비즈니스 흐름
```
주문 수신 → 유효성검증 → 행정동 기반 자동배분 → 팀장 배정
→ 준비완료 → 작업 수행 → 보고서 제출 (체크리스트+사진첨부) → 최종완료 (영수증 첨부)
→ 지역 1차 검수 → HQ 2차 검수
→ 정산 산출/확정 → 대사(정합성 검증) → 정산 완료
```

## 페이지별 기능
| 페이지 | 주요 기능 |
|--------|-----------|
| 대시보드 | 요약 카드, 퍼널, 지역 통계, Chart.js 실시간 차트 5종 |
| 주문관리 | CRUD, 필터, 드로어 상세, 배치 액션, 일괄/개별 배분, CSV/xlsx 내보내기, **실주소 검색** |
| 주문채널 | 다채널 원장 등록/수정/관리, 채널별 통계 |
| 칸반 | 드래그 배정, 다중선택, 배치배정/해제, READY_DONE 카드 |
| 검수 | 지역1차/HQ2차, 배치 승인/반려, 스와이프 제스처 |
| 정산 | Run 생성, 산출, 확정, 상세, 인쇄 보고서, CSV/xlsx |
| 대사 | 자동 정합성 검증, 이슈 관리 |
| 통계 | 지역별/팀장별 일별, CSV 내보내기, 정책관리 CRUD |
| 인사관리 | 사용자/조직/수수료/행정구역/총판/온보딩 |
| 팀장가입 | 5단계 위자드 (OTP→정보→지역→확인→완료) |
| 알림 | 벨 드롭다운, 전체 목록, 설정(유형/수단별 on/off), 웹 푸시 |
| 감사로그 | 목록, 통계 4패널, 상세 |
| 시스템관리 | 시스템 정보, 세션관리, DB현황, 데이터 임포트/백업/복원, 글로벌 검색(Cmd+K) |
| 내주문 | 팀장 전용, READY_DONE/DONE 플로우, **보고서 사진첨부**, **영수증 카메라첨부**, 프로필/알림설정 |
| 대리점 | 대리점장 전용 대시보드/주문관리/소속 팀장/정산 내역서 |

## RBAC 역할 체계 (v7.0)

| 코드 | 한글명 | 범위 | 주요 권한 |
|------|--------|------|-----------|
| SUPER_ADMIN | 총괄관리자 | 전체 | 모든 기능, 시스템 설정 |
| HQ_OPERATOR | HQ운영자 | 본사 | 주문/배분/HQ검수/정산/대사/통계/인사/채널관리 |
| REGION_ADMIN | 파트장 | 자기 법인 | 칸반배정/1차검수/팀장관리/통계/대리점관리 |
| AGENCY_LEADER | 대리점장 | 하위 팀장 | 배정/1차검수/팀장관리/내주문 |
| TEAM_LEADER | 팀장 | 자기 주문 | 작업시작/보고서제출/내 현황 |
| AUDITOR | 감사 | 전체(읽기) | 대사/통계/이력 조회 |

## API 엔드포인트 요약

총 **~120개** API 엔드포인트. 상세 맵은 `ARCHITECTURE.md` 참조.

| 도메인 | 경로 프리픽스 | 주요 기능 |
|--------|-------------|-----------|
| 인증 | /api/auth | 로그인, 로그아웃, 세션, 조직/팀장 조회 |
| 주문 | /api/orders | CRUD, 자동/수동/일괄배분, 배정, 준비완료, 작업시작, 보고서, **사진업로드**, 최종완료, 검수 |
| 정산 | /api/settlements | Run 관리, 산출, 확정, 보고서, CSV, 대리점 내역서 |
| 대사 | /api/reconciliation | 대사 실행, 이슈 관리 |
| HR | /api/hr | 사용자, 조직, 수수료, 행정구역, 총판 |
| 채널 | /api/hr/channels | 채널 CRUD, 채널별 통계 |
| 대리점 | /api/hr/agencies | 대리점 관리, 팀장 배정/해제, 온보딩 |
| 가입 | /api/signup | OTP, 신청, 승인/반려 |
| 통계 | /api/stats | 대시보드, 리포트, 정책 CRUD, 매출추이, 정산현황 |
| 알림 | /api/notifications | CRUD, 미읽음 수, 전체 읽음, 설정 조회/수정 |
| 감사 | /api/audit | 로그 목록, 통계, 상세 |
| 시스템 | /api/system | 시스템정보, 세션관리, 검색, 타임라인, 임포트/백업/복원, 푸시, **주소검색**, **행정구역조회** |

## 데이터 아키텍처
- **Cloudflare D1**: SQLite 기반 **41개 테이블** (v15: +distribution_policies, report_policies)
- **마이그레이션**: 11개 (0001~0011, 최신: 0011_photo_upload.sql)
- **State Machine**: 15단계 주문 상태 전이 (v15.0: READY_DONE/DONE 추가)
- **Scope Engine v7.0**: 역할별 데이터 가시성 (HQ → REGION → AGENCY → TEAM)
- **Batch Builder**: D1 batch()를 활용한 원자적 트랜잭션
- **Service Layer**: 5개 서비스 (교차 도메인 쓰기 일원화)
- **KV Cache**: 세션 검증 KV 캐시 (세션당 ~1KB, TTL 24h)

## 서비스 레이어 아키텍처 (v6.5)
| 서비스 | 역할 | 차단한 교차 의존 |
|--------|------|-----------------|
| notification-service | 알림 테이블 유일 쓰기 진입점 | Signup/RegionAdd → notifications |
| session-service v2.0 | 세션 CRUD + **KV 캐시** 검증/만료정리/무효화 | Auth/HR → sessions + KV |
| hr-service | 팀+리더 원자적 생성 (6개 테이블) | Signup → HR 테이블 |
| order-lifecycle-service | 정산 확정 시 주문/통계 일괄 업데이트 | Settlements → Orders/Stats |
| stats-service | 통계 도메인 유일 쓰기 진입점 | Settlements → 통계 테이블 |

## E2E 통합 테스트 (v16.0)
- **파일**: `tests/e2e.sh` (386줄, 50개 테스트)
- **실행**: `cd /home/user/webapp && bash tests/e2e.sh`
- **결과**: 50/50 통과 (15개 영역)

| # | 영역 | 테스트 수 |
|---|------|-----------|
| 1 | 헬스체크 | 2 |
| 2 | 인증 | 5 |
| 3 | 주문 CRUD | 3 |
| 4 | 주문 라이프사이클 | 10 |
| 5 | 배치 작업 | 1 |
| 6 | 정산 | 3 |
| 7 | 통계/대시보드 | 2 |
| 8 | 정책 | 4 |
| 9 | 알림 | 3 |
| 10 | 시스템 | 3 |
| 11 | HR/감사 | 4 |
| 12 | 채널/대리점 | 2 |
| 13 | RBAC | 2 |
| 14 | 매출/정산차트 | 2 |
| 15 | 로그아웃 | 4 |

## 배포 정보
- **플랫폼**: Cloudflare Pages + D1 + **KV**
- **상태**: ✅ Active
- **프로덕션**: https://dahada-oms.pages.dev
- **Cloudflare 프로젝트명**: dahada-oms
- **D1 ID**: 0b7aedd5-7510-44d3-8b81-d421b03fffa6
- **KV ID**: 5024085768aa47ba943e4e65a454795e (SESSION_CACHE)
- **버전**: v18.0.0
- **빌드 크기**: 235.42 KB (dist/_worker.js)
- **총 코드량**: Backend 9,041 + Frontend 11,107 + SW 143 + CSS 419 + SQL 1,184 + E2E 386 = **22,280줄**
- **파일 수**: Backend 46 TS + Frontend 24 JS + 1 SW + 1 CSS + 11 SQL migrations + 2 seed + 1 E2E = **86파일**
- **최종 업데이트**: 2026-03-06

## 로컬 개발
```bash
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000/api/health

# E2E 테스트 실행
bash tests/e2e.sh

# DB가 비어있으면:
npx wrangler d1 migrations apply dahada-production --local
npx wrangler d1 execute dahada-production --local --file=./seed.sql
```
