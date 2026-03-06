-- ============================================================
-- 테스트용 미배정 주문 데이터 (RECEIVED/VALIDATED 상태)
-- 자동배분 데모용 - 4개 지역총판으로 분배 테스트
-- ============================================================

-- 서울 지역 주문 (8건) - 강남, 서초, 송파, 마포, 강서
INSERT OR IGNORE INTO orders (order_id, external_order_no, source_fingerprint, service_type, customer_name, customer_phone, address_text, admin_dong_code, requested_date, base_amount, status) VALUES
  (101, 'DEMO-2026-0101', 'fp_demo_101', 'DEFAULT', '김민호', '010-1001-0001', '서울특별시 강남구 역삼동 820-5 역삼빌딩 3층', '1168010100', '2026-03-03', 180000, 'RECEIVED'),
  (102, 'DEMO-2026-0102', 'fp_demo_102', 'DEFAULT', '이수진', '010-1001-0002', '서울특별시 강남구 삼성동 157-2 코엑스 인근', '1168010200', '2026-03-03', 220000, 'RECEIVED'),
  (103, 'DEMO-2026-0103', 'fp_demo_103', 'DEFAULT', '박준혁', '010-1001-0003', '서울특별시 서초구 서초동 1446-1 서초프라자', '1165010100', '2026-03-03', 165000, 'RECEIVED'),
  (104, 'DEMO-2026-0104', 'fp_demo_104', 'DEFAULT', '최예린', '010-1001-0004', '서울특별시 송파구 잠실동 12-8 잠실아파트', '1171010100', '2026-03-03', 195000, 'RECEIVED'),
  (105, 'DEMO-2026-0105', 'fp_demo_105', 'DEFAULT', '정우진', '010-1001-0005', '서울특별시 마포구 합정동 399-2 합정역 부근', '1144010100', '2026-03-03', 155000, 'RECEIVED'),
  (106, 'DEMO-2026-0106', 'fp_demo_106', 'DEFAULT', '한서연', '010-1001-0006', '서울특별시 강서구 화곡동 1004-12', '1150010100', '2026-03-03', 135000, 'RECEIVED'),
  (107, 'DEMO-2026-0107', 'fp_demo_107', 'DEFAULT', '임지훈', '010-1001-0007', '서울특별시 강남구 역삼동 707 개나리아파트', '1168010100', '2026-03-03', 210000, 'VALIDATED'),
  (108, 'DEMO-2026-0108', 'fp_demo_108', 'DEFAULT', '오다은', '010-1001-0008', '서울특별시 서초구 서초동 1321 서초타워', '1165010100', '2026-03-03', 175000, 'VALIDATED');

-- 경기 지역 주문 (7건) - 분당, 수원, 고양, 용인
INSERT OR IGNORE INTO orders (order_id, external_order_no, source_fingerprint, service_type, customer_name, customer_phone, address_text, admin_dong_code, requested_date, base_amount, status) VALUES
  (109, 'DEMO-2026-0109', 'fp_demo_109', 'DEFAULT', '강태우', '010-1002-0001', '경기도 성남시 분당구 서현동 270-3 서현프라자', '4113510100', '2026-03-03', 190000, 'RECEIVED'),
  (110, 'DEMO-2026-0110', 'fp_demo_110', 'DEFAULT', '윤하영', '010-1002-0002', '경기도 수원시 영통구 원천동 322-1', '4111510100', '2026-03-03', 160000, 'RECEIVED'),
  (111, 'DEMO-2026-0111', 'fp_demo_111', 'DEFAULT', '서민재', '010-1002-0003', '경기도 고양시 일산서구 탄현동 1580', '4128510100', '2026-03-03', 200000, 'RECEIVED'),
  (112, 'DEMO-2026-0112', 'fp_demo_112', 'DEFAULT', '조유나', '010-1002-0004', '경기도 용인시 수지구 죽전동 1299-6', '4146310100', '2026-03-03', 145000, 'RECEIVED'),
  (113, 'DEMO-2026-0113', 'fp_demo_113', 'DEFAULT', '황재윤', '010-1002-0005', '경기도 성남시 분당구 서현동 252-7 AK프라자', '4113510100', '2026-03-03', 230000, 'VALIDATED'),
  (114, 'DEMO-2026-0114', 'fp_demo_114', 'DEFAULT', '문서영', '010-1002-0006', '경기도 수원시 영통구 원천동 111-2 삼성전자앞', '4111510100', '2026-03-03', 185000, 'VALIDATED'),
  (115, 'DEMO-2026-0115', 'fp_demo_115', 'DEFAULT', '배지민', '010-1002-0007', '경기도 고양시 일산서구 탄현동 850 킨텍스 인근', '4128510100', '2026-03-03', 170000, 'RECEIVED');

-- 인천 지역 주문 (5건) - 남동, 연수
INSERT OR IGNORE INTO orders (order_id, external_order_no, source_fingerprint, service_type, customer_name, customer_phone, address_text, admin_dong_code, requested_date, base_amount, status) VALUES
  (116, 'DEMO-2026-0116', 'fp_demo_116', 'DEFAULT', '신동현', '010-1003-0001', '인천광역시 남동구 구월동 1480-5 구월스퀘어', '2820010100', '2026-03-03', 140000, 'RECEIVED'),
  (117, 'DEMO-2026-0117', 'fp_demo_117', 'DEFAULT', '권나린', '010-1003-0002', '인천광역시 연수구 송도동 23-8 송도센트럴파크', '2823710100', '2026-03-03', 175000, 'RECEIVED'),
  (118, 'DEMO-2026-0118', 'fp_demo_118', 'DEFAULT', '류현우', '010-1003-0003', '인천광역시 남동구 구월동 996-2 뉴코아몰 인근', '2820010100', '2026-03-03', 155000, 'VALIDATED'),
  (119, 'DEMO-2026-0119', 'fp_demo_119', 'DEFAULT', '장소율', '010-1003-0004', '인천광역시 연수구 송도동 55-1 송도 G타워', '2823710100', '2026-03-03', 210000, 'RECEIVED'),
  (120, 'DEMO-2026-0120', 'fp_demo_120', 'DEFAULT', '안시온', '010-1003-0005', '인천광역시 남동구 구월동 350 모래내시장', '2820010100', '2026-03-03', 125000, 'RECEIVED');

-- 부산 지역 주문 (5건) - 해운대, 부산진
INSERT OR IGNORE INTO orders (order_id, external_order_no, source_fingerprint, service_type, customer_name, customer_phone, address_text, admin_dong_code, requested_date, base_amount, status) VALUES
  (121, 'DEMO-2026-0121', 'fp_demo_121', 'DEFAULT', '노건우', '010-1004-0001', '부산광역시 해운대구 우동 1499 해운대프라자', '2635010100', '2026-03-03', 200000, 'RECEIVED'),
  (122, 'DEMO-2026-0122', 'fp_demo_122', 'DEFAULT', '홍지아', '010-1004-0002', '부산광역시 부산진구 부전동 255-8 서면역 앞', '2623010100', '2026-03-03', 165000, 'RECEIVED'),
  (123, 'DEMO-2026-0123', 'fp_demo_123', 'DEFAULT', '양도윤', '010-1004-0003', '부산광역시 해운대구 우동 678 마린시티', '2635010100', '2026-03-03', 245000, 'VALIDATED'),
  (124, 'DEMO-2026-0124', 'fp_demo_124', 'DEFAULT', '구하린', '010-1004-0004', '부산광역시 부산진구 부전동 168 롯데호텔 인근', '2623010100', '2026-03-03', 180000, 'RECEIVED'),
  (125, 'DEMO-2026-0125', 'fp_demo_125', 'DEFAULT', '우준서', '010-1004-0005', '부산광역시 해운대구 우동 1533 센텀시티', '2635010100', '2026-03-03', 195000, 'RECEIVED');

-- 추가 팀장 (인천, 부산에 팀장 추가)
INSERT OR IGNORE INTO users (user_id, org_id, login_id, password_hash, name, phone, email, status, phone_verified, joined_at, memo) VALUES
  (14, 4, 'leader_incheon_2', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '송팀장', '01033331002', NULL, 'ACTIVE', 1, '2024-06-01', '연수구 담당'),
  (15, 5, 'leader_busan_2',   '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '오팀장', '01044441002', NULL, 'ACTIVE', 1, '2024-06-01', '부산진구 담당');

INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES
  (14, 4),  -- leader_incheon_2 → TEAM_LEADER
  (15, 4);  -- leader_busan_2 → TEAM_LEADER

-- 추가 수수료 정책 (새 팀장)
INSERT OR IGNORE INTO commission_policies (commission_policy_id, org_id, team_leader_id, mode, value, effective_from) VALUES
  (6, 4, 11, 'PERCENT', 7.5, '2024-01-01'),  -- 정팀장 7.5%
  (7, 4, 14, 'PERCENT', 7.0, '2024-01-01'),  -- 송팀장 7.0%
  (8, 5, 12, 'FIXED', 45000, '2024-01-01'),   -- 한팀장 정액 45,000원
  (9, 5, 15, 'PERCENT', 8.0, '2024-01-01');   -- 오팀장 8.0%
