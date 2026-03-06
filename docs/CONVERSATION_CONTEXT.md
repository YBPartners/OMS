# Airflow OMS — 대화 이어가기 컨텍스트 (Conversation Context)

> **최종 업데이트**: 2026-03-06
> **이 문서는 대화창을 클리어하고 새 대화를 시작할 때 컨텍스트 복구용입니다.**
> **새 대화에서 반드시 이 파일을 먼저 읽어주세요.**

---

## 🔑 새 대화 시작 시 필수 읽기 순서

```bash
# 1. 이 파일 먼저 읽기 (직전 대화 컨텍스트)
cat /home/user/webapp/docs/CONVERSATION_CONTEXT.md

# 2. 시스템 아키텍처 (전체 구조 이해)
cat /home/user/webapp/ARCHITECTURE.md

# 3. 진행 상태 확인
cat /home/user/webapp/PROGRESS.md

# 4. 세부 체크리스트
cat /home/user/webapp/docs/IMPLEMENTATION_TRACKER.md

# 5. 현재 서비스 상태 확인
cd /home/user/webapp && git log --oneline -5
pm2 list
curl http://localhost:3000/api/health
```

---

## 📌 프로젝트 핵심 정보

- **프로젝트**: Airflow OMS (에어컨 세척 주문관리시스템)
- **버전**: v19.0.0
- **프로덕션**: https://dahada-oms.pages.dev
- **GitHub**: https://github.com/YBPartners/OMS
- **기술 스택**: Hono v4 + TypeScript + Cloudflare Workers + D1 + KV + TailwindCSS(PostCSS)
- **프로젝트 경로**: `/home/user/webapp/`
- **빌드**: `npm run build` → `dist/_worker.js` (~252KB)
- **서비스 시작**: `pm2 start ecosystem.config.cjs` (port 3000)
- **DB**: Cloudflare D1 (dahada-production, ID: 0b7aedd5-7510-44d3-8b81-d421b03fffa6)
- **KV**: SESSION_CACHE (ID: 5024085768aa47ba943e4e65a454795e)
- **코드량**: 24,536줄 (48 TS + 23 JS + 13 SQL + CSS/SW/E2E)

---

## 🏢 비즈니스 도메인

**에어컨 세척 주문 관리 흐름**:
```
외부 채널(삼성/엘지/캐리어/아정당/로컬) → Airflow 본사(HQ) → 지역총판(서울/경기/인천/부산) → 대리점 → 팀장
```

**조직 계층**: 원청(채널) → HQ → 총판(4개) → 대리점(AGENCY) → 팀장(TEAM)

**주문 채널** (=주문 발송처, 본사가 주문을 수신하는 처):
| 우선순위 | 채널명 | 코드 | 설명 |
|:---:|---|---|---|
| 100 | 아정당 | AJD | 1호 채널 |
| 90 | 삼성 | SAMSUNG | 삼성전자 에어컨 세척 |
| 80 | 엘지 | LG | LG전자 에어컨 세척 |
| 70 | 캐리어 | CARRIER | 캐리어 에어컨 세척 |
| 10 | 로컬 | LOCAL | 자체 접수/로컬 업체 |

**용어 주의**: "법인" 대신 반드시 **"총판"** 사용 (2026-03-06 전체 치환 완료)

---

## 📋 직전 대화에서 완료한 작업

### 1. 검수 모달 승인/반려 버튼 이벤트 버그 수정
- HQ 2차 검수 우클릭 → 최종승인(코멘트) 이슈 디버깅
- 이벤트 리스너 충돌 해결 (컨텍스트 메뉴 닫기 리스너가 모달 클릭을 가로채는 문제)
- 커밋: 0ed78cc

### 2. 주문 채널 API 연동 기능 구현 (Phase D-6)
- DB 마이그레이션 0013: order_channels에 16개 API 연동 필드 추가
- 백엔드: 채널 상세/테스트/동기화/삭제 엔드포인트 추가
- 프론트엔드: channels.js 전면 재작성 (탭 UI, 필드매핑, 테스트/동기화)
- 인증 방식: NONE, API_KEY, BEARER, BASIC, CUSTOM_HEADER
- 커밋: 50b036c

### 3. 채널명 에어컨 세척 브랜드별 변경
- 기존 테스트 채널(DEFAULT/KT/LGU/SK) → 로컬/삼성/엘지/캐리어로 변경
- 모든 5개 채널 활성화
- 커밋: 1996aca

### 4. "법인" → "총판" 전체 치환
- 24개 파일, 158건 일괄 치환
- DB 조직명도 변경 (서울/경기/인천/부산 지역법인 → 지역총판)
- 전체 프로젝트에서 "법인" 0건 확인
- 커밋: 604dd84

---

## ⏭️ 사용자가 언급한 다음 작업

**"큰 작업 하나 해야해"** — 사용자가 다음 대화에서 큰 작업을 시작할 예정이라고 언급.
구체적인 내용은 아직 공유되지 않음. 새 대화에서 확인 필요.

---

## 🔧 최근 기술적 이슈/결정

1. **채널 = 주문 발송처**: 채널은 API 연동이든 어떤 형태든 최초 주문을 전달하는 외부 발송처
2. **API 연동 필드 설계**: 채널별로 endpoint/auth/field_mapping/polling 설정 가능
3. **동기화 로직**: 외부 API → 필드 매핑 → fingerprint 중복 체크 → 자동 주문 생성
4. **Resend 이메일**: 정산서/알림 이메일 발송 인프라 완성
5. **PostCSS Tailwind**: CDN → PostCSS 빌드로 전환 완료

---

## 🧪 테스트 계정 (빠른 참조)

| 역할 | 아이디 | 비밀번호 |
|------|--------|----------|
| 총괄관리자 | admin | admin123 |
| HQ 운영자 | hq_operator | admin123 |
| 서울 총판 | seoul_admin | admin123 |
| 경기 총판 | gyeonggi_admin | admin123 |
| 팀장 (서울) | leader_seoul_1 | admin123 |

---

## 📁 주요 파일 경로 (빠른 참조)

```
/home/user/webapp/
├── src/index.tsx                      # Hono 앱 진입점
├── src/routes/hr/channels-agency.ts   # 채널 API 연동 + 대리점 API
├── src/services/session-service.ts    # 세션 + KV 캐시
├── public/static/js/pages/channels.js # 채널 관리 UI (API 설정)
├── migrations/0013_channel_api_integration.sql  # 최신 마이그레이션
├── wrangler.jsonc                     # Cloudflare 설정 (D1 + KV)
├── ecosystem.config.cjs               # PM2 설정
├── ARCHITECTURE.md                    # 시스템 아키텍처
├── PROGRESS.md                        # 개발 진척도
└── docs/IMPLEMENTATION_TRACKER.md     # 구현 추적
```

---

## 🚀 빠른 서비스 시작 명령

```bash
# 빌드 + 시작
cd /home/user/webapp && npm run build
fuser -k 3000/tcp 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs

# 테스트
curl http://localhost:3000/api/health
# 결과: {"status":"ok","version":"16.0.0","system":"Airflow OMS"}

# 로그인
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login_id":"admin","password":"admin123"}'

# DB 쿼리 예시
npx wrangler d1 execute dahada-production --local --command="SELECT * FROM order_channels ORDER BY priority DESC;"
```
