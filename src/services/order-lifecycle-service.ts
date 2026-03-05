// ================================================================
// 와이비 OMS — Order Lifecycle Service v1.0
// 주문 상태 전이 중 타 도메인(정산·통계) 영향을 캡슐화
// 정산 확정 시 orders/order_assignments 상태 업데이트를 여기서 수행
// ================================================================

import { BatchBuilder } from '../lib/batch-builder';
import { today } from '../lib/db-helpers';
import { writeAuditLog } from '../lib/audit';
import type { AuditEventCode } from '../types';

/** 정산 확정 대상 정산 항목 */
export interface SettlementConfirmItem {
  settlement_id: number;
  order_id: number;
  team_leader_id: number;
  region_org_id: number;
  payable_amount: number;
}

/** 정산 확정 결과 */
export interface ConfirmResult {
  confirmedCount: number;
  errors: { order_id: number; error: string }[];
}

/**
 * confirmSettlementOrders — 정산 확정 시 주문 상태를 일괄 업데이트한다.
 * 
 * 기존: settlements/calculation.ts에서 orders, order_assignments, 
 *       order_status_history, team_leader_ledger_daily, 
 *       team_leader_daily_stats, region_daily_stats 등 6개 테이블 직접 UPDATE
 * 개선: 이 서비스 함수로 캡슐화, 정산 라우트는 이 함수만 호출
 * 
 * 처리 내용:
 * 1. 주문 상태 → SETTLEMENT_CONFIRMED
 * 2. 배정 상태 동기화
 * 3. 상태 이력 기록
 * 4. 팀장 원장 업데이트
 * 5. 팀장/지역 일별 통계 업데이트
 */
export async function confirmSettlementOrders(
  db: D1Database,
  runId: number,
  items: SettlementConfirmItem[],
  actorUserId: number
): Promise<ConfirmResult> {
  const todayStr = today();
  const batch = new BatchBuilder(db).label(`settlement-confirm-${runId}`);
  let confirmedCount = 0;
  const errors: { order_id: number; error: string }[] = [];

  // 선 검증: 모든 주문의 현재 상태가 HQ_APPROVED인지 확인
  const orderIds = items.map(s => s.order_id);
  if (orderIds.length === 0) {
    return { confirmedCount: 0, errors: [] };
  }

  const orderStatuses = await db.prepare(`
    SELECT order_id, status FROM orders WHERE order_id IN (${orderIds.map(() => '?').join(',')})
  `).bind(...orderIds).all();

  const statusMap = new Map<number, string>();
  for (const os of orderStatuses.results as any[]) {
    statusMap.set(os.order_id, os.status);
  }

  for (const item of items) {
    const currentStatus = statusMap.get(item.order_id);
    if (currentStatus !== 'HQ_APPROVED') {
      errors.push({
        order_id: item.order_id,
        error: `주문 상태가 ${currentStatus}로 변경됨 (HQ_APPROVED 필요)`,
      });
      continue;
    }

    // 1. 정산 확정
    batch.add(
      `UPDATE settlements SET status = 'CONFIRMED', confirmed_by = ?, confirmed_at = datetime('now') WHERE settlement_id = ?`,
      [actorUserId, item.settlement_id]
    );

    // 2. 주문 상태 전이
    batch.add(
      `UPDATE orders SET status = 'SETTLEMENT_CONFIRMED', updated_at = datetime('now') WHERE order_id = ? AND status = 'HQ_APPROVED'`,
      [item.order_id]
    );

    // 3. 배정 상태 동기화
    batch.add(
      `UPDATE order_assignments SET status = 'SETTLEMENT_CONFIRMED', updated_at = datetime('now') WHERE order_id = ? AND status = 'HQ_APPROVED'`,
      [item.order_id]
    );

    // 4. 상태 이력
    batch.add(
      `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note) VALUES (?, 'HQ_APPROVED', 'SETTLEMENT_CONFIRMED', ?, ?)`,
      [item.order_id, actorUserId, `정산확정 run_id:${runId}`]
    );

    // 5. 팀장 원장
    batch.add(
      `INSERT INTO team_leader_ledger_daily (date, team_leader_id, confirmed_payable_sum, confirmed_count, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'))
       ON CONFLICT(date, team_leader_id) DO UPDATE SET
         confirmed_payable_sum = confirmed_payable_sum + ?,
         confirmed_count = confirmed_count + 1,
         updated_at = datetime('now')`,
      [todayStr, item.team_leader_id, item.payable_amount, item.payable_amount]
    );

    // 6. 팀장 일별 통계
    batch.add(
      `INSERT INTO team_leader_daily_stats (date, team_leader_id, settlement_confirmed_count, payable_amount_sum, updated_at)
       VALUES (?, ?, 1, ?, datetime('now'))
       ON CONFLICT(date, team_leader_id) DO UPDATE SET
         settlement_confirmed_count = settlement_confirmed_count + 1,
         payable_amount_sum = payable_amount_sum + ?,
         updated_at = datetime('now')`,
      [todayStr, item.team_leader_id, item.payable_amount, item.payable_amount]
    );

    // 7. 지역 일별 통계
    batch.add(
      `INSERT INTO region_daily_stats (date, region_org_id, settlement_confirmed_count, payable_amount_sum, updated_at)
       VALUES (?, ?, 1, ?, datetime('now'))
       ON CONFLICT(date, region_org_id) DO UPDATE SET
         settlement_confirmed_count = settlement_confirmed_count + 1,
         payable_amount_sum = payable_amount_sum + ?,
         updated_at = datetime('now')`,
      [todayStr, item.region_org_id, item.payable_amount, item.payable_amount]
    );

    confirmedCount++;
  }

  if (confirmedCount > 0) {
    // Run 상태 업데이트
    batch.add(
      `UPDATE settlement_runs SET status = 'CONFIRMED', updated_at = datetime('now') WHERE run_id = ?`,
      [runId]
    );

    // 배치 실행 (원자적 트랜잭션)
    await batch.execute();
  }

  // 감사 로그
  await writeAuditLog(db, {
    entity_type: 'SETTLEMENT_RUN',
    entity_id: runId,
    action: 'SETTLEMENT.CONFIRMED' as AuditEventCode,
    actor_id: actorUserId,
    detail_json: JSON.stringify({ confirmed_count: confirmedCount, errors: errors.length }),
  });

  return { confirmedCount, errors };
}
