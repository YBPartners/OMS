-- ============================================================
-- Airflow OMS — Migration 0003: 팀 가입 시스템 + 조직 계층
-- v5.0 혁신 설계 기반 (통합)
-- ============================================================

-- 1. organizations 테이블 확장
-- org_type에 'TEAM' 추가, parent_org_id 추가
-- SQLite는 ALTER TABLE로 CHECK 변경 불가 → 새 테이블로 교체
CREATE TABLE IF NOT EXISTS organizations_new (
  org_id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_type TEXT NOT NULL CHECK(org_type IN ('HQ','REGION','TEAM')),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  parent_org_id INTEGER REFERENCES organizations_new(org_id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO organizations_new (org_id, org_type, name, code, status, created_at, updated_at)
SELECT org_id, org_type, name, code, status, created_at, updated_at FROM organizations;

DROP TABLE organizations;
ALTER TABLE organizations_new RENAME TO organizations;

CREATE INDEX IF NOT EXISTS idx_org_type ON organizations(org_type);
CREATE INDEX IF NOT EXISTS idx_org_parent ON organizations(parent_org_id);

-- 2. 전국 행정구역 마스터
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

CREATE INDEX IF NOT EXISTS idx_ar_sido ON admin_regions(sido);
CREATE INDEX IF NOT EXISTS idx_ar_sigungu ON admin_regions(sido, sigungu);
CREATE INDEX IF NOT EXISTS idx_ar_emd ON admin_regions(eupmyeondong);
CREATE INDEX IF NOT EXISTS idx_ar_full ON admin_regions(full_name);
CREATE INDEX IF NOT EXISTS idx_ar_code ON admin_regions(admin_code);

-- 3. 조직-행정구역 매핑 (총판/팀 <-> 읍면동)
CREATE TABLE IF NOT EXISTS org_region_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  region_id INTEGER NOT NULL REFERENCES admin_regions(region_id),
  mapped_at TEXT NOT NULL DEFAULT (datetime('now')),
  mapped_by INTEGER REFERENCES users(user_id),
  UNIQUE(org_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_orm_org ON org_region_mappings(org_id);
CREATE INDEX IF NOT EXISTS idx_orm_region ON org_region_mappings(region_id);

-- 4. 가입 신청
CREATE TABLE IF NOT EXISTS signup_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  team_name TEXT NOT NULL,
  distributor_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  phone_verified INTEGER NOT NULL DEFAULT 0,
  phone_verify_token TEXT,
  phone_verify_token_expires TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','APPROVED','REJECTED','REGION_ADD_REQUESTED')),
  approval_checklist_json TEXT DEFAULT '{}',
  commission_mode TEXT CHECK(commission_mode IS NULL OR commission_mode IN ('FIXED','PERCENT')),
  commission_value REAL,
  reviewed_by INTEGER REFERENCES users(user_id),
  reviewed_at TEXT,
  reject_reason TEXT,
  created_org_id INTEGER REFERENCES organizations(org_id),
  created_user_id INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signup_status ON signup_requests(status);
CREATE INDEX IF NOT EXISTS idx_signup_dist ON signup_requests(distributor_org_id);
CREATE INDEX IF NOT EXISTS idx_signup_phone ON signup_requests(phone);
CREATE INDEX IF NOT EXISTS idx_signup_login ON signup_requests(login_id);

-- 5. 가입 시 선택한 읍면동
CREATE TABLE IF NOT EXISTS signup_request_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES signup_requests(request_id) ON DELETE CASCADE,
  region_id INTEGER NOT NULL REFERENCES admin_regions(region_id),
  is_within_distributor INTEGER NOT NULL DEFAULT 1,
  UNIQUE(request_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_srr_request ON signup_request_regions(request_id);

-- 6. 권역 추가 요청 (총판에 매핑 안 된 지역을 SUPER_ADMIN에게 요청)
CREATE TABLE IF NOT EXISTS region_add_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  signup_request_id INTEGER REFERENCES signup_requests(request_id),
  team_org_id INTEGER REFERENCES organizations(org_id),
  distributor_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
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

CREATE INDEX IF NOT EXISTS idx_rar_status ON region_add_requests(status);
CREATE INDEX IF NOT EXISTS idx_rar_dist ON region_add_requests(distributor_org_id);

-- 7. 팀-총판 다대다 매핑 (기본은 parent_org_id, SUPER_ADMIN이 추가 매핑)
CREATE TABLE IF NOT EXISTS team_distributor_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  distributor_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  mapped_at TEXT NOT NULL DEFAULT (datetime('now')),
  mapped_by INTEGER REFERENCES users(user_id),
  UNIQUE(team_org_id, distributor_org_id)
);

CREATE INDEX IF NOT EXISTS idx_tdm_team ON team_distributor_mappings(team_org_id);
CREATE INDEX IF NOT EXISTS idx_tdm_dist ON team_distributor_mappings(distributor_org_id);
