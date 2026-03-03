import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth, writeAuditLog } from '../middleware/auth';
import { hashPassword, verifyPassword, needsRehash, checkRateLimit, normalizePhone, isValidPhone, isValidLoginId, isValidEmail } from '../middleware/security';

const hr = new Hono<Env>();

// ════════════════════════════════════════════
// 조직(법인) 관리
// ════════════════════════════════════════════

// 조직 목록 (상세: 소속 인원수 포함)
hr.get('/organizations', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const result = await db.prepare(`
    SELECT o.*,
      (SELECT COUNT(*) FROM users u WHERE u.org_id = o.org_id AND u.status = 'ACTIVE') as active_members,
      (SELECT COUNT(*) FROM users u WHERE u.org_id = o.org_id) as total_members,
      (SELECT COUNT(*) FROM users u 
       JOIN user_roles ur ON u.user_id = ur.user_id 
       JOIN roles r ON ur.role_id = r.role_id 
       WHERE u.org_id = o.org_id AND r.code = 'TEAM_LEADER' AND u.status = 'ACTIVE') as active_leaders
    FROM organizations o
    ORDER BY o.org_type DESC, o.name
  `).all();

  return c.json({ organizations: result.results });
});

// 조직 등록
hr.post('/organizations', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const body = await c.req.json();

  if (!body.name || !body.org_type) {
    return c.json({ error: '조직명과 유형은 필수입니다.' }, 400);
  }
  if (!['HQ', 'REGION'].includes(body.org_type)) {
    return c.json({ error: '유형은 HQ 또는 REGION이어야 합니다.' }, 400);
  }
  // 조직명 길이 제한
  if (body.name.length > 50) {
    return c.json({ error: '조직명은 50자 이하로 입력하세요.' }, 400);
  }

  // 코드 중복 체크
  if (body.code) {
    if (!/^[A-Z0-9_]{2,30}$/.test(body.code)) {
      return c.json({ error: '조직 코드는 영문대문자, 숫자, 밑줄만 사용 가능합니다 (2~30자).' }, 400);
    }
    const dup = await db.prepare('SELECT org_id FROM organizations WHERE code = ?').bind(body.code).first();
    if (dup) return c.json({ error: '이미 사용 중인 조직 코드입니다.' }, 409);
  }

  const result = await db.prepare(`
    INSERT INTO organizations (org_type, name, code, status) VALUES (?, ?, ?, 'ACTIVE')
  `).bind(body.org_type, body.name, body.code || null).run();

  await writeAuditLog(db, { entity_type: 'ORGANIZATION', entity_id: result.meta.last_row_id as number, action: 'CREATE', actor_id: user.user_id, detail_json: JSON.stringify(body) });

  return c.json({ org_id: result.meta.last_row_id }, 201);
});

// 조직 수정
hr.put('/organizations/:org_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const orgId = Number(c.req.param('org_id'));
  if (isNaN(orgId)) return c.json({ error: '유효하지 않은 조직 ID입니다.' }, 400);

  const body = await c.req.json();

  const existing = await db.prepare('SELECT * FROM organizations WHERE org_id = ?').bind(orgId).first();
  if (!existing) return c.json({ error: '조직을 찾을 수 없습니다.' }, 404);

  await db.prepare(`
    UPDATE organizations SET name = COALESCE(?, name), code = COALESCE(?, code), 
    status = COALESCE(?, status), updated_at = datetime('now') WHERE org_id = ?
  `).bind(body.name || null, body.code || null, body.status || null, orgId).run();

  await writeAuditLog(db, { entity_type: 'ORGANIZATION', entity_id: orgId, action: 'UPDATE', actor_id: user.user_id, detail_json: JSON.stringify(body) });

  return c.json({ ok: true });
});

// ════════════════════════════════════════════
// 사용자(인사) 관리
// ════════════════════════════════════════════

// 사용자 목록 (조직별 필터 + 역할 포함 + 인증 상태)
hr.get('/users', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { org_id, role, status: filterStatus, search, page = '1', limit = '30' } = c.req.query();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = [];
  const params: any[] = [];

  // 스코프: REGION_ADMIN은 자기 지역만
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
    conditions.push('u.org_id = ?');
    params.push(user.org_id);
  } else if (org_id) {
    conditions.push('u.org_id = ?');
    params.push(Number(org_id));
  }

  if (filterStatus) { conditions.push('u.status = ?'); params.push(filterStatus); }
  if (search) { 
    const safeSearch = `%${search.slice(0, 50)}%`;
    conditions.push("(u.name LIKE ? OR u.login_id LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)");
    params.push(safeSearch, safeSearch, safeSearch, safeSearch);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countResult = await db.prepare(`SELECT COUNT(DISTINCT u.user_id) as total FROM users u ${where}`).bind(...params).first();

  const result = await db.prepare(`
    SELECT u.user_id, u.org_id, u.login_id, u.name, u.phone, u.email, u.status,
           u.phone_verified, u.joined_at, u.memo, u.created_at, u.updated_at,
           o.name as org_name, o.org_type, o.code as org_code,
           GROUP_CONCAT(DISTINCT r.code) as role_codes,
           GROUP_CONCAT(DISTINCT r.name) as role_names
    FROM users u
    JOIN organizations o ON u.org_id = o.org_id
    LEFT JOIN user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.role_id
    ${where}
    GROUP BY u.user_id
    ORDER BY u.org_id, u.name
    LIMIT ? OFFSET ?
  `).bind(...params, limitNum, offset).all();

  // 역할별 필터 (후처리 - GROUP_CONCAT 내에서 필터 어려움)
  let users = result.results.map((u: any) => ({
    ...u,
    roles: u.role_codes ? u.role_codes.split(',') : [],
    role_names: u.role_names ? u.role_names.split(',') : [],
  }));

  if (role) {
    users = users.filter((u: any) => u.roles.includes(role));
  }

  return c.json({ users, total: (countResult as any)?.total || 0, page: pageNum, limit: limitNum });
});

// 사용자 상세
hr.get('/users/:user_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const currentUser = c.get('user')!;
  const db = c.env.DB;
  const userId = Number(c.req.param('user_id'));
  if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

  const targetUser = await db.prepare(`
    SELECT u.*, o.name as org_name, o.org_type, o.code as org_code
    FROM users u JOIN organizations o ON u.org_id = o.org_id
    WHERE u.user_id = ?
  `).bind(userId).first();

  if (!targetUser) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

  // REGION은 자기 법인 소속만
  if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN') && targetUser.org_id !== currentUser.org_id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  const roles = await db.prepare(`
    SELECT r.role_id, r.code, r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?
  `).bind(userId).all();

  // 최근 활동 (주문 수행 실적 - 팀장인 경우)
  const recentActivity = await db.prepare(`
    SELECT 
      COUNT(CASE WHEN oa.status NOT IN ('REASSIGNED') THEN 1 END) as total_assigned,
      COUNT(CASE WHEN oa.status = 'HQ_APPROVED' THEN 1 END) as total_approved,
      COUNT(CASE WHEN oa.status = 'SETTLEMENT_CONFIRMED' THEN 1 END) as total_settled,
      COUNT(CASE WHEN oa.status IN ('REGION_REJECTED','HQ_REJECTED') THEN 1 END) as total_rejected
    FROM order_assignments oa WHERE oa.team_leader_id = ?
  `).bind(userId).first();

  // 핸드폰 인증 이력
  const phoneVerifications = await db.prepare(`
    SELECT * FROM phone_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
  `).bind(userId).all();

  return c.json({
    user: { ...targetUser, password_hash: undefined },
    roles: roles.results,
    activity: recentActivity,
    phone_verifications: phoneVerifications.results,
  });
});

// ─── 사용자 신규 등록 ───
hr.post('/users', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const currentUser = c.get('user')!;
  const db = c.env.DB;
  const body = await c.req.json();

  // 필수 값 검증
  if (!body.name) return c.json({ error: '이름은 필수입니다.' }, 400);
  if (!body.phone) return c.json({ error: '핸드폰 번호는 필수입니다.' }, 400);
  if (!body.org_id) return c.json({ error: '소속 조직은 필수입니다.' }, 400);
  if (!body.role) return c.json({ error: '역할은 필수입니다.' }, 400);

  // 이름 길이 제한
  if (body.name.length > 50) return c.json({ error: '이름은 50자 이하로 입력하세요.' }, 400);

  // 전화번호 검증
  if (!isValidPhone(body.phone)) return c.json({ error: '올바른 핸드폰 번호를 입력하세요 (01X로 시작하는 10~11자리).' }, 400);

  // 이메일 검증
  if (body.email && !isValidEmail(body.email)) return c.json({ error: '올바른 이메일 형식을 입력하세요.' }, 400);

  // REGION_ADMIN은 자기 법인에만 팀장 등록 가능
  if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN')) {
    if (Number(body.org_id) !== currentUser.org_id) {
      return c.json({ error: '자기 법인에만 인원을 등록할 수 있습니다.' }, 403);
    }
    if (body.role !== 'TEAM_LEADER') {
      return c.json({ error: '지역법인 관리자는 팀장만 등록할 수 있습니다.' }, 403);
    }
  }

  // 유효한 역할인지 확인
  const validRoles = ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'TEAM_LEADER', 'AUDITOR'];
  if (!validRoles.includes(body.role)) return c.json({ error: '유효하지 않은 역할입니다.' }, 400);

  // 핸드폰 중복 체크
  const phoneDup = await db.prepare('SELECT user_id, name FROM users WHERE phone = ? AND status = ?').bind(normalizePhone(body.phone), 'ACTIVE').first();
  if (phoneDup) return c.json({ error: `이미 등록된 핸드폰 번호입니다. (${(phoneDup as any).name})` }, 409);

  // login_id 자동 생성 또는 수동 입력
  let loginId = body.login_id;
  if (loginId) {
    if (!isValidLoginId(loginId)) return c.json({ error: '로그인 ID는 영문/숫자/밑줄로 3~50자입니다.' }, 400);
  } else {
    // 핸드폰 뒷자리 기반 자동 생성
    const phoneLast4 = normalizePhone(body.phone).slice(-4);
    loginId = `user_${phoneLast4}_${Date.now().toString(36).slice(-4)}`;
  }

  // login_id 중복 체크
  const loginDup = await db.prepare('SELECT user_id FROM users WHERE login_id = ?').bind(loginId).first();
  if (loginDup) return c.json({ error: '이미 사용 중인 아이디입니다.' }, 409);

  // 초기 비밀번호: 수동 입력 또는 핸드폰 뒷자리 4자리
  const initialPassword = body.password || normalizePhone(body.phone).slice(-4) + '!';
  if (initialPassword.length < 4) return c.json({ error: '비밀번호는 최소 4자 이상이어야 합니다.' }, 400);
  
  // PBKDF2 해싱
  const passwordHash = await hashPassword(initialPassword);

  // 사용자 등록
  const result = await db.prepare(`
    INSERT INTO users (org_id, login_id, password_hash, name, phone, email, status, phone_verified, joined_at, memo)
    VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 0, datetime('now'), ?)
  `).bind(
    Number(body.org_id), loginId, passwordHash,
    body.name, normalizePhone(body.phone), body.email || null, body.memo || null
  ).run();

  const newUserId = result.meta.last_row_id as number;

  // 역할 할당
  const roleRow = await db.prepare('SELECT role_id FROM roles WHERE code = ?').bind(body.role).first();
  if (roleRow) {
    await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(newUserId, roleRow.role_id).run();
  }

  await writeAuditLog(db, {
    entity_type: 'USER', entity_id: newUserId, action: 'CREATE',
    actor_id: currentUser.user_id,
    detail_json: JSON.stringify({ name: body.name, org_id: body.org_id, role: body.role, login_id: loginId })
  });

  return c.json({
    user_id: newUserId,
    login_id: loginId,
    initial_password: initialPassword,
    message: `사용자 "${body.name}" 등록 완료. 초기 비밀번호: ${initialPassword}`
  }, 201);
});

// ─── 사용자 정보 수정 ───
hr.put('/users/:user_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const currentUser = c.get('user')!;
  const db = c.env.DB;
  const userId = Number(c.req.param('user_id'));
  if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

  const body = await c.req.json();

  const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
  if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

  // REGION은 자기 법인만
  if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN') && target.org_id !== currentUser.org_id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  // 입력값 검증
  if (body.phone && !isValidPhone(body.phone)) return c.json({ error: '올바른 핸드폰 번호를 입력하세요.' }, 400);
  if (body.email && !isValidEmail(body.email)) return c.json({ error: '올바른 이메일 형식을 입력하세요.' }, 400);

  // 핸드폰 변경 시 중복 체크 + 인증 초기화
  if (body.phone && normalizePhone(body.phone) !== target.phone) {
    const phoneDup = await db.prepare('SELECT user_id, name FROM users WHERE phone = ? AND status = ? AND user_id != ?').bind(normalizePhone(body.phone), 'ACTIVE', userId).first();
    if (phoneDup) return c.json({ error: `이미 등록된 핸드폰 번호입니다. (${(phoneDup as any).name})` }, 409);
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (body.name !== undefined) { sets.push('name = ?'); params.push(body.name); }
  if (body.phone !== undefined) { sets.push('phone = ?'); params.push(normalizePhone(body.phone)); sets.push('phone_verified = 0'); }
  if (body.email !== undefined) { sets.push('email = ?'); params.push(body.email); }
  if (body.memo !== undefined) { sets.push('memo = ?'); params.push(body.memo); }
  if (body.org_id !== undefined && currentUser.roles.includes('SUPER_ADMIN')) { sets.push('org_id = ?'); params.push(Number(body.org_id)); }

  if (sets.length === 0 && !body.role) return c.json({ error: '변경할 항목이 없습니다.' }, 400);

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    params.push(userId);
    await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE user_id = ?`).bind(...params).run();
  }

  // 역할 변경
  if (body.role) {
    const validRoles = ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'TEAM_LEADER', 'AUDITOR'];
    if (!validRoles.includes(body.role)) return c.json({ error: '유효하지 않은 역할입니다.' }, 400);
    
    await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId).run();
    const roleRow = await db.prepare('SELECT role_id FROM roles WHERE code = ?').bind(body.role).first();
    if (roleRow) {
      await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(userId, roleRow.role_id).run();
    }
  }

  await writeAuditLog(db, { entity_type: 'USER', entity_id: userId, action: 'UPDATE', actor_id: currentUser.user_id, detail_json: JSON.stringify(body) });

  return c.json({ ok: true });
});

// ─── 사용자 활성화/비활성화 ───
hr.patch('/users/:user_id/status', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const currentUser = c.get('user')!;
  const db = c.env.DB;
  const userId = Number(c.req.param('user_id'));
  if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

  const { status } = await c.req.json();

  if (!['ACTIVE', 'INACTIVE'].includes(status)) return c.json({ error: '상태는 ACTIVE 또는 INACTIVE입니다.' }, 400);

  const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
  if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

  // 자기 자신 비활성화 방지
  if (userId === currentUser.user_id && status === 'INACTIVE') {
    return c.json({ error: '자기 자신을 비활성화할 수 없습니다.' }, 400);
  }

  // REGION은 자기 법인만
  if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN') && target.org_id !== currentUser.org_id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  await db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE user_id = ?").bind(status, userId).run();

  // 비활성화 시 세션 삭제
  if (status === 'INACTIVE') {
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  }

  await writeAuditLog(db, { entity_type: 'USER', entity_id: userId, action: status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE', actor_id: currentUser.user_id });

  return c.json({ ok: true, message: status === 'ACTIVE' ? '활성화되었습니다.' : '비활성화되었습니다. 해당 사용자는 더 이상 로그인할 수 없습니다.' });
});

// ─── 비밀번호 초기화 (관리자) ───
hr.post('/users/:user_id/reset-password', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const currentUser = c.get('user')!;
  const db = c.env.DB;
  const userId = Number(c.req.param('user_id'));
  if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

  const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
  if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

  if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN') && target.org_id !== currentUser.org_id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  // 핸드폰 뒷자리 4자리 + !
  const phone = (target.phone as string) || '0000';
  const newPassword = normalizePhone(phone).slice(-4) + '!';
  const passwordHash = await hashPassword(newPassword);

  await db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE user_id = ?").bind(passwordHash, userId).run();

  // 기존 세션 모두 삭제
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

  await writeAuditLog(db, { entity_type: 'USER', entity_id: userId, action: 'RESET_PASSWORD', actor_id: currentUser.user_id });

  return c.json({ ok: true, new_password: newPassword, message: `비밀번호가 "${newPassword}"로 초기화되었습니다.` });
});

// ─── 비밀번호 변경 (본인) ───
hr.post('/users/change-password', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const currentUser = c.get('user')!;
  const db = c.env.DB;
  const { current_password, new_password } = await c.req.json();

  if (!current_password || !new_password) return c.json({ error: '현재 비밀번호와 새 비밀번호를 입력하세요.' }, 400);
  if (new_password.length < 4) return c.json({ error: '비밀번호는 최소 4자 이상이어야 합니다.' }, 400);

  const user = await db.prepare('SELECT password_hash FROM users WHERE user_id = ?').bind(currentUser.user_id).first();
  if (!user?.password_hash) return c.json({ error: '사용자 정보를 찾을 수 없습니다.' }, 500);

  // PBKDF2 검증 (레거시 호환)
  const valid = await verifyPassword(current_password, user.password_hash as string);
  if (!valid) return c.json({ error: '현재 비밀번호가 틀렸습니다.' }, 401);

  const newHash = await hashPassword(new_password);
  await db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE user_id = ?").bind(newHash, currentUser.user_id).run();

  await writeAuditLog(db, { entity_type: 'USER', entity_id: currentUser.user_id, action: 'CHANGE_PASSWORD', actor_id: currentUser.user_id });

  return c.json({ ok: true, message: '비밀번호가 변경되었습니다.' });
});

// ─── ID/PW 직접 설정 (관리자) ───
hr.post('/users/:user_id/set-credentials', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const currentUser = c.get('user')!;
  const db = c.env.DB;
  const userId = Number(c.req.param('user_id'));
  if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

  const { login_id, password } = await c.req.json();

  const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
  if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

  if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN') && target.org_id !== currentUser.org_id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (login_id) {
    if (!isValidLoginId(login_id)) return c.json({ error: '로그인 ID는 영문/숫자/밑줄로 3~50자입니다.' }, 400);
    const loginDup = await db.prepare('SELECT user_id FROM users WHERE login_id = ? AND user_id != ?').bind(login_id, userId).first();
    if (loginDup) return c.json({ error: '이미 사용 중인 아이디입니다.' }, 409);
    updates.push('login_id = ?');
    params.push(login_id);
  }

  if (password) {
    if (password.length < 4) return c.json({ error: '비밀번호는 최소 4자 이상이어야 합니다.' }, 400);
    const passwordHash = await hashPassword(password);
    updates.push('password_hash = ?');
    params.push(passwordHash);
  }

  if (updates.length === 0) return c.json({ error: '변경할 항목이 없습니다.' }, 400);

  updates.push("updated_at = datetime('now')");
  params.push(userId);

  await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`).bind(...params).run();

  if (password) {
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  }

  await writeAuditLog(db, { entity_type: 'USER', entity_id: userId, action: 'SET_CREDENTIALS', actor_id: currentUser.user_id, detail_json: JSON.stringify({ login_id_changed: !!login_id, password_changed: !!password }) });

  return c.json({ ok: true, message: 'ID/PW가 설정되었습니다.' });
});

// ════════════════════════════════════════════
// 핸드폰 인증
// ════════════════════════════════════════════

// OTP 발송 요청
hr.post('/phone/send-otp', async (c) => {
  const db = c.env.DB;
  
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '잘못된 요청 형식입니다.' }, 400);
  }

  const { phone, purpose = 'REGISTER', user_id } = body;

  if (!phone) return c.json({ error: '핸드폰 번호를 입력하세요.' }, 400);

  // 정규화 & 검증
  const normalizedPhone = normalizePhone(phone);
  if (!isValidPhone(normalizedPhone)) {
    return c.json({ error: '올바른 핸드폰 번호를 입력하세요.' }, 400);
  }

  // Rate Limiting: 전화번호당 1분에 2회까지
  const rlKey = `otp:${normalizedPhone}`;
  const rl = checkRateLimit(rlKey, 2, 60_000);
  if (!rl.ok) {
    return c.json({ error: '인증번호가 이미 발송되었습니다. 1분 후 다시 시도하세요.' }, 429);
  }

  // DB 기반 도배 방지 (1분 이내 기존 발송 확인)
  const recent = await db.prepare(`
    SELECT verification_id FROM phone_verifications 
    WHERE phone = ? AND purpose = ? AND created_at > datetime('now', '-1 minutes')
  `).bind(normalizedPhone, purpose).first();

  if (recent) return c.json({ error: '인증번호가 이미 발송되었습니다. 1분 후 다시 시도하세요.' }, 429);

  // 6자리 OTP 생성 (crypto.getRandomValues 사용)
  const randomBuf = crypto.getRandomValues(new Uint32Array(1));
  const otp = String(100000 + (randomBuf[0] % 900000));
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3분

  await db.prepare(`
    INSERT INTO phone_verifications (phone, otp_code, purpose, user_id, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(normalizedPhone, otp, purpose, user_id || null, expiresAt).run();

  // 실제 SMS 발송은 외부 서비스 연동 필요 (현재는 시뮬레이션)
  console.log(`[SMS 시뮬레이션] ${normalizedPhone}에 OTP: ${otp} 발송`);

  const response: any = { 
    ok: true, 
    message: `인증번호가 ${normalizedPhone}으로 발송되었습니다. (3분 이내 입력)`,
    expires_at: expiresAt,
  };

  // 개발 환경에서만 OTP 노출 (wrangler pages dev --local 시에만)
  // 프로덕션 배포 시에는 이 필드가 절대 포함되지 않음
  // 환경 변수 DEV_MODE=true 설정 시에만 노출
  if ((c.env as any).DEV_MODE === 'true') {
    response._dev_otp = otp;
  }

  return c.json(response);
});

// OTP 검증
hr.post('/phone/verify-otp', async (c) => {
  const db = c.env.DB;
  const { phone, otp_code, purpose = 'REGISTER' } = await c.req.json();

  if (!phone || !otp_code) return c.json({ error: '핸드폰 번호와 인증번호를 입력하세요.' }, 400);

  const normalizedPhone = normalizePhone(phone);

  // Rate Limiting: OTP 검증 시도 - 전화번호당 1분에 10회
  const rlKey = `otp-verify:${normalizedPhone}`;
  const rl = checkRateLimit(rlKey, 10, 60_000);
  if (!rl.ok) {
    return c.json({ error: '인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요.' }, 429);
  }

  // 최신 미인증 OTP 조회
  const verification = await db.prepare(`
    SELECT * FROM phone_verifications
    WHERE phone = ? AND purpose = ? AND verified = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).bind(normalizedPhone, purpose).first();

  if (!verification) return c.json({ error: '유효한 인증 요청이 없습니다. 인증번호를 다시 요청하세요.' }, 400);

  // 시도 횟수 체크 (최대 5회)
  if ((verification.attempts as number) >= 5) {
    return c.json({ error: '인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청하세요.' }, 429);
  }

  // 시도 횟수 증가
  await db.prepare('UPDATE phone_verifications SET attempts = attempts + 1 WHERE verification_id = ?').bind(verification.verification_id).run();

  if (verification.otp_code !== otp_code) {
    const remaining = 5 - (verification.attempts as number) - 1;
    return c.json({ error: `인증번호가 틀렸습니다. (남은 시도: ${remaining}회)` }, 400);
  }

  // 인증 성공
  await db.prepare('UPDATE phone_verifications SET verified = 1 WHERE verification_id = ?').bind(verification.verification_id).run();

  // user_id가 있으면 phone_verified 업데이트
  if (verification.user_id) {
    await db.prepare("UPDATE users SET phone_verified = 1, updated_at = datetime('now') WHERE user_id = ?").bind(verification.user_id).run();
  }

  return c.json({ ok: true, verified: true, message: '핸드폰 인증이 완료되었습니다.' });
});

// 핸드폰 인증 상태 확인
hr.get('/phone/status', async (c) => {
  const db = c.env.DB;
  const phone = c.req.query('phone');
  if (!phone) return c.json({ error: '핸드폰 번호를 입력하세요.' }, 400);

  const normalizedPhone = normalizePhone(phone);

  const verified = await db.prepare(`
    SELECT verification_id, verified, created_at FROM phone_verifications
    WHERE phone = ? AND verified = 1 ORDER BY created_at DESC LIMIT 1
  `).bind(normalizedPhone).first();

  const user = await db.prepare(`
    SELECT user_id, name, phone_verified FROM users WHERE phone = ? AND status = 'ACTIVE'
  `).bind(normalizedPhone).first();

  return c.json({
    phone: normalizedPhone,
    has_verified_record: !!verified,
    last_verified_at: verified?.created_at || null,
    registered_user: user ? { user_id: user.user_id, name: user.name, phone_verified: user.phone_verified } : null,
  });
});

// ─── 역할 목록 ───
hr.get('/roles', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const result = await c.env.DB.prepare('SELECT * FROM roles ORDER BY role_id').all();
  return c.json({ roles: result.results });
});

// ════════════════════════════════════════════
// 수수료(정률/요율) 정책 관리
// ════════════════════════════════════════════

// 수수료 정책 목록 조회 (어드민 + 파트장만)
hr.get('/commission-policies', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;

  let query = `
    SELECT cp.*, o.name as org_name, u.name as team_leader_name, u.login_id as team_leader_login_id
    FROM commission_policies cp
    JOIN organizations o ON cp.org_id = o.org_id
    LEFT JOIN users u ON cp.team_leader_id = u.user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // REGION_ADMIN은 자기 법인만
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
    query += ' AND cp.org_id = ?';
    params.push(user.org_id);
  }

  query += ' ORDER BY cp.org_id, cp.team_leader_id NULLS FIRST, cp.effective_from DESC';
  const result = await db.prepare(query).bind(...params).all();
  return c.json({ policies: result.results });
});

// 수수료 정책 생성
hr.post('/commission-policies', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청 형식입니다.' }, 400); }

  // 필수 검증
  if (!body.org_id) return c.json({ error: '지역법인은 필수입니다.' }, 400);
  if (!body.mode || !['PERCENT', 'FIXED'].includes(body.mode)) return c.json({ error: '수수료 유형은 PERCENT(정률) 또는 FIXED(정액)입니다.' }, 400);
  if (body.value === undefined || body.value === null || isNaN(Number(body.value)) || Number(body.value) < 0) {
    return c.json({ error: '수수료 값은 0 이상의 숫자여야 합니다.' }, 400);
  }
  if (body.mode === 'PERCENT' && Number(body.value) > 100) {
    return c.json({ error: '요율은 100% 이하여야 합니다.' }, 400);
  }

  // REGION_ADMIN은 자기 법인에만
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
    if (Number(body.org_id) !== user.org_id) {
      return c.json({ error: '자기 법인의 수수료만 설정할 수 있습니다.' }, 403);
    }
  }

  const effectiveFrom = body.effective_from || new Date().toISOString().split('T')[0];
  const teamLeaderId = body.team_leader_id ? Number(body.team_leader_id) : null;

  // 동일 조건 중복 체크 (같은 org + team_leader + effective_from)
  const dup = await db.prepare(`
    SELECT commission_policy_id FROM commission_policies 
    WHERE org_id = ? AND ${teamLeaderId ? 'team_leader_id = ?' : 'team_leader_id IS NULL'} AND effective_from = ?
  `).bind(...(teamLeaderId ? [Number(body.org_id), teamLeaderId, effectiveFrom] : [Number(body.org_id), effectiveFrom])).first();

  if (dup) {
    return c.json({ error: '동일한 조건의 수수료 정책이 이미 존재합니다. 수정을 이용하세요.' }, 409);
  }

  const result = await db.prepare(`
    INSERT INTO commission_policies (org_id, team_leader_id, mode, value, effective_from)
    VALUES (?, ?, ?, ?, ?)
  `).bind(Number(body.org_id), teamLeaderId, body.mode, Number(body.value), effectiveFrom).run();

  await writeAuditLog(db, {
    entity_type: 'COMMISSION_POLICY', entity_id: result.meta.last_row_id as number,
    action: 'CREATE', actor_id: user.user_id,
    detail_json: JSON.stringify({ org_id: body.org_id, team_leader_id: teamLeaderId, mode: body.mode, value: body.value })
  });

  return c.json({ commission_policy_id: result.meta.last_row_id, message: '수수료 정책이 등록되었습니다.' }, 201);
});

// 수수료 정책 수정
hr.put('/commission-policies/:id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const policyId = Number(c.req.param('id'));
  if (isNaN(policyId)) return c.json({ error: '유효하지 않은 정책 ID입니다.' }, 400);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청 형식입니다.' }, 400); }

  const existing = await db.prepare('SELECT * FROM commission_policies WHERE commission_policy_id = ?').bind(policyId).first();
  if (!existing) return c.json({ error: '수수료 정책을 찾을 수 없습니다.' }, 404);

  // REGION_ADMIN은 자기 법인만
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
    if (existing.org_id !== user.org_id) {
      return c.json({ error: '자기 법인의 수수료만 수정할 수 있습니다.' }, 403);
    }
  }

  // 검증
  if (body.mode && !['PERCENT', 'FIXED'].includes(body.mode)) return c.json({ error: '수수료 유형은 PERCENT(정률) 또는 FIXED(정액)입니다.' }, 400);
  if (body.value !== undefined && (isNaN(Number(body.value)) || Number(body.value) < 0)) return c.json({ error: '수수료 값은 0 이상의 숫자여야 합니다.' }, 400);
  const mode = body.mode || existing.mode;
  const value = body.value !== undefined ? Number(body.value) : existing.value;
  if (mode === 'PERCENT' && value > 100) return c.json({ error: '요율은 100% 이하여야 합니다.' }, 400);

  await db.prepare(`
    UPDATE commission_policies 
    SET mode = ?, value = ?, effective_from = COALESCE(?, effective_from), updated_at = datetime('now')
    WHERE commission_policy_id = ?
  `).bind(mode, value, body.effective_from || null, policyId).run();

  await writeAuditLog(db, {
    entity_type: 'COMMISSION_POLICY', entity_id: policyId,
    action: 'UPDATE', actor_id: user.user_id,
    detail_json: JSON.stringify({ mode, value, effective_from: body.effective_from })
  });

  return c.json({ ok: true, message: '수수료 정책이 수정되었습니다.' });
});

// 수수료 정책 삭제
hr.delete('/commission-policies/:id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const policyId = Number(c.req.param('id'));

  const existing = await db.prepare('SELECT * FROM commission_policies WHERE commission_policy_id = ?').bind(policyId).first();
  if (!existing) return c.json({ error: '수수료 정책을 찾을 수 없습니다.' }, 404);

  await db.prepare('DELETE FROM commission_policies WHERE commission_policy_id = ?').bind(policyId).run();

  await writeAuditLog(db, {
    entity_type: 'COMMISSION_POLICY', entity_id: policyId,
    action: 'DELETE', actor_id: user.user_id,
    detail_json: JSON.stringify(existing)
  });

  return c.json({ ok: true, message: '수수료 정책이 삭제되었습니다.' });
});

export default hr;
