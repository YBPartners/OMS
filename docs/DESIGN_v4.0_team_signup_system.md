# Airflow OMS — 팀장 가입 & 총판 관리 시스템 설계서 v4.0

> **문서 상태**: 설계 확정 (구현 대기)
> **작성일**: 2026-03-04
> **범위**: 팀장 자가 가입, 총판 관리, 조직 계층 재설계, 행정구역 마스터

---

## 1. 현재 시스템 진단 & 변경 범위

### 1-1. 현재 구조 (AS-IS)

```
조직 테이블: organizations (org_type: HQ | REGION)
계층 관계:
  HQ(본사, org_id=1)
  +-- REGION(서울총판, org_id=2) --> territories(서울 6개동)
  +-- REGION(경기총판, org_id=3) --> territories(경기 4개동)
  +-- REGION(인천총판, org_id=4) --> territories(인천 2개동)
  +-- REGION(부산총판, org_id=5) --> territories(부산 2개동)

사용자:
  users.org_id -> organizations.org_id (소속 조직)
  user_roles -> roles (역할 매핑)

문제점:
  1) 조직 타입이 HQ/REGION 2종 -> TEAM 타입 부재
  2) 팀장이 REGION 조직에 직접 소속 (팀 단위 분리 안 됨)
  3) 자가 가입 없음 (관리자 수동 생성만)
  4) 행정구역 데이터: territories에 14건만 (더미)
  5) 승인 워크플로우 없음
  6) 총판-팀 parent 관계 없음
```

### 1-2. 목표 구조 (TO-BE)

```
조직 테이블: organizations (org_type: HQ | REGION | TEAM)

계층 관계:
  HQ(본사)
  +-- REGION(서울총판, parent_org_id=1)
  |   +-- TEAM(강남1팀, parent_org_id=2) --> team_territories(읍면동 매핑)
  |   +-- TEAM(역삼클린팀, parent_org_id=2)
  +-- REGION(경기총판, parent_org_id=1)
  |   +-- TEAM(분당팀, parent_org_id=3)
  +-- ...

신규 기능:
  1) TEAM org_type 추가 + parent_org_id로 총판 연결
  2) 팀장 자가 가입 (핸드폰 인증 -> 총판 선택 -> 권역 선택 -> 승인 대기)
  3) 전국 행정구역 마스터 (admin_regions ~5000건)
  4) 총판 관리 메뉴 (SUPER_ADMIN 전용)
  5) 가입 승인 워크플로우 (총판이 팀장 승인, 체크리스트+수수료)
  6) 조직 관리 (트리/테이블 전환, 권한별 가시성, 일평균 처리 건수)
  7) 총판-팀 다대다 매핑 (기본 1:1, SUPER_ADMIN이 추가 매핑 가능)
```

---

## 2. 확정 사항

| # | 항목 | 확정 내용 |
|---|------|----------|
| 1 | 가입 대상 | 팀장(TEAM_LEADER)만 자가 가입 |
| 2 | 총판 생성 | SUPER_ADMIN이 직접 생성 (계정+조직 동시) |
| 3 | 명칭 통일 | 총판장 = 총판 (UI 표기 "총판"으로 통일) |
| 4 | 총판 권역 | 시도 기준 선택 -> 하위 자동 매핑, 읍면동 단위 세부 조정 |
| 5 | 팀 관할 | 읍면동 복수 선택 가능, 시도 걸쳐도 OK |
| 6 | 팀장 승인 | 총판(REGION_ADMIN)이 승인, 체크리스트+수수료 설정 필수 |
| 7 | 거절 | 사유 입력 -> SMS 통보(개발모드: 콘솔) + 재신청 화면 제공 |
| 8 | OTP | 개발모드 (화면 표시), 추후 실제 SMS 연동 |
| 9 | 행정구역 | 전국 데이터 + UI 필터링 |
| 10 | 조직 관리 | 트리/테이블 전환, 일평균(누계) 처리 건수 표시 |
| 11 | 기존 데이터(A) | 서울/경기/인천/부산 총판 -> 이름만 "총판"으로 변경 |
| 12 | 기존 팀장(B) | TEAM org 생성 후 재매핑 |
| 13 | 총판 생성 UX(C) | 조직 + 관리자 계정 한 번에 생성 |
| 14 | 팀-총판 관계(D) | 기본 1:1, SUPER_ADMIN에서 추가 매핑 가능 |

---

## 3. DB 스키마 변경 설계

### 3-1. 기존 테이블 변경

#### organizations -- parent 관계 추가

```sql
ALTER TABLE organizations ADD COLUMN parent_org_id INTEGER REFERENCES organizations(org_id);
```

변경 후 구조:
```
org_id | org_type | name       | code           | parent_org_id | status
-------|----------|------------|----------------|---------------|-------
1      | HQ       | Airflow 본사 | DAHADA_HQ      | NULL          | ACTIVE
2      | REGION   | 서울총판    | REGION_SEOUL   | 1             | ACTIVE
3      | REGION   | 경기총판    | REGION_GYEONGGI| 1             | ACTIVE
10     | TEAM     | 강남1팀     | TEAM_10        | 2             | ACTIVE
11     | TEAM     | 역삼클린팀  | TEAM_11        | 2             | ACTIVE
```

#### org_territories -- admin_regions 연결 컬럼 추가

```sql
ALTER TABLE org_territories ADD COLUMN region_id INTEGER REFERENCES admin_regions(region_id);
```

### 3-2. 신규 테이블

#### (1) admin_regions -- 전국 행정구역 마스터

```sql
CREATE TABLE IF NOT EXISTS admin_regions (
  region_id INTEGER PRIMARY KEY AUTOINCREMENT,
  sido TEXT NOT NULL,
  sigungu TEXT NOT NULL,
  eupmyeondong TEXT NOT NULL,
  admin_code TEXT,
  legal_code TEXT,
  full_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ar_sido ON admin_regions(sido);
CREATE INDEX idx_ar_sigungu ON admin_regions(sido, sigungu);
CREATE INDEX idx_ar_emd ON admin_regions(eupmyeondong);
CREATE INDEX idx_ar_full ON admin_regions(full_name);
CREATE INDEX idx_ar_code ON admin_regions(admin_code);
```

데이터 규모: 전국 약 3,500~5,000건 읍면동

#### (2) org_region_mappings -- 총판 <-> 읍면동 매핑 (org_territories 확장/대체)

```sql
CREATE TABLE IF NOT EXISTS org_region_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  region_id INTEGER NOT NULL REFERENCES admin_regions(region_id),
  mapped_at TEXT NOT NULL DEFAULT (datetime('now')),
  mapped_by INTEGER REFERENCES users(user_id),
  UNIQUE(org_id, region_id)
);

CREATE INDEX idx_orm_org ON org_region_mappings(org_id);
CREATE INDEX idx_orm_region ON org_region_mappings(region_id);
```

용도: 총판(REGION)의 관할 읍면동 매핑 + 팀(TEAM)의 관할 읍면동 매핑 통합

#### (3) signup_requests -- 가입 신청

```sql
CREATE TABLE IF NOT EXISTS signup_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  team_name TEXT NOT NULL,
  region_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  phone_verified INTEGER NOT NULL DEFAULT 0,
  phone_verify_token TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','APPROVED','REJECTED','REGION_ADD_REQUESTED')),
  approval_checklist_json TEXT,
  commission_mode TEXT,
  commission_value REAL,
  reviewed_by INTEGER REFERENCES users(user_id),
  reviewed_at TEXT,
  reject_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_signup_status ON signup_requests(status);
CREATE INDEX idx_signup_region ON signup_requests(region_org_id);
CREATE INDEX idx_signup_phone ON signup_requests(phone);
CREATE UNIQUE INDEX idx_signup_login_active ON signup_requests(login_id)
  WHERE status IN ('PENDING', 'APPROVED');
```

#### (4) signup_request_regions -- 가입 시 선택한 읍면동

```sql
CREATE TABLE IF NOT EXISTS signup_request_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES signup_requests(request_id) ON DELETE CASCADE,
  region_id INTEGER NOT NULL REFERENCES admin_regions(region_id),
  is_within_distributor INTEGER NOT NULL DEFAULT 1,
  UNIQUE(request_id, region_id)
);

CREATE INDEX idx_srr_request ON signup_request_regions(request_id);
```

#### (5) region_add_requests -- 권역 추가 요청

```sql
CREATE TABLE IF NOT EXISTS region_add_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  signup_request_id INTEGER REFERENCES signup_requests(request_id),
  team_org_id INTEGER REFERENCES organizations(org_id),
  region_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  region_id INTEGER NOT NULL REFERENCES admin_regions(region_id),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','APPROVED','REJECTED','CONFLICT')),
  conflict_org_id INTEGER REFERENCES organizations(org_id),
  conflict_detail TEXT,
  reviewed_by INTEGER REFERENCES users(user_id),
  reviewed_at TEXT,
  reject_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rar_status ON region_add_requests(status);
CREATE INDEX idx_rar_region_org ON region_add_requests(region_org_id);
```

### 3-3. 테이블 관계도

```
admin_regions (전국 읍면동 ~5000건)
    |
    +--< org_region_mappings >-- organizations (HQ/REGION/TEAM)
    |                               |
    +--< signup_request_regions     +-- parent_org_id (자기참조)
    |       |                       |       HQ -> REGION -> TEAM
    |       +-- signup_requests     +--< users
    |                               |       +--< user_roles >-- roles
    +--< region_add_requests        |
                                    +--< org_territories (기존, 호환 유지)
                                            +-- territories (기존)
```

---

## 4. 화면 & UX 플로우

### 4-1. 로그인 화면 변경

단일 로그인 화면 유지. 하단에 "팀장으로 가입하시겠습니까? [회원가입]" 링크 추가.
역할에 따라 로그인 후 메뉴/화면 자동 분기:
- SUPER_ADMIN/HQ_OPERATOR -> 본사 대시보드 + 총판관리 메뉴
- REGION_ADMIN(총판) -> 총판 대시보드 + 가입승인 메뉴
- TEAM_LEADER(팀장) -> 팀장 대시보드 (내 주문/현황)

### 4-2. 팀장 회원가입 -- 4단계 위저드

**STEP 1: 핸드폰 인증**
- 번호 입력 -> OTP 발송 (개발모드: 화면에 OTP 표시)
- 6자리 OTP 입력 -> 검증 (3분 만료, 5회 제한)
- 인증 완료 시 인증 토큰 발급

**STEP 2: 기본 정보**
- 아이디 (중복확인 필수)
- 비밀번호 + 비밀번호 확인
- 이름
- 팀 이름 (중복확인 필수, 유니크)

**STEP 3: 소속 & 관할 지역**
- 총판 드롭다운 선택 (활성 총판 목록)
- 선택한 총판의 관할 읍면동 전체 표시
- 총판 권역 내에서 내 팀 관할 읍면동 선택 (복수)
- 총판 권역 외 읍면동도 검색/선택 가능 -> "추가 요청" 표시
- 총판 권역 외 선택 시 region_add_requests 자동 생성

**STEP 4: 확인 & 제출**
- 입력 정보 요약
- 권역 외 지역 있으면 경고 표시
- 제출 -> signup_requests INSERT -> 승인 대기 안내

### 4-3. 총판 관리 (SUPER_ADMIN 전용)

사이드바 메뉴에 "총판 관리" 추가.

**메인 화면**: 총판 목록 테이블 (이름, 코드, 시도, 소속팀수, 상태)
**신규 생성**: 총판 조직 + 관리자 계정 동시 생성, 시도 선택 -> 하위 자동 매핑
**상세 화면**: 총판 정보 + 권역 관리

**권역 관리 UI (옵션2: 현재 목록 + 검색 추가/제거)**:
- 상단: 현재 매핑된 읍면동 목록 (시군구별 접기/펼치기, 필터 검색)
  - 시군구 단위 일괄 제거 버튼 [-]
  - 개별 읍면동 클릭 -> 단건 제거
- 하단: 권역 추가 영역
  - 추가 방식 선택: 시도 일괄 / 시군구 단위 / 개별 검색
  - 충돌 감지: 다른 총판에 매핑된 읍면동 표시 + 경고
  - 충돌 시: "추가하면 기존 총판에서 해제됩니다" 확인

**팀-총판 추가 매핑 (D항)**:
- 총판 상세 하단에 "소속 팀 관리" 섹션
- 다른 총판 소속 팀을 검색하여 추가 매핑 가능 (SUPER_ADMIN만)
- 팀은 여러 총판에 소속될 수 있음

### 4-4. 조직 관리 (트리/테이블 전환)

**트리 뷰**:
```
HQ(본사)
+-- 서울총판 (5팀, 일평균 12.3건)
|   +-- 강남1팀 - 김팀장 (일평균 3.2건)
|   +-- 역삼클린팀 - 이팀장 (일평균 2.8건)
+-- 경기총판 (3팀, 일평균 8.7건)
|   +-- 분당팀 - 한팀장 (일평균 3.1건)
```
- 노드 클릭 -> 상세 패널 (소속 팀수, 인원수, 관할 동수, 누적처리, 일평균, 정산금액)

**테이블 뷰**:
- 레벨, 조직명, 유형(HQ/총판/팀), 상위조직, 소속팀수, 일평균 처리건수, 상태
- 필터: 유형별, 활성만, 검색

**권한별 가시성**:
- SUPER_ADMIN: 전체 (레벨 1~3)
- 총판(REGION_ADMIN): 자기 총판 + 소속 팀 (레벨 2~3)
- 팀장(TEAM_LEADER): 자기 팀만 (레벨 3)

### 4-5. 가입 승인 (총판 REGION_ADMIN)

총판 메뉴에 "가입승인" 탭 추가 (또는 별도 메뉴).

**목록**: 대기/승인/거절 탭, 자기 총판 권역 내 신청만 표시
**승인 처리 모달**:
- 신청 정보 요약 (이름, 팀명, 핸드폰, 관할지역)
- 승인 체크리스트 (모두 체크 필수):
  - [ ] 핸드폰 인증 확인
  - [ ] 팀 이름 적정성 확인
  - [ ] 관할 행정동 확인 및 검수 완료
  - [ ] 수수료 정책 설정 완료
- 수수료 설정: 방식(정률%/정액원) + 값
- 권역 외 요청 처리 안내
- 모든 체크 완료 시만 승인 버튼 활성화

**거절 처리**:
- 사유 텍스트 입력 필수
- 확정 시 SMS 통보 (개발모드: 콘솔 로그)

**재신청 화면**:
- 거절된 신청자가 로그인 화면에서 "재신청" 접근 (핸드폰 번호로 조회)
- 기존 정보 프리필 + 수정 가능
- 거절 사유 표시

---

## 5. API 설계

### 5-1. 공개 API (인증 불필요)

| Method | Path | 설명 |
|--------|------|------|
| POST | /api/auth/signup/phone/send-otp | OTP 발송 |
| POST | /api/auth/signup/phone/verify-otp | OTP 검증 -> 인증 토큰 |
| POST | /api/auth/signup/check-login-id | 로그인 ID 중복 확인 |
| POST | /api/auth/signup/check-team-name | 팀 이름 중복 확인 |
| GET | /api/auth/signup/distributors | 활성 총판 목록 (가입용) |
| GET | /api/auth/signup/distributor/:id/regions | 총판 관할 읍면동 목록 |
| GET | /api/auth/signup/regions/search | 행정구역 검색 (전국) |
| POST | /api/auth/signup/team-leader | 팀장 가입 신청 |
| GET | /api/auth/signup/status/:phone | 신청 상태 조회 (핸드폰 기반) |
| POST | /api/auth/signup/reapply/:request_id | 거절 후 재신청 |

### 5-2. 총판 관리 API (SUPER_ADMIN)

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/distributors | 총판 목록 (팀수, 권역 요약) |
| POST | /api/distributors | 총판 생성 (조직+계정 동시) |
| GET | /api/distributors/:id | 총판 상세 |
| PUT | /api/distributors/:id | 총판 정보 수정 |
| PATCH | /api/distributors/:id/status | 총판 활성/비활성 |
| GET | /api/distributors/:id/regions | 총판 권역 읍면동 목록 |
| POST | /api/distributors/:id/regions | 총판 권역 추가 (충돌 검사) |
| DELETE | /api/distributors/:id/regions | 총판 권역 제거 |
| POST | /api/distributors/:id/regions/bulk-add | 시도/시군구 일괄 추가 |
| DELETE | /api/distributors/:id/regions/bulk-remove | 시군구 일괄 제거 |
| GET | /api/distributors/:id/teams | 소속 팀 목록 |
| POST | /api/distributors/:id/teams/:team_id | 팀 추가 매핑 (다대다) |
| DELETE | /api/distributors/:id/teams/:team_id | 팀 매핑 해제 |

### 5-3. 조직 관리 API

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | /api/organizations/tree | 계층 트리 (권한 필터, 일평균) | ALL |
| GET | /api/organizations/list | 테이블 리스트 (일평균 포함) | ALL |
| GET | /api/organizations/:id/detail | 조직 상세 (실적 포함) | ALL |

### 5-4. 가입 승인 API (총판 REGION_ADMIN + SUPER_ADMIN)

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/signup-approvals | 가입 대기 목록 (권역 필터) |
| GET | /api/signup-approvals/:id | 신청 상세 |
| POST | /api/signup-approvals/:id/approve | 승인 (체크리스트+수수료) |
| POST | /api/signup-approvals/:id/reject | 거절 (사유+SMS) |
| GET | /api/region-add-requests | 권역 추가 요청 목록 |
| POST | /api/region-add-requests/:id/resolve | 권역 추가 요청 처리 |

### 5-5. 행정구역 마스터 API

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/admin-regions/search | 통합 검색 (q=검색어) |
| GET | /api/admin-regions/sido | 시도 목록 |
| GET | /api/admin-regions/sido/:name/sigungu | 시군구 목록 |
| GET | /api/admin-regions/sido/:name/all | 하위 전체 (자동 매핑용) |
| GET | /api/admin-regions/sigungu/:sido/:name/dong | 읍면동 목록 |

---

## 6. 비즈니스 로직

### 6-1. 가입 -> 승인 전체 플로우

```
팀장 -> STEP1 핸드폰인증 -> STEP2 기본정보 -> STEP3 총판+지역선택 -> STEP4 제출
  |
  +-- signup_requests (PENDING)
  +-- signup_request_regions (선택한 읍면동)
  +-- region_add_requests (권역 외 있으면)
  |
총판 -> 가입승인 목록 -> 상세보기 -> 체크리스트+수수료 설정 -> 승인
  |
  +-- [승인 트랜잭션]:
  |   1. organizations INSERT (type=TEAM, parent=총판)
  |   2. users INSERT (status=ACTIVE, phone_verified=1)
  |   3. user_roles INSERT (TEAM_LEADER)
  |   4. org_region_mappings INSERT (팀-읍면동 매핑)
  |   5. commission_policies INSERT (수수료)
  |   6. signup_requests UPDATE (APPROVED)
  |
  +-- 팀장 -> 바로 로그인 가능
```

### 6-2. 총판 권역 충돌 검사

```
요청된 읍면동 -> org_region_mappings에서 다른 org_id 매핑 확인
충돌 있으면:
  - 어떤 총판과 충돌인지 표시
  - SUPER_ADMIN이 확인 후 기존 매핑 해제 -> 신규 추가
  - 또는 신규 추가 시 기존 매핑 자동 해제 (확인 후)
```

### 6-3. 일평균 처리 건수 계산

```
일평균 = 누적 처리 완료 건수 / 활동 일수
- 처리 완료 기준: HQ_APPROVED 이상 상태
- 활동 일수: 첫 처리일 ~ 오늘
- TEAM: 해당 팀 직접 처리 건
- REGION: 소속 팀 전체 합산
```

### 6-4. 승인 체크리스트

모든 항목 체크 필수:
1. 핸드폰 인증 확인 (자동 체크: phone_verified=1)
2. 팀 이름 적정성 확인 (수동)
3. 관할 행정동 확인 및 검수 완료 (수동)
4. 수수료 정책 설정 완료 (수수료 입력 시 자동 체크)

### 6-5. 팀-총판 다대다 매핑

- 가입 시: 1팀 = 1총판 (기본)
- SUPER_ADMIN이 총판 관리에서 추가 매핑 가능
- 구현: organizations.parent_org_id는 주 소속, 별도 team_distributor_mappings 테이블로 추가 매핑

```sql
CREATE TABLE IF NOT EXISTS team_distributor_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  distributor_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  mapped_at TEXT NOT NULL DEFAULT (datetime('now')),
  mapped_by INTEGER REFERENCES users(user_id),
  UNIQUE(team_org_id, distributor_org_id)
);
```

---

## 7. 파일 구조

### 7-1. 신규/변경 파일

```
src/routes/
  signup/
    index.ts            -- 라우터 마운트
    phone-verify.ts     -- 가입용 OTP
    register.ts         -- 가입 신청/재신청/상태조회
    validators.ts       -- 가입 전용 검증
  distributors/
    index.ts            -- 라우터 마운트
    crud.ts             -- 총판 CRUD (조직+계정 동시 생성)
    regions.ts          -- 총판 권역 관리 (추가/삭제/충돌/일괄)
    teams.ts            -- 팀-총판 매핑 관리
  admin-regions/
    index.ts            -- 행정구역 검색/조회 API
  organizations/
    index.ts            -- 트리/테이블/상세 API
  signup-approvals/
    index.ts            -- 가입 승인/거절 API

src/index.tsx           -- 신규 라우트 마운트 추가
src/types/index.ts      -- TEAM org_type, 신규 타입 추가
src/middleware/auth.ts   -- 가입 라우트 인증 면제

migrations/
  0002_team_signup_system.sql  -- 신규 마이그레이션

public/static/js/pages/
  signup.js              -- 4단계 위저드
  distributors.js        -- 총판 관리
  org-tree.js            -- 조직 트리/테이블
  signup-approvals.js    -- 가입 승인 (총판용)

public/static/js/core/
  constants.js           -- 메뉴/권한 추가
  auth.js                -- 로그인 화면에 가입 링크
  app.js                 -- 가입 화면 라우팅
```

### 7-2. 기존 데이터 마이그레이션

seed 데이터 변경:
```sql
-- (A) 총판 -> 총판 이름 변경
UPDATE organizations SET name = '서울총판' WHERE org_id = 2;
UPDATE organizations SET name = '경기총판' WHERE org_id = 3;
UPDATE organizations SET name = '인천총판' WHERE org_id = 4;
UPDATE organizations SET name = '부산총판' WHERE org_id = 5;

-- parent_org_id 설정
UPDATE organizations SET parent_org_id = 1 WHERE org_type = 'REGION';

-- (B) 기존 팀장 -> TEAM org 생성 + 재매핑
INSERT INTO organizations (org_type, name, code, parent_org_id, status)
VALUES
  ('TEAM', '강남서초팀', 'TEAM_007', 2, 'ACTIVE'),
  ('TEAM', '송파마포팀', 'TEAM_008', 2, 'ACTIVE'),
  ('TEAM', '분당수원팀', 'TEAM_009', 3, 'ACTIVE'),
  ('TEAM', '고양용인팀', 'TEAM_010', 3, 'ACTIVE'),
  ('TEAM', '남동연수팀', 'TEAM_011', 4, 'ACTIVE'),
  ('TEAM', '해운대팀',   'TEAM_012', 5, 'ACTIVE');

-- 기존 팀장 org_id 재매핑 (REGION -> TEAM)
UPDATE users SET org_id = (new TEAM org_id) WHERE user_id IN (7~12);
```

---

## 8. 행정구역 데이터

### 8-1. 데이터 소스

행정안전부 행정표준코드 기반, 전국 읍면동 약 3,500~5,000건.

시도 17개:
- 서울특별시, 부산광역시, 대구광역시, 인천광역시
- 광주광역시, 대전광역시, 울산광역시, 세종특별자치시
- 경기도, 충청북도, 충청남도, 전라북도
- 전라남도, 경상북도, 경상남도, 강원특별자치도, 제주특별자치도

### 8-2. 시드 방법

행정구역 공개 데이터(CSV/JSON)를 파싱하여 INSERT SQL 생성.
admin_code 10자리 포함하여 기존 territories.admin_dong_code와 연계.

---

## 9. 구현 우선순위

| 순서 | 작업 | 복잡도 | 의존성 |
|------|------|--------|--------|
| 1 | DB 마이그레이션 (0002) + admin_regions 시드 | 중 | 없음 |
| 2 | 기존 데이터 마이그레이션 (이름변경+팀org+재매핑) | 중 | 1 |
| 3 | 행정구역 검색 API | 낮음 | 1 |
| 4 | 총판 CRUD API + 권역 관리 API | 높음 | 1,3 |
| 5 | 가입 OTP API (기존 코드 재활용) | 낮음 | 1 |
| 6 | 가입 신청 API | 중 | 1,3,5 |
| 7 | 가입 승인 API + 자동 생성 로직 | 높음 | 1,6 |
| 8 | 조직 트리/테이블 API | 중 | 1,2 |
| 9 | 프론트: 총판 관리 페이지 | 높음 | 4 |
| 10 | 프론트: 가입 위저드 | 높음 | 5,6 |
| 11 | 프론트: 가입 승인 페이지 | 높음 | 7 |
| 12 | 프론트: 조직 관리 페이지 | 중 | 8 |
| 13 | 프론트: 로그인 화면 변경 + 메뉴 업데이트 | 낮음 | 10 |
| 14 | 통합 테스트 | 중 | 전체 |
