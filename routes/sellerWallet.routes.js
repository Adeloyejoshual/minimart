// routes/sellerWallet.routes.js
import express          from "express";
import axios            from "axios";
import { pool }         from "../server.js";
import { authenticate } from "../middleware/auth.js";

const router  = express.Router();
const FLW_KEY = () => process.env.FLW_SECRET_KEY;

const flw = () =>
  axios.create({
    baseURL: "https://api.flutterwave.com/v3",
    headers: {
      Authorization: `Bearer ${FLW_KEY()}`,
      "Content-Type": "application/json",
    },
    timeout: 15_000,
  });

// ── Guard: get vendor ─────────────────────────────────────────
const getVendor = async (userId) => {
  const { rows } = await pool.query(
    `SELECT v.*, va.account_number, va.account_name AS virtual_account_name,
            va.bank_name AS virtual_bank_name, va.available_balance,
            va.total_received, va.total_withdrawn, va.id AS va_id
     FROM market.vendors v
     LEFT JOIN market.vendor_virtual_accounts va ON va.vendor_id = v.id
     WHERE v.user_id = $1`,
    [userId]
  );
  return rows[0] ?? null;
};

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/balance
// ════════════════════════════════════════════════════════════
router.get("/balance", authenticate, async (req, res) => {
  try {
    const vendor = await getVendor(req.user.id);

    if (!vendor) {
      return res.status(404).json({
        success: false, message: "No vendor account found",
      });
    }

    return res.json({
      success: true,
      balance: {
        available:      vendor.available_balance   ?? 0,
        total_received: vendor.total_received      ?? 0,
        total_withdrawn:vendor.total_withdrawn     ?? 0,
        currency:       "NGN",
      },
      virtual_account: vendor.account_number
        ? {
            account_number: vendor.account_number,
            account_name:   vendor.virtual_account_name,
            bank_name:      vendor.virtual_bank_name,
          }
        : null,
    });

  } catch (err) {
    console.error("[balance]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/transactions
// ════════════════════════════════════════════════════════════
router.get("/transactions", authenticate, async (req, res) => {
  try {
    const vendor = await getVendor(req.user.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "No vendor" });
    }

    const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0,  0);
    const type   = req.query.type; // credit | debit | withdrawal

    let query = `
      SELECT * FROM market.vendor_transactions
      WHERE vendor_id = $1
    `;
    const params = [vendor.id];

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);

    return res.json({ success: true, transactions: rows });

  } catch (err) {
    console.error("[transactions]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-wallet/withdraw
// Transfer from Flutterwave balance to seller's bank
// ════════════════════════════════════════════════════════════
router.post("/withdraw", authenticate, async (req, res) => {
  const { amount } = req.body;

  if (!amount || isNaN(amount) || Number(amount) < 500) {
    return res.status(400).json({
      success: false,
      message: "Minimum withdrawal is ₦500",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const vendor = await getVendor(req.user.id);

    if (!vendor) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "No vendor" });
    }

    const available = Number(vendor.available_balance ?? 0);
    const requested = Number(amount);

    if (requested > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${available.toLocaleString()}`,
      });
    }

    if (!vendor.bank_account || !vendor.bank_name) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "No payout bank configured",
      });
    }

    const txRef = `WITHDRAW-${vendor.id}-${Date.now()}`;

    // ── Flutterwave transfer ──────────────────────────────
    const { data } = await flw().post("/transfers", {
      account_bank:   vendor.bank_code ?? vendor.bank_name,
      account_number: vendor.bank_account,
      amount:         requested,
      narration:      `${vendor.store_name} withdrawal`,
      currency:       "NGN",
      reference:      txRef,
      callback_url:   `${process.env.CLIENT_URL}/api/seller-wallet/webhook`,
      debit_currency: "NGN",
    });

    if (data.status !== "success") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: data.message ?? "Transfer failed",
      });
    }

    // ── Deduct from balance ───────────────────────────────
    await client.query(
      `UPDATE market.vendor_virtual_accounts
       SET available_balance = available_balance - $1,
           total_withdrawn   = total_withdrawn   + $1,
           updated_at        = NOW()
       WHERE vendor_id = $2`,
      [requested, vendor.id]
    );

    // ── Log transaction ───────────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_transactions
         (vendor_id, virtual_account_id, flw_tx_id, tx_ref,
          type, amount, status, narration)
       VALUES ($1,$2,$3,$4,'withdrawal',$5,'pending',$6)`,
      [
        vendor.id,
        vendor.va_id,
        data.data?.id?.toString() ?? null,
        txRef,
        requested,
        `Withdrawal to ${vendor.bank_name}`,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: `₦${requested.toLocaleString()} withdrawal initiated`,
      reference: txRef,
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[withdraw]", err.response?.data ?? err.message);
    return res.status(500).json({
      success: false,
      message: err.response?.data?.message ?? "Withdrawal failed",
    });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-wallet/webhook
// Flutterwave sends payment notifications here
// ════════════════════════════════════════════════════════════
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["verif-hash"];
    const secret    = process.env.FLW_WEBHOOK_HASH;

    // ── Verify webhook signature ──────────────────────────
    if (secret && signature !== secret) {
      console.warn("[webhook] invalid signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ message: "Invalid payload" });
    }

    console.log("[webhook] event:", event.event, event.data?.id);

    // ── Always respond 200 first ──────────────────────────
    res.status(200).json({ status: "ok" });

    // ── Process event async ───────────────────────────────
    try {
      if (event.event === "charge.completed") {
        await handleVirtualAccountCredit(event.data);
      }

      if (event.event === "transfer.completed") {
        await handleTransferComplete(event.data);
      }
    } catch (err) {
      console.error("[webhook] processing error:", err.message);
    }
  }
);

// ── Handle incoming payment to virtual account ────────────────
async function handleVirtualAccountCredit(data) {
  const accountNumber = data.virtual_account_number
    ?? data.customer?.account_number;

  if (!accountNumber) return;

  const { rows: [va] } = await pool.query(
    `SELECT * FROM market.vendor_virtual_accounts
     WHERE account_number = $1`,
    [accountNumber]
  );

  if (!va) {
    console.warn("[webhook] virtual account not found:", accountNumber);
    return;
  }

  const amount = Number(data.amount ?? 0);
  const fee    = Number(data.app_fee ?? 0);
  const net    = amount - fee;

  // ── Credit vendor balance ──────────────────────────────
  await pool.query(
    `UPDATE market.vendor_virtual_accounts
     SET available_balance = available_balance + $1,
         total_received    = total_received    + $1,
         updated_at        = NOW()
     WHERE id = $2`,
    [net, va.id]
  );

  // ── Log transaction ────────────────────────────────────
  await pool.query(
    `INSERT INTO market.vendor_transactions
       (vendor_id, virtual_account_id, flw_tx_id, flw_ref, tx_ref,
        type, amount, fee, currency, status,
        narration, sender_name, sender_account, sender_bank)
     VALUES ($1,$2,$3,$4,$5,'credit',$6,$7,$8,'success',$9,$10,$11,$12)
     ON CONFLICT DO NOTHING`,
    [
      va.vendor_id,
      va.id,
      data.id?.toString(),
      data.flw_ref,
      data.tx_ref,
      net,
      fee,
      data.currency ?? "NGN",
      data.narration ?? "Payment received",
      data.customer?.fullname ?? data.payer ?? null,
      data.customer?.account_number ?? null,
      data.customer?.bank_code      ?? null,
    ]
  );

  console.log(`[webhook] credited ₦${net} to vendor ${va.vendor_id}`);
}

// ── Handle transfer completion ────────────────────────────────
async function handleTransferComplete(data) {
  await pool.query(
    `UPDATE market.vendor_transactions
     SET status     = $1,
         meta       = $2
     WHERE tx_ref   = $3`,
    [
      data.status === "SUCCESSFUL" ? "success" : "failed",
      JSON.stringify(data),
      data.reference,
    ]
  );

  // If transfer failed — refund balance
  if (data.status !== "SUCCESSFUL") {
    const { rows: [tx] } = await pool.query(
      `SELECT * FROM market.vendor_transactions WHERE tx_ref = $1`,
      [data.reference]
    );

    if (tx) {
      await pool.query(
        `UPDATE market.vendor_virtual_accounts
         SET available_balance = available_balance + $1,
             total_withdrawn   = total_withdrawn   - $1,
             updated_at        = NOW()
         WHERE vendor_id = $2`,
        [tx.amount, tx.vendor_id]
      );
      console.log(`[webhook] refunded ₦${tx.amount} — transfer failed`);
    }
  }
}

export default router;