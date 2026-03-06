-- 0011: 파일 첨부 기능 확장 (사진 직접 업로드, 파일명 규칙화)
-- work_report_photos 테이블에 파일 데이터/이름 컬럼 추가 + category 확장

-- file_name: 규칙화된 파일명 (예: 20260306_TEAM001_작업전.jpg)
ALTER TABLE work_report_photos ADD COLUMN file_name TEXT;

-- file_size: 파일 크기 (bytes)  
ALTER TABLE work_report_photos ADD COLUMN file_size INTEGER DEFAULT 0;

-- mime_type: 파일 MIME 타입 (image/jpeg, image/png 등)
ALTER TABLE work_report_photos ADD COLUMN mime_type TEXT;

-- 기존 category CHECK 제약은 SQLite에서 ALTER로 변경 불가
-- 새로운 category 값들은 application-level에서 검증:
-- BEFORE, AFTER, WASH, RECEIPT, ETC, EXTERIOR, INTERIOR, BEFORE_WASH, AFTER_WASH, CUSTOMER_CONFIRM
