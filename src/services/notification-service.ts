// ================================================================
// Airflow OMS — Notification Service v1.0
// 알림 도메인의 유일한 쓰기 진입점
// 타 도메인은 이 서비스를 통해서만 notifications 테이블에 접근
// ================================================================

import type { NotificationType } from '../types';

/** 알림 생성 파라미터 */
export interface CreateNotificationParams {
  type: NotificationType | string;
  title: string;
  message: string;
  link_url?: string;
  metadata_json?: string;
}

/** 알림 유형 → notification_preferences 컬럼 매핑 */
const TYPE_TO_PREF_COL: Record<string, string> = {
  ORDER_STATUS:       'notify_order_status',
  ORDER_RECEIVED:     'notify_order_status',
  ORDER_COMPLETED:    'notify_order_status',
  DISTRIBUTION:       'notify_assignment',
  ASSIGNMENT:         'notify_assignment',
  ASSIGNMENT_CANCEL:  'notify_assignment',
  REVIEW_APPROVED:    'notify_review',
  REVIEW_REJECTED:    'notify_review',
  REGION_APPROVED:    'notify_review',
  REGION_REJECTED:    'notify_review',
  HQ_APPROVED:        'notify_review',
  HQ_REJECTED:        'notify_review',
  SETTLEMENT:         'notify_settlement',
  SETTLEMENT_CONFIRMED: 'notify_settlement',
  PAID:               'notify_settlement',
  SIGNUP_REQUEST:     'notify_signup',
  SIGNUP_APPROVED:    'notify_signup',
  SIGNUP_REJECTED:    'notify_signup',
  REGION_ADD_REQUEST: 'notify_signup',
  REGION_ADD_APPROVED:'notify_signup',
  SYSTEM:             'notify_system',
};

/** 사용자의 알림 설정 확인 — 해당 유형이 비활성이면 false 반환 */
async function isNotificationEnabled(
  db: D1Database, userId: number, type: string
): Promise<boolean> {
  const col = TYPE_TO_PREF_COL[type];
  if (!col) return true; // 매핑 없는 유형은 기본 허용

  const row = await db.prepare(
    `SELECT ${col} as enabled FROM notification_preferences WHERE user_id = ?`
  ).bind(userId).first() as { enabled: number } | null;

  // 설정 행이 없으면 기본값 1(활성)
  return row ? row.enabled === 1 : true;
}

/** 단건 알림 생성 (사용자 설정 확인 후 발송) */
export async function createNotification(
  db: D1Database,
  recipientUserId: number,
  params: CreateNotificationParams
): Promise<void> {
  // 사용자가 해당 유형 알림을 끈 경우 skip
  const enabled = await isNotificationEnabled(db, recipientUserId, params.type);
  if (!enabled) return;

  await db.prepare(`
    INSERT INTO notifications (recipient_user_id, type, title, message, link_url, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    recipientUserId,
    params.type,
    params.title,
    params.message,
    params.link_url || null,
    params.metadata_json || null
  ).run();
}

/** 다건 알림 생성 (같은 내용을 여러 사용자에게) */
export async function createNotifications(
  db: D1Database,
  recipientUserIds: number[],
  params: CreateNotificationParams
): Promise<void> {
  for (const userId of recipientUserIds) {
    await createNotification(db, userId, params);
  }
}

/** 가입 승인 알림 생성 (도메인 특화 팩토리) */
export async function notifySignupApproved(
  db: D1Database,
  recipientUserId: number,
  opts: { requestId: number; orgId: number; name: string }
): Promise<void> {
  await createNotification(db, recipientUserId, {
    type: 'SIGNUP_APPROVED',
    title: '가입 승인',
    message: `${opts.name}님의 가입이 승인되었습니다.`,
    link_url: '#my-orders',
    metadata_json: JSON.stringify({ request_id: opts.requestId, org_id: opts.orgId }),
  });
}

/** 지역 추가 요청 처리 완료 알림 (총판 관리자에게) */
export async function notifyRegionAddComplete(
  db: D1Database,
  distributorOrgId: number,
  opts: { signupRequestId: number; applicantName: string }
): Promise<void> {
  // 해당 총판의 REGION_ADMIN 조회
  const distAdmins = await db.prepare(`
    SELECT u.user_id FROM users u
    JOIN user_roles ur ON u.user_id = ur.user_id
    JOIN roles r ON ur.role_id = r.role_id
    WHERE u.org_id = ? AND r.code = 'REGION_ADMIN' AND u.status = 'ACTIVE'
  `).bind(distributorOrgId).all();

  const adminIds = (distAdmins.results as any[]).map(r => r.user_id);
  if (adminIds.length > 0) {
    await createNotifications(db, adminIds, {
      type: 'REGION_ADD_APPROVED',
      title: '추가 지역 요청 승인 완료',
      message: `${opts.applicantName}의 모든 추가 지역 요청이 처리되었습니다. 가입 승인을 진행하세요.`,
      link_url: `#signup-requests/${opts.signupRequestId}`,
      metadata_json: JSON.stringify({ signup_request_id: opts.signupRequestId }),
    });
  }
}
