-- ================================================================
-- 0017: order_assignments CHECK 제약에 PAID 상태 추가
-- SQLite는 ALTER CHECK 불가 → 테이블 재생성
-- ================================================================

-- 1. 임시 테이블에 데이터 복사
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
    'SETTLEMENT_CONFIRMED','PAID','REASSIGNED'
  )),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. 데이터 이전
INSERT INTO order_assignments_new
  SELECT * FROM order_assignments;

-- 3. 기존 테이블 삭제 후 이름 변경
DROP TABLE order_assignments;
ALTER TABLE order_assignments_new RENAME TO order_assignments;

-- 4. 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_oa_order_id ON order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_oa_team_leader ON order_assignments(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_oa_status ON order_assignments(status);
