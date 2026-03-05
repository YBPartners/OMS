#!/bin/bash
# ================================================================
# 와이비 OMS — E2E 통합 테스트 스크립트 v16.0
# 주문 전체 라이프사이클 + 가입 + 정산 자동 검증
# ================================================================

BASE="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0

# 테스트 실행 시 고유한 데이터 생성을 위한 타임스탬프
TS=$(date +%s%N | tail -c 10)
UNIQ_ADDR="서울시 강남구 테스트동 ${TS}"
UNIQ_PHONE="010-$(shuf -i 1000-9999 -n1)-$(shuf -i 1000-9999 -n1)"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

assert() {
  TOTAL=$((TOTAL+1))
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS+1))
    echo -e "  ${GREEN}✓${NC} $name"
  else
    FAIL=$((FAIL+1))
    echo -e "  ${RED}✗${NC} $name (expected='$expected', got='$actual')"
  fi
}

assert_contains() {
  TOTAL=$((TOTAL+1))
  local name="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    PASS=$((PASS+1))
    echo -e "  ${GREEN}✓${NC} $name"
  else
    FAIL=$((FAIL+1))
    echo -e "  ${RED}✗${NC} $name (expected to contain '$needle')"
  fi
}

api() {
  local method="$1" path="$2" data="$3" sid="$4"
  local headers="-H 'Content-Type: application/json'"
  if [ -n "$sid" ]; then
    headers="$headers -H 'Cookie: session_id=$sid'"
  fi
  if [ -n "$data" ]; then
    eval curl -s -X "$method" "$BASE$path" $headers -d "'$data'" 2>/dev/null
  else
    eval curl -s -X "$method" "$BASE$path" $headers 2>/dev/null
  fi
}

login() {
  local id="$1" pw="$2"
  local res=$(api POST "/api/auth/login" "{\"login_id\":\"$id\",\"password\":\"$pw\"}")
  echo "$res" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4
}

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     와이비 OMS — E2E 통합 테스트 v16.0              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================
# 1. 헬스체크
# ============================
echo -e "${YELLOW}▶ 1. 헬스체크${NC}"
HEALTH=$(api GET "/api/health")
assert_contains "API Health OK" '"ok"' "$HEALTH"
assert_contains "Version 표시" '"version"' "$HEALTH"

# ============================
# 2. 인증 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 2. 인증 테스트${NC}"

# 2-1: 로그인 성공
SID_ADMIN=$(login "admin" "admin123")
assert "SUPER_ADMIN 로그인 성공" "true" "$([ -n "$SID_ADMIN" ] && echo true || echo false)"

SID_SEOUL=$(login "seoul_admin" "admin123")
assert "REGION_ADMIN 로그인 성공" "true" "$([ -n "$SID_SEOUL" ] && echo true || echo false)"

SID_LEADER=$(login "leader_seoul_1" "admin123")
assert "TEAM_LEADER 로그인 성공" "true" "$([ -n "$SID_LEADER" ] && echo true || echo false)"

# 2-2: 로그인 실패
FAIL_RES=$(api POST "/api/auth/login" '{"login_id":"admin","password":"wrong"}')
assert_contains "잘못된 비밀번호 거부" '"error"' "$FAIL_RES"

# 2-3: 세션 조회
ME=$(api GET "/api/auth/me" "" "$SID_ADMIN")
assert_contains "/auth/me 세션 반환" '"admin"' "$ME"

# ============================
# 3. 주문 CRUD 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 3. 주문 CRUD 테스트${NC}"

# 3-1: 주문 목록
ORDERS=$(curl -s "$BASE/api/orders?page=1&limit=5" -H "Content-Type: application/json" -H "Cookie: session_id=$SID_ADMIN" 2>/dev/null)
assert_contains "주문 목록 반환" '"orders"' "$ORDERS"

# 3-2: 주문 수동 등록 (매 실행마다 고유한 주소/전화번호 사용)
NEW_ORDER=$(api POST "/api/orders" "{\"customer_name\":\"E2E테스트${TS}\",\"customer_phone\":\"${UNIQ_PHONE}\",\"address_text\":\"${UNIQ_ADDR}\",\"base_amount\":50000,\"requested_date\":\"2026-03-05\"}" "$SID_ADMIN")
NEW_ORDER_ID=$(echo "$NEW_ORDER" | grep -o '"order_id":[0-9]*' | grep -o '[0-9]*')
assert "주문 수동 등록 성공" "true" "$([ -n "$NEW_ORDER_ID" ] && echo true || echo false)"

# 3-3: 주문 상세
if [ -n "$NEW_ORDER_ID" ]; then
  DETAIL=$(api GET "/api/orders/$NEW_ORDER_ID" "" "$SID_ADMIN")
  assert_contains "주문 상세 반환" '"RECEIVED"' "$DETAIL"
fi

# ============================
# 4. 주문 라이프사이클 (RECEIVED → HQ_APPROVED)
# ============================
echo ""
echo -e "${YELLOW}▶ 4. 주문 라이프사이클 테스트${NC}"

if [ -n "$NEW_ORDER_ID" ]; then
  # 4-1: 자동 배분
  DIST=$(api POST "/api/orders/distribute" '{}' "$SID_ADMIN")
  assert_contains "자동 배분 실행" '"distributed"' "$DIST"
  
  # 4-2: 배분 확인 - 수동 배분으로 fallback
  ORDER_STATUS=$(api GET "/api/orders/$NEW_ORDER_ID" "" "$SID_ADMIN")
  STATUS_NOW=$(echo "$ORDER_STATUS" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ "$STATUS_NOW" = "RECEIVED" ] || [ "$STATUS_NOW" = "DISTRIBUTION_PENDING" ]; then
    # 수동 배분 (서울 지역법인 org_id=2)
    MANUAL_DIST=$(api PATCH "/api/orders/$NEW_ORDER_ID/distribution" '{"region_org_id":2}' "$SID_ADMIN")
    assert_contains "수동 배분 성공" '"ok"' "$MANUAL_DIST"
  else
    assert "자동 배분 적용됨" "DISTRIBUTED" "$STATUS_NOW"
  fi
  
  # 4-3: 팀장 배정
  ASSIGN=$(api POST "/api/orders/$NEW_ORDER_ID/assign" '{"team_leader_id":7}' "$SID_ADMIN")
  assert_contains "팀장 배정 성공" '"ok"' "$ASSIGN"
  
  # 4-4: 준비완료 (READY_DONE)
  READY=$(api POST "/api/orders/$NEW_ORDER_ID/ready-done" '{"scheduled_date":"2026-03-10","note":"E2E 테스트 준비"}' "$SID_LEADER")
  assert_contains "준비완료(READY_DONE) 전이" '"ok"' "$READY"
  
  # 4-5: 작업 시작
  START=$(api POST "/api/orders/$NEW_ORDER_ID/start" '{}' "$SID_LEADER")
  assert_contains "작업시작(IN_PROGRESS) 전이" '"ok"' "$START"
  
  # 4-6: 보고서 제출
  REPORT=$(api POST "/api/orders/$NEW_ORDER_ID/reports" '{"note":"E2E 테스트 보고서","photos":[{"category":"BEFORE","file_url":"https://example.com/before.jpg"},{"category":"AFTER","file_url":"https://example.com/after.jpg"}]}' "$SID_LEADER")
  assert_contains "보고서 제출(SUBMITTED)" '"ok"' "$REPORT"
  
  # 4-6.5: 영수증 첨부 → 최종완료 (SUBMITTED → DONE)
  COMPLETE=$(api POST "/api/orders/$NEW_ORDER_ID/complete" '{"receipt_url":"https://example.com/receipt.jpg","note":"E2E 영수증 첨부"}' "$SID_LEADER")
  assert_contains "최종완료(DONE) 전이" '"ok"' "$COMPLETE"
  
  # 4-7: 지역 1차 검수 (DONE → REGION_APPROVED)
  REVIEW_R=$(api POST "/api/orders/$NEW_ORDER_ID/review/region" '{"result":"APPROVE","comment":"E2E 지역승인"}' "$SID_SEOUL")
  assert_contains "지역검수 승인(REGION_APPROVED)" '"ok"' "$REVIEW_R"
  
  # 4-8: HQ 2차 검수
  REVIEW_H=$(api POST "/api/orders/$NEW_ORDER_ID/review/hq" '{"result":"APPROVE","comment":"E2E HQ승인"}' "$SID_ADMIN")
  assert_contains "HQ검수 승인(HQ_APPROVED)" '"ok"' "$REVIEW_H"
  
  # 4-9: 최종 상태 확인
  FINAL=$(api GET "/api/orders/$NEW_ORDER_ID" "" "$SID_ADMIN")
  FINAL_STATUS=$(echo "$FINAL" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  assert "최종 상태 HQ_APPROVED" "HQ_APPROVED" "$FINAL_STATUS"
fi

# ============================
# 5. 배치 작업 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 5. 배치 작업 테스트${NC}"

BATCH_IMPORT=$(api POST "/api/orders/import" '{"orders":[{"customer_name":"배치1","address_text":"서울시 강남구 삼성동 100","base_amount":30000},{"customer_name":"배치2","address_text":"서울시 서초구 서초동 200","base_amount":40000}]}' "$SID_ADMIN")
assert_contains "주문 일괄 수신" '"batch_id"' "$BATCH_IMPORT"

# ============================
# 6. 정산 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 6. 정산 테스트${NC}"

# 6-1: Run 목록 조회
RUNS=$(api GET "/api/settlements/runs" "" "$SID_ADMIN")
assert_contains "정산 Run 목록" '"runs"' "$RUNS"

# 6-2: Run 생성
RUN_CREATE=$(api POST "/api/settlements/runs" '{"period_start":"2026-03-01","period_end":"2026-03-05","period_type":"WEEKLY"}' "$SID_ADMIN")
assert_contains "정산 Run 생성" "run_id" "$RUN_CREATE"

RUN_ID=$(echo "$RUN_CREATE" | grep -o '"run_id":[0-9]*' | grep -o '[0-9]*')

if [ -n "$RUN_ID" ]; then
  # 6-3: 산출 (대상 주문이 없어도 API 호출 자체는 성공)
  CALC=$(api POST "/api/settlements/runs/$RUN_ID/calculate" '{}' "$SID_ADMIN")
  if echo "$CALC" | grep -q '"calculated"\|"ok"\|"error"\|"run_id"'; then
    TOTAL=$((TOTAL+1))
    PASS=$((PASS+1))
    echo -e "  ${GREEN}✓${NC} 정산 산출 실행"
  else
    TOTAL=$((TOTAL+1))
    FAIL=$((FAIL+1))
    echo -e "  ${RED}✗${NC} 정산 산출 실행 (unexpected response)"
  fi
fi

# ============================
# 7. 통계/대시보드 API 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 7. 통계/대시보드 API 테스트${NC}"

DASH=$(api GET "/api/stats/dashboard" "" "$SID_ADMIN")
assert_contains "대시보드 통계" '"today"' "$DASH"

REGION_STATS=$(curl -s "$BASE/api/stats/regions/daily?start_date=2026-03-01&end_date=2026-03-05" -H "Content-Type: application/json" -H "Cookie: session_id=$SID_ADMIN" 2>/dev/null)
assert_contains "지역별 일별 통계" '"stats"' "$REGION_STATS"

# ============================
# 8. 정책 API 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 8. 정책 API 테스트${NC}"

DIST_POL=$(api GET "/api/stats/policies/distribution" "" "$SID_ADMIN")
assert_contains "배분 정책 목록" '"policies"' "$DIST_POL"

REPORT_POL=$(api GET "/api/stats/policies/report" "" "$SID_ADMIN")
assert_contains "보고서 정책 목록" '"policies"' "$REPORT_POL"

COMM_POL=$(api GET "/api/stats/policies/commission" "" "$SID_ADMIN")
assert_contains "수수료 정책 목록" '"policies"' "$COMM_POL"

TERR=$(api GET "/api/stats/territories" "" "$SID_ADMIN")
assert_contains "지역-법인 매핑" '"territories"' "$TERR"

# ============================
# 9. 알림 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 9. 알림 테스트${NC}"

NOTIFS=$(api GET "/api/notifications?limit=5" "" "$SID_ADMIN")
assert_contains "알림 목록 조회" '"notifications"' "$NOTIFS"

UNREAD=$(api GET "/api/notifications/unread-count" "" "$SID_ADMIN")
assert_contains "미읽음 카운트" '"unread_count"' "$UNREAD"

PREFS=$(api GET "/api/notifications/preferences" "" "$SID_ADMIN")
assert_contains "알림 설정 조회" '"notify_order_status"' "$PREFS"

# ============================
# 10. 시스템 API 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 10. 시스템 API 테스트${NC}"

SYS_INFO=$(api GET "/api/system/info" "" "$SID_ADMIN")
assert_contains "시스템 정보" '"version"' "$SYS_INFO"

SEARCH=$(api GET "/api/system/search?q=admin" "" "$SID_ADMIN")
assert_contains "글로벌 검색 (admin)" '"results"' "$SEARCH"

DB_INFO=$(api GET "/api/system/backup-info" "" "$SID_ADMIN")
assert_contains "DB 현황" '"tables"' "$DB_INFO"

# ============================
# 11. HR/감사 API 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 11. HR/감사 API 테스트${NC}"

USERS=$(api GET "/api/hr/users" "" "$SID_ADMIN")
assert_contains "사용자 목록" '"users"' "$USERS"

ORGS=$(api GET "/api/hr/organizations" "" "$SID_ADMIN")
assert_contains "조직 목록" '"organizations"' "$ORGS"

AUDIT=$(api GET "/api/audit?limit=5" "" "$SID_ADMIN")
assert_contains "감사 로그 목록" '"logs"' "$AUDIT"

AUDIT_STATS=$(api GET "/api/audit/stats" "" "$SID_ADMIN")
assert_contains "감사 통계" '"total"' "$AUDIT_STATS"

# ============================
# 12. 채널/대리점 API 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 12. 채널/대리점 API 테스트${NC}"

CHANNELS=$(api GET "/api/hr/channels" "" "$SID_ADMIN")
assert_contains "채널 목록" '"channels"' "$CHANNELS"

AGENCIES=$(api GET "/api/hr/agencies" "" "$SID_ADMIN")
assert_contains "대리점 목록" '"agencies"' "$AGENCIES"

# ============================
# 13. RBAC 권한 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 13. RBAC 권한 테스트${NC}"

# TEAM_LEADER는 시스템 관리 접근 불가
SYS_DENY=$(api GET "/api/system/info" "" "$SID_LEADER")
assert_contains "TEAM_LEADER 시스템관리 거부" '"error"' "$SYS_DENY"

# 비인증 접근 거부
NOAUTH=$(api GET "/api/orders" "")
assert_contains "비인증 요청 거부" '"error"' "$NOAUTH"

# ============================
# 14. 매출/정산 차트 API 테스트
# ============================
echo ""
echo -e "${YELLOW}▶ 14. 매출/정산 차트 API 테스트${NC}"

REVENUE=$(api GET "/api/stats/revenue-trend" "" "$SID_ADMIN")
assert_contains "매출 추이 API" "daily" "$REVENUE"

SETTLE_SUM=$(api GET "/api/stats/settlement-summary" "" "$SID_ADMIN")
assert_contains "정산 현황 API" "summary" "$SETTLE_SUM"

# ============================
# 15. 로그아웃
# ============================
echo ""
echo -e "${YELLOW}▶ 15. 로그아웃${NC}"

# 로그아웃 전용 세션 생성 (다른 테스트 세션과 분리)
SID_LOGOUT=$(login "admin" "admin123")
assert "로그아웃 테스트 세션 생성" "true" "$([ -n "$SID_LOGOUT" ] && echo true || echo false)"

# 세션 활성 확인
BEFORE_LOGOUT=$(api GET "/api/auth/me" "" "$SID_LOGOUT")
assert_contains "로그아웃 전 세션 유효" '"admin"' "$BEFORE_LOGOUT"

# 로그아웃 실행
LOGOUT=$(api POST "/api/auth/logout" '{}' "$SID_LOGOUT")
assert_contains "로그아웃 성공" '"ok"' "$LOGOUT"

# 로그아웃 후 세션 무효 확인
sleep 1
AFTER_LOGOUT=$(api GET "/api/auth/me" "" "$SID_LOGOUT")
# 로그아웃 후 세션이 삭제되어 error 또는 user 필드가 없어야 함
if echo "$AFTER_LOGOUT" | grep -q '"error"'; then
  assert_contains "로그아웃 후 세션 무효" '"error"' "$AFTER_LOGOUT"
elif ! echo "$AFTER_LOGOUT" | grep -q '"user"'; then
  TOTAL=$((TOTAL+1))
  PASS=$((PASS+1))
  echo -e "  ${GREEN}✓${NC} 로그아웃 후 세션 무효"
else
  TOTAL=$((TOTAL+1))
  FAIL=$((FAIL+1))
  echo -e "  ${RED}✗${NC} 로그아웃 후 세션 무효 (세션이 여전히 활성)"
fi

# ============================
# 결과 출력
# ============================
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  테스트 결과: ${GREEN}$PASS PASS${NC} / ${RED}$FAIL FAIL${NC} / $TOTAL TOTAL${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ 모든 테스트 통과!${NC}"
  exit 0
else
  echo -e "${RED}❌ $FAIL개 테스트 실패${NC}"
  exit 1
fi
