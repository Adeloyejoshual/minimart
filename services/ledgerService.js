// server/services/ledgerService.js

const { v4: uuidv4 } = require("uuid");
const db              = require("../db");

/**
 * Append-only ledger entry
 * NEVER update or delete — only insert
 */
exports.createEntry = async ({
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
  trx = db,
}) => {
  // Get current balance for snapshot
  const wallet = await trx("vendor_wallets")
    .where({ vendor_id: vendorId })
    .first();

  const balanceBefore = 
    Number(wallet?.available_balance ?? 0) +
    Number(wallet?.pending_balance   ?? 0);

  const balanceAfter = direction === "credit"
    ? balanceBefore + Number(amount)
    : balanceBefore - Number(amount);

  await trx("ledger_transactions").insert({
    id:             uuidv4(),
    user_id:        userId,
    vendor_id:      vendorId      || null,
    order_id:       orderId       || null,
    payment_id:     paymentId     || null,
    withdrawal_id:  withdrawalId  || null,
    type,
    direction,
    amount:         Number(amount),
    balance_before: balanceBefore,
    balance_after:  balanceAfter,
    reference,
    narration,
    performed_by:   performedBy   || "system",
    source:         performedBy ? "admin" : "system",
    created_at:     new Date(),
  });
};