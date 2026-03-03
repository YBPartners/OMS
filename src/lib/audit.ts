// ================================================================
// 다하다 OMS — 감사 로그 & 상태 이력 유틸
// ================================================================

/** 감사 로그 기록 */
export async function writeAuditLog(db: D1Database, params: {
  entity_type: string;
  entity_id?: number;
  action: string;
  actor_id?: number;
  detail_json?: string;
}) {
  await db.prepare(`
    INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, detail_json)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    params.entity_type,
    params.entity_id || null,
    params.action,
    params.actor_id || null,
    params.detail_json || '{}'
  ).run();
}

/** 주문 상태 이력 기록 */
export async function writeStatusHistory(db: D1Database, params: {
  order_id: number;
  from_status: string | null;
  to_status: string;
  actor_id: number;
  note?: string;
}) {
  await db.prepare(`
    INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
    VALUES (?, ?, ?, ?, ?)
  `).bind(params.order_id, params.from_status, params.to_status, params.actor_id, params.note || null).run();
}
