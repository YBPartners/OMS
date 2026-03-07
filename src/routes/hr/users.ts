// ================================================================
// Airflow OMS — HR 사용자(인사) 관리 라우트 v2.0
// CRUD / 상태관리 / 비밀번호 / 자격증명 설정
// try-catch 강화: 사용자 관리 핵심 라우트 오류 방어
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { hashPassword, verifyPassword, needsRehash, normalizePhone, isValidPhone, isValidLoginId, isValidEmail, safeAuditDetail } from '../../middleware/security';
import { normalizePagination, isValidRole, canActorModifyTarget, canActorAssignRole, canActorAssignRoles, getHighestRoleLevel } from '../../lib/validators';
import { invalidateUserSessions } from '../../services/session-service';

export function mountUsers(router: Hono<Env>) {

  // ─── 사용자 목록 (조직별 필터 + 역할 포함 + 인증 상태) ───
  router.get('/users', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { org_id, role, status: filterStatus, search, page, limit } = c.req.query();
    const pg = normalizePagination(page, limit, 100);

    const conditions: string[] = ["u.login_id NOT LIKE '__deleted_%'"];
    const params: any[] = [];

    // ★ Scope: REGION은 자기 총판+하위 TEAM, HQ는 전체
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      conditions.push('(u.org_id = ? OR u.org_id IN (SELECT org_id FROM organizations WHERE parent_org_id = ?))');
      params.push(user.org_id, user.org_id);
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
    `).bind(...params, pg.limit, pg.offset).all();

    let users = result.results.map((u: any) => ({
      ...u,
      roles: u.role_codes ? u.role_codes.split(',') : [],
      role_names: u.role_names ? u.role_names.split(',') : [],
    }));

    if (role) {
      users = users.filter((u: any) => u.roles.includes(role));
    }

    return c.json({ users, total: (countResult as any)?.total || 0, page: pg.page, limit: pg.limit });
  });

  // ─── 사용자 상세 ───
  router.get('/users/:user_id', async (c) => {
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

    // ★ Scope: REGION은 자기 총판+하위 TEAM 사용자만
    if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN')) {
      const isOwnOrg = targetUser.org_id === currentUser.org_id;
      const isChildTeam = await db.prepare(
        "SELECT 1 FROM organizations WHERE org_id = ? AND parent_org_id = ? AND org_type = 'TEAM'"
      ).bind(targetUser.org_id, currentUser.org_id).first();
      if (!isOwnOrg && !isChildTeam) return c.json({ error: '권한이 없습니다.' }, 403);
    }

    const roles = await db.prepare(`
      SELECT r.role_id, r.code, r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?
    `).bind(userId).all();

    const recentActivity = await db.prepare(`
      SELECT 
        COUNT(CASE WHEN oa.status NOT IN ('REASSIGNED') THEN 1 END) as total_assigned,
        COUNT(CASE WHEN oa.status = 'HQ_APPROVED' THEN 1 END) as total_approved,
        COUNT(CASE WHEN oa.status = 'SETTLEMENT_CONFIRMED' THEN 1 END) as total_settled,
        COUNT(CASE WHEN oa.status IN ('REGION_REJECTED','HQ_REJECTED') THEN 1 END) as total_rejected
      FROM order_assignments oa WHERE oa.team_leader_id = ?
    `).bind(userId).first();

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
  router.post('/users', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const currentUser = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();

    if (!body.name) return c.json({ error: '이름은 필수입니다.' }, 400);
    if (!body.phone) return c.json({ error: '핸드폰 번호는 필수입니다.' }, 400);
    if (!body.org_id) return c.json({ error: '소속 조직은 필수입니다.' }, 400);
    if (!body.role) return c.json({ error: '역할은 필수입니다.' }, 400);

    if (body.name.length > 50) return c.json({ error: '이름은 50자 이하로 입력하세요.' }, 400);
    if (!isValidPhone(body.phone)) return c.json({ error: '올바른 핸드폰 번호를 입력하세요 (01X로 시작하는 10~11자리).' }, 400);
    if (body.email && !isValidEmail(body.email)) return c.json({ error: '올바른 이메일 형식을 입력하세요.' }, 400);

    // ★ Scope: REGION은 자기 총판 + 하위 TEAM에만 등록 가능
    // ★ 계층 검증: 행위자가 부여하려는 역할은 자기보다 하위여야 함
    if (!canActorAssignRole(currentUser.roles, body.role)) {
      return c.json({ error: '자기보다 상위 또는 동급 역할은 부여할 수 없습니다.' }, 403);
    }

    if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN')) {
      const targetOrg = await db.prepare(
        'SELECT org_id, org_type, parent_org_id FROM organizations WHERE org_id = ?'
      ).bind(Number(body.org_id)).first();
      if (!targetOrg) return c.json({ error: '조직을 찾을 수 없습니다.' }, 404);

      const isOwnOrg = Number(body.org_id) === currentUser.org_id;
      const isChildTeam = targetOrg.org_type === 'TEAM' && targetOrg.parent_org_id === currentUser.org_id;
      if (!isOwnOrg && !isChildTeam) {
        return c.json({ error: '자기 총판 또는 하위 팀에만 인원을 등록할 수 있습니다.' }, 403);
      }
      // REGION_ADMIN은 AGENCY_LEADER / TEAM_LEADER만 생성 가능 (자기보다 하위)
      if (!['TEAM_LEADER', 'AGENCY_LEADER'].includes(body.role)) {
        return c.json({ error: '총판 관리자는 팀장 또는 대리점장만 등록할 수 있습니다.' }, 403);
      }
    }

    if (!isValidRole(body.role)) return c.json({ error: '유효하지 않은 역할입니다.' }, 400);

    try {
      const phoneDup = await db.prepare('SELECT user_id, name FROM users WHERE phone = ? AND status = ?').bind(normalizePhone(body.phone), 'ACTIVE').first();
      if (phoneDup) return c.json({ error: `이미 등록된 핸드폰 번호입니다. (${(phoneDup as any).name})` }, 409);

      let loginId = body.login_id;
      if (loginId) {
        if (!isValidLoginId(loginId)) return c.json({ error: '로그인 ID는 영문/숫자/밑줄로 3~50자입니다.' }, 400);
      } else {
        const phoneLast4 = normalizePhone(body.phone).slice(-4);
        loginId = `user_${phoneLast4}_${Date.now().toString(36).slice(-4)}`;
      }

      const loginDup = await db.prepare('SELECT user_id FROM users WHERE login_id = ?').bind(loginId).first();
      if (loginDup) return c.json({ error: '이미 사용 중인 아이디입니다.' }, 409);

      const initialPassword = body.password || normalizePhone(body.phone).slice(-4) + '!';
      if (initialPassword.length < 4) return c.json({ error: '비밀번호는 최소 4자 이상이어야 합니다.' }, 400);
      
      const passwordHash = await hashPassword(initialPassword);

      const result = await db.prepare(`
        INSERT INTO users (org_id, login_id, password_hash, name, phone, email, status, phone_verified, joined_at, memo)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', 0, datetime('now'), ?)
      `).bind(
        Number(body.org_id), loginId, passwordHash,
        body.name, normalizePhone(body.phone), body.email || null, body.memo || null
      ).run();

      const newUserId = result.meta.last_row_id as number;

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
    } catch (err: any) {
      console.error('[users] 사용자 등록 실패:', err.message);
      return c.json({ error: '사용자 등록 중 오류가 발생했습니다.', code: 'USER_ERROR' }, 500);
    }
  });

  // ─── 사용자 정보 수정 ───
  router.put('/users/:user_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const currentUser = c.get('user')!;
    const db = c.env.DB;
    const userId = Number(c.req.param('user_id'));
    if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

    const body = await c.req.json();

    const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
    if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

    // ★ 계층 검증: 대상 사용자의 현재 역할이 행위자보다 하위인지 확인
    const targetRolesResult = await db.prepare(
      'SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?'
    ).bind(userId).all();
    const targetRoleCodes = targetRolesResult.results.map((r: any) => r.code);
    if (!canActorModifyTarget(currentUser.roles, targetRoleCodes)) {
      return c.json({ error: '상위 또는 동급 권한의 사용자를 수정할 수 없습니다.' }, 403);
    }

    if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN')) {
      const isOwnOrg = target.org_id === currentUser.org_id;
      const isChildTeam = await db.prepare(
        "SELECT 1 FROM organizations WHERE org_id = ? AND parent_org_id = ? AND org_type = 'TEAM'"
      ).bind(target.org_id, currentUser.org_id).first();
      if (!isOwnOrg && !isChildTeam) return c.json({ error: '권한이 없습니다.' }, 403);
    }

    if (body.phone && !isValidPhone(body.phone)) return c.json({ error: '올바른 핸드폰 번호를 입력하세요.' }, 400);
    if (body.email && !isValidEmail(body.email)) return c.json({ error: '올바른 이메일 형식을 입력하세요.' }, 400);

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

    try {
      if (sets.length > 0) {
        sets.push("updated_at = datetime('now')");
        params.push(userId);
        await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE user_id = ?`).bind(...params).run();
      }

      if (body.role) {
        if (!isValidRole(body.role)) return c.json({ error: '유효하지 않은 역할입니다.' }, 400);
        // ★ 계층 검증: 부여하려는 역할이 행위자보다 하위인지 확인
        if (!canActorAssignRole(currentUser.roles, body.role)) {
          return c.json({ error: '자기보다 상위 또는 동급 역할은 부여할 수 없습니다.' }, 403);
        }
        await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId).run();
        const roleRow = await db.prepare('SELECT role_id FROM roles WHERE code = ?').bind(body.role).first();
        if (roleRow) {
          await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(userId, roleRow.role_id).run();
        }
      }

      await writeAuditLog(db, { entity_type: 'USER', entity_id: userId, action: 'UPDATE', actor_id: currentUser.user_id, detail_json: safeAuditDetail(body) });

      return c.json({ ok: true });
    } catch (err: any) {
      console.error(`[users] 사용자 수정 실패 user_id=${userId}:`, err.message);
      return c.json({ error: '사용자 정보 수정 중 오류가 발생했습니다.', code: 'USER_ERROR' }, 500);
    }
  });

  // ─── 사용자 활성화/비활성화 ───
  router.patch('/users/:user_id/status', async (c) => {
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

    if (userId === currentUser.user_id && status === 'INACTIVE') {
      return c.json({ error: '자기 자신을 비활성화할 수 없습니다.' }, 400);
    }

    // ★ 계층 검증: 대상이 행위자보다 하위인지 확인
    const targetStatusRoles = await db.prepare(
      'SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?'
    ).bind(userId).all();
    const targetStatusRoleCodes = targetStatusRoles.results.map((r: any) => r.code);
    if (!canActorModifyTarget(currentUser.roles, targetStatusRoleCodes)) {
      return c.json({ error: '상위 또는 동급 권한의 사용자 상태를 변경할 수 없습니다.' }, 403);
    }

    if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN') && target.org_id !== currentUser.org_id) {
      return c.json({ error: '권한이 없습니다.' }, 403);
    }

    try {
      await db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE user_id = ?").bind(status, userId).run();

      if (status === 'INACTIVE') {
        // ★ Session Service를 통한 세션 무효화 + KV 캐시 제거 (v2.0)
        await invalidateUserSessions(db, userId, c.env.SESSION_CACHE);
      }

      await writeAuditLog(db, { entity_type: 'USER', entity_id: userId, action: status === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE', actor_id: currentUser.user_id });

      return c.json({ ok: true, message: status === 'ACTIVE' ? '활성화되었습니다.' : '비활성화되었습니다. 해당 사용자는 더 이상 로그인할 수 없습니다.' });
    } catch (err: any) {
      console.error(`[users] 사용자 상태 변경 실패 user_id=${userId}:`, err.message);
      return c.json({ error: '사용자 상태 변경 중 오류가 발생했습니다.', code: 'USER_ERROR' }, 500);
    }
  });

  // ─── 비밀번호 초기화 (관리자) ───
  router.post('/users/:user_id/reset-password', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const currentUser = c.get('user')!;
    const db = c.env.DB;
    const userId = Number(c.req.param('user_id'));
    if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

    const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
    if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

    // ★ 계층 검증: 대상이 행위자보다 하위인지 확인
    const targetPwdRoles = await db.prepare(
      'SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?'
    ).bind(userId).all();
    const targetPwdRoleCodes = targetPwdRoles.results.map((r: any) => r.code);
    if (!canActorModifyTarget(currentUser.roles, targetPwdRoleCodes)) {
      return c.json({ error: '상위 또는 동급 권한의 사용자 비밀번호를 초기화할 수 없습니다.' }, 403);
    }

    if (currentUser.org_type === 'REGION' && !currentUser.roles.includes('SUPER_ADMIN') && target.org_id !== currentUser.org_id) {
      return c.json({ error: '권한이 없습니다.' }, 403);
    }

    const phone = (target.phone as string) || '0000';
    const newPassword = normalizePhone(phone).slice(-4) + '!';
    const passwordHash = await hashPassword(newPassword);

    await db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE user_id = ?").bind(passwordHash, userId).run();
    // ★ Session Service를 통한 세션 무효화 + KV 캐시 제거 (v2.0)
    await invalidateUserSessions(db, userId, c.env.SESSION_CACHE);

    await writeAuditLog(db, { entity_type: 'USER', entity_id: userId, action: 'RESET_PASSWORD', actor_id: currentUser.user_id });

    return c.json({ ok: true, new_password: newPassword, message: `비밀번호가 "${newPassword}"로 초기화되었습니다.` });
  });

  // ─── 비밀번호 변경 (본인) ───
  router.post('/users/change-password', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const currentUser = c.get('user')!;
    const db = c.env.DB;
    const { current_password, new_password } = await c.req.json();

    if (!current_password || !new_password) return c.json({ error: '현재 비밀번호와 새 비밀번호를 입력하세요.' }, 400);
    if (new_password.length < 6) return c.json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' }, 400);
    if (!/[a-zA-Z]/.test(new_password) || !/[0-9]/.test(new_password)) {
      return c.json({ error: '비밀번호는 영문과 숫자를 모두 포함해야 합니다.' }, 400);
    }
    if (current_password === new_password) return c.json({ error: '현재 비밀번호와 다른 새 비밀번호를 입력하세요.' }, 400);

    const userRow = await db.prepare('SELECT password_hash FROM users WHERE user_id = ?').bind(currentUser.user_id).first();
    if (!userRow?.password_hash) return c.json({ error: '사용자 정보를 찾을 수 없습니다.' }, 500);

    const valid = await verifyPassword(current_password, userRow.password_hash as string);
    if (!valid) return c.json({ error: '현재 비밀번호가 틀렸습니다.' }, 401);

    const newHash = await hashPassword(new_password);
    await db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE user_id = ?").bind(newHash, currentUser.user_id).run();

    await writeAuditLog(db, { entity_type: 'USER', entity_id: currentUser.user_id, action: 'CHANGE_PASSWORD', actor_id: currentUser.user_id });

    return c.json({ ok: true, message: '비밀번호가 변경되었습니다.' });
  });

  // ─── ID/PW 직접 설정 (관리자) ───
  router.post('/users/:user_id/set-credentials', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const currentUser = c.get('user')!;
    const db = c.env.DB;
    const userId = Number(c.req.param('user_id'));
    if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

    const { login_id, password } = await c.req.json();

    const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
    if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

    // ★ 계층 검증: 대상이 행위자보다 하위인지 확인
    const targetCredRoles = await db.prepare(
      'SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?'
    ).bind(userId).all();
    const targetCredRoleCodes = targetCredRoles.results.map((r: any) => r.code);
    if (!canActorModifyTarget(currentUser.roles, targetCredRoleCodes)) {
      return c.json({ error: '상위 또는 동급 권한의 사용자 자격증명을 변경할 수 없습니다.' }, 403);
    }

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
      // ★ Session Service를 통한 세션 무효화 + KV 캐시 제거 (v2.0)
      await invalidateUserSessions(db, userId, c.env.SESSION_CACHE);
    }

    await writeAuditLog(db, { entity_type: 'USER', entity_id: userId, action: 'SET_CREDENTIALS', actor_id: currentUser.user_id, detail_json: JSON.stringify({ login_id_changed: !!login_id, password_changed: !!password }) });

    return c.json({ ok: true, message: 'ID/PW가 설정되었습니다.' });
  });

  // ─── 역할 목록 ───
  router.get('/roles', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const result = await c.env.DB.prepare('SELECT * FROM roles ORDER BY role_id').all();
    return c.json({ roles: result.results });
  });

  // ─── 사용자 삭제 (소프트 삭제 — 비활성화 + 논리적 삭제 마킹) ───
  router.delete('/users/:user_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;

    const currentUser = c.get('user')!;
    const db = c.env.DB;
    const userId = Number(c.req.param('user_id'));
    if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

    if (userId === currentUser.user_id) return c.json({ error: '자기 자신은 삭제할 수 없습니다.' }, 400);

    const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first() as any;
    if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

    // 활성 주문 배정이 있는지 확인
    const activeAssignments = await db.prepare(
      "SELECT COUNT(*) as cnt FROM order_assignments WHERE team_leader_id = ? AND status NOT IN ('REASSIGNED','SETTLEMENT_CONFIRMED','PAID')"
    ).bind(userId).first() as any;
    if (activeAssignments?.cnt > 0) {
      return c.json({ error: `진행중인 주문 배정이 ${activeAssignments.cnt}건 있어 삭제할 수 없습니다. 먼저 주문을 재배정하세요.` }, 400);
    }

    try {
      // 소프트 삭제: INACTIVE + login_id 변경(유니크 해제) + 역할 제거 + 세션 무효화
      const deletedLoginId = `__deleted_${userId}_${Date.now().toString(36)}`;
      await db.prepare("UPDATE users SET status = 'INACTIVE', login_id = ?, memo = COALESCE(memo,'') || ' [DELETED:' || ? || ']', updated_at = datetime('now') WHERE user_id = ?")
        .bind(deletedLoginId, target.login_id, userId).run();
      await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId).run();
      await invalidateUserSessions(db, userId, c.env.SESSION_CACHE);

      await writeAuditLog(db, {
        entity_type: 'USER', entity_id: userId, action: 'DELETE',
        actor_id: currentUser.user_id,
        detail_json: JSON.stringify({ name: target.name, login_id: target.login_id, org_id: target.org_id })
      });

      return c.json({ ok: true, message: `사용자 "${target.name}"이(가) 삭제되었습니다.` });
    } catch (err: any) {
      console.error(`[users] 사용자 삭제 실패 user_id=${userId}:`, err.message);
      return c.json({ error: '사용자 삭제 중 오류가 발생했습니다.', code: 'USER_ERROR' }, 500);
    }
  });

  // ─── 다중 역할 할당 (기존 역할 교체 대신 추가/제거) ───
  router.post('/users/:user_id/roles', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const currentUser = c.get('user')!;
    const db = c.env.DB;
    const userId = Number(c.req.param('user_id'));
    if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

    const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
    if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

    const { roles } = await c.req.json();
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return c.json({ error: '하나 이상의 역할을 지정하세요.' }, 400);
    }

    // 유효성 검증
    for (const role of roles) {
      if (!isValidRole(role)) return c.json({ error: `유효하지 않은 역할: ${role}` }, 400);
    }

    // ★ 계층 검증: 대상 사용자의 현재 역할이 행위자보다 하위인지 확인
    const targetMultiRoles = await db.prepare(
      'SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?'
    ).bind(userId).all();
    const targetMultiRoleCodes = targetMultiRoles.results.map((r: any) => r.code);
    if (!canActorModifyTarget(currentUser.roles, targetMultiRoleCodes)) {
      return c.json({ error: '상위 또는 동급 권한의 사용자 역할을 변경할 수 없습니다.' }, 403);
    }

    // ★ 계층 검증: 부여하려는 역할 전체가 행위자보다 하위인지 확인
    if (!canActorAssignRoles(currentUser.roles, roles)) {
      return c.json({ error: '자기보다 상위 또는 동급 역할은 부여할 수 없습니다.' }, 403);
    }

    // 기존 역할 삭제 후 새 역할 삽입
    await db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId).run();
    for (const roleCode of roles) {
      const roleRow = await db.prepare('SELECT role_id FROM roles WHERE code = ?').bind(roleCode).first();
      if (roleRow) {
        await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(userId, roleRow.role_id).run();
      }
    }

    await writeAuditLog(db, {
      entity_type: 'USER', entity_id: userId, action: 'ROLES_CHANGED',
      actor_id: currentUser.user_id,
      detail_json: JSON.stringify({ roles })
    });

    return c.json({ ok: true, roles, message: `역할이 [${roles.join(', ')}]로 변경되었습니다.` });
  });

  // ─── 사용자 조직 이동 ───
  router.post('/users/:user_id/transfer', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;

    const currentUser = c.get('user')!;
    const db = c.env.DB;
    const userId = Number(c.req.param('user_id'));
    if (isNaN(userId)) return c.json({ error: '유효하지 않은 사용자 ID입니다.' }, 400);

    const { org_id } = await c.req.json();
    if (!org_id) return c.json({ error: '이동할 조직 ID를 입력하세요.' }, 400);

    const target = await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first() as any;
    if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

    const targetOrg = await db.prepare('SELECT * FROM organizations WHERE org_id = ?').bind(Number(org_id)).first();
    if (!targetOrg) return c.json({ error: '이동할 조직을 찾을 수 없습니다.' }, 404);

    const prevOrgId = target.org_id;
    await db.prepare("UPDATE users SET org_id = ?, updated_at = datetime('now') WHERE user_id = ?").bind(Number(org_id), userId).run();

    await writeAuditLog(db, {
      entity_type: 'USER', entity_id: userId, action: 'TRANSFER',
      actor_id: currentUser.user_id,
      detail_json: JSON.stringify({ from_org_id: prevOrgId, to_org_id: Number(org_id), name: target.name })
    });

    return c.json({ ok: true, message: `"${target.name}"이(가) "${(targetOrg as any).name}"으로 이동되었습니다.` });
  });
}
