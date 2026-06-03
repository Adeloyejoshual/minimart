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

// ── Fetch vendor + wallet + virtual account ───────────────────
const getVendorFull = async (userId) => {
  const { rows } = await pool.query(
    `SELECT
       v.id, v.store_name, v.status,
       v.bank_account, v.bank_name,
       v.account_name, v.bank_code,
       -- Wallet
       w.id              AS wallet_id,
       w.available_balance,
       w.pending_balance,
       w.total_received,
       w.total_withdrawn,
       w.currency,
       -- Virtual account
       va.id             AS va_id,
       va.account_number AS virtual_account_number,
       va.account_name   AS virtual_account_name,
       va.bank_name      AS virtual_bank_name,
       va.status         AS virtual_account_status
     FROM market.vendors v
     LEFT JOIN market.vendor_wallets w
       ON w.vendor_id = v.id
     LEFT JOIN market.vendor_virtual_accounts va
       ON va.vendor_id = v.id
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
    const vendor = await getVendorFull(req.user.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "No vendor account found",
      });
    }

    if (!vendor.virtual_account_number) {
      return res.json({
        success:         true,
        message:         "Awaiting admin approval to activate wallet",
        virtual_account: null,
        balance:         null,
      });
    }

    return res.json({
      success: true,
      balance: {
        available:       Number(vendor.available_balance ?? 0),
        pending:         Number(vendor.pending_balance   ?? 0),
        total_received:  Number(vendor.total_received    ?? 0),
        total_withdrawn: Number(vendor.total_withdrawn   ?? 0),
        currency:        vendor.currency ?? "NGN",
      },
      virtual_account: {
        account_number: vendor.virtual_account_number,
        account_name:   vendor.virtual_account_name,
        bank_name:      vendor.virtual_bank_name,
        status:         vendor.virtual_account_status,
      },
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
    const vendor = await getVendorFull(req.user.id);

    if (!vendor) {
      return res.status(404).json({
        success: false, message: "No vendor account found",
      });
    }

    const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0,  0);
    const type   = req.query.type;
    const status = req.query.status;

    const params  = [vendor.id];
    const filters = [];

    if (type) {
      params.push(type);
      filters.push(`type = $${params.length}`);
    }

    if (status) {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }

    const where = filters.length
      ? `AND ${filters.join(" AND ")}`
      : "";

    const { rows } = await pool.query(
      `SELECT
         id, type, amount, fee, net_amount,
         currency, status, narration,
         sender_name, sender_bank,
         tx_ref, flw_ref, created_at
       FROM market.vendor_transactions
       WHERE vendor_id = $1 ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return res.json({ success: true, transactions: rows });

  } catch (err) {
    console.error("[transactions]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-wallet/withdrawals
// Withdrawal request history
// ════════════════════════════════════════════════════════════
router.get("/withdrawals", authenticate, async (req, res) => {
  try {
    const vendor = await getVendorFull(req.user.id);

    if (!vendor) {
      return res.status(404).json({
        success: false, message: "No vendor account found",
      });
    }

    const limit  = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const { rows } = await pool.query(
      `SELECT
         id, amount, fee, net_amount,
         bank_name, account_number, account_name,
         status, failure_reason,
         flw_transfer_id, tx_ref,
         created_at, processed_at
       FROM market.vendor_withdrawal_requests
       WHERE vendor_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [vendor.id, limit, offset]
    );

    return res.json({ success: true, withdrawals: rows });

  } catch (err) {
    console.error("[withdrawals]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-wallet/withdraw
// Request payout to seller's bank account
// ════════════════════════════════════════════════════════════
router.post("/withdraw", authenticate, async (req, res) => {
  const { amount } = req.body;
  const requested  = Number(amount);

  if (!amount || isNaN(requested) || requested < 500) {
    return res.status(400).json({
      success: false,
      message: "Minimum withdrawal amount is ₦500",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Lock wallet row for update ────────────────────────
    const { rows: [wallet] } = await client.query(
      `SELECT w.*, v.id AS vendor_id, v.store_name,
              v.bank_account, v.bank_name,
              v.account_name, v.bank_code,
              v.status AS vendor_status
       FROM market.vendor_wallets w
       JOIN market.vendors v ON v.id = w.vendor_id
       WHERE v.user_id = $1
       FOR UPDATE OF w`,
      [req.user.id]
    );

    if (!wallet) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false, message: "Wallet not found",
      });
    }

    // ── Guards ────────────────────────────────────────────
    if (wallet.vendor_status !== "active") {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "Only active vendors can withdraw",
      });
    }

    if (!wallet.bank_account || !wallet.bank_name) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "No payout bank account configured",
      });
    }

    const available = Number(wallet.available_balance);

    if (requested > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₦${available.toLocaleString()}`,
        available,
      });
    }

    const txRef  = `WD-${wallet.vendor_id}-${Date.now()}`;
    const flwFee = 0; // Flutterwave charges from your balance, adjust if needed

    // ── Insert withdrawal request ─────────────────────────
    const { rows: [request] } = await client.query(
      `INSERT INTO market.vendor_withdrawal_requests
         (vendor_id, wallet_id, amount, fee, net_amount,
          bank_name, bank_code, account_number, account_name,
          tx_ref, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'processing')
       RETURNING *`,
      [
        wallet.vendor_id,
        wallet.id,
        requested,
        flwFee,
        requested - flwFee,
        wallet.bank_name,
        wallet.bank_code   ?? null,
        wallet.bank_account,
        wallet.account_name,
        txRef,
      ]
    );

    // ── Deduct from available, add to pending ─────────────
    await client.query(
      `UPDATE market.vendor_wallets
       SET available_balance = available_balance - $1,
           pending_balance   = pending_balance   + $1,
           updated_at        = NOW()
       WHERE id = $2`,
      [requested, wallet.id]
    );

    // ── Log debit transaction ─────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_transactions
         (vendor_id, wallet_id, tx_ref, type,
          amount, fee, currency, status, narration)
       VALUES ($1,$2,$3,'withdrawal',$4,$5,'NGN','pending',$6)`,
      [
        wallet.vendor_id,
        wallet.id,
        txRef,
        requested,
        flwFee,
        `Withdrawal to ${wallet.bank_name}`,
      ]
    );

    await client.query("COMMIT");

    // ── Call Flutterwave AFTER commit ─────────────────────
    // If FLW fails, we handle it in webhook / retry
    try {
      const { data } = await flw().post("/transfers", {
        account_bank:   wallet.bank_code ?? wallet.bank_name,
        account_number: wallet.bank_account,
        amount:         requested,
        narration:      `${wallet.store_name} payout`,
        currency:       "NGN",
        reference:      txRef,
        callback_url:   `${process.env.CLIENT_URL}/api/seller-wallet/webhook`,
        debit_currency: "NGN",
        meta: [{
          metaname:  "vendor_id",
          metavalue: wallet.vendor_id,
        }],
      });

      if (data.status === "success") {
        // Update request with FLW transfer ID
        await pool.query(
          `UPDATE market.vendor_withdrawal_requests
           SET flw_transfer_id = $1
           WHERE id = $2`,
          [data.data?.id?.toString(), request.id]
        );
      }

    } catch (flwErr) {
      console.error("[withdraw] FLW error:", flwErr.response?.data ?? flwErr.message);
      // Don't throw — webhook will handle or admin can retry
    }

    return res.json({
      success:   true,
      message:   `₦${requested.toLocaleString()} withdrawal initiated`,
      reference: txRef,
      status:    "processing",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[withdraw]", err.message);
    return res.status(500).json({
      success: false, message: "Withdrawal failed. Try again.",
    });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-wallet/webhook
// Flutterwave payment notifications
// ════════════════════════════════════════════════════════════
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    // ── Verify webhook signature ──────────────────────────
    const signature = req.headers["verif-hash"];
    const secret    = process.env.FLW_WEBHOOK_HASH;

    if (secret && signature !== secret) {
      console.warn("[webhook] invalid signature");
      return res.status(401).json({ message: "Invalid signature" });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ message: "Invalid JSON payload" });
    }

    const eventId = event.data?.id?.toString();

    console.log("[webhook] event:", event.event, "| id:", eventId);

    // ── Respond immediately ───────────────────────────────
    res.status(200).json({ status: "received" });

    if (!eventId) return;

    // ── Idempotency check ─────────────────────────────────
    try {
      const { rowCount } = await pool.query(
        `INSERT INTO market.flutterwave_webhook_events
           (event_id, event_type, payload, processed)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT (event_id) DO NOTHING`,
        [eventId, event.event, JSON.stringify(event)]
      );

      if (rowCount === 0) {
        console.log("[webhook] duplicate event — skipped:", eventId);
        return;
      }
    } catch (err) {
      console.error("[webhook] idempotency check failed:", err.message);
      return;
    }

    // ── Process event ─────────────────────────────────────
    try {
      if (event.event === "charge.completed") {
        await handleIncomingPayment(event.data);
      }

      if (event.event === "transfer.completed") {
        await handleTransferComplete(event.data);
      }

      // Mark processed
      await pool.query(
        `UPDATE market.flutterwave_webhook_events
         SET processed = TRUE WHERE event_id = $1`,
        [eventId]
      );

    } catch (err) {
      console.error("[webhook] processing error:", err.message);
    }
  }
);

// ════════════════════════════════════════════════════════════
// HANDLER: Incoming payment → credit wallet
// ════════════════════════════════════════════════════════════
async function handleIncomingPayment(data) {
  const accountNumber =
    data.virtual_account_number ??
    data.meta?.virtual_account_number;

  if (!accountNumber) {
    console.warn("[handleIncomingPayment] no account number");
    return;
  }

  // Find virtual account
  const { rows: [va] } = await pool.query(
    `SELECT va.*, w.id AS wallet_id
     FROM market.vendor_virtual_accounts va
     JOIN market.vendor_wallets w ON w.vendor_id = va.vendor_id
     WHERE va.account_number = $1`,
    [accountNumber]
  );

  if (!va) {
    console.warn("[handleIncomingPayment] virtual account not found:", accountNumber);
    return;
  }

  const amount = Number(data.amount  ?? 0);
  const fee    = Number(data.app_fee ?? 0);
  const net    = Math.max(amount - fee, 0);

  const txRef = data.tx_ref ?? `CREDIT-${va.vendor_id}-${Date.now()}`;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Credit wallet
    await client.query(
      `UPDATE market.vendor_wallets
       SET available_balance = available_balance + $1,
           total_received    = total_received    + $1,
           updated_at        = NOW()
       WHERE id = $2`,
      [net, va.wallet_id]
    );

    // Log transaction
    await client.query(
      `INSERT INTO market.vendor_transactions
         (vendor_id, virtual_account_id, wallet_id,
          flw_tx_id, flw_ref, tx_ref,
          type, amount, fee, currency,
          status, narration, sender_name, sender_bank)
       VALUES ($1,$2,$3,$4,$5,$6,
               'credit',$7,$8,$9,'success',$10,$11,$12)
       ON CONFLICT (tx_ref) DO NOTHING`,
      [
        va.vendor_id,
        va.id,
        va.wallet_id,
        data.id?.toString(),
        data.flw_ref,
        txRef,
        net,
        fee,
        data.currency     ?? "NGN",
        data.narration    ?? "Payment received",
        data.customer?.name     ?? null,
        data.customer?.bank_code ?? null,
      ]
    );

    await client.query("COMMIT");

    console.log(
      `[handleIncomingPayment] ₦${net} credited to vendor ${va.vendor_id}`
    );

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[handleIncomingPayment] DB error:", err.message);
  } finally {
    client.release();
  }
}

// ════════════════════════════════════════════════════════════
// HANDLER: Transfer complete → update withdrawal request
// ════════════════════════════════════════════════════════════
async function handleTransferComplete(data) {
  const txRef   = data.reference;
  const success = data.status === "SUCCESSFUL";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find withdrawal request
    const { rows: [request] } = await client.query(
      `SELECT * FROM market.vendor_withdrawal_requests
       WHERE tx_ref = $1
       FOR UPDATE`,
      [txRef]
    );

    if (!request) {
      await client.query("ROLLBACK");
      console.warn("[handleTransferComplete] request not found:", txRef);
      return;
    }

    if (success) {
      // ── Success: finalize ───────────────────────────────
      await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status       = 'success',
             processed_at = NOW()
         WHERE id = $1`,
        [request.id]
      );

      // Move pending → withdrawn
      await client.query(
        `UPDATE market.vendor_wallets
         SET pending_balance  = pending_balance  - $1,
             total_withdrawn  = total_withdrawn  + $1,
             updated_at       = NOW()
         WHERE vendor_id = $2`,
        [request.amount, request.vendor_id]
      );

      // Update transaction
      await client.query(
        `UPDATE market.vendor_transactions
         SET status = 'success'
         WHERE tx_ref = $1`,
        [txRef]
      );

      console.log(
        `[handleTransferComplete] ✅ ₦${request.amount} paid to vendor ${request.vendor_id}`
      );

    } else {
      // ── Failed: refund ──────────────────────────────────
      const reason = data.complete_message ?? "Transfer failed";

      await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status         = 'failed',
             failure_reason = $1,
             processed_at   = NOW()
         WHERE id = $2`,
        [reason, request.id]
      );

      // Refund: pending → available
      await client.query(
        `UPDATE market.vendor_wallets
         SET available_balance = available_balance + $1,
             pending_balance   = pending_balance   - $1,
             updated_at        = NOW()
         WHERE vendor_id = $2`,
        [request.amount, request.vendor_id]
      );

      // Update transaction
      await client.query(
        `UPDATE market.vendor_transactions
         SET status = 'failed'
         WHERE tx_ref = $1`,
        [txRef]
      );

      console.log(
        `[handleTransferComplete] ❌ Failed — ₦${request.amount} refunded to vendor ${request.vendor_id}`
      );
    }

    await client.query("COMMIT");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[handleTransferComplete] DB error:", err.message);
  } finally {
    client.release();
  }
}

export default router;