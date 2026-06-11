/**
 * services/orderService.js
 *
 * Core order creation logic.
 * Groups cart items by seller and creates individual orders.
 * Generates tracking ID: ORD-XXXXXXXX (first 8 chars of UUID)
 */

import { pool }                 from "../config/db.js";
import { calculateDeliveryFee } from "./delivery.js";

/* ── Generate tracking ID from UUID ── */
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── 1. Create order group ── */
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

    /* ── 2. Generate + store tracking ID ── */
    const trackingId = generateTrackingId(orderGroupId);

    await client.query(
      `UPDATE public.order_groups
       SET tracking_id = $1
       WHERE id = $2`,
      [trackingId, orderGroupId]
    );

    /* ── 3. Group items by seller ── */
    const sellerMap = new Map();

    for (const item of items) {
      const sellerId = item.sellerId ?? "unknown";
      if (!sellerMap.has(sellerId)) {
        sellerMap.set(sellerId, {
          sellerName: item.sellerName ?? null,
          items:      [],
        });
      }
      sellerMap.get(sellerId).items.push(item);
    }

    /* ── 4. Create one order per seller ── */
    const createdOrders = [];

    for (const [sellerId, sellerData] of sellerMap.entries()) {
      const { items: sellerItems, sellerName } = sellerData;

      const sellerSubtotal = sellerItems.reduce(
        (sum, i) => sum + Number(i.price) * i.qty, 0
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
            item.qty,
            Number(item.price),
            Number(item.price) * item.qty,
          ]
        );
      }

      createdOrders.push({
        orderId:     order.id,
        sellerId,
        sellerName,
        subtotal:    sellerSubtotal,
        items:       sellerItems,
      });
    }

    /* ── 5. Clear cart ── */
    await client.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id AND c.user_id = $1`,
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
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   MARK ORDER GROUP PAID
════════════════════════════════════════════════════════════ */
export async function markOrderGroupPaid(orderGroupId, paymentRef) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE public.order_groups
       SET payment_status = 'paid',
           payment_ref    = $2,
           status         = 'confirmed',
           updated_at     = now()
       WHERE id = $1`,
      [orderGroupId, paymentRef]
    );

    await client.query(
      `UPDATE public.orders
       SET status     = 'confirmed',
           updated_at = now()
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
   GET FULL ORDER GROUP
   Includes: address (with landmark), seller orders, items
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
     LEFT JOIN public.user_addresses a ON a.id = og.address_id
     WHERE og.id = $1 AND og.user_id = $2`,
    [orderGroupId, userId]
  );

  if (!group) return null;

  const { rows: orders } = await pool.query(
    `SELECT o.*, u.name AS seller_name
     FROM public.orders o
     LEFT JOIN market.users u ON u.id = o.seller_id
     WHERE o.order_group_id = $1
     ORDER BY o.created_at ASC`,
    [orderGroupId]
  );

  for (const order of orders) {
    const { rows: items } = await pool.query(
      `SELECT * FROM public.order_items WHERE order_id = $1 ORDER BY id`,
      [order.id]
    );
    order.items = items;
  }

  return { ...group, orders };
}