// ================================================================
// Airflow OMS — 추가 지역 요청 API v5.0
// 팀/총판 범위 밖 구역 승인/반려 + 충돌 관리
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { notifyRegionAddComplete } from '../../services/notification-service';
import { normalizePagination } from '../../lib/validators';

const regionAdd = new Hono<Env>();

// ─── 추가 지역 요청 목록 (관리자용) ───
regionAdd.get('/region-add-requests', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { status: filterStatus, distributor_org_id, signup_request_id, page, limit } = c.req.query();
  const pg = normalizePagination(page, limit);

  let query = `
    SELECT rar.*,
           ar.sido, ar.sigungu, ar.eupmyeondong, ar.full_name as region_name, ar.admin_code,
           d.name as distributor_name, d.code as distributor_code,
           co.name as conflict_org_name,
           sr.name as applicant_name, sr.team_name,
           rv.name as reviewer_name
    FROM region_add_requests rar
    JOIN admin_regions ar ON rar.region_id = ar.region_id
    JOIN organizations d ON rar.distributor_org_id = d.org_id
    LEFT JOIN organizations co ON rar.conflict_org_id = co.org_id
    LEFT JOIN signup_requests sr ON rar.signup_request_id = sr.request_id
    LEFT JOIN users rv ON rar.reviewed_by = rv.user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Scope: REGION_ADMIN은 자기 총판의 요청만
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN')) {
    query += ' AND rar.distributor_org_id = ?';
    params.push(user.org_id);
  }

  if (filterStatus) { query += ' AND rar.status = ?'; params.push(filterStatus); }
  if (distributor_org_id) { query += ' AND rar.distributor_org_id = ?'; params.push(Number(distributor_org_id)); }
  if (signup_request_id) { query += ' AND rar.signup_request_id = ?'; params.push(Number(signup_request_id)); }

  // Count
  const countSql = query.replace(/SELECT rar\.\*[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
  const countResult = await db.prepare(countSql).bind(...params).first();

  query += ' ORDER BY rar.created_at DESC LIMIT ? OFFSET ?';
  const result = await db.prepare(query).bind(...params, pg.limit, pg.offset).all();

  return c.json({
    requests: result.results,
    total: (countResult as any)?.total || 0,
    page: pg.page,
    limit: pg.limit,
  });
});

// ─── 추가 지역 요청 상세 ───
regionAdd.get('/region-add-requests/:request_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const requestId = Number(c.req.param('request_id'));

  const request = await db.prepare(`
    SELECT rar.*,
           ar.sido, ar.sigungu, ar.eupmyeondong, ar.full_name as region_name, ar.admin_code,
           d.name as distributor_name,
           co.name as conflict_org_name,
           sr.name as applicant_name, sr.team_name, sr.phone as applicant_phone,
           sr.status as signup_status
    FROM region_add_requests rar
    JOIN admin_regions ar ON rar.region_id = ar.region_id
    JOIN organizations d ON rar.distributor_org_id = d.org_id
    LEFT JOIN organizations co ON rar.conflict_org_id = co.org_id
    LEFT JOIN signup_requests sr ON rar.signup_request_id = sr.request_id
    WHERE rar.request_id = ?
  `).bind(requestId).first();

  if (!request) return c.json({ error: '요청을 찾을 수 없습니다.' }, 404);

  // Scope 체크
  if (user.org_type === 'REGION' && !user.roles.includes('SUPER_ADMIN') && request.distributor_org_id !== user.org_id) {
    return c.json({ error: '권한이 없습니다.' }, 403);
  }

  // 해당 구역을 현재 매핑한 조직 정보
  const currentMapping = await db.prepare(`
    SELECT orm.org_id, o.name as org_name, o.org_type, o.code
    FROM org_region_mappings orm
    JOIN organizations o ON orm.org_id = o.org_id
    WHERE orm.region_id = ?
  `).bind(request.region_id).all();

  return c.json({
    request,
    current_mappings: currentMapping.results,
  });
});

// ─── 추가 지역 요청 승인 (SUPER_ADMIN / HQ_OPERATOR만) ───
regionAdd.post('/region-add-requests/:request_id/approve', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const requestId = Number(c.req.param('request_id'));

  const request = await db.prepare(
    "SELECT * FROM region_add_requests WHERE request_id = ? AND status IN ('PENDING', 'CONFLICT')"
  ).bind(requestId).first();
  if (!request) return c.json({ error: '승인 가능한 요청이 아닙니다.' }, 400);

  // 충돌 상태인 경우: 기존 매핑 해제 옵션
  const body = await c.req.json().catch(() => ({}));
  const removeConflict = body.remove_conflict === true;

  if (request.status === 'CONFLICT' && request.conflict_org_id && removeConflict) {
    // 기존 매핑 해제
    await db.prepare(
      'DELETE FROM org_region_mappings WHERE org_id = ? AND region_id = ?'
    ).bind(request.conflict_org_id, request.region_id).run();

    await writeAuditLog(db, {
      entity_type: 'REGION_MAPPING', entity_id: request.region_id as number,
      action: 'REGION.UNMAPPED', actor_id: user.user_id,
      detail_json: JSON.stringify({
        removed_org_id: request.conflict_org_id,
        reason: `추가 지역 요청 #${requestId} 승인에 의한 매핑 해제`,
      }),
    });
  }

  // 총판에 구역 매핑 추가
  await db.prepare(
    'INSERT OR IGNORE INTO org_region_mappings (org_id, region_id, mapped_by) VALUES (?, ?, ?)'
  ).bind(request.distributor_org_id, request.region_id, user.user_id).run();

  // 팀이 있으면 팀에도 매핑
  if (request.team_org_id) {
    await db.prepare(
      'INSERT OR IGNORE INTO org_region_mappings (org_id, region_id, mapped_by) VALUES (?, ?, ?)'
    ).bind(request.team_org_id, request.region_id, user.user_id).run();
  }

  // 요청 상태 업데이트
  await db.prepare(`
    UPDATE region_add_requests SET status = 'APPROVED', reviewed_by = ?, reviewed_at = datetime('now')
    WHERE request_id = ?
  `).bind(user.user_id, requestId).run();

  // 가입 신청에 연결된 경우, signup_request_regions 업데이트
  if (request.signup_request_id) {
    await db.prepare(`
      UPDATE signup_request_regions SET is_within_distributor = 1
      WHERE request_id = ? AND region_id = ?
    `).bind(request.signup_request_id, request.region_id).run();

    // 해당 가입 신청의 모든 추가 지역 요청이 처리되었는지 확인
    const pendingCount = await db.prepare(`
      SELECT COUNT(*) as cnt FROM region_add_requests
      WHERE signup_request_id = ? AND status IN ('PENDING', 'CONFLICT')
    `).bind(request.signup_request_id).first();

    if ((pendingCount as any)?.cnt === 0) {
      // 모든 추가 지역 요청이 처리됨 → 알림
      const signupReq = await db.prepare(
        'SELECT name, phone FROM signup_requests WHERE request_id = ?'
      ).bind(request.signup_request_id).first();

      // ★ Notification Service를 통한 알림 생성 (교차 도메인 분리)
      await notifyRegionAddComplete(db, request.distributor_org_id as number, {
        signupRequestId: request.signup_request_id as number,
        applicantName: (signupReq as any)?.name || '신청자',
      });
    }
  }

  await writeAuditLog(db, {
    entity_type: 'REGION_ADD_REQUEST', entity_id: requestId,
    action: 'REGION.MAPPED', actor_id: user.user_id,
    detail_json: JSON.stringify({
      distributor_org_id: request.distributor_org_id,
      region_id: request.region_id,
      had_conflict: request.status === 'CONFLICT',
      removed_conflict: removeConflict,
    }),
  });

  return c.json({
    ok: true,
    request_id: requestId,
    message: '추가 지역 요청이 승인되었습니다. 총판에 구역이 매핑되었습니다.',
  });
});

// ─── 추가 지역 요청 반려 ───
regionAdd.post('/region-add-requests/:request_id/reject', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const requestId = Number(c.req.param('request_id'));
  const { reason } = await c.req.json().catch(() => ({ reason: '' }));

  if (!reason) return c.json({ error: '반려 사유를 입력하세요.' }, 400);

  const request = await db.prepare(
    "SELECT * FROM region_add_requests WHERE request_id = ? AND status IN ('PENDING', 'CONFLICT')"
  ).bind(requestId).first();
  if (!request) return c.json({ error: '반려 가능한 요청이 아닙니다.' }, 400);

  await db.prepare(`
    UPDATE region_add_requests SET status = 'REJECTED', reviewed_by = ?, reviewed_at = datetime('now'), reject_reason = ?
    WHERE request_id = ?
  `).bind(user.user_id, reason, requestId).run();

  // 가입 신청에 연결된 경우, 해당 지역을 가입 신청에서도 제거
  if (request.signup_request_id) {
    await db.prepare(`
      DELETE FROM signup_request_regions WHERE request_id = ? AND region_id = ?
    `).bind(request.signup_request_id, request.region_id).run();
  }

  await writeAuditLog(db, {
    entity_type: 'REGION_ADD_REQUEST', entity_id: requestId,
    action: 'REGION.UNMAPPED', actor_id: user.user_id,
    detail_json: JSON.stringify({ reason, region_id: request.region_id }),
  });

  return c.json({ ok: true, message: '추가 지역 요청이 반려되었습니다.' });
});

// ─── 추가 지역 요청 일괄 승인 (SUPER_ADMIN) ───
regionAdd.post('/region-add-requests/bulk-approve', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  const user = c.get('user')!;
  const db = c.env.DB;
  const { request_ids, remove_conflicts } = await c.req.json();

  if (!request_ids || !Array.isArray(request_ids) || request_ids.length === 0) {
    return c.json({ error: '승인할 요청 ID를 입력하세요.' }, 400);
  }

  let approvedCount = 0;
  let failedCount = 0;
  const errors: any[] = [];

  for (const reqId of request_ids) {
    try {
      const request = await db.prepare(
        "SELECT * FROM region_add_requests WHERE request_id = ? AND status IN ('PENDING', 'CONFLICT')"
      ).bind(reqId).first();

      if (!request) {
        failedCount++;
        errors.push({ request_id: reqId, error: '승인 가능한 요청이 아닙니다.' });
        continue;
      }

      // 충돌 시 기존 매핑 해제
      if (request.status === 'CONFLICT' && request.conflict_org_id && remove_conflicts) {
        await db.prepare(
          'DELETE FROM org_region_mappings WHERE org_id = ? AND region_id = ?'
        ).bind(request.conflict_org_id, request.region_id).run();
      }

      // 매핑 추가
      await db.prepare(
        'INSERT OR IGNORE INTO org_region_mappings (org_id, region_id, mapped_by) VALUES (?, ?, ?)'
      ).bind(request.distributor_org_id, request.region_id, user.user_id).run();

      if (request.team_org_id) {
        await db.prepare(
          'INSERT OR IGNORE INTO org_region_mappings (org_id, region_id, mapped_by) VALUES (?, ?, ?)'
        ).bind(request.team_org_id, request.region_id, user.user_id).run();
      }

      await db.prepare(`
        UPDATE region_add_requests SET status = 'APPROVED', reviewed_by = ?, reviewed_at = datetime('now')
        WHERE request_id = ?
      `).bind(user.user_id, reqId).run();

      approvedCount++;
    } catch (e: any) {
      failedCount++;
      errors.push({ request_id: reqId, error: e.message });
    }
  }

  await writeAuditLog(db, {
    entity_type: 'REGION_ADD_REQUEST', entity_id: 0,
    action: 'REGION.MAPPED', actor_id: user.user_id,
    detail_json: JSON.stringify({ bulk: true, approved: approvedCount, failed: failedCount }),
  });

  return c.json({
    ok: true,
    approved: approvedCount,
    failed: failedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// ─── 충돌 감지 (특정 구역이 다른 조직에 매핑되었는지 확인) ───
regionAdd.get('/region-add-requests/check-conflict', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
  if (authErr) return authErr;

  const db = c.env.DB;
  const regionId = Number(c.req.query('region_id'));
  const excludeOrgId = Number(c.req.query('exclude_org_id') || '0');

  if (!regionId) return c.json({ error: 'region_id를 입력하세요.' }, 400);

  let query = `
    SELECT orm.org_id, o.name as org_name, o.org_type, o.code as org_code
    FROM org_region_mappings orm
    JOIN organizations o ON orm.org_id = o.org_id
    WHERE orm.region_id = ?
  `;
  const params: any[] = [regionId];

  if (excludeOrgId) {
    query += ' AND orm.org_id != ?';
    params.push(excludeOrgId);
  }

  const result = await db.prepare(query).bind(...params).all();

  const region = await db.prepare(
    'SELECT region_id, sido, sigungu, eupmyeondong, full_name FROM admin_regions WHERE region_id = ?'
  ).bind(regionId).first();

  return c.json({
    region,
    has_conflict: result.results.length > 0,
    mapped_orgs: result.results,
  });
});

export default regionAdd;
