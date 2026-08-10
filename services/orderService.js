/**
 * services/orderService.js
 *
 * Core order creation logic.
 * Splits cart by seller and creates:
 *   order_group → orders → order_items
 *
 * v2 — Robust column detection
 * ────────────────────────────────
 * ✓ Auto-detects if tracking_id column exists (won't crash if missing)
 * ✓ Preserves seller names properly
 * ✓ Better error messages
 */

import { pool }                 from "../config/db.js";
import { calculateDeliveryFee } from "./delivery.js";

/* ════════════════════════════════════════════════════════════
   COLUMN DETECTION (cached — runs once per server lifetime)
════════════════════════════════════════════════════════════ */
let ORDER_GROUP_COLS = null;

async function detectOrderGroupColumns() {
  if (ORDER_GROUP_COLS) return ORDER_GROUP_COLS;

  try {
    const { rows } = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'order_groups'`
    );

    const cols = new Set(rows.map((r) => r.column_name));

    ORDER_GROUP_COLS = {
      hasTrackingId:  cols.has("tracking_id"),
      hasDeliveredAt: cols.has("delivered_at"),
      hasUpdatedAt:   cols.has("updated_at"),
    };

    console.log("[orderService] Detected order_groups columns:", ORDER_GROUP_COLS);
  } catch (err) {
    console.warn("[orderService] Column detection failed:", err.message);
    ORDER_GROUP_COLS = {
      hasTrackingId:  true,
      hasDeliveredAt: true,
      hasUpdatedAt:   true,
    };
  }

  return ORDER_GROUP_COLS;
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function generateTrackingId(uuid) {
  return `ORD-${uuid.slice(0, 8).toUpperCase()}`;
}

/* ════════════════════════════════════════════════════════════
   CREATE ORDER GROUP
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

  const cols   = await detectOrderGroupColumns();
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
        userId,
        addressId,
        subtotal,
        deliveryFee,
        discount,
        grandTotal,
        paymentMethod,
        couponCode,
        notes,
      ]
    );

    const orderGroupId = group.id;
    const trackingId   = generateTrackingId(orderGroupId);

    /* ══════════════════════════════════════════════════
       Save tracking ID (only if column exists)
    ══════════════════════════════════════════════════ */
    if (cols.hasTrackingId) {
      try {
        await client.query(
          `UPDATE public.order_groups
           SET tracking_id = $1
           WHERE id = $2`,
          [trackingId, orderGroupId]
        );
      } catch (err) {
        console.warn("[orderService] tracking_id update failed:", err.message);
      }
    }

    /* ══════════════════════════════════════════════════
       2. Group items by seller
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
       3. Create one public.orders row per seller
    ══════════════════════════════════════════════════ */
    const createdOrders = [];

    for (const [sellerId, sellerData] of sellerMap.entries()) {
      const { items: sellerItems, sellerName } = sellerData;

      const sellerSubtotal = sellerItems.reduce(
        (sum, i) => sum + Number(i.price) * Number(i.qty),
        0
      );

      const { rows: [order] } = await client.query(
        `INSERT INTO public.orders
           (order_group_id, seller_id, subtotal, status)
         VALUES ($1,$2,$3,'pending')
         RETURNING id`,
        [orderGroupId, sellerId, sellerSubtotal]
      );

      for (const item of sellerItems) {
        await client.query(
          `INSERT INTO public.order_items
             (order_id, product_id, variant_id, name, image,
              sku, variant_name, qty, unit_price, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            order.id,
            item.productId,
            item.variant?.id   ?? null,
            item.name,
            item.image         ?? null,
            item.variant?.sku  ?? null,
            item.variant?.name ?? null,
            Number(item.qty),
            Number(item.price),
            Number(item.price) * Number(item.qty),
          ]
        );
      }

      createdOrders.push({
        orderId:    order.id,
        sellerId,
        sellerName,
        subtotal:   sellerSubtotal,
        items:      sellerItems,
      });
    }

    /* ══════════════════════════════════════════════════
       4. Clear buyer cart
    ══════════════════════════════════════════════════ */
    await client.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id
         AND c.user_id  = $1`,
      [userId]
    );

    await client.query("COMMIT");

    return {
      orderGroupId,
      trackingId,
      orders:       createdOrders,
      deliveryFee,
      grandTotal,
    };

  } catch (err) {
    await client.query("ROLLBACK");
    /* Log the SQL error before rethrowing so the route can see it */
    console.error("[orderService] createOrderGroup rolled back:", {
      message:    err.message,
      code:       err.code,
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
   MARK ORDER GROUP PAID
════════════════════════════════════════════════════════════ */
export async function markOrderGroupPaid(orderGroupId, paymentRef) {
  const cols   = await detectOrderGroupColumns();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updateClause = cols.hasUpdatedAt
      ? `updated_at = now(),`
      : "";

    await client.query(
      `UPDATE public.order_groups
       SET payment_status = 'paid',
           payment_ref    = $2,
           status         = 'confirmed'
           ${cols.hasUpdatedAt ? ", updated_at = now()" : ""}
       WHERE id = $1`,
      [orderGroupId, paymentRef]
    );

    await client.query(
      `UPDATE public.orders
       SET status     = 'confirmed'
           ${cols.hasUpdatedAt ? ", updated_at = now()" : ""}
       WHERE order_group_id = $1`,
      [orderGroupId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   MARK ORDER GROUP DELIVERED
════════════════════════════════════════════════════════════ */
export async function markOrderGroupDelivered(orderGroupId) {
  const cols   = await detectOrderGroupColumns();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (cols.hasDeliveredAt) {
      await client.query(
        `UPDATE public.order_groups
         SET status       = 'delivered',
             delivered_at = now()
             ${cols.hasUpdatedAt ? ", updated_at = now()" : ""}
         WHERE id = $1`,
        [orderGroupId]
      );

      await client.query(
        `UPDATE public.orders
         SET status       = 'delivered',
             delivered_at = now()
             ${cols.hasUpdatedAt ? ", updated_at = now()" : ""}
         WHERE order_group_id = $1`,
        [orderGroupId]
      );
    } else {
      await client.query(
        `UPDATE public.order_groups
         SET status = 'delivered'
             ${cols.hasUpdatedAt ? ", updated_at = now()" : ""}
         WHERE id = $1`,
        [orderGroupId]
      );

      await client.query(
        `UPDATE public.orders
         SET status = 'delivered'
             ${cols.hasUpdatedAt ? ", updated_at = now()" : ""}
         WHERE order_group_id = $1`,
        [orderGroupId]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   GET FULL ORDER GROUP
════════════════════════════════════════════════════════════ */
export async function getOrderGroup(orderGroupId, userId) {
  const { rows: [group] } = await pool.query(
    `SELECT
       og.*,
       a.recipient_name,
       a.phone,
       a.address_line,
       a.landmark,
       a.additional_directions,
       a.call_before_delivery,
       a.city,
       a.state
     FROM public.order_groups og
     LEFT JOIN public.user_addresses a
       ON a.id = og.address_id
     WHERE og.id      = $1
       AND og.user_id = $2`,
    [orderGroupId, userId]
  );

  if (!group) return null;

  const { rows: orders } = await pool.query(
    `SELECT
       o.*,
       u.name AS seller_name
     FROM public.orders o
     LEFT JOIN market.users u
       ON u.id = o.seller_id
     WHERE o.order_group_id = $1
     ORDER BY o.created_at ASC`,
    [orderGroupId]
  );

  for (const order of orders) {
    const { rows: items } = await pool.query(
      `SELECT * FROM public.order_items
       WHERE order_id = $1
       ORDER BY id`,
      [order.id]
    );
    order.items = items;
  }

  return {
    ...group,
    orders,
  };
}