#!/usr/bin/env bash
# ================================================================
# R4 정책관리 E2E 테스트 v1.0
# 배분·보고서·수수료·지표(metrics) 정책 CRUD + 삭제 + 감사로그
# ================================================================
set -euo pipefail
BASE="http://localhost:3000"
PASS=0; FAIL=0; WARN=0

ok()   { PASS=$((PASS+1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL+1)); echo "  [FAIL] $1  =>  $2"; }
warn() { WARN=$((WARN+1)); echo "  [WARN] $1"; }

check() {
  local label=$1 expected=$2 actual=$3
  if echo "$actual" | grep -q "$expected"; then ok "$label"; else fail "$label" "expected [$expected], got [$actual]"; fi
}

echo "=== R4 정책관리 E2E 테스트 === $(date)"

# ── 0. 로그인 ──
echo "--- 0. 로그인 ---"
LOGIN=$(curl -s "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"login_id":"admin","password":"admin123"}')
SID=$(echo "$LOGIN" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)
check "S0-1 관리자 로그인" "session_id" "$LOGIN"
COOKIE="Cookie: session_id=$SID"

# ── 1. 배분 정책 CRUD ──
echo "--- 1. 배분 정책 CRUD ---"

# 조회
DIST_LIST=$(curl -s "$BASE/api/stats/policies/distribution" -H "$COOKIE")
check "S1-1 배분정책 조회" "policies" "$DIST_LIST"

# 생성
DIST_NEW=$(curl -s -X POST "$BASE/api/stats/policies/distribution" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"name":"E2E 테스트 정책","rule_json":{"method":"test"},"effective_from":"2026-03-06"}')
check "S1-2 배분정책 생성" "ok" "$DIST_NEW"
DIST_ID=$(echo "$DIST_NEW" | grep -o '"policy_id":[0-9]*' | grep -o '[0-9]*')

# 수정
DIST_UPD=$(curl -s -X PUT "$BASE/api/stats/policies/distribution/$DIST_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"name":"E2E 수정됨"}')
check "S1-3 배분정책 수정" "ok" "$DIST_UPD"

# 비활성화
DIST_DEACT=$(curl -s -X PUT "$BASE/api/stats/policies/distribution/$DIST_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"is_active":false}')
check "S1-4 배분정책 비활성화" "ok" "$DIST_DEACT"

# 활성 정책 삭제 시도 (실패해야 함) — 먼저 다시 활성화
curl -s -X PUT "$BASE/api/stats/policies/distribution/$DIST_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"is_active":true}' > /dev/null
DIST_DEL_FAIL=$(curl -s -X DELETE "$BASE/api/stats/policies/distribution/$DIST_ID" -H "$COOKIE")
check "S1-5 활성 배분정책 삭제 거부" "활성 정책은 삭제할 수 없습니다" "$DIST_DEL_FAIL"

# 비활성화 후 삭제
curl -s -X PUT "$BASE/api/stats/policies/distribution/$DIST_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"is_active":false}' > /dev/null
DIST_DEL=$(curl -s -X DELETE "$BASE/api/stats/policies/distribution/$DIST_ID" -H "$COOKIE")
check "S1-6 비활성 배분정책 삭제" "ok" "$DIST_DEL"

# ── 2. 보고서 정책 CRUD ──
echo "--- 2. 보고서 정책 CRUD ---"

# 조회
RPT_LIST=$(curl -s "$BASE/api/stats/policies/report" -H "$COOKIE")
check "S2-1 보고서정책 조회" "policies" "$RPT_LIST"

# 생성
RPT_NEW=$(curl -s -X POST "$BASE/api/stats/policies/report" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"name":"E2E 보고서 정책","service_type":"CLEANING","required_photos_json":{"EXTERIOR":2,"INTERIOR":1},"require_receipt":true}')
check "S2-2 보고서정책 생성" "ok" "$RPT_NEW"
RPT_ID=$(echo "$RPT_NEW" | grep -o '"policy_id":[0-9]*' | grep -o '[0-9]*')

# 수정
RPT_UPD=$(curl -s -X PUT "$BASE/api/stats/policies/report/$RPT_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"name":"E2E 보고서 수정됨","require_receipt":false}')
check "S2-3 보고서정책 수정" "ok" "$RPT_UPD"

# 비활성화 후 삭제
curl -s -X PUT "$BASE/api/stats/policies/report/$RPT_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"is_active":false}' > /dev/null
RPT_DEL=$(curl -s -X DELETE "$BASE/api/stats/policies/report/$RPT_ID" -H "$COOKIE")
check "S2-4 보고서정책 삭제" "ok" "$RPT_DEL"

# ── 3. 수수료 정책 CRUD ──
echo "--- 3. 수수료 정책 CRUD ---"

# 조회
CMM_LIST=$(curl -s "$BASE/api/stats/policies/commission" -H "$COOKIE")
check "S3-1 수수료정책 조회" "policies" "$CMM_LIST"

# 생성
CMM_NEW=$(curl -s -X POST "$BASE/api/stats/policies/commission" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"org_id":2,"mode":"PERCENT","value":10.5}')
check "S3-2 수수료정책 생성" "ok" "$CMM_NEW"
CMM_ID=$(echo "$CMM_NEW" | grep -o '"commission_policy_id":[0-9]*' | grep -o '[0-9]*')

# 수정
CMM_UPD=$(curl -s -X PUT "$BASE/api/stats/policies/commission/$CMM_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"mode":"FIXED","value":50000}')
check "S3-3 수수료정책 수정" "ok" "$CMM_UPD"

# 비활성화
CMM_DEACT=$(curl -s -X PUT "$BASE/api/stats/policies/commission/$CMM_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"is_active":false}')
check "S3-4 수수료정책 비활성화" "ok" "$CMM_DEACT"

# 활성 상태에서 삭제 시도 (먼저 활성화)
curl -s -X PUT "$BASE/api/stats/policies/commission/$CMM_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"is_active":true}' > /dev/null
CMM_DEL_FAIL=$(curl -s -X DELETE "$BASE/api/stats/policies/commission/$CMM_ID" -H "$COOKIE")
check "S3-5 활성 수수료정책 삭제 거부" "활성 정책은 삭제할 수 없습니다" "$CMM_DEL_FAIL"

# 비활성화 후 삭제
curl -s -X PUT "$BASE/api/stats/policies/commission/$CMM_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"is_active":false}' > /dev/null
CMM_DEL=$(curl -s -X DELETE "$BASE/api/stats/policies/commission/$CMM_ID" -H "$COOKIE")
check "S3-6 수수료정책 삭제" "ok" "$CMM_DEL"

# 유효성 검증 — 잘못된 mode
CMM_BAD=$(curl -s -X POST "$BASE/api/stats/policies/commission" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"org_id":2,"mode":"INVALID","value":10}')
check "S3-7 잘못된 mode 거부" "FIXED 또는 PERCENT" "$CMM_BAD"

# ── 4. 지표(Metrics) 정책 CRUD ──
echo "--- 4. 지표(Metrics) 정책 CRUD ---"

# 조회
MET_LIST=$(curl -s "$BASE/api/stats/policies/metrics" -H "$COOKIE")
check "S4-1 지표정책 조회" "policies" "$MET_LIST"

# 생성
MET_NEW=$(curl -s -X POST "$BASE/api/stats/policies/metrics" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"completion_basis":"SUBMITTED_AT","region_intake_basis":"DISTRIBUTED_AT","effective_from":"2026-03-06"}')
check "S4-2 지표정책 생성" "ok" "$MET_NEW"
MET_ID=$(echo "$MET_NEW" | grep -o '"metrics_policy_id":[0-9]*' | grep -o '[0-9]*')

# 수정
MET_UPD=$(curl -s -X PUT "$BASE/api/stats/policies/metrics/$MET_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"completion_basis":"HQ_APPROVED_AT"}')
check "S4-3 지표정책 수정" "ok" "$MET_UPD"

# 비활성화 후 삭제
curl -s -X PUT "$BASE/api/stats/policies/metrics/$MET_ID" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"is_active":false}' > /dev/null
MET_DEL=$(curl -s -X DELETE "$BASE/api/stats/policies/metrics/$MET_ID" -H "$COOKIE")
check "S4-4 지표정책 삭제" "ok" "$MET_DEL"

# 필수값 누락
MET_BAD=$(curl -s -X POST "$BASE/api/stats/policies/metrics" -H "Content-Type: application/json" -H "$COOKIE" \
  -d '{"completion_basis":"SUBMITTED_AT"}')
check "S4-5 지표정책 필수값 누락 거부" "필수" "$MET_BAD"

# ── 5. 지역권 매핑 ──
echo "--- 5. 지역권 매핑 ---"
TER_LIST=$(curl -s "$BASE/api/stats/territories" -H "$COOKIE")
check "S5-1 지역권 조회" "territories" "$TER_LIST"

# ── 6. 감사로그 확인 ──
echo "--- 6. 감사로그 확인 ---"
AUDIT=$(curl -s "$BASE/api/stats/policies/distribution" -H "$COOKIE")
# 감사로그 DB 직접 확인 불가 — API 존재 확인만
check "S6-1 정책 API 안정성" "policies" "$AUDIT"

# ── 7. 권한 검증 ──
echo "--- 7. 권한 검증 ---"
# 미인증 접근
UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/stats/policies/distribution")
check "S7-1 미인증 접근 차단" "401" "$UNAUTH"

# ── 결과 ──
echo ""
echo "========================================"
echo " R4 정책관리 E2E 결과"
echo " PASS: $PASS / FAIL: $FAIL / WARN: $WARN"
echo " Total: $((PASS+FAIL+WARN)) checks"
echo " Score: $((PASS * 100 / (PASS+FAIL+WARN)))%"
echo "========================================"
