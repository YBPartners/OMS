import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth, writeAuditLog } from '../middleware/auth';

const auth = new Hono<Env>();

// 로그인
auth.post('/login', async (c) => {
  const { login_id, password } = await c.req.json();
  if (!login_id || !password) return c.json({ error: '아이디와 비밀번호를 입력하세요.' }, 400);

  const db = c.env.DB;
  
  // 간이 해시 (SHA-256: 실운영시 bcrypt/argon2 권장)
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const user = await db.prepare(`
    SELECT u.user_id, u.org_id, u.login_id, u.name, u.password_hash, o.org_type
    FROM users u JOIN organizations o ON u.org_id = o.org_id
    WHERE u.login_id = ? AND u.status = 'ACTIVE'
  `).bind(login_id).first();

  if (!user || user.password_hash !== passwordHash) {
    return c.json({ error: '아이디 또는 비밀번호가 틀렸습니다.' }, 401);
  }

  // 역할 조회
  const roles = await db.prepare(`
    SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id WHERE ur.user_id = ?
  `).bind(user.user_id).all();

  // 세션 생성
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  await db.prepare(`INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(sessionId, user.user_id, expiresAt).run();

  await writeAuditLog(db, { entity_type: 'USER', entity_id: user.user_id as number, action: 'LOGIN', actor_id: user.user_id as number });

  const setCookie = `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
  
  return c.json({
    session_id: sessionId,
    user: {
      user_id: user.user_id,
      org_id: user.org_id,
      org_type: user.org_type,
      login_id: user.login_id,
      name: user.name,
      roles: roles.results.map((r: any) => r.code),
    }
  }, 200, { 'Set-Cookie': setCookie });
});

// 로그아웃
auth.post('/logout', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ ok: true });

  const sessionId = c.req.header('X-Session-Id') || '';
  if (sessionId) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE session_id = ?').bind(sessionId).run();
  }
  return c.json({ ok: true }, 200, { 'Set-Cookie': 'session_id=; Path=/; Max-Age=0' });
});

// 현재 사용자 정보
auth.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '인증이 필요합니다.' }, 401);
  
  const org = await c.env.DB.prepare('SELECT * FROM organizations WHERE org_id = ?').bind(user.org_id).first();
  return c.json({ user, organization: org });
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
    query += ' AND u.org_id = ?';
    params.push(Number(orgId));
  }
  query += ' ORDER BY o.name, u.name';

  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ team_leaders: result.results });
});

export default auth;
