// ================================================================
// Airflow OMS — 주문 서비스 항목(Order Items) + 가격 확정 v1.0
//
// 팀장이 현장에서:
//   1. 서비스 항목 추가/수정/삭제 (order_items CRUD)
//   2. 가격 확정 (READY_DONE → CONFIRMED)
//
// API:
//   GET    /orders/:order_id/items          — 주문 항목 목록
//   POST   /orders/:order_id/items          — 항목 추가
//   PUT    /orders/:order_id/items/:item_id — 항목 수정
//   DELETE /orders/:order_id/items/:item_id — 항목 삭제
//   POST   /orders/:order_id/confirm-price  — 가격 확정
//   GET    /service-catalog                 — 서비스 카탈로그 (카테고리+단가+옵션)
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';
import { transitionOrder } from '../../lib/state-machine';

export function mountItems(router: Hono<Env>) {

  // ─── 주문 항목 조회 ───
  router.get('/:order_id/items', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    const items = await db.prepare(`
      SELECT oi.*, sc.code as category_code, sc.group_name, sc.name as category_name
      FROM order_items oi
      JOIN service_categories sc ON oi.category_id = sc.category_id
      WHERE oi.order_id = ?
      ORDER BY sc.sort_order, oi.item_id
    `).bind(orderId).all();

    // 변경 이력도 함께 반환
    const changes = await db.prepare(`
      SELECT oic.*, u.name as changed_by_name
      FROM order_item_changes oic
      LEFT JOIN users u ON oic.changed_by = u.user_id
      WHERE oic.order_id = ?
      ORDER BY oic.changed_at DESC
    `).bind(orderId).all();

    return c.json({
      items: items.results,
      changes: changes.results,
    });
  });

  // ─── 항목 추가 ───
  router.post('/:order_id/items', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청' }, 400); }

    const { category_id, quantity = 1, model_name, options_json, notes } = body;
    if (!category_id) return c.json({ error: 'category_id 필수' }, 400);

    // 주문 존재 + 수정 가능 상태 확인
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first() as any;
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

    const editableStatuses = ['ASSIGNED', 'READY_DONE', 'CONFIRMED'];
    if (!editableStatuses.includes(order.status)) {
      return c.json({ error: `현재 상태(${order.status})에서는 항목을 추가할 수 없습니다.` }, 400);
    }

    // 카테고리 확인
    const category = await db.prepare('SELECT * FROM service_categories WHERE category_id = ? AND is_active = 1')
      .bind(category_id).first() as any;
    if (!category) return c.json({ error: '유효하지 않은 서비스 카테고리입니다.' }, 404);

    // 채널별 단가 조회
    let unitSellPrice = 0, unitWorkPrice = 0;
    if (order.channel_id) {
      const price = await db.prepare(`
        SELECT sell_price, work_price FROM service_prices
        WHERE category_id = ? AND channel_id = ? AND is_active = 1
          AND (effective_to IS NULL OR effective_to > datetime('now'))
        ORDER BY effective_from DESC LIMIT 1
      `).bind(category_id, order.channel_id).first() as any;
      if (price) {
        unitSellPrice = price.sell_price;
        unitWorkPrice = price.work_price;
      }
    }

    // 옵션 추가금 계산
    let optSellAdd = 0, optWorkAdd = 0;
    if (options_json) {
      try {
        const optionCodes = JSON.parse(options_json);
        if (Array.isArray(optionCodes) && optionCodes.length > 0) {
          const placeholders = optionCodes.map(() => '?').join(',');
          const opts = await db.prepare(
            `SELECT * FROM service_options WHERE code IN (${placeholders}) AND is_active = 1`
          ).bind(...optionCodes).all();
          for (const opt of opts.results as any[]) {
            optSellAdd += opt.additional_sell_price;
            optWorkAdd += opt.additional_work_price;
          }
        }
      } catch { /* ignore parse errors */ }
    }

    const totalSell = (unitSellPrice + optSellAdd) * quantity;
    const totalWork = (unitWorkPrice + optWorkAdd) * quantity;

    const result = await db.prepare(`
      INSERT INTO order_items (order_id, category_id, quantity, model_name, options_json,
        unit_sell_price, unit_work_price, total_sell_price, total_work_price, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId, category_id, quantity, model_name || null, options_json || null,
      unitSellPrice + optSellAdd, unitWorkPrice + optWorkAdd, totalSell, totalWork, notes || null
    ).run();

    // 변동 이력 기록
    await db.prepare(`
      INSERT INTO order_item_changes (order_id, item_id, change_type, reason, after_json, sell_diff, work_diff, changed_by)
      VALUES (?, ?, 'ADD', ?, ?, ?, ?, ?)
    `).bind(
      orderId, result.meta.last_row_id, '항목 추가',
      JSON.stringify({ category: category.name, quantity, model_name }),
      totalSell, totalWork, user.user_id
    ).run();

    // 가격 확정 해제 (항목 변경 시)
    if (order.price_confirmed === 1) {
      await db.prepare("UPDATE orders SET price_confirmed = 0, updated_at = datetime('now') WHERE order_id = ?")
        .bind(orderId).run();
    }

    return c.json({
      ok: true,
      item_id: result.meta.last_row_id,
      unit_sell_price: unitSellPrice + optSellAdd,
      unit_work_price: unitWorkPrice + optWorkAdd,
      total_sell_price: totalSell,
      total_work_price: totalWork,
    });
  });

  // ─── 항목 일괄 추가 (멀티 선택) ───
  router.post('/:order_id/items/bulk', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청' }, 400); }

    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: '추가할 항목이 없습니다.' }, 400);
    }
    if (items.length > 20) {
      return c.json({ error: '한번에 최대 20개 항목까지 추가할 수 있습니다.' }, 400);
    }

    // 주문 존재 + 수정 가능 상태 확인
    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first() as any;
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

    const editableStatuses = ['ASSIGNED', 'READY_DONE', 'CONFIRMED'];
    if (!editableStatuses.includes(order.status)) {
      return c.json({ error: `현재 상태(${order.status})에서는 항목을 추가할 수 없습니다.` }, 400);
    }

    const results: any[] = [];
    for (const item of items) {
      const { category_id, quantity = 1, model_name, options_json, notes } = item;
      if (!category_id) continue;

      // 카테고리 확인
      const category = await db.prepare('SELECT * FROM service_categories WHERE category_id = ? AND is_active = 1')
        .bind(category_id).first() as any;
      if (!category) continue;

      // 채널별 단가 조회
      let unitSellPrice = 0, unitWorkPrice = 0;
      if (order.channel_id) {
        const price = await db.prepare(`
          SELECT sell_price, work_price FROM service_prices
          WHERE category_id = ? AND channel_id = ? AND is_active = 1
            AND (effective_to IS NULL OR effective_to > datetime('now'))
          ORDER BY effective_from DESC LIMIT 1
        `).bind(category_id, order.channel_id).first() as any;
        if (price) {
          unitSellPrice = price.sell_price;
          unitWorkPrice = price.work_price;
        }
      }

      // 옵션 추가금 계산
      let optSellAdd = 0, optWorkAdd = 0;
      if (options_json) {
        try {
          const optionCodes = JSON.parse(options_json);
          if (Array.isArray(optionCodes) && optionCodes.length > 0) {
            const placeholders = optionCodes.map(() => '?').join(',');
            const opts = await db.prepare(
              `SELECT * FROM service_options WHERE code IN (${placeholders}) AND is_active = 1`
            ).bind(...optionCodes).all();
            for (const opt of opts.results as any[]) {
              optSellAdd += opt.additional_sell_price;
              optWorkAdd += opt.additional_work_price;
            }
          }
        } catch { /* ignore parse errors */ }
      }

      const totalSell = (unitSellPrice + optSellAdd) * quantity;
      const totalWork = (unitWorkPrice + optWorkAdd) * quantity;

      const result = await db.prepare(`
        INSERT INTO order_items (order_id, category_id, quantity, model_name, options_json,
          unit_sell_price, unit_work_price, total_sell_price, total_work_price, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId, category_id, quantity, model_name || null, options_json || null,
        unitSellPrice + optSellAdd, unitWorkPrice + optWorkAdd, totalSell, totalWork, notes || null
      ).run();

      // 변동 이력 기록
      await db.prepare(`
        INSERT INTO order_item_changes (order_id, item_id, change_type, reason, after_json, sell_diff, work_diff, changed_by)
        VALUES (?, ?, 'ADD', ?, ?, ?, ?, ?)
      `).bind(
        orderId, result.meta.last_row_id, '항목 일괄 추가',
        JSON.stringify({ category: category.name, quantity, model_name }),
        totalSell, totalWork, user.user_id
      ).run();

      results.push({
        item_id: result.meta.last_row_id,
        category_name: category.name,
        quantity,
        total_sell_price: totalSell,
        total_work_price: totalWork,
      });
    }

    // 가격 확정 해제 (항목 변경 시)
    if (order.price_confirmed === 1 && results.length > 0) {
      await db.prepare("UPDATE orders SET price_confirmed = 0, updated_at = datetime('now') WHERE order_id = ?")
        .bind(orderId).run();
    }

    return c.json({
      ok: true,
      added_count: results.length,
      items: results,
    });
  });

  // ─── 항목 수정 ───
  router.put('/:order_id/items/:item_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const itemId = Number(c.req.param('item_id'));

    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: '잘못된 요청' }, 400); }

    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first() as any;
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

    const editableStatuses = ['ASSIGNED', 'READY_DONE', 'CONFIRMED'];
    if (!editableStatuses.includes(order.status)) {
      return c.json({ error: `현재 상태(${order.status})에서는 항목을 수정할 수 없습니다.` }, 400);
    }

    const existingItem = await db.prepare('SELECT * FROM order_items WHERE item_id = ? AND order_id = ?')
      .bind(itemId, orderId).first() as any;
    if (!existingItem) return c.json({ error: '항목을 찾을 수 없습니다.' }, 404);

    const beforeJson = JSON.stringify(existingItem);

    const { quantity, model_name, options_json, notes, unit_sell_price, unit_work_price } = body;

    // 수동 가격 입력 지원 (팀장이 직접 단가 조정 가능)
    const newUnitSell = unit_sell_price !== undefined ? unit_sell_price : existingItem.unit_sell_price;
    const newUnitWork = unit_work_price !== undefined ? unit_work_price : existingItem.unit_work_price;
    const newQty = quantity !== undefined ? quantity : existingItem.quantity;
    const newTotalSell = newUnitSell * newQty;
    const newTotalWork = newUnitWork * newQty;

    const setClauses: string[] = [];
    const params: any[] = [];

    if (quantity !== undefined) { setClauses.push('quantity = ?'); params.push(quantity); }
    if (model_name !== undefined) { setClauses.push('model_name = ?'); params.push(model_name || null); }
    if (options_json !== undefined) { setClauses.push('options_json = ?'); params.push(options_json || null); }
    if (notes !== undefined) { setClauses.push('notes = ?'); params.push(notes || null); }

    setClauses.push('unit_sell_price = ?', 'unit_work_price = ?');
    params.push(newUnitSell, newUnitWork);
    setClauses.push('total_sell_price = ?', 'total_work_price = ?');
    params.push(newTotalSell, newTotalWork);
    setClauses.push("updated_at = datetime('now')");

    params.push(itemId, orderId);
    await db.prepare(`UPDATE order_items SET ${setClauses.join(', ')} WHERE item_id = ? AND order_id = ?`)
      .bind(...params).run();

    const sellDiff = newTotalSell - existingItem.total_sell_price;
    const workDiff = newTotalWork - existingItem.total_work_price;

    // 변동 이력
    await db.prepare(`
      INSERT INTO order_item_changes (order_id, item_id, change_type, reason, before_json, after_json, sell_diff, work_diff, changed_by)
      VALUES (?, ?, 'MODIFY', ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId, itemId, body.reason || '항목 수정', beforeJson,
      JSON.stringify({ quantity: newQty, unit_sell_price: newUnitSell, unit_work_price: newUnitWork, model_name: model_name ?? existingItem.model_name }),
      sellDiff, workDiff, user.user_id
    ).run();

    // 가격 확정 해제
    if (order.price_confirmed === 1) {
      await db.prepare("UPDATE orders SET price_confirmed = 0, updated_at = datetime('now') WHERE order_id = ?")
        .bind(orderId).run();
    }

    return c.json({ ok: true, total_sell_price: newTotalSell, total_work_price: newTotalWork });
  });

  // ─── 항목 삭제 ───
  router.delete('/:order_id/items/:item_id', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'REGION_ADMIN', 'TEAM_LEADER']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));
    const itemId = Number(c.req.param('item_id'));

    const order = await db.prepare('SELECT * FROM orders WHERE order_id = ?').bind(orderId).first() as any;
    if (!order) return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);

    const editableStatuses = ['ASSIGNED', 'READY_DONE', 'CONFIRMED'];
    if (!editableStatuses.includes(order.status)) {
      return c.json({ error: `현재 상태(${order.status})에서는 항목을 삭제할 수 없습니다.` }, 400);
    }

    const item = await db.prepare('SELECT * FROM order_items WHERE item_id = ? AND order_id = ?')
      .bind(itemId, orderId).first() as any;
    if (!item) return c.json({ error: '항목을 찾을 수 없습니다.' }, 404);

    await db.prepare('DELETE FROM order_items WHERE item_id = ? AND order_id = ?')
      .bind(itemId, orderId).run();

    // 변동 이력
    await db.prepare(`
      INSERT INTO order_item_changes (order_id, item_id, change_type, reason, before_json, sell_diff, work_diff, changed_by)
      VALUES (?, ?, 'REMOVE', ?, ?, ?, ?, ?)
    `).bind(
      orderId, itemId, '항목 삭제', JSON.stringify(item),
      -item.total_sell_price, -item.total_work_price, user.user_id
    ).run();

    if (order.price_confirmed === 1) {
      await db.prepare("UPDATE orders SET price_confirmed = 0, updated_at = datetime('now') WHERE order_id = ?")
        .bind(orderId).run();
    }

    return c.json({ ok: true });
  });

  // ─── 가격 확정 (READY_DONE → CONFIRMED) ───
  router.post('/:order_id/confirm-price', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'TEAM_LEADER', 'REGION_ADMIN']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const db = c.env.DB;
    const orderId = Number(c.req.param('order_id'));

    let body: any = {};
    try { body = await c.req.json(); } catch { /* optional */ }

    // 주문 항목 합계 계산
    const totals = await db.prepare(`
      SELECT COALESCE(SUM(total_sell_price), 0) as total_sell,
             COALESCE(SUM(total_work_price), 0) as total_work,
             COUNT(*) as item_count
      FROM order_items WHERE order_id = ?
    `).bind(orderId).first() as any;

    if (!totals || totals.item_count === 0) {
      return c.json({ error: '서비스 항목을 최소 1개 이상 추가해야 합니다.' }, 400);
    }

    // State Machine 적용 — READY_DONE → CONFIRMED
    const result = await transitionOrder(db, orderId, 'CONFIRMED', user, {
      note: body.note || `가격 확정: 판매가 ${totals.total_sell.toLocaleString()}원, 수행가 ${totals.total_work.toLocaleString()}원 (${totals.item_count}항목)`,
      additionalUpdates: {
        price_confirmed: 1,
        confirmed_total_sell: totals.total_sell,
        confirmed_total_work: totals.total_work,
        confirmed_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        confirmed_by: user.user_id,
      },
      afterTransition: async (db) => {
        // order_assignments 상태도 동기화
        await db.prepare(`
          UPDATE order_assignments SET status = 'CONFIRMED', updated_at = datetime('now')
          WHERE order_id = ? AND status IN ('ASSIGNED', 'READY_DONE')
        `).bind(orderId).run();
      },
    });

    if (!result.ok) {
      const statusCode = result.errorCode === 'ORDER_NOT_FOUND' ? 404
        : result.errorCode === 'UNAUTHORIZED' ? 403 : 400;
      return c.json({ error: result.error }, statusCode);
    }

    return c.json({
      ok: true,
      confirmed_total_sell: totals.total_sell,
      confirmed_total_work: totals.total_work,
      item_count: totals.item_count,
    });
  });
}

// ─── 서비스 카탈로그 (별도 라우트에서 마운트) ───
export function mountServiceCatalog(app: Hono<Env>) {
  app.get('/api/service-catalog', async (c) => {
    const authErr = requireAuth(c);
    if (authErr) return authErr;

    const db = c.env.DB;
    const channelId = c.req.query('channel_id');

    // 카테고리
    const categories = await db.prepare(`
      SELECT * FROM service_categories WHERE is_active = 1 ORDER BY sort_order
    `).all();

    // 단가 (채널 지정 시 해당 채널만)
    let pricesQuery = `
      SELECT sp.*, sc.code as category_code, sc.name as category_name, ch.name as channel_name
      FROM service_prices sp
      JOIN service_categories sc ON sp.category_id = sc.category_id
      JOIN order_channels ch ON sp.channel_id = ch.channel_id
      WHERE sp.is_active = 1 AND (sp.effective_to IS NULL OR sp.effective_to > datetime('now'))
    `;
    const priceBinds: any[] = [];
    if (channelId) {
      pricesQuery += ' AND sp.channel_id = ?';
      priceBinds.push(Number(channelId));
    }
    pricesQuery += ' ORDER BY sc.sort_order, ch.channel_id';
    const prices = await db.prepare(pricesQuery).bind(...priceBinds).all();

    // 옵션
    const options = await db.prepare(`
      SELECT * FROM service_options WHERE is_active = 1 ORDER BY option_id
    `).all();

    return c.json({
      categories: categories.results,
      prices: prices.results,
      options: options.results,
    });
  });
}
