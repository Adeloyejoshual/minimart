// routes/webhooks/flutterwaveDebug.js
// TEMPORARY — remove after fixing. Add to server.js:
// import debugRouter from "./routes/webhooks/flutterwaveDebug.js";
// app.use("/api/webhooks/flw-debug", debugRouter);

import express from "express";
import { pool } from "../../server.js";

const router = express.Router();

// Raw body logger — shows EXACTLY what FLW sends
router.post("/raw", express.raw({ type: "*/*" }), (req, res) => {
  console.log("=== FLW RAW WEBHOOK ===");
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body (raw):", req.body?.toString());
  console.log("Body (parsed):", (() => {
    try { return JSON.parse(req.body?.toString()); }
    catch { return "NOT JSON"; }
  })());
  res.status(200).json({ received: true });
});

// Check your env vars are loaded
router.get("/check-env", (req, res) => {
  res.json({
    FLW_SECRET_HASH_set:  !!process.env.FLW_SECRET_HASH,
    FLW_SECRET_HASH_len:  process.env.FLW_SECRET_HASH?.length,
    FLW_SECRET_KEY_set:   !!process.env.FLW_SECRET_KEY,
    FLW_SECRET_KEY_prefix:process.env.FLW_SECRET_KEY?.slice(0, 10),
    NODE_ENV:             process.env.NODE_ENV,
  });
});

// Check virtual accounts in DB
router.get("/virtual-accounts", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT va.*, v.store_name, v.status AS vendor_status
       FROM market.vendor_virtual_accounts va
       JOIN market.vendors v ON v.id = va.vendor_id
       ORDER BY va.created_at DESC
       LIMIT 20`
    );
    res.json({ count: rows.length, accounts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check wallet state
router.get("/wallets", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, v.store_name
       FROM market.vendor_wallets w
       JOIN market.vendors v ON v.id = w.vendor_id
       ORDER BY w.updated_at DESC
       LIMIT 20`
    );
    res.json({ count: rows.length, wallets: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually simulate a webhook credit (for testing)
router.post("/simulate-credit", async (req, res) => {
  const { account_number, amount = 100 } = req.body;

  if (!account_number) {
    return res.status(400).json({ error: "account_number required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT va.vendor_id, va.account_number,
              v.store_name, v.user_id
       FROM market.vendor_virtual_accounts va
       JOIN market.vendors v ON v.id = va.vendor_id
       WHERE va.account_number = $1`,
      [account_number]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "No vendor found for account",
        account_number,
      });
    }

    const vendor = rows[0];

    // Credit wallet
    await pool.query(
      `INSERT INTO market.vendor_wallets
         (vendor_id, available_balance, pending_balance,
          total_received, total_withdrawn, currency)
       VALUES ($1, $2, 0, $2, 0, 'NGN')
       ON CONFLICT (vendor_id) DO UPDATE SET
         available_balance = market.vendor_wallets.available_balance + $2,
         total_received    = market.vendor_wallets.total_received    + $2,
         updated_at        = NOW()`,
      [vendor.vendor_id, Number(amount)]
    );

    // Log transaction
    await pool.query(
      `INSERT INTO market.vendor_transactions
         (vendor_id, type, amount, fee, currency,
          status, narration, tx_ref)
       VALUES ($1, 'credit', $2, 0, 'NGN',
               'success', 'Simulated credit', $3)`,
      [vendor.vendor_id, Number(amount), `SIM-${Date.now()}`]
    );

    res.json({
      success:  true,
      vendor:   vendor.store_name,
      credited: amount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;