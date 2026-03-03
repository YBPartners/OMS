// ================================================================
// 다하다 OMS — 핸드폰 OTP 인증 라우트
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { checkRateLimit, normalizePhone, isValidPhone } from '../../middleware/security';

export function mountPhoneVerify(router: Hono<Env>) {

  // OTP 발송 요청
  router.post('/phone/send-otp', async (c) => {
    const db = c.env.DB;
    
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: '잘못된 요청 형식입니다.' }, 400);
    }

    const { phone, purpose = 'REGISTER', user_id } = body;

    if (!phone) return c.json({ error: '핸드폰 번호를 입력하세요.' }, 400);

    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      return c.json({ error: '올바른 핸드폰 번호를 입력하세요.' }, 400);
    }

    // Rate Limiting: 전화번호당 1분에 2회까지
    const rlKey = `otp:${normalizedPhone}`;
    const rl = checkRateLimit(rlKey, 2, 60_000);
    if (!rl.ok) {
      return c.json({ error: '인증번호가 이미 발송되었습니다. 1분 후 다시 시도하세요.' }, 429);
    }

    // DB 기반 도배 방지
    const recent = await db.prepare(`
      SELECT verification_id FROM phone_verifications 
      WHERE phone = ? AND purpose = ? AND created_at > datetime('now', '-1 minutes')
    `).bind(normalizedPhone, purpose).first();

    if (recent) return c.json({ error: '인증번호가 이미 발송되었습니다. 1분 후 다시 시도하세요.' }, 429);

    // 6자리 OTP 생성
    const randomBuf = crypto.getRandomValues(new Uint32Array(1));
    const otp = String(100000 + (randomBuf[0] % 900000));
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();

    await db.prepare(`
      INSERT INTO phone_verifications (phone, otp_code, purpose, user_id, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(normalizedPhone, otp, purpose, user_id || null, expiresAt).run();

    console.log(`[SMS 시뮬레이션] ${normalizedPhone}에 OTP: ${otp} 발송`);

    const response: any = { 
      ok: true, 
      message: `인증번호가 ${normalizedPhone}으로 발송되었습니다. (3분 이내 입력)`,
      expires_at: expiresAt,
    };

    if ((c.env as any).DEV_MODE === 'true') {
      response._dev_otp = otp;
    }

    return c.json(response);
  });

  // OTP 검증
  router.post('/phone/verify-otp', async (c) => {
    const db = c.env.DB;
    const { phone, otp_code, purpose = 'REGISTER' } = await c.req.json();

    if (!phone || !otp_code) return c.json({ error: '핸드폰 번호와 인증번호를 입력하세요.' }, 400);

    const normalizedPhone = normalizePhone(phone);

    const rlKey = `otp-verify:${normalizedPhone}`;
    const rl = checkRateLimit(rlKey, 10, 60_000);
    if (!rl.ok) {
      return c.json({ error: '인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요.' }, 429);
    }

    const verification = await db.prepare(`
      SELECT * FROM phone_verifications
      WHERE phone = ? AND purpose = ? AND verified = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).bind(normalizedPhone, purpose).first();

    if (!verification) return c.json({ error: '유효한 인증 요청이 없습니다. 인증번호를 다시 요청하세요.' }, 400);

    if ((verification.attempts as number) >= 5) {
      return c.json({ error: '인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청하세요.' }, 429);
    }

    await db.prepare('UPDATE phone_verifications SET attempts = attempts + 1 WHERE verification_id = ?').bind(verification.verification_id).run();

    if (verification.otp_code !== otp_code) {
      const remaining = 5 - (verification.attempts as number) - 1;
      return c.json({ error: `인증번호가 틀렸습니다. (남은 시도: ${remaining}회)` }, 400);
    }

    await db.prepare('UPDATE phone_verifications SET verified = 1 WHERE verification_id = ?').bind(verification.verification_id).run();

    if (verification.user_id) {
      await db.prepare("UPDATE users SET phone_verified = 1, updated_at = datetime('now') WHERE user_id = ?").bind(verification.user_id).run();
    }

    return c.json({ ok: true, verified: true, message: '핸드폰 인증이 완료되었습니다.' });
  });

  // 핸드폰 인증 상태 확인
  router.get('/phone/status', async (c) => {
    const db = c.env.DB;
    const phone = c.req.query('phone');
    if (!phone) return c.json({ error: '핸드폰 번호를 입력하세요.' }, 400);

    const normalizedPhone = normalizePhone(phone);

    const verified = await db.prepare(`
      SELECT verification_id, verified, created_at FROM phone_verifications
      WHERE phone = ? AND verified = 1 ORDER BY created_at DESC LIMIT 1
    `).bind(normalizedPhone).first();

    const user = await db.prepare(`
      SELECT user_id, name, phone_verified FROM users WHERE phone = ? AND status = 'ACTIVE'
    `).bind(normalizedPhone).first();

    return c.json({
      phone: normalizedPhone,
      has_verified_record: !!verified,
      last_verified_at: verified?.created_at || null,
      registered_user: user ? { user_id: user.user_id, name: user.name, phone_verified: user.phone_verified } : null,
    });
  });
}
