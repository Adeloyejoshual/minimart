// routes/webhooks/flutterwave.js
import express  from "express";
import axios    from "axios";
import { pool } from "../../server.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────
const SECRET_HASH = () => process.env.FLW_SECRET_HASH ?? "";
const SECRET_KEY  = () => process.env.FLW_SECRET_KEY  ?? "";

// ─────────────────────────────────────────────────────────────
// STRUCTURED LOGGER
// ─────────────────────────────────────────────────────────────
const log = (level, tag, data = {}) => {
  const line = JSON.stringify({
    ts:  new Date().toISOString(),
    src: "FLW-WEBHOOK",
    tag,
    ...data,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

// ─────────────────────────────────────────────────────────────
// VERIFY SIGNATURE
// Header: verif-hash  (Flutterwave sends your secret hash)
// ─────────────────────────────────────────────────────────────
const checkSignature = (req) => {
  const hash = SECRET_HASH();

  // If no hash configured — warn but allow in dev
  if (!hash) {
    log("warn", "NO_SECRET_HASH_CONFIGURED");
    return process.env.NODE_ENV !== "production";
  }

  const sent = req.headers["verif-hash"] ?? "";
  const ok   = sent === hash;

  if (!ok) {
    log("warn", "BAD_SIGNATURE", {
      sent:     sent.slice(0, 10) + "…",
      expected: hash.slice(0, 10) + "…",
    });
  }

  return ok;
};

// ─────────────────────────────────────────────────────────────
// VERIFY TRANSACTION VIA FLW API
// Never trust the webhook payload alone
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
        timeout: 12_000,
      }
    );
    return data; // { status, message, data: {...} }
  } catch (err) {
    log("error", "FLW_VERIFY_FAILED", {
      txId,
      httpStatus: err.response?.status,
      msg:        err.response?.data?.message ?? err.message,
    });
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// EXTRACT VIRTUAL ACCOUNT NUMBER
// FLW puts it in different places depending on version
// ─────────────────────────────────────────────────────────────
const extractVirtualAccount = (data) => {
  // Try every known location
  const candidates = [
    data?.virtual_account_number,
    data?.payment_type_meta?.account_number,
    data?.payment_type_meta?.flw_ref,
    data?.meta?.virtual_account_number,
    data?.meta?.originatoraccountnumber,
    data?.meta?.AccountNumber,
    data?.account_number,
  ];

  for (const c of candidates) {
    if (c && String(c).replace(/\D/g, "").length >= 10) {
      return String(c).trim();
    }
  }

  return null;
};

// ─────────────────────────────────────────────────────────────
// FIND VENDOR BY VIRTUAL ACCOUNT NUMBER
// ─────────────────────────────────────────────────────────────
const findVendor = async (client, accountNumber) => {
  // Try exact match first
  let { rows } = await client.query(
    `SELECT va.vendor_id,
            va.account_number,
            va.bank_name,
            v.store_name,
            v.status   AS vendor_status,
            v.user_id
     FROM market.vendor_virtual_accounts va
     JOIN market.vendors v ON v.id = va.vendor_id
     WHERE va.account_number = $1
     LIMIT 1`,
    [accountNumber]
  );

  if (rows.length) return rows[0];

  // Try stripping leading zeros / whitespace
  const stripped = accountNumber.replace(/\s/g, "");
  if (stripped !== accountNumber) {
    ({ rows } = await client.query(
      `SELECT va.vendor_id, va.account_number, va.bank_name,
              v.store_name, v.status AS vendor_status, v.user_id
       FROM market.vendor_virtual_accounts va
       JOIN market.vendors v ON v.id = va.vendor_id
       WHERE va.account_number = $1 LIMIT 1`,
      [stripped]
    ));
    if (rows.length) return rows[0];
  }

  return null;
};

// ─────────────────────────────────────────────────────────────
// IDEMPOTENCY CHECK
// ─────────────────────────────────────────────────────────────
const alreadyProcessed = async (client, flwRef, txRef, txId) => {
  const { rows } = await client.query(
    `SELECT id FROM market.vendor_transactions
     WHERE flw_ref = $1
        OR tx_ref  = $2
        OR (meta->>'flw_transaction_id')::text = $3
     LIMIT 1`,
    [flwRef ?? "", txRef ?? "", String(txId ?? "")]
  );
  return rows.length > 0;
};

// ─────────────────────────────────────────────────────────────
// CREDIT WALLET (atomic)
// ─────────────────────────────────────────────────────────────
const creditWallet = async (client, {
  vendorId, amount, currency,
  flwRef, txRef, narration, meta,
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

  // Credit
  const { rows: [wallet] } = await client.query(
    `UPDATE market.vendor_wallets
     SET available_balance = available_balance + $1,
         total_received    = total_received    + $1,
         updated_at        = NOW()
     WHERE vendor_id = $2
     RETURNING available_balance, total_received`,
    [amount, vendorId]
  );

  // Transaction record
  await client.query(
    `INSERT INTO market.vendor_transactions
       (vendor_id, type, amount, fee, currency,
        status, narration, flw_ref, tx_ref, meta, created_at)
     VALUES ($1,'credit',$2,0,$3,'success',$4,$5,$6,$7,NOW())`,
    [
      vendorId,
      amount,
      currency ?? "NGN",
      narration ?? "Virtual account credit",
      flwRef  ?? null,
      txRef   ?? null,
      JSON.stringify(meta ?? {}),
    ]
  );

  return wallet;
};

// ─────────────────────────────────────────────────────────────
// NOTIFY VENDOR (non-critical)
// ─────────────────────────────────────────────────────────────
const notifyVendor = async (userId, amount, currency) => {
  try {
    const fmt = `${currency ?? "NGN"} ${
      Number(amount).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
      })
    }`;
    await pool.query(
      `INSERT INTO market.notifications
         (user_id, type, message, read, created_at)
       VALUES ($1,'wallet_credit',$2,FALSE,NOW())`,
      [userId, `💰 ${fmt} credited to your seller wallet`]
    );
  } catch { /* non-critical */ }
};

// ─────────────────────────────────────────────────────────────
// HANDLE charge.completed
// ─────────────────────────────────────────────────────────────
async function handleChargeCompleted(rawData) {
  const txId  = rawData?.id;
  const txRef = rawData?.tx_ref;

  log("info", "CHARGE_RECEIVED", {
    txId,
    txRef,
    status:       rawData?.status,
    payment_type: rawData?.payment_type,
    amount:       rawData?.amount,
    currency:     rawData?.currency,
    // Log full meta so we can see where account number is
    meta:         rawData?.meta,
    payment_type_meta: rawData?.payment_type_meta,
  });

  // ── Only successful payments ──────────────────────────
  if (rawData?.status?.toLowerCase() !== "successful") {
    log("info", "SKIPPED_NOT_SUCCESSFUL", {
      status: rawData?.status, txRef,
    });
    return;
  }

  // ── Verify with FLW API ───────────────────────────────
  log("info", "VERIFYING_WITH_FLW", { txId });
  const verification = await verifyWithFLW(txId);

  if (!verification || verification.status !== "success") {
    log("error", "VERIFICATION_FAILED", {
      txId, response: verification,
    });
    return;
  }

  const verified = verification.data;

  log("info", "VERIFICATION_OK", {
    txId,
    verified_status:  verified.status,
    verified_amount:  verified.amount,
    verified_currency:verified.currency,
    // Log entire verified object to find account number location
    verified_meta:    verified.meta,
    verified_payment_type_meta: verified.payment_type_meta,
    verified_keys:    Object.keys(verified),
  });

  if (verified.status?.toLowerCase() !== "successful") {
    log("error", "VERIFIED_NOT_SUCCESSFUL", {
      status: verified.status, txId,
    });
    return;
  }

  // ── Amount sanity check ───────────────────────────────
  if (Math.abs(Number(verified.amount) - Number(rawData.amount)) > 0.01) {
    log("error", "AMOUNT_MISMATCH", {
      webhook:  rawData.amount,
      verified: verified.amount,
    });
    return;
  }

  // ── Find virtual account number ───────────────────────
  // Try webhook data first, then verified data
  const accountNumber =
    extractVirtualAccount(rawData)
    ?? extractVirtualAccount(verified);

  log("info", "ACCOUNT_NUMBER_EXTRACTION", {
    found:          accountNumber,
    rawData_keys:   Object.keys(rawData),
    verified_keys:  Object.keys(verified),
    raw_meta:       rawData?.meta,
    raw_ptype_meta: rawData?.payment_type_meta,
    ver_meta:       verified?.meta,
    ver_ptype_meta: verified?.payment_type_meta,
  });

  if (!accountNumber) {
    log("error", "NO_VIRTUAL_ACCOUNT_NUMBER", {
      txId, txRef,
      // Log everything to diagnose
      rawData,
      verified,
    });
    return;
  }

  // ── DB operations ─────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Idempotency
    const done = await alreadyProcessed(
      client,
      verified.flw_ref ?? rawData.flw_ref,
      verified.tx_ref  ?? txRef,
      txId
    );

    if (done) {
      log("info", "ALREADY_PROCESSED", { txId, txRef });
      await client.query("ROLLBACK");
      return;
    }

    // Find vendor
    const vendor = await findVendor(client, accountNumber);

    log("info", "FIND_VENDOR_RESULT", {
      accountNumber,
      found: !!vendor,
      vendorId:    vendor?.vendor_id,
      storeName:   vendor?.store_name,
      vendorStatus:vendor?.vendor_status,
    });

    if (!vendor) {
      log("error", "VENDOR_NOT_FOUND", {
        accountNumber,
        txId, txRef,
      });
      await client.query("ROLLBACK");
      return;
    }

    // Credit wallet
    const wallet = await creditWallet(client, {
      vendorId:  vendor.vendor_id,
      amount:    Number(verified.amount),
      currency:  verified.currency ?? "NGN",
      flwRef:    verified.flw_ref ?? rawData.flw_ref,
      txRef:     verified.tx_ref  ?? txRef,
      narration: `Payment via virtual account from ${
        verified.customer?.name
        ?? verified.customer?.email
        ?? "customer"
      }`,
      meta: {
        flw_transaction_id: txId,
        customer_name:      verified.customer?.name,
        customer_email:     verified.customer?.email,
        customer_phone:     verified.customer?.phone_number,
        virtual_account:    accountNumber,
        payment_type:       verified.payment_type,
        raw_payment_type_meta: verified.payment_type_meta,
      },
    });

    await client.query("COMMIT");

    log("info", "PAYMENT_PROCESSED", {
      vendorId:     vendor.vendor_id,
      storeName:    vendor.store_name,
      amount:       verified.amount,
      newBalance:   wallet?.available_balance,
      totalReceived:wallet?.total_received,
      txId, txRef,
    });

    // Notify vendor after commit
    await notifyVendor(
      vendor.user_id,
      Number(verified.amount),
      verified.currency
    );

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log("error", "CREDIT_FAILED", {
      error:  err.message,
      stack:  err.stack,
      txId, txRef, accountNumber,
    });
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// HANDLE transfer.completed
// ─────────────────────────────────────────────────────────────
async function handleTransferCompleted(data) {
  const txRef     = data?.reference ?? data?.tx_ref;
  const transferId= data?.id;
  const status    = data?.status?.toUpperCase();

  log("info", "TRANSFER_STATUS", { transferId, txRef, status });

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
           AND status = 'processing'
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
           SET status = 'success', narration = 'Withdrawal completed'
           WHERE tx_ref = $1`,
          [txRef]
        );
        log("info", "WITHDRAWAL_SUCCESS", {
          vendorId: wd.vendor_id, amount: wd.amount, txRef,
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
           SET available_balance = available_balance + $1,
               pending_balance   = GREATEST(0, pending_balance - $1),
               updated_at        = NOW()
           WHERE vendor_id = $2`,
          [wd.amount, wd.vendor_id]
        );
        await client.query(
          `UPDATE market.vendor_transactions
           SET status = 'failed', narration = $1 WHERE tx_ref = $2`,
          [`Withdrawal failed: ${data?.complete_message ?? status}`, txRef]
        );
        log("warn", "WITHDRAWAL_REVERSED", {
          vendorId: wd.vendor_id, amount: wd.amount, txRef,
        });
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log("error", "TRANSFER_HANDLER_FAILED", {
      error: err.message, txRef,
    });
  } finally {
    client.release();
  }
}

// ═════════════════════════════════════════════════════════════
// POST /api/webhooks/flutterwave
// ═════════════════════════════════════════════════════════════
router.post("/", async (req, res) => {
  // ── Always respond 200 first ──────────────────────────
  // Flutterwave retries if it doesn't get 200 within 30s
  if (!checkSignature(req)) {
    log("warn", "REJECTED_BAD_SIGNATURE");
    // Still return 200 to stop retries — just don't process
    return res.status(200).json({ received: false, reason: "bad_sig" });
  }

  const { event, data } = req.body ?? {};

  log("info", "RECEIVED", {
    event,
    txRef:  data?.tx_ref,
    flwRef: data?.flw_ref,
    id:     data?.id,
    status: data?.status,
    amount: data?.amount,
    type:   data?.payment_type,
  });

  // Respond immediately
  res.status(200).json({ received: true, event });

  // Process asynchronously (after 200 is sent)
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
      log("error", "TOP_LEVEL_ERROR", {
        event, error: err.message, stack: err.stack,
      });
    }
  });
});

export default router;