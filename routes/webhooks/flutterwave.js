// routes/webhooks/flutterwave.js
import express  from "express";
import axios    from "axios";
import { pool } from "../../server.js";

const router = express.Router();

const SECRET_HASH = () => process.env.FLW_SECRET_HASH ?? "";
const SECRET_KEY  = () => process.env.FLW_SECRET_KEY  ?? "";

// ─────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────
const log = (level, tag, data = {}) => {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    src: "FLW-WEBHOOK",
    tag,
    ...data,
  });
  if (level === "error")      console.error(line);
  else if (level === "warn")  console.warn(line);
  else                        console.log(line);
};

// ─────────────────────────────────────────────────────────────
// SIGNATURE CHECK
// Flutterwave sends your secret hash in "verif-hash" header
// ─────────────────────────────────────────────────────────────
const checkSignature = (req) => {
  const hash = SECRET_HASH();

  if (!hash) {
    log("warn", "NO_SECRET_HASH_CONFIGURED");
    // Allow in dev — block in production
    return process.env.NODE_ENV !== "production";
  }

  const sent = req.headers["verif-hash"] ?? "";
  if (sent !== hash) {
    log("warn", "BAD_SIGNATURE", {
      sent_preview:     sent.slice(0, 8)  + "…",
      expected_preview: hash.slice(0, 8)  + "…",
      match: false,
    });
    return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────
// VERIFY WITH FLUTTERWAVE API
// Never trust the webhook payload — always verify
// ─────────────────────────────────────────────────────────────
const verifyWithFLW = async (txId) => {
  const key = SECRET_KEY();
  if (!key) {
    log("error", "NO_FLW_SECRET_KEY");
    return null;
  }
  try {
    const { data } = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${txId}/verify`,
      {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 15_000,
      }
    );
    return data;
  } catch (err) {
    log("error", "FLW_VERIFY_ERROR", {
      txId,
      status: err.response?.status,
      msg:    err.response?.data?.message ?? err.message,
    });
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// EXTRACT VIRTUAL ACCOUNT NUMBER
//
// Flutterwave puts the credited virtual account number in
// DIFFERENT places depending on the API version and event type.
//
// For "charge.completed" on a virtual account / bank transfer:
//   data.meta.originatoraccountnumber  ← the PAYER's account
//   data.payment_type_meta.account_number ← sometimes here
//   data.virtual_account_number         ← direct field
//   data.account_number                 ← fallback
//
// The CREDITED account (our virtual account) is usually in:
//   data.meta.virtual_account_number   ← most reliable
//   data.payment_type_meta.AccountNumber
//   data.flw_ref (sometimes contains account)
//
// We log ALL fields so you can see exactly where it is.
// ─────────────────────────────────────────────────────────────
const extractCreditedAccountNumber = (data) => {
  if (!data) return null;

  const meta     = data.meta     ?? {};
  const ptMeta   = data.payment_type_meta ?? {};
  const dest     = ptMeta.destination ?? {};
  const origin   = ptMeta.origin ?? {};

  // Ordered by likelihood for virtual account credits
  const candidates = [
    // Most common locations for the CREDITED virtual account
    data.virtual_account_number,
    meta.virtual_account_number,
    meta.AccountNumber,
    meta.account_number,
    dest.account_number,
    dest.AccountNumber,
    ptMeta.virtual_account_number,
    ptMeta.AccountNumber,
    ptMeta.account_number,
    data.account_number,
  ];

  for (const c of candidates) {
    const s = String(c ?? "").trim().replace(/\s/g, "");
    if (s && /^\d{10,}$/.test(s)) return s;
  }

  return null;
};

// ─────────────────────────────────────────────────────────────
// FIND VENDOR BY VIRTUAL ACCOUNT NUMBER
// ─────────────────────────────────────────────────────────────
const findVendorByAccount = async (client, accountNumber) => {
  if (!accountNumber) return null;

  const { rows } = await client.query(
    `SELECT
       va.vendor_id,
       va.account_number,
       va.bank_name,
       v.store_name,
       v.status   AS vendor_status,
       v.user_id
     FROM market.vendor_virtual_accounts va
     JOIN market.vendors v ON v.id = va.vendor_id
     WHERE va.account_number = $1
     LIMIT 1`,
    [accountNumber.trim()]
  );

  return rows[0] ?? null;
};

// ─────────────────────────────────────────────────────────────
// IDEMPOTENCY — prevent double-credit
// ─────────────────────────────────────────────────────────────
const isDuplicate = async (client, { flwRef, txRef, txId }) => {
  const { rows } = await client.query(
    `SELECT id FROM market.vendor_transactions
     WHERE flw_ref = $1
        OR tx_ref  = $2
        OR (meta->>'flw_transaction_id') = $3
     LIMIT 1`,
    [
      flwRef  ?? "__none__",
      txRef   ?? "__none__",
      String(txId ?? "__none__"),
    ]
  );
  return rows.length > 0;
};

// ─────────────────────────────────────────────────────────────
// CREDIT VENDOR WALLET — fully atomic
// ─────────────────────────────────────────────────────────────
const creditWallet = async (client, {
  vendorId, amount, currency,
  flwRef, txRef, narration, meta,
}) => {
  // 1. Ensure wallet exists
  await client.query(
    `INSERT INTO market.vendor_wallets
       (vendor_id, available_balance, pending_balance,
        total_received, total_withdrawn, currency, updated_at)
     VALUES ($1, 0, 0, 0, 0, $2, NOW())
     ON CONFLICT (vendor_id) DO NOTHING`,
    [vendorId, currency ?? "NGN"]
  );

  // 2. Credit
  const { rows: [wallet] } = await client.query(
    `UPDATE market.vendor_wallets
     SET available_balance = available_balance + $1,
         total_received    = total_received    + $1,
         updated_at        = NOW()
     WHERE vendor_id = $2
     RETURNING vendor_id, available_balance, total_received`,
    [amount, vendorId]
  );

  // 3. Transaction log
  await client.query(
    `INSERT INTO market.vendor_transactions
       (vendor_id, type, amount, fee, currency,
        status, narration, flw_ref, tx_ref, meta, created_at)
     VALUES ($1, 'credit', $2, 0, $3,
             'success', $4, $5, $6, $7, NOW())`,
    [
      vendorId,
      amount,
      currency ?? "NGN",
      narration ?? "Virtual account credit",
      flwRef ?? null,
      txRef  ?? null,
      JSON.stringify(meta ?? {}),
    ]
  );

  return wallet;
};

// ─────────────────────────────────────────────────────────────
// NOTIFY VENDOR (non-critical — never throws)
// ─────────────────────────────────────────────────────────────
const notifyVendor = async (userId, amount, currency) => {
  try {
    const formatted = `₦${Number(amount).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
    })}`;
    await pool.query(
      `INSERT INTO market.notifications
         (user_id, type, message, read, created_at)
       VALUES ($1, 'wallet_credit', $2, FALSE, NOW())`,
      [userId, `💰 ${formatted} has been credited to your seller wallet`]
    );
  } catch (err) {
    log("warn", "NOTIFY_FAILED", { userId, error: err.message });
  }
};

// ═════════════════════════════════════════════════════════════
// HANDLE: charge.completed
// ═════════════════════════════════════════════════════════════
async function handleChargeCompleted(rawData) {
  const txId  = rawData?.id;
  const txRef = rawData?.tx_ref;

  // ── Log EVERYTHING so we can see the full payload ────────
  log("info", "CHARGE_RECEIVED", {
    txId,
    txRef,
    status:           rawData?.status,
    payment_type:     rawData?.payment_type,
    amount:           rawData?.amount,
    currency:         rawData?.currency,
    // These are where the virtual account number might be:
    virtual_account_number: rawData?.virtual_account_number,
    account_number:         rawData?.account_number,
    meta:                   rawData?.meta,
    payment_type_meta:      rawData?.payment_type_meta,
    customer:               rawData?.customer,
    all_keys:               Object.keys(rawData ?? {}),
  });

  // ── Only process successful payments ──────────────────────
  if (rawData?.status?.toLowerCase() !== "successful") {
    log("info", "SKIPPED_NOT_SUCCESSFUL", {
      status: rawData?.status, txRef,
    });
    return;
  }

  // ── Verify with FLW API ───────────────────────────────────
  log("info", "VERIFYING_WITH_FLW", { txId });
  const verifyRes = await verifyWithFLW(txId);

  if (!verifyRes || verifyRes.status !== "success") {
    log("error", "VERIFICATION_FAILED", {
      txId, verifyRes,
    });
    return;
  }

  const v = verifyRes.data; // verified transaction object

  log("info", "VERIFIED_DATA", {
    txId,
    verified_status:           v.status,
    verified_amount:           v.amount,
    verified_currency:         v.currency,
    verified_payment_type:     v.payment_type,
    // Log verified object's key locations:
    v_virtual_account_number:  v.virtual_account_number,
    v_account_number:          v.account_number,
    v_meta:                    v.meta,
    v_payment_type_meta:       v.payment_type_meta,
    v_all_keys:                Object.keys(v ?? {}),
  });

  if (v.status?.toLowerCase() !== "successful") {
    log("error", "VERIFIED_STATUS_NOT_SUCCESSFUL", {
      status: v.status, txId,
    });
    return;
  }

  // Amount sanity check (allow ±1 unit for rounding)
  if (
    Math.abs(Number(v.amount) - Number(rawData.amount)) > 1
  ) {
    log("error", "AMOUNT_MISMATCH", {
      webhook:  rawData.amount,
      verified: v.amount,
    });
    return;
  }

  // ── Extract virtual account number ────────────────────────
  // Try webhook data first, then verified data
  const accountNumber =
    extractCreditedAccountNumber(rawData)
    ?? extractCreditedAccountNumber(v);

  log("info", "ACCOUNT_EXTRACTION", {
    found:        accountNumber,
    tried_raw:    {
      virtual_account_number: rawData?.virtual_account_number,
      account_number:         rawData?.account_number,
      meta_keys:              Object.keys(rawData?.meta ?? {}),
      ptype_meta_keys:        Object.keys(rawData?.payment_type_meta ?? {}),
    },
    tried_verified: {
      virtual_account_number: v?.virtual_account_number,
      account_number:         v?.account_number,
      meta_keys:              Object.keys(v?.meta ?? {}),
      ptype_meta_keys:        Object.keys(v?.payment_type_meta ?? {}),
    },
  });

  // ── FALLBACK: if account number not in payload,
  //    search by tx_ref or flw_ref in our DB
  //    (in case we stored it during virtual account creation)
  let resolvedAccount = accountNumber;

  if (!resolvedAccount) {
    log("warn", "ACCOUNT_NOT_IN_PAYLOAD_TRYING_DB_FALLBACK", {
      txId, txRef, flwRef: v.flw_ref,
    });

    // Try looking up by tx_ref pattern (if you embed account in tx_ref)
    // e.g. tx_ref = "VA-0123456789-1234567890"
    const txRefMatch = txRef?.match(/\d{10}/);
    if (txRefMatch) {
      resolvedAccount = txRefMatch[0];
      log("info", "ACCOUNT_FROM_TX_REF", { resolvedAccount });
    }
  }

  if (!resolvedAccount) {
    log("error", "NO_VIRTUAL_ACCOUNT_NUMBER", {
      txId,
      txRef,
      rawData_full: rawData,
      verified_full: v,
    });
    return;
  }

  // ── DB operations ─────────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Idempotency check
    const dup = await isDuplicate(client, {
      flwRef: v.flw_ref ?? rawData.flw_ref,
      txRef:  v.tx_ref  ?? txRef,
      txId,
    });

    if (dup) {
      log("info", "DUPLICATE_SKIPPED", { txId, txRef });
      await client.query("ROLLBACK");
      return;
    }

    // Find vendor
    const vendor = await findVendorByAccount(client, resolvedAccount);

    log("info", "VENDOR_LOOKUP", {
      accountNumber: resolvedAccount,
      found:         !!vendor,
      vendorId:      vendor?.vendor_id,
      storeName:     vendor?.store_name,
      vendorStatus:  vendor?.vendor_status,
    });

    if (!vendor) {
      log("error", "VENDOR_NOT_FOUND", {
        accountNumber: resolvedAccount,
        txId, txRef,
      });
      await client.query("ROLLBACK");
      return;
    }

    // Credit wallet
    const wallet = await creditWallet(client, {
      vendorId:  vendor.vendor_id,
      amount:    Number(v.amount),
      currency:  v.currency ?? "NGN",
      flwRef:    v.flw_ref  ?? rawData.flw_ref,
      txRef:     v.tx_ref   ?? txRef,
      narration: `Payment from ${
        v.customer?.name
        ?? v.customer?.email
        ?? "customer"
      } via virtual account`,
      meta: {
        flw_transaction_id: txId,
        customer_name:      v.customer?.name,
        customer_email:     v.customer?.email,
        customer_phone:     v.customer?.phone_number,
        virtual_account:    resolvedAccount,
        payment_type:       v.payment_type,
        payment_type_meta:  v.payment_type_meta,
        raw_meta:           rawData.meta,
      },
    });

    await client.query("COMMIT");

    log("info", "PAYMENT_PROCESSED", {
      vendorId:     vendor.vendor_id,
      storeName:    vendor.store_name,
      amount:       v.amount,
      currency:     v.currency,
      newBalance:   wallet?.available_balance,
      totalReceived:wallet?.total_received,
      txId, txRef,
    });

    // Notify after commit (non-blocking)
    notifyVendor(
      vendor.user_id,
      Number(v.amount),
      v.currency
    ).catch(() => {});

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log("error", "CREDIT_FAILED", {
      error:         err.message,
      code:          err.code,
      detail:        err.detail,
      txId, txRef,
      accountNumber: resolvedAccount,
    });
  } finally {
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════
// HANDLE: transfer.completed (withdrawal status update)
// ═════════════════════════════════════════════════════════════
async function handleTransferCompleted(data) {
  const txRef      = data?.reference ?? data?.tx_ref;
  const transferId = data?.id;
  const status     = data?.status?.toUpperCase();

  log("info", "TRANSFER_RECEIVED", { transferId, txRef, status });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (["SUCCESSFUL", "SUCCESS"].includes(status)) {
      const { rows: [wd] } = await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status       = 'success',
             processed_at = NOW(),
             updated_at   = NOW()
         WHERE (tx_ref = $1 OR flw_transfer_id::text = $2)
           AND status    = 'processing'
         RETURNING id, vendor_id, amount`,
        [txRef ?? "", String(transferId ?? "")]
      );

      if (wd) {
        await client.query(
          `UPDATE market.vendor_wallets
           SET pending_balance = GREATEST(0, pending_balance - $1),
               total_withdrawn = total_withdrawn + $1,
               updated_at      = NOW()
           WHERE vendor_id = $2`,
          [wd.amount, wd.vendor_id]
        );
        await client.query(
          `UPDATE market.vendor_transactions
           SET status   = 'success',
               narration = 'Withdrawal completed'
           WHERE tx_ref = $1`,
          [txRef]
        );
        log("info", "WITHDRAWAL_SUCCESS", {
          vendorId: wd.vendor_id,
          amount:   wd.amount,
          txRef,
        });
      } else {
        log("warn", "WITHDRAWAL_RECORD_NOT_FOUND", {
          txRef, transferId,
        });
      }

    } else if (["FAILED", "CANCELLED"].includes(status)) {
      const { rows: [wd] } = await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status         = 'failed',
             failure_reason = $1,
             processed_at   = NOW(),
             updated_at     = NOW()
         WHERE (tx_ref = $2 OR flw_transfer_id::text = $3)
           AND status    = 'processing'
         RETURNING id, vendor_id, amount`,
        [
          data?.complete_message ?? `Transfer ${status}`,
          txRef ?? "",
          String(transferId ?? ""),
        ]
      );

      if (wd) {
        // Restore balance
        await client.query(
          `UPDATE market.vendor_wallets
           SET available_balance = available_balance + $1,
               pending_balance   = GREATEST(0, pending_balance - $1),
               updated_at        = NOW()
           WHERE vendor_id = $2`,
          [wd.amount, wd.vendor_id]
        );
        await client.query(
          `UPDATE market.vendor_transactions
           SET status   = 'failed',
               narration = $1
           WHERE tx_ref = $2`,
          [
            `Withdrawal failed: ${data?.complete_message ?? status}`,
            txRef,
          ]
        );
        log("warn", "WITHDRAWAL_REVERSED", {
          vendorId: wd.vendor_id,
          amount:   wd.amount,
          txRef,
          reason:   data?.complete_message,
        });
      }
    } else {
      log("info", "TRANSFER_STATUS_UNHANDLED", { status, txRef });
    }

    await client.query("COMMIT");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log("error", "TRANSFER_HANDLER_FAILED", {
      error: err.message, txRef, transferId,
    });
  } finally {
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════
// POST /api/webhooks/flutterwave
// ═════════════════════════════════════════════════════════════
router.post("/", async (req, res) => {

  // ── Signature check ──────────────────────────────────────
  if (!checkSignature(req)) {
    // Return 200 to stop FLW retries, but don't process
    log("warn", "REJECTED_INVALID_SIGNATURE");
    return res.status(200).json({
      received: false,
      reason:   "invalid_signature",
    });
  }

  const body  = req.body ?? {};
  const event = body.event;
  const data  = body.data;

  log("info", "WEBHOOK_RECEIVED", {
    event,
    txId:   data?.id,
    txRef:  data?.tx_ref,
    status: data?.status,
    amount: data?.amount,
    type:   data?.payment_type,
  });

  // ── Respond 200 immediately ───────────────────────────────
  // FLW marks webhook as failed if no 200 within ~30s
  // Processing happens after response is sent
  res.status(200).json({ received: true, event });

  // ── Process asynchronously ────────────────────────────────
  setImmediate(async () => {
    try {
      switch (event) {
        case "charge.completed":
          await handleChargeCompleted(data);
          break;

        case "transfer.completed":
          await handleTransferCompleted(data);
          break;

        default:
          log("info", "UNHANDLED_EVENT", { event });
      }
    } catch (err) {
      log("error", "UNHANDLED_EXCEPTION", {
        event,
        error: err.message,
        stack: err.stack,
      });
    }
  });
});

export default router;