// ================================================================
// Airflow OMS — 감사 로그 & 상태 이력 유틸 v6.0
// 구조화된 이벤트 코드 사용
//
// NOTE v6.0: createNotification(s)은 services/notification-service.ts로 이동.
// 기존 호환성을 위해 re-export 유지.
// ================================================================

import type { AuditEventCode } from '../types';
// 알림 함수는 notification-service에서 re-export (하위 호환)
export { createNotification, createNotifications } from '../services/notification-service';

/** 감사 로그 기록 (구조화 이벤트 코드) */
export async function writeAuditLog(db: D1Database, params: {
  entity_type: string;
  entity_id?: number;
  action: string | AuditEventCode;
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
