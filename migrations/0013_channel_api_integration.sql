-- ============================================================
-- Migration 0013: 주문 채널 API 연동 설정
-- 각 채널별로 외부 API 수신 규격을 설정할 수 있도록 확장
-- ============================================================

-- 1. order_channels에 API 연동 필드 추가
ALTER TABLE order_channels ADD COLUMN api_endpoint TEXT;          -- 외부 API 엔드포인트 URL
ALTER TABLE order_channels ADD COLUMN api_method TEXT DEFAULT 'GET'; -- HTTP 메서드 (GET, POST)
ALTER TABLE order_channels ADD COLUMN auth_type TEXT DEFAULT 'NONE'; -- 인증 방식: NONE, API_KEY, BEARER, BASIC, CUSTOM_HEADER
ALTER TABLE order_channels ADD COLUMN auth_credentials TEXT;      -- 인증 정보 (JSON: {key, value, username, password 등})
ALTER TABLE order_channels ADD COLUMN request_headers TEXT;       -- 추가 요청 헤더 (JSON: [{key, value}])
ALTER TABLE order_channels ADD COLUMN request_body_template TEXT; -- POST 요청 시 바디 템플릿 (JSON)
ALTER TABLE order_channels ADD COLUMN response_type TEXT DEFAULT 'JSON'; -- 응답 형식: JSON, XML, CSV
ALTER TABLE order_channels ADD COLUMN field_mapping TEXT;         -- 필드 매핑 (JSON: {외부필드: 내부필드})
ALTER TABLE order_channels ADD COLUMN data_path TEXT;             -- 응답에서 주문 배열 경로 (예: "data.orders", "result.list")
ALTER TABLE order_channels ADD COLUMN polling_interval_min INTEGER DEFAULT 0; -- 폴링 주기(분), 0=수동
ALTER TABLE order_channels ADD COLUMN last_sync_at TEXT;          -- 마지막 동기화 시각
ALTER TABLE order_channels ADD COLUMN last_sync_status TEXT;      -- 마지막 동기화 상태: SUCCESS, FAIL, PARTIAL
ALTER TABLE order_channels ADD COLUMN last_sync_message TEXT;     -- 마지막 동기화 메시지/에러
ALTER TABLE order_channels ADD COLUMN last_sync_count INTEGER DEFAULT 0; -- 마지막 동기화 건수
ALTER TABLE order_channels ADD COLUMN total_synced_count INTEGER DEFAULT 0; -- 누적 동기화 건수
ALTER TABLE order_channels ADD COLUMN api_enabled INTEGER NOT NULL DEFAULT 0; -- API 연동 활성화 여부

-- 2. 에어컨 세척 주문 채널 설정
-- 기존 DEFAULT → 로컬, KT → 삼성, LGU → 엘지, SK → 캐리어
UPDATE order_channels SET name='로컬', code='LOCAL', description='로컬 업체/자체 접수 주문 채널', is_active=1, priority=10 WHERE channel_id=1;
UPDATE order_channels SET name='삼성', code='SAMSUNG', description='삼성전자 에어컨 세척 주문 채널', is_active=1, priority=90 WHERE channel_id=2;
UPDATE order_channels SET name='엘지', code='LG', description='LG전자 에어컨 세척 주문 채널', is_active=1, priority=80 WHERE channel_id=3;
UPDATE order_channels SET name='캐리어', code='CARRIER', description='캐리어 에어컨 세척 주문 채널', is_active=1, priority=70 WHERE channel_id=4;

-- 아정당(AJD) 채널 추가 (1호 채널)
INSERT OR IGNORE INTO order_channels (name, code, description, contact_info, is_active, priority, api_enabled)
VALUES ('아정당', 'AJD', '아정당 주문 채널 - 본사 주문 수신 1호 채널', '아정당 담당자', 1, 100, 0);
