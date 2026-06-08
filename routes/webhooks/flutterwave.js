// routes/webhooks/flutterwave.js
import express  from "express";
import axios    from "axios";
import { pool } from "../../server.js";

const router = express.Router();

const SECRET_HASH = () => process.env.FLW_SECRET_HASH ?? "";
const SECRET_KEY  = () => process.env.FLW_SECRET_KEY  ?? "";

// ── Logger ────────────────────────────────────────────────────
const log = (level, tag, data = {}) => {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    src: "FLW-WEBHOOK",
    tag,
    ...data,
  });
  if (level === "error")     console.error(line);
  else if (level === "warn") console.warn(line);
  else                       console.log(line);
};

// ── Signature check ───────────────────────────────────────────
const checkSignature = (req) => {
  const hash     = SECRET_HASH();
  const received = req.headers["verif-hash"] ?? "";

  log("info", "SIGNATURE_CHECK", {
    received_preview: received.slice(0, 8) + "…",
    expected_preview: hash.slice(0, 8) + "…",
    match: received === hash,
    hash_configured: !!hash,
  });

  if (!hash) {
    log("warn", "NO_SECRET_HASH");
    return process.env.NODE_ENV !== "production";
  }

  return received === hash;
};

// ── Verify with FLW API ───────────────────────────────────────
const verifyWithFLW = async (txId) => {
  const key = SECRET_KEY();
  if (!key) {
    log("error", "NO_FLW_KEY");
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

// ── Extract virtual account number ────────────────────────────
// Tries every known field location in FLW payload
const extractAccount = (data) => {
  if (!data) return null;

  const meta   = data.meta             ?? {};
  const ptMeta = data.payment_type_meta ?? {};
  const dest   = ptMeta.destination    ?? {};

  const candidates = [
    data.virtual_account_number,
    data.account_number,
    meta.virtual_account_number,
    meta.AccountNumber,
    meta.account_number,
    dest.account_number,
    dest.AccountNumber,
    ptMeta.virtual_account_number,
    ptMeta.AccountNumber,
    ptMeta.account_number,
  ];

  for (const c of candidates) {
    const s = String(c ?? "").trim().replace(/\s/g, "");
    if (s && /^\d{10,}$/.test(s)) return s;
  }

  return null;
};

// ── Find vendor by virtual account ───────────────────────────
const findVendor = async (client, accountNumber) => {
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

// ── Idempotency check ─────────────────────────────────────────
const isDuplicate = async (client, { flwRef, txRef, txId }) => {
  const { rows } = await client.query(
    `SELECT id FROM market.vendor_transactions
     WHERE flw_ref = $1
        OR tx_ref  = $2
        OR (meta->>'flw_transaction_id') = $3
     LIMIT 1`,
    [
      flwRef ?? "__none__",
      txRef  ?? "__none__",
      String(txId ?? "__none__"),
    ]
  );
  return rows.length > 0;
};

// ── Credit wallet ─────────────────────────────────────────────
const creditWallet = async (client, {
  vendorId,
  amount,
  currency,
  flwRef,
  txRef,
  narration,
  meta,
}) => {
  // Ensure wallet row exists
  await client.query(
    `INSERT INTO market.vendor_wallets
       (vendor_id, available_balance, pending_balance,
        total_received, total_withdrawn, currency, updated_at)
     VALUES ($1, 0, 0, 0, 0, $2, NOW())
     ON CONFLICT (vendor_id) DO NOTHING`,
    [vendorId, currency ?? "NGN"]
  );

  // Credit available balance
  const { rows: [wallet] } = await client.query(
    `UPDATE market.vendor_wallets
     SET available_balance = available_balance + $1,
         total_received    = total_received    + $1,
         updated_at        = NOW()
     WHERE vendor_id = $2
     RETURNING
       vendor_id,
       available_balance,
       total_received`,
    [amount, vendorId]
  );

  // Transaction record
  await client.query(
    `INSERT INTO market.vendor_transactions
       (vendor_id, type, amount, fee, currency,
        status, narration, flw_ref, tx_ref,
        meta, created_at)
     VALUES
       ($1,'credit',$2,0,$3,
        'success',$4,$5,$6,
        $7,NOW())`,
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

// ── Notify vendor (non-critical) ──────────────────────────────
const notifyVendor = async (userId, amount, currency) => {
  try {
    const formatted = `₦${Number(amount).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
    })}`;
    await pool.query(
      `INSERT INTO market.notifications
         (user_id, type, message, read, created_at)
       VALUES ($1,'wallet_credit',$2,FALSE,NOW())`,
      [
        userId,
        `💰 ${formatted} credited to your seller wallet`,
      ]
    );
  } catch (err) {
    log("warn", "NOTIFY_FAILED", {
      userId,
      error: err.message,
    });
  }
};

// ── Process charge with DB ────────────────────────────────────
const processCredit = async ({
  txId,
  txRef,
  flwRef,
  amount,
  currency,
  accountNumber,
  customerName,
  customerEmail,
  paymentType,
  rawMeta,
  source,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Idempotency
    const dup = await isDuplicate(client, {
      flwRef,
      txRef,
      txId,
    });

    if (dup) {
      log("info", "DUPLICATE_SKIPPED", { txId, txRef });
      await client.query("ROLLBACK");
      return;
    }

    // Find vendor
    const vendor = await findVendor(client, accountNumber);

    log("info", "VENDOR_LOOKUP", {
      accountNumber,
      found:        !!vendor,
      vendorId:     vendor?.vendor_id,
      storeName:    vendor?.store_name,
      vendorStatus: vendor?.vendor_status,
    });

    if (!vendor) {
      log("error", "VENDOR_NOT_FOUND", {
        accountNumber,
        txId,
        txRef,
      });
      await client.query("ROLLBACK");
      return;
    }

    // Credit
    const wallet = await creditWallet(client, {
      vendorId:  vendor.vendor_id,
      amount:    Number(amount),
      currency:  currency ?? "NGN",
      flwRef,
      txRef,
      narration: `Payment from ${
        customerName ?? customerEmail ?? "customer"
      } via virtual account`,
      meta: {
        flw_transaction_id: txId,
        customer_name:      customerName,
        customer_email:     customerEmail,
        virtual_account:    accountNumber,
        payment_type:       paymentType,
        raw_meta:           rawMeta,
        source,
      },
    });

    await client.query("COMMIT");

    log("info", "PAYMENT_PROCESSED", {
      vendorId:      vendor.vendor_id,
      storeName:     vendor.store_name,
      amount,
      currency,
      newBalance:    wallet?.available_balance,
      totalReceived: wallet?.total_received,
      txId,
      txRef,
      source,
    });

    // Notify after commit
    notifyVendor(
      vendor.user_id,
      Number(amount),
      currency
    ).catch(() => {});

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log("error", "CREDIT_FAILED", {
      error:         err.message,
      code:          err.code,
      detail:        err.detail,
      txId,
      txRef,
      accountNumber,
    });
  } finally {
    client.release();
  }
};

// ══════════════════════════════════════════════════════════════
// HANDLE: charge.completed
// ══════════════════════════════════════════════════════════════
async function handleChargeCompleted(rawData) {
  const txId  = rawData?.id;
  const txRef = rawData?.tx_ref;

  log("info", "CHARGE_RECEIVED", {
    txId,
    txRef,
    status:                 rawData?.status,
    payment_type:           rawData?.payment_type,
    amount:                 rawData?.amount,
    currency:               rawData?.currency,
    virtual_account_number: rawData?.virtual_account_number,
    account_number:         rawData?.account_number,
    meta:                   rawData?.meta,
    payment_type_meta:      rawData?.payment_type_meta,
    all_keys:               Object.keys(rawData ?? {}),
  });

  // Only successful payments
  if (rawData?.status?.toLowerCase() !== "successful") {
    log("info", "SKIPPED_NOT_SUCCESSFUL", {
      status: rawData?.status,
      txRef,
    });
    return;
  }

  // Only bank transfer type
  const ptype = rawData?.payment_type?.toLowerCase();
  if (ptype !== "bank_transfer" && ptype !== "account") {
    log("info", "SKIPPED_WRONG_TYPE", {
      payment_type: rawData?.payment_type,
      txRef,
    });
    return;
  }

  // ── Step 1: Try to verify with FLW API ───────────────────
  log("info", "VERIFYING_WITH_FLW", { txId });
  const verifyRes = await verifyWithFLW(txId);

  if (verifyRes && verifyRes.status === "success") {
    const v = verifyRes.data;

    log("info", "VERIFIED_DATA", {
      txId,
      verified_status:           v.status,
      verified_amount:           v.amount,
      virtual_account_number:    v.virtual_account_number,
      account_number:            v.account_number,
      v_meta:                    v.meta,
      v_payment_type_meta:       v.payment_type_meta,
      v_all_keys:                Object.keys(v ?? {}),
    });

    if (v.status?.toLowerCase() !== "successful") {
      log("error", "VERIFIED_NOT_SUCCESSFUL", {
        status: v.status,
        txId,
      });
      return;
    }

    // Amount sanity check
    if (
      Math.abs(Number(v.amount) - Number(rawData.amount)) > 1
    ) {
      log("error", "AMOUNT_MISMATCH", {
        webhook:  rawData.amount,
        verified: v.amount,
      });
      return;
    }

    // Extract account from verified or raw data
    const accountNumber =
      extractAccount(v) ?? extractAccount(rawData);

    log("info", "ACCOUNT_EXTRACTION", {
      found:         accountNumber,
      from_verified: extractAccount(v),
      from_raw:      extractAccount(rawData),
    });

    if (!accountNumber) {
      log("error", "NO_ACCOUNT_NUMBER", {
        txId,
        txRef,
        v_keys:         Object.keys(v ?? {}),
        v_meta:         v?.meta,
        v_ptmeta:       v?.payment_type_meta,
        raw_keys:       Object.keys(rawData ?? {}),
        raw_meta:       rawData?.meta,
      });
      return;
    }

    await processCredit({
      txId,
      txRef:         v.tx_ref  ?? txRef,
      flwRef:        v.flw_ref ?? rawData.flw_ref,
      amount:        Number(v.amount),
      currency:      v.currency ?? rawData.currency ?? "NGN",
      accountNumber,
      customerName:  v.customer?.name,
      customerEmail: v.customer?.email,
      paymentType:   v.payment_type,
      rawMeta:       rawData.meta,
      source:        "verified",
    });

    return;
  }

  // ── Step 2: Verification failed — use webhook data directly
  // The signature was already verified so the payload is genuine
  log("warn", "VERIFICATION_FAILED_USING_WEBHOOK_DATA", {
    txId,
    txRef,
    verifyRes,
  });

  const accountNumber =
    extractAccount(rawData);

  log("info", "ACCOUNT_EXTRACTION_FALLBACK", {
    found:    accountNumber,
    raw_keys: Object.keys(rawData ?? {}),
    raw_meta: rawData?.meta,
    raw_ptm:  rawData?.payment_type_meta,
  });

  if (!accountNumber) {
    log("error", "NO_ACCOUNT_NUMBER_FALLBACK", {
      txId,
      txRef,
      rawData,
    });
    return;
  }

  await processCredit({
    txId,
    txRef,
    flwRef:        rawData.flw_ref,
    amount:        Number(rawData.amount),
    currency:      rawData.currency ?? "NGN",
    accountNumber,
    customerName:  rawData.customer?.name,
    customerEmail: rawData.customer?.email,
    paymentType:   rawData.payment_type,
    rawMeta:       rawData.meta,
    source:        "webhook_fallback",
  });
}

// ══════════════════════════════════════════════════════════════
// HANDLE: transfer.completed (withdrawal updates)
// ══════════════════════════════════════════════════════════════
async function handleTransferCompleted(data) {
  const txRef      = data?.reference ?? data?.tx_ref;
  const transferId = data?.id;
  const status     = data?.status?.toUpperCase();

  log("info", "TRANSFER_RECEIVED", {
    transferId,
    txRef,
    status,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (["SUCCESSFUL", "SUCCESS"].includes(status)) {
      const { rows: [wd] } = await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status       = 'success',
             processed_at = NOW(),
             updated_at   = NOW()
         WHERE (tx_ref = $1
             OR flw_transfer_id::text = $2)
           AND status = 'processing'
         RETURNING id, vendor_id, amount`,
        [txRef ?? "", String(transferId ?? "")]
      );

      if (wd) {
        await client.query(
          `UPDATE market.vendor_wallets
           SET pending_balance =
                 GREATEST(0, pending_balance - $1),
               total_withdrawn = total_withdrawn + $1,
               updated_at      = NOW()
           WHERE vendor_id = $2`,
          [wd.amount, wd.vendor_id]
        );

        await client.query(
          `UPDATE market.vendor_transactions
           SET status    = 'success',
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
          txRef,
          transferId,
        });
      }

    } else if (["FAILED", "CANCELLED"].includes(status)) {
      const { rows: [wd] } = await client.query(
        `UPDATE market.vendor_withdrawal_requests
         SET status         = 'failed',
             failure_reason = $1,
             processed_at   = NOW(),
             updated_at     = NOW()
         WHERE (tx_ref = $2
             OR flw_transfer_id::text = $3)
           AND status = 'processing'
         RETURNING id, vendor_id, amount`,
        [
          data?.complete_message ?? `Transfer ${status}`,
          txRef ?? "",
          String(transferId ?? ""),
        ]
      );

      if (wd) {
        await client.query(
          `UPDATE market.vendor_wallets
           SET available_balance =
                 available_balance + $1,
               pending_balance   =
                 GREATEST(0, pending_balance - $1),
               updated_at        = NOW()
           WHERE vendor_id = $2`,
          [wd.amount, wd.vendor_id]
        );

        await client.query(
          `UPDATE market.vendor_transactions
           SET status    = 'failed',
               narration = $1
           WHERE tx_ref = $2`,
          [
            `Withdrawal failed: ${
              data?.complete_message ?? status
            }`,
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
      log("info", "TRANSFER_STATUS_UNHANDLED", {
        status,
        txRef,
      });
    }

    await client.query("COMMIT");

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log("error", "TRANSFER_HANDLER_FAILED", {
      error:      err.message,
      txRef,
      transferId,
    });
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════
// GET /api/webhooks/flutterwave
// Health check — confirms route is reachable
// ══════════════════════════════════════════════════════════════
router.get("/", (_req, res) => {
  res.json({
    success:   true,
    endpoint:  "Flutterwave Webhook",
    method:    "POST only",
    hash_set:  !!process.env.FLW_SECRET_HASH,
    key_set:   !!process.env.FLW_SECRET_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ══════════════════════════════════════════════════════════════
// POST /api/webhooks/flutterwave
// ══════════════════════════════════════════════════════════════
router.post("/", async (req, res) => {

  // Check signature
  const sigOk = checkSignature(req);

  if (!sigOk) {
    log("warn", "REJECTED_INVALID_SIGNATURE", {
      received: req.headers["verif-hash"]?.slice(0, 8) + "…",
    });

    // Skip check if debug env is set
    if (process.env.FLW_SKIP_SIG_CHECK !== "true") {
      return res.status(200).json({
        received: false,
        reason:   "invalid_signature",
      });
    }

    log("warn", "SIGNATURE_CHECK_SKIPPED_FOR_DEBUG");
  }

  const { event, data } = req.body ?? {};

  log("info", "WEBHOOK_RECEIVED", {
    event,
    txId:   data?.id,
    txRef:  data?.tx_ref,
    status: data?.status,
    amount: data?.amount,
    type:   data?.payment_type,
  });

  // Respond 200 immediately
  // FLW marks webhook failed if no response within 30s
  res.status(200).json({ received: true, event });

  // Process async after response sent
  setImmediate(async () => {
    try {
      if (event === "charge.completed") {
        await handleChargeCompleted(data);
      } else if (event === "transfer.completed") {
        await handleTransferCompleted(data);
      } else {
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