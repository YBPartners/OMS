// ================================================================
// 다하다 OMS — 수수료(커미션) 정책 관리 라우트
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';

export function mountCommission(router: Hono<Env>) {

  // 수수료 정책 목록 조회
  router.get('/commission-policies', async (c) => {
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

    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      query += ' AND cp.org_id = ?';
      params.push(user.org_id);
    }

    query += ' ORDER BY cp.org_id, cp.team_leader_id NULLS FIRST, cp.effective_from DESC';
    const result = await db.prepare(query).bind(...params).all();
    return c.json({ policies: result.results });
  });

  // 수수료 정책 생성
  router.post('/commission-policies', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청 형식입니다.' }, 400); }

    if (!body.org_id) return c.json({ error: '지역법인은 필수입니다.' }, 400);
    if (!body.mode || !['PERCENT', 'FIXED'].includes(body.mode)) return c.json({ error: '수수료 유형은 PERCENT(정률) 또는 FIXED(정액)입니다.' }, 400);
    if (body.value === undefined || body.value === null || isNaN(Number(body.value)) || Number(body.value) < 0) {
      return c.json({ error: '수수료 값은 0 이상의 숫자여야 합니다.' }, 400);
    }
    if (body.mode === 'PERCENT' && Number(body.value) > 100) {
      return c.json({ error: '요율은 100% 이하여야 합니다.' }, 400);
    }

    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      if (Number(body.org_id) !== user.org_id) {
        return c.json({ error: '자기 법인의 수수료만 설정할 수 있습니다.' }, 403);
      }
    }

    const effectiveFrom = body.effective_from || new Date().toISOString().split('T')[0];
    const teamLeaderId = body.team_leader_id ? Number(body.team_leader_id) : null;

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
  router.put('/commission-policies/:id', async (c) => {
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

    if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
      if (existing.org_id !== user.org_id) {
        return c.json({ error: '자기 법인의 수수료만 수정할 수 있습니다.' }, 403);
      }
    }

    if (body.mode && !['PERCENT', 'FIXED'].includes(body.mode)) return c.json({ error: '수수료 유형은 PERCENT(정률) 또는 FIXED(정액)입니다.' }, 400);
    if (body.value !== undefined && (isNaN(Number(body.value)) || Number(body.value) < 0)) return c.json({ error: '수수료 값은 0 이상의 숫자여야 합니다.' }, 400);
    const mode = body.mode || existing.mode;
    const value = body.value !== undefined ? Number(body.value) : existing.value;
    if (mode === 'PERCENT' && value > 100) return c.json({ error: '요율은 100% 이하여야 합니다.' }, 400);

    await db.prepare(`
      UPDATE commission_policies 
      SET mode = ?, value = ?, effective_from = COALESCE(?, effective_from)
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
  router.delete('/commission-policies/:id', async (c) => {
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
}
