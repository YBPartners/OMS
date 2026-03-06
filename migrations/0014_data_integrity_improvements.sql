-- ============================================================
-- Migration 0014: 데이터 정합성 개선 v19.1
-- 1. 기존 주문 channel_id NULL → 기본 채널(로컬) 보정
-- 2. REGION_ADMIN 역할명 업데이트
-- ============================================================

-- 1. channel_id NULL인 기존 주문에 기본 채널(LOCAL, channel_id=1) 설정
-- channel_id=1은 '로컬' 채널로, 직접 접수 건을 의미
UPDATE orders SET channel_id = 1 WHERE channel_id IS NULL;

-- 2. REGION_ADMIN 역할명 → '파트장'으로 통일 (기존 '지역총판 관리자')
UPDATE roles SET name = '파트장' WHERE code = 'REGION_ADMIN' AND name != '파트장';

-- 3. 기존 구형 채널 데이터(KT/LG/SK) → 현재 브랜드로 보정
-- channel_id 2,3,4가 구형 데이터인 경우 브랜드명으로 업데이트
UPDATE order_channels SET name = '삼성', code = 'SAMSUNG', description = '삼성전자 에어컨 주문 채널', priority = 90 
  WHERE channel_id = 2 AND code IN ('KT_ORDERS', 'SAMSUNG');
UPDATE order_channels SET name = '엘지', code = 'LG', description = 'LG전자 에어컨 주문 채널', priority = 80 
  WHERE channel_id = 3 AND code IN ('LGU_ORDERS', 'LG');
UPDATE order_channels SET name = '캐리어', code = 'CARRIER', description = '캐리어 에어컨 주문 채널', priority = 70 
  WHERE channel_id = 4 AND code IN ('SK_ORDERS', 'CARRIER');
