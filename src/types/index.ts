// 다하다 OMS 타입 정의

export type OrgType = 'HQ' | 'REGION';
export type RoleCode = 'SUPER_ADMIN' | 'HQ_OPERATOR' | 'REGION_ADMIN' | 'TEAM_LEADER' | 'AUDITOR';
export type OrderStatus = 'RECEIVED' | 'VALIDATED' | 'DISTRIBUTION_PENDING' | 'DISTRIBUTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'REGION_APPROVED' | 'REGION_REJECTED' | 'HQ_APPROVED' | 'HQ_REJECTED' | 'SETTLEMENT_CONFIRMED' | 'PAID';
export type ReviewStage = 'REGION' | 'HQ';
export type ReviewResult = 'APPROVE' | 'REJECT';
export type CommissionMode = 'FIXED' | 'PERCENT';
export type PeriodType = 'WEEKLY' | 'MONTHLY';
export type PhotoCategory = 'BEFORE' | 'AFTER' | 'WASH' | 'RECEIPT' | 'ETC';
export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueType = 'DUPLICATE_ORDER' | 'DISTRIBUTION_MISSING' | 'ASSIGNMENT_MISSING' | 'REPORT_MISSING' | 'PHOTO_COUNT_INSUFFICIENT' | 'ORPHAN_PHOTO' | 'STATUS_INCONSISTENT' | 'AMOUNT_MISMATCH';

export interface Env {
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    user: SessionUser | null;
  };
}

export interface SessionUser {
  user_id: number;
  org_id: number;
  org_type: OrgType;
  org_name?: string;
  login_id: string;
  name: string;
  roles: RoleCode[];
}

// 상태 전이 규칙
export const STATUS_TRANSITIONS: Record<string, { next: OrderStatus[]; requiredRoles: RoleCode[] }> = {
  'RECEIVED':           { next: ['VALIDATED'],              requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'VALIDATED':          { next: ['DISTRIBUTED', 'DISTRIBUTION_PENDING'], requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'DISTRIBUTION_PENDING': { next: ['DISTRIBUTED'],          requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'DISTRIBUTED':        { next: ['ASSIGNED'],               requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN'] },
  'ASSIGNED':           { next: ['IN_PROGRESS'],            requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  'IN_PROGRESS':        { next: ['SUBMITTED'],              requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  'SUBMITTED':          { next: ['REGION_APPROVED', 'REGION_REJECTED'], requiredRoles: ['SUPER_ADMIN', 'REGION_ADMIN'] },
  'REGION_APPROVED':    { next: ['HQ_APPROVED', 'HQ_REJECTED'],        requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'REGION_REJECTED':    { next: ['SUBMITTED'],              requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  'HQ_APPROVED':        { next: ['SETTLEMENT_CONFIRMED'],   requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
  'HQ_REJECTED':        { next: ['SUBMITTED'],              requiredRoles: ['SUPER_ADMIN', 'TEAM_LEADER'] },
  'SETTLEMENT_CONFIRMED': { next: ['PAID'],                 requiredRoles: ['SUPER_ADMIN', 'HQ_OPERATOR'] },
};

// 상태 한글명
export const STATUS_LABELS: Record<string, string> = {
  'RECEIVED': '수신', 'VALIDATED': '유효성통과', 'DISTRIBUTION_PENDING': '배분대기',
  'DISTRIBUTED': '배분완료', 'ASSIGNED': '배정완료', 'IN_PROGRESS': '작업중',
  'SUBMITTED': '보고서제출', 'REGION_APPROVED': '지역승인', 'REGION_REJECTED': '지역반려',
  'HQ_APPROVED': 'HQ승인', 'HQ_REJECTED': 'HQ반려', 'SETTLEMENT_CONFIRMED': '정산확정',
  'PAID': '지급완료'
};
