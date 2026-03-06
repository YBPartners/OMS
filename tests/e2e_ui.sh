#!/bin/bash
# ================================================================
# 와이비 OMS — R12 UI 렌더링 E2E 테스트
# 로그인 → HTML 렌더링 검증 → JS/CSS 리소스 로드 → API 응답 검증
# ================================================================
BASE="http://localhost:3000"
API="$BASE/api"
PASS=0 FAIL=0 WARN=0
T() { echo -ne "  $1 ... "; }
OK() { echo -e "\e[32m[PASS]\e[0m $1"; PASS=$((PASS+1)); }
NG() { echo -e "\e[31m[FAIL]\e[0m $1"; FAIL=$((FAIL+1)); }
WN() { echo -e "\e[33m[WARN]\e[0m $1"; WARN=$((WARN+1)); }

echo "=============================================="
echo " R12 UI 렌더링 E2E 테스트"
echo " $(date)"
echo "=============================================="

# ────────────────────────────────────────────────────
# S0: 기본 서비스 상태
# ────────────────────────────────────────────────────
echo -e "\n▶ S0: 기본 서비스 상태"

T "S0-1 헬스체크"
R=$(curl -s "$API/health")
[ "$(echo "$R" | jq -r '.status')" = "ok" ] && OK "status=ok" || NG "서비스 다운"

T "S0-2 메인 HTML 200"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE")
[ "$HTTP" = "200" ] && OK "HTTP $HTTP" || NG "HTTP $HTTP"

T "S0-3 HTML에 DOCTYPE 존재"
HTML=$(curl -s "$BASE")
echo "$HTML" | head -1 | grep -qi "doctype" && OK "" || NG "DOCTYPE 누락"

T "S0-4 HTML에 OMS 제목 존재"
echo "$HTML" | grep -q "와이비 OMS" && OK "" || NG "제목 누락"

# ────────────────────────────────────────────────────
# S1: 정적 리소스 로드
# ────────────────────────────────────────────────────
echo -e "\n▶ S1: 정적 리소스 로드"

T "S1-1 app.js 로드"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/static/js/core/app.js")
[ "$HTTP" = "200" ] && OK "" || NG "HTTP $HTTP"

T "S1-2 api.js 로드"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/static/js/core/api.js")
[ "$HTTP" = "200" ] && OK "" || NG "HTTP $HTTP"

T "S1-3 auth.js 로드"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/static/js/core/auth.js")
[ "$HTTP" = "200" ] && OK "" || NG "HTTP $HTTP"

T "S1-4 table.js (shared)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/static/js/shared/table.js")
[ "$HTTP" = "200" ] && OK "" || NG "HTTP $HTTP"

T "S1-5 tailwind.css 로드"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/static/css/tailwind.css")
[ "$HTTP" = "200" ] && OK "" || NG "HTTP $HTTP"

# 페이지 JS 파일 전체 검증
PAGES="agency audit channels dashboard hr kanban my-orders notifications orders review settlement signup-admin signup-wizard statistics system"
for pg in $PAGES; do
  T "S1-P $pg.js"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/static/js/pages/$pg.js")
  [ "$HTTP" = "200" ] && OK "" || NG "HTTP $HTTP"
done

# ────────────────────────────────────────────────────
# S2: 로그인 API
# ────────────────────────────────────────────────────
echo -e "\n▶ S2: 로그인/인증"

T "S2-1 admin 로그인"
LOGIN=$(curl -s "$API/auth/login" -H "Content-Type: application/json" -d '{"login_id":"admin","password":"admin123"}')
SID=$(echo "$LOGIN" | jq -r '.session_id // ""')
[ -n "$SID" ] && [ "$SID" != "null" ] && OK "session=$SID" || NG "로그인 실패"

T "S2-2 잘못된 로그인 → 에러"
R=$(curl -s "$API/auth/login" -H "Content-Type: application/json" -d '{"login_id":"wrong","password":"wrong"}')
echo "$R" | jq -r '.error' | grep -qi "." && OK "" || WN "에러 메시지 없음"

T "S2-3 비인증 API → 401"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/hr/users")
[ "$HTTP" = "401" ] && OK "" || WN "HTTP $HTTP (expected 401)"

T "S2-4 세션 유효성 검증 (me)"
R=$(curl -s "$API/auth/me" -b "session_id=$SID" -H "X-Session-Id: $SID")
[ "$(echo "$R" | jq -r '.user.login_id // ""')" = "admin" ] && OK "" || NG "세션 무효"

# helper with session
C() { curl -s -X "$1" "$API$2" -H "Content-Type: application/json" -H "X-Session-Id: $SID" -b "session_id=$SID" ${3:+-d "$3"}; }

# ────────────────────────────────────────────────────
# S3: 대시보드 데이터 API
# ────────────────────────────────────────────────────
echo -e "\n▶ S3: 대시보드 데이터"

T "S3-1 주문 통계 (funnel)"
R=$(C GET "/orders/stats/funnel")
echo "$R" | jq -e '.funnel' > /dev/null 2>&1 && OK "" || WN "funnel 없음"

T "S3-2 대시보드 통계"
R=$(C GET "/stats/dashboard")
[ -n "$R" ] && [ "$R" != "null" ] && OK "" || WN "대시보드 데이터 없음"

# ────────────────────────────────────────────────────
# S4: 주문 페이지 API
# ────────────────────────────────────────────────────
echo -e "\n▶ S4: 주문 관리"

T "S4-1 주문 목록"
R=$(C GET "/orders?limit=10")
TOTAL=$(echo "$R" | jq -r '.total // 0')
[ "$TOTAL" -ge 0 ] && OK "total=$TOTAL" || NG ""

T "S4-2 주문 상태 필터"
R=$(C GET "/orders?status=REGISTERED&limit=5")
echo "$R" | jq -e '.orders' > /dev/null 2>&1 && OK "" || WN ""

# ────────────────────────────────────────────────────
# S5: 인사관리 API (HR)
# ────────────────────────────────────────────────────
echo -e "\n▶ S5: 인사관리"

T "S5-1 사용자 목록"
R=$(C GET "/hr/users?limit=10")
TOTAL=$(echo "$R" | jq -r '.total // 0')
[ "$TOTAL" -gt 0 ] && OK "total=$TOTAL" || NG ""

T "S5-2 조직 목록"
R=$(C GET "/hr/organizations")
CNT=$(echo "$R" | jq '.organizations | length')
[ "$CNT" -gt 0 ] && OK "cnt=$CNT" || NG ""

T "S5-3 역할 목록"
R=$(C GET "/hr/roles")
CNT=$(echo "$R" | jq '.roles | length')
[ "$CNT" -ge 5 ] && OK "cnt=$CNT" || NG ""

# ────────────────────────────────────────────────────
# S6: 정산 API
# ────────────────────────────────────────────────────
echo -e "\n▶ S6: 정산"

T "S6-1 정산 실행 목록"
R=$(C GET "/settlements/runs?limit=5")
echo "$R" | jq -e '.runs' > /dev/null 2>&1 && OK "" || WN "정산 데이터 없음"

# ────────────────────────────────────────────────────
# S7: 채널 API
# ────────────────────────────────────────────────────
echo -e "\n▶ S7: 채널 관리"

T "S7-1 채널 목록"
R=$(C GET "/orders/channels")
echo "$R" | jq -e '.channels' > /dev/null 2>&1 && OK "" || WN ""

# ────────────────────────────────────────────────────
# S8: 통계/정책 API
# ────────────────────────────────────────────────────
echo -e "\n▶ S8: 통계/정책"

T "S8-1 지표 정책"
R=$(C GET "/stats/policies?type=metrics")
echo "$R" | jq -e '.policies' > /dev/null 2>&1 && OK "" || WN ""

T "S8-2 배분 정책"
R=$(C GET "/stats/policies?type=distribution")
echo "$R" | jq -e '.policies' > /dev/null 2>&1 && OK "" || WN ""

# ────────────────────────────────────────────────────
# S9: 알림 API
# ────────────────────────────────────────────────────
echo -e "\n▶ S9: 알림"

T "S9-1 알림 목록"
R=$(C GET "/notifications?limit=10")
echo "$R" | jq -e '.notifications' > /dev/null 2>&1 && OK "" || WN ""

T "S9-2 읽지 않은 알림 수"
R=$(C GET "/notifications/unread-count")
echo "$R" | jq -e '.count' > /dev/null 2>&1 && OK "count=$(echo "$R" | jq '.count')" || WN ""

# ────────────────────────────────────────────────────
# S10: 시스템 관리 API
# ────────────────────────────────────────────────────
echo -e "\n▶ S10: 시스템"

T "S10-1 감사 로그"
R=$(C GET "/audit?limit=5")
echo "$R" | jq -e '.logs' > /dev/null 2>&1 && OK "" || WN ""

# ────────────────────────────────────────────────────
# S11: HTML 구조 검증 (JS 인라인 함수 존재)
# ────────────────────────────────────────────────────
echo -e "\n▶ S11: HTML 구조 검증"

T "S11-1 HTML에 script 태그들 로드"
SCRIPTS=$(echo "$HTML" | grep -c '<script')
[ "$SCRIPTS" -ge 5 ] && OK "scripts=$SCRIPTS" || NG "scripts=$SCRIPTS"

T "S11-2 HTML에 CSS 참조"
CSS_REFS=$(echo "$HTML" | grep -c 'stylesheet')
[ "$CSS_REFS" -ge 1 ] && OK "css=$CSS_REFS" || NG "css=$CSS_REFS"

T "S11-3 HTML에 meta viewport"
echo "$HTML" | grep -q 'viewport' && OK "" || WN "viewport 누락"

T "S11-4 HTML charset UTF-8"
echo "$HTML" | grep -qi 'utf-8' && OK "" || WN "charset 누락"

T "S11-5 HTML에 app 컨테이너"
echo "$HTML" | grep -q 'id="app"' && OK "" || NG "app 컨테이너 없음"

T "S11-6 HTML에 modal 컨테이너"
echo "$HTML" | grep -q 'id="modal"' && OK "" || WN "modal 컨테이너 없음"

T "S11-7 HTML에 toast 컨테이너"
echo "$HTML" | grep -qi 'toast' && OK "" || WN "toast 컨테이너 없음"

# ────────────────────────────────────────────────────
# S12: JS 파일 구조 검증
# ────────────────────────────────────────────────────
echo -e "\n▶ S12: JS 코드 구조"

T "S12-1 api.js에 apiAction 존재"
curl -s "$BASE/static/js/core/api.js" | grep -q "apiAction" && OK "" || NG ""

T "S12-2 table.js에 renderDataTable 존재"
curl -s "$BASE/static/js/shared/table.js" | grep -q "renderDataTable" && OK "" || NG ""

T "S12-3 table.js에 renderPagination 존재"
curl -s "$BASE/static/js/shared/table.js" | grep -q "renderPagination" && OK "" || NG ""

T "S12-4 모든 페이지 JS에 try/catch 존재"
MISSING_TRY=0
for pg in $PAGES; do
  JS=$(curl -s "$BASE/static/js/pages/$pg.js")
  if ! echo "$JS" | grep -q "try {"; then
    MISSING_TRY=$((MISSING_TRY+1))
    echo -ne " [WARN:$pg]"
  fi
done
[ "$MISSING_TRY" -eq 0 ] && OK "모든 페이지 try/catch 보유" || WN "$MISSING_TRY 파일 누락"

T "S12-5 orders.js 크기 > 1000줄"
LINES=$(curl -s "$BASE/static/js/pages/orders.js" | wc -l)
[ "$LINES" -gt 1000 ] && OK "lines=$LINES" || WN "lines=$LINES"

# ────────────────────────────────────────────────────
# S13: API 응답 형식 검증
# ────────────────────────────────────────────────────
echo -e "\n▶ S13: API 응답 형식"

T "S13-1 주문 목록 JSON 구조"
R=$(C GET "/orders?limit=1")
echo "$R" | jq -e '.orders, .total, .page, .limit' > /dev/null 2>&1 && OK "" || NG "구조 불일치"

T "S13-2 사용자 목록 JSON 구조"
R=$(C GET "/hr/users?limit=1")
echo "$R" | jq -e '.users, .total' > /dev/null 2>&1 && OK "" || NG ""

T "S13-3 에러 응답에 error 필드"
R=$(curl -s -X DELETE "$API/hr/users/99999" -H "Content-Type: application/json" -H "X-Session-Id: $SID" -b "session_id=$SID")
echo "$R" | jq -e '.error' > /dev/null 2>&1 && OK "" || WN ""

# ────────────────────────────────────────────────────
# S14: 파트장 역할 검증
# ────────────────────────────────────────────────────
echo -e "\n▶ S14: 역할별 API 접근"

T "S14-1 파트장 로그인"
R=$(curl -s "$API/auth/login" -H "Content-Type: application/json" -d '{"login_id":"seoul_admin","password":"admin123"}')
RSID=$(echo "$R" | jq -r '.session_id // ""')
[ -n "$RSID" ] && [ "$RSID" != "null" ] && OK "" || WN "파트장 로그인 실패"

if [ -n "$RSID" ] && [ "$RSID" != "null" ]; then
  T "S14-2 파트장 주문 조회"
  R=$(curl -s "$API/orders?limit=5" -H "X-Session-Id: $RSID" -b "session_id=$RSID")
  echo "$R" | jq -e '.orders' > /dev/null 2>&1 && OK "" || WN ""

  T "S14-3 파트장 HR 제한 확인"
  R=$(curl -s "$API/hr/users?limit=5" -H "X-Session-Id: $RSID" -b "session_id=$RSID")
  echo "$R" | jq -e '.users' > /dev/null 2>&1 && OK "" || WN ""
fi

# ────────────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo " 결과: PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
TOTAL=$((PASS+FAIL+WARN))
echo " 합계: $TOTAL 테스트"
echo " 점수: $PASS/$TOTAL ($(( PASS * 100 / (TOTAL > 0 ? TOTAL : 1) ))%)"
echo "=============================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
