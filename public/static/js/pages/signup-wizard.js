// ============================================================
// Airflow — 팀장 자가가입 위자드 v5.0
// 퍼블릭 (로그인 불필요) — 스텝별 UI
// ============================================================

// 위자드 상태
let signupState = {
  step: 0, // 0:폰확인, 1:OTP, 2:정보입력, 3:지역선택, 4:제출결과
  phone: '',
  otpCode: '',
  verifyToken: '',
  tokenExpires: '',
  distributors: [],
  selectedDistributor: null,
  distributorRegions: [],
  selectedRegionIds: new Set(),
  allRegions: [],       // 전체검색용
  loginId: '',
  password: '',
  name: '',
  email: '',
  teamName: '',
  commissionMode: '',
  commissionValue: '',
  result: null,
  otpTimer: null,
  otpSeconds: 0,
};

function resetSignupState() {
  if (signupState.otpTimer) clearInterval(signupState.otpTimer);
  signupState = {
    step: 0, phone: '', otpCode: '', verifyToken: '', tokenExpires: '',
    distributors: [], selectedDistributor: null, distributorRegions: [],
    selectedRegionIds: new Set(), allRegions: [],
    loginId: '', password: '', name: '', email: '', teamName: '',
    commissionMode: '', commissionValue: '',
    result: null, otpTimer: null, otpSeconds: 0,
  };
}

// ─── 위자드 진입점 (로그인 페이지에서 호출) ───
function openSignupWizard() {
  resetSignupState();
  renderSignupWizard();
}

function closeSignupWizard() {
  resetSignupState();
  render(); // 로그인 페이지로 복귀
}

function renderSignupWizard() {
  const app = document.getElementById('app');
  const s = signupState;
  
  const steps = [
    { label: '본인 확인', icon: 'fa-mobile-alt' },
    { label: 'OTP 인증', icon: 'fa-key' },
    { label: '정보 입력', icon: 'fa-user-edit' },
    { label: '지역 선택', icon: 'fa-map-marked-alt' },
    { label: '완료', icon: 'fa-check-circle' },
  ];

  app.innerHTML = `
  <div class="min-h-screen bg-gradient-to-br from-green-600 via-teal-600 to-cyan-700 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl fade-in overflow-hidden">
      <!-- 헤더 -->
      <div class="bg-gradient-to-r from-teal-600 to-cyan-600 px-8 py-6 text-white">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold"><i class="fas fa-user-plus mr-2"></i>팀장 가입 신청</h1>
            <p class="text-teal-100 text-sm mt-1">Airflow 팀장 자가 등록</p>
          </div>
          <button onclick="closeSignupWizard()" class="text-teal-100 hover:text-white transition">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        <!-- 스텝 인디케이터 -->
        <div class="flex mt-5 gap-1">
          ${steps.map((st, i) => `
            <div class="flex-1 flex items-center gap-1.5">
              <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${i < s.step ? 'bg-white text-teal-700' : i === s.step ? 'bg-teal-400 text-white ring-2 ring-white' : 'bg-teal-500/40 text-teal-200'}">
                ${i < s.step ? '<i class="fas fa-check"></i>' : (i + 1)}
              </div>
              <span class="text-xs ${i <= s.step ? 'text-white' : 'text-teal-200'} hidden sm:inline">${st.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- 본문 -->
      <div class="p-8" id="signup-body">
        ${renderSignupStep()}
      </div>
    </div>
  </div>`;
}

function renderSignupStep() {
  switch (signupState.step) {
    case 0: return renderStep0_PhoneCheck();
    case 1: return renderStep1_OTP();
    case 2: return renderStep2_Info();
    case 3: return renderStep3_Region();
    case 4: return renderStep4_Result();
    default: return '';
  }
}

// ─── Step 0: 핸드폰 번호 입력 & 중복 체크 ───
function renderStep0_PhoneCheck() {
  return `
    <div class="text-center mb-6">
      <div class="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <i class="fas fa-mobile-alt text-teal-600 text-2xl"></i>
      </div>
      <h2 class="text-lg font-bold text-gray-800">본인 확인</h2>
      <p class="text-gray-500 text-sm mt-1">가입에 사용할 핸드폰 번호를 입력하세요.</p>
    </div>
    <div class="max-w-sm mx-auto space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">핸드폰 번호</label>
        <input id="sw-phone" type="tel" maxlength="13"
          class="w-full px-4 py-3 border rounded-lg text-center text-lg tracking-wider focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          placeholder="01012345678" value="${signupState.phone}"
          onkeypress="if(event.key==='Enter')signupCheckPhone()">
      </div>
      <button onclick="signupCheckPhone()" class="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition">
        <i class="fas fa-search mr-2"></i>가입 가능 여부 확인
      </button>
      <div id="sw-phone-result"></div>
      <button onclick="closeSignupWizard()" class="w-full py-2 text-gray-500 text-sm hover:text-gray-700">
        <i class="fas fa-arrow-left mr-1"></i>로그인 화면으로 돌아가기
      </button>
    </div>`;
}

async function signupCheckPhone() {
  try {
  const phone = document.getElementById('sw-phone')?.value?.trim();
  if (!phone) return showToast('핸드폰 번호를 입력하세요.', 'warning');
  
  const res = await fetch('/api/signup/check-phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  }).then(r => r.json());
  
  const el = document.getElementById('sw-phone-result');
  if (res.can_signup) {
    signupState.phone = res.phone;
    el.innerHTML = `<div class="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
      <i class="fas fa-check-circle mr-1"></i>가입 가능한 번호입니다. 인증을 진행하세요.</div>`;
    setTimeout(() => { signupState.step = 1; renderSignupWizard(); }, 800);
  } else if (res.already_registered) {
    el.innerHTML = `<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
      <i class="fas fa-exclamation-circle mr-1"></i>이미 등록된 번호입니다. (${res.existing_user_name})</div>`;
  } else if (res.pending_signup) {
    el.innerHTML = `<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
      <i class="fas fa-clock mr-1"></i>이미 가입 신청 중입니다. (요청 #${res.pending_request_id})</div>`;
  } else {
    el.innerHTML = `<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
      <i class="fas fa-times-circle mr-1"></i>${res.error || '확인 실패'}</div>`;
  }

  } catch (e) {
  console.error('[signupCheckPhone]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── Step 1: OTP 인증 ───
function renderStep1_OTP() {
  const hasOTP = signupState.otpSeconds > 0;
  return `
    <div class="text-center mb-6">
      <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <i class="fas fa-key text-blue-600 text-2xl"></i>
      </div>
      <h2 class="text-lg font-bold text-gray-800">OTP 인증</h2>
      <p class="text-gray-500 text-sm mt-1">${signupState.phone}으로 인증번호를 발송합니다.</p>
    </div>
    <div class="max-w-sm mx-auto space-y-4">
      ${!hasOTP ? `
        <button onclick="signupSendOTP()" class="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
          <i class="fas fa-paper-plane mr-2"></i>인증번호 발송
        </button>
      ` : `
        <div id="sw-otp-dev" class="hidden p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700"></div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">인증번호 (6자리)</label>
          <input id="sw-otp" type="text" maxlength="6"
            class="w-full px-4 py-3 border rounded-lg text-center text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-blue-500"
            placeholder="000000" oninput="if(this.value.length===6)signupVerifyOTP()">
        </div>
        <div class="text-center">
          <span id="sw-otp-timer" class="text-sm text-gray-500"></span>
        </div>
        <button onclick="signupVerifyOTP()" class="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
          <i class="fas fa-check mr-2"></i>인증 확인
        </button>
        <button onclick="signupState.otpSeconds=0;renderSignupWizard()" class="w-full py-2 text-gray-500 text-sm hover:text-gray-700">
          <i class="fas fa-redo mr-1"></i>인증번호 재발송
        </button>
      `}
      <button onclick="signupState.step=0;renderSignupWizard()" class="w-full py-2 text-gray-400 text-sm hover:text-gray-600">
        <i class="fas fa-arrow-left mr-1"></i>이전 단계
      </button>
    </div>`;
}

async function signupSendOTP() {
  try {
  const res = await fetch('/api/signup/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: signupState.phone })
  }).then(r => r.json());
  
  if (res.ok) {
    showToast(res.message, 'success');
    signupState.otpSeconds = 300; // 5분
    renderSignupWizard();
    
    // 개발 OTP 표시
    if (res._dev_otp) {
      setTimeout(() => {
        const devEl = document.getElementById('sw-otp-dev');
        if (devEl) {
          devEl.classList.remove('hidden');
          devEl.innerHTML = `<i class="fas fa-bug mr-1"></i>개발모드 OTP: <strong class="text-lg">${res._dev_otp}</strong>`;
        }
      }, 100);
    }
    
    // 타이머
    if (signupState.otpTimer) clearInterval(signupState.otpTimer);
    signupState.otpTimer = setInterval(() => {
      signupState.otpSeconds--;
      const timerEl = document.getElementById('sw-otp-timer');
      if (timerEl) {
        const m = Math.floor(signupState.otpSeconds / 60);
        const s = signupState.otpSeconds % 60;
        timerEl.textContent = `남은 시간: ${m}:${String(s).padStart(2, '0')}`;
        if (signupState.otpSeconds <= 60) timerEl.classList.add('text-red-500');
      }
      if (signupState.otpSeconds <= 0) {
        clearInterval(signupState.otpTimer);
        showToast('인증 시간이 만료되었습니다. 다시 요청하세요.', 'warning');
      }
    }, 1000);
  } else {
    showToast(res.error || '발송 실패', 'error');
  }

  } catch (e) {
  console.error('[signupSendOTP]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

async function signupVerifyOTP() {
  try {
  const otp_code = document.getElementById('sw-otp')?.value?.trim();
  if (!otp_code || otp_code.length !== 6) return showToast('6자리 인증번호를 입력하세요.', 'warning');
  
  const res = await fetch('/api/signup/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: signupState.phone, otp_code })
  }).then(r => r.json());
  
  if (res.verified) {
    showToast('인증 성공!', 'success');
    clearInterval(signupState.otpTimer);
    signupState.verifyToken = res.verify_token;
    signupState.tokenExpires = res.token_expires_at;
    // 총판 목록 미리 로드
    await loadDistributors();
    signupState.step = 2;
    renderSignupWizard();
  } else {
    showToast(res.error || '인증 실패', 'error');
  }

  } catch (e) {
  console.error('[signupVerifyOTP]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

async function loadDistributors() {
  try {
  const res = await fetch('/api/signup/distributors').then(r => r.json());
  signupState.distributors = res.distributors || [];

  } catch (e) {
  console.error('[loadDistributors]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── Step 2: 기본 정보 입력 ───
function renderStep2_Info() {
  const s = signupState;
  const distOpts = s.distributors.map(d => 
    `<option value="${d.org_id}" ${s.selectedDistributor?.org_id === d.org_id ? 'selected' : ''}>${d.name} (팀 ${d.team_count}개 · 관할 ${d.region_count}개 구역)</option>`
  ).join('');

  return `
    <div class="text-center mb-6">
      <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <i class="fas fa-user-edit text-purple-600 text-2xl"></i>
      </div>
      <h2 class="text-lg font-bold text-gray-800">가입 정보 입력</h2>
      <p class="text-gray-500 text-sm mt-1">팀장 및 팀 정보를 입력하세요.</p>
    </div>
    <form id="sw-info-form" class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">이름 <span class="text-red-500">*</span></label>
          <input name="name" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500" 
            placeholder="홍길동" value="${s.name}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">팀명 <span class="text-red-500">*</span></label>
          <input name="team_name" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            placeholder="예: 서울1팀" value="${s.teamName}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">로그인 ID <span class="text-red-500">*</span></label>
          <input name="login_id" required class="w-full px-3 py-2.5 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-500"
            placeholder="영문/숫자 3~50자" value="${s.loginId}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">비밀번호 <span class="text-red-500">*</span></label>
          <input name="password" type="password" required minlength="4"
            class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            placeholder="4자 이상" value="${s.password}">
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">이메일 <span class="text-red-500">*</span></label>
        <input name="email" type="email" required
          class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
          placeholder="example@email.com" value="${s.email}">
        <p class="text-xs text-amber-600 mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>정산서 수취를 위해 반드시 정확한 이메일을 입력해주세요. 정산 내역 등 중요 알림이 이 주소로 발송됩니다.</p>
      </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">소속 총판 <span class="text-red-500">*</span></label>
        <select name="distributor_org_id" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
          onchange="signupSelectDistributor(this.value)">
          <option value="">총판을 선택하세요</option>
          ${distOpts}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">수수료 유형 <span class="text-gray-400 text-xs">(선택)</span></label>
          <select name="commission_mode" class="w-full px-3 py-2.5 border rounded-lg text-sm">
            <option value="">기본(총판 정책)</option>
            <option value="PERCENT" ${s.commissionMode === 'PERCENT' ? 'selected' : ''}>정률 (%)</option>
            <option value="FIXED" ${s.commissionMode === 'FIXED' ? 'selected' : ''}>정액 (원)</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">수수료 값 <span class="text-gray-400 text-xs">(선택)</span></label>
          <input name="commission_value" type="number" step="0.1"
            class="w-full px-3 py-2.5 border rounded-lg text-sm"
            placeholder="7.5 또는 50000" value="${s.commissionValue}">
        </div>
      </div>
    </form>
    <div class="flex gap-3 mt-6">
      <button onclick="signupState.step=1;signupState.otpSeconds=0;renderSignupWizard()" class="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
        <i class="fas fa-arrow-left mr-1"></i>이전
      </button>
      <button onclick="signupGoToRegions()" class="flex-1 py-2.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition">
        다음: 지역 선택 <i class="fas fa-arrow-right ml-1"></i>
      </button>
    </div>`;
}

async function signupSelectDistributor(orgId) {
  try {
  if (!orgId) { signupState.selectedDistributor = null; return; }
  const dist = signupState.distributors.find(d => d.org_id === Number(orgId));
  signupState.selectedDistributor = dist;
  
  // 총판 관할 구역 로드
  const res = await fetch(`/api/signup/distributors/${orgId}/regions`).then(r => r.json());
  signupState.distributorRegions = res.regions || [];

  } catch (e) {
  console.error('[signupSelectDistributor]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

function signupGoToRegions() {
  const form = document.getElementById('sw-info-form');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  
  const fd = new FormData(form);
  signupState.name = fd.get('name');
  signupState.email = fd.get('email');
  signupState.teamName = fd.get('team_name');
  signupState.loginId = fd.get('login_id');
  signupState.password = fd.get('password');
  signupState.commissionMode = fd.get('commission_mode');
  signupState.commissionValue = fd.get('commission_value');
  
  if (!fd.get('distributor_org_id')) { showToast('소속 총판을 선택하세요.', 'warning'); return; }
  
  signupState.step = 3;
  renderSignupWizard();
}

// ─── Step 3: 지역 선택 ───
function renderStep3_Region() {
  const s = signupState;
  const distRegions = s.distributorRegions;
  const selected = s.selectedRegionIds;
  
  // 시도별 그룹핑
  const groups = {};
  distRegions.forEach(r => {
    const key = `${r.sido} ${r.sigungu}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  return `
    <div class="text-center mb-4">
      <div class="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2">
        <i class="fas fa-map-marked-alt text-indigo-600 text-xl"></i>
      </div>
      <h2 class="text-lg font-bold text-gray-800">담당 구역 선택</h2>
      <p class="text-gray-500 text-sm mt-1">
        <strong>${s.selectedDistributor?.name}</strong> 관할 구역에서 담당할 지역을 선택하세요.
      </p>
    </div>
    
    <!-- 선택 현황 -->
    <div class="flex items-center justify-between mb-3 px-1">
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-600">관할 <strong>${distRegions.length}</strong>개 구역</span>
        <span class="text-sm font-semibold text-teal-700"><i class="fas fa-check-circle mr-1"></i>선택 <strong id="sw-sel-count">${selected.size}</strong>개</span>
      </div>
      <div class="flex gap-2">
        <button onclick="signupSelectAll()" class="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">전체선택</button>
        <button onclick="signupDeselectAll()" class="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">전체해제</button>
      </div>
    </div>
    
    <!-- 총판 관할 구역 -->
    <div class="border rounded-lg overflow-hidden max-h-[340px] overflow-y-auto mb-3">
      ${Object.entries(groups).map(([key, regions]) => `
        <div class="border-b last:border-b-0">
          <div class="bg-gray-50 px-3 py-2 flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-600"><i class="fas fa-map-pin mr-1"></i>${key}</span>
            <button onclick="signupToggleGroup('${key}', true)" class="text-xs text-blue-600 hover:underline">그룹 선택</button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-0">
            ${regions.map(r => `
              <label class="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-r border-gray-50">
                <input type="checkbox" value="${r.region_id}" 
                  ${selected.has(r.region_id) ? 'checked' : ''}
                  onchange="signupToggleRegion(${r.region_id}, this.checked)"
                  class="rounded text-teal-600 focus:ring-teal-500">
                <span class="truncate">${r.full_name || r.sigungu}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}
      ${distRegions.length === 0 ? '<div class="p-6 text-center text-gray-400 text-sm">총판 관할 구역이 없습니다.</div>' : ''}
    </div>
    
    <!-- 관할 외 구역 추가 검색 -->
    <div class="border rounded-lg p-3 bg-amber-50 border-amber-200 mb-3">
      <div class="flex items-center gap-2 mb-2">
        <i class="fas fa-exclamation-triangle text-amber-500 text-sm"></i>
        <span class="text-sm font-medium text-amber-800">관할 외 구역 추가 (별도 승인 필요)</span>
      </div>
      <div class="flex gap-2">
        <input id="sw-region-search" class="flex-1 px-3 py-2 border rounded-lg text-sm"
          placeholder="시/도, 시/군/구, 읍/면/동 검색" onkeypress="if(event.key==='Enter')signupSearchRegion()">
        <button onclick="signupSearchRegion()" class="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
          <i class="fas fa-search mr-1"></i>검색
        </button>
      </div>
      <div id="sw-search-results" class="mt-2"></div>
    </div>
    
    <div class="flex gap-3 mt-4">
      <button onclick="signupState.step=2;renderSignupWizard()" class="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
        <i class="fas fa-arrow-left mr-1"></i>이전
      </button>
      <button onclick="signupSubmit()" class="flex-1 py-2.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition" id="sw-submit-btn">
        <i class="fas fa-paper-plane mr-1"></i>가입 신청 제출
      </button>
    </div>`;
}

function signupToggleRegion(rid, checked) {
  if (checked) signupState.selectedRegionIds.add(rid);
  else signupState.selectedRegionIds.delete(rid);
  const el = document.getElementById('sw-sel-count');
  if (el) el.textContent = signupState.selectedRegionIds.size;
}

function signupSelectAll() {
  signupState.distributorRegions.forEach(r => signupState.selectedRegionIds.add(r.region_id));
  renderSignupWizard();
}

function signupDeselectAll() {
  signupState.selectedRegionIds.clear();
  renderSignupWizard();
}

function signupToggleGroup(groupKey, select) {
  signupState.distributorRegions.forEach(r => {
    const key = `${r.sido} ${r.sigungu}`;
    if (key === groupKey) {
      if (select) signupState.selectedRegionIds.add(r.region_id);
      else signupState.selectedRegionIds.delete(r.region_id);
    }
  });
  renderSignupWizard();
}

async function signupSearchRegion() {
  try {
  const q = document.getElementById('sw-region-search')?.value?.trim();
  if (!q || q.length < 2) return showToast('검색어를 2자 이상 입력하세요.', 'warning');
  
  // signup의 퍼블릭 검색 API 사용 (인증 불필요)
  const res = await fetch(`/api/signup/regions/search?q=${encodeURIComponent(q)}&limit=20`).then(r => r.json());
  const regions = res.regions || [];
  
  const el = document.getElementById('sw-search-results');
  if (regions.length === 0) {
    el.innerHTML = '<p class="text-xs text-gray-400 mt-1">검색 결과가 없습니다.</p>';
    return;
  }
  
  const distSet = new Set(signupState.distributorRegions.map(r => r.region_id));
  
  el.innerHTML = `
    <div class="max-h-40 overflow-y-auto border rounded bg-white">
      ${regions.map(r => {
        const inDist = distSet.has(r.region_id);
        const checked = signupState.selectedRegionIds.has(r.region_id);
        return `
          <label class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm border-b">
            <input type="checkbox" value="${r.region_id}" ${checked ? 'checked' : ''}
              onchange="signupToggleRegion(${r.region_id}, this.checked)"
              class="rounded text-amber-600 focus:ring-amber-500">
            <span>${r.full_name || (r.sido + ' ' + r.sigungu)}</span>
            ${inDist ? '<span class="text-xs text-green-600 ml-auto">관할내</span>' : '<span class="text-xs text-amber-600 ml-auto">관할외</span>'}
          </label>`;
      }).join('')}
    </div>`;

  } catch (e) {
  console.error('[signupSearchRegion]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── Step 4: 제출 ───
async function signupSubmit() {
  try {
  const s = signupState;
  if (s.selectedRegionIds.size === 0) {
    showToast('담당 구역을 하나 이상 선택하세요.', 'warning');
    return;
  }
  
  const btn = document.getElementById('sw-submit-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>제출 중...'; }
  
  const body = {
    verify_token: s.verifyToken,
    phone: s.phone,
    email: s.email,
    login_id: s.loginId,
    password: s.password,
    name: s.name,
    team_name: s.teamName,
    distributor_org_id: s.selectedDistributor.org_id,
    region_ids: Array.from(s.selectedRegionIds),
  };
  if (s.commissionMode) body.commission_mode = s.commissionMode;
  if (s.commissionValue) body.commission_value = Number(s.commissionValue);
  
  try {
    const res = await fetch('/api/signup/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());
    
    if (res.request_id) {
      signupState.result = res;
      signupState.step = 4;
      renderSignupWizard();
    } else {
      showToast(res.error || '제출 실패', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>가입 신청 제출'; }
    }
  } catch (e) {
    showToast('서버 통신 오류', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i>가입 신청 제출'; }
  }

  } catch (e) {
  console.error('[signupSubmit]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}

// ─── Step 4: 결과 ───
function renderStep4_Result() {
  const r = signupState.result;
  if (!r) return '<p>결과 없음</p>';
  
  const hasOutside = r.selected_regions?.outside_distributor > 0;
  
  return `
    <div class="text-center">
      <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <i class="fas fa-check-circle text-green-600 text-4xl"></i>
      </div>
      <h2 class="text-xl font-bold text-gray-800 mb-2">가입 신청 완료!</h2>
      <p class="text-gray-500 mb-6">${r.message}</p>
      
      <div class="bg-gray-50 rounded-xl p-5 text-left space-y-3 mb-6">
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">신청 번호</span>
          <span class="font-mono font-bold text-teal-700">#${r.request_id}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">상태</span>
          <span class="status-badge bg-yellow-100 text-yellow-700">${r.status}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">소속 총판</span>
          <span class="font-medium">${r.distributor_name}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">선택 구역</span>
          <span>총 ${r.selected_regions?.total}개</span>
        </div>
        ${hasOutside ? `
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">관할 외 구역</span>
          <span class="text-amber-600 font-medium">${r.selected_regions?.outside_distributor}개 (별도 승인 필요)</span>
        </div>` : ''}
      </div>
      
      <div class="space-y-3">
        <button onclick="signupCheckStatus()" class="w-full py-2.5 border border-teal-300 text-teal-700 rounded-lg text-sm hover:bg-teal-50 transition">
          <i class="fas fa-search mr-1"></i>신청 상태 확인
        </button>
        <button onclick="closeSignupWizard()" class="w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition">
          <i class="fas fa-sign-in-alt mr-1"></i>로그인 화면으로
        </button>
      </div>
      <div id="sw-status-result" class="mt-4"></div>
    </div>`;
}

async function signupCheckStatus() {
  try {
  const res = await fetch(`/api/signup/status?phone=${encodeURIComponent(signupState.phone)}`).then(r => r.json());
  const requests = res.requests || [];
  const el = document.getElementById('sw-status-result');
  
  if (requests.length === 0) {
    el.innerHTML = '<p class="text-sm text-gray-400">신청 내역이 없습니다.</p>';
    return;
  }
  
  const statusMap = {
    PENDING: { label: '대기중', cls: 'bg-yellow-100 text-yellow-700' },
    APPROVED: { label: '승인', cls: 'bg-green-100 text-green-700' },
    REJECTED: { label: '반려', cls: 'bg-red-100 text-red-700' },
  };
  
  el.innerHTML = `
    <div class="bg-white border rounded-lg overflow-hidden text-left">
      ${requests.map(r => `
        <div class="p-3 border-b last:border-b-0 flex items-center justify-between">
          <div>
            <span class="text-sm font-medium">#${r.request_id} ${r.team_name}</span>
            <span class="text-xs text-gray-400 ml-2">${r.created_at?.split('T')[0] || ''}</span>
          </div>
          <span class="status-badge ${statusMap[r.status]?.cls || 'bg-gray-100 text-gray-700'}">${statusMap[r.status]?.label || r.status}</span>
        </div>
      `).join('')}
    </div>`;

  } catch (e) {
  console.error('[signupCheckStatus]', e);
  if (typeof showToast === 'function') showToast('처리 실패: ' + (e.message||e), 'error');
  }
}
