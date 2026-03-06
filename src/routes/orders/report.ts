// ================================================================
// 와이비 OMS — 보고서 제출 / 영수증 첨부 / 사진 업로드 v17.0
// State Machine 적용 + 모바일 카메라 직접 촬영 + 파일명 자동 규칙화
// ================================================================
import { Hono } from 'hono';
import type { Env, OrderStatus } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { transitionOrder } from '../../lib/state-machine';
import { upsertTeamLeaderDailyStats } from '../../lib/db-helpers';
import { createNotification } from '../../services/notification-service';

// ─── 파일명 규칙화 유틸 ───
function generateFileName(
  date: string,
  teamCode: string,
  category: string,
  orderId: number,
  ext: string
): string {
  const categoryMap: Record<string, string> = {
    'EXTERIOR': '외부촬영',
    'INTERIOR': '내부촬영',
    'BEFORE_WASH': '세척전',
    'AFTER_WASH': '세척후',
    'RECEIPT': '영수증',
    'CUSTOMER_CONFIRM': '고객확인',
    'ETC': '기타',
    'BEFORE': '작업전',
    'AFTER': '작업후',
  };
  const catLabel = categoryMap[category] || category;
  const dateStr = date.replace(/-/g, '');
  const safeTeam = (teamCode || 'TEAM').replace(/[^a-zA-Z0-9가-힣_-]/g, '');
  return `${dateStr}_${safeTeam}_${orderId}_${catLabel}.${ext}`;
}

export function mountReport(router: Hono<Env>) {

  // ─── 사진 업로드 (단건) ───
  router.post('/:order_id/upload', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER', 'AGENCY_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    // 주문 존재 확인
    const order = await db.prepare('SELECT order_id, status FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

    // multipart/form-data 파싱
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string) || 'ETC';
    const reportId = formData.get('report_id') ? Number(formData.get('report_id')) : null;

    if (!file || !(file instanceof File)) {
      return c.json({ error: '파일이 필요합니다.' }, 400);
    }

    // 파일 크기 제한 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return c.json({ error: '파일 크기는 2MB 이하여야 합니다.' }, 400);
    }

    // 이미지 타입만 허용
    if (!file.type.startsWith('image/')) {
      return c.json({ error: '이미지 파일만 업로드 가능합니다.' }, 400);
    }

    // 팀 코드 조회
    const org = await db.prepare(
      'SELECT o.code FROM organizations o WHERE o.org_id = ?'
    ).bind(user.org_id).first();
    const teamCode = (org as any)?.code || `U${user.user_id}`;

    // 파일 확장자
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
    const today = new Date().toISOString().split('T')[0];

    // 규칙화된 파일명 생성
    const fileName = generateFileName(today, teamCode, category, orderId, ext);

    // 파일 → Base64 Data URL
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type};base64,${base64}`;

    // DB 저장
    let targetReportId = reportId;
    if (!targetReportId) {
      // 최신 보고서 찾기 또는 임시 보고서 생성
      const latestReport = await db.prepare(
        'SELECT report_id FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1'
      ).bind(orderId).first();
      targetReportId = (latestReport as any)?.report_id || null;
    }

    if (targetReportId) {
      const result = await db.prepare(`
        INSERT INTO work_report_photos (report_id, category, file_url, file_name, file_size, mime_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(targetReportId, category, dataUrl, fileName, file.size, file.type).run();

      return c.json({
        ok: true,
        photo_id: result.meta.last_row_id,
        file_name: fileName,
        category,
        file_size: file.size,
      }, 201);
    }

    // 보고서가 아직 없으면 file_url만 반환 (프론트에서 임시 보관 후 보고서 제출 시 함께 전송)
    return c.json({
      ok: true,
      file_url: dataUrl,
      file_name: fileName,
      category,
      file_size: file.size,
      pending: true,  // 보고서 제출 시 함께 저장 필요
    }, 201);
  });

  // ─── 보고서 제출 ───
  router.post('/:order_id/reports', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const body = await c.req.json();

    // 보고서 제출은 IN_PROGRESS, REGION_REJECTED, HQ_REJECTED에서 가능
    // State Machine은 SUBMITTED로의 전이만 검증하므로 커스텀 validate 사용
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first();
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

    const allowedStatuses: OrderStatus[] = ['IN_PROGRESS', 'REGION_REJECTED', 'HQ_REJECTED'];
    if (!allowedStatuses.includes(order.status as OrderStatus)) {
      return c.json({ error: `현재 상태(${order.status})에서는 보고서 제출이 불가합니다.` }, 400);
    }

    const reportPolicy = await db.prepare(`
      SELECT * FROM report_policies WHERE service_type = ? AND is_active = 1 ORDER BY version DESC LIMIT 1
    `).bind(order.service_type || 'DEFAULT').first();

    const prevReport = await db.prepare(
      'SELECT MAX(version) as max_ver FROM work_reports WHERE order_id = ?'
    ).bind(orderId).first();
    const newVersion = ((prevReport as any)?.max_ver || 0) + 1;

    // ★ State Machine 적용 — IN_PROGRESS|*_REJECTED → SUBMITTED
    const result = await transitionOrder(db, orderId, 'SUBMITTED', user, {
      note: `보고서 v${newVersion} 제출`,
      afterTransition: async (db) => {
        // 보고서 생성
        const reportResult = await db.prepare(`
          INSERT INTO work_reports (order_id, team_leader_id, policy_id_snapshot, checklist_json, note, version)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(orderId, user.user_id, reportPolicy?.policy_id ?? null,
          JSON.stringify(body.checklist || {}), body.note ?? null, newVersion).run();
        const reportId = reportResult.meta.last_row_id;

        // 사진 첨부 (Base64 Data URL 또는 외부 URL)
        if (body.photos && Array.isArray(body.photos)) {
          for (const photo of body.photos) {
            const photoUrl = photo.file_url || photo.url || '';
            await db.prepare(`
              INSERT INTO work_report_photos (report_id, category, file_url, file_name, file_size, mime_type, file_hash)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
              reportId, photo.category ?? 'ETC', photoUrl,
              photo.file_name ?? null, photo.file_size ?? 0, photo.mime_type ?? null,
              photo.file_hash ?? null
            ).run();
          }
        }

        // assignment 동기화
        await db.prepare(`
          UPDATE order_assignments SET status = 'SUBMITTED', updated_at = datetime('now')
          WHERE order_id = ? AND status IN ('IN_PROGRESS','ASSIGNED')
        `).bind(orderId).run();

        // 통계
        await upsertTeamLeaderDailyStats(db, user.user_id, 'submitted_count');
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    // 보고서 ID 조회 (afterTransition에서 생성됨)
    const latestReport = await db.prepare(
      'SELECT report_id, version FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1'
    ).bind(orderId).first();

    return c.json({
      ok: true,
      report_id: latestReport?.report_id,
      version: latestReport?.version || newVersion,
    });
  });

  // ─── 영수증 첨부로 최종완료 (SUBMITTED → DONE) ───
  router.post('/:order_id/complete', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    let body: any = {};
    try { body = await c.req.json(); } catch { /* optional body */ }

    // ★ State Machine 적용 — SUBMITTED → DONE
    const result = await transitionOrder(db, orderId, 'DONE', user, {
      note: body.note || '영수증 첨부 완료 → 최종완료',
      afterTransition: async (db, order) => {
        // 영수증 사진 첨부 (선택적 — Base64 Data URL 또는 외부 URL)
        if (body.receipt_url) {
          const report = await db.prepare(
            'SELECT report_id FROM work_reports WHERE order_id = ? ORDER BY version DESC LIMIT 1'
          ).bind(orderId).first();
          if (report) {
            await db.prepare(`
              INSERT INTO work_report_photos (report_id, category, file_url, file_name, file_size, mime_type, file_hash)
              VALUES (?, 'RECEIPT', ?, ?, ?, ?, ?)
            `).bind(
              report.report_id, body.receipt_url,
              body.file_name ?? null, body.file_size ?? 0, body.mime_type ?? null,
              body.file_hash ?? null
            ).run();
          }
        }

        // assignment 상태 동기화
        await db.prepare(`
          UPDATE order_assignments SET status = 'DONE', updated_at = datetime('now')
          WHERE order_id = ? AND status = 'SUBMITTED'
        `).bind(orderId).run();

        // ★ GAP-3: 검수자(REGION_ADMIN)에게 알림
        const dist = await db.prepare(
          "SELECT region_org_id FROM order_distributions WHERE order_id = ? AND status = 'ACTIVE'"
        ).bind(orderId).first();
        if (dist) {
          const reviewers = await db.prepare(`
            SELECT u.user_id FROM users u
            JOIN user_roles ur ON u.user_id = ur.user_id
            JOIN roles r ON ur.role_id = r.role_id
            WHERE u.org_id = ? AND r.code = 'REGION_ADMIN' AND u.status = 'ACTIVE'
          `).bind(dist.region_org_id).all();
          for (const rv of reviewers.results as any[]) {
            await createNotification(db, rv.user_id, {
              type: 'ORDER_COMPLETED',
              title: '검수 대기',
              message: `주문 #${orderId}이(가) 최종완료되어 검수 대기 중입니다.`,
              link_url: '#review-region',
              metadata_json: JSON.stringify({ order_id: orderId }),
            });
          }
        }
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json({ ok: true, order_id: orderId, new_status: 'DONE' });
  });
}
