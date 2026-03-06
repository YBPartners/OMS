-- ================================================================
-- 와이비 OMS — 광고 배너 시스템 마이그레이션
-- 내부 슬라이딩 배너 + 구글 애드센스 설정 관리
-- ================================================================

-- 내부 배너 광고 테이블
CREATE TABLE IF NOT EXISTS banners (
  banner_id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,                          -- 관리용 배너 제목
  image_url TEXT,                               -- 배너 이미지 URL (외부 또는 base64)
  image_base64 TEXT,                            -- base64 인코딩 이미지 데이터
  link_url TEXT,                                -- 클릭 시 이동 URL
  link_target TEXT NOT NULL DEFAULT '_blank' CHECK(link_target IN ('_blank', '_self')),
  position TEXT NOT NULL DEFAULT 'dashboard_top' CHECK(position IN (
    'dashboard_top',       -- 대시보드 상단 (가장 노출 높은 자리)
    'sidebar_bottom',      -- 사이드바 하단
    'content_between',     -- 컨텐츠 사이
    'login_page'           -- 로그인 페이지
  )),
  bg_color TEXT DEFAULT '#ffffff',              -- 배경색 (이미지 없는 텍스트 배너용)
  text_content TEXT,                            -- 텍스트 내용 (HTML 지원)
  text_color TEXT DEFAULT '#000000',            -- 텍스트 색상
  sort_order INTEGER NOT NULL DEFAULT 0,        -- 정렬 순서 (낮을수록 먼저)
  is_active INTEGER NOT NULL DEFAULT 1,         -- 활성 상태
  start_date TEXT,                              -- 노출 시작일 (NULL이면 즉시)
  end_date TEXT,                                -- 노출 종료일 (NULL이면 무기한)
  click_count INTEGER NOT NULL DEFAULT 0,       -- 클릭 수 추적
  view_count INTEGER NOT NULL DEFAULT 0,        -- 노출 수 추적
  created_by INTEGER REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 배너 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_banners_position ON banners(position, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_banners_dates ON banners(start_date, end_date);

-- 구글 애드센스 설정 (시스템 설정 테이블 활용)
CREATE TABLE IF NOT EXISTS ad_settings (
  setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,             -- 설정 키
  setting_value TEXT,                           -- 설정 값
  description TEXT,                             -- 설명
  updated_by INTEGER REFERENCES users(user_id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 기본 애드센스 설정 삽입
INSERT OR IGNORE INTO ad_settings (setting_key, setting_value, description) VALUES
  ('adsense_enabled', '0', '구글 애드센스 활성화 여부'),
  ('adsense_client_id', '', '구글 애드센스 클라이언트 ID (ca-pub-XXXXXXXXXX)'),
  ('adsense_slot_dashboard', '', '대시보드 광고 슬롯 ID'),
  ('adsense_slot_sidebar', '', '사이드바 광고 슬롯 ID'),
  ('adsense_slot_content', '', '컨텐츠 내 광고 슬롯 ID'),
  ('banner_autoplay_interval', '5000', '배너 자동 전환 간격 (ms)'),
  ('banner_enabled', '1', '내부 배너 시스템 활성화 여부'),
  ('domain_name', 'www.airflow.co.kr', '서비스 도메인');
