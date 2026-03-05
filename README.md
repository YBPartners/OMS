# 다하다 OMS - 주문관리시스템 v6.0.0

## 프로젝트 개요
- **명칭**: 다하다 OMS (Order Management System)
- **목적**: 원청(아정당) → 다하다(HQ) → 총판(4개) → 팀 구조의 주문 처리/배분/검수/정산/대사/통계 통합 시스템
- **설계 원칙**: 고품질 · 자동화 · 정합성 · 보안 우선 · 기능별 분리 설계
- **기술 스택**: Hono + TypeScript + Cloudflare Workers + D1 (SQLite) + TailwindCSS + Vanilla JS

## URLs
- **프로덕션**: https://dahada-oms.pages.dev
- **샌드박스**: https://3000-inedg4lr7hnug2y22i9nx-5185f4aa.sandbox.novita.ai

## 관련 문서 (새 대화에서 이어가기)
> **⚠️ 새 대화를 시작할 때 반드시 아래 파일들을 순서대로 읽으세요:**
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

## 주요 기능 요약

### 핵심 비즈니스 흐름
```
주문 수신 → 유효성검증 → 행정동 기반 자동배분 → 팀장 배정
→ 작업 수행 → 보고서 제출 → 지역 1차 검수 → HQ 2차 검수
→ 정산 산출/확정 → 대사(정합성 검증) → 정산 완료
```

### 페이지별 기능
| 페이지 | 주요 기능 |
|--------|-----------|
| 대시보드 | 요약 카드, 퍼널, 최근 주문, 지역 통계 |
| 주문관리 | CRUD, 필터, 드로어 상세, 배치 액션 |
| 자동배분 | 행정동 기반 자동매칭, 수동배분 |
| 칸반 | 드래그 배정, 다중선택, 배치배정/해제 |
| 검수 | 지역1차/HQ2차, 배치 승인/반려 |
| 정산 | Run 생성, 산출, 확정, 상세 |
| 대사 | 자동 정합성 검증, 이슈 관리 |
| 통계 | 지역별/팀장별 일별, CSV 내보내기 |
| 인사관리 | 사용자/조직/수수료/행정구역/총판 |
| 팀장가입 | 5단계 위자드 (OTP→정보→지역→확인→완료) |
| 가입관리 | 신청 승인/반려, 추가지역 |
| 알림 | 벨 드롭다운, 전체 목록, 폴링 |
| 감사로그 | 목록, 통계 4패널, 상세 |
| 내주문 | 팀장 전용, 보고서 제출 |

## API 엔드포인트 요약

총 **60+개** API 엔드포인트. 상세 맵은 `ARCHITECTURE.md` 참조.

| 도메인 | 경로 프리픽스 | 주요 기능 |
|--------|-------------|-----------|
| 인증 | /api/auth | 로그인, 로그아웃, 세션, 조직/팀장 조회 |
| 주문 | /api/orders | CRUD, 배분, 배정, 보고서, 검수 |
| 정산 | /api/settlements | Run 관리, 산출, 확정 |
| 대사 | /api/reconciliation | 대사 실행, 이슈 관리 |
| HR | /api/hr | 사용자, 조직, 수수료, 행정구역, 총판 |
| 가입 | /api/signup | OTP, 신청, 승인/반려 |
| 통계 | /api/stats | 대시보드, 리포트, 정책 |
| 알림 | /api/notifications | CRUD, 미읽음 수, 전체 읽음 |
| 감사 | /api/audit | 로그 목록, 통계, 상세 |

## 데이터 아키텍처
- **Cloudflare D1**: SQLite 기반 **36개 테이블**
- **State Machine**: 13단계 주문 상태 전이
- **Scope Engine**: 역할별 데이터 가시성 (HQ → REGION → TEAM)
- **Batch Builder**: D1 batch()를 활용한 원자적 트랜잭션

## 배포 정보
- **플랫폼**: Cloudflare Pages + D1
- **상태**: ✅ Active
- **D1 ID**: 0b7aedd5-7510-44d3-8b81-d421b03fffa6
- **버전**: v6.0.0
- **최종 업데이트**: 2026-03-05

## 로컬 개발
```bash
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs
curl http://localhost:3000/api/health
# DB가 비어있으면:
npx wrangler d1 execute dahada-production --local --file=./seed.sql
```
