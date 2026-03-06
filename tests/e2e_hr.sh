#!/bin/bash
# ================================================================
# 와이비 OMS — R5 인사·권한·조직 관리 E2E 테스트
# ================================================================
BASE="http://localhost:3000/api"
PASS=0 FAIL=0 WARN=0
T() { echo -ne "  $1 ... "; }
OK() { echo -e "\e[32m[PASS]\e[0m $1"; PASS=$((PASS+1)); }
NG() { echo -e "\e[31m[FAIL]\e[0m $1"; FAIL=$((FAIL+1)); }
WN() { echo -e "\e[33m[WARN]\e[0m $1"; WARN=$((WARN+1)); }
# helper: POST/PUT/PATCH/DELETE with session
C() { curl -s -X "$1" "$BASE$2" -b "session_id=$SID" -H "Content-Type: application/json" ${3:+-d "$3"}; }

echo "=============================================="
echo " R5 인사·권한·조직 관리 E2E 테스트"
echo " $(date)"
echo "=============================================="

# ─── 0. 로그인 ───
echo -e "\n▶ S0: 로그인"
T "S0-1 admin 로그인"
LOGIN=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"login_id":"admin","password":"admin123"}')
SID=$(echo "$LOGIN" | jq -r '.session_id // ""')
if [ -n "$SID" ] && [ "$SID" != "null" ]; then OK "session"; else NG "로그인 실패"; exit 1; fi

# ─── 1. 사용자 CRUD ───
echo -e "\n▶ S1: 사용자 CRUD"

T "S1-1 사용자 목록"
R=$(C GET /hr/users?limit=100)
[ "$(echo "$R" | jq '.total')" -gt 0 ] && OK "total=$(echo "$R" | jq '.total')" || NG "비어있음"

T "S1-2 역할 목록"
R=$(C GET /hr/roles)
[ "$(echo "$R" | jq '.roles | length')" -ge 5 ] && OK "$(echo "$R" | jq '.roles | length')" || NG ""

T "S1-3 등록"
R=$(C POST /hr/users '{"name":"E2E_R5테스트","phone":"01088880099","org_id":2,"role":"TEAM_LEADER"}')
NEWUID=$(echo "$R" | jq -r '.user_id // ""')
[ -n "$NEWUID" ] && [ "$NEWUID" != "null" ] && OK "uid=$NEWUID" || NG "$(echo "$R" | jq -r '.error // "?"')"

T "S1-4 상세"
R=$(C GET "/hr/users/$NEWUID")
[ "$(echo "$R" | jq -r '.user.name')" = "E2E_R5테스트" ] && OK "" || NG ""

T "S1-5 수정"
R=$(C PUT "/hr/users/$NEWUID" '{"name":"E2E_R5수정","email":"t@t.com"}')
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "" || NG "$(echo "$R" | jq -r '.error // ""')"

T "S1-6 ID/PW 설정"
R=$(C POST "/hr/users/$NEWUID/set-credentials" '{"login_id":"e2e_r5_test","password":"test1234!"}')
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "" || NG ""

T "S1-7 PW 초기화"
R=$(C POST "/hr/users/$NEWUID/reset-password")
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "pw=$(echo "$R" | jq -r '.new_password')" || NG "$(echo "$R" | jq -r '.error // ""')"

T "S1-8 비활성화"
R=$(C PATCH "/hr/users/$NEWUID/status" '{"status":"INACTIVE"}')
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "" || NG ""

T "S1-9 재활성화"
R=$(C PATCH "/hr/users/$NEWUID/status" '{"status":"ACTIVE"}')
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "" || NG ""

# ─── 2. 다중 역할 ───
echo -e "\n▶ S2: 다중 역할"

T "S2-1 다중 역할 할당"
R=$(C POST "/hr/users/$NEWUID/roles" '{"roles":["TEAM_LEADER","REGION_ADMIN"]}')
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "$(echo "$R" | jq -c '.roles')" || NG ""

T "S2-2 역할 확인 (2개)"
R=$(C GET "/hr/users/$NEWUID")
CNT=$(echo "$R" | jq '.roles | length')
[ "$CNT" = "2" ] && OK "cnt=$CNT" || NG "cnt=$CNT"

T "S2-3 단일 역할"
R=$(C POST "/hr/users/$NEWUID/roles" '{"roles":["TEAM_LEADER"]}')
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "" || NG ""

T "S2-4 빈 역할 거부"
R=$(C POST "/hr/users/$NEWUID/roles" '{"roles":[]}')
ERR=$(echo "$R" | jq -r '.error // ""')
[ -n "$ERR" ] && OK "" || NG "빈 역할 허용됨"

T "S2-5 잘못된 역할 거부"
R=$(C POST "/hr/users/$NEWUID/roles" '{"roles":["INVALID"]}')
ERR=$(echo "$R" | jq -r '.error // ""')
[ -n "$ERR" ] && OK "" || NG ""

# ─── 3. 조직 이동 ───
echo -e "\n▶ S3: 조직 이동"

T "S3-1 이동"
R=$(C POST "/hr/users/$NEWUID/transfer" '{"org_id":3}')
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "" || NG ""

T "S3-2 이동 확인"
R=$(C GET "/hr/users/$NEWUID")
[ "$(echo "$R" | jq -r '.user.org_id')" = "3" ] && OK "" || NG "$(echo "$R" | jq -r '.user.org_id')"

T "S3-3 잘못된 조직 거부"
R=$(C POST "/hr/users/$NEWUID/transfer" '{"org_id":9999}')
ERR=$(echo "$R" | jq -r '.error // ""')
[ -n "$ERR" ] && OK "" || NG ""

# ─── 4. 사용자 삭제 ───
echo -e "\n▶ S4: 소프트 삭제"

T "S4-1 삭제"
R=$(C DELETE "/hr/users/$NEWUID")
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "$(echo "$R" | jq -r '.message')" || NG "$(echo "$R" | jq -r '.error // ""')"

T "S4-2 목록에서 제외"
R=$(C GET "/hr/users?limit=200")
FOUND=$(echo "$R" | jq '[.users[] | select(.name=="E2E_R5수정")] | length')
[ "$FOUND" = "0" ] && OK "" || NG "노출됨"

T "S4-3 자기삭제 거부"
R=$(C DELETE "/hr/users/1")
ERR=$(echo "$R" | jq -r '.error // ""')
[ -n "$ERR" ] && OK "" || NG ""

# ─── 5. 조직 CRUD ───
echo -e "\n▶ S5: 조직 CRUD"

T "S5-1 목록"
R=$(C GET /hr/organizations)
[ "$(echo "$R" | jq '.organizations | length')" -gt 0 ] && OK "$(echo "$R" | jq '.organizations | length')개" || NG ""

TS=$(date +%s)
T "S5-2 REGION 등록"
R=$(C POST /hr/organizations "{\"name\":\"E2E_R5총판\",\"org_type\":\"REGION\",\"code\":\"E2E_${TS}\"}")
NEWOID=$(echo "$R" | jq -r '.org_id // ""')
[ -n "$NEWOID" ] && [ "$NEWOID" != "null" ] && OK "oid=$NEWOID" || NG "$(echo "$R" | jq -r '.error // ""')"

T "S5-3 TEAM 등록"
R=$(C POST /hr/organizations "{\"name\":\"E2E_R5팀\",\"org_type\":\"TEAM\",\"parent_org_id\":$NEWOID,\"code\":\"E2E_T${TS}\"}")
NEWTID=$(echo "$R" | jq -r '.org_id // ""')
[ -n "$NEWTID" ] && [ "$NEWTID" != "null" ] && OK "tid=$NEWTID" || NG "$(echo "$R" | jq -r '.error // ""')"

T "S5-4 TEAM parent 필수"
R=$(C POST /hr/organizations '{"name":"X","org_type":"TEAM"}')
ERR=$(echo "$R" | jq -r '.error // ""')
[ -n "$ERR" ] && OK "" || NG ""

T "S5-5 수정"
R=$(C PUT "/hr/organizations/$NEWOID" '{"name":"E2E_수정총판"}')
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "" || NG ""

T "S5-6 중복코드 거부"
R=$(C POST /hr/organizations "{\"name\":\"DUP\",\"org_type\":\"REGION\",\"code\":\"E2E_${TS}\"}")
ERR=$(echo "$R" | jq -r '.error // ""')
[ -n "$ERR" ] && OK "" || NG ""

T "S5-7 TEAM 삭제"
R=$(C DELETE "/hr/organizations/$NEWTID")
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "" || NG ""

T "S5-8 REGION 삭제"
R=$(C DELETE "/hr/organizations/$NEWOID")
[ "$(echo "$R" | jq -r '.ok')" = "true" ] && OK "" || NG ""

T "S5-9 HQ 삭제 거부"
R=$(C DELETE "/hr/organizations/1")
ERR=$(echo "$R" | jq -r '.error // ""')
[ -n "$ERR" ] && OK "" || NG ""

# ─── 6. 감사로그 ───
echo -e "\n▶ S6: 감사로그"

T "S6-1 USER 로그"
R=$(C GET "/audit?entity_type=USER&limit=10")
[ "$(echo "$R" | jq '.logs | length')" -gt 0 ] && OK "$(echo "$R" | jq '.logs | length')" || NG ""

T "S6-2 ORG 로그"
R=$(C GET "/audit?entity_type=ORGANIZATION&limit=10")
[ "$(echo "$R" | jq '.logs | length')" -gt 0 ] && OK "$(echo "$R" | jq '.logs | length')" || NG ""

T "S6-3 DELETE 로그"
R=$(C GET "/audit?entity_type=USER&limit=20")
CNT=$(echo "$R" | jq '[.logs[] | select(.action=="DELETE")] | length')
[ "$CNT" -gt 0 ] && OK "$CNT" || WN "없음"

T "S6-4 ROLES_CHANGED 로그"
CNT=$(echo "$R" | jq '[.logs[] | select(.action=="ROLES_CHANGED")] | length')
[ "$CNT" -gt 0 ] && OK "$CNT" || WN "없음"

T "S6-5 TRANSFER 로그"
CNT=$(echo "$R" | jq '[.logs[] | select(.action=="TRANSFER")] | length')
[ "$CNT" -gt 0 ] && OK "$CNT" || WN "없음"

# ─── 7. 권한 ───
echo -e "\n▶ S7: 권한 체크"

T "S7-1 팀장 로그인"
R=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"login_id":"teamlead1","password":"1234!"}')
TLSID=$(echo "$R" | jq -r '.session_id // ""')
if [ -n "$TLSID" ] && [ "$TLSID" != "null" ]; then
  OK ""
  TC() { curl -s -X "$1" "$BASE$2" -b "session_id=$TLSID" -H "Content-Type: application/json" ${3:+-d "$3"}; }

  T "S7-2 팀장 사용자등록 불가"
  R=$(TC POST /hr/users '{"name":"X","phone":"01000000000","org_id":1,"role":"SUPER_ADMIN"}')
  ERR=$(echo "$R" | jq -r '.error // ""')
  [ -n "$ERR" ] && OK "" || NG ""

  T "S7-3 팀장 조직생성 불가"
  R=$(TC POST /hr/organizations '{"name":"X","org_type":"REGION"}')
  ERR=$(echo "$R" | jq -r '.error // ""')
  [ -n "$ERR" ] && OK "" || NG ""

  T "S7-4 팀장 삭제 불가"
  R=$(TC DELETE /hr/users/2)
  ERR=$(echo "$R" | jq -r '.error // ""')
  [ -n "$ERR" ] && OK "" || NG ""
else
  WN "팀장 로그인 실패 — 스킵"
fi

# ─── 결과 ───
echo -e "\n=============================================="
TOTAL_T=$((PASS + FAIL + WARN))
if [ "$FAIL" -eq 0 ]; then SCORE=100; else SCORE=$(( PASS * 100 / TOTAL_T )); fi
echo " 결과: PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
echo " 점수: $SCORE% ($PASS/$TOTAL_T)"
echo "=============================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
