// ================================================================
// Airflow OMS — Email Service v1.0 (Resend 연동)
// 정산서 발송, 가입 확인, 시스템 알림 등 이메일 발송 담당
// ================================================================

/** Resend API 응답 */
interface ResendResponse {
  id?: string;
  error?: { message: string; name: string };
}

/** 이메일 발송 파라미터 */
export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

/** 이메일 서비스 설정 */
interface EmailConfig {
  apiKey: string;
  fromAddress?: string;
  fromName?: string;
}

/**
 * Resend API를 통한 이메일 발송
 * @see https://resend.com/docs/api-reference/emails/send-email
 */
export async function sendEmail(
  config: EmailConfig,
  params: SendEmailParams
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const from = params.from || `${config.fromName || 'Airflow OMS'} <${config.fromAddress || 'noreply@airflow.co.kr'}>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
        tags: params.tags,
      }),
    });

    const data = await response.json() as ResendResponse;

    if (!response.ok || data.error) {
      return {
        ok: false,
        error: data.error?.message || `HTTP ${response.status}`,
      };
    }

    return { ok: true, messageId: data.id };
  } catch (err: any) {
    return { ok: false, error: err.message || '이메일 발송 중 오류' };
  }
}

/**
 * 이메일 발송 + DB 로깅
 */
export async function sendEmailWithLog(
  db: D1Database,
  config: EmailConfig,
  params: SendEmailParams & {
    recipientUserId?: number;
    templateType: string;
    metadata?: Record<string, any>;
  }
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const result = await sendEmail(config, params);

  // 발송 이력 기록
  await db.prepare(`
    INSERT INTO email_send_logs (recipient_email, recipient_user_id, subject, template_type, status, resend_message_id, error_detail, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    params.to,
    params.recipientUserId || null,
    params.subject,
    params.templateType,
    result.ok ? 'SENT' : 'FAILED',
    result.messageId || null,
    result.error || null,
    JSON.stringify(params.metadata || {}),
  ).run();

  return result;
}

// ================================================================
// 이메일 템플릿 함수들
// ================================================================

/** 정산서 이메일 HTML 생성 */
export function buildSettlementEmailHTML(data: {
  recipientName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalCount: number;
  totalBase: number;
  totalCommission: number;
  totalPayable: number;
  items: Array<{
    orderNo: string;
    customerName: string;
    baseAmount: number;
    commissionAmount: number;
    payableAmount: number;
  }>;
}): string {
  const fmt = (n: number) => Number(n).toLocaleString('ko-KR') + '원';

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>정산서 — ${data.periodLabel}</title>
<style>
  body { font-family: -apple-system, 'Malgun Gothic', sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
  .container { max-width: 640px; margin: 0 auto; background: #fff; }
  .header { background: linear-gradient(135deg, #059669, #0d9488); color: #fff; padding: 32px; text-align: center; }
  .header h1 { margin: 0; font-size: 22px; }
  .header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }
  .body { padding: 32px; }
  .greeting { font-size: 15px; color: #333; margin-bottom: 24px; line-height: 1.6; }
  .summary { display: flex; gap: 12px; margin-bottom: 28px; }
  .summary-card { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; }
  .summary-card .label { font-size: 11px; color: #888; margin-bottom: 4px; }
  .summary-card .value { font-size: 18px; font-weight: 700; }
  .green { color: #059669; } .red { color: #dc2626; } .blue { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
  th { background: #f3f4f6; padding: 8px 10px; text-align: left; border-bottom: 2px solid #d1d5db; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  .text-right { text-align: right; }
  .total-row { background: #f0fdf4; font-weight: 700; }
  .footer { background: #f9fafb; padding: 20px 32px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; }
  .notice { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 12px; color: #9a3412; }
</style></head><body>
<div class="container">
  <div class="header">
    <h1>📋 정산서</h1>
    <p>${data.periodLabel} | ${data.periodStart} ~ ${data.periodEnd}</p>
  </div>
  <div class="body">
    <div class="greeting">
      <strong>${data.recipientName}</strong>님 안녕하세요.<br>
      아래와 같이 정산 내역을 안내드립니다.
    </div>
    <div class="summary">
      <div class="summary-card"><div class="label">건수</div><div class="value">${data.totalCount}건</div></div>
      <div class="summary-card"><div class="label">기본금액</div><div class="value blue">${fmt(data.totalBase)}</div></div>
      <div class="summary-card"><div class="label">수수료</div><div class="value red">${fmt(data.totalCommission)}</div></div>
      <div class="summary-card"><div class="label">지급액</div><div class="value green">${fmt(data.totalPayable)}</div></div>
    </div>
    <table>
      <thead><tr><th>주문번호</th><th>고객명</th><th class="text-right">금액</th><th class="text-right">수수료</th><th class="text-right">지급액</th></tr></thead>
      <tbody>
        ${data.items.map(i => `<tr>
          <td>${i.orderNo}</td><td>${i.customerName}</td>
          <td class="text-right">${fmt(i.baseAmount)}</td>
          <td class="text-right red">${fmt(i.commissionAmount)}</td>
          <td class="text-right green">${fmt(i.payableAmount)}</td>
        </tr>`).join('')}
        <tr class="total-row">
          <td colspan="2">합계 (${data.totalCount}건)</td>
          <td class="text-right">${fmt(data.totalBase)}</td>
          <td class="text-right red">${fmt(data.totalCommission)}</td>
          <td class="text-right green">${fmt(data.totalPayable)}</td>
        </tr>
      </tbody>
    </table>
    <div class="notice">
      ⚠️ 본 정산서는 자동 발송된 안내 메일입니다. 
      정산 내역에 이의가 있으시면 담당 관리자에게 문의해주세요.
    </div>
  </div>
  <div class="footer">
    Airflow OMS | 본 메일은 자동 발송 메일이며 회신되지 않습니다.
  </div>
</div></body></html>`;
}

/** 가입 승인 알림 이메일 HTML 생성 */
export function buildSignupApprovedEmailHTML(data: {
  name: string;
  loginId: string;
  teamName: string;
}): string {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>가입 승인 안내</title>
<style>
  body { font-family: -apple-system, 'Malgun Gothic', sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
  .container { max-width: 640px; margin: 0 auto; background: #fff; }
  .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; padding: 32px; text-align: center; }
  .header h1 { margin: 0; font-size: 22px; }
  .body { padding: 32px; }
  .info-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
  .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .info-row .label { color: #666; } .info-row .value { font-weight: 600; }
  .cta { text-align: center; margin: 28px 0; }
  .cta a { display: inline-block; background: #2563eb; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  .footer { background: #f9fafb; padding: 20px 32px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #e5e7eb; }
</style></head><body>
<div class="container">
  <div class="header">
    <h1>🎉 가입이 승인되었습니다</h1>
  </div>
  <div class="body">
    <p style="font-size:15px;color:#333;line-height:1.6">
      <strong>${data.name}</strong>님 안녕하세요.<br>
      Airflow OMS 팀장 가입이 승인되었습니다. 아래 정보로 로그인하세요.
    </p>
    <div class="info-box">
      <div class="info-row"><span class="label">로그인 ID</span><span class="value">${data.loginId}</span></div>
      <div class="info-row"><span class="label">팀명</span><span class="value">${data.teamName}</span></div>
    </div>
    <div class="cta">
      <a href="https://airflow.co.kr">로그인하기 →</a>
    </div>
  </div>
  <div class="footer">
    Airflow OMS | 본 메일은 자동 발송 메일이며 회신되지 않습니다.
  </div>
</div></body></html>`;
}
