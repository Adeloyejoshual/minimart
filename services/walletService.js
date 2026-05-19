// src/services/walletService.js
const { query, getClient } = require("../db/pool");

// ─── Queries ─────────────────────────────────────────────────────────────────

const WALLET_WITH_USER = `
  SELECT
    sw.id,
    sw.user_id,
    sw.available_balance,
    sw.pending_balance,
    sw.total_earned,
    sw.created_at,
    sw.updated_at,
    u.name            AS user_name,
    u.email           AS user_email,
    u.store_name,
    u.store_verified,
    u.status          AS user_status,
    u.rating,
    u.profile_image,
    u.total_sales
  FROM public.seller_wallets sw
  JOIN public.users u ON u.id = sw.user_id
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatWallet(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    available_balance: parseFloat(row.available_balance),
    pending_balance: parseFloat(row.pending_balance),
    total_earned: parseFloat(row.total_earned),
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: {
      name: row.user_name,
      email: row.user_email,
      store_name: row.store_name,
      store_verified: row.store_verified,
      status: row.user_status,
      rating: row.rating ? parseFloat(row.rating) : null,
      profile_image: row.profile_image,
      total_sales: row.total_sales ? parseFloat(row.total_sales) : 0,
    },
  };
}

async function recordTransaction(client, { walletId, userId, type, amount, balanceAfter, description, referenceId }) {
  await client.query(
    `INSERT INTO public.wallet_transactions
       (wallet_id, user_id, type, amount, balance_after, description, reference_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [walletId, userId, type, amount, balanceAfter, description || null, referenceId || null]
  );
}

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * List all wallets with optional filters.
 * @param {{ search, status, verified, hasPending, limit, offset }} opts
 */
async function listWallets({ search, status, verified, hasPending, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let i = 1;

  if (search) {
    conditions.push(
      `(u.name ILIKE $${i} OR u.email ILIKE $${i} OR u.store_name ILIKE $${i})`
    );
    params.push(`%${search}%`);
    i++;
  }
  if (status) {
    conditions.push(`u.status = $${i++}`);
    params.push(status);
  }
  if (verified !== undefined) {
    conditions.push(`u.store_verified = $${i++}`);
    params.push(verified === "true" || verified === true);
  }
  if (hasPending === "true" || hasPending === true) {
    conditions.push(`sw.pending_balance > 0`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(limit, offset);
  const rows = await query(
    `${WALLET_WITH_USER}
     ${where}
     ORDER BY sw.updated_at DESC
     LIMIT $${i++} OFFSET $${i}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM public.seller_wallets sw
     JOIN public.users u ON u.id = sw.user_id
     ${where}`,
    params.slice(0, -2) // remove limit/offset
  );

  return {
    wallets: rows.rows.map(formatWallet),
    total: parseInt(countResult.rows[0].count),
  };
}

/**
 * Get a single wallet by wallet ID.
 */
async function getWalletById(id) {
  const result = await query(`${WALLET_WITH_USER} WHERE sw.id = $1`, [id]);
  return formatWallet(result.rows[0]);
}

/**
 * Get wallet by user ID.
 */
async function getWalletByUserId(userId) {
  const result = await query(`${WALLET_WITH_USER} WHERE sw.user_id = $1`, [userId]);
  return formatWallet(result.rows[0]);
}

/**
 * Create a wallet for a user (idempotent — returns existing if already created).
 */
async function createWallet(userId) {
  const existing = await getWalletByUserId(userId);
  if (existing) return { wallet: existing, created: false };

  const result = await query(
    `INSERT INTO public.seller_wallets (user_id)
     VALUES ($1)
     RETURNING *`,
    [userId]
  );
  return { wallet: result.rows[0], created: true };
}

/**
 * Credit pending balance (e.g. order completed, funds held).
 * Atomically increments pending_balance and total_earned.
 */
async function creditPending(walletId, amount, { description, referenceId } = {}) {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE public.seller_wallets
       SET pending_balance = pending_balance + $1,
           total_earned    = total_earned    + $1,
           updated_at      = now()
       WHERE id = $2
       RETURNING *`,
      [amount, walletId]
    );
    if (!rows[0]) throw new Error("Wallet not found");

    await recordTransaction(client, {
      walletId,
      userId: rows[0].user_id,
      type: "credit",
      amount,
      balanceAfter: parseFloat(rows[0].pending_balance),
      description: description || "Order payment held in pending",
      referenceId,
    });

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Release pending balance to available (e.g. dispute window passed).
 * @param {string} walletId
 * @param {number|null} amount  Pass null to release entire pending balance.
 */
async function releasePending(walletId, amount = null, { description, referenceId } = {}) {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Lock the row
    const { rows: locked } = await client.query(
      `SELECT * FROM public.seller_wallets WHERE id = $1 FOR UPDATE`,
      [walletId]
    );
    if (!locked[0]) throw new Error("Wallet not found");

    const releaseAmt = amount !== null ? amount : parseFloat(locked[0].pending_balance);

    if (releaseAmt <= 0) throw new Error("No pending balance to release");
    if (releaseAmt > parseFloat(locked[0].pending_balance)) {
      throw new Error(`Release amount ${releaseAmt} exceeds pending balance ${locked[0].pending_balance}`);
    }

    const { rows } = await client.query(
      `UPDATE public.seller_wallets
       SET available_balance = available_balance + $1,
           pending_balance   = pending_balance   - $1,
           updated_at        = now()
       WHERE id = $2
       RETURNING *`,
      [releaseAmt, walletId]
    );

    await recordTransaction(client, {
      walletId,
      userId: rows[0].user_id,
      type: "release",
      amount: releaseAmt,
      balanceAfter: parseFloat(rows[0].available_balance),
      description: description || "Pending funds released to available",
      referenceId,
    });

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Withdraw from available balance (seller requests payout).
 */
async function withdraw(walletId, amount, { description, referenceId } = {}) {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const { rows: locked } = await client.query(
      `SELECT * FROM public.seller_wallets WHERE id = $1 FOR UPDATE`,
      [walletId]
    );
    if (!locked[0]) throw new Error("Wallet not found");

    if (amount > parseFloat(locked[0].available_balance)) {
      throw new Error(`Insufficient available balance. Available: ${locked[0].available_balance}`);
    }

    const { rows } = await client.query(
      `UPDATE public.seller_wallets
       SET available_balance = available_balance - $1,
           updated_at        = now()
       WHERE id = $2
       RETURNING *`,
      [amount, walletId]
    );

    await recordTransaction(client, {
      walletId,
      userId: rows[0].user_id,
      type: "withdrawal",
      amount,
      balanceAfter: parseFloat(rows[0].available_balance),
      description: description || "Seller withdrawal request",
      referenceId,
    });

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Refund — deduct from available (or pending) when an order is refunded.
 */
async function refund(walletId, amount, { fromPending = false, description, referenceId } = {}) {
  const client = await getClient();
  try {
    await client.query("BEGIN");

    const { rows: locked } = await client.query(
      `SELECT * FROM public.seller_wallets WHERE id = $1 FOR UPDATE`,
      [walletId]
    );
    if (!locked[0]) throw new Error("Wallet not found");

    const col = fromPending ? "pending_balance" : "available_balance";
    const current = parseFloat(locked[0][col]);
    if (amount > current) throw new Error(`Insufficient ${col}: ${current}`);

    const { rows } = await client.query(
      `UPDATE public.seller_wallets
       SET ${col}      = ${col}    - $1,
           total_earned = total_earned - $1,
           updated_at   = now()
       WHERE id = $2
       RETURNING *`,
      [amount, walletId]
    );

    await recordTransaction(client, {
      walletId,
      userId: rows[0].user_id,
      type: "refund",
      amount,
      balanceAfter: parseFloat(rows[0][col]),
      description: description || `Refund from ${col}`,
      referenceId,
    });

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get transaction history for a wallet.
 */
async function getTransactions(walletId, { limit = 20, offset = 0, type } = {}) {
  const conditions = [`wallet_id = $1`];
  const params = [walletId];
  let i = 2;

  if (type) {
    conditions.push(`type = $${i++}`);
    params.push(type);
  }

  params.push(limit, offset);

  const { rows } = await query(
    `SELECT * FROM public.wallet_transactions
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i}`,
    params
  );

  const { rows: countRows } = await query(
    `SELECT COUNT(*) FROM public.wallet_transactions
     WHERE ${conditions.slice(0, -0).join(" AND ")}`,
    params.slice(0, -2)
  );

  return { transactions: rows, total: parseInt(countRows[0].count) };
}

/**
 * Platform-wide wallet summary (admin dashboard stats).
 */
async function getPlatformSummary() {
  const { rows } = await query(`
    SELECT
      COUNT(*)                          AS total_wallets,
      SUM(available_balance)            AS total_available,
      SUM(pending_balance)              AS total_pending,
      SUM(total_earned)                 AS total_earned,
      COUNT(*) FILTER (WHERE available_balance > 0) AS wallets_with_balance,
      COUNT(*) FILTER (WHERE pending_balance > 0)   AS wallets_with_pending
    FROM public.seller_wallets
  `);
  const r = rows[0];
  return {
    total_wallets: parseInt(r.total_wallets),
    total_available: parseFloat(r.total_available || 0),
    total_pending: parseFloat(r.total_pending || 0),
    total_earned: parseFloat(r.total_earned || 0),
    wallets_with_balance: parseInt(r.wallets_with_balance),
    wallets_with_pending: parseInt(r.wallets_with_pending),
  };
}

module.exports = {
  listWallets,
  getWalletById,
  getWalletByUserId,
  createWallet,
  creditPending,
  releasePending,
  withdraw,
  refund,
  getTransactions,
  getPlatformSummary,
};
