-- ============================================================
-- Migration 0002: 인사관리 + 핸드폰 인증 기능 추가
-- ============================================================

-- users 테이블 확장
ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN joined_at TEXT;
ALTER TABLE users ADD COLUMN memo TEXT;

-- 핸드폰 인증 테이블
CREATE TABLE IF NOT EXISTS phone_verifications (
  verification_id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'REGISTER' CHECK(purpose IN ('REGISTER','LOGIN','RESET_PW')),
  user_id INTEGER REFERENCES users(user_id),
  verified INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_phone_verif_phone ON phone_verifications(phone, purpose);
CREATE INDEX IF NOT EXISTS idx_phone_verif_expires ON phone_verifications(expires_at);
