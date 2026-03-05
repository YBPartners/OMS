// ============================================================
// 다하다 OMS — Core Constants v3.1
// 전역 상수, 상태 매핑, 권한 정의
// ============================================================

window.OMS = window.OMS || {};

OMS.STATUS = {
  RECEIVED: { label: '수신', color: 'bg-gray-100 text-gray-700', icon: 'fa-inbox', step: 1 },
  VALIDATED: { label: '유효성통과', color: 'bg-blue-100 text-blue-700', icon: 'fa-check-circle', step: 2 },
  DISTRIBUTION_PENDING: { label: '배분대기', color: 'bg-yellow-100 text-yellow-700', icon: 'fa-clock', step: 3 },
  DISTRIBUTED: { label: '배분완료', color: 'bg-indigo-100 text-indigo-700', icon: 'fa-share-nodes', step: 4 },
  ASSIGNED: { label: '배정완료', color: 'bg-purple-100 text-purple-700', icon: 'fa-user-check', step: 5 },
  IN_PROGRESS: { label: '작업중', color: 'bg-orange-100 text-orange-700', icon: 'fa-wrench', step: 6 },
  SUBMITTED: { label: '보고서제출', color: 'bg-cyan-100 text-cyan-700', icon: 'fa-file-lines', step: 7 },
  REGION_APPROVED: { label: '지역승인', color: 'bg-lime-100 text-lime-700', icon: 'fa-thumbs-up', step: 8 },
  REGION_REJECTED: { label: '지역반려', color: 'bg-red-100 text-red-700', icon: 'fa-thumbs-down', step: 8 },
  HQ_APPROVED: { label: 'HQ승인', color: 'bg-green-100 text-green-700', icon: 'fa-circle-check', step: 9 },
  HQ_REJECTED: { label: 'HQ반려', color: 'bg-red-100 text-red-700', icon: 'fa-circle-xmark', step: 9 },
  SETTLEMENT_CONFIRMED: { label: '정산확정', color: 'bg-emerald-100 text-emerald-700', icon: 'fa-coins', step: 10 },
  PAID: { label: '지급완료', color: 'bg-teal-100 text-teal-700', icon: 'fa-money-check', step: 11 },
};

// Alias for backward compatibility (fix STATUS vs OMS.STATUS references)
const STATUS = OMS.STATUS;

// 권한별 접근 가능 페이지
OMS.PERMISSIONS = {
  SUPER_ADMIN: ['dashboard', 'orders', 'distribute', 'review-hq', 'settlement', 'reconciliation', 'statistics', 'hr-management', 'policies', 'audit-log', 'notifications', 'my-profile'],
  HQ_OPERATOR: ['dashboard', 'orders', 'distribute', 'review-hq', 'settlement', 'reconciliation', 'statistics', 'hr-management', 'policies', 'audit-log', 'notifications', 'my-profile'],
  REGION_ADMIN: ['dashboard', 'kanban', 'review-region', 'hr-management', 'statistics', 'notifications', 'my-profile'],
  TEAM_LEADER: ['my-orders', 'my-stats', 'notifications', 'my-profile'],
  AUDITOR: ['dashboard', 'statistics', 'reconciliation', 'audit-log', 'notifications', 'my-profile'],
};

// 메뉴 정의
OMS.MENU_ITEMS = {
  HQ: [
    { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드', group: '현황' },
    { id: 'orders', icon: 'fa-list-check', label: '주문관리', group: '주문' },
    { id: 'distribute', icon: 'fa-share-nodes', label: '자동배분', group: '주문' },
    { id: 'review-hq', icon: 'fa-clipboard-check', label: 'HQ검수', group: '검수' },
    { id: 'settlement', icon: 'fa-coins', label: '정산관리', group: '정산' },
    { id: 'reconciliation', icon: 'fa-scale-balanced', label: '대사(정합성)', group: '정산' },
    { id: 'statistics', icon: 'fa-chart-bar', label: '통계', group: '분석' },
    { id: 'hr-management', icon: 'fa-users-gear', label: '인사관리', group: '관리' },
    { id: 'policies', icon: 'fa-gears', label: '정책관리', group: '관리' },
    { id: 'audit-log', icon: 'fa-scroll', label: '감사로그', group: '관리' },
    { id: 'notifications', icon: 'fa-bell', label: '알림', group: '관리' },
  ],
  REGION: [
    { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드', group: '현황' },
    { id: 'kanban', icon: 'fa-columns', label: '칸반(팀장배정)', group: '배정' },
    { id: 'review-region', icon: 'fa-clipboard-check', label: '1차검수', group: '검수' },
    { id: 'hr-management', icon: 'fa-users-gear', label: '인사/수수료', group: '관리' },
    { id: 'statistics', icon: 'fa-chart-bar', label: '통계', group: '분석' },
    { id: 'notifications', icon: 'fa-bell', label: '알림', group: '관리' },
  ],
  TEAM_LEADER: [
    { id: 'my-orders', icon: 'fa-list', label: '내 주문', group: '주문' },
    { id: 'my-stats', icon: 'fa-chart-line', label: '내 현황', group: '현황' },
    { id: 'notifications', icon: 'fa-bell', label: '알림', group: '알림' },
  ],
};

// 반려 사유 코드
OMS.REJECT_REASONS = [
  { code: 'PHOTO_INSUFFICIENT', label: '사진부족', icon: 'fa-camera' },
  { code: 'ADDRESS_MISMATCH', label: '주소불일치', icon: 'fa-map-marker' },
  { code: 'AMOUNT_ERROR', label: '금액오류', icon: 'fa-won-sign' },
  { code: 'INCOMPLETE_WORK', label: '작업미완', icon: 'fa-wrench' },
  { code: 'CHECKLIST_FAIL', label: '체크리스트미달', icon: 'fa-clipboard' },
  { code: 'OTHER', label: '기타', icon: 'fa-ellipsis' },
];

// 보고서 체크리스트 항목
OMS.REPORT_CHECKLIST = [
  { key: 'exterior_photo', label: '외부촬영', icon: 'fa-building', required: true },
  { key: 'interior_photo', label: '내부촬영', icon: 'fa-door-open', required: true },
  { key: 'before_wash', label: '세척전', icon: 'fa-water', required: true },
  { key: 'after_wash', label: '세척후', icon: 'fa-sparkles', required: true },
  { key: 'receipt', label: '영수증', icon: 'fa-receipt', required: false },
  { key: 'customer_confirm', label: '고객확인', icon: 'fa-signature', required: false },
];

// 대사 이슈 유형 라벨
OMS.ISSUE_TYPES = {
  DUPLICATE_ORDER: { label: '중복주문', icon: 'fa-copy', color: 'text-red-600' },
  DISTRIBUTION_MISSING: { label: '배분누락', icon: 'fa-share-nodes', color: 'text-orange-600' },
  ASSIGNMENT_MISSING: { label: '배정누락', icon: 'fa-user-plus', color: 'text-amber-600' },
  REPORT_MISSING: { label: '보고서누락', icon: 'fa-file-excel', color: 'text-red-600' },
  PHOTO_COUNT_INSUFFICIENT: { label: '사진부족', icon: 'fa-camera', color: 'text-yellow-600' },
  STATUS_INCONSISTENT: { label: '상태불일치', icon: 'fa-exclamation-circle', color: 'text-purple-600' },
  AMOUNT_MISMATCH: { label: '금액불일치', icon: 'fa-won-sign', color: 'text-red-700' },
};

// 정산 Run 상태
OMS.RUN_STATUS = {
  DRAFT: { label: '초안', color: 'bg-gray-100 text-gray-700', icon: 'fa-pencil' },
  CALCULATED: { label: '산출완료', color: 'bg-blue-100 text-blue-700', icon: 'fa-calculator' },
  CONFIRMED: { label: '확정', color: 'bg-green-100 text-green-700', icon: 'fa-check-double' },
};

// 이슈 심각도
OMS.SEVERITY = {
  CRITICAL: { label: '심각', color: 'bg-red-100 text-red-700 border-red-300' },
  HIGH: { label: '높음', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  MEDIUM: { label: '보통', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  LOW: { label: '낮음', color: 'bg-gray-100 text-gray-600 border-gray-300' },
};
