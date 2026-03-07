-- ================================================================
-- 사용자별 지역 매핑 (주문 수취 권한) — user_region_mappings
-- 팀장 개인에게 특정 행정동/구역을 매핑하여 주문 수취 권한 부여
-- ================================================================

CREATE TABLE IF NOT EXISTS user_region_mappings (
  mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  admin_region_id INTEGER NOT NULL,
  assigned_by INTEGER,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (admin_region_id) REFERENCES admin_regions(region_id),
  FOREIGN KEY (assigned_by) REFERENCES users(user_id),
  UNIQUE(user_id, admin_region_id)
);

CREATE INDEX IF NOT EXISTS idx_urm_user ON user_region_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_urm_region ON user_region_mappings(admin_region_id);

-- 배너 크기 컬럼 추가
-- ALTER TABLE banners ADD COLUMN width INTEGER DEFAULT NULL;
-- ALTER TABLE banners ADD COLUMN height INTEGER DEFAULT NULL;
-- D1은 ALTER TABLE ADD COLUMN을 지원하므로 아래 실행:
