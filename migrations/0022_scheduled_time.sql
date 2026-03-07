-- 0022: 준비완료 시 방문 시간 입력 + 캘린더 뷰 지원
-- scheduled_time: HH:MM 형식 (예: '09:30', '14:00')
ALTER TABLE orders ADD COLUMN scheduled_time TEXT;

-- 캘린더 뷰에서 날짜+시간 범위 검색 최적화
CREATE INDEX IF NOT EXISTS idx_orders_schedule
  ON orders(scheduled_date, scheduled_time, status);
