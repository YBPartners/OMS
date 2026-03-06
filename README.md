# 와이비 OMS - 주문관리시스템 (에어컨 세척)

## 프로젝트 개요
- **명칭**: 와이비 OMS (Order Management System)
- **사업 도메인**: 에어컨 세척 주문 관리 (삼성/엘지/캐리어/아정당/로컬 다채널)
- **조직 구조**: 원청(채널) → 와이비(HQ) → 총판(4개) → 대리점(AGENCY) → 팀장
- **설계 원칙**: 고품질 / 자동화 / 정합성 / 보안 우선 / 서비스 레이어 분리
- **기술 스택**: Hono + TypeScript + Cloudflare Workers + D1(SQLite) + KV(Session) + TailwindCSS + Vanilla JS

## URLs
- **프로덕션**: https://dahada-oms.pages.dev
- **GitHub**: https://github.com/YBPartners/OMS

## 관련 문서
> **새 대화를 시작할 때 아래 파일들을 순서대로 읽으세요:**
1. **`ARCHITECTURE.md`** — 시스템 구조, 기술 스택, 디렉터리, DB 모델, API 전체 맵
2. **`PROGRESS.md`** — Phase별 개발 진행 상태, 미구현 목록, 알려진 이슈
3. **`README.md`** (본 문서) — 현재 기능 요약, 테스트 계정, 배포 정보

---

## 테스트 계정

| 역할 | 아이디 | 비밀번호 | 소속 |
|------|--------|----------|------|
| HQ 총괄관리자 | admin | admin123 | 와이비 본사 |
| HQ 운영자 | hq_operator | admin123 | 와이비 본사 |
| 서울 총판 | seoul_admin | admin123 | 서울지역총판 |
| 경기 총판 | gyeonggi_admin | admin123 | 경기지역총판 |
| 인천 총판 | incheon_admin | admin123 | 인천지역총판 |
| 부산 총판 | busan_admin | admin123 | 부산지역총판 |
| 서울 팀장1 | leader_seoul_1 | admin123 | 서울지역총판 하위 |
| 서울 팀장2 | leader_seoul_2 | admin123 | 서울지역총판 하위 |
| 경기 팀장1 | leader_gyeonggi_1 | admin123 | 경기지역총판 하위 |
| 경기 팀장2 | leader_gyeonggi_2 | admin123 | 경기지역총판 하위 |
| 인천 팀장1 | leader_incheon_1 | admin123 | 인천지역총판 하위 |
| 부산 팀장1 | leader_busan_1 | admin123 | 부산지역총판 하위 |

---

## 주문 채널 (다채널 주문 수신)

본사가 주문을 수신하는 외부 발송처. 각 채널에 API 연동 설정이 가능합니다.

| 우선순위 | 채널명 | 코드 | 설명 |
|:---:|---|---|---|
| 100 | **아정당** | `AJD` | 1호 채널 |
| 90 | **삼성** | `SAMSUNG` | 삼성전자 에어컨 세척 |
| 80 | **엘지** | `LG` | LG전자 에어컨 세척 |
| 70 | **캐리어** | `CARRIER` | 캐리어 에어컨 세척 |
| 10 | **로컬** | `LOCAL` | 자체 접수/로컬 업체 |

**API 연동 기능**: 채널별 엔드포인트 설정, 인증(API Key/Bearer/Basic/Custom), 필드 매핑, 연결 테스트, 동기화 실행

---

## 핵심 비즈니스 흐름
```
주문 수신(채널) → 유효성검증 → 행정동 기반 자동배분(총판) → 팀장 배정
→ 준비완료 → 작업 수행(에어컨 세척) → 보고서 제출(체크리스트+사진첨부)
→ 최종완료(영수증 첨부) → 지역 1차 검수 → HQ 2차 검수
→ 정산 산출/확정 → 대사(정합성 검증) → 정산 완료
```

---

## 페이지별 기능

| 페이지 | 주요 기능 |
|--------|-----------|
| 대시보드 | 요약 카드, 퍼널, 지역 통계, Chart.js 실시간 차트, 지역별 히트맵(SVG) |
| 주문관리 | CRUD, 필터, 드로어 상세, 배치 액션, 일괄/개별 배분, CSV/xlsx, 실주소 검색 |
| 주문채널 | 다채널 등록/수정, **API 연동 설정**(엔드포인트/인증/필드매핑/동기화), 채널별 통계 |
| 칸반 | 드래그 배정, 다중선택, 배치배정/해제, READY_DONE 카드 |
| 검수 | 지역1차/HQ2차, 배치 승인/반려, 코멘트, 스와이프 제스처 |
| 정산 | Run 생성/산출/확정, 딜러 수수료 자동분배, 팀장별 인보이스, 인쇄, CSV/xlsx |
| 대사 | 자동 정합성 검증, 이슈 관리 |
| 통계 | 지역별/팀장별 일별, CSV 내보내기, 정책관리 CRUD |
| 인사관리 | 사용자/조직/수수료/행정구역/총판/온보딩 |
| 팀장가입 | 5단계 위자드 (OTP→정보→지역→확인→완료), 이메일 필수 |
| 알림 | 벨 드롭다운, 전체 목록, 설정(유형/수단별 on/off), Resend 이메일 발송 |
| 감사로그 | 목록, 통계 4패널, 상세 |
| 시스템관리 | 시스템 정보, 세션관리, DB현황, 임포트/백업/복원, 글로벌 검색(Cmd+K) |
| 내주문 | 팀장 전용, 보고서 사진첨부, 영수증 카메라첨부, 프로필/알림설정 |
| 대리점 | 대리점장 전용 대시보드/주문관리/소속 팀장/정산 내역서 |

---

## RBAC 역할 체계

| 코드 | 한글명 | 범위 | 주요 권한 |
|------|--------|------|-----------|
| SUPER_ADMIN | 총괄관리자 | 전체 | 모든 기능, 시스템 설정 |
| HQ_OPERATOR | HQ운영자 | 본사 | 주문/배분/HQ검수/정산/대사/통계/인사/채널관리 |
| REGION_ADMIN | 파트장(총판) | 자기 총판 | 칸반배정/1차검수/팀장관리/통계/대리점관리 |
| AGENCY_LEADER | 대리점장 | 하위 팀장 | 배정/1차검수/팀장관리/내주문 |
| TEAM_LEADER | 팀장 | 자기 주문 | 작업시작/보고서제출/내 현황 |
| AUDITOR | 감사 | 전체(읽기) | 대사/통계/이력 조회 |

---

## API 엔드포인트 요약

총 **~120개** API 엔드포인트. 상세 맵은 `ARCHITECTURE.md` 참조.

| 도메인 | 경로 프리픽스 | 주요 기능 |
|--------|-------------|-----------|
| 인증 | /api/auth | 로그인, 로그아웃, 세션, 조직/팀장 조회 |
| 주문 | /api/orders | CRUD, 자동/수동/일괄배분, 배정, 보고서, 사진업로드, 검수 |
| 정산 | /api/settlements | Run 관리, 산출, 확정, 인보이스, 보고서, CSV, 이메일 발송 |
| 대사 | /api/reconciliation | 대사 실행, 이슈 관리 |
| HR | /api/hr | 사용자, 조직, 수수료, 행정구역, 총판 |
| 채널 | /api/hr/channels | 채널 CRUD, **API 연동 설정**, 연결 테스트, 동기화 실행, 삭제 |
| 대리점 | /api/hr/agencies | 대리점 관리, 팀장 배정/해제, 온보딩 |
| 가입 | /api/signup | OTP, 신청, 승인/반려 |
| 통계 | /api/stats | 대시보드, 리포트, 정책 CRUD, 매출추이, 정산현황 |
| 알림 | /api/notifications | CRUD, 미읽음 수, 설정 조회/수정 |
| 감사 | /api/audit | 로그 목록, 통계, 상세 |
| 시스템 | /api/system | 시스템정보, 세션관리, 검색, 주소검색, 행정구역조회 |

---

## 데이터 아키텍처

- **Cloudflare D1**: SQLite 기반 (order_channels에 API 연동 필드 16개 포함)
- **마이그레이션**: 15개 (0001~0015, 최신: 0015_photo_category_expand.sql)
- **State Machine**: 15단계 주문 상태 전이
- **Scope Engine v7.0**: 역할별 데이터 가시성 (HQ → 총판 → 대리점 → 팀)
- **Batch Builder**: D1 batch() 활용 원자적 트랜잭션
- **Service Layer**: 5개 서비스 (notification/session/hr/order-lifecycle/stats)
- **KV Cache**: 세션 검증 캐시 (TTL 24h, D1 쿼리 0회 달성)
- **Resend**: 이메일 발송 서비스 (정산서, 알림)

---

## 구현 Phase 이력

| Phase | 이름 | 상태 | 주요 내용 |
|-------|------|------|-----------|
| 0~5 | 초기~배포 | ✅ | Hono+D1, CRUD, 엔진, UI, 칸반, CF배포 |
| 6~6.5 | 인터랙션+서비스분리 | ✅ | 드로어/팝오버/컨텍스트메뉴, 5개 서비스 레이어 |
| 7.0~7.1 | 다채널+대리점+배분 | ✅ | 주문채널, AGENCY_LEADER, 수동/일괄 배분 |
| 8.0~9.0 | 시각화+모바일 | ✅ | Chart.js, CSV, 바텀네비, 스와이프 |
| 10~12 | 성능+정산+온보딩 | ✅ | DB인덱스, 알림설정, 정산보고서, 대리점온보딩, xlsx |
| 13~14 | 시스템관리+보안+푸시 | ✅ | 계정잠금, Cmd+K검색, 타임라인, Service Worker |
| 15~16 | 상태전이+정책+E2E | ✅ | READY_DONE/DONE, 정책CRUD, E2E 50/50 |
| 17.0~17.1 | 실주소검색+사진첨부 | ✅ | 카카오우편번호, 카메라촬영, Base64 저장 |
| 18.0~18.1 | KV세션+역할대시보드 | ✅ | SESSION_CACHE KV, 역할별 대시보드 |
| **D-1** | **이메일 필수+Resend** | **✅** | 가입 이메일 필수, Resend 이메일 발송 인프라 |
| **D-3** | **Tailwind PostCSS** | **✅** | CDN → PostCSS 빌드 전환 |
| **D-4** | **SVG 히트맵** | **✅** | 지역별 히트맵 SVG 시각화 |
| **D-5** | **딜러 수수료+인보이스** | **✅** | 수수료 자동분배, 팀장별 인보이스, 일괄인쇄 |
| **D-6** | **채널 API 연동** | **✅** | 채널별 API 설정/테스트/동기화, 필드매핑, 브랜드별 채널 |
| **R1** | **주문 CRUD 완성** | **✅** | 수정/삭제 API, 편집모달, 전화번호 검증, 주소변경 |
| **R2** | **팀장 수행 흐름 E2E** | **✅** | E2E 28/28 100% 통과, 보고서별 사진 구조 개선, 반려→재보고 |
| **R3** | **정책UI 모듈분리** | **✅** | statistics.js(78KB) → 7개 모듈(9.8~20.1KB) 분리 |
| **QA-1** | **실사용자 관점 검수** | **✅** | API 5건 수정, 전체 흐름/권한/연결성 검증 완료 |

---

## QA 검수 결과 (QA-1, 2026-03-06)

### 점검 범위
| 영역 | 검수 항목 | 결과 |
|------|-----------|------|
| **API 연결성** | 프론트엔드 66개 API 호출 ↔ 백엔드 라우트 일치 여부 | ✅ 전체 일치 |
| **주문 흐름** | 생성→배분→배정→수행→보고→검수→정산→확정 (15단계 FSM) | ✅ 정상 |
| **권한 제어** | 6개 역할(SA/HQ/RA/AL/TL/AU) × 5개 기능 영역 | ✅ 정상 |
| **Scope Engine** | REGION_ADMIN(자기 지역만), TEAM_LEADER(자기 주문만), AGENCY_LEADER(+하위 팀장) | ✅ 격리 정상 |
| **설정값 반영** | 수수료 정책→정산 산출, 배분 정책→주문 배분, 검수 정책→보고서 | ✅ 반영 확인 |
| **CRUD 흐름** | 주문/사용자/채널/정책 생성→수정→삭제→상태변경 | ✅ 정상 |
| **대시보드 숫자** | 카드 숫자 ↔ 실제 DB 건수 일치, 카드 클릭 → 해당 페이지 이동 | ✅ 정확 |

### 발견 및 수정된 문제 (P1~P5)
| # | 문제 | 원인 | 수정 |
|---|------|------|------|
| P1 | Impact API 3건 500 Error | `o.payable_amount`, `o.distributed_at`, `o.org_id` 칼럼 부재 | `base_amount`, JOIN, subquery로 교체 |
| P2 | 지표정책 UI 빈 화면 | 프론트엔드가 `name/metrics_json` 참조, DB에 미존재 | 실제 스키마(`completion_basis/region_intake_basis`)에 맞게 UI 재작성 |
| P3 | 영역 검색 필드 불일치 | `admin_code` vs `admin_dong_code` | 프론트엔드 필드명 일원화 |
| P4 | 시군구 API 응답 불일치 | `sigungu_stats` vs `sigungu_list`, `unmapped` 필드 누락 | 양방향 호환 처리 |
| P5 | 수수료 Impact 팀장 수 에러 | `users.role` 참조, 실제는 `user_roles` + `roles` 테이블 | JOIN 수정 |

### 잔여 리스크
- **배분 정책 비활성**: 자동 배분(`POST /orders/distribute`)은 활성 정책이 있어야 동작. 현재 시드 정책은 `is_active=0`
- **정산 Run 중복 방지**: 동일 기간 중복 생성에 대한 백엔드 검증은 있으나, UI에서 경고 없음
- **Push 알림**: Service Worker 등록됨, 실제 Push 발송은 Cloudflare 환경 제약으로 미확인

---

## 배포 정보
- **플랫폼**: Cloudflare Pages + D1 + KV
- **상태**: ✅ Active
- **프로덕션**: https://dahada-oms.pages.dev
- **Cloudflare 프로젝트명**: dahada-oms
- **D1 ID**: 0b7aedd5-7510-44d3-8b81-d421b03fffa6
- **KV ID**: 5024085768aa47ba943e4e65a454795e (SESSION_CACHE)
- **빌드 크기**: ~296 KB (dist/_worker.js)
- **코드량**: Backend 49 TS (~11,100줄) + Frontend 27 JS (~15,000줄) + 18 SQL migrations + CSS/SW
- **E2E 테스트**: 28/28 PASS (100%) — 정상플로우, 반려재보고, 권한체크, 목록필터, 상세조회
- **프론트엔드 최적화**: 지연 로딩 (코어 ~120KB 즉시 + 페이지별 동적 로드)
- **최종 업데이트**: 2026-03-06

## 로컬 개발
```bash
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000/api/health

# E2E 테스트
bash tests/e2e.sh

# DB 초기화
npx wrangler d1 migrations apply dahada-production --local
npx wrangler d1 execute dahada-production --local --file=./seed.sql
```
