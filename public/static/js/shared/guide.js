// ============================================================
// Airflow OMS — 온보딩 가이드 v1.0
// 각 메뉴 화면에 따뜻한 안내 텍스트와 용어 설명을 표시
// localStorage로 닫기 상태를 기억
// ============================================================

(function() {
  'use strict';

  const GUIDE_VERSION = '1';  // 가이드 내용 업데이트 시 버전 올리면 다시 노출
  const STORAGE_KEY = 'oms_guide_dismissed';

  // 닫은 가이드 목록 가져오기
  function getDismissed() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      // 버전이 다르면 초기화
      if (data._v !== GUIDE_VERSION) return {};
      return data;
    } catch { return {}; }
  }

  function setDismissed(page) {
    const data = getDismissed();
    data._v = GUIDE_VERSION;
    data[page] = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }

  // ─── 페이지별 가이드 데이터 ───
  const GUIDES = {

    // ── 대시보드 ──
    'dashboard': {
      icon: 'fa-chart-pie',
      title: '대시보드에 오신 것을 환영합니다!',
      desc: '이곳에서 전체 현황을 한눈에 확인할 수 있어요. 카드를 클릭하면 해당 상세 화면으로 바로 이동합니다.',
      tips: [
        '상단 카드는 주문의 현재 상태별 건수를 보여줍니다',
        '차트는 최근 추이를 시각화하며, 마우스를 올리면 수치를 확인할 수 있어요',
        '새 주문이 들어오면 실시간으로 카드 숫자가 업데이트됩니다',
      ],
      glossary: [
        { term: '수신', meaning: '고객으로부터 새로 접수된 주문' },
        { term: '배분', meaning: '수신된 주문을 파트(지역)에 나누어 할당하는 과정' },
        { term: '정산확정', meaning: '검수 승인이 완료되어 비용이 확정된 상태' },
      ],
    },

    // ── 주문관리 ──
    'orders': {
      icon: 'fa-list-check',
      title: '주문관리',
      desc: '전체 주문을 조회하고 관리하는 핵심 화면이에요. 필터와 검색으로 원하는 주문을 빠르게 찾을 수 있습니다.',
      tips: [
        '상단의 상태 탭을 클릭하면 해당 상태의 주문만 볼 수 있어요',
        '수동등록 버튼으로 개별 주문을, 일괄등록으로 엑셀 파일을 업로드할 수 있어요',
        '주문 행을 클릭하면 상세 정보 패널이 열립니다',
        'CSV/엑셀 내보내기로 주문 목록을 다운로드할 수 있어요',
      ],
      glossary: [
        { term: '주문번호', meaning: '시스템이 자동으로 부여하는 고유 식별번호' },
        { term: '행정동코드', meaning: '주소에 해당하는 행정구역 코드 (자동 매칭)' },
        { term: '유효성통과', meaning: '필수 정보가 모두 확인되어 배분 가능한 상태' },
        { term: '수행중', meaning: '팀장이 현장 작업을 시작한 상태' },
      ],
    },

    // ── 자동배분 ──
    'distribute': {
      icon: 'fa-share-nodes',
      title: '자동배분',
      desc: '접수된 주문을 지역과 팀에 자동으로 배분하는 화면입니다. 배분 정책에 따라 효율적으로 주문이 나누어져요.',
      tips: [
        '배분 대상 주문을 선택하고 "자동배분" 버튼을 누르면 행정동 기준으로 자동 할당됩니다',
        '수동 배분도 가능해요 — 주문을 선택한 뒤 원하는 파트를 지정하면 됩니다',
        '배분 결과는 즉시 해당 파트장에게 알림이 발송됩니다',
      ],
      glossary: [
        { term: '배분대기', meaning: '유효성 통과 후 아직 파트에 할당되지 않은 주문' },
        { term: '배분완료', meaning: '특정 파트(지역)에 할당이 완료된 상태' },
        { term: '파트', meaning: '지역 단위 조직 (파트장이 관리)' },
      ],
    },

    // ── 일정/캘린더 ──
    'schedule': {
      icon: 'fa-calendar-days',
      title: '일정/캘린더',
      desc: '주문 일정을 캘린더 형태로 확인하고 관리할 수 있어요. 예약 시간이 설정된 주문이 날짜별로 표시됩니다.',
      tips: [
        '날짜를 클릭하면 해당일의 주문 목록을 볼 수 있어요',
        '주문 카드를 클릭하면 상세 정보를 확인하고 상태를 변경할 수 있습니다',
        '오늘 날짜는 파란색으로 강조되어 한눈에 찾을 수 있어요',
      ],
      glossary: [
        { term: '예약시간', meaning: '고객과 약속한 방문 일시' },
        { term: '준비완료', meaning: '팀장이 방문 준비를 마치고 고객에게 연락한 상태' },
      ],
    },

    // ── 주문채널 ──
    'channels': {
      icon: 'fa-satellite-dish',
      title: '주문채널 관리',
      desc: '외부에서 주문이 들어오는 경로(채널)를 관리합니다. API 연동, 수수료 설정 등을 이곳에서 할 수 있어요.',
      tips: [
        '새 채널 추가 시 API 키가 자동 생성되어 외부 시스템에서 주문을 전송할 수 있어요',
        'API 테스트 버튼으로 연동 상태를 바로 확인할 수 있습니다',
        '채널별 수수료율을 설정하면 정산 시 자동 반영됩니다',
      ],
      glossary: [
        { term: '채널', meaning: '주문이 접수되는 외부 경로 (예: 협력사, 플랫폼)' },
        { term: 'API 키', meaning: '외부 시스템이 주문을 전송할 때 사용하는 인증 코드' },
        { term: '동기화', meaning: '외부 시스템과 데이터를 맞추는 과정' },
      ],
    },

    // ── HQ 검수 ──
    'review-hq': {
      icon: 'fa-clipboard-check',
      title: 'HQ(본사) 검수',
      desc: '파트에서 올라온 주문을 최종 검수하는 화면입니다. 사진, 체크리스트를 꼼꼼히 확인한 뒤 승인하거나 반려할 수 있어요.',
      tips: [
        '지역 승인 완료된 주문이 이곳에 표시됩니다',
        '사진을 클릭하면 큰 화면으로 볼 수 있어요',
        '반려 시에는 반려 사유를 선택해 주세요 — 팀장에게 자동 알림됩니다',
        '일괄 승인으로 여러 건을 한 번에 처리할 수 있어요',
      ],
      glossary: [
        { term: 'HQ승인', meaning: '본사가 최종 승인하여 정산 대상이 된 상태' },
        { term: 'HQ반려', meaning: '본사가 보완을 요청한 상태 (팀장이 수정 후 재제출)' },
        { term: '체크리스트', meaning: '외부촬영, 내부촬영, 세척전/후 등 필수 확인 항목' },
      ],
    },

    // ── 지역(파트) 검수 ──
    'review-region': {
      icon: 'fa-clipboard-check',
      title: '1차 검수 (파트)',
      desc: '팀장이 완료 보고한 주문을 1차 검수하는 화면입니다. 현장 사진과 보고 내용을 확인해 주세요.',
      tips: [
        '완료전송 상태의 주문이 이곳에 표시됩니다',
        '승인하면 HQ 검수 단계로 넘어가고, 반려하면 팀장에게 재작업 알림이 갑니다',
        '빠른 승인 버튼으로 간편하게 처리할 수 있어요',
      ],
      glossary: [
        { term: '지역승인', meaning: '파트장이 1차 검수를 통과시킨 상태' },
        { term: '지역반려', meaning: '파트장이 보완을 요청한 상태' },
        { term: '완료전송', meaning: '팀장이 작업 완료 보고서를 제출한 상태' },
      ],
    },

    // ── 정산관리 ──
    'settlement': {
      icon: 'fa-coins',
      title: '정산관리',
      desc: '승인된 주문의 비용을 계산하고 정산을 확정하는 화면입니다. 기간별로 정산 내역을 조회하고 관리할 수 있어요.',
      tips: [
        '정산 기간을 선택하고 "정산실행" 버튼으로 자동 계산할 수 있어요',
        '정산 결과를 엑셀로 내보내 회계 처리에 활용할 수 있습니다',
        '지급 처리 후에는 "지급완료" 상태로 변경해 주세요',
      ],
      glossary: [
        { term: '정산확정', meaning: '검수 승인 완료 후 비용이 확정된 상태' },
        { term: '지급완료', meaning: '확정된 금액이 실제로 지급된 상태' },
        { term: '수수료', meaning: '작업 건당 지급되는 금액 (팀장/대리점별 설정)' },
      ],
    },

    // ── 대사(정합성) ──
    'reconciliation': {
      icon: 'fa-scale-balanced',
      title: '대사 (데이터 정합성 검증)',
      desc: '주문, 배분, 정산 데이터 간의 일치 여부를 자동으로 검증하는 화면이에요. 누락이나 불일치 항목을 빠르게 찾을 수 있습니다.',
      tips: [
        '대사 실행 버튼으로 전체 데이터 정합성 검증을 시작할 수 있어요',
        '불일치 항목은 빨간색으로 표시되며, 클릭하면 상세 내역을 볼 수 있습니다',
        '정기적으로 대사를 실행하면 데이터 오류를 조기에 발견할 수 있어요',
      ],
      glossary: [
        { term: '대사', meaning: '서로 다른 데이터 소스 간의 일치 여부를 확인하는 검증 작업' },
        { term: '불일치', meaning: '주문 수량, 금액 등이 시스템 간에 맞지 않는 상태' },
        { term: '정합성', meaning: '데이터가 서로 모순 없이 일관된 상태' },
      ],
    },

    // ── 통계 ──
    'statistics': {
      icon: 'fa-chart-bar',
      title: '통계',
      desc: '주문, 정산, 실적 등 다양한 통계를 차트와 표로 확인할 수 있어요. 기간과 조건을 설정해 원하는 데이터를 분석해 보세요.',
      tips: [
        '기간 필터로 원하는 범위의 데이터를 조회할 수 있어요',
        '차트에 마우스를 올리면 상세 수치를 확인할 수 있습니다',
        '표 데이터를 엑셀로 다운로드할 수 있어요',
      ],
      glossary: [
        { term: '전환율', meaning: '수신된 주문 중 최종 완료까지 진행된 비율' },
        { term: '평균 처리시간', meaning: '주문 수신부터 최종 완료까지 걸린 평균 시간' },
      ],
    },

    // ── 인사관리 ──
    'hr-management': {
      icon: 'fa-users-gear',
      title: '인사관리',
      desc: '조직 구조, 직원, 역할을 관리하는 화면입니다. 가입 승인, 파트 배치, 수수료 설정 등 인사 업무를 처리할 수 있어요.',
      tips: [
        '왼쪽의 조직 트리에서 파트/팀을 선택하면 해당 구성원이 표시됩니다',
        '가입 요청 탭에서 신규 직원의 가입을 승인하거나 거절할 수 있어요',
        '직원을 클릭하면 역할 변경, 소속 변경 등 상세 관리를 할 수 있습니다',
        '대리점 온보딩 탭에서 새 대리점을 등록할 수 있어요',
      ],
      glossary: [
        { term: '파트장 (REGION_ADMIN)', meaning: '특정 지역의 팀장들을 관리하는 중간 관리자' },
        { term: '팀장 (TEAM_LEADER)', meaning: '현장에서 실제 작업을 수행하는 담당자' },
        { term: '대리점장 (AGENCY_LEADER)', meaning: '여러 팀장을 묶어 관리하는 대리점 책임자' },
        { term: '역할 (Role)', meaning: '시스템에서 부여된 권한 등급 (접근 가능한 메뉴가 달라짐)' },
      ],
    },

    // ── 정책관리 ──
    'policies': {
      icon: 'fa-gears',
      title: '정책관리',
      desc: '배분 규칙, 보고서 양식, 수수료 체계, 지역 설정, 성과 지표 등 시스템 운영 정책을 설정하는 화면이에요.',
      tips: [
        '탭별로 다양한 정책을 관리할 수 있어요',
        '배분정책: 주문이 어느 파트에 할당될지의 기준을 설정합니다',
        '수수료정책: 역할별, 건당 지급 금액을 설정합니다',
        '변경 사항은 저장 버튼을 눌러야 반영됩니다',
      ],
      glossary: [
        { term: '배분정책', meaning: '주문을 지역/팀에 나누는 자동화 규칙' },
        { term: '수수료 모드', meaning: '고정금액(FIXED) 또는 비율(RATE) 방식의 지급 기준' },
        { term: '담당권역', meaning: '파트장이나 팀장이 책임지는 지리적 범위' },
      ],
    },

    // ── 감사로그 ──
    'audit-log': {
      icon: 'fa-scroll',
      title: '감사로그',
      desc: '시스템에서 발생한 모든 중요 활동을 기록한 로그입니다. 언제 누가 무엇을 했는지 추적할 수 있어요.',
      tips: [
        '기간, 유형, 사용자로 필터링하여 원하는 로그를 빠르게 찾을 수 있어요',
        '각 로그 항목에는 수행자, 작업 내용, 시간이 기록되어 있습니다',
        '보안 감사, 문제 추적 등에 활용할 수 있어요',
      ],
      glossary: [
        { term: '감사로그', meaning: '시스템 내 모든 주요 행위(로그인, 상태변경, 승인 등)의 기록' },
        { term: '이벤트 코드', meaning: '어떤 유형의 행위인지를 나타내는 분류 코드' },
      ],
    },

    // ── 알림 ──
    'notifications': {
      icon: 'fa-bell',
      title: '알림 센터',
      desc: '시스템에서 보내는 모든 알림을 한곳에서 확인할 수 있어요. 새 주문 배정, 검수 결과, 반려 알림 등이 이곳에 모입니다.',
      tips: [
        '읽지 않은 알림은 파란색 점으로 표시됩니다',
        '알림을 클릭하면 관련 화면으로 바로 이동할 수 있어요',
        '모두 읽음 처리를 하면 알림 뱃지 숫자가 초기화됩니다',
        '푸시 알림을 허용하면 브라우저를 닫아도 알림을 받을 수 있어요',
      ],
      glossary: [
        { term: '푸시 알림', meaning: '브라우저/앱 알림을 통해 실시간으로 전달되는 메시지' },
      ],
    },

    // ── 시스템 관리 ──
    'system-admin': {
      icon: 'fa-server',
      title: '시스템 관리',
      desc: '시스템 전반의 설정과 데이터 관리를 담당하는 관리자 전용 화면이에요.',
      tips: [
        '시스템 정보, DB 현황 등을 확인할 수 있어요',
        '검색 기능으로 주문, 사용자 등을 통합 검색할 수 있습니다',
        '데이터 백업, 복원 기능을 이용할 수 있어요',
        '⚠️ 이 화면의 기능은 시스템에 큰 영향을 줄 수 있으니 신중하게 사용해 주세요',
      ],
      glossary: [
        { term: 'D1 데이터베이스', meaning: '주문, 사용자 등 모든 데이터가 저장되는 클라우드 DB' },
        { term: '타임라인', meaning: '특정 주문의 상태 변경 이력을 시간 순으로 보여주는 기능' },
      ],
    },

    // ── 광고관리 ──
    'banner-manage': {
      icon: 'fa-rectangle-ad',
      title: '광고(배너) 관리',
      desc: '대시보드에 표시되는 배너 광고를 만들고 관리하는 화면이에요.',
      tips: [
        '새 배너 만들기 버튼으로 광고를 등록할 수 있어요',
        '시작/종료일을 설정하면 자동으로 게시/종료됩니다',
        '드래그로 배너 순서를 변경할 수 있어요',
        '활성/비활성 토글로 즉시 표시 여부를 제어할 수 있습니다',
      ],
      glossary: [
        { term: 'CTA', meaning: 'Call To Action — 배너를 클릭했을 때 이동할 링크' },
        { term: '노출 순서', meaning: '여러 배너가 있을 때 표시되는 우선순위' },
      ],
    },

    // ── 칸반 (팀장 배정) ──
    'kanban': {
      icon: 'fa-columns',
      title: '칸반 (팀장 배정)',
      desc: '팀장별로 주문을 배정하고 진행 상황을 한눈에 볼 수 있는 보드 형태의 화면이에요.',
      tips: [
        '각 열(컬럼)은 팀장을 나타내며, 카드가 해당 팀장의 주문입니다',
        '미배정 주문을 팀장에게 드래그하거나 배정 모달을 이용할 수 있어요',
        '카드를 클릭하면 주문 상세를 볼 수 있습니다',
        '각 팀장의 현재 작업량이 숫자로 표시되어 균형 잡힌 배정이 가능합니다',
      ],
      glossary: [
        { term: '배정', meaning: '배분된 주문을 특정 팀장에게 할당하는 것' },
        { term: '칸반보드', meaning: '업무를 시각적 카드로 관리하는 방식 (일본어 "간판"에서 유래)' },
        { term: '준비(배정됨)', meaning: '팀장에게 할당되었으나 아직 작업 시작 전인 상태' },
      ],
    },

    // ── 내 주문 (팀장) ──
    'my-orders': {
      icon: 'fa-list',
      title: '내 주문',
      desc: '나에게 배정된 주문 목록을 확인하고 작업을 진행하는 화면이에요.',
      tips: [
        '"준비완료" 버튼으로 고객에게 방문 예정을 알리세요',
        '"작업시작"을 누르면 수행중 상태로 변경됩니다',
        '작업이 끝나면 사진과 체크리스트를 작성해 "완료보고"를 제출해 주세요',
        '반려된 주문은 사유를 확인한 뒤 수정하여 재제출할 수 있어요',
      ],
      glossary: [
        { term: '준비완료', meaning: '방문 전 고객에게 연락을 완료한 상태' },
        { term: '완료보고', meaning: '현장 작업 후 사진과 보고서를 제출하는 것' },
        { term: '반려', meaning: '검수자가 보완을 요청한 것 — 수정 후 다시 제출하면 됩니다' },
      ],
    },

    // ── 내 현황 ──
    'my-stats': {
      icon: 'fa-chart-line',
      title: '내 현황',
      desc: '나의 작업 실적과 통계를 확인할 수 있는 개인 현황 화면이에요.',
      tips: [
        '이번 달 완료 건수, 반려율, 평균 처리 시간 등을 볼 수 있어요',
        '목표 대비 진행률도 확인할 수 있습니다',
      ],
      glossary: [],
    },

    // ── 내 프로필 ──
    'my-profile': {
      icon: 'fa-user-circle',
      title: '내 프로필',
      desc: '내 계정 정보를 확인하고 비밀번호 등을 변경할 수 있어요.',
      tips: [
        '소속 조직과 역할을 확인할 수 있습니다',
        '비밀번호 변경은 현재 비밀번호를 먼저 입력해야 합니다',
      ],
      glossary: [],
    },

    // ── 대리점 대시보드 ──
    'agency-dashboard': {
      icon: 'fa-store',
      title: '대리점 현황',
      desc: '대리점 소속 팀장들의 전체 주문 현황을 한눈에 볼 수 있어요.',
      tips: [
        '카드를 클릭하면 해당 상태의 주문 목록으로 이동합니다',
        '팀장별 실적을 비교하여 업무 분배를 최적화할 수 있어요',
      ],
      glossary: [
        { term: '대리점', meaning: '여러 팀장을 묶어 관리하는 조직 단위' },
      ],
    },

    // ── 대리점 주문관리 ──
    'agency-orders': {
      icon: 'fa-list-check',
      title: '대리점 주문관리',
      desc: '대리점 소속 팀장들에게 배정된 모든 주문을 조회하고 관리할 수 있어요.',
      tips: [
        '팀장별로 필터링하여 개인별 주문을 확인할 수 있습니다',
        '주문을 다른 팀장에게 재배정할 수도 있어요',
      ],
      glossary: [],
    },

    // ── 소속 팀장 ──
    'agency-team': {
      icon: 'fa-people-group',
      title: '소속 팀장 관리',
      desc: '대리점에 소속된 팀장들의 정보와 실적을 관리하는 화면이에요.',
      tips: [
        '각 팀장의 연락처, 진행 건수, 완료율을 확인할 수 있어요',
        '팀장 추가 및 관리 기능을 이용할 수 있습니다',
      ],
      glossary: [],
    },

    // ── 대리점 정산 내역 ──
    'agency-statement': {
      icon: 'fa-file-invoice-dollar',
      title: '정산 내역',
      desc: '대리점의 정산 내역을 조회하고 지급 상태를 확인할 수 있는 화면이에요.',
      tips: [
        '기간별로 정산 금액과 건수를 확인할 수 있어요',
        '엑셀로 다운로드하여 회계 처리에 활용할 수 있습니다',
      ],
      glossary: [
        { term: '정산 내역', meaning: '승인된 주문들의 수수료 합산 내역' },
      ],
    },
  };


  // ─── 렌더링 함수 ───
  window.renderPageGuide = function(page) {
    const guide = GUIDES[page];
    if (!guide) return '';

    // 이미 닫은 가이드는 표시하지 않음
    const dismissed = getDismissed();
    if (dismissed[page]) return '';

    const glossaryHtml = guide.glossary && guide.glossary.length
      ? `<div class="mt-3 pt-3 border-t border-teal-100">
           <p class="text-xs font-semibold text-teal-700 mb-1.5"><i class="fas fa-book-open mr-1"></i>용어 안내</p>
           <div class="grid grid-cols-1 sm:grid-cols-2 gap-1">
             ${guide.glossary.map(g => `<div class="text-xs text-teal-800"><span class="font-semibold bg-teal-100/60 px-1.5 py-0.5 rounded">${g.term}</span> <span class="text-teal-600">${g.meaning}</span></div>`).join('')}
           </div>
         </div>`
      : '';

    const tipsHtml = guide.tips && guide.tips.length
      ? `<ul class="mt-2 space-y-1">
           ${guide.tips.map(t => `<li class="flex items-start gap-2 text-xs text-teal-700"><i class="fas fa-lightbulb text-amber-400 mt-0.5 flex-shrink-0"></i><span>${t}</span></li>`).join('')}
         </ul>`
      : '';

    return `
      <div id="page-guide-${page}" class="mb-4 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4 relative shadow-sm transition-all duration-300 hover:shadow-md" style="animation: fadeIn 0.3s ease">
        <button onclick="dismissGuide('${page}')" class="absolute top-2 right-2 text-teal-400 hover:text-teal-600 transition-colors p-1" title="이 안내를 닫습니다 (다시 보려면 프로필 > 가이드 초기화)">
          <i class="fas fa-times text-sm"></i>
        </button>
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
            <i class="fas ${guide.icon} text-teal-600"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-bold text-teal-800 mb-1">${guide.title}</h3>
            <p class="text-xs text-teal-600 leading-relaxed">${guide.desc}</p>
            ${tipsHtml}
            ${glossaryHtml}
          </div>
        </div>
        <div class="mt-3 flex items-center justify-between text-xs text-teal-400">
          <span><i class="fas fa-info-circle mr-1"></i>이 안내는 ✕를 누르면 숨겨집니다</span>
          <button onclick="resetAllGuides()" class="hover:text-teal-600 transition-colors">
            <i class="fas fa-redo mr-1"></i>모든 가이드 다시 보기
          </button>
        </div>
      </div>
    `;
  };

  // ─── 가이드 닫기 ───
  window.dismissGuide = function(page) {
    const el = document.getElementById('page-guide-' + page);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        el.remove();
        setDismissed(page);
      }, 300);
    }
  };

  // ─── 모든 가이드 초기화 ───
  window.resetAllGuides = function() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    // 현재 페이지 가이드 다시 표시
    if (typeof currentPage !== 'undefined' && typeof renderContent === 'function') {
      renderContent();
    }
  };

})();
