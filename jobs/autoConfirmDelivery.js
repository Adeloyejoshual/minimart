// server/jobs/autoConfirmDelivery.js

import { pool } from "../server.js";
import { sendNotification } from "../services/notificationService.js";

// ═════════════════════════════════════════════════════════════
// AUTO CONFIRM DELIVERY
//
// If buyer hasn't confirmed delivery within AUTO_CONFIRM_DAYS,
// system automatically marks the order as delivered and
// schedules balance release.
//
// This prevents sellers from waiting forever.
// ═════════════════════════════════════════════════════════════

const AUTO_CONFIRM_DAYS = parseInt(
  process.env.AUTO_CONFIRM_DELIVERY_DAYS ?? "7"
);

const RELEASE_HOURS = parseInt(
  process.env.BALANCE_RELEASE_HOURS ?? "48"
);

export async function autoConfirmDelivery() {
  const { rows: orders } = await pool.query(
    `SELECT
       o.id,
       o.user_id,
       o.reference,
       o.grand_total
     FROM   public.orders o
     WHERE  o.order_status    IN ('shipped', 'out_for_delivery')
       AND  o.payment_status  = 'confirmed'
       AND  o.created_at      < NOW() - INTERVAL '${AUTO_CONFIRM_DAYS} days'
     ORDER  BY o.created_at ASC
     LIMIT  25`
  );

  if (!orders.length) {
    return { confirmed: 0 };
  }

  let confirmed = 0;

  for (const order of orders) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ── Lock + verify status hasn't changed ─────────────
      const { rows: [locked] } = await client.query(
        `SELECT *
         FROM   public.orders
         WHERE  id            = $1
           AND  order_status IN ('shipped', 'out_for_delivery')
         FOR UPDATE`,
        [order.id]
      );

      if (!locked) {
        await client.query("COMMIT");
        continue;
      }

      // ── Mark as delivered ──────────────────────────────
      await client.query(
        `UPDATE public.orders
         SET    order_status = 'delivered',
                delivered_at = NOW(),
                admin_note   = 'Auto-confirmed after ${AUTO_CONFIRM_DAYS} days',
                updated_at   = NOW()
         WHERE  id = $1`,
        [order.id]
      );

      // ── Schedule balance releases ──────────────────────
      // release_after = NOW() + RELEASE_HOURS
      const { rows: vendorItems } = await client.query(
        `SELECT vendor_id, SUM(vendor_earnings) AS vendor_total
         FROM   public.order_items
         WHERE  order_id = $1
         GROUP  BY vendor_id`,
        [order.id]
      );

      for (const vi of vendorItems) {
        await client.query(
          `UPDATE public.order_balance_releases
           SET    release_after = NOW() + INTERVAL '${RELEASE_HOURS} hours',
                  updated_at   = NOW()
           WHERE  order_id  = $1
             AND  vendor_id = $2
             AND  status    = 'pending'`,
          [order.id, vi.vendor_id]
        );

        // If no release record exists yet, create one
        await client.query(
          `INSERT INTO public.order_balance_releases
             (order_id, vendor_id, amount, status,
              release_after, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending',
                   NOW() + INTERVAL '${RELEASE_HOURS} hours',
                   NOW(), NOW())
           ON CONFLICT (order_id) DO NOTHING`,
          [order.id, vi.vendor_id, parseFloat(vi.vendor_total)]
        );
      }

      // ── Notify buyer ───────────────────────────────────
      await sendNotification({
        userId:   order.user_id,
        userType: "buyer",
        type:     "order_delivered_buyer",
        title:    "📦 Order Auto-Confirmed",
        message:  `Your order ${order.reference} has been automatically confirmed after ${AUTO_CONFIRM_DAYS} days. If there's an issue, contact support.`,
        metadata: {
          order_id:  order.id,
          reference: order.reference,
        },
        client,
      });

      await client.query("COMMIT");
      confirmed++;

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(
        `[AutoConfirm] Error on order ${order.id}:`, err.message
      );
    } finally {
      client.release();
    }
  }

  return { confirmed };
}