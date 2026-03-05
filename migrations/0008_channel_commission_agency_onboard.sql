-- ============================================================
-- 0008_channel_commission_agency_onboard.sql
-- Phase 12: 채널별 수수료 + 대리점 온보딩
-- ============================================================

-- ─── 1. commission_policies에 channel_id 컬럼 추가 ───
ALTER TABLE commission_policies ADD COLUMN channel_id INTEGER REFERENCES order_channels(channel_id);

-- 채널별 수수료 인덱스
CREATE INDEX IF NOT EXISTS idx_commpol_channel ON commission_policies(channel_id);

-- ─── 2. 대리점 온보딩 트래킹 ───
CREATE TABLE IF NOT EXISTS agency_onboarding (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_user_id INTEGER NOT NULL REFERENCES users(user_id),
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  approved_by INTEGER REFERENCES users(user_id),
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agency_onboard_user ON agency_onboarding(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_onboard_status ON agency_onboarding(status);
