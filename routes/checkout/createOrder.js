/**
 * services/orderService.js
 *
 * v5 — Fully adaptive column detection
 * ─────────────────────────────────────
 * ✓ Detects orders.user_id
 * ✓ Detects order_items real column names (name vs product_name)
 * ✓ Detects optional columns (variant_id, sku, image, etc.)
 * ✓ Only INSERTs into columns that exist
 * ✓ Works with any schema variant
 */

import { pool }                 from "../config/db.js";
import { calculateDeliveryFee } from "./delivery.js";

/* ════════════════════════════════════════════════════════════
   COLUMN DETECTION
════════════════════════════════════════════════════════════ */
let ORDER_GROUP_COLS = null;
let ORDER_COLS       = null;
let ORDER_ITEM_COLS  = null;

async function detectOrderGroupColumns() {
  if (ORDER_GROUP_COLS) return ORDER_GROUP_COLS;
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'order_groups'`
    );
    const cols = new Set(rows.map((r) => r.column_name));
    ORDER_GROUP_COLS = {
      hasTrackingId:  cols.has("tracking_id"),
      hasDeliveredAt: cols.has("delivered_at"),
      hasUpdatedAt:   cols.has("updated_at"),
    };
    console.log("[orderService] order_groups cols:", ORDER_GROUP_COLS);
  } catch (err) {
    console.warn("[orderService] order_groups detection failed:", err.message);
    ORDER_GROUP_COLS = { hasTrackingId: true, hasDeliveredAt: true, hasUpdatedAt: true };
  }
  return ORDER_GROUP_COLS;
}

async function detectOrderColumns() {
  if (ORDER_COLS) return ORDER_COLS;
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders'`
    );
    const cols = new Set(rows.map((r) => r.column_name));
    ORDER_COLS = {
      hasUserId:      cols.has("user_id"),
      hasDeliveredAt: cols.has("delivered_at"),
      hasUpdatedAt:   cols.has("updated_at"),
    };
    console.log("[orderService] orders cols:", ORDER_COLS);
  } catch (err) {
    console.warn("[orderService] orders detection failed:", err.message);
    ORDER_COLS = { hasUserId: true, hasDeliveredAt: true, hasUpdatedAt: true };
  }
  return ORDER_COLS;
}

/*
 * ✅ DETECTS ALL order_items COLUMNS
 * Figures out the actual column name for product name/title
 * and which optional columns exist.
 */
async function detectOrderItemColumns() {
  if (ORDER_ITEM_COLS) return ORDER_ITEM_COLS;
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'order_items'`
    );
    const cols = new Set(rows.map((r) => r.column_name));

    /* Figure out what the "name" column is called */
    let nameColumn = null;
    if      (cols.has("name"))         nameColumn = "name";
    else if (cols.has("product_name")) nameColumn = "product_name";
    else if (cols.has("item_name"))    nameColumn = "item_name";
    else if (cols.has("title"))        nameColumn = "title";

    /* Figure out price column name */
    let priceColumn = null;
    if      (cols.has("unit_price")) priceColumn = "unit_price";
    else if (cols.has("price"))      priceColumn = "price";

    /* Figure out qty column name */
    let qtyColumn = null;
    if      (cols.has("qty"))      qtyColumn = "qty";
    else if (cols.has("quantity")) qtyColumn = "quantity";

    /* Figure out subtotal column name */
    let subtotalColumn = null;
    if      (cols.has("subtotal"))    subtotalColumn = "subtotal";
    else if (cols.has("total_price")) subtotalColumn = "total_price";
    else if (cols.has("total"))       subtotalColumn = "total";

    ORDER_ITEM_COLS = {
      allColumns:     [...cols],
      nameColumn,
      priceColumn,
      qtyColumn,
      subtotalColumn,
      hasProductId:   cols.has("product_id"),
      hasVariantId:   cols.has("variant_id"),
      hasVariantName: cols.has("variant_name"),
      hasSku:         cols.has("sku"),
      hasImage:       cols.has("image"),
      hasImageUrl:    cols.has("image_url"),
    };

    console.log("[orderService] order_items cols:", ORDER_ITEM_COLS);

    if (!nameColumn) {
      console.error("[orderService] ⚠ order_items has NO name/product_name/title column!");
    }
    if (!priceColumn) {
      console.error("[orderService] ⚠ order_items has NO unit_price/price column!");
    }
    if (!qtyColumn) {
      console.error("[orderService] ⚠ order_items has NO qty/quantity column!");
    }

  } catch (err) {
    console.warn("[orderService] order_items detection failed:", err.message);
    ORDER_ITEM_COLS = {
      allColumns:     [],
      nameColumn:     "name",
      priceColumn:    "unit_price",
      qtyColumn:      "qty",
      subtotalColumn: "subtotal",
      hasProductId:   true,
      hasVariantId:   false,
      hasVariantName: false,
      hasSku:         false,
      hasImage:       false,
      hasImageUrl:    false,
    };
  }
  return ORDER_ITEM_COLS;
}

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function generateTrackingId(uuid) {
  return `ORD-${uuid.slice(0, 8).toUpperCase()}`;
}

/**
 * Build a dynamic INSERT for order_items based on the real schema.
 */
function buildOrderItemInsert(itemCols, orderId, item) {
  const columns = ["order_id"];
  const values  = [orderId];

  if (itemCols.hasProductId) {
    columns.push("product_id");
    values.push(item.productId);
  }

  if (itemCols.nameColumn) {
    columns.push(itemCols.nameColumn);
    values.push(item.name);
  }

  if (itemCols.qtyColumn) {
    columns.push(itemCols.qtyColumn);
    values.push(Number(item.qty));
  }

  if (itemCols.priceColumn) {
    columns.push(itemCols.priceColumn);
    values.push(Number(item.price));
  }

  if (itemCols.subtotalColumn) {
    columns.push(itemCols.subtotalColumn);
    values.push(Number(item.price) * Number(item.qty));
  }

  if (itemCols.hasVariantId) {
    columns.push("variant_id");
    values.push(item.variant?.id ?? null);
  }
  if (itemCols.hasVariantName) {
    columns.push("variant_name");
    values.push(item.variant?.name ?? null);
  }
  if (itemCols.hasSku) {
    columns.push("sku");
    values.push(item.variant?.sku ?? null);
  }
  if (itemCols.hasImage) {
    columns.push("image");
    values.push(item.image ?? null);
  }
  if (itemCols.hasImageUrl) {
    columns.push("image_url");
    values.push(item.image ?? null);
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

  return {
    sql: `INSERT INTO public.order_items (${columns.join(", ")}) VALUES (${placeholders})`,
    params: values,
  };
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

  const [groupCols, orderCols, itemCols] = await Promise.all([
    detectOrderGroupColumns(),
    detectOrderColumns(),
    detectOrderItemColumns(),
  ]);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* 1. Create master order group */
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

    /* 2. Group items by seller */
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

    /* 3. Create one orders row per seller */
    const createdOrders = [];

    for (const [sellerId, sellerData] of sellerMap.entries()) {
      const { items: sellerItems, sellerName } = sellerData;
      const sellerSubtotal = sellerItems.reduce(
        (sum, i) => sum + Number(i.price) * Number(i.qty),
        0
      );

      /* Dynamic INSERT for orders */
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

      /* ✅ Dynamic INSERT for order_items using real column names */
      for (const item of sellerItems) {
        const insert = buildOrderItemInsert(itemCols, order.id, item);
        console.log(`[orderService] Inserting item: ${insert.sql}`);
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

    /* 4. Clear buyer cart */
    await client.query(
      `DELETE FROM market.cart_items ci
       USING market.carts c
       WHERE ci.cart_id = c.id AND c.user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    console.log(`[orderService] ✅ Created order ${orderGroupId} with ${createdOrders.length} sub-orders`);

    return {
      orderGroupId,
      trackingId,
      orders:       createdOrders,
      deliveryFee,
      grandTotal,
    };

  } catch (err) {
    await client.query("ROLLBACK");
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
  const [groupCols, orderCols] = await Promise.all([
    detectOrderGroupColumns(),
    detectOrderColumns(),
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE public.order_groups
       SET payment_status = 'paid',
           payment_ref    = $2,
           status         = 'confirmed'
           ${groupCols.hasUpdatedAt ? ", updated_at = now()" : ""}
       WHERE id = $1`,
      [orderGroupId, paymentRef]
    );

    await client.query(
      `UPDATE public.orders
       SET status = 'confirmed'
           ${orderCols.hasUpdatedAt ? ", updated_at = now()" : ""}
       WHERE order_group_id = $1`,
      [orderGroupId]
    );

    await client.query("COMMIT");
    console.log(`[orderService] ✅ Order ${orderGroupId} marked paid`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] markOrderGroupPaid failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

/* ════════════════════════════════════════════════════════════
   MARK ORDER GROUP DELIVERED
════════════════════════════════════════════════════════════ */
export async function markOrderGroupDelivered(orderGroupId) {
  const [groupCols, orderCols] = await Promise.all([
    detectOrderGroupColumns(),
    detectOrderColumns(),
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const groupSet = ["status = 'delivered'"];
    if (groupCols.hasDeliveredAt) groupSet.push("delivered_at = now()");
    if (groupCols.hasUpdatedAt)   groupSet.push("updated_at   = now()");

    await client.query(
      `UPDATE public.order_groups SET ${groupSet.join(", ")} WHERE id = $1`,
      [orderGroupId]
    );

    const orderSet = ["status = 'delivered'"];
    if (orderCols.hasDeliveredAt) orderSet.push("delivered_at = now()");
    if (orderCols.hasUpdatedAt)   orderSet.push("updated_at   = now()");

    await client.query(
      `UPDATE public.orders SET ${orderSet.join(", ")} WHERE order_group_id = $1`,
      [orderGroupId]
    );

    await client.query("COMMIT");
    console.log(`[orderService] ✅ Order ${orderGroupId} marked delivered`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[orderService] markOrderGroupDelivered failed:", err.message);
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
      `SELECT * FROM public.order_items
       WHERE order_id = $1
       ORDER BY id`,
      [order.id]
    );
    order.items = items;
  }

  return { ...group, orders };
}