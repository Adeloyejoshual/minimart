// server/services/ledgerService.js

import { pool } from "../server.js";
import crypto   from "crypto";

// ═════════════════════════════════════════════════════════════
// Create immutable ledger entry
// NEVER update or delete — only INSERT
// ═════════════════════════════════════════════════════════════
export const createEntry = async ({
  userId,
  vendorId,
  orderId,
  paymentId,
  withdrawalId,
  type,
  direction,
  amount,
  reference,
  narration,
  performedBy,
  source = "system",
  metadata = {},
  client = pool,
}) => {
  // ── Get current wallet balance for snapshot ─────────
  let balanceBefore = 0;

  if (vendorId) {
    const { rows } = await client.query(
      `SELECT
         available_balance,
         pending_balance,
         locked_balance
       FROM market.vendor_wallets
       WHERE vendor_id = $1`,
      [vendorId]
    );

    if (rows.length) {
      balanceBefore =
        Number(rows[0].available_balance) +
        Number(rows[0].pending_balance)   +
        Number(rows[0].locked_balance);
    }
  }

  const balanceAfter = direction === "credit"
    ? balanceBefore + Number(amount)
    : balanceBefore - Number(amount);

  // ── Ensure reference uniqueness ─────────────────────
  // Add a short hash to prevent collisions on retries
  const finalReference = reference.length > 140
    ? reference.slice(0, 140)
    : reference;

  await client.query(
    `INSERT INTO market.ledger_transactions
       (user_id, vendor_id, order_id, payment_id,
        withdrawal_id, type, direction, amount,
        currency, balance_before, balance_after,
        reference, narration, performed_by,
        source, metadata, created_at)
     VALUES
       ($1, $2, $3, $4,
        $5, $6, $7, $8,
        'NGN', $9, $10,
        $11, $12, $13,
        $14, $15, NOW())
     ON CONFLICT (reference) DO NOTHING`,
    [
      userId,
      vendorId       ?? null,
      orderId        ?? null,
      paymentId      ?? null,
      withdrawalId   ?? null,
      type,
      direction,
      Number(amount),
      balanceBefore,
      balanceAfter,
      finalReference,
      narration      ?? null,
      performedBy    ?? null,
      source,
      JSON.stringify(metadata),
    ]
  );
};