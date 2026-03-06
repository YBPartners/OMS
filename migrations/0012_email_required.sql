-- ============================================================
-- Airflow OMS — Migration 0012: 이메일 필수화 + Resend 연동 준비
-- 정산서 수취를 위한 이메일 필수 수집
-- ============================================================

-- 1. signup_requests 테이블에 email 컬럼 추가
ALTER TABLE signup_requests ADD COLUMN email TEXT;

-- 2. users 테이블에 email_verified 컬럼 추가 (이메일 확인 여부)
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

-- 3. 이메일 발송 이력 테이블
CREATE TABLE IF NOT EXISTS email_send_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_email TEXT NOT NULL,
  recipient_user_id INTEGER REFERENCES users(user_id),
  subject TEXT NOT NULL,
  template_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','FAILED')),
  resend_message_id TEXT,
  error_detail TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_log_user ON email_send_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_send_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_log_date ON email_send_logs(created_at);
