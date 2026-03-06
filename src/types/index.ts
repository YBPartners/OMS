// ================================================================
// 와이비 OMS 타입 정의 v6.0
// v6.0: READY_DONE, DONE 상태 추가 (팀장 수행 플로우 정규화)
// ================================================================

// ─── 기본 Enum 타입 ───
export type OrgType = 'HQ' | 'REGION' | 'TEAM';
export type RoleCode = 'SUPER_ADMIN' | 'HQ_OPERATOR' | 'REGION_ADMIN' | 'AGENCY_LEADER' | 'TEAM_LEADER' | 'AUDITOR';
export type OrderStatus = 'RECEIVED' | 'VALIDATED' | 'DISTRIBUTION_PENDING' | 'DISTRIBUTED' | 'ASSIGNED' | 'READY_DONE' | 'IN_PROGRESS' | 'SUBMITTED' | 'DONE' | 'REGION_APPROVED' | 'REGION_REJECTED' | 'HQ_APPROVED' | 'HQ_REJECTED' | 'SETTLEMENT_CONFIRMED' | 'PAID';
export type ReviewStage = 'REGION' | 'HQ';
export type ReviewResult = 'APPROVE' | 'REJECT';
export type CommissionMode = 'FIXED' | 'PERCENT';
export type PeriodType = 'WEEKLY' | 'MONTHLY';
export type PhotoCategory = 'BEFORE' | 'AFTER' | 'WASH' | 'RECEIPT' | 'ETC';
export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueType = 'DUPLICATE_ORDER' | 'DISTRIBUTION_MISSING' | 'ASSIGNMENT_MISSING' | 'REPORT_MISSING' | 'PHOTO_COUNT_INSUFFICIENT' | 'ORPHAN_PHOTO' | 'STATUS_INCONSISTENT' | 'AMOUNT_MISMATCH';

// ─── 가입 관련 타입 ───
export type SignupStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REGION_ADD_REQUESTED';
export type RegionAddStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONFLICT';
export type NotificationType = 'SIGNUP_APPROVED' | 'SIGNUP_REJECTED' | 'REGION_ADD_APPROVED' | 'REGION_ADD_REJECTED' | 'AGENCY_PROMOTED' | 'AGENCY_DEMOTED' | 'SYSTEM';

// ─── 감사 이벤트 코드 (구조화) ───
export type AuditEventCode =
  | 'AUTH.LOGIN' | 'AUTH.LOGOUT' | 'AUTH.LOGIN_FAILED'
  | 'SIGNUP.CREATED' | 'SIGNUP.APPROVED' | 'SIGNUP.REJECTED' | 'SIGNUP.REAPPLIED'
  | 'ORG.CREATED' | 'ORG.UPDATED' | 'ORG.DEACTIVATED'
  | 'ORDER.STATUS_CHANGED' | 'ORDER.DISTRIBUTED' | 'ORDER.ASSIGNED' | 'ORDER.SUBMITTED' | 'ORDER.REVIEWED'
  | 'SETTLEMENT.CALCULATED' | 'SETTLEMENT.CONFIRMED' | 'SETTLEMENT.PAID'
  | 'REGION.MAPPED' | 'REGION.UNMAPPED' | 'REGION.CONFLICT_DETECTED'
  | 'USER.CREATED' | 'USER.UPDATED' | 'USER.DEACTIVATED'
  | 'COMMISSION.SET' | 'COMMISSION.UPDATED'
  | 'AGENCY.PROMOTED' | 'AGENCY.DEMOTED' | 'AGENCY.TEAM_ADDED' | 'AGENCY.TEAM_REMOVED'
  | 'CHANNEL.CREATED' | 'CHANNEL.UPDATED' | 'CHANNEL.DEACTIVATED';

// ─── Hono 환경 바인딩 ───
export interface Env {
  Bindings: {
    DB: D1Database;
    SESSION_CACHE: KVNamespace;
    RESEND_API_KEY?: string;
  };
  Variables: {
    user: SessionUser | null;
  };
}

// ─── 세션 사용자 ───
export interface SessionUser {
  user_id: number;
  org_id: number;
  org_type: OrgType;
  org_name?: string;
  login_id: string;
  name: string;
  roles: RoleCode[];
  /** 대리점 역할 여부 (AGENCY_LEADER 역할 보유 시 true) */
  is_agency?: boolean;
  /** 대리점장인 경우 하위 팀장 user_id 목록 */
  agency_team_ids?: number[];
}

// ─── 상태 전이 규칙 (State Machine 입력) ───
export interface TransitionRule {
  next: OrderStatus[];
  requiredRoles: RoleCode[];
}

export const STATUS_TRANSITIONS: Record<string, TransitionRule> = {
  'RECEIVED':             { next: ['VALIDATED'],                         requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'VALIDATED':            { next: ['DISTRIBUTED', 'DISTRIBUTION_PENDING'], requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'DISTRIBUTION_PENDING': { next: ['DISTRIBUTED'],                       requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'DISTRIBUTED':          { next: ['ASSIGNED'],                          requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AGENCY_LEADER'] },
  // ★ v6.0: ASSIGNED(준비) → READY_DONE(준비완료: 고객통화+일정확정) → IN_PROGRESS(수행중)
  'ASSIGNED':             { next: ['READY_DONE'],                        requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  'READY_DONE':           { next: ['IN_PROGRESS'],                       requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  // ★ v6.0: IN_PROGRESS → SUBMITTED(완료전송) → DONE(최종완료: 영수증) → 검수
  'IN_PROGRESS':          { next: ['SUBMITTED'],                         requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  'SUBMITTED':            { next: ['DONE'],                              requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  'DONE':                 { next: ['REGION_APPROVED', 'REGION_REJECTED'], requiredRoles: ['SUPER_ADMIN', 'REGION_ADMIN', 'AGENCY_LEADER'] },
  'REGION_APPROVED':      { next: ['HQ_APPROVED', 'HQ_REJECTED'],       requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'REGION_REJECTED':      { next: ['IN_PROGRESS'],                       requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  'HQ_APPROVED':          { next: ['SETTLEMENT_CONFIRMED'],              requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'HQ_REJECTED':          { next: ['IN_PROGRESS'],                       requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  'SETTLEMENT_CONFIRMED': { next: ['PAID'],                              requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
};

// ─── 상태 한글명 ───
export const STATUS_LABELS: Record<string, string> = {
  'RECEIVED': '수신', 'VALIDATED': '유효성통과', 'DISTRIBUTION_PENDING': '배분대기',
  'DISTRIBUTED': '배분완료', 'ASSIGNED': '준비(배정됨)', 'READY_DONE': '준비완료',
  'IN_PROGRESS': '수행중', 'SUBMITTED': '완료전송', 'DONE': '최종완료',
  'REGION_APPROVED': '지역승인', 'REGION_REJECTED': '지역반려',
  'HQ_APPROVED': 'HQ승인', 'HQ_REJECTED': 'HQ반려', 'SETTLEMENT_CONFIRMED': '정산확정',
  'PAID': '지급완료'
};

// ─── OrgType 한글 라벨 ───
export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  HQ: '본사',
  REGION: '총판',      // v5.0: REGION = 총판 (구 지역법인)
  TEAM: '팀',
};

// ─── RoleCode 한글 라벨 ───
export const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: '총괄관리자',
  HQ_OPERATOR: 'HQ운영자',
  REGION_ADMIN: '파트장',
  AGENCY_LEADER: '대리점장',
  TEAM_LEADER: '팀장',
  AUDITOR: '감사',
};
