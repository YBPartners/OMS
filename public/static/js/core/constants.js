// ============================================================
// Airflow OMS — Core Constants v8.0 (REFACTOR-1)
// 전역 상수, 상태 매핑, 권한 정의
// v8.0: 시군구 전환, VALIDATED→삭제, CONFIRMED(가격확정) 추가
//       서비스 카테고리 20개 + 옵션, 레거시 SERVICE_TYPES 폐지
// ============================================================

window.OMS = window.OMS || {};

OMS.STATUS = {
  RECEIVED: { label: '수신', color: 'bg-gray-100 text-gray-700', icon: 'fa-inbox', step: 1 },
  DISTRIBUTION_PENDING: { label: '배분대기', color: 'bg-yellow-100 text-yellow-700', icon: 'fa-clock', step: 2 },
  DISTRIBUTED: { label: '배분완료', color: 'bg-indigo-100 text-indigo-700', icon: 'fa-share-nodes', step: 3 },
  ASSIGNED: { label: '배정완료', color: 'bg-purple-100 text-purple-700', icon: 'fa-user-check', step: 4 },
  READY_DONE: { label: '준비완료', color: 'bg-violet-100 text-violet-700', icon: 'fa-phone-volume', step: 4.5 },
  CONFIRMED: { label: '가격확정', color: 'bg-blue-100 text-blue-700', icon: 'fa-won-sign', step: 5 },
  IN_PROGRESS: { label: '수행중', color: 'bg-orange-100 text-orange-700', icon: 'fa-wrench', step: 6 },
  SUBMITTED: { label: '완료전송', color: 'bg-cyan-100 text-cyan-700', icon: 'fa-file-lines', step: 7 },
  DONE: { label: '최종완료', color: 'bg-sky-100 text-sky-700', icon: 'fa-check-double', step: 7.5 },
  REGION_APPROVED: { label: '지역승인', color: 'bg-lime-100 text-lime-700', icon: 'fa-thumbs-up', step: 8 },
  REGION_REJECTED: { label: '지역반려', color: 'bg-red-100 text-red-700', icon: 'fa-thumbs-down', step: 8 },
  HQ_APPROVED: { label: 'HQ승인', color: 'bg-green-100 text-green-700', icon: 'fa-circle-check', step: 9 },
  HQ_REJECTED: { label: 'HQ반려', color: 'bg-red-100 text-red-700', icon: 'fa-circle-xmark', step: 9 },
  SETTLEMENT_CONFIRMED: { label: '정산확정', color: 'bg-emerald-100 text-emerald-700', icon: 'fa-coins', step: 10 },
  PAID: { label: '지급완료', color: 'bg-teal-100 text-teal-700', icon: 'fa-money-check', step: 11 },
};

const STATUS = OMS.STATUS;

// 권한별 접근 가능 페이지
OMS.PERMISSIONS = {
  SUPER_ADMIN: ['dashboard', 'orders', 'distribute', 'schedule', 'review-hq', 'settlement', 'reconciliation', 'statistics', 'hr-management', 'policies', 'audit-log', 'notifications', 'my-profile', 'channels', 'system-admin', 'banner-manage'],
  HQ_OPERATOR: ['dashboard', 'orders', 'distribute', 'schedule', 'review-hq', 'settlement', 'reconciliation', 'statistics', 'hr-management', 'policies', 'audit-log', 'notifications', 'my-profile', 'channels'],
  REGION_ADMIN: ['dashboard', 'kanban', 'schedule', 'review-region', 'hr-management', 'statistics', 'notifications', 'my-profile'],
  AGENCY_LEADER: ['dashboard', 'agency-dashboard', 'agency-orders', 'agency-team', 'agency-statement', 'review-region', 'kanban', 'schedule', 'my-orders', 'my-stats', 'notifications', 'my-profile'],
  TEAM_LEADER: ['dashboard', 'my-orders', 'schedule', 'my-stats', 'notifications', 'my-profile'],
  AUDITOR: ['dashboard', 'statistics', 'reconciliation', 'audit-log', 'notifications', 'my-profile'],
};

// 메뉴 정의
OMS.MENU_ITEMS = {
  HQ: [
    { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드', group: '현황' },
    { id: 'orders', icon: 'fa-list-check', label: '주문관리', group: '주문' },
    { id: 'distribute', icon: 'fa-share-nodes', label: '자동배분', group: '주문' },
    { id: 'schedule', icon: 'fa-calendar-days', label: '일정/캘린더', group: '주문' },
    { id: 'channels', icon: 'fa-satellite-dish', label: '주문채널', group: '주문' },
    { id: 'review-hq', icon: 'fa-clipboard-check', label: 'HQ검수', group: '검수' },
    { id: 'settlement', icon: 'fa-coins', label: '정산관리', group: '정산' },
    { id: 'reconciliation', icon: 'fa-scale-balanced', label: '대사(정합성)', group: '정산' },
    { id: 'statistics', icon: 'fa-chart-bar', label: '통계', group: '분석' },
    { id: 'hr-management', icon: 'fa-users-gear', label: '인사관리', group: '관리' },
    { id: 'policies', icon: 'fa-gears', label: '정책관리', group: '관리' },
    { id: 'audit-log', icon: 'fa-scroll', label: '감사로그', group: '관리' },
    { id: 'notifications', icon: 'fa-bell', label: '알림', group: '관리' },
    { id: 'system-admin', icon: 'fa-server', label: '시스템', group: '관리', adminOnly: true },
    { id: 'banner-manage', icon: 'fa-rectangle-ad', label: '광고관리', group: '관리', adminOnly: true },
  ],
  REGION: [
    { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드', group: '현황' },
    { id: 'kanban', icon: 'fa-columns', label: '칸반(팀장배정)', group: '배정' },
    { id: 'schedule', icon: 'fa-calendar-days', label: '일정/캘린더', group: '배정' },
    { id: 'review-region', icon: 'fa-clipboard-check', label: '1차검수', group: '검수' },
    { id: 'hr-management', icon: 'fa-users-gear', label: '인사/수수료', group: '관리' },
    { id: 'statistics', icon: 'fa-chart-bar', label: '통계', group: '분석' },
    { id: 'notifications', icon: 'fa-bell', label: '알림', group: '관리' },
  ],
  AGENCY: [
    { id: 'agency-dashboard', icon: 'fa-store', label: '대리점 현황', group: '현황' },
    { id: 'agency-orders', icon: 'fa-list-check', label: '주문관리', group: '주문' },
    { id: 'agency-team', icon: 'fa-people-group', label: '소속 팀장', group: '관리' },
    { id: 'agency-statement', icon: 'fa-file-invoice-dollar', label: '정산 내역', group: '정산' },
    { id: 'kanban', icon: 'fa-columns', label: '칸반(배정)', group: '배정' },
    { id: 'schedule', icon: 'fa-calendar-days', label: '일정/캘린더', group: '배정' },
    { id: 'review-region', icon: 'fa-clipboard-check', label: '검수', group: '검수' },
    { id: 'my-orders', icon: 'fa-list', label: '내 주문', group: '내 작업' },
    { id: 'my-stats', icon: 'fa-chart-line', label: '내 현황', group: '내 작업' },
    { id: 'notifications', icon: 'fa-bell', label: '알림', group: '알림' },
  ],
  TEAM_LEADER: [
    { id: 'dashboard', icon: 'fa-chart-pie', label: '대시보드', group: '현황' },
    { id: 'my-orders', icon: 'fa-list', label: '내 주문', group: '주문' },
    { id: 'schedule', icon: 'fa-calendar-days', label: '일정/캘린더', group: '주문' },
    { id: 'my-stats', icon: 'fa-chart-line', label: '내 현황', group: '현황' },
    { id: 'notifications', icon: 'fa-bell', label: '알림', group: '알림' },
  ],
};

// 역할 라벨
OMS.ROLE_LABELS = {
  SUPER_ADMIN: '총괄관리자',
  HQ_OPERATOR: 'HQ운영자',
  REGION_ADMIN: '파트장',
  AGENCY_LEADER: '대리점장',
  TEAM_LEADER: '팀장',
  AUDITOR: '감사',
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

OMS.REPORT_CHECKLIST = [
  { key: 'exterior_photo', label: '외부촬영', icon: 'fa-building', required: true },
  { key: 'interior_photo', label: '내부촬영', icon: 'fa-door-open', required: true },
  { key: 'before_wash', label: '세척전', icon: 'fa-water', required: true },
  { key: 'after_wash', label: '세척후', icon: 'fa-sparkles', required: true },
  { key: 'receipt', label: '영수증', icon: 'fa-receipt', required: false },
  { key: 'customer_confirm', label: '고객확인', icon: 'fa-signature', required: false },
];

OMS.ISSUE_TYPES = {
  DUPLICATE_ORDER: { label: '중복주문', icon: 'fa-copy', color: 'text-red-600' },
  DISTRIBUTION_MISSING: { label: '배분누락', icon: 'fa-share-nodes', color: 'text-orange-600' },
  ASSIGNMENT_MISSING: { label: '배정누락', icon: 'fa-user-plus', color: 'text-amber-600' },
  REPORT_MISSING: { label: '보고서누락', icon: 'fa-file-excel', color: 'text-red-600' },
  PHOTO_COUNT_INSUFFICIENT: { label: '사진부족', icon: 'fa-camera', color: 'text-yellow-600' },
  STATUS_INCONSISTENT: { label: '상태불일치', icon: 'fa-exclamation-circle', color: 'text-purple-600' },
  AMOUNT_MISMATCH: { label: '금액불일치', icon: 'fa-won-sign', color: 'text-red-700' },
};

OMS.RUN_STATUS = {
  DRAFT: { label: '초안', color: 'bg-gray-100 text-gray-700', icon: 'fa-pencil' },
  CALCULATED: { label: '산출완료', color: 'bg-blue-100 text-blue-700', icon: 'fa-calculator' },
  CONFIRMED: { label: '확정', color: 'bg-green-100 text-green-700', icon: 'fa-check-double' },
};

OMS.SEVERITY = {
  CRITICAL: { label: '심각', color: 'bg-red-100 text-red-700 border-red-300' },
  HIGH: { label: '높음', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  MEDIUM: { label: '보통', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  LOW: { label: '낮음', color: 'bg-gray-100 text-gray-600 border-gray-300' },
};

// ─── 서비스 카테고리 (REFACTOR-1: 20개 항목) ───
OMS.SERVICE_CATEGORIES = {
  WALL_AC:           { label: '벽걸이',                  group: '벽걸이',    icon: 'fa-wind' },
  SYS_1WAY_2WAY:     { label: '시스템 1way/2way',        group: '시스템',    icon: 'fa-building' },
  SYS_4WAY:          { label: '시스템 4way',              group: '시스템',    icon: 'fa-building' },
  SYS_CIRCULAR:      { label: '시스템 원형',              group: '시스템',    icon: 'fa-circle' },
  STAND_HOME:        { label: '스탠드 가정용',            group: '스탠드',    icon: 'fa-tower-broadcast' },
  STAND_COM_UNDER40: { label: '스탠드 상업용(40평이하)',   group: '스탠드',    icon: 'fa-tower-broadcast' },
  STAND_40_NOFAN:    { label: '스탠드 40평↑ 팬미분리',    group: '스탠드',    icon: 'fa-tower-broadcast' },
  STAND_40_FAN:      { label: '스탠드 40평↑ 팬분리',      group: '스탠드',    icon: 'fa-tower-broadcast' },
  STAND_80_NOFAN:    { label: '스탠드 80평↑ 팬미분리',    group: '스탠드',    icon: 'fa-tower-broadcast' },
  STAND_80_FAN:      { label: '스탠드 80평↑ 팬분리',      group: '스탠드',    icon: 'fa-tower-broadcast' },
  TWO_IN_ONE:        { label: '투인원',                  group: '투인원',    icon: 'fa-arrows-rotate' },
  OUTDOOR_NORMAL:    { label: '실외기 일반(1구)',          group: '실외기',    icon: 'fa-fan' },
  OUTDOOR_LARGE:     { label: '실외기 대형(2구)',          group: '실외기',    icon: 'fa-fan' },
  OUTDOOR_TOWER:     { label: '실외기 초대형 타워',        group: '실외기',    icon: 'fa-fan' },
  CONVERTIBLE:       { label: '컨버터블',                 group: '컨버터블',  icon: 'fa-arrows-left-right' },
  DUCT:              { label: '매립덕트',                 group: '매립덕트',  icon: 'fa-arrow-right-from-bracket' },
  IRREG_GRILL_FILTER:{ label: '비정기 그릴+필터',         group: '비정기세척', icon: 'fa-broom' },
  IRREG_GRILL_AIR:   { label: '비정기 그릴+필터+공청',    group: '비정기세척', icon: 'fa-broom' },
  REG_FILTER_ONLY:   { label: '정기 필터만',              group: '정기세척',  icon: 'fa-calendar-check' },
  REG_GRILL_FILTER:  { label: '정기 그릴+필터',           group: '정기세척',  icon: 'fa-calendar-check' },
};

// 하위호환: 레거시 SERVICE_TYPES → SERVICE_CATEGORIES 매핑
OMS.SERVICE_TYPES = OMS.SERVICE_CATEGORIES;

// ─── 서비스 옵션 (추가 금액) ───
OMS.SERVICE_OPTIONS = {
  LG_OBJE: { label: 'LG오브제 추가', icon: 'fa-star' },
  URGENT:  { label: '긴급 출장',     icon: 'fa-bolt' },
  WEEKEND: { label: '주말/공휴일',   icon: 'fa-calendar-week' },
};

// ─── 가격확정 관련 상수 ───
OMS.PRICE_CONFIRM_STATUSES = ['ASSIGNED', 'READY_DONE'];  // 가격확정 가능 상태
OMS.POST_CONFIRM_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'SUBMITTED', 'DONE',
  'REGION_APPROVED', 'HQ_APPROVED', 'SETTLEMENT_CONFIRMED', 'PAID'];  // 가격확정 이후 상태
