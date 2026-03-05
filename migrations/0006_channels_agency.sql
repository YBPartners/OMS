-- ============================================================
-- Migration 0006: 주문 채널(다채널) + 대리점(AGENCY) 계층 추가
-- Phase 7.0: 주문원장(N개) → HQ → 총판 → 대리점 → 팀장
-- ============================================================

-- 1. 주문 채널 테이블 (다채널 원장)
CREATE TABLE IF NOT EXISTS order_channels (
  channel_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  contact_info TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 기본 채널 생성
INSERT OR IGNORE INTO order_channels (channel_id, name, code, description, is_active, priority) VALUES
  (1, '기본 채널', 'DEFAULT', '시스템 기본 주문 채널', 1, 0);

-- 2. orders 테이블에 channel_id 컬럼 추가 (NULL 허용, 외래키 없이)
ALTER TABLE orders ADD COLUMN channel_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel_id);

-- 기존 주문에 기본 채널 설정
UPDATE orders SET channel_id = 1 WHERE channel_id IS NULL;

-- 3. 대리점(AGENCY) 역할 추가
INSERT OR IGNORE INTO roles (code, name, description) VALUES
  ('AGENCY_LEADER', '대리점장', '대리점 운영 - 하위 팀장 주문 관리/배정/1차검수');

-- 4. 대리점-팀장 매핑 테이블 (어떤 팀장이 어떤 대리점 소속인지)
CREATE TABLE IF NOT EXISTS agency_team_mappings (
  agency_user_id INTEGER NOT NULL REFERENCES users(user_id),
  team_user_id INTEGER NOT NULL REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(agency_user_id, team_user_id)
);
CREATE INDEX IF NOT EXISTS idx_agency_team_agency ON agency_team_mappings(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_team_team ON agency_team_mappings(team_user_id);

-- 5. order_import_batches에 channel_id 추가
ALTER TABLE order_import_batches ADD COLUMN channel_id INTEGER;

-- 6. commission_policies에 updated_at 컬럼 추가 (기존 이슈 #3 해결)
ALTER TABLE commission_policies ADD COLUMN updated_at TEXT;
