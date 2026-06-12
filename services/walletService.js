// server/services/walletService.js

import { pool } from "../server.js";

// ═════════════════════════════════════════════════════════════
// Credit pending balance — when order is paid
// Money sits in pending until delivery is confirmed
// ═════════════════════════════════════════════════════════════
export const creditPendingBalance = async ({
  vendorId,
  amount,
  client = pool,
}) => {
  // Upsert — create wallet if it doesn't exist
  await client.query(
    `INSERT INTO market.vendor_wallets (vendor_id, pending_balance, total_received)
     VALUES ($1, $2, $2)
     ON CONFLICT (vendor_id)
     DO UPDATE SET
       pending_balance = market.vendor_wallets.pending_balance + $2,
       total_received  = market.vendor_wallets.total_received  + $2,
       updated_at      = NOW()`,
    [vendorId, amount]
  );
};

// ═════════════════════════════════════════════════════════════
// Release to available — when delivery is confirmed
// Moves from pending → available
// ═════════════════════════════════════════════════════════════
export const releaseToAvailable = async ({
  vendorId,
  amount,
  client = pool,
}) => {
  await client.query(
    `UPDATE market.vendor_wallets
     SET    pending_balance   = GREATEST(0, pending_balance - $1),
            available_balance = available_balance + $1,
            updated_at        = NOW()
     WHERE  vendor_id = $2`,
    [amount, vendorId]
  );
};

// ═════════════════════════════════════════════════════════════
// Restore balance — when withdrawal or payout fails
// Moves from pending back to available
// ═════════════════════════════════════════════════════════════
export const restoreBalance = async ({
  vendorId,
  amount,
  client = pool,
}) => {
  await client.query(
    `UPDATE market.vendor_wallets
     SET    available_balance = available_balance + $1,
            pending_balance   = GREATEST(0, pending_balance - $1),
            updated_at        = NOW()
     WHERE  vendor_id = $2`,
    [amount, vendorId]
  );
};

// ═════════════════════════════════════════════════════════════
// Deduct pending after successful payout
// Finalises: pending → 0, total_withdrawn increases
// ═════════════════════════════════════════════════════════════
export const deductPendingAfterPayout = async ({
  vendorId,
  amount,
  client = pool,
}) => {
  await client.query(
    `UPDATE market.vendor_wallets
     SET    pending_balance = GREATEST(0, pending_balance - $1),
            total_withdrawn = total_withdrawn + $1,
            updated_at      = NOW()
     WHERE  vendor_id = $2`,
    [amount, vendorId]
  );
};

// ═════════════════════════════════════════════════════════════
// Lock balance — during dispute
// Moves from pending/available → locked
// ═════════════════════════════════════════════════════════════
export const lockBalance = async ({
  vendorId,
  amount,
  fromField = "pending_balance",
  reason,
  lockedBy,
  client = pool,
}) => {
  await client.query(
    `UPDATE market.vendor_wallets
     SET    ${fromField}   = GREATEST(0, ${fromField} - $1),
            locked_balance = locked_balance + $1,
            is_frozen      = CASE WHEN locked_balance + $1 > 0
                             THEN TRUE ELSE is_frozen END,
            frozen_reason  = COALESCE($2, frozen_reason),
            frozen_by      = $3,
            frozen_at      = NOW(),
            updated_at     = NOW()
     WHERE  vendor_id = $4`,
    [amount, reason, lockedBy, vendorId]
  );
};

// ═════════════════════════════════════════════════════════════
// Unlock balance — dispute resolved in vendor's favour
// ═════════════════════════════════════════════════════════════
export const unlockBalance = async ({
  vendorId,
  amount,
  toField = "available_balance",
  client = pool,
}) => {
  await client.query(
    `UPDATE market.vendor_wallets
     SET    locked_balance  = GREATEST(0, locked_balance - $1),
            ${toField}      = ${toField} + $1,
            is_frozen       = CASE WHEN GREATEST(0, locked_balance - $1) = 0
                              THEN FALSE ELSE is_frozen END,
            frozen_reason   = CASE WHEN GREATEST(0, locked_balance - $1) = 0
                              THEN NULL ELSE frozen_reason END,
            updated_at      = NOW()
     WHERE  vendor_id = $2`,
    [amount, vendorId]
  );
};