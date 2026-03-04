-- ============================================================
-- 다하다 OMS — Migration 0004: 혁신 v5.0
-- 알림 시스템, 정산 team_org_id, 감사 인덱스
-- ============================================================

-- 1. 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_user_id INTEGER NOT NULL REFERENCES users(user_id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_date ON notifications(created_at);

-- 2. settlements에 team_org_id 추가 (팀 단위 정산 — 팀장 이동 시 이력 보존)
ALTER TABLE settlements ADD COLUMN team_org_id INTEGER REFERENCES organizations(org_id);

-- 3. audit_logs 검색 개선 인덱스
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity_date ON audit_logs(entity_type, created_at);
