// ================================================================
// 다하다 OMS — 감사 로그 & 상태 이력 유틸 v5.0
// 구조화된 이벤트 코드 사용
// ================================================================

import type { AuditEventCode } from '../types';

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

/** 알림 생성 */
export async function createNotification(db: D1Database, params: {
  recipient_user_id: number;
  type: string;
  title: string;
  message?: string;
  link_url?: string;
  metadata_json?: string;
}) {
  await db.prepare(`
    INSERT INTO notifications (recipient_user_id, type, title, message, link_url, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    params.recipient_user_id,
    params.type,
    params.title,
    params.message || null,
    params.link_url || null,
    params.metadata_json || '{}'
  ).run();
}

/** 다중 사용자에게 알림 생성 */
export async function createNotifications(db: D1Database, userIds: number[], params: {
  type: string;
  title: string;
  message?: string;
  link_url?: string;
  metadata_json?: string;
}) {
  for (const userId of userIds) {
    await createNotification(db, { ...params, recipient_user_id: userId });
  }
}
