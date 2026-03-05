// ================================================================
// 와이비 OMS — 주문 채널 관리 API + 대리점 관리 API
// Phase 7.0: 다채널 원장 + AGENCY_LEADER 계층
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { createNotification } from '../../services/notification-service';

export function mountChannels(router: Hono<Env>) {

  // ─── 채널 목록 ───
  router.get('/channels', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const db = c.env.DB;
    const { active_only } = c.req.query();
    
    let query = 'SELECT * FROM order_channels';
    if (active_only === '1') query += ' WHERE is_active = 1';
    query += ' ORDER BY priority DESC, name';

    const result = await db.prepare(query).all();

    // 각 채널별 주문 수 통계
    const stats = await db.prepare(`
      SELECT channel_id, COUNT(*) as order_count, 
             COALESCE(SUM(base_amount), 0) as total_amount
      FROM orders WHERE channel_id IS NOT NULL
      GROUP BY channel_id
    `).all();
    const statsMap: Record<number, any> = {};
    for (const s of stats.results as any[]) { statsMap[s.channel_id] = s; }

    const channels = result.results.map((ch: any) => ({
      ...ch,
      order_count: statsMap[ch.channel_id]?.order_count || 0,
      total_amount: statsMap[ch.channel_id]?.total_amount || 0,
    }));

    return c.json({ channels });
  });

  // ─── 채널 생성 ───
  router.post('/channels', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();

    if (!body.name || !body.code) return c.json({ error: '채널명과 코드는 필수입니다.' }, 400);
    if (!/^[A-Z0-9_]{2,30}$/.test(body.code)) return c.json({ error: '코드는 영문대문자/숫자/밑줄 2~30자입니다.' }, 400);

    const dup = await db.prepare('SELECT channel_id FROM order_channels WHERE code = ?').bind(body.code).first();
    if (dup) return c.json({ error: '이미 사용 중인 채널 코드입니다.' }, 409);

    const result = await db.prepare(`
      INSERT INTO order_channels (name, code, description, contact_info, is_active, priority)
      VALUES (?, ?, ?, ?, 1, ?)
    `).bind(body.name, body.code, body.description || null, body.contact_info || null, body.priority || 0).run();

    await writeAuditLog(db, {
      entity_type: 'CHANNEL', entity_id: result.meta.last_row_id as number,
      action: 'CHANNEL.CREATED', actor_id: user.user_id,
      detail_json: JSON.stringify({ name: body.name, code: body.code }),
    });

    return c.json({ channel_id: result.meta.last_row_id }, 201);
  });

  // ─── 채널 수정 ───
  router.put('/channels/:channel_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const channelId = Number(c.req.param('channel_id'));
    const body = await c.req.json();

    const existing = await db.prepare('SELECT * FROM order_channels WHERE channel_id = ?').bind(channelId).first();
    if (!existing) return c.json({ error: '채널을 찾을 수 없습니다.' }, 404);

    await db.prepare(`
      UPDATE order_channels SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        contact_info = COALESCE(?, contact_info),
        is_active = COALESCE(?, is_active),
        priority = COALESCE(?, priority),
        updated_at = datetime('now')
      WHERE channel_id = ?
    `).bind(
      body.name || null, body.description || null, body.contact_info || null,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : null,
      body.priority !== undefined ? body.priority : null,
      channelId
    ).run();

    await writeAuditLog(db, {
      entity_type: 'CHANNEL', entity_id: channelId, action: 'CHANNEL.UPDATED',
      actor_id: user.user_id, detail_json: JSON.stringify(body),
    });

    return c.json({ ok: true });
  });
}

// ════════════════════════════════════════════════════════
// 대리점(AGENCY) 관리 API
// ════════════════════════════════════════════════════════

export function mountAgency(router: Hono<Env>) {

  // ─── 대리점 목록 (AGENCY_LEADER 역할 가진 팀장들) ───
  router.get('/agencies', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;

    let scopeWhere = '';
    const params: any[] = [];

    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      scopeWhere = 'AND u.org_id IN (SELECT org_id FROM organizations WHERE parent_org_id = ? OR org_id = ?)';
      params.push(user.org_id, user.org_id);
    }

    const result = await db.prepare(`
      SELECT u.user_id, u.name, u.phone, u.login_id, u.org_id,
             o.name as org_name, o.parent_org_id,
             po.name as region_name,
             (SELECT COUNT(*) FROM agency_team_mappings atm WHERE atm.agency_user_id = u.user_id) as team_count
      FROM users u
      JOIN user_roles ur ON u.user_id = ur.user_id
      JOIN roles r ON ur.role_id = r.role_id
      JOIN organizations o ON u.org_id = o.org_id
      LEFT JOIN organizations po ON o.parent_org_id = po.org_id
      WHERE r.code = 'AGENCY_LEADER' AND u.status = 'ACTIVE' ${scopeWhere}
      ORDER BY po.name, u.name
    `).bind(...params).all();

    return c.json({ agencies: result.results });
  });

  // ─── 대리점 상세 (하위 팀장 목록 포함) ───
  router.get('/agencies/:user_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'AGENCY_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const agencyUserId = Number(c.req.param('user_id'));

    // AGENCY_LEADER는 자기 자신만 조회 가능
    if (user.roles.includes('AGENCY_LEADER') && !user.roles.includes('SUPER_ADMIN') && user.user_id !== agencyUserId) {
      return c.json({ error: '자신의 대리점 정보만 조회할 수 있습니다.' }, 403);
    }

    const agency = await db.prepare(`
      SELECT u.user_id, u.name, u.phone, u.login_id, u.org_id,
             o.name as org_name, o.parent_org_id, po.name as region_name
      FROM users u
      JOIN organizations o ON u.org_id = o.org_id
      LEFT JOIN organizations po ON o.parent_org_id = po.org_id
      WHERE u.user_id = ?
    `).bind(agencyUserId).first();
    if (!agency) return c.json({ error: '대리점을 찾을 수 없습니다.' }, 404);

    const teamMembers = await db.prepare(`
      SELECT u.user_id, u.name, u.phone, u.login_id, u.org_id, u.status,
             o.name as org_name,
             atm.created_at as mapped_at,
             (SELECT COUNT(*) FROM order_assignments oa WHERE oa.team_leader_id = u.user_id AND oa.status NOT IN ('REASSIGNED')) as active_orders
      FROM agency_team_mappings atm
      JOIN users u ON atm.team_user_id = u.user_id
      JOIN organizations o ON u.org_id = o.org_id
      WHERE atm.agency_user_id = ?
      ORDER BY u.name
    `).bind(agencyUserId).all();

    return c.json({ agency, team_members: teamMembers.results });
  });

  // ─── 팀장에게 대리점 권한 부여 ───
  router.post('/agencies/promote', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { user_id } = await c.req.json();

    if (!user_id) return c.json({ error: '사용자 ID는 필수입니다.' }, 400);

    // 대상 사용자가 TEAM_LEADER인지 확인
    const target = await db.prepare(`
      SELECT u.user_id, u.name, u.org_id, o.parent_org_id 
      FROM users u JOIN organizations o ON u.org_id = o.org_id
      WHERE u.user_id = ? AND u.status = 'ACTIVE'
    `).bind(user_id).first();
    if (!target) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

    // Scope 검증: REGION은 자기 하위 팀만
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      if (target.parent_org_id !== user.org_id) {
        return c.json({ error: '자기 총판 하위 팀장만 대리점 지정할 수 있습니다.' }, 403);
      }
    }

    const existingRole = await db.prepare(`
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id 
      WHERE ur.user_id = ? AND r.code = 'AGENCY_LEADER'
    `).bind(user_id).first();
    if (existingRole) return c.json({ error: '이미 대리점 권한이 있습니다.' }, 409);

    // AGENCY_LEADER 역할 추가 (TEAM_LEADER 유지)
    const roleRow = await db.prepare("SELECT role_id FROM roles WHERE code = 'AGENCY_LEADER'").first();
    if (roleRow) {
      await db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(user_id, roleRow.role_id).run();
    }

    await createNotification(db, user_id, {
      type: 'AGENCY_PROMOTED',
      title: '대리점 권한 부여',
      message: '대리점장 권한이 부여되었습니다. 하위 팀장 배정이 가능합니다.',
    });

    await writeAuditLog(db, {
      entity_type: 'USER', entity_id: user_id, action: 'AGENCY.PROMOTED',
      actor_id: user.user_id, detail_json: JSON.stringify({ target_name: target.name }),
    });

    return c.json({ ok: true, message: `${target.name}님에게 대리점 권한이 부여되었습니다.` });
  });

  // ─── 대리점 권한 해제 ───
  router.post('/agencies/demote', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { user_id } = await c.req.json();
    if (!user_id) return c.json({ error: '사용자 ID는 필수입니다.' }, 400);

    // AGENCY_LEADER 역할 제거
    await db.prepare(`
      DELETE FROM user_roles WHERE user_id = ? AND role_id = (SELECT role_id FROM roles WHERE code = 'AGENCY_LEADER')
    `).bind(user_id).run();

    // 하위 팀장 매핑 제거
    await db.prepare('DELETE FROM agency_team_mappings WHERE agency_user_id = ?').bind(user_id).run();

    await createNotification(db, user_id, {
      type: 'AGENCY_DEMOTED',
      title: '대리점 권한 해제',
      message: '대리점장 권한이 해제되었습니다.',
    });

    await writeAuditLog(db, {
      entity_type: 'USER', entity_id: user_id, action: 'AGENCY.DEMOTED',
      actor_id: user.user_id,
    });

    return c.json({ ok: true });
  });

  // ─── 대리점에 팀장 추가 ───
  router.post('/agencies/:agency_id/add-team', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const agencyUserId = Number(c.req.param('agency_id'));
    const { team_user_id } = await c.req.json();

    if (!team_user_id) return c.json({ error: '팀장 사용자 ID는 필수입니다.' }, 400);

    // 대리점장 검증
    const isAgency = await db.prepare(`
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id
      WHERE ur.user_id = ? AND r.code = 'AGENCY_LEADER'
    `).bind(agencyUserId).first();
    if (!isAgency) return c.json({ error: '대리점장이 아닙니다.' }, 400);

    // 팀장 검증
    const teamUser = await db.prepare('SELECT user_id, name FROM users WHERE user_id = ? AND status = ?').bind(team_user_id, 'ACTIVE').first();
    if (!teamUser) return c.json({ error: '팀장을 찾을 수 없습니다.' }, 404);

    // 이미 다른 대리점에 소속되어 있는지 확인
    const existing = await db.prepare(
      'SELECT agency_user_id FROM agency_team_mappings WHERE team_user_id = ?'
    ).bind(team_user_id).first();
    if (existing) return c.json({ error: '이미 다른 대리점에 소속된 팀장입니다. 먼저 해제하세요.' }, 409);

    await db.prepare(
      'INSERT OR IGNORE INTO agency_team_mappings (agency_user_id, team_user_id) VALUES (?, ?)'
    ).bind(agencyUserId, team_user_id).run();

    await writeAuditLog(db, {
      entity_type: 'USER', entity_id: agencyUserId, action: 'AGENCY.TEAM_ADDED',
      actor_id: user.user_id, detail_json: JSON.stringify({ team_user_id, team_name: teamUser.name }),
    });

    return c.json({ ok: true });
  });

  // ─── 대리점에서 팀장 제거 ───
  router.post('/agencies/:agency_id/remove-team', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const agencyUserId = Number(c.req.param('agency_id'));
    const { team_user_id } = await c.req.json();
    if (!team_user_id) return c.json({ error: '팀장 사용자 ID는 필수입니다.' }, 400);

    await db.prepare(
      'DELETE FROM agency_team_mappings WHERE agency_user_id = ? AND team_user_id = ?'
    ).bind(agencyUserId, team_user_id).run();

    await writeAuditLog(db, {
      entity_type: 'USER', entity_id: agencyUserId, action: 'AGENCY.TEAM_REMOVED',
      actor_id: user.user_id, detail_json: JSON.stringify({ team_user_id }),
    });

    return c.json({ ok: true });
  });

  // ─── 대리점 지정 가능한 팀장 후보 ───
  router.get('/agencies/:agency_id/candidates', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const db = c.env.DB;
    const agencyUserId = Number(c.req.param('agency_id'));

    // 같은 총판 소속 팀장 중 아직 대리점 소속이 아닌 팀장
    const agency = await db.prepare(`
      SELECT o.parent_org_id FROM users u JOIN organizations o ON u.org_id = o.org_id WHERE u.user_id = ?
    `).bind(agencyUserId).first();
    if (!agency) return c.json({ error: '대리점을 찾을 수 없습니다.' }, 404);

    const result = await db.prepare(`
      SELECT u.user_id, u.name, u.phone, u.login_id, o.name as org_name
      FROM users u
      JOIN user_roles ur ON u.user_id = ur.user_id
      JOIN roles r ON ur.role_id = r.role_id
      JOIN organizations o ON u.org_id = o.org_id
      WHERE r.code = 'TEAM_LEADER' AND u.status = 'ACTIVE'
        AND o.parent_org_id = ?
        AND u.user_id != ?
        AND u.user_id NOT IN (SELECT team_user_id FROM agency_team_mappings)
        AND u.user_id NOT IN (
          SELECT ur2.user_id FROM user_roles ur2 JOIN roles r2 ON ur2.role_id = r2.role_id WHERE r2.code = 'AGENCY_LEADER'
        )
      ORDER BY u.name
    `).bind(agency.parent_org_id, agencyUserId).all();

    return c.json({ candidates: result.results });
  });

  // ─── 대리점 온보딩 목록 조회 ───
  router.get('/agency-onboarding', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { status } = c.req.query();

    let q = `
      SELECT ao.*, u.name as agency_name, u.phone, u.login_id, u.org_id,
             o.name as org_name, o.parent_org_id, po.name as region_name,
             approver.name as approved_by_name
      FROM agency_onboarding ao
      JOIN users u ON ao.agency_user_id = u.user_id
      JOIN organizations o ON u.org_id = o.org_id
      LEFT JOIN organizations po ON o.parent_org_id = po.org_id
      LEFT JOIN users approver ON ao.approved_by = approver.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) { q += ' AND ao.status = ?'; params.push(status); }
    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      q += ' AND o.parent_org_id = ?';
      params.push(user.org_id);
    }
    q += ' ORDER BY ao.created_at DESC';

    const result = await db.prepare(q).bind(...params).all();
    return c.json({ onboarding_requests: result.results });
  });

  // ─── 대리점 온보딩 신청 (팀장 → 대리점 전환 신청) ───
  router.post('/agency-onboarding', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const body = await c.req.json();
    const targetUserId = body.user_id || user.user_id;

    // 이미 AGENCY_LEADER인지 확인
    const existingRole = await db.prepare(`
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.role_id 
      WHERE ur.user_id = ? AND r.code = 'AGENCY_LEADER'
    `).bind(targetUserId).first();
    if (existingRole) return c.json({ error: '이미 대리점 권한이 있습니다.' }, 409);

    // 중복 신청 확인
    const existing = await db.prepare(
      "SELECT id FROM agency_onboarding WHERE agency_user_id = ? AND status = 'PENDING'"
    ).bind(targetUserId).first();
    if (existing) return c.json({ error: '이미 대기중인 온보딩 신청이 있습니다.' }, 409);

    await db.prepare(`
      INSERT INTO agency_onboarding (agency_user_id, status, note) VALUES (?, 'PENDING', ?)
    `).bind(targetUserId, body.note || null).run();

    await writeAuditLog(db, {
      entity_type: 'USER', entity_id: targetUserId, action: 'AGENCY.ONBOARD_REQUEST',
      actor_id: user.user_id, detail_json: JSON.stringify({ note: body.note }),
    });

    return c.json({ ok: true, message: '대리점 온보딩 신청이 접수되었습니다.' }, 201);
  });

  // ─── 대리점 온보딩 승인/반려 ───
  router.put('/agency-onboarding/:id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const onboardId = Number(c.req.param('id'));
    const body = await c.req.json();

    if (!body.status || !['APPROVED', 'REJECTED'].includes(body.status)) {
      return c.json({ error: 'status는 APPROVED 또는 REJECTED입니다.' }, 400);
    }

    const req = await db.prepare("SELECT * FROM agency_onboarding WHERE id = ? AND status = 'PENDING'").bind(onboardId).first() as any;
    if (!req) return c.json({ error: '대기중인 온보딩 신청을 찾을 수 없습니다.' }, 404);

    await db.prepare(`
      UPDATE agency_onboarding SET status = ?, approved_by = ?, note = COALESCE(?, note), updated_at = datetime('now')
      WHERE id = ?
    `).bind(body.status, user.user_id, body.note || null, onboardId).run();

    // 승인 시 자동으로 AGENCY_LEADER 역할 부여
    if (body.status === 'APPROVED') {
      const roleRow = await db.prepare("SELECT role_id FROM roles WHERE code = 'AGENCY_LEADER'").first();
      if (roleRow) {
        await db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(req.agency_user_id, roleRow.role_id).run();
      }

      await createNotification(db, req.agency_user_id, {
        type: 'AGENCY_PROMOTED',
        title: '대리점 온보딩 승인',
        message: '대리점 전환이 승인되었습니다. 하위 팀장 배정이 가능합니다.',
      });
    } else {
      await createNotification(db, req.agency_user_id, {
        type: 'SYSTEM',
        title: '대리점 온보딩 반려',
        message: body.note ? `반려 사유: ${body.note}` : '대리점 전환이 반려되었습니다.',
      });
    }

    await writeAuditLog(db, {
      entity_type: 'USER', entity_id: req.agency_user_id,
      action: body.status === 'APPROVED' ? 'AGENCY.ONBOARD_APPROVED' : 'AGENCY.ONBOARD_REJECTED',
      actor_id: user.user_id, detail_json: JSON.stringify({ onboard_id: onboardId, note: body.note }),
    });

    return c.json({ ok: true, message: `온보딩 ${body.status === 'APPROVED' ? '승인' : '반려'} 처리되었습니다.` });
  });
}
