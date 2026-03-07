// ================================================================
// Airflow OMS — 정산 보고서 / 대리점 정산 내역서 v11.0
// 인쇄용 HTML 생성 + CSV 내보내기 + 대리점 수수료
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { sendEmailWithLog, buildSettlementEmailHTML } from '../../services/email-service';

export function mountReport(router: Hono<Env>) {

  // ─── 딜러(팀장)별 계산서 (Invoice) 조회 ───
  router.get('/runs/:run_id/invoice/:team_leader_id', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const runId = Number(c.req.param('run_id'));
    const leaderId = Number(c.req.param('team_leader_id'));
    if (isNaN(runId) || isNaN(leaderId)) return c.json({ error: '유효하지 않은 파라미터입니다.' }, 400);

    // Scope 체크: TEAM은 자기 계산서만
    if (user.roles.includes('TEAM_LEADER') && !user.roles.some(r => ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN'].includes(r))) {
      if (user.user_id !== leaderId) return c.json({ error: '권한이 없습니다.' }, 403);
    }

    const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first() as any;
    if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);

    // 팀장 정보
    const leader = await db.prepare(`
      SELECT u.user_id, u.name, u.phone, u.email, u.login_id,
             o.name as org_name, o.code as org_code, o.org_id,
             po.name as parent_org_name
      FROM users u
      JOIN organizations o ON u.org_id = o.org_id
      LEFT JOIN organizations po ON o.parent_org_id = po.org_id
      WHERE u.user_id = ?
    `).bind(leaderId).first() as any;
    if (!leader) return c.json({ error: '팀장을 찾을 수 없습니다.' }, 404);

    // 수수료 정책
    const policy = await db.prepare(`
      SELECT * FROM commission_policies
      WHERE (team_leader_id = ? OR (org_id = ? AND team_leader_id IS NULL))
        AND is_active = 1
      ORDER BY team_leader_id DESC, effective_from DESC LIMIT 1
    `).bind(leaderId, leader.org_id).first() as any;

    // 정산 명세
    const settlements = await db.prepare(`
      SELECT s.*, o.external_order_no, o.customer_name, o.address_text,
             o.requested_date, o.base_amount as order_base_amount
      FROM settlements s
      JOIN orders o ON s.order_id = o.order_id
      WHERE s.run_id = ? AND s.team_leader_id = ?
      ORDER BY o.requested_date, o.order_id
    `).bind(runId, leaderId).all();
    const items = settlements.results as any[];

    if (items.length === 0) return c.json({ error: '해당 팀장의 정산 내역이 없습니다.' }, 404);

    // ★ 산출 절차에 따른 계산서 구성
    // ① 주문 집계
    const totalCount = items.length;
    const totalBaseAmount = items.reduce((s, i) => s + i.base_amount, 0);

    // ② 수수료 정책 적용
    const commissionMode = items[0]?.commission_mode || 'PERCENT';
    const commissionRate = items[0]?.commission_rate || 0;
    const totalCommission = items.reduce((s, i) => s + i.commission_amount, 0);

    // ③ 공제항목 (향후 확장 가능 - 선급금, 벌금 등)
    const deductions = [];
    // TODO: 선급금 공제, 지연 벌금 등 추후 확장
    const totalDeductions = deductions.reduce((s: number, d: any) => s + d.amount, 0);

    // ④ 최종 지급액
    const totalPayable = items.reduce((s, i) => s + i.payable_amount, 0);
    const netPayable = totalPayable - totalDeductions;

    // 일자별 소계
    const dailySummary: Record<string, { count: number; base: number; commission: number; payable: number }> = {};
    for (const item of items) {
      const date = item.requested_date || 'unknown';
      if (!dailySummary[date]) dailySummary[date] = { count: 0, base: 0, commission: 0, payable: 0 };
      dailySummary[date].count++;
      dailySummary[date].base += item.base_amount;
      dailySummary[date].commission += item.commission_amount;
      dailySummary[date].payable += item.payable_amount;
    }

    const periodLabel = run.period_type === 'WEEKLY' ? '주간' : '월간';

    return c.json({
      invoice: {
        // 헤더
        invoiceNo: `INV-${runId}-${leaderId}`,
        issueDate: new Date().toISOString().split('T')[0],
        periodLabel,
        periodStart: run.period_start,
        periodEnd: run.period_end,
        runId,
        runStatus: run.status,

        // 수신인
        recipient: {
          name: leader.name,
          phone: leader.phone,
          email: leader.email,
          loginId: leader.login_id,
          orgName: leader.org_name,
          orgCode: leader.org_code,
          parentOrgName: leader.parent_org_name,
        },

        // 수수료 정책
        commissionPolicy: {
          mode: commissionMode,
          rate: commissionRate,
          label: commissionMode === 'FIXED'
            ? `정액 ${Number(commissionRate).toLocaleString('ko-KR')}원/건`
            : `정률 ${commissionRate}%`,
          effectiveFrom: policy?.effective_from || '-',
        },

        // ★ 산출 절차
        calculation: {
          step1_orderSummary: {
            label: '① 주문 집계',
            totalCount,
            totalBaseAmount,
          },
          step2_commission: {
            label: '② 수수료 적용',
            mode: commissionMode,
            rate: commissionRate,
            totalCommission,
          },
          step3_deductions: {
            label: '③ 공제항목',
            items: deductions,
            totalDeductions,
          },
          step4_netPayable: {
            label: '④ 최종 지급액',
            grossPayable: totalPayable,
            deductions: totalDeductions,
            netPayable,
          },
        },

        // 일자별 소계
        dailySummary: Object.entries(dailySummary)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({ date, ...d })),

        // 상세 내역
        items: items.map((i, idx) => ({
          seq: idx + 1,
          orderId: i.order_id,
          externalOrderNo: i.external_order_no,
          customerName: i.customer_name,
          address: i.address_text,
          // serviceType: i.service_type,  // removed - now in order_items
          requestedDate: i.requested_date,
          baseAmount: i.base_amount,
          commissionMode: i.commission_mode,
          commissionRate: i.commission_rate,
          commissionAmount: i.commission_amount,
          payableAmount: i.payable_amount,
          status: i.status,
        })),

        // 합계
        totals: {
          count: totalCount,
          baseAmount: totalBaseAmount,
          commission: totalCommission,
          deductions: totalDeductions,
          netPayable,
        },
      },
    });
  });

  // ─── 정산 보고서 인쇄용 HTML ───
  router.get('/runs/:run_id/report', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const runId = Number(c.req.param('run_id'));
    if (isNaN(runId)) return c.json({ error: '유효하지 않은 Run ID입니다.' }, 400);

    const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first() as any;
    if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);

    let detailQuery = `
      SELECT s.*, o.external_order_no, o.customer_name, o.address_text,
             u.name as team_leader_name, org.name as region_name, team_org.name as team_name
      FROM settlements s
      JOIN orders o ON s.order_id = o.order_id
      JOIN users u ON s.team_leader_id = u.user_id
      JOIN organizations org ON s.region_org_id = org.org_id
      LEFT JOIN organizations team_org ON s.team_org_id = team_org.org_id
      WHERE s.run_id = ?
    `;
    const params: any[] = [runId];

    if (user.org_type === 'REGION') {
      detailQuery += ' AND s.region_org_id = ?';
      params.push(user.org_id);
    } else if (user.org_type === 'TEAM') {
      detailQuery += ' AND s.team_leader_id = ?';
      params.push(user.user_id);
    }
    detailQuery += ' ORDER BY s.region_org_id, s.team_leader_id';

    const details = await db.prepare(detailQuery).bind(...params).all();
    const settlements = details.results as any[];

    // 팀장별 그룹핑
    const grouped: Record<string, { name: string; region: string; team: string; items: any[]; totalBase: number; totalComm: number; totalPay: number }> = {};
    for (const s of settlements) {
      const key = String(s.team_leader_id);
      if (!grouped[key]) grouped[key] = { name: s.team_leader_name, region: s.region_name, team: s.team_name || '-', items: [], totalBase: 0, totalComm: 0, totalPay: 0 };
      grouped[key].items.push(s);
      grouped[key].totalBase += s.base_amount;
      grouped[key].totalComm += s.commission_amount;
      grouped[key].totalPay += s.payable_amount;
    }

    const totalBase = settlements.reduce((s, i) => s + i.base_amount, 0);
    const totalComm = settlements.reduce((s, i) => s + i.commission_amount, 0);
    const totalPay = settlements.reduce((s, i) => s + i.payable_amount, 0);
    const fmt = (n: number) => n.toLocaleString('ko-KR') + '원';
    const now = new Date().toISOString().slice(0, 10);

    return c.json({
      report: {
        run,
        summary: { total_count: settlements.length, total_base: totalBase, total_commission: totalComm, total_payable: totalPay },
        grouped: Object.entries(grouped).map(([id, g]) => ({
          team_leader_id: Number(id), name: g.name, region: g.region, team: g.team,
          count: g.items.length, total_base: g.totalBase, total_commission: g.totalComm, total_payable: g.totalPay,
          items: g.items.map(s => ({
            order_id: s.order_id, external_order_no: s.external_order_no, customer_name: s.customer_name,
            address_text: s.address_text,
            base_amount: s.base_amount, commission_mode: s.commission_mode, commission_rate: s.commission_rate,
            commission_amount: s.commission_amount, payable_amount: s.payable_amount,
          })),
        })),
        generated_at: now,
      },
    });
  });

  // ─── 정산 CSV 데이터 ───
  router.get('/runs/:run_id/export', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const runId = Number(c.req.param('run_id'));
    if (isNaN(runId)) return c.json({ error: '유효하지 않은 Run ID입니다.' }, 400);

    let q = `
      SELECT s.settlement_id, s.order_id, o.external_order_no, o.customer_name, o.address_text,
             s.base_amount, s.commission_mode, s.commission_rate,
             s.commission_amount, s.payable_amount, s.status,
             u.name as team_leader_name, org.name as region_name,
             ch.name as channel_name
      FROM settlements s
      JOIN orders o ON s.order_id = o.order_id
      JOIN users u ON s.team_leader_id = u.user_id
      JOIN organizations org ON s.region_org_id = org.org_id
      LEFT JOIN order_channels ch ON o.channel_id = ch.channel_id
      WHERE s.run_id = ?
    `;
    const params: any[] = [runId];
    if (user.org_type === 'REGION') { q += ' AND s.region_org_id = ?'; params.push(user.org_id); }
    else if (user.org_type === 'TEAM') { q += ' AND s.team_leader_id = ?'; params.push(user.user_id); }
    q += ' ORDER BY s.region_org_id, s.team_leader_id';

    const result = await db.prepare(q).bind(...params).all();
    return c.json({ rows: result.results });
  });

  // ─── 대리점 정산 내역서 ───
  router.get('/agency-statement', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const { from, to } = c.req.query();

    // AGENCY_LEADER 또는 HQ가 조회 가능
    const isAgency = user.roles.includes('AGENCY_LEADER');
    const isHQ = user.org_type === 'HQ';
    if (!isAgency && !isHQ) return c.json({ error: '대리점 또는 HQ 권한이 필요합니다.' }, 403);

    // 대리점 하위 팀장 목록
    let teamLeaderIds: number[] = [];
    if (isAgency) {
      const mappings = await db.prepare(
        'SELECT team_leader_id FROM agency_team_mappings WHERE agency_user_id = ?'
      ).bind(user.user_id).all();
      teamLeaderIds = (mappings.results as any[]).map(m => m.team_leader_id);
      teamLeaderIds.push(user.user_id); // 대리점장 자신 포함
    } else {
      // HQ: agency_user_id 파라미터 필요
      const agencyId = c.req.query('agency_user_id');
      if (!agencyId) return c.json({ error: 'agency_user_id 파라미터가 필요합니다.' }, 400);
      const mappings = await db.prepare(
        'SELECT team_leader_id FROM agency_team_mappings WHERE agency_user_id = ?'
      ).bind(Number(agencyId)).all();
      teamLeaderIds = (mappings.results as any[]).map(m => m.team_leader_id);
      teamLeaderIds.push(Number(agencyId));
    }

    if (teamLeaderIds.length === 0) return c.json({ statement: { leaders: [], totals: { count: 0, base: 0, commission: 0, payable: 0 } } });

    const placeholders = teamLeaderIds.map(() => '?').join(',');
    let q = `
      SELECT s.*, o.external_order_no, o.customer_name, u.name as team_leader_name,
             org.name as region_name
      FROM settlements s
      JOIN orders o ON s.order_id = o.order_id
      JOIN users u ON s.team_leader_id = u.user_id
      JOIN organizations org ON s.region_org_id = org.org_id
      WHERE s.team_leader_id IN (${placeholders}) AND s.status IN ('CONFIRMED','PAID')
    `;
    const params: any[] = [...teamLeaderIds];
    if (from) { q += ' AND o.requested_date >= ?'; params.push(from); }
    if (to) { q += ' AND o.requested_date <= ?'; params.push(to); }
    q += ' ORDER BY o.requested_date DESC';

    const result = await db.prepare(q).bind(...params).all();
    const items = result.results as any[];

    // 팀장별 그룹핑
    const byLeader: Record<number, { name: string; items: any[]; base: number; commission: number; payable: number }> = {};
    for (const item of items) {
      const lid = item.team_leader_id;
      if (!byLeader[lid]) byLeader[lid] = { name: item.team_leader_name, items: [], base: 0, commission: 0, payable: 0 };
      byLeader[lid].items.push(item);
      byLeader[lid].base += item.base_amount;
      byLeader[lid].commission += item.commission_amount;
      byLeader[lid].payable += item.payable_amount;
    }

    const totalBase = items.reduce((s, i) => s + i.base_amount, 0);
    const totalComm = items.reduce((s, i) => s + i.commission_amount, 0);
    const totalPay = items.reduce((s, i) => s + i.payable_amount, 0);

    return c.json({
      statement: {
        leaders: Object.entries(byLeader).map(([id, d]) => ({
          team_leader_id: Number(id), name: d.name, count: d.items.length,
          total_base: d.base, total_commission: d.commission, total_payable: d.payable,
          items: d.items.map(i => ({
            settlement_id: i.settlement_id, order_id: i.order_id, external_order_no: i.external_order_no,
            customer_name: i.customer_name, base_amount: i.base_amount,
            commission_amount: i.commission_amount, payable_amount: i.payable_amount, status: i.status,
          })),
        })),
        totals: { count: items.length, base: totalBase, commission: totalComm, payable: totalPay },
      },
    });
  });

  // ─── 정산서 이메일 발송 ───
  router.post('/runs/:run_id/send-email', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const runId = Number(c.req.param('run_id'));
    if (isNaN(runId)) return c.json({ error: '유효하지 않은 Run ID입니다.' }, 400);

    const apiKey = c.env.RESEND_API_KEY;
    if (!apiKey) return c.json({ error: '이메일 발송 설정이 되어있지 않습니다. (RESEND_API_KEY 미설정)' }, 500);

    const run = await db.prepare('SELECT * FROM settlement_runs WHERE run_id = ?').bind(runId).first() as any;
    if (!run) return c.json({ error: '정산 Run을 찾을 수 없습니다.' }, 404);

    // 정산 데이터 팀장별 그룹핑 + 이메일 조회
    let detailQuery = `
      SELECT s.*, o.external_order_no, o.customer_name, o.address_text,
             u.name as team_leader_name, u.email as team_leader_email, u.user_id as leader_user_id
      FROM settlements s
      JOIN orders o ON s.order_id = o.order_id
      JOIN users u ON s.team_leader_id = u.user_id
      WHERE s.run_id = ?
    `;
    const params: any[] = [runId];
    if (user.org_type === 'REGION') {
      detailQuery += ' AND s.region_org_id = ?';
      params.push(user.org_id);
    }
    detailQuery += ' ORDER BY s.team_leader_id';

    const details = await db.prepare(detailQuery).bind(...params).all();
    const settlements = details.results as any[];

    // 팀장별 그룹
    const byLeader: Record<number, { name: string; email: string; userId: number; items: any[]; totalBase: number; totalComm: number; totalPay: number }> = {};
    for (const s of settlements) {
      const key = s.team_leader_id;
      if (!byLeader[key]) byLeader[key] = { name: s.team_leader_name, email: s.team_leader_email, userId: s.leader_user_id, items: [], totalBase: 0, totalComm: 0, totalPay: 0 };
      byLeader[key].items.push(s);
      byLeader[key].totalBase += s.base_amount;
      byLeader[key].totalComm += s.commission_amount;
      byLeader[key].totalPay += s.payable_amount;
    }

    const periodLabel = run.period_type === 'WEEKLY' ? '주간' : '월간';
    const results: { leaderId: number; name: string; email: string; ok: boolean; error?: string }[] = [];

    for (const [leaderId, data] of Object.entries(byLeader)) {
      if (!data.email) {
        results.push({ leaderId: Number(leaderId), name: data.name, email: '', ok: false, error: '이메일 미등록' });
        continue;
      }

      const html = buildSettlementEmailHTML({
        recipientName: data.name,
        periodLabel,
        periodStart: run.period_start,
        periodEnd: run.period_end,
        totalCount: data.items.length,
        totalBase: data.totalBase,
        totalCommission: data.totalComm,
        totalPayable: data.totalPay,
        items: data.items.map(i => ({
          orderNo: i.external_order_no || `#${i.order_id}`,
          customerName: i.customer_name || '-',
          baseAmount: i.base_amount,
          commissionAmount: i.commission_amount,
          payableAmount: i.payable_amount,
        })),
      });

      const emailResult = await sendEmailWithLog(db, { apiKey }, {
        to: data.email,
        subject: `[Airflow OMS] ${periodLabel} 정산서 — ${run.period_start}~${run.period_end}`,
        html,
        templateType: 'SETTLEMENT_REPORT',
        recipientUserId: data.userId,
        metadata: { run_id: runId, period: `${run.period_start}~${run.period_end}` },
      });

      results.push({ leaderId: Number(leaderId), name: data.name, email: data.email, ok: emailResult.ok, error: emailResult.error });
    }

    const successCount = results.filter(r => r.ok).length;
    const failCount = results.filter(r => !r.ok).length;

    return c.json({
      ok: true,
      run_id: runId,
      total_recipients: results.length,
      sent: successCount,
      failed: failCount,
      details: results,
      message: `${successCount}명에게 정산서 이메일을 발송했습니다.${failCount > 0 ? ` (${failCount}명 실패)` : ''}`,
    });
  });
}
