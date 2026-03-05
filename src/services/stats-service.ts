// ================================================================
// 와이비 OMS — Stats Service v1.0
// 통계 도메인의 유일한 쓰기 진입점
//
// region_daily_stats, team_leader_daily_stats, team_leader_ledger_daily
// 테이블에 대한 갱신은 모두 이 서비스를 통해야 합니다.
// ================================================================

import { today } from '../lib/db-helpers';
import { BatchBuilder } from '../lib/batch-builder';

// ─── 인터페이스 ──────────────────────────────────────────────

export interface SettlementStatsEntry {
  teamLeaderId: number;
  regionOrgId: number;
  payableAmount: number;
}

// ─── 단건 통계 갱신 ──────────────────────────────────────────

/** 지역 일일 통계 upsert */
export async function upsertRegionDailyStats(
  db: D1Database,
  regionOrgId: number,
  column: string,
  increment: number = 1
): Promise<void> {
  const date = today();
  await db.prepare(`
    INSERT INTO region_daily_stats (date, region_org_id, ${column}, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(date, region_org_id) DO UPDATE SET ${column} = ${column} + ?, updated_at = datetime('now')
  `).bind(date, regionOrgId, increment, increment).run();
}

/** 팀장 일일 통계 upsert */
export async function upsertTeamLeaderDailyStats(
  db: D1Database,
  teamLeaderId: number,
  column: string,
  increment: number = 1,
  amountColumn?: string,
  amount?: number
): Promise<void> {
  const date = today();
  if (amountColumn && amount !== undefined) {
    await db.prepare(`
      INSERT INTO team_leader_daily_stats (date, team_leader_id, ${column}, ${amountColumn}, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(date, team_leader_id) DO UPDATE SET 
        ${column} = ${column} + ?, ${amountColumn} = ${amountColumn} + ?, updated_at = datetime('now')
    `).bind(date, teamLeaderId, increment, amount, increment, amount).run();
  } else {
    await db.prepare(`
      INSERT INTO team_leader_daily_stats (date, team_leader_id, ${column}, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(date, team_leader_id) DO UPDATE SET ${column} = ${column} + ?, updated_at = datetime('now')
    `).bind(date, teamLeaderId, increment, increment).run();
  }
}

// ─── 정산 확정 시 일괄 통계 갱신 ──────────────────────────────

/**
 * 정산 확정에 따른 통계를 BatchBuilder에 추가
 * 
 * 호출자(settlement-confirm)는 이 함수로 batch에 통계 SQL을 추가하고,
 * 최종적으로 batch.execute()로 원자적 실행.
 */
export function appendSettlementStatsToBatch(
  batch: BatchBuilder,
  entries: SettlementStatsEntry[]
): void {
  const dateStr = today();

  for (const entry of entries) {
    // 팀장 원장
    batch.add(
      `INSERT INTO team_leader_ledger_daily (date, team_leader_id, confirmed_payable_sum, confirmed_count, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'))
       ON CONFLICT(date, team_leader_id) DO UPDATE SET
         confirmed_payable_sum = confirmed_payable_sum + ?,
         confirmed_count = confirmed_count + 1,
         updated_at = datetime('now')`,
      [dateStr, entry.teamLeaderId, entry.payableAmount, entry.payableAmount]
    );

    // 팀장 일별 통계
    batch.add(
      `INSERT INTO team_leader_daily_stats (date, team_leader_id, settlement_confirmed_count, payable_amount_sum, updated_at)
       VALUES (?, ?, 1, ?, datetime('now'))
       ON CONFLICT(date, team_leader_id) DO UPDATE SET
         settlement_confirmed_count = settlement_confirmed_count + 1,
         payable_amount_sum = payable_amount_sum + ?,
         updated_at = datetime('now')`,
      [dateStr, entry.teamLeaderId, entry.payableAmount, entry.payableAmount]
    );

    // 지역 일별 통계
    batch.add(
      `INSERT INTO region_daily_stats (date, region_org_id, settlement_confirmed_count, payable_amount_sum, updated_at)
       VALUES (?, ?, 1, ?, datetime('now'))
       ON CONFLICT(date, region_org_id) DO UPDATE SET
         settlement_confirmed_count = settlement_confirmed_count + 1,
         payable_amount_sum = payable_amount_sum + ?,
         updated_at = datetime('now')`,
      [dateStr, entry.regionOrgId, entry.payableAmount, entry.payableAmount]
    );
  }
}
