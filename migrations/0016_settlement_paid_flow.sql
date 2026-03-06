-- ================================================================
-- 0016: 정산 지급완료(PAID) 플로우 지원
-- team_leader_ledger_daily에 지급 관련 컬럼 추가
-- ================================================================

-- 팀장 원장에 지급 관련 컬럼 추가
ALTER TABLE team_leader_ledger_daily ADD COLUMN paid_amount_sum REAL DEFAULT 0;
ALTER TABLE team_leader_ledger_daily ADD COLUMN paid_count INTEGER DEFAULT 0;
