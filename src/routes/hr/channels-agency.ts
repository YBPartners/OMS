// ================================================================
// Airflow OMS — 주문 채널 관리 API + 대리점 관리 API
// Phase 8.0: 채널별 API 연동 설정 + 동기화
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { writeAuditLog } from '../../lib/audit';
import { createNotification } from '../../services/notification-service';
import { generateFingerprint } from '../../lib/db-helpers';
import { writeStatusHistory } from '../../lib/audit';

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
      // auth_credentials는 목록에서 마스킹
      auth_credentials: ch.auth_credentials ? '••••••' : null,
      order_count: statsMap[ch.channel_id]?.order_count || 0,
      total_amount: statsMap[ch.channel_id]?.total_amount || 0,
    }));

    return c.json({ channels });
  });

  // ─── 채널 상세 (API 설정 포함, 관리자만) ───
  router.get('/channels/:channel_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const db = c.env.DB;
    const channelId = Number(c.req.param('channel_id'));

    const ch = await db.prepare('SELECT * FROM order_channels WHERE channel_id = ?').bind(channelId).first();
    if (!ch) return c.json({ error: '채널을 찾을 수 없습니다.' }, 404);

    // 통계
    const stat = await db.prepare(`
      SELECT COUNT(*) as order_count, COALESCE(SUM(base_amount), 0) as total_amount
      FROM orders WHERE channel_id = ?
    `).bind(channelId).first();

    return c.json({ channel: { ...ch, order_count: (stat as any)?.order_count || 0, total_amount: (stat as any)?.total_amount || 0 } });
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
      INSERT INTO order_channels (name, code, description, contact_info, is_active, priority,
        api_endpoint, api_method, auth_type, auth_credentials, request_headers, 
        request_body_template, response_type, field_mapping, data_path, 
        polling_interval_min, api_enabled)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.name, body.code, body.description || null, body.contact_info || null, body.priority || 0,
      body.api_endpoint || null, body.api_method || 'GET', body.auth_type || 'NONE',
      body.auth_credentials ? JSON.stringify(body.auth_credentials) : null,
      body.request_headers ? JSON.stringify(body.request_headers) : null,
      body.request_body_template || null, body.response_type || 'JSON',
      body.field_mapping ? JSON.stringify(body.field_mapping) : null,
      body.data_path || null, body.polling_interval_min || 0,
      body.api_enabled ? 1 : 0
    ).run();

    await writeAuditLog(db, {
      entity_type: 'CHANNEL', entity_id: result.meta.last_row_id as number,
      action: 'CHANNEL.CREATED', actor_id: user.user_id,
      detail_json: JSON.stringify({ name: body.name, code: body.code }),
    });

    return c.json({ channel_id: result.meta.last_row_id }, 201);
  });

  // ─── 채널 수정 (기본 정보 + API 설정) ───
  router.put('/channels/:channel_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const channelId = Number(c.req.param('channel_id'));
    const body = await c.req.json();

    const existing = await db.prepare('SELECT * FROM order_channels WHERE channel_id = ?').bind(channelId).first();
    if (!existing) return c.json({ error: '채널을 찾을 수 없습니다.' }, 404);

    // 기본 정보 업데이트
    const updates: string[] = [];
    const binds: any[] = [];

    // 기본 필드
    if (body.name !== undefined) { updates.push('name = ?'); binds.push(body.name); }
    if (body.description !== undefined) { updates.push('description = ?'); binds.push(body.description || null); }
    if (body.contact_info !== undefined) { updates.push('contact_info = ?'); binds.push(body.contact_info || null); }
    if (body.is_active !== undefined) { updates.push('is_active = ?'); binds.push(body.is_active ? 1 : 0); }
    if (body.priority !== undefined) { updates.push('priority = ?'); binds.push(body.priority); }

    // API 연동 필드
    if (body.api_endpoint !== undefined) { updates.push('api_endpoint = ?'); binds.push(body.api_endpoint || null); }
    if (body.api_method !== undefined) { updates.push('api_method = ?'); binds.push(body.api_method); }
    if (body.auth_type !== undefined) { updates.push('auth_type = ?'); binds.push(body.auth_type); }
    if (body.auth_credentials !== undefined) {
      updates.push('auth_credentials = ?');
      binds.push(typeof body.auth_credentials === 'object' ? JSON.stringify(body.auth_credentials) : body.auth_credentials || null);
    }
    if (body.request_headers !== undefined) {
      updates.push('request_headers = ?');
      binds.push(typeof body.request_headers === 'object' ? JSON.stringify(body.request_headers) : body.request_headers || null);
    }
    if (body.request_body_template !== undefined) { updates.push('request_body_template = ?'); binds.push(body.request_body_template || null); }
    if (body.response_type !== undefined) { updates.push('response_type = ?'); binds.push(body.response_type); }
    if (body.field_mapping !== undefined) {
      updates.push('field_mapping = ?');
      binds.push(typeof body.field_mapping === 'object' ? JSON.stringify(body.field_mapping) : body.field_mapping || null);
    }
    if (body.data_path !== undefined) { updates.push('data_path = ?'); binds.push(body.data_path || null); }
    if (body.polling_interval_min !== undefined) { updates.push('polling_interval_min = ?'); binds.push(body.polling_interval_min); }
    if (body.api_enabled !== undefined) { updates.push('api_enabled = ?'); binds.push(body.api_enabled ? 1 : 0); }

    if (updates.length === 0) return c.json({ error: '변경할 내용이 없습니다.' }, 400);

    updates.push("updated_at = datetime('now')");
    binds.push(channelId);

    await db.prepare(`UPDATE order_channels SET ${updates.join(', ')} WHERE channel_id = ?`).bind(...binds).run();

    await writeAuditLog(db, {
      entity_type: 'CHANNEL', entity_id: channelId, action: 'CHANNEL.UPDATED',
      actor_id: user.user_id, detail_json: JSON.stringify({ fields: Object.keys(body) }),
    });

    return c.json({ ok: true });
  });

  // ─── API 연결 테스트 ───
  router.post('/channels/:channel_id/test-api', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const db = c.env.DB;
    const channelId = Number(c.req.param('channel_id'));

    const ch = await db.prepare('SELECT * FROM order_channels WHERE channel_id = ?').bind(channelId).first() as any;
    if (!ch) return c.json({ error: '채널을 찾을 수 없습니다.' }, 404);
    if (!ch.api_endpoint) return c.json({ error: 'API 엔드포인트가 설정되지 않았습니다.' }, 400);

    try {
      const { headers, requestInit } = buildFetchOptions(ch);
      const startTime = Date.now();
      const response = await fetch(ch.api_endpoint, { ...requestInit, signal: AbortSignal.timeout(15000) });
      const elapsed = Date.now() - startTime;
      const contentType = response.headers.get('content-type') || '';
      const rawBody = await response.text();

      // 응답 파싱 시도
      let parsed: any = null;
      let recordCount = 0;
      try {
        parsed = JSON.parse(rawBody);
        // data_path를 따라가 주문 배열 추출 시도
        if (ch.data_path) {
          const arr = getNestedValue(parsed, ch.data_path);
          if (Array.isArray(arr)) recordCount = arr.length;
        } else if (Array.isArray(parsed)) {
          recordCount = parsed.length;
        }
      } catch { /* 파싱 실패는 무시 */ }

      return c.json({
        ok: true,
        test_result: {
          status_code: response.status,
          status_text: response.statusText,
          content_type: contentType,
          response_time_ms: elapsed,
          body_size: rawBody.length,
          body_preview: rawBody.substring(0, 2000),
          record_count: recordCount,
          parsed_ok: parsed !== null,
        }
      });
    } catch (e: any) {
      return c.json({
        ok: false,
        test_result: {
          error: e.message || 'API 연결 실패',
          error_type: e.name || 'Unknown',
        }
      });
    }
  });

  // ─── API 동기화 실행 (채널에서 주문 가져오기) ───
  router.post('/channels/:channel_id/sync', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const channelId = Number(c.req.param('channel_id'));

    const ch = await db.prepare('SELECT * FROM order_channels WHERE channel_id = ?').bind(channelId).first() as any;
    if (!ch) return c.json({ error: '채널을 찾을 수 없습니다.' }, 404);
    if (!ch.api_endpoint) return c.json({ error: 'API 엔드포인트가 설정되지 않았습니다.' }, 400);
    if (!ch.api_enabled) return c.json({ error: 'API 연동이 비활성화 상태입니다.' }, 400);

    let syncStatus = 'SUCCESS';
    let syncMessage = '';
    let syncCount = 0;
    const errors: string[] = [];

    try {
      // 1. 외부 API 호출
      const { requestInit } = buildFetchOptions(ch);
      const response = await fetch(ch.api_endpoint, { ...requestInit, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const rawBody = await response.text();
      let data: any;
      try { data = JSON.parse(rawBody); } catch { throw new Error('응답 JSON 파싱 실패'); }

      // 2. data_path에서 주문 배열 추출
      let orders: any[] = [];
      if (ch.data_path) {
        orders = getNestedValue(data, ch.data_path);
        if (!Array.isArray(orders)) throw new Error(`data_path "${ch.data_path}"에서 배열을 찾을 수 없습니다.`);
      } else if (Array.isArray(data)) {
        orders = data;
      } else {
        throw new Error('응답에서 주문 배열을 찾을 수 없습니다. data_path를 설정하세요.');
      }

      // 3. 필드 매핑 적용 → 주문 생성
      const mapping = ch.field_mapping ? (typeof ch.field_mapping === 'string' ? JSON.parse(ch.field_mapping) : ch.field_mapping) : {};

      for (let i = 0; i < orders.length; i++) {
        try {
          const raw = orders[i];
          const mapped = applyFieldMapping(raw, mapping);

          // 중복 검사 (fingerprint)
          const fpData = `${mapped.address_text || ''}|${mapped.requested_date || ''}|${mapped.service_type || 'DEFAULT'}|${mapped.base_amount || 0}`;
          const fingerprint = await generateFingerprint(fpData);

          const dup = await db.prepare(
            'SELECT order_id FROM orders WHERE source_fingerprint = ? AND channel_id = ?'
          ).bind(fingerprint, channelId).first();

          if (dup) {
            errors.push(`행 ${i + 1}: 중복 주문 (order_id: ${(dup as any).order_id})`);
            continue;
          }

          const result = await db.prepare(`
            INSERT INTO orders (external_order_no, source_fingerprint, service_type, customer_name, customer_phone,
              address_text, address_detail, admin_dong_code, legal_dong_code, requested_date, scheduled_date, 
              base_amount, memo, channel_id, raw_json, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED')
          `).bind(
            mapped.external_order_no || null, fingerprint, mapped.service_type || 'DEFAULT',
            mapped.customer_name || null, mapped.customer_phone || null,
            mapped.address_text || '', mapped.address_detail || null,
            mapped.admin_dong_code || null, mapped.legal_dong_code || null,
            mapped.requested_date || new Date().toISOString().split('T')[0],
            mapped.scheduled_date || null, mapped.base_amount || 0,
            mapped.memo || null, channelId, JSON.stringify(raw), 
          ).run();

          await writeStatusHistory(db, {
            order_id: result.meta.last_row_id as number,
            from_status: null, to_status: 'RECEIVED',
            actor_id: user.user_id,
            note: `채널 동기화: ${ch.name} (${ch.code})`,
          });

          syncCount++;
        } catch (rowErr: any) {
          errors.push(`행 ${i + 1}: ${rowErr.message}`);
        }
      }

      if (errors.length > 0) {
        syncStatus = syncCount > 0 ? 'PARTIAL' : 'FAIL';
        syncMessage = `${syncCount}건 성공, ${errors.length}건 실패`;
      } else {
        syncMessage = `${syncCount}건 동기화 완료`;
      }

    } catch (e: any) {
      syncStatus = 'FAIL';
      syncMessage = e.message || 'API 동기화 실패';
    }

    // 4. 동기화 상태 업데이트
    await db.prepare(`
      UPDATE order_channels SET
        last_sync_at = datetime('now'),
        last_sync_status = ?,
        last_sync_message = ?,
        last_sync_count = ?,
        total_synced_count = total_synced_count + ?
      WHERE channel_id = ?
    `).bind(syncStatus, syncMessage, syncCount, syncCount, channelId).run();

    await writeAuditLog(db, {
      entity_type: 'CHANNEL', entity_id: channelId, action: 'CHANNEL.SYNCED',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ status: syncStatus, count: syncCount, errors: errors.slice(0, 10) }),
    });

    return c.json({
      ok: syncStatus !== 'FAIL',
      sync_result: { status: syncStatus, message: syncMessage, synced_count: syncCount, errors: errors.slice(0, 20) }
    });
  });

  // ─── 채널 삭제 (비활성 채널만, 주문이 없는 경우) ───
  router.delete('/channels/:channel_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const channelId = Number(c.req.param('channel_id'));

    const ch = await db.prepare('SELECT * FROM order_channels WHERE channel_id = ?').bind(channelId).first() as any;
    if (!ch) return c.json({ error: '채널을 찾을 수 없습니다.' }, 404);

    const orderCount = await db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE channel_id = ?').bind(channelId).first() as any;
    if (orderCount?.cnt > 0) return c.json({ error: `해당 채널에 ${orderCount.cnt}건의 주문이 있어 삭제할 수 없습니다. 비활성화를 사용하세요.` }, 409);

    await db.prepare('DELETE FROM order_channels WHERE channel_id = ?').bind(channelId).run();

    await writeAuditLog(db, {
      entity_type: 'CHANNEL', entity_id: channelId, action: 'CHANNEL.DELETED',
      actor_id: user.user_id, detail_json: JSON.stringify({ name: ch.name, code: ch.code }),
    });

    return c.json({ ok: true });
  });
}

// ════════════════════════════════════════════════════════
// Helper: API 호출 옵션 빌드
// ════════════════════════════════════════════════════════
function buildFetchOptions(ch: any): { headers: Record<string, string>; requestInit: RequestInit } {
  const headers: Record<string, string> = { 'Accept': 'application/json' };

  // 인증 설정
  if (ch.auth_type && ch.auth_type !== 'NONE' && ch.auth_credentials) {
    const creds = typeof ch.auth_credentials === 'string' ? JSON.parse(ch.auth_credentials) : ch.auth_credentials;
    switch (ch.auth_type) {
      case 'API_KEY':
        headers[creds.header_name || 'X-API-Key'] = creds.api_key || '';
        break;
      case 'BEARER':
        headers['Authorization'] = `Bearer ${creds.token || ''}`;
        break;
      case 'BASIC':
        headers['Authorization'] = `Basic ${btoa(`${creds.username || ''}:${creds.password || ''}`)}`;
        break;
      case 'CUSTOM_HEADER':
        if (creds.header_name && creds.header_value) {
          headers[creds.header_name] = creds.header_value;
        }
        break;
    }
  }

  // 추가 헤더
  if (ch.request_headers) {
    const extraHeaders = typeof ch.request_headers === 'string' ? JSON.parse(ch.request_headers) : ch.request_headers;
    if (Array.isArray(extraHeaders)) {
      for (const h of extraHeaders) {
        if (h.key && h.value) headers[h.key] = h.value;
      }
    }
  }

  const requestInit: RequestInit = {
    method: ch.api_method || 'GET',
    headers,
  };

  // POST 바디
  if (ch.api_method === 'POST' && ch.request_body_template) {
    requestInit.body = ch.request_body_template;
    headers['Content-Type'] = 'application/json';
  }

  return { headers, requestInit };
}

// ════════════════════════════════════════════════════════
// Helper: 중첩 객체 경로 탐색 (예: "data.orders" → obj.data.orders)
// ════════════════════════════════════════════════════════
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// ════════════════════════════════════════════════════════
// Helper: 필드 매핑 적용
// mapping = { "외부필드명": "내부필드명" }
// 예: { "orderNo": "external_order_no", "addr": "address_text" }
// ════════════════════════════════════════════════════════
function applyFieldMapping(rawOrder: any, mapping: Record<string, string>): any {
  if (!mapping || Object.keys(mapping).length === 0) return rawOrder;

  const result: any = {};
  for (const [externalKey, internalKey] of Object.entries(mapping)) {
    const value = getNestedValue(rawOrder, externalKey);
    if (value !== undefined) result[internalKey] = value;
  }
  return result;
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
