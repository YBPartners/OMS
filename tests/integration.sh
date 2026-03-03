#!/bin/bash
# ============================================================
# 다하다 OMS v3.0 — Integration Test Suite
# 시스템이 설계대로 구동되는지 검증하는 연동 테스트
# ============================================================

BASE="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0

# ─── 헬퍼 함수 ───
test_case() {
  TOTAL=$((TOTAL + 1))
  local name="$1"
  local expected="$2"
  local actual="$3"
  
  if echo "$actual" | grep -q "$expected"; then
    PASS=$((PASS + 1))
    echo "  ✅ $name"
  else
    FAIL=$((FAIL + 1))
    echo "  ❌ $name"
    echo "     Expected: $expected"
    echo "     Got: $(echo $actual | head -c 200)"
  fi
}

api_call() {
  local method="$1"
  local path="$2"
  local body="$3"
  local session="$4"
  
  if [ -n "$body" ]; then
    curl -s -X "$method" "${BASE}${path}" \
      -H "Content-Type: application/json" \
      -H "X-Session-Id: $session" \
      -d "$body"
  else
    curl -s -X "$method" "${BASE}${path}" \
      -H "X-Session-Id: $session"
  fi
}

echo "═══════════════════════════════════════════════"
echo " 다하다 OMS v3.0 — Integration Test Suite"
echo "═══════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════
# 1. Health Check
# ═══════════════════════════════════════════════
echo "📋 1. Health Check"
RES=$(curl -s $BASE/api/health)
test_case "Health endpoint returns OK" '"status":"ok"' "$RES"
test_case "Version is 3.0.0" '"version":"3.0.0"' "$RES"

# ═══════════════════════════════════════════════
# 2. Authentication Tests
# ═══════════════════════════════════════════════
echo ""
echo "🔐 2. Authentication Tests"

# 2.1 Login as admin
ADMIN_LOGIN=$(api_call POST /api/auth/login '{"login_id":"admin","password":"admin123"}')
ADMIN_SID=$(echo $ADMIN_LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)
test_case "Admin login succeeds" '"session_id"' "$ADMIN_LOGIN"
test_case "Admin has SUPER_ADMIN role" 'SUPER_ADMIN' "$ADMIN_LOGIN"

# 2.2 Login as region admin
REGION_LOGIN=$(api_call POST /api/auth/login '{"login_id":"seoul_admin","password":"admin123"}')
REGION_SID=$(echo $REGION_LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)
test_case "Region admin login succeeds" '"session_id"' "$REGION_LOGIN"
test_case "Region admin has REGION_ADMIN role" 'REGION_ADMIN' "$REGION_LOGIN"

# 2.3 Login as team leader
LEADER_LOGIN=$(api_call POST /api/auth/login '{"login_id":"leader_seoul_1","password":"admin123"}')
LEADER_SID=$(echo $LEADER_LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)
test_case "Team leader login succeeds" '"session_id"' "$LEADER_LOGIN"
test_case "Team leader has TEAM_LEADER role" 'TEAM_LEADER' "$LEADER_LOGIN"

# 2.4 Wrong password
WRONG_LOGIN=$(api_call POST /api/auth/login '{"login_id":"admin","password":"wrong"}')
test_case "Wrong password fails" '"error"' "$WRONG_LOGIN"

# 2.5 Get current user
ME_RES=$(api_call GET /api/auth/me "" "$ADMIN_SID")
test_case "GET /me returns user info" '"user_id"' "$ME_RES"

# ═══════════════════════════════════════════════
# 3. Orders Module Tests
# ═══════════════════════════════════════════════
echo ""
echo "📦 3. Orders Module Tests"

# 3.1 List orders
ORDERS=$(api_call GET "/api/orders?limit=5" "" "$ADMIN_SID")
ORDERS_TOTAL=$(echo $ORDERS | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null)
test_case "Orders list returns data" '"orders"' "$ORDERS"
test_case "Orders total > 0" "true" "$([ "$ORDERS_TOTAL" -gt 0 ] && echo true || echo false)"

# 3.2 Create manual order
NEW_ORDER=$(api_call POST /api/orders '{"customer_name":"테스트고객","address_text":"서울특별시 강남구 테스트동 100","admin_dong_code":"1168010100","base_amount":150000,"requested_date":"2026-03-03"}' "$ADMIN_SID")
NEW_ORDER_ID=$(echo $NEW_ORDER | python3 -c "import sys,json; print(json.load(sys.stdin).get('order_id',''))" 2>/dev/null)
test_case "Manual order creation" '"order_id"' "$NEW_ORDER"
test_case "Fingerprint generated" '"fingerprint"' "$NEW_ORDER"

# 3.3 Order detail
if [ -n "$NEW_ORDER_ID" ]; then
  ORDER_DETAIL=$(api_call GET "/api/orders/$NEW_ORDER_ID" "" "$ADMIN_SID")
  test_case "Order detail fetched" '"order"' "$ORDER_DETAIL"
  test_case "Order has status history" '"history"' "$ORDER_DETAIL"
fi

# 3.4 Duplicate check
DUP_ORDER=$(api_call POST /api/orders '{"customer_name":"테스트고객","address_text":"서울특별시 강남구 테스트동 100","admin_dong_code":"1168010100","base_amount":150000,"requested_date":"2026-03-03"}' "$ADMIN_SID")
test_case "Duplicate order detected" '"warning"' "$DUP_ORDER"

# 3.5 Funnel statistics
FUNNEL=$(api_call GET /api/orders/stats/funnel "" "$ADMIN_SID")
test_case "Funnel endpoint works" '"funnel"' "$FUNNEL"

# ═══════════════════════════════════════════════
# 4. Distribution Tests
# ═══════════════════════════════════════════════
echo ""
echo "🔀 4. Distribution Tests"

# 4.1 Auto distribute
DIST_RES=$(api_call POST /api/orders/distribute "" "$ADMIN_SID")
DIST_COUNT=$(echo $DIST_RES | python3 -c "import sys,json; print(json.load(sys.stdin).get('distributed',0))" 2>/dev/null)
test_case "Auto distribute works" '"distributed"' "$DIST_RES"
test_case "Region summary included" '"region_summary"' "$DIST_RES"
echo "     → Distributed: $DIST_COUNT orders"

# 4.2 Scope check: region admin sees only own orders
REGION_ORDERS=$(api_call GET "/api/orders?limit=100" "" "$REGION_SID")
test_case "Region admin gets scoped orders" '"orders"' "$REGION_ORDERS"

# ═══════════════════════════════════════════════
# 5. Assignment (Kanban) Tests
# ═══════════════════════════════════════════════
echo ""
echo "📌 5. Assignment (Kanban) Tests"

# Get distributed orders for Seoul region
DIST_ORDERS=$(api_call GET "/api/orders?status=DISTRIBUTED&limit=5" "" "$REGION_SID")
FIRST_DIST_ID=$(echo $DIST_ORDERS | python3 -c "import sys,json; orders=json.load(sys.stdin).get('orders',[]); print(orders[0]['order_id'] if orders else '')" 2>/dev/null)

# Get team leaders
LEADERS=$(api_call GET "/api/auth/team-leaders" "" "$REGION_SID")
FIRST_LEADER_ID=$(echo $LEADERS | python3 -c "import sys,json; tl=json.load(sys.stdin).get('team_leaders',[]); print(tl[0]['user_id'] if tl else '')" 2>/dev/null)
test_case "Team leaders list available" '"team_leaders"' "$LEADERS"

if [ -n "$FIRST_DIST_ID" ] && [ -n "$FIRST_LEADER_ID" ]; then
  ASSIGN_RES=$(api_call POST "/api/orders/$FIRST_DIST_ID/assign" "{\"team_leader_id\":$FIRST_LEADER_ID}" "$REGION_SID")
  test_case "Team leader assignment works" '"ok":true' "$ASSIGN_RES"
  
  # Start work (as leader)
  START_RES=$(api_call POST "/api/orders/$FIRST_DIST_ID/start" "" "$LEADER_SID")
  test_case "Start work succeeds" '"ok":true' "$START_RES"
  
  # Submit report
  REPORT_RES=$(api_call POST "/api/orders/$FIRST_DIST_ID/reports" '{"checklist":{"exterior_photo":true,"interior_photo":true},"note":"테스트 보고서","photos":[{"category":"ETC","file_url":"https://example.com/test.jpg"}]}' "$LEADER_SID")
  test_case "Report submission works" '"ok":true' "$REPORT_RES"
  test_case "Report version tracked" '"version"' "$REPORT_RES"
fi

# ═══════════════════════════════════════════════
# 6. Review Tests
# ═══════════════════════════════════════════════
echo ""
echo "🔍 6. Review Tests"

if [ -n "$FIRST_DIST_ID" ]; then
  # Region review (approve)
  REGION_REVIEW=$(api_call POST "/api/orders/$FIRST_DIST_ID/review/region" '{"result":"APPROVE","comment":"지역 검수 통과"}' "$REGION_SID")
  test_case "Region review (approve) works" '"ok":true' "$REGION_REVIEW"
  test_case "Status becomes REGION_APPROVED" '"new_status":"REGION_APPROVED"' "$REGION_REVIEW"
  
  # HQ review (approve)
  HQ_REVIEW=$(api_call POST "/api/orders/$FIRST_DIST_ID/review/hq" '{"result":"APPROVE","comment":"HQ 최종 승인"}' "$ADMIN_SID")
  test_case "HQ review (approve) works" '"ok":true' "$HQ_REVIEW"
  test_case "Status becomes HQ_APPROVED" '"new_status":"HQ_APPROVED"' "$HQ_REVIEW"
fi

# ═══════════════════════════════════════════════
# 7. Settlement Tests
# ═══════════════════════════════════════════════
echo ""
echo "💰 7. Settlement Tests"

# Create settlement run
RUN_RES=$(api_call POST /api/settlements/runs '{"period_type":"WEEKLY","period_start":"2026-01-01","period_end":"2026-12-31"}' "$ADMIN_SID")
RUN_ID=$(echo $RUN_RES | python3 -c "import sys,json; print(json.load(sys.stdin).get('run_id',''))" 2>/dev/null)
test_case "Settlement run created" '"run_id"' "$RUN_RES"

if [ -n "$RUN_ID" ]; then
  # Calculate
  CALC_RES=$(api_call POST "/api/settlements/runs/$RUN_ID/calculate" "" "$ADMIN_SID")
  test_case "Settlement calculation works" '"run_id"' "$CALC_RES"
  CALC_ORDERS=$(echo $CALC_RES | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_orders',0))" 2>/dev/null)
  echo "     → Calculated: $CALC_ORDERS orders"
  
  # Confirm
  if [ "$CALC_ORDERS" -gt 0 ] 2>/dev/null; then
    CONFIRM_RES=$(api_call POST "/api/settlements/runs/$RUN_ID/confirm" "" "$ADMIN_SID")
    test_case "Settlement confirmation works" '"confirmed_count"' "$CONFIRM_RES"
  fi
  
  # View details
  DETAILS=$(api_call GET "/api/settlements/runs/$RUN_ID/details" "" "$ADMIN_SID")
  test_case "Settlement details available" '"run"' "$DETAILS"
fi

# Settlement runs list
RUNS=$(api_call GET /api/settlements/runs "" "$ADMIN_SID")
test_case "Settlement runs list works" '"runs"' "$RUNS"

# Ledger
LEDGER=$(api_call GET /api/settlements/ledger "" "$LEADER_SID")
test_case "Team leader ledger accessible" '"ledger"' "$LEDGER"

# ═══════════════════════════════════════════════
# 8. Reconciliation Tests
# ═══════════════════════════════════════════════
echo ""
echo "⚖️ 8. Reconciliation Tests"

RECON_RES=$(api_call POST /api/reconciliation/runs '{"date_range_start":"2026-01-01","date_range_end":"2026-12-31"}' "$ADMIN_SID")
test_case "Reconciliation run works" '"run_id"' "$RECON_RES"
test_case "Issues count returned" '"total_issues"' "$RECON_RES"

RECON_RUNS=$(api_call GET /api/reconciliation/runs "" "$ADMIN_SID")
test_case "Reconciliation runs list" '"runs"' "$RECON_RUNS"

RECON_ISSUES=$(api_call GET "/api/reconciliation/issues?resolved=false" "" "$ADMIN_SID")
test_case "Reconciliation issues list" '"issues"' "$RECON_ISSUES"

# ═══════════════════════════════════════════════
# 9. Statistics Tests
# ═══════════════════════════════════════════════
echo ""
echo "📊 9. Statistics Tests"

DASHBOARD=$(api_call GET /api/stats/dashboard "" "$ADMIN_SID")
test_case "Dashboard data loads" '"today"' "$DASHBOARD"
test_case "Region summary included" '"region_summary"' "$DASHBOARD"

REGION_STATS=$(api_call GET "/api/stats/regions/daily?from=2026-01-01&to=2026-12-31" "" "$ADMIN_SID")
test_case "Region daily stats" '"stats"' "$REGION_STATS"

TL_STATS=$(api_call GET "/api/stats/team-leaders/daily?from=2026-01-01&to=2026-12-31" "" "$ADMIN_SID")
test_case "Team leader daily stats" '"stats"' "$TL_STATS"

# Policies
DIST_POLICY=$(api_call GET /api/stats/policies/distribution "" "$ADMIN_SID")
test_case "Distribution policies" '"policies"' "$DIST_POLICY"

REPORT_POLICY=$(api_call GET /api/stats/policies/report "" "$ADMIN_SID")
test_case "Report policies" '"policies"' "$REPORT_POLICY"

TERRITORIES=$(api_call GET /api/stats/territories "" "$ADMIN_SID")
test_case "Territories mapping" '"territories"' "$TERRITORIES"

# ═══════════════════════════════════════════════
# 10. HR Management Tests
# ═══════════════════════════════════════════════
echo ""
echo "👥 10. HR Management Tests"

# Organizations
ORGS=$(api_call GET /api/hr/organizations "" "$ADMIN_SID")
test_case "Organizations list (with stats)" '"organizations"' "$ORGS"

# Users
HR_USERS=$(api_call GET "/api/hr/users?limit=5" "" "$ADMIN_SID")
test_case "HR users list" '"users"' "$HR_USERS"

# Create user
NEW_USER=$(api_call POST /api/hr/users '{"name":"테스트팀장","phone":"01099998888","org_id":2,"role":"TEAM_LEADER"}' "$ADMIN_SID")
test_case "Create user succeeds" '"user_id"' "$NEW_USER"
test_case "Initial password returned" '"initial_password"' "$NEW_USER"
NEW_USER_ID=$(echo $NEW_USER | python3 -c "import sys,json; print(json.load(sys.stdin).get('user_id',''))" 2>/dev/null)

if [ -n "$NEW_USER_ID" ]; then
  # User detail
  USER_DETAIL=$(api_call GET "/api/hr/users/$NEW_USER_ID" "" "$ADMIN_SID")
  test_case "User detail with roles" '"roles"' "$USER_DETAIL"
  test_case "User activity stats included" '"activity"' "$USER_DETAIL"
  
  # Edit user
  EDIT_USER=$(api_call PUT "/api/hr/users/$NEW_USER_ID" '{"name":"수정된팀장","memo":"테스트 메모"}' "$ADMIN_SID")
  test_case "Edit user succeeds" '"ok":true' "$EDIT_USER"
  
  # Reset password
  RESET_PW=$(api_call POST "/api/hr/users/$NEW_USER_ID/reset-password" "" "$ADMIN_SID")
  test_case "Password reset works" '"new_password"' "$RESET_PW"
  
  # Deactivate
  DEACTIVATE=$(api_call PATCH "/api/hr/users/$NEW_USER_ID/status" '{"status":"INACTIVE"}' "$ADMIN_SID")
  test_case "Deactivate user works" '"ok":true' "$DEACTIVATE"
fi

# Roles
ROLES=$(api_call GET /api/hr/roles "" "$ADMIN_SID")
test_case "Roles list available" '"roles"' "$ROLES"

# Commission policies
COMM_POLICIES=$(api_call GET /api/hr/commission-policies "" "$ADMIN_SID")
test_case "Commission policies list" '"policies"' "$COMM_POLICIES"

# Create commission policy
NEW_COMM=$(api_call POST /api/hr/commission-policies '{"org_id":2,"mode":"PERCENT","value":7.5,"effective_from":"2026-03-01"}' "$ADMIN_SID")
test_case "Create commission policy" '"commission_policy_id"' "$NEW_COMM"
COMM_ID=$(echo $NEW_COMM | python3 -c "import sys,json; print(json.load(sys.stdin).get('commission_policy_id',''))" 2>/dev/null)

if [ -n "$COMM_ID" ]; then
  # Edit commission
  EDIT_COMM=$(api_call PUT "/api/hr/commission-policies/$COMM_ID" '{"value":8.0}' "$ADMIN_SID")
  test_case "Edit commission policy" '"ok":true' "$EDIT_COMM"
  
  # Delete commission
  DEL_COMM=$(api_call DELETE "/api/hr/commission-policies/$COMM_ID" "" "$ADMIN_SID")
  test_case "Delete commission policy" '"ok":true' "$DEL_COMM"
fi

# ═══════════════════════════════════════════════
# 11. RBAC (Permission) Tests
# ═══════════════════════════════════════════════
echo ""
echo "🛡️ 11. RBAC Permission Tests"

# Region admin can't access HQ-only endpoints
REGION_SETTLEMENT=$(api_call GET /api/settlements/runs "" "$REGION_SID")
test_case "Region admin blocked from settlements" '"error"' "$REGION_SETTLEMENT"

# Team leader can't create orders
LEADER_CREATE=$(api_call POST /api/orders '{"address_text":"test","base_amount":100}' "$LEADER_SID")
test_case "Team leader blocked from order creation" '"error"' "$LEADER_CREATE"

# Region admin scoped user access
REGION_USERS=$(api_call GET /api/hr/users "" "$REGION_SID")
test_case "Region admin gets scoped user list" '"users"' "$REGION_USERS"

# Team leader can't distribute
LEADER_DIST=$(api_call POST /api/orders/distribute "" "$LEADER_SID")
test_case "Team leader blocked from distribute" '"error"' "$LEADER_DIST"

# ═══════════════════════════════════════════════
# 12. Static Files & SPA Tests
# ═══════════════════════════════════════════════
echo ""
echo "🌐 12. Static Files & SPA Tests"

# Core JS files
for f in constants api ui auth app; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/static/js/core/$f.js")
  test_case "Core JS: $f.js loads (HTTP $STATUS)" "200" "$STATUS"
done

# Shared JS files
for f in table form-helpers; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/static/js/shared/$f.js")
  test_case "Shared JS: $f.js loads (HTTP $STATUS)" "200" "$STATUS"
done

# Page JS files
for f in dashboard orders kanban review settlement statistics hr my-orders; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/static/js/pages/$f.js")
  test_case "Page JS: $f.js loads (HTTP $STATUS)" "200" "$STATUS"
done

# SPA routing
SPA_HTML=$(curl -s $BASE/)
test_case "SPA HTML loads" '<div id="app">' "$SPA_HTML"
test_case "All core scripts loaded" 'core/constants.js' "$SPA_HTML"
test_case "All page scripts loaded" 'pages/my-orders.js' "$SPA_HTML"

# ═══════════════════════════════════════════════
# 13. End-to-End Flow Test
# ═══════════════════════════════════════════════
echo ""
echo "🔄 13. End-to-End Flow Test (Order Lifecycle)"

# Create order
E2E_ORDER=$(api_call POST /api/orders '{"customer_name":"E2E테스트","address_text":"서울특별시 강남구 역삼동 200","admin_dong_code":"1168010100","base_amount":200000,"requested_date":"2026-03-03","service_type":"DEFAULT"}' "$ADMIN_SID")
E2E_ID=$(echo $E2E_ORDER | python3 -c "import sys,json; print(json.load(sys.stdin).get('order_id',''))" 2>/dev/null)
test_case "E2E: Order created" '"order_id"' "$E2E_ORDER"

if [ -n "$E2E_ID" ]; then
  # Distribute
  DIST=$(api_call POST /api/orders/distribute "" "$ADMIN_SID")
  test_case "E2E: Distribution executed" '"distributed"' "$DIST"
  
  # Check order is now DISTRIBUTED
  CHECK=$(api_call GET "/api/orders/$E2E_ID" "" "$ADMIN_SID")
  ORDER_STATUS=$(echo $CHECK | python3 -c "import sys,json; print(json.load(sys.stdin).get('order',{}).get('status',''))" 2>/dev/null)
  test_case "E2E: Order status = DISTRIBUTED" "DISTRIBUTED" "$ORDER_STATUS"
  
  # Assign to leader
  ASSIGN=$(api_call POST "/api/orders/$E2E_ID/assign" "{\"team_leader_id\":$FIRST_LEADER_ID}" "$REGION_SID")
  test_case "E2E: Assigned to leader" '"ok":true' "$ASSIGN"
  
  # Start work
  START=$(api_call POST "/api/orders/$E2E_ID/start" "" "$LEADER_SID")
  test_case "E2E: Work started" '"ok":true' "$START"
  
  # Submit report
  REPORT=$(api_call POST "/api/orders/$E2E_ID/reports" '{"checklist":{"exterior_photo":true,"interior_photo":true,"before_wash":true,"after_wash":true},"note":"E2E 완료 보고서"}' "$LEADER_SID")
  test_case "E2E: Report submitted" '"ok":true' "$REPORT"
  
  # Region approve
  R_REVIEW=$(api_call POST "/api/orders/$E2E_ID/review/region" '{"result":"APPROVE","comment":"지역 승인"}' "$REGION_SID")
  test_case "E2E: Region approved" '"REGION_APPROVED"' "$R_REVIEW"
  
  # HQ approve
  H_REVIEW=$(api_call POST "/api/orders/$E2E_ID/review/hq" '{"result":"APPROVE","comment":"HQ 승인"}' "$ADMIN_SID")
  test_case "E2E: HQ approved" '"HQ_APPROVED"' "$H_REVIEW"
  
  # Final status check
  FINAL=$(api_call GET "/api/orders/$E2E_ID" "" "$ADMIN_SID")
  FINAL_STATUS=$(echo $FINAL | python3 -c "import sys,json; print(json.load(sys.stdin).get('order',{}).get('status',''))" 2>/dev/null)
  test_case "E2E: Final status = HQ_APPROVED" "HQ_APPROVED" "$FINAL_STATUS"
  
  # Verify status history is complete
  HISTORY_COUNT=$(echo $FINAL | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('history',[])))" 2>/dev/null)
  test_case "E2E: Status history tracked (count=$HISTORY_COUNT)" "true" "$([ "$HISTORY_COUNT" -ge 5 ] && echo true || echo false)"
fi

# ═══════════════════════════════════════════════
# Results Summary
# ═══════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════"
echo " Test Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "═══════════════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
  echo " 🎉 ALL TESTS PASSED!"
else
  echo " ⚠️  Some tests failed. Review the output above."
fi

exit $FAIL
