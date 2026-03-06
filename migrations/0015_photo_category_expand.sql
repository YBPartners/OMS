-- 0015: 사진 카테고리 CHECK 제약 확장
-- 기존: 'BEFORE','AFTER','WASH','RECEIPT','ETC' (원래 스키마)
-- 확장: 프론트엔드 체크리스트와 일치하도록 카테고리 추가
-- EXTERIOR, INTERIOR, BEFORE_WASH, AFTER_WASH, CUSTOMER_CONFIRM, EXTERIOR_PHOTO, INTERIOR_PHOTO

-- SQLite에서는 CHECK 제약 변경이 불가하므로 테이블 재생성
PRAGMA foreign_keys=OFF;

CREATE TABLE work_report_photos_new (
  photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES work_reports(report_id),
  category TEXT NOT NULL CHECK(category IN (
    'BEFORE','AFTER','WASH','RECEIPT','ETC',
    'EXTERIOR','INTERIOR','BEFORE_WASH','AFTER_WASH',
    'CUSTOMER_CONFIRM','EXTERIOR_PHOTO','INTERIOR_PHOTO'
  )),
  file_url TEXT NOT NULL,
  file_hash TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  file_name TEXT,
  file_size INTEGER DEFAULT 0,
  mime_type TEXT
);

INSERT INTO work_report_photos_new SELECT * FROM work_report_photos;
DROP TABLE work_report_photos;
ALTER TABLE work_report_photos_new RENAME TO work_report_photos;

CREATE INDEX IF NOT EXISTS idx_wrp_report ON work_report_photos(report_id);

PRAGMA foreign_keys=ON;
