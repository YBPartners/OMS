// ================================================================
// 다하다 OMS — 팀장 자가 등록(Self-Signup) API v5.0
// 워크플로우: OTP 인증 → 총판·지역 선택 → 가입신청 → 승인/반려
// 인증 없이 접근 가능한 퍼블릭 API
// ================================================================
import { Hono } from 'hono';
import type { Env, SignupStatus } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { BatchBuilder } from '../../lib/batch-builder';
import { hashPassword } from '../../middleware/security';
import { normalizePhone, isValidPhone, isValidLoginId, checkRateLimit } from '../../middleware/security';
import { normalizePagination } from '../../lib/validators';

const signup = new Hono<Env>();

// ═══════════════════════════════════════════════════════════════
// 퍼블릭 API (인증 불필요) — 팀장 자가 등록 플로우
// ═══════════════════════════════════════════════════════════════

// ─── Step 0: 가입 가능 여부 사전 확인 (핸드폰 중복 체크) ───
signup.post('/check-phone', async (c) => {
  const db = c.env.DB;
  const { phone } = await c.req.json();
  if (!phone) return c.json({ error: '핸드폰 번호를 입력하세요.' }, 400);

  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) return c.json({ error: '올바른 핸드폰 번호를 입력하세요.' }, 400);

  // 이미 등록된 사용자?
  const existingUser = await db.prepare(
    "SELECT user_id, name, status FROM users WHERE phone = ? AND status = 'ACTIVE'"
  ).bind(normalized).first();

  // 이미 가입 신청 중?
  const pendingSignup = await db.prepare(
    "SELECT request_id, status, created_at FROM signup_requests WHERE phone = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1"
  ).bind(normalized).first();

  return c.json({
    phone: normalized,
    already_registered: !!existingUser,
    existing_user_name: existingUser?.name || null,
    pending_signup: !!pendingSignup,
    pending_request_id: pendingSignup?.request_id || null,
    can_signup: !existingUser && !pendingSignup,
  });
});

// ─── Step 1: OTP 발송 (가입용) ───
signup.post('/send-otp', async (c) => {
  const db = c.env.DB;
  const { phone } = await c.req.json();
  if (!phone) return c.json({ error: '핸드폰 번호를 입력하세요.' }, 400);

  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) return c.json({ error: '올바른 핸드폰 번호를 입력하세요.' }, 400);

  // Rate limiting
  const rlKey = `signup-otp:${normalized}`;
  const rl = checkRateLimit(rlKey, 2, 60_000);
  if (!rl.ok) return c.json({ error: '인증번호가 이미 발송되었습니다. 1분 후 다시 시도하세요.' }, 429);

  // DB 기반 도배 방지
  const recent = await db.prepare(`
    SELECT verification_id FROM phone_verifications 
    WHERE phone = ? AND purpose = 'SIGNUP' AND created_at > datetime('now', '-1 minutes')
  `).bind(normalized).first();
  if (recent) return c.json({ error: '인증번호가 이미 발송되었습니다. 1분 후 다시 시도하세요.' }, 429);

  // 6자리 OTP 생성
  const randomBuf = crypto.getRandomValues(new Uint32Array(1));
  const otp = String(100000 + (randomBuf[0] % 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5분

  // verify_token 생성 (검증 성공 시 사용)
  const tokenBuf = crypto.getRandomValues(new Uint8Array(32));
  const verifyToken = Array.from(tokenBuf, b => b.toString(16).padStart(2, '0')).join('');
  const tokenExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30분

  await db.prepare(`
    INSERT INTO phone_verifications (phone, otp_code, purpose, expires_at, verify_token, verify_token_expires)
    VALUES (?, ?, 'SIGNUP', ?, ?, ?)
  `).bind(normalized, otp, expiresAt, verifyToken, tokenExpires).run();

  console.log(`[SMS 시뮬레이션] ${normalized}에 가입용 OTP: ${otp} 발송`);

  const response: any = {
    ok: true,
    message: `인증번호가 ${normalized}으로 발송되었습니다. (5분 이내 입력)`,
    expires_at: expiresAt,
  };

  // 개발 모드에서는 OTP 노출
  response._dev_otp = otp;

  return c.json(response);
});

// ─── Step 2: OTP 검증 → verify_token 반환 ───
signup.post('/verify-otp', async (c) => {
  const db = c.env.DB;
  const { phone, otp_code } = await c.req.json();
  if (!phone || !otp_code) return c.json({ error: '핸드폰 번호와 인증번호를 입력하세요.' }, 400);

  const normalized = normalizePhone(phone);

  // Rate limiting
  const rlKey = `signup-verify:${normalized}`;
  const rl = checkRateLimit(rlKey, 10, 60_000);
  if (!rl.ok) return c.json({ error: '인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요.' }, 429);

  const verification = await db.prepare(`
    SELECT * FROM phone_verifications
    WHERE phone = ? AND purpose = 'SIGNUP' AND verified = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(normalized).first();

  if (!verification) return c.json({ error: '유효한 인증 요청이 없습니다. 인증번호를 다시 요청하세요.' }, 400);

  if ((verification.attempts as number) >= 5) {
    return c.json({ error: '인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청하세요.' }, 429);
  }

  await db.prepare(
    'UPDATE phone_verifications SET attempts = attempts + 1 WHERE verification_id = ?'
  ).bind(verification.verification_id).run();

  if (verification.otp_code !== otp_code) {
    const remaining = 5 - (verification.attempts as number) - 1;
    return c.json({ error: `인증번호가 틀렸습니다. (남은 시도: ${remaining}회)` }, 400);
  }

  // 검증 성공
  await db.prepare(
    'UPDATE phone_verifications SET verified = 1 WHERE verification_id = ?'
  ).bind(verification.verification_id).run();

  return c.json({
    ok: true,
    verified: true,
    verify_token: verification.verify_token,
    token_expires_at: verification.verify_token_expires,
    message: '핸드폰 인증이 완료되었습니다. 30분 이내에 가입 신청을 완료하세요.',
  });
});

// ─── Step 3-A: 총판 목록 조회 (가입 위자드용, 인증 불필요) ───
signup.get('/distributors', async (c) => {
  const db = c.env.DB;
  const result = await db.prepare(`
    SELECT o.org_id, o.name, o.code,
      (SELECT COUNT(*) FROM org_region_mappings orm WHERE orm.org_id = o.org_id) as region_count,
      (SELECT COUNT(*) FROM organizations c WHERE c.parent_org_id = o.org_id AND c.org_type = 'TEAM' AND c.status = 'ACTIVE') as team_count
    FROM organizations o
    WHERE o.org_type = 'REGION' AND o.status = 'ACTIVE'
    ORDER BY o.name
  `).all();

  return c.json({ distributors: result.results });
});

// ─── Step 3-B: 총판 관할 행정구역 조회 (가입 위자드용) ───
signup.get('/distributors/:org_id/regions', async (c) => {
  const db = c.env.DB;
  const orgId = Number(c.req.param('org_id'));

  const org = await db.prepare(
    "SELECT org_id, name FROM organizations WHERE org_id = ? AND org_type = 'REGION' AND status = 'ACTIVE'"
  ).bind(orgId).first();
  if (!org) return c.json({ error: '총판을 찾을 수 없습니다.' }, 404);

  const regions = await db.prepare(`
    SELECT ar.region_id, ar.sido, ar.sigungu, ar.eupmyeondong, ar.full_name, ar.admin_code
    FROM org_region_mappings orm
    JOIN admin_regions ar ON orm.region_id = ar.region_id
    WHERE orm.org_id = ? AND ar.is_active = 1
    ORDER BY ar.sido, ar.sigungu, ar.eupmyeondong
  `).bind(orgId).all();

  return c.json({
    distributor: org,
    regions: regions.results,
    total: regions.results.length,
  });
});

// ─── Step 3-C: 행정구역 검색 (가입 위자드용, 인증 불필요) ───
signup.get('/regions/search', async (c) => {
  const q = c.req.query('q');
  const limit = Math.min(Number(c.req.query('limit') || '20'), 50);
  if (!q || q.length < 2) return c.json({ error: '검색어는 2글자 이상 입력하세요.' }, 400);

  const db = c.env.DB;
  const result = await db.prepare(`
    SELECT region_id, sido, sigungu, eupmyeondong, admin_code, full_name
    FROM admin_regions
    WHERE is_active = 1 AND (
      sido LIKE ? OR sigungu LIKE ? OR eupmyeondong LIKE ?
    )
    ORDER BY sido, sigungu, eupmyeondong
    LIMIT ?
  `).bind(`%${q}%`, `%${q}%`, `%${q}%`, limit).all();

  return c.json({ regions: result.results, total: result.results.length });
});

// ─── Step 4: 가입 신청 제출 ───
signup.post('/submit', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  // 필수 필드 검증
  const { verify_token, phone, login_id, password, name, team_name, distributor_org_id, region_ids } = body;

  if (!verify_token) return c.json({ error: '핸드폰 인증 토큰이 필요합니다.' }, 400);
  if (!phone) return c.json({ error: '핸드폰 번호를 입력하세요.' }, 400);
  if (!login_id) return c.json({ error: '로그인 ID를 입력하세요.' }, 400);
  if (!password) return c.json({ error: '비밀번호를 입력하세요.' }, 400);
  if (!name) return c.json({ error: '이름을 입력하세요.' }, 400);
  if (!team_name) return c.json({ error: '팀명을 입력하세요.' }, 400);
  if (!distributor_org_id) return c.json({ error: '소속 총판을 선택하세요.' }, 400);
  if (!region_ids || !Array.isArray(region_ids) || region_ids.length === 0) {
    return c.json({ error: '담당 구역을 하나 이상 선택하세요.' }, 400);
  }

  const normalized = normalizePhone(phone);

  // 유효성 검증
  if (!isValidLoginId(login_id)) return c.json({ error: '로그인 ID는 영문/숫자/밑줄로 3~50자입니다.' }, 400);
  if (password.length < 4) return c.json({ error: '비밀번호는 최소 4자 이상이어야 합니다.' }, 400);
  if (name.length > 50) return c.json({ error: '이름은 50자 이하로 입력하세요.' }, 400);
  if (team_name.length > 50) return c.json({ error: '팀명은 50자 이하로 입력하세요.' }, 400);

  // verify_token 검증
  const verification = await db.prepare(`
    SELECT * FROM phone_verifications
    WHERE phone = ? AND purpose = 'SIGNUP' AND verified = 1
      AND verify_token = ? AND verify_token_expires > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(normalized, verify_token).first();

  if (!verification) {
    return c.json({ error: '핸드폰 인증이 만료되었거나 유효하지 않습니다. 다시 인증하세요.' }, 401);
  }

  // 중복 체크: 이미 등록된 사용자
  const existingUser = await db.prepare(
    "SELECT user_id FROM users WHERE phone = ? AND status = 'ACTIVE'"
  ).bind(normalized).first();
  if (existingUser) return c.json({ error: '이미 등록된 핸드폰 번호입니다.' }, 409);

  // 중복 체크: login_id
  const loginDup = await db.prepare('SELECT user_id FROM users WHERE login_id = ?').bind(login_id).first();
  if (loginDup) return c.json({ error: '이미 사용 중인 로그인 ID입니다.' }, 409);

  const loginDup2 = await db.prepare("SELECT request_id FROM signup_requests WHERE login_id = ? AND status = 'PENDING'").bind(login_id).first();
  if (loginDup2) return c.json({ error: '이미 신청 중인 로그인 ID입니다.' }, 409);

  // 중복 체크: 진행중 신청
  const pendingSignup = await db.prepare(
    "SELECT request_id FROM signup_requests WHERE phone = ? AND status = 'PENDING'"
  ).bind(normalized).first();
  if (pendingSignup) return c.json({ error: '이미 신청 중인 가입 요청이 있습니다.', request_id: pendingSignup.request_id }, 409);

  // 총판 존재 확인
  const dist = await db.prepare(
    "SELECT org_id, name FROM organizations WHERE org_id = ? AND org_type = 'REGION' AND status = 'ACTIVE'"
  ).bind(distributor_org_id).first();
  if (!dist) return c.json({ error: '유효하지 않은 총판입니다.' }, 404);

  // 비밀번호 해시
  const passwordHash = await hashPassword(password);

  // 총판 관할 구역과 매칭 확인
  const distRegions = await db.prepare(
    'SELECT region_id FROM org_region_mappings WHERE org_id = ?'
  ).bind(distributor_org_id).all();
  const distRegionSet = new Set((distRegions.results as any[]).map(r => r.region_id));

  const withinDist: number[] = [];
  const outsideDist: number[] = [];
  for (const rid of region_ids) {
    if (distRegionSet.has(rid)) {
      withinDist.push(rid);
    } else {
      outsideDist.push(rid);
    }
  }

  // 가입 신청 생성 (BatchBuilder로 원자적)
  const batch = new BatchBuilder(db).label('signup-submit');

  // signup_requests INSERT
  const requestResult = await db.prepare(`
    INSERT INTO signup_requests (login_id, password_hash, name, phone, team_name, distributor_org_id,
      phone_verified, phone_verify_token, commission_mode, commission_value, status)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'PENDING')
  `).bind(
    login_id, passwordHash, name, normalized, team_name, distributor_org_id,
    verify_token,
    body.commission_mode || null,
    body.commission_value !== undefined ? body.commission_value : null,
  ).run();

  const requestId = requestResult.meta.last_row_id as number;

  // 선택 구역 매핑
  for (const rid of region_ids) {
    const isWithin = distRegionSet.has(rid) ? 1 : 0;
    await db.prepare(
      'INSERT INTO signup_request_regions (request_id, region_id, is_within_distributor) VALUES (?, ?, ?)'
    ).bind(requestId, rid, isWithin).run();
  }

  // 총판 관할 외 구역이 있으면 region_add_requests 자동 생성
  if (outsideDist.length > 0) {
    for (const rid of outsideDist) {
      // 충돌 체크: 다른 조직이 이미 매핑한 구역?
      const conflict = await db.prepare(`
        SELECT orm.org_id, o.name as org_name
        FROM org_region_mappings orm
        JOIN organizations o ON orm.org_id = o.org_id
        WHERE orm.region_id = ?
      `).bind(rid).first();

      await db.prepare(`
        INSERT INTO region_add_requests (signup_request_id, distributor_org_id, region_id, status,
          conflict_org_id, conflict_detail)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        requestId, distributor_org_id, rid,
        conflict ? 'CONFLICT' : 'PENDING',
        conflict ? conflict.org_id : null,
        conflict ? `이미 ${conflict.org_name}에 매핑된 구역` : null,
      ).run();
    }
  }

  // verify_token 소멸 처리 (1회용)
  await db.prepare(
    "UPDATE phone_verifications SET verify_token_expires = datetime('now') WHERE verification_id = ?"
  ).bind(verification.verification_id).run();

  await writeAuditLog(db, {
    entity_type: 'SIGNUP_REQUEST', entity_id: requestId,
    action: 'SIGNUP.CREATED',
    detail_json: JSON.stringify({
      name, team_name, distributor_org_id, login_id,
      total_regions: region_ids.length,
      within_distributor: withinDist.length,
      outside_distributor: outsideDist.length,
    }),
  });

  return c.json({
    request_id: requestId,
    status: 'PENDING',
    distributor_name: dist.name,
    selected_regions: {
      total: region_ids.length,
      within_distributor: withinDist.length,
      outside_distributor: outsideDist.length,
    },
    message: outsideDist.length > 0
      ? `가입 신청이 접수되었습니다. ${outsideDist.length}건의 구역은 총판 관할 외이므로 별도 승인이 필요합니다.`
      : '가입 신청이 접수되었습니다. 총판 관리자의 승인을 기다려주세요.',
  }, 201);
});

// ─── 가입 신청 상태 조회 (본인 확인용) ───
signup.get('/status', async (c) => {
  const db = c.env.DB;
  const { phone, verify_token } = c.req.query();

  if (!phone) return c.json({ error: '핸드폰 번호를 입력하세요.' }, 400);
  const normalized = normalizePhone(phone);

  let query = `
    SELECT sr.request_id, sr.name, sr.team_name, sr.status, sr.reject_reason,
           sr.created_at, sr.updated_at, sr.reviewed_at,
           o.name as distributor_name,
           u.name as reviewer_name
    FROM signup_requests sr
    JOIN organizations o ON sr.distributor_org_id = o.org_id
    LEFT JOIN users u ON sr.reviewed_by = u.user_id
    WHERE sr.phone = ?
    ORDER BY sr.created_at DESC LIMIT 5
  `;

  const result = await db.prepare(query).bind(normalized).all();
  return c.json({ requests: result.results });
});

// ═══════════════════════════════════════════════════════════════
// 관리자 API (인증 필요) — 가입 승인/반려 워크플로우
// ═══════════════════════════════════════════════════════════════

// ─── 가입 신청 목록 (관리자용) ───
signup.get('/requests', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { status: filterStatus, page, limit } = c.req.query();
  const pg = normalizePagination(page, limit);

  let query = `
    SELECT sr.*,
           o.name as distributor_name, o.code as distributor_code,
           rv.name as reviewer_name,
           (SELECT COUNT(*) FROM signup_request_regions srr WHERE srr.request_id = sr.request_id) as region_count,
           (SELECT COUNT(*) FROM signup_request_regions srr WHERE srr.request_id = sr.request_id AND srr.is_within_distributor = 0) as outside_region_count,
           (SELECT COUNT(*) FROM region_add_requests rar WHERE rar.signup_request_id = sr.request_id AND rar.status = 'CONFLICT') as conflict_count
    FROM signup_requests sr
    JOIN organizations o ON sr.distributor_org_id = o.org_id
    LEFT JOIN users rv ON sr.reviewed_by = rv.user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // ★ Scope: REGION_ADMIN은 자기 총판으로의 신청만
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
    query += ' AND sr.distributor_org_id = ?';
    params.push(user.org_id);
  }

  if (filterStatus) { query += ' AND sr.status = ?'; params.push(filterStatus); }

  // Count 쿼리: 서브쿼리 없이 단순 카운트
  let countQuery = `
    SELECT COUNT(*) as total
    FROM signup_requests sr
    JOIN organizations o ON sr.distributor_org_id = o.org_id
    LEFT JOIN users rv ON sr.reviewed_by = rv.user_id
    WHERE 1=1
  `;
  const countParams: any[] = [];
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
    countQuery += ' AND sr.distributor_org_id = ?';
    countParams.push(user.org_id);
  }
  if (filterStatus) { countQuery += ' AND sr.status = ?'; countParams.push(filterStatus); }
  const countResult = await db.prepare(countQuery).bind(...countParams).first();

  query += ' ORDER BY sr.created_at DESC LIMIT ? OFFSET ?';
  const result = await db.prepare(query).bind(...params, pg.limit, pg.offset).all();

  return c.json({
    requests: result.results,
    total: (countResult as any)?.total || 0,
    page: pg.page,
    limit: pg.limit,
  });
});

// ─── 가입 신청 상세 (관리자용) ───
signup.get('/requests/:request_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const requestId = Number(c.req.param('request_id'));

  const request = await db.prepare(`
    SELECT sr.*, o.name as distributor_name, o.code as distributor_code
    FROM signup_requests sr
    JOIN organizations o ON sr.distributor_org_id = o.org_id
    WHERE sr.request_id = ?
  `).bind(requestId).first();

  if (!request) return c.json({ error: '가입 신청을 찾을 수 없습니다.' }, 404);

  // Scope 체크
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') && request.distributor_org_id !== user.org_id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  // 선택 구역 상세
  const regions = await db.prepare(`
    SELECT srr.*, ar.sido, ar.sigungu, ar.eupmyeondong, ar.full_name, ar.admin_code
    FROM signup_request_regions srr
    JOIN admin_regions ar ON srr.region_id = ar.region_id
    WHERE srr.request_id = ?
    ORDER BY ar.sido, ar.sigungu, ar.eupmyeondong
  `).bind(requestId).all();

  // 구역 추가 요청
  const regionAddRequests = await db.prepare(`
    SELECT rar.*, ar.full_name as region_name,
           co.name as conflict_org_name
    FROM region_add_requests rar
    JOIN admin_regions ar ON rar.region_id = ar.region_id
    LEFT JOIN organizations co ON rar.conflict_org_id = co.org_id
    WHERE rar.signup_request_id = ?
    ORDER BY rar.status, ar.full_name
  `).bind(requestId).all();

  return c.json({
    request: { ...request, password_hash: undefined },
    regions: regions.results,
    region_add_requests: regionAddRequests.results,
  });
});

// ─── 가입 승인 (조직·사용자·매핑 자동 생성) ───
signup.post('/requests/:request_id/approve', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const requestId = Number(c.req.param('request_id'));
  const body = await c.req.json().catch(() => ({}));

  const request = await db.prepare(
    "SELECT * FROM signup_requests WHERE request_id = ? AND status = 'PENDING'"
  ).bind(requestId).first();
  if (!request) return c.json({ error: '승인 가능한 가입 신청이 아닙니다.' }, 400);

  // Scope 체크
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') && request.distributor_org_id !== user.org_id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  // 선택 구역 조회 (총판 관할 내만)
  const withinRegions = await db.prepare(`
    SELECT region_id FROM signup_request_regions
    WHERE request_id = ? AND is_within_distributor = 1
  `).bind(requestId).all();

  // 1. TEAM 조직 생성
  const teamCode = `TEAM_${(request.distributor_org_id as number)}_${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const orgResult = await db.prepare(`
    INSERT INTO organizations (org_type, name, code, parent_org_id, status)
    VALUES ('TEAM', ?, ?, ?, 'ACTIVE')
  `).bind(request.team_name, teamCode, request.distributor_org_id).run();
  const newOrgId = orgResult.meta.last_row_id as number;

  // 2. 팀-총판 매핑
  await db.prepare(
    'INSERT OR IGNORE INTO team_distributor_mappings (team_org_id, distributor_org_id) VALUES (?, ?)'
  ).bind(newOrgId, request.distributor_org_id).run();

  // 3. 사용자 생성
  const userResult = await db.prepare(`
    INSERT INTO users (org_id, login_id, password_hash, name, phone, status, phone_verified, joined_at)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, datetime('now'))
  `).bind(newOrgId, request.login_id, request.password_hash, request.name, request.phone).run();
  const newUserId = userResult.meta.last_row_id as number;

  // 4. TEAM_LEADER 역할 부여
  const roleRow = await db.prepare("SELECT role_id FROM roles WHERE code = 'TEAM_LEADER'").first();
  if (roleRow) {
    await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(newUserId, roleRow.role_id).run();
  }

  // 5. 조직-구역 매핑 (총판 관할 내 구역만)
  for (const r of withinRegions.results as any[]) {
    await db.prepare(
      'INSERT OR IGNORE INTO org_region_mappings (org_id, region_id) VALUES (?, ?)'
    ).bind(newOrgId, r.region_id).run();
  }

  // 6. 수수료 정책 (옵션)
  if (request.commission_mode && request.commission_value !== null) {
    await db.prepare(`
      INSERT INTO commission_policies (org_id, team_leader_id, mode, value, effective_from)
      VALUES (?, ?, ?, ?, date('now'))
    `).bind(request.distributor_org_id, newUserId, request.commission_mode, request.commission_value).run();
  }

  // 7. 신청 상태 업데이트
  await db.prepare(`
    UPDATE signup_requests SET
      status = 'APPROVED', reviewed_by = ?, reviewed_at = datetime('now'),
      created_org_id = ?, created_user_id = ?,
      approval_checklist_json = ?, updated_at = datetime('now')
    WHERE request_id = ?
  `).bind(
    user.user_id, newOrgId, newUserId,
    JSON.stringify(body.checklist || {}),
    requestId,
  ).run();

  // 8. 알림 생성
  await db.prepare(`
    INSERT INTO notifications (recipient_user_id, type, title, message, link_url, metadata_json)
    VALUES (?, 'SIGNUP_APPROVED', '가입 승인', ?, ?, ?)
  `).bind(
    newUserId, `${request.name}님의 가입이 승인되었습니다.`,
    '#my-orders',
    JSON.stringify({ request_id: requestId, org_id: newOrgId }),
  ).run();

  await writeAuditLog(db, {
    entity_type: 'SIGNUP_REQUEST', entity_id: requestId,
    action: 'SIGNUP.APPROVED', actor_id: user.user_id,
    detail_json: JSON.stringify({
      created_org_id: newOrgId, created_user_id: newUserId,
      team_name: request.team_name, login_id: request.login_id,
      region_count: withinRegions.results.length,
    }),
  });

  return c.json({
    ok: true,
    request_id: requestId,
    created_org_id: newOrgId,
    created_user_id: newUserId,
    login_id: request.login_id,
    team_code: teamCode,
    message: `${request.name}님의 가입이 승인되었습니다. 조직(${request.team_name})과 계정이 생성되었습니다.`,
  });
});

// ─── 가입 반려 ───
signup.post('/requests/:request_id/reject', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const requestId = Number(c.req.param('request_id'));
  const { reason } = await c.req.json();

  if (!reason) return c.json({ error: '반려 사유를 입력하세요.' }, 400);

  const request = await db.prepare(
    "SELECT * FROM signup_requests WHERE request_id = ? AND status = 'PENDING'"
  ).bind(requestId).first();
  if (!request) return c.json({ error: '반려 가능한 가입 신청이 아닙니다.' }, 400);

  // Scope 체크
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') && request.distributor_org_id !== user.org_id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  await db.prepare(`
    UPDATE signup_requests SET
      status = 'REJECTED', reviewed_by = ?, reviewed_at = datetime('now'),
      reject_reason = ?, updated_at = datetime('now')
    WHERE request_id = ?
  `).bind(user.user_id, reason, requestId).run();

  await writeAuditLog(db, {
    entity_type: 'SIGNUP_REQUEST', entity_id: requestId,
    action: 'SIGNUP.REJECTED', actor_id: user.user_id,
    detail_json: JSON.stringify({ reason, name: request.name }),
  });

  return c.json({ ok: true, message: '가입 신청이 반려되었습니다.' });
});

// ─── 재신청 (반려 후) ───
signup.post('/requests/:request_id/reapply', async (c) => {
  const db = c.env.DB;
  const requestId = Number(c.req.param('request_id'));
  const body = await c.req.json();

  const request = await db.prepare(
    "SELECT * FROM signup_requests WHERE request_id = ? AND status = 'REJECTED'"
  ).bind(requestId).first();
  if (!request) return c.json({ error: '재신청 가능한 요청이 아닙니다.' }, 400);

  // verify_token 재검증 (새 인증 필요)
  if (!body.verify_token) return c.json({ error: '핸드폰 인증 토큰이 필요합니다.' }, 400);

  const verification = await db.prepare(`
    SELECT * FROM phone_verifications
    WHERE phone = ? AND purpose = 'SIGNUP' AND verified = 1
      AND verify_token = ? AND verify_token_expires > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(request.phone, body.verify_token).first();

  if (!verification) {
    return c.json({ error: '핸드폰 인증이 만료되었습니다. 다시 인증하세요.' }, 401);
  }

  // 수정 가능 필드 업데이트
  const updates: string[] = ['status = ?', "updated_at = datetime('now')", 'reject_reason = NULL', 'reviewed_by = NULL', 'reviewed_at = NULL'];
  const params: any[] = ['PENDING'];

  if (body.team_name) { updates.push('team_name = ?'); params.push(body.team_name); }
  if (body.distributor_org_id) { updates.push('distributor_org_id = ?'); params.push(body.distributor_org_id); }
  if (body.password) {
    const newHash = await hashPassword(body.password);
    updates.push('password_hash = ?');
    params.push(newHash);
  }

  params.push(requestId);

  await db.prepare(
    `UPDATE signup_requests SET ${updates.join(', ')} WHERE request_id = ?`
  ).bind(...params).run();

  // 구역 재선택 (옵션)
  if (body.region_ids && Array.isArray(body.region_ids)) {
    await db.prepare('DELETE FROM signup_request_regions WHERE request_id = ?').bind(requestId).run();
    await db.prepare('DELETE FROM region_add_requests WHERE signup_request_id = ?').bind(requestId).run();

    const distId = body.distributor_org_id || request.distributor_org_id;
    const distRegions = await db.prepare(
      'SELECT region_id FROM org_region_mappings WHERE org_id = ?'
    ).bind(distId).all();
    const distRegionSet = new Set((distRegions.results as any[]).map(r => r.region_id));

    for (const rid of body.region_ids) {
      const isWithin = distRegionSet.has(rid) ? 1 : 0;
      await db.prepare(
        'INSERT INTO signup_request_regions (request_id, region_id, is_within_distributor) VALUES (?, ?, ?)'
      ).bind(requestId, rid, isWithin).run();

      if (!distRegionSet.has(rid)) {
        const conflict = await db.prepare(`
          SELECT orm.org_id, o.name as org_name
          FROM org_region_mappings orm JOIN organizations o ON orm.org_id = o.org_id
          WHERE orm.region_id = ?
        `).bind(rid).first();

        await db.prepare(`
          INSERT INTO region_add_requests (signup_request_id, distributor_org_id, region_id, status, conflict_org_id, conflict_detail)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          requestId, distId, rid,
          conflict ? 'CONFLICT' : 'PENDING',
          conflict ? conflict.org_id : null,
          conflict ? `이미 ${conflict.org_name}에 매핑된 구역` : null,
        ).run();
      }
    }
  }

  // 토큰 소멸
  await db.prepare(
    "UPDATE phone_verifications SET verify_token_expires = datetime('now') WHERE verification_id = ?"
  ).bind(verification.verification_id).run();

  await writeAuditLog(db, {
    entity_type: 'SIGNUP_REQUEST', entity_id: requestId,
    action: 'SIGNUP.REAPPLIED',
    detail_json: JSON.stringify({ name: request.name }),
  });

  return c.json({ ok: true, request_id: requestId, status: 'PENDING', message: '재신청되었습니다.' });
});

// ─── 추가 지역 요청 서브라우터 마운트 ───
import regionAdd from './region-add';
signup.route('/', regionAdd);

export default signup;
