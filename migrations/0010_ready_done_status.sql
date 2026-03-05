-- ================================================================
-- 와이비 OMS Migration 0010: READY_DONE + DONE 상태 추가
-- 팀장 수행 플로우 정규화:
--   ASSIGNED(준비) → READY_DONE(준비완료) → IN_PROGRESS(수행중)
--   → SUBMITTED(완료전송) → DONE(최종완료) → REGION검수
-- ================================================================

-- orders 테이블의 CHECK 제약은 D1에서 ALTER로 변경 불가
-- 대신 새 테이블로 교체 (데이터 보존)

CREATE TABLE orders_new (
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
    'ASSIGNED','READY_DONE','IN_PROGRESS','SUBMITTED','DONE',
    'REGION_APPROVED','REGION_REJECTED',
    'HQ_APPROVED','HQ_REJECTED',
    'SETTLEMENT_CONFIRMED','PAID'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  channel_id INTEGER
);

INSERT INTO orders_new SELECT * FROM orders;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

-- order_assignments에도 새 상태 추가
CREATE TABLE order_assignments_new (
  assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  team_leader_id INTEGER NOT NULL REFERENCES users(user_id),
  assigned_by INTEGER REFERENCES users(user_id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN (
    'ASSIGNED','READY_DONE','IN_PROGRESS','SUBMITTED','DONE',
    'REGION_APPROVED','REGION_REJECTED',
    'HQ_APPROVED','HQ_REJECTED',
    'SETTLEMENT_CONFIRMED','REASSIGNED'
  )),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO order_assignments_new SELECT * FROM order_assignments;
DROP TABLE order_assignments;
ALTER TABLE order_assignments_new RENAME TO order_assignments;

-- 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_requested_date ON orders(requested_date);
CREATE INDEX IF NOT EXISTS idx_orders_admin_dong ON orders(admin_dong_code);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel_id);
CREATE INDEX IF NOT EXISTS idx_assignments_order ON order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_assignments_leader ON order_assignments(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON order_assignments(status);
