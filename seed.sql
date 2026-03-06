-- ============================================================
-- SEED DATA: 와이비 OMS 초기 데이터
-- ============================================================

-- 역할 정의
INSERT OR IGNORE INTO roles (code, name, description) VALUES
  ('SUPER_ADMIN', '슈퍼관리자', '전권 - 와이비 HQ'),
  ('HQ_OPERATOR', 'HQ 운영자', '본사 운영(수신/배분/대사/최종검수/정산/통계)'),
  ('REGION_ADMIN', '지역총판 관리자', '지역총판 운영(배정/1차검수/지역정산/통계)'),
  ('TEAM_LEADER', '팀장', '현장 수행/보고서 제출/본인 통계 조회'),
  ('AUDITOR', '감사/조회', '읽기 전용 + 대사/통계 열람');

-- 조직: 와이비 HQ
INSERT OR IGNORE INTO organizations (org_id, org_type, name, code, status) VALUES
  (1, 'HQ', '와이비 본사', 'DAHADA_HQ', 'ACTIVE');

-- 조직: 지역총판 4개
INSERT OR IGNORE INTO organizations (org_id, org_type, name, code, status) VALUES
  (2, 'REGION', '서울지역총판', 'REGION_SEOUL', 'ACTIVE'),
  (3, 'REGION', '경기지역총판', 'REGION_GYEONGGI', 'ACTIVE'),
  (4, 'REGION', '인천지역총판', 'REGION_INCHEON', 'ACTIVE'),
  (5, 'REGION', '부산지역총판', 'REGION_BUSAN', 'ACTIVE');

-- 사용자: HQ 관리자 (password: admin123 → SHA-256 해시)
INSERT OR IGNORE INTO users (user_id, org_id, login_id, password_hash, name, phone, email, status, phone_verified, joined_at, memo) VALUES
  (1, 1, 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '시스템관리자', '01000000000', 'admin@yb.co.kr', 'ACTIVE', 1, '2024-01-01', '전권 관리자'),
  (2, 1, 'hq_operator', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'HQ운영자', '01000000001', 'operator@yb.co.kr', 'ACTIVE', 1, '2024-01-15', NULL);

-- 사용자: 지역총판 관리자
INSERT OR IGNORE INTO users (user_id, org_id, login_id, password_hash, name, phone, email, status, phone_verified, joined_at, memo) VALUES
  (3, 2, 'seoul_admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '서울관리자', '01011110001', 'seoul@yb.co.kr', 'ACTIVE', 1, '2024-02-01', '서울지역총판 담당'),
  (4, 3, 'gyeonggi_admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '경기관리자', '01022220001', 'gyeonggi@yb.co.kr', 'ACTIVE', 1, '2024-02-01', '경기지역총판 담당'),
  (5, 4, 'incheon_admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '인천관리자', '01033330001', 'incheon@yb.co.kr', 'ACTIVE', 1, '2024-02-01', '인천지역총판 담당'),
  (6, 5, 'busan_admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '부산관리자', '01044440001', 'busan@yb.co.kr', 'ACTIVE', 1, '2024-02-01', '부산지역총판 담당');

-- 사용자: 팀장
INSERT OR IGNORE INTO users (user_id, org_id, login_id, password_hash, name, phone, email, status, phone_verified, joined_at, memo) VALUES
  (7,  2, 'leader_seoul_1',    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '김팀장', '01011111001', NULL, 'ACTIVE', 1, '2024-03-01', '강남/서초 담당'),
  (8,  2, 'leader_seoul_2',    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '이팀장', '01011111002', NULL, 'ACTIVE', 1, '2024-03-15', '송파/마포 담당'),
  (9,  3, 'leader_gyeonggi_1', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '박팀장', '01022221001', NULL, 'ACTIVE', 0, '2024-04-01', '분당/수원 담당'),
  (10, 3, 'leader_gyeonggi_2', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '최팀장', '01022221002', NULL, 'ACTIVE', 0, '2024-04-15', '고양/용인 담당'),
  (11, 4, 'leader_incheon_1',  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '정팀장', '01033331001', NULL, 'ACTIVE', 1, '2024-05-01', '남동/연수 담당'),
  (12, 5, 'leader_busan_1',    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', '한팀장', '01044441001', NULL, 'ACTIVE', 1, '2024-05-01', '해운대/부산진 담당');

-- 역할 매핑 (코드 기반 조회)
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 1, role_id FROM roles WHERE code = 'SUPER_ADMIN';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 2, role_id FROM roles WHERE code = 'HQ_OPERATOR';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 3, role_id FROM roles WHERE code = 'REGION_ADMIN';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 4, role_id FROM roles WHERE code = 'REGION_ADMIN';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 5, role_id FROM roles WHERE code = 'REGION_ADMIN';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 6, role_id FROM roles WHERE code = 'REGION_ADMIN';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 7, role_id FROM roles WHERE code = 'TEAM_LEADER';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 8, role_id FROM roles WHERE code = 'TEAM_LEADER';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 9, role_id FROM roles WHERE code = 'TEAM_LEADER';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 10, role_id FROM roles WHERE code = 'TEAM_LEADER';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 11, role_id FROM roles WHERE code = 'TEAM_LEADER';
INSERT OR IGNORE INTO user_roles (user_id, role_id) 
  SELECT 12, role_id FROM roles WHERE code = 'TEAM_LEADER';

-- 지역권: 행정동 데이터 (서울)
INSERT OR IGNORE INTO territories (territory_id, sido, sigungu, eupmyeondong, admin_dong_code, legal_dong_code) VALUES
  (1,  '서울특별시', '강남구', '역삼동', '1168010100', '1168010100'),
  (2,  '서울특별시', '강남구', '삼성동', '1168010200', '1168010200'),
  (3,  '서울특별시', '서초구', '서초동', '1165010100', '1165010100'),
  (4,  '서울특별시', '송파구', '잠실동', '1171010100', '1171010100'),
  (5,  '서울특별시', '마포구', '합정동', '1144010100', '1144010100'),
  (6,  '서울특별시', '강서구', '화곡동', '1150010100', '1150010100');

-- 지역권: 경기도
INSERT OR IGNORE INTO territories (territory_id, sido, sigungu, eupmyeondong, admin_dong_code, legal_dong_code) VALUES
  (7,  '경기도', '성남시', '분당구', '4113510100', '4113510100'),
  (8,  '경기도', '수원시', '영통구', '4111510100', '4111510100'),
  (9,  '경기도', '고양시', '일산서구', '4128510100', '4128510100'),
  (10, '경기도', '용인시', '수지구', '4146310100', '4146310100');

-- 지역권: 인천
INSERT OR IGNORE INTO territories (territory_id, sido, sigungu, eupmyeondong, admin_dong_code, legal_dong_code) VALUES
  (11, '인천광역시', '남동구', '구월동', '2820010100', '2820010100'),
  (12, '인천광역시', '연수구', '송도동', '2823710100', '2823710100');

-- 지역권: 부산
INSERT OR IGNORE INTO territories (territory_id, sido, sigungu, eupmyeondong, admin_dong_code, legal_dong_code) VALUES
  (13, '부산광역시', '해운대구', '우동', '2635010100', '2635010100'),
  (14, '부산광역시', '부산진구', '부전동', '2623010100', '2623010100');

-- 조직-지역권 매핑 (서울→서울총판, 경기→경기총판, ...)
INSERT OR IGNORE INTO org_territories (org_id, territory_id, effective_from) VALUES
  (2, 1, '2024-01-01'), (2, 2, '2024-01-01'), (2, 3, '2024-01-01'),
  (2, 4, '2024-01-01'), (2, 5, '2024-01-01'), (2, 6, '2024-01-01'),
  (3, 7, '2024-01-01'), (3, 8, '2024-01-01'), (3, 9, '2024-01-01'), (3, 10, '2024-01-01'),
  (4, 11, '2024-01-01'), (4, 12, '2024-01-01'),
  (5, 13, '2024-01-01'), (5, 14, '2024-01-01');

-- ============================================================
-- 행정구역 마스터 (가입 시스템용 — admin_regions)
-- territories는 배분 시스템용, admin_regions는 가입 위자드용
-- ============================================================

-- 서울특별시
INSERT OR IGNORE INTO admin_regions (region_id, sido, sigungu, eupmyeondong, admin_code, legal_code, full_name) VALUES
  (1,  '서울특별시', '강남구', '역삼동', '1168010100', '1168010100', '서울특별시 강남구 역삼동'),
  (2,  '서울특별시', '강남구', '삼성동', '1168010200', '1168010200', '서울특별시 강남구 삼성동'),
  (3,  '서울특별시', '서초구', '서초동', '1165010100', '1165010100', '서울특별시 서초구 서초동'),
  (4,  '서울특별시', '송파구', '잠실동', '1171010100', '1171010100', '서울특별시 송파구 잠실동'),
  (5,  '서울특별시', '마포구', '합정동', '1144010100', '1144010100', '서울특별시 마포구 합정동'),
  (6,  '서울특별시', '강서구', '화곡동', '1150010100', '1150010100', '서울특별시 강서구 화곡동'),
  (7,  '서울특별시', '영등포구', '여의도동', '1156010100', '1156010100', '서울특별시 영등포구 여의도동'),
  (8,  '서울특별시', '종로구', '종로동', '1111010100', '1111010100', '서울특별시 종로구 종로동');

-- 경기도
INSERT OR IGNORE INTO admin_regions (region_id, sido, sigungu, eupmyeondong, admin_code, legal_code, full_name) VALUES
  (9,  '경기도', '성남시', '분당구', '4113510100', '4113510100', '경기도 성남시 분당구'),
  (10, '경기도', '수원시', '영통구', '4111510100', '4111510100', '경기도 수원시 영통구'),
  (11, '경기도', '고양시', '일산서구', '4128510100', '4128510100', '경기도 고양시 일산서구'),
  (12, '경기도', '용인시', '수지구', '4146310100', '4146310100', '경기도 용인시 수지구'),
  (13, '경기도', '화성시', '동탄', '4159010100', '4159010100', '경기도 화성시 동탄'),
  (14, '경기도', '안양시', '동안구', '4117310100', '4117310100', '경기도 안양시 동안구');

-- 인천광역시
INSERT OR IGNORE INTO admin_regions (region_id, sido, sigungu, eupmyeondong, admin_code, legal_code, full_name) VALUES
  (15, '인천광역시', '남동구', '구월동', '2820010100', '2820010100', '인천광역시 남동구 구월동'),
  (16, '인천광역시', '연수구', '송도동', '2823710100', '2823710100', '인천광역시 연수구 송도동'),
  (17, '인천광역시', '부평구', '부평동', '2823210100', '2823210100', '인천광역시 부평구 부평동');

-- 부산광역시
INSERT OR IGNORE INTO admin_regions (region_id, sido, sigungu, eupmyeondong, admin_code, legal_code, full_name) VALUES
  (18, '부산광역시', '해운대구', '우동', '2635010100', '2635010100', '부산광역시 해운대구 우동'),
  (19, '부산광역시', '부산진구', '부전동', '2623010100', '2623010100', '부산광역시 부산진구 부전동'),
  (20, '부산광역시', '수영구', '광안동', '2641010100', '2641010100', '부산광역시 수영구 광안동');

-- 조직-행정구역 매핑 (가입 시 총판 관할 구역 확인용)
INSERT OR IGNORE INTO org_region_mappings (org_id, region_id) VALUES
  -- 서울지역총판(org_id=2) → 서울 행정구역
  (2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8),
  -- 경기지역총판(org_id=3) → 경기 행정구역
  (3, 9), (3, 10), (3, 11), (3, 12), (3, 13), (3, 14),
  -- 인천지역총판(org_id=4) → 인천 행정구역
  (4, 15), (4, 16), (4, 17),
  -- 부산지역총판(org_id=5) → 부산 행정구역
  (5, 18), (5, 19), (5, 20);

-- 배분 정책 (v1)
INSERT OR IGNORE INTO distribution_policies (policy_id, name, version, rule_json, effective_from, is_active) VALUES
  (1, '행정동 기반 자동배분 v1', 1, '{"method":"admin_dong_code","fallback":"DISTRIBUTION_PENDING"}', '2024-01-01', 1);

-- 보고서 정책 (기본)
INSERT OR IGNORE INTO report_policies (policy_id, name, version, service_type, required_photos_json, required_checklist_json, require_receipt) VALUES
  (1, '기본 보고서 정책 v1', 1, 'DEFAULT', '{"BEFORE":1,"AFTER":1,"WASH":1,"RECEIPT":1}', '["작업완료확인","고객서명확인","현장정리확인"]', 1);

-- 수수료 정책: 지역총판별 기본(팀장 미지정 = 지역 기본)
INSERT OR IGNORE INTO commission_policies (commission_policy_id, org_id, team_leader_id, mode, value, effective_from) VALUES
  (1, 2, NULL, 'PERCENT', 7.5, '2024-01-01'),  -- 서울: 7.5%
  (2, 3, NULL, 'PERCENT', 8.0, '2024-01-01'),  -- 경기: 8.0%
  (3, 4, NULL, 'PERCENT', 7.0, '2024-01-01'),  -- 인천: 7.0%
  (4, 5, NULL, 'PERCENT', 7.5, '2024-01-01');  -- 부산: 7.5%

-- 수수료 정책: 특정 팀장 개별
INSERT OR IGNORE INTO commission_policies (commission_policy_id, org_id, team_leader_id, mode, value, effective_from) VALUES
  (5, 2, 7, 'FIXED', 50000, '2024-01-01');  -- 김팀장 정액 50,000원

-- 통계 기준 정책
INSERT OR IGNORE INTO metrics_policies (metrics_policy_id, completion_basis, region_intake_basis, effective_from) VALUES
  (1, 'SUBMITTED_AT', 'DISTRIBUTED_AT', '2024-01-01');

-- 샘플 주문 데이터 (다양한 상태)
INSERT OR IGNORE INTO orders (order_id, external_order_no, source_fingerprint, service_type, customer_name, customer_phone, address_text, admin_dong_code, requested_date, base_amount, status) VALUES
  (1, 'AJD-2026-0001', 'fp_001', 'DEFAULT', '홍길동', '010-9999-0001', '서울특별시 강남구 역삼동 123-4', '1168010100', '2026-03-01', 150000, 'HQ_APPROVED'),
  (2, 'AJD-2026-0002', 'fp_002', 'DEFAULT', '김철수', '010-9999-0002', '서울특별시 서초구 서초동 567-8', '1165010100', '2026-03-01', 200000, 'REGION_APPROVED'),
  (3, 'AJD-2026-0003', 'fp_003', 'DEFAULT', '이영희', '010-9999-0003', '경기도 성남시 분당구 서현동 99', '4113510100', '2026-03-01', 180000, 'SUBMITTED'),
  (4, 'AJD-2026-0004', 'fp_004', 'DEFAULT', '박민수', '010-9999-0004', '인천광역시 남동구 구월동 200', '2820010100', '2026-03-02', 120000, 'ASSIGNED'),
  (5, 'AJD-2026-0005', 'fp_005', 'DEFAULT', '최지은', '010-9999-0005', '부산광역시 해운대구 우동 300', '2635010100', '2026-03-02', 250000, 'DISTRIBUTED'),
  (6, NULL, 'fp_006', 'DEFAULT', '정하늘', '010-9999-0006', '서울특별시 마포구 합정동 55-2', '1144010100', '2026-03-02', 130000, 'VALIDATED'),
  (7, 'AJD-2026-0007', 'fp_007', 'DEFAULT', '한바다', '010-9999-0007', '경기도 수원시 영통구 원천동 88', '4111510100', '2026-03-02', 170000, 'IN_PROGRESS'),
  (8, 'AJD-2026-0008', 'fp_008', 'DEFAULT', '윤산들', '010-9999-0008', '서울특별시 송파구 잠실동 444', '1171010100', '2026-03-03', 160000, 'RECEIVED'),
  (9, 'AJD-2026-0009', 'fp_009', 'DEFAULT', '강별빛', '010-9999-0009', '경기도 고양시 일산서구 탄현동 22', '4128510100', '2026-03-03', 190000, 'SETTLEMENT_CONFIRMED'),
  (10, 'AJD-2026-0010', 'fp_010', 'DEFAULT', '송하늘', '010-9999-0010', '인천광역시 연수구 송도동 100', '2823710100', '2026-03-03', 140000, 'HQ_APPROVED');

-- 배분 데이터
INSERT OR IGNORE INTO order_distributions (distribution_id, order_id, region_org_id, distributed_by, distributed_at, distribution_policy_version, status) VALUES
  (1, 1, 2, 1, '2026-03-01 09:00:00', 1, 'ACTIVE'),
  (2, 2, 2, 1, '2026-03-01 09:00:00', 1, 'ACTIVE'),
  (3, 3, 3, 1, '2026-03-01 09:00:00', 1, 'ACTIVE'),
  (4, 4, 4, 1, '2026-03-02 09:00:00', 1, 'ACTIVE'),
  (5, 5, 5, 1, '2026-03-02 09:00:00', 1, 'ACTIVE'),
  (6, 7, 3, 1, '2026-03-02 09:00:00', 1, 'ACTIVE'),
  (7, 9, 3, 1, '2026-03-03 09:00:00', 1, 'ACTIVE'),
  (8, 10, 4, 1, '2026-03-03 09:00:00', 1, 'ACTIVE');

-- 할당 데이터
INSERT OR IGNORE INTO order_assignments (assignment_id, order_id, team_leader_id, assigned_by, assigned_at, status) VALUES
  (1, 1, 7,  3, '2026-03-01 10:00:00', 'HQ_APPROVED'),
  (2, 2, 8,  3, '2026-03-01 10:00:00', 'REGION_APPROVED'),
  (3, 3, 9,  4, '2026-03-01 10:30:00', 'SUBMITTED'),
  (4, 4, 11, 5, '2026-03-02 10:00:00', 'ASSIGNED'),
  (5, 7, 10, 4, '2026-03-02 10:30:00', 'IN_PROGRESS'),
  (6, 9, 9,  4, '2026-03-03 09:30:00', 'SETTLEMENT_CONFIRMED'),
  (7, 10, 11, 5, '2026-03-03 09:30:00', 'HQ_APPROVED');

-- 보고서 데이터
INSERT OR IGNORE INTO work_reports (report_id, order_id, team_leader_id, policy_id_snapshot, checklist_json, submitted_at, note) VALUES
  (1, 1, 7, 1, '{"작업완료확인":true,"고객서명확인":true,"현장정리확인":true}', '2026-03-01 15:00:00', '작업 완료'),
  (2, 2, 8, 1, '{"작업완료확인":true,"고객서명확인":true,"현장정리확인":true}', '2026-03-01 16:00:00', '정상 완료'),
  (3, 3, 9, 1, '{"작업완료확인":true,"고객서명확인":false,"현장정리확인":true}', '2026-03-01 17:00:00', '고객 부재'),
  (4, 9, 9, 1, '{"작업완료확인":true,"고객서명확인":true,"현장정리확인":true}', '2026-03-03 14:00:00', '완료'),
  (5, 10, 11, 1, '{"작업완료확인":true,"고객서명확인":true,"현장정리확인":true}', '2026-03-03 15:00:00', '완료');

-- 검수 데이터
INSERT OR IGNORE INTO reviews (review_id, report_id, order_id, stage, reviewer_id, result, comment, reviewed_at) VALUES
  (1, 1, 1, 'REGION', 3, 'APPROVE', '양호', '2026-03-01 16:00:00'),
  (2, 1, 1, 'HQ', 2, 'APPROVE', '최종 승인', '2026-03-01 17:00:00'),
  (3, 2, 2, 'REGION', 3, 'APPROVE', '양호', '2026-03-01 17:30:00'),
  (4, 4, 9, 'REGION', 4, 'APPROVE', '양호', '2026-03-03 15:00:00'),
  (5, 4, 9, 'HQ', 2, 'APPROVE', '최종 승인', '2026-03-03 16:00:00'),
  (6, 5, 10, 'REGION', 5, 'APPROVE', '양호', '2026-03-03 16:00:00'),
  (7, 5, 10, 'HQ', 2, 'APPROVE', '최종 승인', '2026-03-03 17:00:00');

-- 상태 이력 (일부)
INSERT OR IGNORE INTO order_status_history (order_id, from_status, to_status, actor_id, note, created_at) VALUES
  (1, 'RECEIVED', 'VALIDATED', 1, '자동 유효성 통과', '2026-03-01 08:30:00'),
  (1, 'VALIDATED', 'DISTRIBUTED', 1, '서울총판 배분', '2026-03-01 09:00:00'),
  (1, 'DISTRIBUTED', 'ASSIGNED', 3, '김팀장 배정', '2026-03-01 10:00:00'),
  (1, 'ASSIGNED', 'IN_PROGRESS', 7, '작업 시작', '2026-03-01 11:00:00'),
  (1, 'IN_PROGRESS', 'SUBMITTED', 7, '보고서 제출', '2026-03-01 15:00:00'),
  (1, 'SUBMITTED', 'REGION_APPROVED', 3, '1차 검수 승인', '2026-03-01 16:00:00'),
  (1, 'REGION_APPROVED', 'HQ_APPROVED', 2, '최종 검수 승인', '2026-03-01 17:00:00');

-- ============================================================
-- 대리점(AGENCY) 테스트 데이터 (Phase 7.0)
-- ============================================================

-- 김팀장(user_id=7)을 서울지역 대리점장으로 지정
-- AGENCY_LEADER 역할 추가 (role_id는 roles 테이블에서 조회)
INSERT OR IGNORE INTO user_roles (user_id, role_id)
  SELECT 7, role_id FROM roles WHERE code = 'AGENCY_LEADER';

-- 김팀장(7) 대리점에 이팀장(8)을 소속시킴
INSERT OR IGNORE INTO agency_team_mappings (agency_user_id, team_user_id) VALUES (7, 8);

-- 추가 주문 채널 등록
INSERT OR IGNORE INTO order_channels (channel_id, name, code, description, is_active, priority) VALUES
  (2, 'KT 주문원장', 'KT_ORDERS', 'KT 통신사 주문 채널', 1, 10),
  (3, 'LG U+ 주문원장', 'LGU_ORDERS', 'LG U+ 통신사 주문 채널', 1, 9),
  (4, 'SK 주문원장', 'SK_ORDERS', 'SK 통신사 주문 채널', 1, 8);
