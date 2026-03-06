-- ============================================================
-- 기존 데이터 마이그레이션: 조직 체계 변환
-- 총판(REGION) → 총판으로 이름 변경
-- 기존 팀장(REGION에 직속) → TEAM org 생성 후 재매핑
-- ============================================================

-- 1. 기존 지역총판 → 총판으로 이름 변경
UPDATE organizations SET name = REPLACE(name, '지역총판', '총판'), updated_at = datetime('now') 
WHERE org_type = 'REGION' AND name LIKE '%지역총판%';

-- 2. 기존 팀장들을 위한 TEAM 조직 생성
-- 각 팀장에게 개별 TEAM org를 만들고 parent_org_id를 현재 소속 REGION으로 설정
-- leader_seoul_1 (user 7, org 2 서울총판) → TEAM org
INSERT OR IGNORE INTO organizations (org_type, name, code, parent_org_id, status) VALUES
  ('TEAM', '김팀장팀', 'TEAM_SEOUL_1', 2, 'ACTIVE');

-- leader_seoul_2 (user 8, org 2 서울총판) → TEAM org
INSERT OR IGNORE INTO organizations (org_type, name, code, parent_org_id, status) VALUES
  ('TEAM', '이팀장팀', 'TEAM_SEOUL_2', 2, 'ACTIVE');

-- leader_gyeonggi_1 (user 9, org 3 경기총판) → TEAM org
INSERT OR IGNORE INTO organizations (org_type, name, code, parent_org_id, status) VALUES
  ('TEAM', '박팀장팀', 'TEAM_GYEONGGI_1', 3, 'ACTIVE');

-- leader_gyeonggi_2 (user 10, org 3 경기총판) → TEAM org
INSERT OR IGNORE INTO organizations (org_type, name, code, parent_org_id, status) VALUES
  ('TEAM', '최팀장팀', 'TEAM_GYEONGGI_2', 3, 'ACTIVE');

-- leader_incheon_1 (user 11, org 4 인천총판) → TEAM org
INSERT OR IGNORE INTO organizations (org_type, name, code, parent_org_id, status) VALUES
  ('TEAM', '정팀장팀', 'TEAM_INCHEON_1', 4, 'ACTIVE');

-- leader_busan_1 (user 12, org 5 부산총판) → TEAM org
INSERT OR IGNORE INTO organizations (org_type, name, code, parent_org_id, status) VALUES
  ('TEAM', '한팀장팀', 'TEAM_BUSAN_1', 5, 'ACTIVE');

-- 3. 팀장 사용자를 새 TEAM org로 재매핑
-- NOTE: org_id는 auto-increment이므로, 아래는 seed.sql 실행 후 기준
-- 실제로는 code 기반으로 매핑해야 안전
UPDATE users SET org_id = (SELECT org_id FROM organizations WHERE code = 'TEAM_SEOUL_1')
WHERE login_id = 'leader_seoul_1';

UPDATE users SET org_id = (SELECT org_id FROM organizations WHERE code = 'TEAM_SEOUL_2')
WHERE login_id = 'leader_seoul_2';

UPDATE users SET org_id = (SELECT org_id FROM organizations WHERE code = 'TEAM_GYEONGGI_1')
WHERE login_id = 'leader_gyeonggi_1';

UPDATE users SET org_id = (SELECT org_id FROM organizations WHERE code = 'TEAM_GYEONGGI_2')
WHERE login_id = 'leader_gyeonggi_2';

UPDATE users SET org_id = (SELECT org_id FROM organizations WHERE code = 'TEAM_INCHEON_1')
WHERE login_id = 'leader_incheon_1';

UPDATE users SET org_id = (SELECT org_id FROM organizations WHERE code = 'TEAM_BUSAN_1')
WHERE login_id = 'leader_busan_1';

-- 4. team_distributor_mappings 초기화 (기본 1:1 매핑)
INSERT OR IGNORE INTO team_distributor_mappings (team_org_id, distributor_org_id)
SELECT org_id, parent_org_id FROM organizations WHERE org_type = 'TEAM' AND parent_org_id IS NOT NULL;
