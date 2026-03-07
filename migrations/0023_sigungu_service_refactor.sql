-- ================================================================
-- Airflow OMS Migration 0023: 시군구 전환 + 서비스항목 단가표 + 가격확정 플로우
-- 
-- 핵심 변경:
--   1. 행정동(3,042개) → 시군구(~250개) 전환
--   2. 총판/팀장 시군구 기반 매핑
--   3. 채널별 서비스항목 단가표
--   4. 주문 상세항목(order_items) + 가격확정 워크플로우
--   5. 현장 변동 이력(order_item_changes)
--
-- 삭제: admin_regions, org_territories, user_region_mappings, territories
-- 삭제: orders.admin_dong_code, orders.legal_dong_code, orders.service_type
-- 삭제: VALIDATED 상태
-- 추가: CONFIRMED (가격확정) 상태
-- ================================================================

-- ================================================================
-- STEP 1: 신규 테이블 생성
-- ================================================================

-- 1-1. 시군구 마스터 (~250개)
CREATE TABLE IF NOT EXISTS sigungu (
  sigungu_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,             -- 시군구 5자리 코드 (예: '11110')
  sido TEXT NOT NULL,                    -- 시도명 (예: '서울특별시')
  sigungu TEXT NOT NULL,                 -- 시군구명 (예: '종로구')
  full_name TEXT NOT NULL,               -- 전체명 (예: '서울특별시 종로구')
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sigungu_code ON sigungu(code);
CREATE INDEX IF NOT EXISTS idx_sigungu_sido ON sigungu(sido);
CREATE INDEX IF NOT EXISTS idx_sigungu_name ON sigungu(sigungu);
CREATE INDEX IF NOT EXISTS idx_sigungu_full ON sigungu(full_name);

-- 1-2. 총판 ↔ 시군구 매핑
CREATE TABLE IF NOT EXISTS region_sigungu_map (
  map_id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_org_id INTEGER NOT NULL,        -- organizations.org_id (총판)
  sigungu_code TEXT NOT NULL,            -- sigungu.code
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  effective_to TEXT,                      -- NULL이면 현재 활성
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (region_org_id) REFERENCES organizations(org_id),
  UNIQUE(region_org_id, sigungu_code, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_rsm_region ON region_sigungu_map(region_org_id);
CREATE INDEX IF NOT EXISTS idx_rsm_sigungu ON region_sigungu_map(sigungu_code);

-- 1-3. 팀장 ↔ 시군구 매핑
CREATE TABLE IF NOT EXISTS team_sigungu_map (
  map_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,              -- users.user_id (팀장)
  sigungu_code TEXT NOT NULL,            -- sigungu.code
  region_org_id INTEGER NOT NULL,        -- 소속 총판 org_id
  assigned_by INTEGER,                   -- 매핑한 사용자
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (region_org_id) REFERENCES organizations(org_id),
  UNIQUE(user_id, sigungu_code)
);
CREATE INDEX IF NOT EXISTS idx_tsm_user ON team_sigungu_map(user_id);
CREATE INDEX IF NOT EXISTS idx_tsm_sigungu ON team_sigungu_map(sigungu_code);
CREATE INDEX IF NOT EXISTS idx_tsm_region ON team_sigungu_map(region_org_id);

-- 1-4. 서비스 카테고리 (항목) 마스터
CREATE TABLE IF NOT EXISTS service_categories (
  category_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,             -- 고유 코드 (예: 'WALL_AC')
  group_name TEXT NOT NULL,              -- 그룹 (예: '벽걸이', '시스템', '스탠드')
  name TEXT NOT NULL,                    -- 항목명 (예: '벽걸이', '시스템 1way/2way')
  description TEXT,                      -- 설명
  sort_order INTEGER NOT NULL DEFAULT 0, -- 정렬 순서
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scat_code ON service_categories(code);
CREATE INDEX IF NOT EXISTS idx_scat_group ON service_categories(group_name);

-- 1-5. 채널별 서비스 단가표
CREATE TABLE IF NOT EXISTS service_prices (
  price_id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,          -- service_categories.category_id
  channel_id INTEGER NOT NULL,           -- order_channels.channel_id
  sell_price INTEGER NOT NULL DEFAULT 0, -- 고객 판매가 (원)
  work_price INTEGER NOT NULL DEFAULT 0, -- 기사(팀장) 수행가 (원)
  is_active INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  effective_to TEXT,                      -- NULL이면 현재 적용
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES service_categories(category_id),
  UNIQUE(category_id, channel_id, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_sp_category ON service_prices(category_id);
CREATE INDEX IF NOT EXISTS idx_sp_channel ON service_prices(channel_id);
CREATE INDEX IF NOT EXISTS idx_sp_active ON service_prices(is_active, effective_from);

-- 1-6. 서비스 옵션 (추가 금액)
CREATE TABLE IF NOT EXISTS service_options (
  option_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,             -- 옵션 코드 (예: 'LG_OBJE')
  name TEXT NOT NULL,                    -- 옵션명 (예: 'LG오브제 추가')
  additional_sell_price INTEGER NOT NULL DEFAULT 0, -- 추가 판매가
  additional_work_price INTEGER NOT NULL DEFAULT 0, -- 추가 수행가
  applicable_categories TEXT,            -- 적용 가능 카테고리 JSON (null이면 전체)
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1-7. 주문 상세 항목
CREATE TABLE IF NOT EXISTS order_items (
  item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,             -- orders.order_id
  category_id INTEGER NOT NULL,          -- service_categories.category_id
  quantity INTEGER NOT NULL DEFAULT 1,
  model_name TEXT,                       -- 모델명 (팀장 입력)
  options_json TEXT,                     -- 선택된 옵션 ID 배열 JSON
  unit_sell_price INTEGER NOT NULL DEFAULT 0, -- 단가 판매가 (스냅샷)
  unit_work_price INTEGER NOT NULL DEFAULT 0, -- 단가 수행가 (스냅샷)
  total_sell_price INTEGER NOT NULL DEFAULT 0, -- 수량 × 단가 + 옵션
  total_work_price INTEGER NOT NULL DEFAULT 0,
  notes TEXT,                            -- 비고
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (category_id) REFERENCES service_categories(category_id)
);
CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_oi_category ON order_items(category_id);

-- 1-8. 주문 항목 변동 이력 (현장 변동 추적)
CREATE TABLE IF NOT EXISTS order_item_changes (
  change_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  item_id INTEGER,                       -- NULL이면 주문 전체 변동
  change_type TEXT NOT NULL CHECK(change_type IN ('ADD', 'MODIFY', 'REMOVE', 'OPTION_ADD', 'OPTION_REMOVE')),
  reason TEXT NOT NULL,                  -- 변동 사유 (필수)
  before_json TEXT,                      -- 변경 전 데이터 JSON
  after_json TEXT,                       -- 변경 후 데이터 JSON
  sell_diff INTEGER NOT NULL DEFAULT 0,  -- 판매가 차이 (+/-)
  work_diff INTEGER NOT NULL DEFAULT 0,  -- 수행가 차이 (+/-)
  changed_by INTEGER NOT NULL,           -- 변경한 사용자
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (changed_by) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_oic_order ON order_item_changes(order_id);
CREATE INDEX IF NOT EXISTS idx_oic_item ON order_item_changes(item_id);

-- ================================================================
-- STEP 2: orders 테이블 재생성 (스키마 변경)
-- D1에서는 ALTER TABLE DROP COLUMN 불가 → 테이블 재생성
-- ================================================================

-- 2-1. 새 orders 테이블 생성
CREATE TABLE orders_new (
  order_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER REFERENCES order_import_batches(batch_id),
  external_order_no TEXT,
  source_fingerprint TEXT,
  -- service_type 삭제 (order_items로 대체)
  customer_name TEXT,
  customer_phone TEXT,
  address_text TEXT NOT NULL,
  address_detail TEXT,
  -- admin_dong_code, legal_dong_code 삭제
  sigungu_code TEXT,                     -- 시군구 5자리 코드 (신규)
  requested_date TEXT,
  scheduled_date TEXT,
  scheduled_time TEXT,
  base_amount REAL NOT NULL DEFAULT 0,   -- 기존 호환 (레거시)
  -- 가격확정 관련 신규 필드
  price_confirmed INTEGER NOT NULL DEFAULT 0,  -- 0: 미확정, 1: 확정
  confirmed_total_sell INTEGER NOT NULL DEFAULT 0,  -- 확정 판매가 합계
  confirmed_total_work INTEGER NOT NULL DEFAULT 0,  -- 확정 수행가 합계
  confirmed_at TEXT,                     -- 가격확정 일시
  confirmed_by INTEGER,                  -- 가격확정한 사용자 ID
  price_change_reason TEXT,              -- 현장 변동 사유 (최종)
  raw_json TEXT,
  memo TEXT,
  -- 상태: VALIDATED 삭제, CONFIRMED 추가
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(status IN (
    'RECEIVED','DISTRIBUTION_PENDING','DISTRIBUTED',
    'ASSIGNED','READY_DONE',
    'CONFIRMED',
    'IN_PROGRESS','SUBMITTED','DONE',
    'REGION_APPROVED','REGION_REJECTED',
    'HQ_APPROVED','HQ_REJECTED',
    'SETTLEMENT_CONFIRMED','PAID'
  )),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  channel_id INTEGER
);

-- 2-2. 기존 데이터 이전 (컬럼 매핑)
-- VALIDATED → DISTRIBUTION_PENDING으로 변환
INSERT INTO orders_new (
  order_id, batch_id, external_order_no, source_fingerprint,
  customer_name, customer_phone, address_text, address_detail,
  sigungu_code,
  requested_date, scheduled_date, scheduled_time,
  base_amount,
  price_confirmed, confirmed_total_sell, confirmed_total_work,
  raw_json, memo,
  status, created_at, updated_at, channel_id
)
SELECT 
  order_id, batch_id, external_order_no, source_fingerprint,
  customer_name, customer_phone, address_text, address_detail,
  NULL,  -- sigungu_code: 기존 데이터는 NULL (시드에서 재생성)
  requested_date, scheduled_date, scheduled_time,
  base_amount,
  0, 0, 0,  -- price_confirmed defaults
  raw_json, memo,
  CASE 
    WHEN status = 'VALIDATED' THEN 'DISTRIBUTION_PENDING'
    ELSE status 
  END,
  created_at, updated_at, channel_id
FROM orders;

-- 2-3. 기존 테이블 교체
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

-- 2-4. orders 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_orders_external ON orders(external_order_no);
CREATE INDEX IF NOT EXISTS idx_orders_fingerprint ON orders(source_fingerprint, requested_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_sigungu ON orders(sigungu_code);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel_id);
CREATE INDEX IF NOT EXISTS idx_orders_batch ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(requested_date);
CREATE INDEX IF NOT EXISTS idx_orders_confirmed ON orders(price_confirmed, status);
CREATE INDEX IF NOT EXISTS idx_orders_schedule ON orders(scheduled_date, scheduled_time, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);

-- ================================================================
-- STEP 3: order_assignments 재생성 (CONFIRMED 상태 추가)
-- ================================================================

CREATE TABLE order_assignments_new (
  assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  team_leader_id INTEGER NOT NULL REFERENCES users(user_id),
  assigned_by INTEGER REFERENCES users(user_id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK(status IN (
    'ASSIGNED','READY_DONE','CONFIRMED',
    'IN_PROGRESS','SUBMITTED','DONE',
    'REGION_APPROVED','REGION_REJECTED',
    'HQ_APPROVED','HQ_REJECTED',
    'SETTLEMENT_CONFIRMED','PAID','REASSIGNED'
  )),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO order_assignments_new SELECT * FROM order_assignments;
DROP TABLE order_assignments;
ALTER TABLE order_assignments_new RENAME TO order_assignments;

CREATE INDEX IF NOT EXISTS idx_assignments_order ON order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_assignments_leader ON order_assignments(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON order_assignments(status);

-- ================================================================
-- STEP 4: 레거시 테이블 삭제 (선택적 — 시드 리셋 후 삭제)
-- 로컬에서는 전체 리셋하므로 삭제. 프로덕션에서는 백업 후 수동 삭제 권장.
-- ================================================================

-- 행정동 관련 테이블 삭제
DROP TABLE IF EXISTS user_region_mappings;
DROP TABLE IF EXISTS org_territories;
DROP TABLE IF EXISTS territories;
DROP TABLE IF EXISTS admin_regions;

-- ================================================================
-- STEP 5: 기존 distribution_policies 호환 유지
-- rule_json에서 admin_dong 참조 → sigungu 기반으로 변환은 시드에서 처리
-- ================================================================

-- 배분 정책 테이블은 유지, rule_json 내용을 시드에서 시군구 기반으로 교체

-- ================================================================
-- 완료: 0023_sigungu_service_refactor.sql
-- 신규 테이블: sigungu, region_sigungu_map, team_sigungu_map,
--             service_categories, service_prices, service_options,
--             order_items, order_item_changes
-- 재생성: orders (시군구+가격확정 필드 추가, 행정동/서비스타입 삭제)
--         order_assignments (CONFIRMED 상태 추가)
-- 삭제: admin_regions, territories, org_territories, user_region_mappings
-- ================================================================
