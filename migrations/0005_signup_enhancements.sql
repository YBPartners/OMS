-- ============================================================
-- Migration 0005: 가입 시스템 보완
-- phone_verifications 확장, purpose SIGNUP 추가
-- ============================================================

-- 1. phone_verifications에 verify_token, verify_token_expires 컬럼 추가
ALTER TABLE phone_verifications ADD COLUMN verify_token TEXT;
ALTER TABLE phone_verifications ADD COLUMN verify_token_expires TEXT;

-- 2. purpose에 SIGNUP 추가 (SQLite CHECK 제약 우회 — 새 테이블 생성)
CREATE TABLE IF NOT EXISTS phone_verifications_new (
  verification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'REGISTER' CHECK(purpose IN ('REGISTER','LOGIN','RESET_PW','SIGNUP')),
  user_id INTEGER REFERENCES users(user_id),
  verified INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  verify_token TEXT,
  verify_token_expires TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO phone_verifications_new (verification_id, phone, otp_code, purpose, user_id, verified, attempts, expires_at, verify_token, verify_token_expires, created_at)
SELECT verification_id, phone, otp_code, purpose, user_id, verified, attempts, expires_at, verify_token, verify_token_expires, created_at FROM phone_verifications;

DROP TABLE phone_verifications;
ALTER TABLE phone_verifications_new RENAME TO phone_verifications;

CREATE INDEX IF NOT EXISTS idx_phone_verif_phone ON phone_verifications(phone, purpose);
CREATE INDEX IF NOT EXISTS idx_phone_verif_expires ON phone_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_verif_token ON phone_verifications(verify_token);
