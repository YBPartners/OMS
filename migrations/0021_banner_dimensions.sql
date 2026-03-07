-- ================================================================
-- Airflow OMS — 배너 크기(가로/세로) 컬럼 추가
-- 배너 등록 시 사이즈 직접 입력 지원
-- ================================================================

ALTER TABLE banners ADD COLUMN width INTEGER;   -- 배너 너비 (px), NULL이면 100% 자동
ALTER TABLE banners ADD COLUMN height INTEGER;  -- 배너 높이 (px), NULL이면 비율 유지
