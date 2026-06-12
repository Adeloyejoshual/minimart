// server/jobs/autoReleaseBalance.js

import { pool }               from "../server.js";
import { releaseToAvailable } from "../services/walletService.js";
import { createEntry }        from "../services/ledgerService.js";
import { sendNotification }   from "../services/notificationService.js";

// ═════════════════════════════════════════════════════════════
// AUTO RELEASE BALANCE
//
// After delivery is confirmed, balance sits in pending for
// a cool-down period (RELEASE_HOURS). Once that window passes
// without a dispute, it automatically moves to available.
//
// Flow:
// order delivered → order_balance_releases created (pending)
//                   release_after = delivered_at + 48hrs
//                → this job runs every 15 min
//                → finds releases where NOW > release_after
//                → moves pending → available in wallet
//                → creates ledger entry
//                → notifies vendor
// ═════════════════════════════════════════════════════════════

const RELEASE_HOURS = parseInt(
  process.env.BALANCE_RELEASE_HOURS ?? "48"
);

export async function autoReleaseBalance() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Find releases ready to process ──────────────────
    const { rows: releases } = await client.query(
      `SELECT
         obr.id,
         obr.order_id,
         obr.vendor_id,
         obr.amount,
         v.store_name,
         w.available_balance
       FROM   public.order_balance_releases obr
       JOIN   market.vendors        v  ON v.id  = obr.vendor_id
       JOIN   market.vendor_wallets w  ON w.vendor_id = obr.vendor_id
       WHERE  obr.status = 'pending'
         AND  obr.release_after IS NOT NULL
         AND  obr.release_after <= NOW()
       ORDER  BY obr.release_after ASC
       LIMIT  50
       FOR UPDATE OF obr SKIP LOCKED`
    );

    if (!releases.length) {
      await client.query("COMMIT");
      return { released: 0 };
    }

    let released = 0;

    for (const rel of releases) {
      const amount         = parseFloat(rel.amount);
      const newAvailable   = parseFloat(rel.available_balance) + amount;

      // ── Move pending → available ──────────────────────
      await releaseToAvailable({
        vendorId: rel.vendor_id,
        amount,
        client,
      });

      // ── Mark release as done ──────────────────────────
      await client.query(
        `UPDATE public.order_balance_releases
         SET    status      = 'released',
                released_at = NOW(),
                updated_at  = NOW()
         WHERE  id = $1`,
        [rel.id]
      );

      // ── Ledger entry ──────────────────────────────────
      await createEntry({
        userId:    rel.vendor_id,
        vendorId:  rel.vendor_id,
        orderId:   rel.order_id,
        type:      "order_credit",
        direction: "credit",
        amount,
        reference: `RELEASE_${rel.order_id}_${rel.vendor_id}`,
        narration: `Balance released for order ${rel.order_id} after ${RELEASE_HOURS}hr holding period`,
        source:    "system",
        client,
      });

      // ── Notify vendor ─────────────────────────────────
      await sendNotification({
        userId:   rel.vendor_id,
        userType: "seller",
        type:     "balance_released",
        title:    "💰 Balance Released!",
        message:  `₦${amount.toLocaleString()} from order ${
          rel.order_id
        } is now available for withdrawal.`,
        metadata: {
          order_id:              rel.order_id,
          amount,
          store_name:            rel.store_name,
          newAvailableBalance:   newAvailable,
        },
        client,
      });

      released++;
    }

    await client.query("COMMIT");

    return { released };

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}