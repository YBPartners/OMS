#!/bin/bash
# ================================================================
# R3 E2E: 정산 전체 플로우 검증 v2
# Run 생성 → 주문준비(HQ_APPROVED) → 산출 → 확정 → 지급
# ================================================================
BASE="http://localhost:3000/api"
PASS=0; FAIL=0; WARN=0; TOTAL=0

check() {
  TOTAL=$((TOTAL+1))
  local label="$1" cond="$2"
  if [ "$cond" = "true" ]; then
    echo "✅ PASS: $label"
    PASS=$((PASS+1))
  else
    echo "❌ FAIL: $label"
    FAIL=$((FAIL+1))
  fi
}

extract() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null; }

echo "================================================"
echo "R3: 정산 E2E 전체 플로우 검증 v2"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"

# ── 0. 관리자 로그인 ──
echo -e "\n── 0. 로그인 ──"
ADMIN_RES=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"admin","password":"admin123"}')
SESSION=$(echo "$ADMIN_RES" | extract "d.get('session_id','')")
AH="Cookie: session_id=$SESSION"
check "S0-1 관리자 로그인 (session=${SESSION:0:8}...)" "$([ ${#SESSION} -gt 10 ] && echo true || echo false)"

TL_RES=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login_id":"leader_seoul_1","password":"admin123"}')
TL_SESSION=$(echo "$TL_RES" | extract "d.get('session_id','')")
TH="Cookie: session_id=$TL_SESSION"
check "S0-2 팀장 로그인" "$([ ${#TL_SESSION} -gt 10 ] && echo true || echo false)"

# ── 1. 주문 생성 → HQ_APPROVED까지 진행 ──
echo -e "\n── 1. 테스트 주문 생성 및 HQ승인까지 ──"
TS=$(date +%s)
R=$(curl -s -X POST "$BASE/orders" -H "Content-Type: application/json" -H "$AH" \
  -d "{\"channel_id\":1,\"service_type\":\"에어컨세척\",\"customer_name\":\"정산E2E-${TS}\",\"customer_phone\":\"010-9999-${TS: -4}\",\"address_text\":\"서울 강남구 정산테스트 ${TS}번지\",\"base_amount\":200000,\"requested_date\":\"2026-03-05\"}")
OID=$(echo "$R" | extract "d.get('order_id','')")
check "S1-1 주문생성 (OID=$OID)" "$([ -n "$OID" ] && [ "$OID" != "" ] && echo true || echo false)"

# 배분
R=$(curl -s -X PATCH "$BASE/orders/$OID/distribution" -H "Content-Type: application/json" -H "$AH" \
  -d '{"region_org_id":2}')
check "S1-2 배분" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 배정
R=$(curl -s -X POST "$BASE/orders/$OID/assign" -H "Content-Type: application/json" -H "$AH" \
  -d '{"team_leader_id":7}')
check "S1-3 배정" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 준비완료
R=$(curl -s -X POST "$BASE/orders/$OID/ready-done" -H "$TH")
check "S1-4 준비완료" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 작업시작
R=$(curl -s -X POST "$BASE/orders/$OID/start" -H "$TH")
check "S1-5 작업시작" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 보고서
R=$(curl -s -X POST "$BASE/orders/$OID/reports" -H "Content-Type: application/json" -H "$TH" \
  -d '{"content":"정산E2E보고","photos":[
    {"category":"EXTERIOR","file_url":"data:image/png;base64,iVBOR"},
    {"category":"INTERIOR","file_url":"data:image/png;base64,iVBOR"},
    {"category":"BEFORE_WASH","file_url":"data:image/png;base64,iVBOR"},
    {"category":"AFTER_WASH","file_url":"data:image/png;base64,iVBOR"}]}')
check "S1-6 보고서" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 완료
R=$(curl -s -X POST "$BASE/orders/$OID/complete" -H "$TH")
check "S1-7 완료" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 지역검수
R=$(curl -s -X POST "$BASE/orders/$OID/review/region" -H "Content-Type: application/json" -H "$AH" \
  -d '{"result":"APPROVE","comment":"OK"}')
check "S1-8 지역검수" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# HQ검수
R=$(curl -s -X POST "$BASE/orders/$OID/review/hq" -H "Content-Type: application/json" -H "$AH" \
  -d '{"result":"APPROVE","comment":"OK"}')
check "S1-9 HQ검수" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 상태확인
R=$(curl -s "$BASE/orders/$OID" -H "$AH")
ST=$(echo "$R" | extract "d.get('order',{}).get('status','')")
check "S1-10 상태=HQ_APPROVED (=$ST)" "$([ "$ST" = "HQ_APPROVED" ] && echo true || echo false)"

# ── 2. 정산 Run 생성 ──
echo -e "\n── 2. 정산 Run 생성 ──"
R=$(curl -s -X POST "$BASE/settlements/runs" -H "Content-Type: application/json" -H "$AH" \
  -d '{"period_type":"WEEKLY","period_start":"2026-03-01","period_end":"2026-03-06"}')
RUN_ID=$(echo "$R" | extract "d.get('run_id','')")
check "S2-1 Run생성 (RUN_ID=$RUN_ID)" "$([ -n "$RUN_ID" ] && [ "$RUN_ID" != "" ] && echo true || echo false)"

# ── 3. 정산 산출 ──
echo -e "\n── 3. 정산 산출 ──"
R=$(curl -s -X POST "$BASE/settlements/runs/$RUN_ID/calculate" -H "$AH")
echo "  산출: $R"
CALC_N=$(echo "$R" | extract "d.get('total_orders',0)")
CALC_P=$(echo "$R" | extract "d.get('total_payable_amount',0)")
check "S3-1 산출 주문수>0 (=$CALC_N)" "$([ "$CALC_N" -gt 0 ] 2>/dev/null && echo true || echo false)"
check "S3-2 지급액>=0 (=$CALC_P)" "$([ "$CALC_N" -gt 0 ] 2>/dev/null && echo true || echo false)"

# ── 4. 상세 조회 ──
echo -e "\n── 4. 정산 상세 ──"
R=$(curl -s "$BASE/settlements/runs/$RUN_ID/details" -H "$AH")
DET_N=$(echo "$R" | extract "len(d.get('settlements',[]))")
check "S4-1 명세건수>0 (=$DET_N)" "$([ "$DET_N" -gt 0 ] 2>/dev/null && echo true || echo false)"

# ── 5. 정산 확정 ──
echo -e "\n── 5. 정산 확정 ──"
R=$(curl -s -X POST "$BASE/settlements/runs/$RUN_ID/confirm" -H "$AH")
echo "  확정: $R"
CONF_OK=$(echo "$R" | extract "str(d.get('ok',False))" | grep -c True)
CONF_N=$(echo "$R" | extract "d.get('confirmed_count',0)")
check "S5-1 확정 성공" "$([ "$CONF_OK" = "1" ] && echo true || echo false)"
check "S5-2 확정건수>0 (=$CONF_N)" "$([ "$CONF_N" -gt 0 ] 2>/dev/null && echo true || echo false)"

# 주문 상태확인
R=$(curl -s "$BASE/orders/$OID" -H "$AH")
ST=$(echo "$R" | extract "d.get('order',{}).get('status','')")
check "S5-3 주문=SETTLEMENT_CONFIRMED (=$ST)" "$([ "$ST" = "SETTLEMENT_CONFIRMED" ] && echo true || echo false)"

# ── 6. 정산 지급 ──
echo -e "\n── 6. 정산 지급완료 ──"
R=$(curl -s -X POST "$BASE/settlements/runs/$RUN_ID/pay" -H "Content-Type: application/json" -H "$AH" \
  -d '{"payment_note":"E2E 지급 테스트","payment_date":"2026-03-06"}')
echo "  지급: $R"
PAY_OK=$(echo "$R" | extract "str(d.get('ok',False))" | grep -c True)
PAY_N=$(echo "$R" | extract "d.get('paid_count',0)")
check "S6-1 지급 성공" "$([ "$PAY_OK" = "1" ] && echo true || echo false)"
check "S6-2 지급건수>0 (=$PAY_N)" "$([ "$PAY_N" -gt 0 ] 2>/dev/null && echo true || echo false)"

# 주문 최종 상태
R=$(curl -s "$BASE/orders/$OID" -H "$AH")
ST=$(echo "$R" | extract "d.get('order',{}).get('status','')")
check "S6-3 최종상태=PAID (=$ST)" "$([ "$ST" = "PAID" ] && echo true || echo false)"

# ── 7. 보고서·인보이스·CSV ──
echo -e "\n── 7. 정산 보고서·인보이스·CSV ──"
R=$(curl -s "$BASE/settlements/runs/$RUN_ID/report" -H "$AH")
RPT_N=$(echo "$R" | extract "d.get('report',{}).get('summary',{}).get('total_count',0)")
check "S7-1 보고서 (건수=$RPT_N)" "$([ "$RPT_N" -gt 0 ] 2>/dev/null && echo true || echo false)"

R=$(curl -s "$BASE/settlements/runs/$RUN_ID/invoice/7" -H "$AH")
INV=$(echo "$R" | extract "d.get('invoice',{}).get('invoiceNo','')")
check "S7-2 인보이스 (=$INV)" "$([ -n "$INV" ] && [ "$INV" != "" ] && echo true || echo false)"

R=$(curl -s "$BASE/settlements/runs/$RUN_ID/export" -H "$AH")
CSV_N=$(echo "$R" | extract "len(d.get('rows',[]))")
check "S7-3 CSV (건수=$CSV_N)" "$([ "$CSV_N" -gt 0 ] 2>/dev/null && echo true || echo false)"

# ── 8. 원장 조회 ──
echo -e "\n── 8. 원장 조회 ──"
R=$(curl -s "$BASE/settlements/ledger?team_leader_id=7" -H "$AH")
LED_N=$(echo "$R" | extract "len(d.get('ledger',[]))")
check "S8-1 원장 (건수=$LED_N)" "$([ "$LED_N" -gt 0 ] 2>/dev/null && echo true || echo false)"

# ── 9. Run 목록 ──
echo -e "\n── 9. Run 목록 ──"
R=$(curl -s "$BASE/settlements/runs" -H "$AH")
RUN_N=$(echo "$R" | extract "len(d.get('runs',[]))")
check "S9-1 Run목록 (건수=$RUN_N)" "$([ "$RUN_N" -gt 0 ] 2>/dev/null && echo true || echo false)"

# ── 10. 권한 체크 ──
echo -e "\n── 10. 권한 체크 ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/settlements/runs" \
  -H "Content-Type: application/json" -H "$TH" \
  -d '{"period_type":"WEEKLY","period_start":"2026-03-01","period_end":"2026-03-06"}')
check "S10-1 팀장 Run생성 차단 (HTTP=$HTTP)" "$([ "$HTTP" = "403" ] && echo true || echo false)"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/settlements/runs/$RUN_ID/calculate" -H "$TH")
check "S10-2 팀장 산출 차단 (HTTP=$HTTP)" "$([ "$HTTP" = "403" ] && echo true || echo false)"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/settlements/runs")
check "S10-3 비인증 차단 (HTTP=$HTTP)" "$([ "$HTTP" = "401" ] && echo true || echo false)"

# 팀장은 지급 불가
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/settlements/runs/$RUN_ID/pay" \
  -H "Content-Type: application/json" -H "$TH" -d '{}')
check "S10-4 팀장 지급 차단 (HTTP=$HTTP)" "$([ "$HTTP" = "403" ] && echo true || echo false)"

# ── 결과 ──
echo ""
echo "================================================"
echo "R3 정산 E2E 결과: PASS=$PASS  FAIL=$FAIL  WARN=$WARN  TOTAL=$TOTAL"
if [ $TOTAL -gt 0 ]; then
  SCORE=$((PASS * 100 / TOTAL))
  echo "점수: ${SCORE}%"
fi
echo "================================================"
