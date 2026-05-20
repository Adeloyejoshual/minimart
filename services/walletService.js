import { pool } from "../config/db.js";

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

/* ─────────────────────────────────────────────
   Base Query
───────────────────────────────────────────── */

const WALLET_WITH_USER = `
SELECT
  sw.id,
  sw.user_id,
  sw.available_balance,
  sw.pending_balance,
  sw.total_earned,
  sw.created_at,
  sw.updated_at,
  u.name AS user_name,
  u.email AS user_email,
  u.store_name,
  u.store_verified,
  u.status AS user_status,
  u.rating,
  u.profile_image,
  u.total_sales
FROM public.seller_wallets sw
JOIN public.users u ON u.id = sw.user_id
`;

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

const toFloat = (v) => parseFloat(v || 0);

const formatWallet = (row) =>
  row
    ? {
        id: row.id,
        user_id: row.user_id,
        available_balance: toFloat(row.available_balance),
        pending_balance: toFloat(row.pending_balance),
        total_earned: toFloat(row.total_earned),
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          name: row.user_name,
          email: row.user_email,
          store_name: row.store_name,
          store_verified: row.store_verified,
          status: row.user_status,
          rating: row.rating ? toFloat(row.rating) : null,
          profile_image: row.profile_image,
          total_sales: toFloat(row.total_sales),
        },
      }
    : null;

async function recordTransaction(client, data) {
  await client.query(
    `INSERT INTO public.wallet_transactions
     (wallet_id, user_id, type, amount, balance_after, description, reference_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      data.walletId,
      data.userId,
      data.type,
      data.amount,
      data.balanceAfter,
      data.description || null,
      data.referenceId || null,
    ]
  );
}

/* ─────────────────────────────────────────────
   Wallet Operations (Safe Transactions)
───────────────────────────────────────────── */

async function runInTransaction(callback) {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getWalletById(id) {
  const { rows } = await query(`${WALLET_WITH_USER} WHERE sw.id = $1`, [id]);
  return formatWallet(rows[0]);
}

export async function getWalletByUserId(userId) {
  const { rows } = await query(`${WALLET_WITH_USER} WHERE sw.user_id = $1`, [userId]);
  return formatWallet(rows[0]);
}

export async function createWallet(userId) {
  const existing = await getWalletByUserId(userId);
  if (existing) return { wallet: existing, created: false };

  const { rows } = await query(
    `INSERT INTO public.seller_wallets (user_id)
     VALUES ($1)
     RETURNING *`,
    [userId]
  );

  return { wallet: formatWallet(rows[0]), created: true };
}

export async function creditPending(walletId, amount, opts = {}) {
  return runInTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE public.seller_wallets
       SET pending_balance = pending_balance + $1,
           total_earned = total_earned + $1,
           updated_at = now()
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
      balanceAfter: toFloat(rows[0].pending_balance),
      description: opts.description || "Pending credit",
      referenceId: opts.referenceId,
    });

    return formatWallet(rows[0]);
  });
}

export async function releasePending(walletId, amount = null, opts = {}) {
  return runInTransaction(async (client) => {
    const { rows: locked } = await client.query(
      `SELECT * FROM public.seller_wallets WHERE id = $1 FOR UPDATE`,
      [walletId]
    );

    if (!locked[0]) throw new Error("Wallet not found");

    const pending = toFloat(locked[0].pending_balance);
    const releaseAmt = amount ?? pending;

    if (releaseAmt <= 0) throw new Error("No pending balance to release");
    if (releaseAmt > pending)
      throw new Error("Release amount exceeds pending balance");

    const { rows } = await client.query(
      `UPDATE public.seller_wallets
       SET available_balance = available_balance + $1,
           pending_balance = pending_balance - $1,
           updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [releaseAmt, walletId]
    );

    await recordTransaction(client, {
      walletId,
      userId: rows[0].user_id,
      type: "release",
      amount: releaseAmt,
      balanceAfter: toFloat(rows[0].available_balance),
      description: opts.description || "Pending released",
      referenceId: opts.referenceId,
    });

    return formatWallet(rows[0]);
  });
}

export async function withdraw(walletId, amount, opts = {}) {
  return runInTransaction(async (client) => {
    const { rows: locked } = await client.query(
      `SELECT * FROM public.seller_wallets WHERE id = $1 FOR UPDATE`,
      [walletId]
    );

    if (!locked[0]) throw new Error("Wallet not found");
    if (amount > toFloat(locked[0].available_balance))
      throw new Error("Insufficient available balance");

    const { rows } = await client.query(
      `UPDATE public.seller_wallets
       SET available_balance = available_balance - $1,
           updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [amount, walletId]
    );

    await recordTransaction(client, {
      walletId,
      userId: rows[0].user_id,
      type: "withdrawal",
      amount,
      balanceAfter: toFloat(rows[0].available_balance),
      description: opts.description || "Withdrawal",
      referenceId: opts.referenceId,
    });

    return formatWallet(rows[0]);
  });
}

export async function refund(walletId, amount, opts = {}) {
  return runInTransaction(async (client) => {
    const { rows: locked } = await client.query(
      `SELECT * FROM public.seller_wallets WHERE id = $1 FOR UPDATE`,
      [walletId]
    );

    if (!locked[0]) throw new Error("Wallet not found");

    const column = opts.fromPending ? "pending_balance" : "available_balance";
    const current = toFloat(locked[0][column]);

    if (amount > current) throw new Error(`Insufficient ${column}`);

    const { rows } = await client.query(
      `UPDATE public.seller_wallets
       SET ${column} = ${column} - $1,
           total_earned = total_earned - $1,
           updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [amount, walletId]
    );

    await recordTransaction(client, {
      walletId,
      userId: rows[0].user_id,
      type: "refund",
      amount,
      balanceAfter: toFloat(rows[0][column]),
      description: opts.description || `Refund`,
      referenceId: opts.referenceId,
    });

    return formatWallet(rows[0]);
  });
}

export async function getTransactions(walletId, { limit = 20, offset = 0, type } = {}) {
  const conditions = ["wallet_id = $1"];
  const params = [walletId];
  let i = 2;

  if (type) {
    conditions.push(`type = $${i++}`);
    params.push(type);
  }

  const { rows } = await query(
    `SELECT * FROM public.wallet_transactions
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i}`,
    [...params, limit, offset]
  );

  const countRows = await query(
    `SELECT COUNT(*) FROM public.wallet_transactions
     WHERE ${conditions.join(" AND ")}`,
    params
  );

  return {
    transactions: rows,
    total: parseInt(countRows.rows[0].count),
  };
}

export async function getPlatformSummary() {
  const { rows } = await query(`
    SELECT
      COUNT(*) AS total_wallets,
      SUM(available_balance) AS total_available,
      SUM(pending_balance) AS total_pending,
      SUM(total_earned) AS total_earned
    FROM public.seller_wallets
  `);

  const r = rows[0];

  return {
    total_wallets: parseInt(r.total_wallets),
    total_available: toFloat(r.total_available),
    total_pending: toFloat(r.total_pending),
    total_earned: toFloat(r.total_earned),
  };
}