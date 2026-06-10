/**
 * services/orderService.js
 *
 * Core order creation logic.
 * Groups cart items by seller and creates individual orders.
 */

import { pool }                from "../config/db.js";
import { calculateDeliveryFee } from "./delivery.js";

/**
 * Create order group + per-seller orders from cart items.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.addressId
 * @param {Array}  opts.items        - cart items with sellerIds
 * @param {number} opts.subtotal
 * @param {string} opts.paymentMethod
 * @param {string|null} opts.couponCode
 * @param {number} opts.discount
 * @param {string|null} opts.notes
 *
 * @returns {{ orderGroupId, orders }}
 */
export async function createOrderGroup({
  userId,
  addressId,
  items,
  subtotal,
  paymentMethod,
  couponCode  = null,
  discount    = 0,
  notes       = null,
}) {
  const deliveryFee = calculateDeliveryFee(subtotal);
  const grandTotal  = subtotal + deliveryFee - discount;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── 1. Create order group (master) ── */
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

    /* ── 2. Group items by seller ── */
    const sellerMap = new Map();

    for (const item of items) {
      const sellerId = item.sellerId ?? "unknown";
      if (!sellerMap.has(sellerId)) {
        sellerMap.set(sellerId, []);
      }
      sellerMap.get(sellerId).push(item);
    }

    /* ── 3. Create one order per seller ── */
    const createdOrders = [];

    for (const [sellerId, sellerItems] of sellerMap.entries()) {
      const sellerSubtotal = sellerItems.reduce(
        (sum, i) => sum + (Number(i.price) * i.qty), 0
      );

      /* Create seller order */
      const { rows: [order] } = await client.query(
        `INSERT INTO public.orders
           (order_group_id, seller_id, subtotal, status)
         VALUES ($1,$2,$3,'pending')
         RETURNING id`,
        [orderGroupId, sellerId, sellerSubtotal]
      );

      /* Create order items */
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
        orderId:  order.id,
        sellerId,
        subtotal: sellerSubtotal,
        items:    sellerItems,
      });
    }

    /* ── 4. Clear cart after order created ── */
    await client.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id AND c.user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    return {
      orderGroupId,
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

/**
 * Mark order group as paid after payment confirmation.
 */
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

/**
 * Get full order group with all orders and items.
 */
export async function getOrderGroup(orderGroupId, userId) {
  /* Order group */
  const { rows: [group] } = await pool.query(
    `SELECT og.*, a.recipient_name, a.phone, a.address_line,
            a.city, a.state
     FROM public.order_groups og
     LEFT JOIN public.user_addresses a ON a.id = og.address_id
     WHERE og.id = $1 AND og.user_id = $2`,
    [orderGroupId, userId]
  );

  if (!group) return null;

  /* Seller orders + items */
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
      `SELECT * FROM public.order_items WHERE order_id = $1`,
      [order.id]
    );
    order.items = items;
  }

  return { ...group, orders };
}