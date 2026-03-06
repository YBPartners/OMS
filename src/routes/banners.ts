// ================================================================
// 와이비 OMS — 배너 광고 관리 API v1.0
// 내부 슬라이딩 배너 CRUD + 구글 애드센스 설정 + 공개 배너 조회
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { writeAuditLog } from '../lib/audit';

const banners = new Hono<Env>();

// ─── 공개 API: 활성 배너 조회 (인증 불필요) ───
banners.get('/public', async (c) => {
  try {
    const db = c.env.DB;
    const position = c.req.query('position') || '';
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let query = `
      SELECT banner_id, title, image_url, image_base64, link_url, link_target,
             position, bg_color, text_content, text_color, sort_order
      FROM banners
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
    `;
    const params: any[] = [now, now];

    if (position) {
      query += ' AND position = ?';
      params.push(position);
    }

    query += ' ORDER BY sort_order ASC, banner_id DESC LIMIT 20';

    const result = await db.prepare(query).bind(...params).all();

    // 노출 카운트 증가 (비동기, 에러 무시)
    const ids = (result.results as any[]).map((b: any) => b.banner_id);
    if (ids.length > 0) {
      try {
        await db.prepare(
          `UPDATE banners SET view_count = view_count + 1 WHERE banner_id IN (${ids.map(() => '?').join(',')})`
        ).bind(...ids).run();
      } catch { /* ignore */ }
    }

    return c.json({ banners: result.results || [] });
  } catch (err: any) {
    console.error('[Banner Public] Error:', err.message);
    return c.json({ banners: [] });
  }
});

// ─── 공개 API: 배너 클릭 추적 ───
banners.post('/public/:banner_id/click', async (c) => {
  try {
    const db = c.env.DB;
    const bannerId = Number(c.req.param('banner_id'));
    if (isNaN(bannerId)) return c.json({ ok: false }, 400);

    await db.prepare('UPDATE banners SET click_count = click_count + 1 WHERE banner_id = ?')
      .bind(bannerId).run();

    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false });
  }
});

// ─── 공개 API: 광고 설정 조회 (애드센스 활성화 여부 등) ───
banners.get('/public/settings', async (c) => {
  try {
    const db = c.env.DB;
    const result = await db.prepare(
      "SELECT setting_key, setting_value FROM ad_settings WHERE setting_key IN ('adsense_enabled', 'adsense_client_id', 'adsense_slot_dashboard', 'adsense_slot_sidebar', 'adsense_slot_content', 'banner_autoplay_interval', 'banner_enabled')"
    ).all();

    const settings: Record<string, string> = {};
    for (const row of result.results as any[]) {
      settings[row.setting_key] = row.setting_value;
    }

    return c.json({ settings });
  } catch (err: any) {
    console.error('[Ad Settings Public] Error:', err.message);
    return c.json({ settings: {} });
  }
});

// ════════════════════════════════════════════
// 관리자 전용 API (SUPER_ADMIN)
// ════════════════════════════════════════════

// ─── 배너 통계 요약 (static path — must come before :banner_id) ───
banners.get('/admin/stats', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const [totalRes, activeRes, clicksRes, viewsRes] = await Promise.all([
      db.prepare('SELECT COUNT(*) as cnt FROM banners').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM banners WHERE is_active = 1').first(),
      db.prepare('SELECT COALESCE(SUM(click_count), 0) as total FROM banners').first(),
      db.prepare('SELECT COALESCE(SUM(view_count), 0) as total FROM banners').first(),
    ]);

    const byPosition = await db.prepare(`
      SELECT position, COUNT(*) as count, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count
      FROM banners GROUP BY position
    `).all();

    return c.json({
      stats: {
        total: (totalRes as any)?.cnt || 0,
        active: (activeRes as any)?.cnt || 0,
        total_clicks: (clicksRes as any)?.total || 0,
        total_views: (viewsRes as any)?.total || 0,
        ctr: (viewsRes as any)?.total > 0
          ? ((clicksRes as any)?.total / (viewsRes as any)?.total * 100).toFixed(2) + '%'
          : '0%',
        by_position: byPosition.results || [],
      },
    });
  } catch (err: any) {
    console.error('[Banner Stats] Error:', err.message);
    return c.json({ error: '배너 통계 조회 중 오류가 발생했습니다.' }, 500);
  }
});

// ─── 전체 광고 설정 조회 (static path — must come before :banner_id) ───
banners.get('/admin/settings/all', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const result = await db.prepare('SELECT * FROM ad_settings ORDER BY setting_id').all();
    return c.json({ settings: result.results || [] });
  } catch (err: any) {
    console.error('[Ad Settings] Error:', err.message);
    return c.json({ error: '광고 설정 조회 중 오류가 발생했습니다.' }, 500);
  }
});

// ─── 광고 설정 업데이트 (static path — must come before :banner_id) ───
banners.put('/admin/settings', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const user = c.get('user')!;
    const { settings } = await c.req.json();

    if (!settings || typeof settings !== 'object') {
      return c.json({ error: '설정 데이터가 필요합니다.' }, 400);
    }

    const allowedKeys = [
      'adsense_enabled', 'adsense_client_id',
      'adsense_slot_dashboard', 'adsense_slot_sidebar', 'adsense_slot_content',
      'banner_autoplay_interval', 'banner_enabled', 'domain_name',
    ];

    let updated = 0;
    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.includes(key)) continue;
      await db.prepare(
        "UPDATE ad_settings SET setting_value = ?, updated_by = ?, updated_at = datetime('now') WHERE setting_key = ?"
      ).bind(String(value), user.user_id, key).run();
      updated++;
    }

    await writeAuditLog(db, {
      entity_type: 'SYSTEM', entity_id: 0,
      action: 'AD_SETTINGS_UPDATED',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ keys: Object.keys(settings), updated }),
    });

    return c.json({ ok: true, updated, message: '광고 설정이 업데이트되었습니다.' });
  } catch (err: any) {
    console.error('[Ad Settings Update] Error:', err.message);
    return c.json({ error: '광고 설정 업데이트 중 오류가 발생했습니다.' }, 500);
  }
});

// ─── 배너 순서 일괄 변경 (static path — must come before :banner_id) ───
banners.put('/admin/reorder', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const user = c.get('user')!;
    const { items } = await c.req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: '정렬 항목이 필요합니다.' }, 400);
    }
    if (items.length > 50) return c.json({ error: '최대 50개까지 정렬 가능합니다.' }, 400);

    for (const item of items) {
      if (!item.banner_id || item.sort_order === undefined) continue;
      await db.prepare('UPDATE banners SET sort_order = ?, updated_at = datetime(\'now\') WHERE banner_id = ?')
        .bind(Number(item.sort_order), Number(item.banner_id)).run();
    }

    await writeAuditLog(db, {
      entity_type: 'BANNER', entity_id: 0,
      action: 'BANNER_REORDERED',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ count: items.length }),
    });

    return c.json({ ok: true, message: '배너 순서가 변경되었습니다.' });
  } catch (err: any) {
    console.error('[Banner Reorder] Error:', err.message);
    return c.json({ error: '배너 순서 변경 중 오류가 발생했습니다.' }, 500);
  }
});

// ─── 배너 목록 조회 (관리용, 전체) ───
banners.get('/admin/list', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const position = c.req.query('position') || '';
    const status = c.req.query('status') || ''; // active, inactive, all
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') || 20)));
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params: any[] = [];

    if (position) {
      where += ' AND b.position = ?';
      params.push(position);
    }
    if (status === 'active') {
      where += ' AND b.is_active = 1';
    } else if (status === 'inactive') {
      where += ' AND b.is_active = 0';
    }

    const countRes = await db.prepare(`SELECT COUNT(*) as cnt FROM banners b WHERE ${where}`).bind(...params).first() as any;
    const total = countRes?.cnt || 0;

    const result = await db.prepare(`
      SELECT b.*, u.name as created_by_name
      FROM banners b
      LEFT JOIN users u ON b.created_by = u.user_id
      WHERE ${where}
      ORDER BY b.sort_order ASC, b.banner_id DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    return c.json({
      banners: result.results || [],
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('[Banner List] Error:', err.message);
    return c.json({ error: '배너 목록 조회 중 오류가 발생했습니다.' }, 500);
  }
});

// ─── 배너 상세 조회 ───
banners.get('/admin/:banner_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const bannerId = Number(c.req.param('banner_id'));
    if (isNaN(bannerId)) return c.json({ error: '유효하지 않은 배너 ID' }, 400);

    const banner = await db.prepare(`
      SELECT b.*, u.name as created_by_name
      FROM banners b
      LEFT JOIN users u ON b.created_by = u.user_id
      WHERE b.banner_id = ?
    `).bind(bannerId).first();

    if (!banner) return c.json({ error: '배너를 찾을 수 없습니다.' }, 404);

    return c.json({ banner });
  } catch (err: any) {
    console.error('[Banner Detail] Error:', err.message);
    return c.json({ error: '배너 조회 중 오류가 발생했습니다.' }, 500);
  }
});

// ─── 배너 생성 ───
banners.post('/admin', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const user = c.get('user')!;
    const body = await c.req.json();
    const { title, image_url, image_base64, link_url, link_target, position, bg_color, text_content, text_color, sort_order, is_active, start_date, end_date } = body;

    // 유효성 검증
    if (!title || title.trim().length === 0) return c.json({ error: '배너 제목은 필수입니다.' }, 400);
    if (title.length > 100) return c.json({ error: '배너 제목은 100자 이내입니다.' }, 400);
    if (!image_url && !image_base64 && !text_content) {
      return c.json({ error: '이미지 또는 텍스트 내용 중 하나는 필수입니다.' }, 400);
    }

    const validPositions = ['dashboard_top', 'sidebar_bottom', 'content_between', 'login_page'];
    const pos = position || 'dashboard_top';
    if (!validPositions.includes(pos)) return c.json({ error: '유효하지 않은 배너 위치입니다.' }, 400);

    const validTargets = ['_blank', '_self'];
    const target = link_target || '_blank';
    if (!validTargets.includes(target)) return c.json({ error: '유효하지 않은 링크 타겟입니다.' }, 400);

    const result = await db.prepare(`
      INSERT INTO banners (title, image_url, image_base64, link_url, link_target, position, bg_color, text_content, text_color, sort_order, is_active, start_date, end_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      title.trim(),
      image_url || null,
      image_base64 || null,
      link_url || null,
      target,
      pos,
      bg_color || '#ffffff',
      text_content || null,
      text_color || '#000000',
      sort_order ?? 0,
      is_active ?? 1,
      start_date || null,
      end_date || null,
      user.user_id
    ).run();

    await writeAuditLog(db, {
      entity_type: 'BANNER', entity_id: result.meta.last_row_id as number,
      action: 'BANNER_CREATED',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ title, position: pos }),
    });

    return c.json({ ok: true, banner_id: result.meta.last_row_id, message: '배너가 생성되었습니다.' }, 201);
  } catch (err: any) {
    console.error('[Banner Create] Error:', err.message);
    return c.json({ error: '배너 생성 중 오류가 발생했습니다.' }, 500);
  }
});

// ─── 배너 수정 ───
banners.put('/admin/:banner_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const user = c.get('user')!;
    const bannerId = Number(c.req.param('banner_id'));
    if (isNaN(bannerId)) return c.json({ error: '유효하지 않은 배너 ID' }, 400);

    const existing = await db.prepare('SELECT banner_id FROM banners WHERE banner_id = ?').bind(bannerId).first();
    if (!existing) return c.json({ error: '배너를 찾을 수 없습니다.' }, 404);

    const body = await c.req.json();
    const { title, image_url, image_base64, link_url, link_target, position, bg_color, text_content, text_color, sort_order, is_active, start_date, end_date } = body;

    if (title && title.length > 100) return c.json({ error: '배너 제목은 100자 이내입니다.' }, 400);

    const validPositions = ['dashboard_top', 'sidebar_bottom', 'content_between', 'login_page'];
    if (position && !validPositions.includes(position)) return c.json({ error: '유효하지 않은 배너 위치입니다.' }, 400);

    const validTargets = ['_blank', '_self'];
    if (link_target && !validTargets.includes(link_target)) return c.json({ error: '유효하지 않은 링크 타겟입니다.' }, 400);

    await db.prepare(`
      UPDATE banners SET
        title = COALESCE(?, title),
        image_url = COALESCE(?, image_url),
        image_base64 = COALESCE(?, image_base64),
        link_url = COALESCE(?, link_url),
        link_target = COALESCE(?, link_target),
        position = COALESCE(?, position),
        bg_color = COALESCE(?, bg_color),
        text_content = COALESCE(?, text_content),
        text_color = COALESCE(?, text_color),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active),
        start_date = ?,
        end_date = ?,
        updated_at = datetime('now')
      WHERE banner_id = ?
    `).bind(
      title || null,
      image_url ?? null,
      image_base64 ?? null,
      link_url ?? null,
      link_target || null,
      position || null,
      bg_color || null,
      text_content ?? null,
      text_color || null,
      sort_order ?? null,
      is_active ?? null,
      start_date ?? null,
      end_date ?? null,
      bannerId
    ).run();

    await writeAuditLog(db, {
      entity_type: 'BANNER', entity_id: bannerId,
      action: 'BANNER_UPDATED',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ banner_id: bannerId, changes: Object.keys(body) }),
    });

    return c.json({ ok: true, message: '배너가 수정되었습니다.' });
  } catch (err: any) {
    console.error('[Banner Update] Error:', err.message);
    return c.json({ error: '배너 수정 중 오류가 발생했습니다.' }, 500);
  }
});

// ─── 배너 삭제 ───
banners.delete('/admin/:banner_id', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const user = c.get('user')!;
    const bannerId = Number(c.req.param('banner_id'));
    if (isNaN(bannerId)) return c.json({ error: '유효하지 않은 배너 ID' }, 400);

    const existing = await db.prepare('SELECT banner_id, title FROM banners WHERE banner_id = ?').bind(bannerId).first() as any;
    if (!existing) return c.json({ error: '배너를 찾을 수 없습니다.' }, 404);

    await db.prepare('DELETE FROM banners WHERE banner_id = ?').bind(bannerId).run();

    await writeAuditLog(db, {
      entity_type: 'BANNER', entity_id: bannerId,
      action: 'BANNER_DELETED',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ banner_id: bannerId, title: existing.title }),
    });

    return c.json({ ok: true, message: '배너가 삭제되었습니다.' });
  } catch (err: any) {
    console.error('[Banner Delete] Error:', err.message);
    return c.json({ error: '배너 삭제 중 오류가 발생했습니다.' }, 500);
  }
});

// ─── 배너 활성/비활성 토글 ───
banners.patch('/admin/:banner_id/toggle', async (c) => {
  const authErr = requireAuth(c, ['SUPER_ADMIN']);
  if (authErr) return authErr;

  try {
    const db = c.env.DB;
    const user = c.get('user')!;
    const bannerId = Number(c.req.param('banner_id'));
    if (isNaN(bannerId)) return c.json({ error: '유효하지 않은 배너 ID' }, 400);

    const existing = await db.prepare('SELECT banner_id, is_active, title FROM banners WHERE banner_id = ?').bind(bannerId).first() as any;
    if (!existing) return c.json({ error: '배너를 찾을 수 없습니다.' }, 404);

    const newStatus = existing.is_active === 1 ? 0 : 1;
    await db.prepare("UPDATE banners SET is_active = ?, updated_at = datetime('now') WHERE banner_id = ?")
      .bind(newStatus, bannerId).run();

    await writeAuditLog(db, {
      entity_type: 'BANNER', entity_id: bannerId,
      action: newStatus ? 'BANNER_ACTIVATED' : 'BANNER_DEACTIVATED',
      actor_id: user.user_id,
      detail_json: JSON.stringify({ banner_id: bannerId, title: existing.title }),
    });

    return c.json({ ok: true, is_active: newStatus, message: newStatus ? '배너가 활성화되었습니다.' : '배너가 비활성화되었습니다.' });
  } catch (err: any) {
    console.error('[Banner Toggle] Error:', err.message);
    return c.json({ error: '배너 상태 변경 중 오류가 발생했습니다.' }, 500);
  }
});

export default banners;
