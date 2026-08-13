/**
 * services/orderService.js  (v7 — coupon redemption inside transaction)
 *
 * Only createOrderGroup() and one new helper changed.
 * All column detection + other methods unchanged.
 */

/* ════════════════════════════════════════════════════════════
   HELPER — atomic coupon redemption inside order transaction
   ─────────────────────────────────────────────────────────
   Called inside createOrderGroup while the transaction is open.
   
   Behavior:
     • Locks the coupon row (SELECT FOR UPDATE) to prevent
       concurrent redemption races
     • Re-validates: active, not expired, under usage limit
     • Verifies user hasn't already redeemed (defense in depth)
     • Inserts coupon_redemptions row
     • Bumps usage_count + deactivates if single-use
   
   Throws if coupon is invalid — parent transaction rolls back.
   Returns silently if code is null/empty (no-op).
════════════════════════════════════════════════════════════ */
async function redeemCouponInTransaction(client, {
  code,
  userId,
  orderGroupId,
  discount,
}) {
  if (!code) return null;   /* No coupon — skip */

  const upperCode = String(code).trim().toUpperCase();
  if (!upperCode) return null;

  /* ── 1. Lock the coupon row for update ── */
  const { rows: [coupon] } = await client.query(
    `SELECT id, is_private, created_by, is_active,
            usage_limit, usage_count, expires_at
     FROM public.coupons
     WHERE UPPER(code) = $1
     FOR UPDATE`,
    [upperCode]
  );

  if (!coupon) {
    const err = new Error(`Coupon "${upperCode}" not found`);
    err.status = 400;
    throw err;
  }

  if (!coupon.is_active) {
    const err = new Error(`Coupon "${upperCode}" is no longer active`);
    err.status = 400;
    throw err;
  }

  if (coupon.is_private && coupon.created_by !== userId) {
    const err = new Error(`Coupon "${upperCode}" is not valid for your account`);
    err.status = 403;
    throw err;
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    const err = new Error(`Coupon "${upperCode}" has expired`);
    err.status = 400;
    throw err;
  }

  if (
    coupon.usage_limit !== null &&
    Number(coupon.usage_count) >= Number(coupon.usage_limit)
  ) {
    const err = new Error(`Coupon "${upperCode}" has reached its usage limit`);
    err.status = 400;
    throw err;
  }

  /* ── 2. Verify user hasn't already redeemed ── */
  const { rows: existing } = await client.query(
    `SELECT id FROM public.coupon_redemptions
     WHERE coupon_id = $1 AND user_id = $2
     LIMIT 1`,
    [coupon.id, userId]
  );

  if (existing.length) {
    const err = new Error(`You have already used coupon "${upperCode}"`);
    err.status = 400;
    throw err;
  }

  /* ── 3. Insert redemption row ── */
  await client.query(
    `INSERT INTO public.coupon_redemptions
       (coupon_id, user_id, order_id, discount)
     VALUES ($1, $2, $3, $4)`,
    [coupon.id, userId, orderGroupId, Number(discount || 0)]
  );

  /* ── 4. Bump usage count + auto-deactivate single-use ── */
  const isSingleUse =
    coupon.usage_limit !== null && Number(coupon.usage_limit) === 1;

  await client.query(
    `UPDATE public.coupons
     SET usage_count = usage_count + 1,
         is_active   = CASE
           WHEN $1 THEN false
           WHEN usage_limit IS NOT NULL
                AND usage_count + 1 >= usage_limit
           THEN false
           ELSE is_active
         END
     WHERE id = $2`,
    [isSingleUse, coupon.id]
  );

  console.log(
    `[orderService] ✓ Coupon "${upperCode}" redeemed by user=${userId} ` +
    `on order=${orderGroupId} (−₦${Number(discount).toLocaleString("en-NG")})`
  );

  return { couponId: coupon.id, code: upperCode };
}

/* ════════════════════════════════════════════════════════════
   CREATE ORDER GROUP  (v7 — atomic coupon redemption)
════════════════════════════════════════════════════════════ */
export async function createOrderGroup({
  userId,
  addressId,
  items,
  subtotal,
  paymentMethod,
  couponCode = null,
  discount   = 0,
  notes      = null,
}) {
  const deliveryFee = calculateDeliveryFee(subtotal);
  const grandTotal  = subtotal + deliveryFee - discount;

  const [groupCols, orderCols, itemCols] = await Promise.all([
    detectOrderGroupColumns(),
    detectOrderColumns(),
    detectOrderItemColumns(),
  ]);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ══════════════════════════════════════════════════
       1. Create master order group
    ══════════════════════════════════════════════════ */
    const { rows: [group] } = await client.query(
      `INSERT INTO public.order_groups
         (user_id, address_id, total_amount, delivery_fee,
          discount, grand_total, payment_method, coupon_code,
          notes, payment_status, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','pending')
       RETURNING id`,
      [
        userId, addressId, subtotal, deliveryFee, discount,
        grandTotal, paymentMethod, couponCode, notes,
      ]
    );

    const orderGroupId = group.id;
    const trackingId   = generateTrackingId(orderGroupId);

    /* Save tracking ID if column exists */
    if (groupCols.hasTrackingId) {
      try {
        await client.query(
          `UPDATE public.order_groups SET tracking_id = $1 WHERE id = $2`,
          [trackingId, orderGroupId]
        );
      } catch (err) {
        console.warn("[orderService] tracking_id update failed:", err.message);
      }
    }

    /* ══════════════════════════════════════════════════
       2. Redeem coupon (if provided) — INSIDE transaction
       ─────────────────────────────────────────────────
       If the coupon is invalid, an error throws here and
       the entire transaction rolls back — no orphan order.
    ══════════════════════════════════════════════════ */
    let redemption = null;
    if (couponCode) {
      try {
        redemption = await redeemCouponInTransaction(client, {
          code         : couponCode,
          userId,
          orderGroupId,
          discount,
        });
      } catch (couponErr) {
        /* Log with context — will be rethrown, triggering ROLLBACK */
        console.error(
          `[orderService] ❌ Coupon redemption failed for user=${userId}: ${couponErr.message}`
        );
        throw couponErr;
      }
    }

    /* ══════════════════════════════════════════════════
       3. Group items by seller
    ══════════════════════════════════════════════════ */
    const sellerMap = new Map();
    for (const item of items) {
      if (!item.sellerId) {
        throw new Error(`Missing seller ID for product "${item.name}"`);
      }
      if (!sellerMap.has(item.sellerId)) {
        sellerMap.set(item.sellerId, {
          sellerName: item.sellerName ?? "Seller",
          items:      [],
        });
      }
      sellerMap.get(item.sellerId).items.push(item);
    }

    /* ══════════════════════════════════════════════════
       4. Create one orders row per seller
    ══════════════════════════════════════════════════ */
    const createdOrders = [];

    for (const [sellerId, sellerData] of sellerMap.entries()) {
      const { items: sellerItems, sellerName } = sellerData;
      const sellerSubtotal = sellerItems.reduce(
        (sum, i) => sum + Number(i.price) * Number(i.qty),
        0
      );

      let orderSql, orderParams;
      if (orderCols.hasUserId) {
        orderSql = `
          INSERT INTO public.orders
            (order_group_id, user_id, seller_id, subtotal, status)
          VALUES ($1, $2, $3, $4, 'pending')
          RETURNING id
        `;
        orderParams = [orderGroupId, userId, sellerId, sellerSubtotal];
      } else {
        orderSql = `
          INSERT INTO public.orders
            (order_group_id, seller_id, subtotal, status)
          VALUES ($1, $2, $3, 'pending')
          RETURNING id
        `;
        orderParams = [orderGroupId, sellerId, sellerSubtotal];
      }

      const { rows: [order] } = await client.query(orderSql, orderParams);
      console.log(`[orderService] ✓ Created order ${order.id} for seller ${sellerId}`);

      for (const item of sellerItems) {
        const insert = buildOrderItemInsert(itemCols, order.id, sellerId, item);
        await client.query(insert.sql, insert.params);
      }

      createdOrders.push({
        orderId:  order.id,
        sellerId,
        sellerName,
        subtotal: sellerSubtotal,
        items:    sellerItems,
      });
    }

    /* ══════════════════════════════════════════════════
       5. Bump last_used_at on the address (cross-device UX)
    ══════════════════════════════════════════════════ */
    try {
      await client.query(
        `UPDATE public.user_addresses
         SET last_used_at = now()
         WHERE id = $1 AND user_id = $2`,
        [addressId, userId]
      );
    } catch (err) {
      /* Non-fatal — column may not exist yet in some envs */
      console.warn("[orderService] address last_used_at update skipped:", err.message);
    }

    /* ══════════════════════════════════════════════════
       6. Clear buyer cart
    ══════════════════════════════════════════════════ */
    await client.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id AND c.user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    /* ══════════════════════════════════════════════════
       7. Post-commit: invalidate coupon cache (best-effort)
       ─────────────────────────────────────────────────
       We do this AFTER commit so a cache-flush failure
       doesn't roll back the order.
    ══════════════════════════════════════════════════ */
    if (redemption) {
      invalidateCouponCache(userId).catch((err) =>
        console.warn("[orderService] coupon cache invalidation failed:", err.message)
      );
    }

    console.log(
      `[orderService] ✅ Created order group ${orderGroupId} ` +
      `with ${createdOrders.length} sub-orders` +
      (redemption ? ` + coupon "${redemption.code}"` : "")
    );

    return {
      orderGroupId,
      trackingId,
      orders:       createdOrders,
      deliveryFee,
      grandTotal,
      discount,
      couponCode:   redemption?.code ?? null,
    };

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] createOrderGroup rolled back:", {
      message:    err.message,
      code:       err.code,
      status:     err.status,
      detail:     err.detail,
      constraint: err.constraint,
      table:      err.table,
      column:     err.column,
    });
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   HELPER — invalidate user's coupon cache (best-effort)
   ─────────────────────────────────────────────────────────
   Dynamically imports the coupons route module so this
   service doesn't create a hard dependency on routes/*.
════════════════════════════════════════════════════════════ */
async function invalidateCouponCache(userId) {
  try {
    const mod = await import("../routes/coupons.js");
    if (typeof mod.invalidateUserCache === "function") {
      await mod.invalidateUserCache(userId);
    }
  } catch (err) {
    /* Coupons module may not be loaded, that's fine */
    console.warn("[orderService] could not invalidate coupon cache:", err.message);
  }
}