import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth, writeAuditLog } from '../middleware/auth';
import { verifyPassword, needsRehash, hashPassword, checkRateLimit, rateLimitMap } from '../middleware/security';
import { createSession, deleteSession, cleanExpiredSessions } from '../services/session-service';

const auth = new Hono<Env>();

// 로그인
auth.post('/login', async (c) => {
  const db = c.env.DB;

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: '잘못된 요청 형식입니다.' }, 400);
  }

  const { login_id, password } = body;
  if (!login_id || !password) return c.json({ error: '아이디와 비밀번호를 입력하세요.' }, 400);

  // Rate Limiting: 로그인 시도 - IP(또는 login_id)당 1분에 10회
  const rlKey = `login:${login_id}`;
  const rl = checkRateLimit(rlKey, 10, 60_000);
  if (!rl.ok) {
    return c.json({ error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.' }, 429);
  }

  const user = await db.prepare(`
    SELECT u.user_id, u.org_id, u.login_id, u.name, u.password_hash, o.org_type, o.name as org_name, o.code as org_code
    FROM users u JOIN organizations o ON u.org_id = o.org_id
    WHERE u.login_id = ? AND u.status = 'ACTIVE'
  `).bind(login_id).first();

  if (!user || !user.password_hash) {
    return c.json({ error: '아이디 또는 비밀번호가 틀렸습니다.' }, 401);
  }

  // 계정 잠금 확인 (5회 실패 시 5분 잠금) — 검사만 하고 카운트 증가 안 함
  const failKey = `login_fail:${login_id}`;
  const failEntry = rateLimitMap.get(failKey);
  const now = Date.now();
  if (failEntry && now <= failEntry.resetAt && failEntry.count >= 5) {
    const retryMin = Math.ceil((failEntry.resetAt - now) / 60000);
    return c.json({ error: `로그인 시도 초과로 계정이 잠겼습니다. ${retryMin}분 후 다시 시도하세요.` }, 423);
  }

  // PBKDF2 검증 (레거시 SHA-256도 자동 호환)
  const valid = await verifyPassword(password, user.password_hash as string);
  if (!valid) {
    // 실패 시에만 카운트 증가
    checkRateLimit(failKey, 5, 300_000);
    await writeAuditLog(db, { entity_type: 'USER', entity_id: user.user_id as number, action: 'LOGIN_FAILED', detail_json: JSON.stringify({ login_id }) });
    return c.json({ error: '아이디 또는 비밀번호가 틀렸습니다.' }, 401);
  }

  // 로그인 성공 시 실패 카운트 초기화
  rateLimitMap.delete(failKey);

  // 레거시 해시 → PBKDF2 자동 마이그레이션 (투명하게)
  if (needsRehash(user.password_hash as string)) {
    try {
      const newHash = await hashPassword(password);
      await db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE user_id = ?")
        .bind(newHash, user.user_id).run();
    } catch {
      // 마이그레이션 실패해도 로그인은 진행
    }
  }

  // 역할 조회
  const roles = await db.prepare(`
    SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?
  `).bind(user.user_id).all();

  const roleCodes = roles.results.map((r: any) => r.code);
  const isAgency = roleCodes.includes('AGENCY_LEADER');

  // 대리점장인 경우 하위 팀장 목록 조회
  let agencyTeamIds: number[] | undefined;
  if (isAgency) {
    const teamMappings = await db.prepare(
      'SELECT team_user_id FROM agency_team_mappings WHERE agency_user_id = ?'
    ).bind(user.user_id).all();
    agencyTeamIds = teamMappings.results.map((r: any) => r.team_user_id as number);
  }

  // ★ Session Service를 통한 세션 생성 + KV 캐시 (v2.0)
  const { sessionId, expiresAt } = await createSession(db, user.user_id as number, 5, c.env.SESSION_CACHE);

  await writeAuditLog(db, { entity_type: 'USER', entity_id: user.user_id as number, action: 'LOGIN', actor_id: user.user_id as number });

  // 만료 세션 주기적 정리 (10% 확률로, 성능 영향 최소화)
  if (Math.random() < 0.1) {
    cleanExpiredSessions(db).catch(() => {});
  }

  const setCookie = `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
  
  return c.json({
    session_id: sessionId,
    user: {
      user_id: user.user_id,
      org_id: user.org_id,
      org_type: user.org_type,
      org_name: user.org_name,
      org_code: user.org_code || '',
      login_id: user.login_id,
      name: user.name,
      roles: roleCodes,
      is_agency: isAgency,
      agency_team_ids: agencyTeamIds,
    }
  }, 200, { 'Set-Cookie': setCookie });
});

// 로그아웃
auth.post('/logout', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ ok: true });

  // X-Session-Id 헤더 또는 Cookie에서 session_id 추출
  const sessionId = c.req.header('X-Session-Id') || getSessionCookie(c);
  if (sessionId) {
    // ★ Session Service를 통한 세션 삭제 + KV 캐시 제거 (v2.0)
    await deleteSession(c.env.DB, sessionId, c.env.SESSION_CACHE);
  }
  return c.json({ ok: true }, 200, { 'Set-Cookie': 'session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
});

// ─── 쿠키에서 session_id 추출 헬퍼 ───
function getSessionCookie(c: any): string {
  const cookie = c.req.header('Cookie');
  if (!cookie) return '';
  const match = cookie.match(/(^| )session_id=([^;]+)/);
  return match ? match[2] : '';
}

// 현재 사용자 정보
auth.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '인증이 필요합니다.' }, 401);
  
  const org = await c.env.DB.prepare('SELECT * FROM organizations WHERE org_id = ?').bind(user.org_id).first();
  return c.json({ user: { ...user, org_name: user.org_name || (org as any)?.name, org_code: (org as any)?.code || '' }, organization: org });
});

// 사용자 목록 (HQ/REGION 관리자)
auth.get('/users', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const orgFilter = user.org_type === 'REGION' ? 'AND u.org_id = ?' : '';
  const params: any[] = [];
  if (user.org_type === 'REGION') params.push(user.org_id);

  const result = await db.prepare(`
    SELECT u.user_id, u.org_id, u.login_id, u.name, u.phone, u.email, u.status,
           o.name as org_name, o.org_type,
           GROUP_CONCAT(r.code) as role_codes
    FROM users u
    JOIN organizations o ON u.org_id = o.org_id
    LEFT JOIN user_roles ur ON u.user_id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.role_id
    WHERE 1=1 ${orgFilter}
    GROUP BY u.user_id
    ORDER BY u.org_id, u.name
  `).bind(...params).all();

  return c.json({ users: result.results.map((u: any) => ({ ...u, roles: u.role_codes ? u.role_codes.split(',') : [] })) });
});

// 조직 목록
auth.get('/organizations', async (c) => {
  const authErr = requireAuth(c);
  if (authErr) return authErr;

  const result = await c.env.DB.prepare('SELECT * FROM organizations ORDER BY org_type, name').all();
  return c.json({ organizations: result.results });
});

// 팀장 목록 (지역법인별)
auth.get('/team-leaders', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const orgId = c.req.query('org_id') || (user.org_type === 'REGION' ? String(user.org_id) : null);
  
  let query = `
    SELECT u.user_id, u.name, u.phone, u.org_id, o.name as org_name
    FROM users u
    JOIN organizations o ON u.org_id = o.org_id
    JOIN user_roles ur ON u.user_id = ur.user_id
    JOIN roles r ON ur.role_id = r.role_id
    WHERE r.code = 'TEAM_LEADER' AND u.status = 'ACTIVE'
  `;
  const params: any[] = [];
  
  if (orgId) {
    // 팀장의 소속 org가 직접 orgId이거나, 팀의 parent_org_id가 orgId인 경우
    query += ' AND (u.org_id = ? OR o.parent_org_id = ?)';
    params.push(Number(orgId), Number(orgId));
  }
  query += ' ORDER BY o.name, u.name';

  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ team_leaders: result.results });
});

export default auth;
