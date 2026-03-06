-- ============================================================
-- Airflow(DAHADA) OMS - Database Schema v1.0
-- 주문처리/배분/검수/정산/대사/통계 시스템
-- ============================================================

-- 1. 조직 (Organizations)
CREATE TABLE IF NOT EXISTS organizations (
  org_id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_type TEXT NOT NULL CHECK(org_type IN ('HQ','REGION')),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. 사용자 (Users)
CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  login_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login_id);

-- 3. 역할 (Roles)
CREATE TABLE IF NOT EXISTS roles (
  role_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT
);

-- 4. 사용자-역할 매핑
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  role_id INTEGER NOT NULL REFERENCES roles(role_id),
  PRIMARY KEY(user_id, role_id)
);

-- 5. 지역권 (Territories)
CREATE TABLE IF NOT EXISTS territories (
  territory_id INTEGER PRIMARY KEY AUTOINCREMENT,
  sido TEXT NOT NULL,
  sigungu TEXT NOT NULL,
  eupmyeondong TEXT,
  admin_dong_code TEXT NOT NULL,
  legal_dong_code TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_territories_admin ON territories(admin_dong_code);

-- 6. 조직-지역권 매핑
CREATE TABLE IF NOT EXISTS org_territories (
  org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  territory_id INTEGER NOT NULL REFERENCES territories(territory_id),
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  effective_to TEXT,
  PRIMARY KEY(org_id, territory_id, effective_from)
);

-- 7. 배분 정책 (Distribution Policies)
CREATE TABLE IF NOT EXISTS distribution_policies (
  policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  rule_json TEXT NOT NULL DEFAULT '{}',
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. 보고서 필수요건 정책
CREATE TABLE IF NOT EXISTS report_policies (
  policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  service_type TEXT NOT NULL DEFAULT 'DEFAULT',
  required_photos_json TEXT NOT NULL DEFAULT '{"BEFORE":1,"AFTER":1,"WASH":1,"RECEIPT":1}',
  required_checklist_json TEXT NOT NULL DEFAULT '[]',
  require_receipt INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. 수수료 정책 (Commission Policies)
CREATE TABLE IF NOT EXISTS commission_policies (
  commission_policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  team_leader_id INTEGER REFERENCES users(user_id),
  mode TEXT NOT NULL CHECK(mode IN ('FIXED','PERCENT')),
  value REAL NOT NULL DEFAULT 0,
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_commission_org ON commission_policies(org_id);
CREATE INDEX IF NOT EXISTS idx_commission_leader ON commission_policies(team_leader_id);

-- 10. 통계 기준 정책 (Metrics Policy)
CREATE TABLE IF NOT EXISTS metrics_policies (
  metrics_policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
  completion_basis TEXT NOT NULL DEFAULT 'SUBMITTED_AT' CHECK(completion_basis IN ('SUBMITTED_AT','HQ_APPROVED_AT','SETTLEMENT_CONFIRMED_AT')),
  region_intake_basis TEXT NOT NULL DEFAULT 'DISTRIBUTED_AT' CHECK(region_intake_basis IN ('DISTRIBUTED_AT','REGION_ACCEPT_AT')),
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 11. 주문 수신 배치
CREATE TABLE IF NOT EXISTS order_import_batches (
  batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL DEFAULT 'FILE' CHECK(source_type IN ('FILE','API')),
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  raw_payload_url TEXT,
  file_name TEXT,
  checksum TEXT,
  total_rows INTEGER DEFAULT 0,
  success_rows INTEGER DEFAULT 0,
  fail_rows INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(status IN ('RECEIVED','PARSING','PARSED','FAILED')),
  error_summary TEXT,
  created_by INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 12. 주문 (Orders) - 핵심 테이블
CREATE TABLE IF NOT EXISTS orders (
  order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER REFERENCES order_import_batches(batch_id),
  external_order_no TEXT,
  source_fingerprint TEXT,
  service_type TEXT NOT NULL DEFAULT 'DEFAULT',
  customer_name TEXT,
  customer_phone TEXT,
  address_text TEXT NOT NULL,
  address_detail TEXT,
  admin_dong_code TEXT,
  legal_dong_code TEXT,
  requested_date TEXT,
  scheduled_date TEXT,
  base_amount REAL NOT NULL DEFAULT 0,
  raw_json TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(status IN (
    'RECEIVED','VALIDATED','DISTRIBUTION_PENDING','DISTRIBUTED',
    'ASSIGNED','IN_PROGRESS','SUBMITTED',
    'REGION_APPROVED','REGION_REJECTED',
    'HQ_APPROVED','HQ_REJECTED',
    'SETTLEMENT_CONFIRMED','PAID'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_external ON orders(external_order_no);
CREATE INDEX IF NOT EXISTS idx_orders_fingerprint ON orders(source_fingerprint, requested_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_admin_dong ON orders(admin_dong_code);
CREATE INDEX IF NOT EXISTS idx_orders_batch ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(requested_date);

-- 13. 주문 배분 (Airflow→지역총판)
CREATE TABLE IF NOT EXISTS order_distributions (
  distribution_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  region_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  distributed_by INTEGER REFERENCES users(user_id),
  distributed_at TEXT NOT NULL DEFAULT (datetime('now')),
  distribution_policy_version INTEGER,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REASSIGNED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dist_order ON order_distributions(order_id);
CREATE INDEX IF NOT EXISTS idx_dist_region ON order_distributions(region_org_id);
CREATE INDEX IF NOT EXISTS idx_dist_date ON order_distributions(distributed_at);

-- 14. 주문 할당 (지역총판→팀장)
CREATE TABLE IF NOT EXISTS order_assignments (
  assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  team_leader_id INTEGER NOT NULL REFERENCES users(user_id),
  assigned_by INTEGER REFERENCES users(user_id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN (
    'ASSIGNED','IN_PROGRESS','SUBMITTED',
    'REGION_APPROVED','REGION_REJECTED',
    'HQ_APPROVED','HQ_REJECTED',
    'SETTLEMENT_CONFIRMED','REASSIGNED'
  )),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assign_order ON order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_assign_leader ON order_assignments(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_assign_date ON order_assignments(assigned_at);
CREATE INDEX IF NOT EXISTS idx_assign_status ON order_assignments(status);

-- 15. 주문 상태 이력 (감사로그)
CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id INTEGER REFERENCES users(user_id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_history_date ON order_status_history(created_at);

-- 16. 작업 보고서
CREATE TABLE IF NOT EXISTS work_reports (
  report_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  team_leader_id INTEGER NOT NULL REFERENCES users(user_id),
  policy_id_snapshot INTEGER REFERENCES report_policies(policy_id),
  checklist_json TEXT DEFAULT '{}',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_report_order ON work_reports(order_id);
CREATE INDEX IF NOT EXISTS idx_report_leader ON work_reports(team_leader_id);

-- 17. 보고서 사진
CREATE TABLE IF NOT EXISTS work_report_photos (
  photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES work_reports(report_id),
  category TEXT NOT NULL CHECK(category IN ('BEFORE','AFTER','WASH','RECEIPT','ETC')),
  file_url TEXT NOT NULL,
  file_hash TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_photo_report ON work_report_photos(report_id);

-- 18. 검수 (2단계)
CREATE TABLE IF NOT EXISTS reviews (
  review_id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES work_reports(report_id),
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  stage TEXT NOT NULL CHECK(stage IN ('REGION','HQ')),
  reviewer_id INTEGER NOT NULL REFERENCES users(user_id),
  result TEXT NOT NULL CHECK(result IN ('APPROVE','REJECT')),
  reason_codes_json TEXT DEFAULT '[]',
  comment TEXT,
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_review_report ON reviews(report_id);
CREATE INDEX IF NOT EXISTS idx_review_order ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_review_stage ON reviews(stage, result);

-- 19. 정산 실행 (주/월)
CREATE TABLE IF NOT EXISTS settlement_runs (
  run_id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_scope TEXT NOT NULL DEFAULT 'HQ' CHECK(org_scope IN ('HQ','REGION')),
  period_type TEXT NOT NULL CHECK(period_type IN ('WEEKLY','MONTHLY')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','CALCULATED','CONFIRMED','PAID')),
  total_base_amount REAL DEFAULT 0,
  total_commission_amount REAL DEFAULT 0,
  total_payable_amount REAL DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 20. 정산 명세
CREATE TABLE IF NOT EXISTS settlements (
  settlement_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES settlement_runs(run_id),
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  team_leader_id INTEGER NOT NULL REFERENCES users(user_id),
  region_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  base_amount REAL NOT NULL DEFAULT 0,
  commission_mode TEXT NOT NULL CHECK(commission_mode IN ('FIXED','PERCENT')),
  commission_rate REAL NOT NULL DEFAULT 0,
  commission_amount REAL NOT NULL DEFAULT 0,
  payable_amount REAL NOT NULL DEFAULT 0,
  period_type TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CONFIRMED','PAID','CANCELED')),
  confirmed_by INTEGER REFERENCES users(user_id),
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_settlement_run ON settlements(run_id);
CREATE INDEX IF NOT EXISTS idx_settlement_order ON settlements(order_id);
CREATE INDEX IF NOT EXISTS idx_settlement_leader ON settlements(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_settlement_status ON settlements(status);

-- 21. 팀장 일자별 원장
CREATE TABLE IF NOT EXISTS team_leader_ledger_daily (
  date TEXT NOT NULL,
  team_leader_id INTEGER NOT NULL REFERENCES users(user_id),
  confirmed_payable_sum REAL NOT NULL DEFAULT 0,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(date, team_leader_id)
);

-- 22. 대사(정합성 검증) 실행
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  run_id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_range_start TEXT NOT NULL,
  date_range_end TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'HQ' CHECK(scope IN ('HQ','REGION')),
  total_issues INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RUNNING' CHECK(status IN ('RUNNING','DONE','FAILED')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

-- 23. 대사 이슈
CREATE TABLE IF NOT EXISTS reconciliation_issues (
  issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES reconciliation_runs(run_id),
  order_id INTEGER REFERENCES orders(order_id),
  type TEXT NOT NULL CHECK(type IN (
    'DUPLICATE_ORDER','DISTRIBUTION_MISSING','ASSIGNMENT_MISSING',
    'REPORT_MISSING','PHOTO_COUNT_INSUFFICIENT','ORPHAN_PHOTO',
    'STATUS_INCONSISTENT','AMOUNT_MISMATCH'
  )),
  severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  detail_json TEXT DEFAULT '{}',
  resolved_at TEXT,
  resolver_id INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recon_run ON reconciliation_issues(run_id);
CREATE INDEX IF NOT EXISTS idx_recon_type ON reconciliation_issues(type);
CREATE INDEX IF NOT EXISTS idx_recon_severity ON reconciliation_issues(severity);

-- 24. 지역총판 일자별 통계
CREATE TABLE IF NOT EXISTS region_daily_stats (
  date TEXT NOT NULL,
  region_org_id INTEGER NOT NULL REFERENCES organizations(org_id),
  intake_count INTEGER NOT NULL DEFAULT 0,
  assigned_to_team_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  region_approved_count INTEGER NOT NULL DEFAULT 0,
  hq_approved_count INTEGER NOT NULL DEFAULT 0,
  settlement_confirmed_count INTEGER NOT NULL DEFAULT 0,
  base_amount_sum REAL NOT NULL DEFAULT 0,
  payable_amount_sum REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(date, region_org_id)
);

-- 25. 팀장 일자별 통계
CREATE TABLE IF NOT EXISTS team_leader_daily_stats (
  date TEXT NOT NULL,
  team_leader_id INTEGER NOT NULL REFERENCES users(user_id),
  intake_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  submitted_count INTEGER NOT NULL DEFAULT 0,
  region_approved_count INTEGER NOT NULL DEFAULT 0,
  hq_approved_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  settlement_confirmed_count INTEGER NOT NULL DEFAULT 0,
  base_amount_sum REAL NOT NULL DEFAULT 0,
  payable_amount_sum REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(date, team_leader_id)
);

-- 26. 감사 로그 (범용)
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  actor_id INTEGER REFERENCES users(user_id),
  detail_json TEXT DEFAULT '{}',
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);

-- 27. 세션 (간이 인증)
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_session_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions(expires_at);
