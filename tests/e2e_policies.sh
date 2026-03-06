#!/bin/bash
# ================================================================
# R4 E2E: 정책관리 전체 CRUD 검증
# ================================================================
BASE="http://localhost:3000/api"
PASS=0; FAIL=0; TOTAL=0

check() {
  TOTAL=$((TOTAL+1))
  if [ "$2" = "true" ]; then echo "✅ PASS: $1"; PASS=$((PASS+1));
  else echo "❌ FAIL: $1"; FAIL=$((FAIL+1)); fi
}
extract() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null; }

echo "================================================"
echo "R4: 정책관리 E2E 검증 — $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"

# 로그인
AH="Cookie: session_id=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"login_id":"admin","password":"admin123"}' | extract "d['session_id']")"
TH="Cookie: session_id=$(curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' -d '{"login_id":"leader_seoul_1","password":"admin123"}' | extract "d['session_id']")"

# ── 1. 배분 정책 CRUD ──
echo -e "\n── 1. 배분 정책 ──"
R=$(curl -s "$BASE/stats/policies/distribution" -H "$AH")
check "P1-1 배분 조회" "$(echo "$R" | extract "len(d.get('policies',[])) > 0" | grep -q True && echo true || echo false)"

R=$(curl -s -X POST "$BASE/stats/policies/distribution" -H "Content-Type: application/json" -H "$AH" \
  -d '{"name":"E2E배분정책","rule_json":{"method":"test"},"effective_from":"2026-03-06"}')
DPID=$(echo "$R" | extract "d.get('policy_id','')")
check "P1-2 배분 생성 (ID=$DPID)" "$([ -n "$DPID" ] && echo true || echo false)"

R=$(curl -s -X PUT "$BASE/stats/policies/distribution/$DPID" -H "Content-Type: application/json" -H "$AH" \
  -d '{"name":"수정E2E배분정책"}')
check "P1-3 배분 수정" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 활성 상태에서 삭제 시도 → 거부
R=$(curl -s -X DELETE "$BASE/stats/policies/distribution/$DPID" -H "$AH")
check "P1-4 활성삭제 거부" "$(echo "$R" | extract "'삭제할 수 없습니다' in d.get('error','')" | grep -q True && echo true || echo false)"

# 비활성화 후 삭제
curl -s -X PUT "$BASE/stats/policies/distribution/$DPID" -H "Content-Type: application/json" -H "$AH" -d '{"is_active":false}' > /dev/null
R=$(curl -s -X DELETE "$BASE/stats/policies/distribution/$DPID" -H "$AH")
check "P1-5 비활성 후 삭제" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# ── 2. 보고서 정책 CRUD ──
echo -e "\n── 2. 보고서 정책 ──"
R=$(curl -s "$BASE/stats/policies/report" -H "$AH")
check "P2-1 보고서 조회" "$(echo "$R" | extract "len(d.get('policies',[])) > 0" | grep -q True && echo true || echo false)"

R=$(curl -s -X POST "$BASE/stats/policies/report" -H "Content-Type: application/json" -H "$AH" \
  -d '{"name":"E2E보고서정책","service_type":"에어컨세척","required_photos_json":{"EXTERIOR":1,"INTERIOR":1,"BEFORE_WASH":1,"AFTER_WASH":1},"require_receipt":true}')
RPID=$(echo "$R" | extract "d.get('policy_id','')")
check "P2-2 보고서 생성 (ID=$RPID)" "$([ -n "$RPID" ] && echo true || echo false)"

R=$(curl -s -X PUT "$BASE/stats/policies/report/$RPID" -H "Content-Type: application/json" -H "$AH" \
  -d '{"name":"수정E2E보고서정책","require_receipt":false}')
check "P2-3 보고서 수정" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 활성 삭제 거부 → 비활성 후 삭제
R=$(curl -s -X DELETE "$BASE/stats/policies/report/$RPID" -H "$AH")
check "P2-4 활성삭제 거부" "$(echo "$R" | extract "'삭제할 수 없습니다' in d.get('error','')" | grep -q True && echo true || echo false)"
curl -s -X PUT "$BASE/stats/policies/report/$RPID" -H "Content-Type: application/json" -H "$AH" -d '{"is_active":false}' > /dev/null
R=$(curl -s -X DELETE "$BASE/stats/policies/report/$RPID" -H "$AH")
check "P2-5 비활성 후 삭제" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# ── 3. 수수료 정책 CRUD ──
echo -e "\n── 3. 수수료 정책 ──"
R=$(curl -s "$BASE/stats/policies/commission" -H "$AH")
check "P3-1 수수료 조회 (stats)" "$(echo "$R" | extract "len(d.get('policies',[])) > 0" | grep -q True && echo true || echo false)"
R=$(curl -s "$BASE/hr/commission-policies" -H "$AH")
check "P3-2 수수료 조회 (hr)" "$(echo "$R" | extract "len(d.get('policies',[])) > 0" | grep -q True && echo true || echo false)"

R=$(curl -s -X POST "$BASE/hr/commission-policies" -H "Content-Type: application/json" -H "$AH" \
  -d '{"org_id":2,"team_leader_id":7,"mode":"PERCENT","value":15,"effective_from":"2026-03-07"}')
CPID=$(echo "$R" | extract "d.get('commission_policy_id','')")
check "P3-3 수수료 생성 (ID=$CPID)" "$([ -n "$CPID" ] && echo true || echo false)"

R=$(curl -s -X PUT "$BASE/hr/commission-policies/$CPID" -H "Content-Type: application/json" -H "$AH" \
  -d '{"value":20}')
check "P3-4 수수료 수정" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

R=$(curl -s -X DELETE "$BASE/hr/commission-policies/$CPID" -H "$AH")
check "P3-5 수수료 삭제" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# ── 4. 지표 정책 CRUD ──
echo -e "\n── 4. 지표(Metrics) 정책 ──"
R=$(curl -s "$BASE/stats/policies/metrics" -H "$AH")
check "P4-1 지표 조회" "$(echo "$R" | extract "'policies' in d" | grep -q True && echo true || echo false)"

R=$(curl -s -X POST "$BASE/stats/policies/metrics" -H "Content-Type: application/json" -H "$AH" \
  -d '{"completion_basis":"HQ_APPROVED","region_intake_basis":"DISTRIBUTED","effective_from":"2026-03-06"}')
MPID=$(echo "$R" | extract "d.get('metrics_policy_id','')")
check "P4-2 지표 생성 (ID=$MPID)" "$([ -n "$MPID" ] && echo true || echo false)"

R=$(curl -s -X PUT "$BASE/stats/policies/metrics/$MPID" -H "Content-Type: application/json" -H "$AH" \
  -d '{"completion_basis":"DONE"}')
check "P4-3 지표 수정" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# 활성 삭제 거부 → 비활성 후 삭제
R=$(curl -s -X DELETE "$BASE/stats/policies/metrics/$MPID" -H "$AH")
check "P4-4 활성삭제 거부" "$(echo "$R" | extract "'삭제할 수 없습니다' in d.get('error','')" | grep -q True && echo true || echo false)"
curl -s -X PUT "$BASE/stats/policies/metrics/$MPID" -H "Content-Type: application/json" -H "$AH" -d '{"is_active":false}' > /dev/null
R=$(curl -s -X DELETE "$BASE/stats/policies/metrics/$MPID" -H "$AH")
check "P4-5 비활성 후 삭제" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# ── 5. 지역권 매핑 ──
echo -e "\n── 5. 지역권 매핑 ──"
R=$(curl -s "$BASE/stats/territories" -H "$AH")
TER_N=$(echo "$R" | extract "len(d.get('territories',[]))")
check "P5-1 지역권 조회 (건수=$TER_N)" "$([ "$TER_N" -gt 0 ] 2>/dev/null && echo true || echo false)"

# ── 6. 보고서 정책 강제 적용 검증 ──
echo -e "\n── 6. 보고서 정책 필수사진 강제 ──"
# 먼저 에어컨세척용 활성 정책 생성
curl -s -X POST "$BASE/stats/policies/report" -H "Content-Type: application/json" -H "$AH" \
  -d '{"name":"필수사진 강제 정책","service_type":"에어컨세척","required_photos_json":{"EXTERIOR":1,"INTERIOR":1,"BEFORE_WASH":1,"AFTER_WASH":1},"require_receipt":true}' > /dev/null

# 주문 생성 → IN_PROGRESS까지
TS=$(date +%s)
OID=$(curl -s -X POST "$BASE/orders" -H "Content-Type: application/json" -H "$AH" \
  -d "{\"channel_id\":1,\"service_type\":\"에어컨세척\",\"customer_name\":\"정책E2E-$TS\",\"customer_phone\":\"010-7777-${TS: -4}\",\"address_text\":\"서울 정책테스트 ${TS}번지\",\"base_amount\":100000,\"requested_date\":\"2026-03-06\"}" | extract "d.get('order_id','')")
curl -s -X PATCH "$BASE/orders/$OID/distribution" -H "Content-Type: application/json" -H "$AH" -d '{"region_org_id":2}' > /dev/null
curl -s -X POST "$BASE/orders/$OID/assign" -H "Content-Type: application/json" -H "$AH" -d '{"team_leader_id":7}' > /dev/null
curl -s -X POST "$BASE/orders/$OID/ready-done" -H "$TH" > /dev/null
curl -s -X POST "$BASE/orders/$OID/start" -H "$TH" > /dev/null

# 사진 없이 보고서 제출 → 거부되어야 함
R=$(curl -s -X POST "$BASE/orders/$OID/reports" -H "Content-Type: application/json" -H "$TH" \
  -d '{"content":"사진없는보고서","photos":[]}')
check "P6-1 사진없이 제출 거부" "$(echo "$R" | extract "'필수 사진이 부족' in d.get('error','')" | grep -q True && echo true || echo false)"

# 필수사진 포함 → 통과
R=$(curl -s -X POST "$BASE/orders/$OID/reports" -H "Content-Type: application/json" -H "$TH" \
  -d '{"content":"정상보고서","photos":[
    {"category":"EXTERIOR","file_url":"data:image/png;base64,iVBOR"},
    {"category":"INTERIOR","file_url":"data:image/png;base64,iVBOR"},
    {"category":"BEFORE_WASH","file_url":"data:image/png;base64,iVBOR"},
    {"category":"AFTER_WASH","file_url":"data:image/png;base64,iVBOR"}
  ]}')
check "P6-2 필수사진 포함 통과" "$(echo "$R" | extract "str(d.get('ok',False))" | grep -q True && echo true || echo false)"

# ── 7. 권한 체크 ──
echo -e "\n── 7. 권한 체크 ──"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/stats/policies/distribution" -H "Content-Type: application/json" -H "$TH" -d '{"name":"test"}')
check "P7-1 팀장 배분정책 생성 차단 ($HTTP)" "$([ "$HTTP" = "403" ] && echo true || echo false)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/stats/policies/metrics" -H "Content-Type: application/json" -H "$TH" -d '{"completion_basis":"DONE","region_intake_basis":"DISTRIBUTED"}')
check "P7-2 팀장 지표정책 생성 차단 ($HTTP)" "$([ "$HTTP" = "403" ] && echo true || echo false)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/stats/policies/distribution")
check "P7-3 비인증 접근 차단 ($HTTP)" "$([ "$HTTP" = "401" ] && echo true || echo false)"

# ── 결과 ──
echo ""
echo "================================================"
echo "R4 정책관리 E2E: PASS=$PASS  FAIL=$FAIL  TOTAL=$TOTAL"
[ $TOTAL -gt 0 ] && echo "점수: $((PASS * 100 / TOTAL))%"
echo "================================================"
