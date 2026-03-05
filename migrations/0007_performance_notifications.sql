-- ============================================================
-- 0007_performance_notifications.sql
-- Phase 10: 성능 최적화 인덱스 + 알림 설정 테이블
-- ============================================================

-- ─── 1. 복합 인덱스 (쿼리 패턴 기반) ───

-- 주문: 상태 + 생성일 (대시보드 통계, 목록 조회)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);

-- 주문: 생성일 내림차순 (목록 페이지네이션)
CREATE INDEX IF NOT EXISTS idx_orders_created_desc ON orders(created_at DESC);

-- 알림: 수신자 + 읽음 여부 + 생성일 (미읽음 카운트, 목록)
CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(recipient_user_id, is_read, created_at DESC);

-- 알림: 수신자 + 생성일 (알림 목록 페이지네이션)
CREATE INDEX IF NOT EXISTS idx_notif_user_date ON notifications(recipient_user_id, created_at DESC);

-- 세션: 세션ID (인증 미들웨어 매 요청)
CREATE INDEX IF NOT EXISTS idx_session_id ON sessions(session_id);

-- 세션: 사용자ID + 만료일 (세션 정리, 무효화)
CREATE INDEX IF NOT EXISTS idx_session_user_exp ON sessions(user_id, expires_at);

-- 조직: 부모 + 타입 + 상태 (하위 조직 조회)
CREATE INDEX IF NOT EXISTS idx_org_parent_type ON organizations(parent_org_id, org_type, status);

-- 감사로그: 생성일 (최근 로그 조회)
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- 감사로그: 사용자 + 생성일 (사용자별 활동)
CREATE INDEX IF NOT EXISTS idx_audit_actor_date ON audit_logs(actor_id, created_at DESC);

-- 주문배분: 주문ID + 상태 (활성 배분 조회)
CREATE INDEX IF NOT EXISTS idx_dist_order_status ON order_distributions(order_id, status);

-- 주문배정: 주문ID + 상태 (활성 배정 조회)
CREATE INDEX IF NOT EXISTS idx_assign_order_status ON order_assignments(order_id, status);

-- 지역일별통계: 날짜 + 지역 (대시보드 차트)
CREATE INDEX IF NOT EXISTS idx_rds_date_region ON region_daily_stats(date DESC, region_org_id);

-- 팀장일별통계: 날짜 + 팀장 (통계 조회)
CREATE INDEX IF NOT EXISTS idx_tlds_date_leader ON team_leader_daily_stats(date DESC, team_leader_id);

-- OTP 인증: 핸드폰 + 생성일 (Rate limiting)
CREATE INDEX IF NOT EXISTS idx_phoneverify_phone_date ON phone_verifications(phone, created_at DESC);

-- 가입요청 지역: 요청ID + 지역ID (중복 체크)
CREATE INDEX IF NOT EXISTS idx_srr_request_region ON signup_request_regions(request_id, region_id);

-- ─── 2. 알림 설정 테이블 ───

CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  -- 알림 유형별 on/off
  notify_order_status INTEGER NOT NULL DEFAULT 1,     -- 주문 상태 변경
  notify_assignment INTEGER NOT NULL DEFAULT 1,        -- 배정/배정해제
  notify_review INTEGER NOT NULL DEFAULT 1,            -- 검수 결과
  notify_settlement INTEGER NOT NULL DEFAULT 1,        -- 정산 관련
  notify_signup INTEGER NOT NULL DEFAULT 1,            -- 가입 요청/승인
  notify_system INTEGER NOT NULL DEFAULT 1,            -- 시스템 공지
  -- 알림 수단
  push_enabled INTEGER NOT NULL DEFAULT 1,             -- 인앱 푸시 (폴링)
  sound_enabled INTEGER NOT NULL DEFAULT 1,            -- 알림 소리
  -- 메타
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifpref_user ON notification_preferences(user_id);
