// server/services/walletService.js

const db = require("../db");

/**
 * Credit vendor pending balance when order is paid
 * Money sits in pending until order is delivered
 */
exports.creditPendingBalance = async ({
  vendorId,
  amount,
  orderId,
  trx = db,
}) => {
  const wallet = await trx("vendor_wallets")
    .where({ vendor_id: vendorId })
    .first();

  if (!wallet) {
    // Create wallet if doesn't exist
    await trx("vendor_wallets").insert({
      vendor_id:        vendorId,
      available_balance: 0,
      pending_balance:   amount,
      total_earned:      amount,
      total_withdrawn:   0,
      updated_at:        new Date(),
    });
  } else {
    await trx("vendor_wallets")
      .where({ vendor_id: vendorId })
      .increment("pending_balance", amount)
      .increment("total_earned",    amount)
      .update({ updated_at: new Date() });
  }
};

/**
 * Move from pending → available after delivery confirmed
 */
exports.releaseToAvailable = async ({
  vendorId,
  amount,
  trx = db,
}) => {
  await trx("vendor_wallets")
    .where({ vendor_id: vendorId })
    .decrement("pending_balance",   amount)
    .increment("available_balance", amount)
    .update({ updated_at: new Date() });
};