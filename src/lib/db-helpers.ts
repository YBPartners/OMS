// ================================================================
// 다하다 OMS — DB 헬퍼 유틸
// ================================================================

/** 오늘 날짜 (YYYY-MM-DD) */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** 지역 일일 통계 upsert */
export async function upsertRegionDailyStats(db: D1Database, regionOrgId: number, column: string, increment: number = 1) {
  const date = today();
  await db.prepare(`
    INSERT INTO region_daily_stats (date, region_org_id, ${column}, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(date, region_org_id) DO UPDATE SET ${column} = ${column} + ?, updated_at = datetime('now')
  `).bind(date, regionOrgId, increment, increment).run();
}

/** 팀장 일일 통계 upsert */
export async function upsertTeamLeaderDailyStats(db: D1Database, teamLeaderId: number, column: string, increment: number = 1, amountColumn?: string, amount?: number) {
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

/** SHA-256 fingerprint 생성 */
export async function generateFingerprint(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
