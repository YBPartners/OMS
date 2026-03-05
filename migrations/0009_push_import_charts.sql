-- Migration 0009: 푸시 알림 구독 + 데이터 임포트 로그
-- Phase 14.0: 웹 푸시, 데이터 임포트/백업, 대시보드 차트

-- 푸시 구독 정보 저장 (notification_preferences 확장)
ALTER TABLE notification_preferences ADD COLUMN push_subscription TEXT DEFAULT NULL;

-- 데이터 임포트 이력 테이블
CREATE TABLE IF NOT EXISTS import_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  mode TEXT DEFAULT 'insert',
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  error_details TEXT,
  actor_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_import_logs_actor ON import_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_created ON import_logs(created_at);
