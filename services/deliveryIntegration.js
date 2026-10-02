// services/deliveryIntegration.js
//
// Marketplace -> Loemart Delivery server-to-server integration.
//
// Delivery records are created when a seller moves a Marketplace sub-order
// to "shipped". The operation is retried from Marketplace every minute for
// shipped orders that do not yet have a Delivery link.

import { pool } from "../config/db.js";

const DEFAULT_DELIVERY_API_URL = "https://loemart-delivery.onrender.com";

let schemaReadyPromise = null;

function requiredConfig() {
  const apiUrl = (process.env.DELIVERY_API_URL || DEFAULT_DELIVERY_API_URL).replace(/\/$/, "");
  const apiKey = process.env.DELIVERY_INTERNAL_API_KEY;

  if (!apiKey) {
    throw new Error("DELIVERY_INTERNAL_API_KEY is not configured.");
  }

  return { apiUrl, apiKey };
}

export async function ensureDeliveryIntegrationSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS public.order_delivery_links (
        order_id UUID PRIMARY KEY,
        order_group_id UUID,
        delivery_id UUID,
        delivery_tracking_id STRING NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS order_delivery_links_group_idx
        ON public.order_delivery_links (order_group_id);

      CREATE INDEX IF NOT EXISTS order_delivery_links_tracking_idx
        ON public.order_delivery_links (delivery_tracking_id);
    `).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

async function fetchShippedOrder(orderId) {
  const { rows: [snapshot] } = await pool.query(
    `SELECT
       o.id,
       o.order_group_id,
       o.tracking_id,
       o.status,
       og.tracking_id AS order_group_tracking_id,
       og.user_id AS customer_user_id,

       seller.name AS seller_name,
       seller.phone_number AS seller_phone,
       seller.city AS seller_city,
       seller.state AS seller_state,

       vendor.store_name AS vendor_store_name,
       vendor.phone AS vendor_phone,
       vendor.store_address AS vendor_store_address,

       a.recipient_name,
       a.phone AS recipient_phone,
       a.address_line,
       a.bus_stop,
       a.landmark,
       a.additional_directions,
       a.city,
       a.state,
       a.call_before_delivery

     FROM public.orders o
     LEFT JOIN public.order_groups og
       ON og.id = o.order_group_id
     LEFT JOIN market.users seller
       ON seller.id = o.seller_id
     LEFT JOIN market.vendors vendor
       ON vendor.user_id = o.seller_id
     LEFT JOIN public.user_addresses a
       ON a.id = og.address_id
     WHERE o.id = $1
       AND o.status = 'shipped'
     LIMIT 1`,
    [orderId]
  );

  return snapshot ?? null;
}

function buildPickup(snapshot) {
  return {
    name: snapshot.vendor_store_name || snapshot.seller_name || "Loemart Seller",
    phone: snapshot.vendor_phone || snapshot.seller_phone || null,
    address: snapshot.vendor_store_address || null,
    city: snapshot.seller_city || null,
    state: snapshot.seller_state || null
  };
}

function buildRecipient(snapshot) {
  return {
    name: snapshot.recipient_name || "Customer",
    phone: snapshot.recipient_phone || null,
    addressLine: snapshot.address_line || null,
    city: snapshot.city || null,
    state: snapshot.state || null,
    landmark: snapshot.landmark || null,
    busStop: snapshot.bus_stop || null,
    additionalDirections: snapshot.additional_directions || null,
    callBeforeDelivery: Boolean(snapshot.call_before_delivery)
  };
}

export async function syncShippedOrderToDelivery(orderId) {
  await ensureDeliveryIntegrationSchema();

  console.log('[Delivery Integration] Sync requested:', { orderId });

  let snapshot;
  try {
    snapshot = await fetchShippedOrder(orderId);
  } catch (error) {
    console.error('[Delivery Integration] Marketplace order lookup failed:', {
      orderId,
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint
    });
    throw error;
  }

  if (!snapshot) {
    console.log('[Delivery Integration] Skipped: order is not shipped or was not found.', { orderId });
    return {
      success: false,
      skipped: true,
      reason: "Order is not shipped or does not exist."
    };
  }

  const { rows: [existingLink] } = await pool.query(
    `SELECT order_id, delivery_id, delivery_tracking_id
     FROM public.order_delivery_links
     WHERE order_id = $1
     LIMIT 1`,
    [snapshot.id]
  );

  if (existingLink) {
    return {
      success: true,
      existing: true,
      delivery: existingLink
    };
  }

  const pickup = buildPickup(snapshot);

  console.log('[Delivery Integration] Snapshot loaded:', {
    orderId: snapshot.id,
    trackingId: snapshot.tracking_id,
    orderGroupId: snapshot.order_group_id,
    customerUserId: snapshot.customer_user_id,
    pickupName: pickup.name,
    pickupCity: pickup.city,
    pickupState: pickup.state,
    hasPickupAddress: Boolean(pickup.address),
    hasRecipientAddress: Boolean(snapshot.address_line),
    recipientCity: snapshot.city,
    recipientState: snapshot.state
  });

  if (!pickup.address) {
    throw new Error(
      `Seller pickup address is missing for order ${snapshot.tracking_id || snapshot.id}.`
    );
  }

  const { apiUrl, apiKey } = requiredConfig();

  console.log('[Delivery Integration] Sending handoff to Delivery:', {
    orderId: snapshot.id,
    trackingId: snapshot.tracking_id,
    apiUrl
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${apiUrl}/api/internal/marketplace/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-loemart-internal-key": apiKey
      },
      body: JSON.stringify({
        externalOrderId: snapshot.id,
        externalOrderGroupId: snapshot.order_group_id,
        marketplaceTrackingId: snapshot.tracking_id,
        customerUserId: snapshot.customer_user_id,
        pickup,
        recipient: buildRecipient(snapshot)
      }),
      signal: controller.signal
    });

    const raw = await response.text();

    console.log('[Delivery Integration] Delivery response received:', {
      orderId: snapshot.id,
      httpStatus: response.status,
      ok: response.ok,
      bodyLength: raw.length
    });
    let payload = {};

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }

    if (!response.ok || !payload.success || !payload.delivery) {
      console.error('[Delivery Integration] Delivery handoff rejected:', {
        orderId: snapshot.id,
        httpStatus: response.status,
        message: payload.message || null,
        success: payload.success || false
      });
      throw new Error(
        payload.message ||
        `Delivery service returned HTTP ${response.status}.`
      );
    }

    const delivery = payload.delivery;

    await pool.query(
      `INSERT INTO public.order_delivery_links
         (order_id, order_group_id, delivery_id, delivery_tracking_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (order_id) DO UPDATE
       SET delivery_id = EXCLUDED.delivery_id,
           delivery_tracking_id = EXCLUDED.delivery_tracking_id,
           updated_at = NOW()`,
      [
        snapshot.id,
        snapshot.order_group_id,
        delivery.id,
        delivery.delivery_tracking_id
      ]
    );

    console.log(
      `[Delivery Integration] ✓ ${snapshot.tracking_id || snapshot.id} → ${delivery.delivery_tracking_id}`
    );

    return {
      success: true,
      existing: Boolean(payload.existing),
      delivery
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncPendingShippedOrders() {
  await ensureDeliveryIntegrationSchema();

  const { rows } = await pool.query(
    `SELECT o.id, o.tracking_id
     FROM public.orders o
     LEFT JOIN public.order_delivery_links l
       ON l.order_id = o.id
     WHERE o.status = 'shipped'
       AND l.order_id IS NULL
     ORDER BY o.shipped_at ASC NULLS FIRST, o.created_at ASC
     LIMIT 50`
  );

  for (const order of rows) {
    try {
      await syncShippedOrderToDelivery(order.id);
    } catch (error) {
      console.error(
        `[Delivery Integration] Failed for ${order.tracking_id || order.id}:`,
        error.message
      );
    }
  }

  return rows.length;
}

export function startDeliveryIntegrationJob() {
  const intervalMs = 60_000;

  const run = () =>
    syncPendingShippedOrders().catch((error) =>
      console.error("[Delivery Integration] Background sync failed:", error.message)
    );

  run();

  const timer = setInterval(run, intervalMs);
  timer.unref();

  console.log("[Delivery Integration] Background retry → every 60 seconds");

  return timer;
}
