// utils/flutterwave.js

import axios  from "axios";
import crypto from "crypto";

// ═════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════
const FLW_BASE    = "https://api.flutterwave.com/v3";
const FLW_TIMEOUT = 30_000; // 30 seconds

// How many times to retry a failed FLW call
const MAX_RETRIES    = 2;
const RETRY_DELAY_MS = 1_500;

// ═════════════════════════════════════════════════════════════
// SINGLETON AXIOS INSTANCE
// Created once — reused across all calls
// ═════════════════════════════════════════════════════════════
let _flwInstance = null;

const getFlwClient = () => {
  // Return cached instance if already built
  if (_flwInstance) return _flwInstance;

  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "FLW_SECRET_KEY is not set in environment variables"
    );
  }

  _flwInstance = axios.create({
    baseURL: FLW_BASE,
    timeout: FLW_TIMEOUT,
    headers: {
      Authorization:  `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });

  // ── Response interceptor ─────────────────────────────────
  _flwInstance.interceptors.response.use(
    (res) => res,
    (err) => {
      const status  = err.response?.status;
      const body    = err.response?.data;
      const message =
        body?.message ??
        body?.error   ??
        err.message   ??
        "Flutterwave request failed";

      // Log every FLW error with full context
      console.error("[FLW] API error:", {
        status,
        message,
        url:    err.config?.url,
        method: err.config?.method?.toUpperCase(),
        body,
      });

      // Attach status to error so callers can inspect it
      const enriched     = new Error(message);
      enriched.flwStatus = status;
      enriched.flwBody   = body;
      return Promise.reject(enriched);
    }
  );

  return _flwInstance;
};

// ═════════════════════════════════════════════════════════════
// RETRY WRAPPER
// Retries on network errors and 429 (rate limit) only
// Does NOT retry on 4xx (bad request) errors
// ═════════════════════════════════════════════════════════════

/**
 * @param {Function} fn      - async function that returns a promise
 * @param {number}   retries - max retry attempts
 * @returns {Promise<any>}
 */
const withRetry = async (fn, retries = MAX_RETRIES) => {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      const isRateLimit  = err.flwStatus === 429;
      const isNetworkErr = !err.flwStatus; // no HTTP status = network fail
      const isServerErr  = err.flwStatus >= 500;

      const shouldRetry =
        attempt < retries &&
        (isRateLimit || isNetworkErr || isServerErr);

      if (!shouldRetry) break;

      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      console.warn(
        `[FLW] Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
};

// ═════════════════════════════════════════════════════════════
// WEBHOOK SIGNATURE VERIFICATION
// ═════════════════════════════════════════════════════════════

/**
 * Verify incoming Flutterwave webhook signature
 * Call this in your webhook route BEFORE processing anything
 *
 * @param {string} signatureHeader - value of "verif-hash" header
 * @returns {boolean}
 *
 * @example
 * const valid = verifyWebhookSignature(req.headers["verif-hash"]);
 * if (!valid) return res.status(401).json({ message: "Unauthorised" });
 */
export const verifyWebhookSignature = (signatureHeader) => {
  const secret = process.env.FLW_WEBHOOK_HASH;

  if (!secret) {
    console.error(
      "[FLW] FLW_WEBHOOK_HASH not set — all webhooks will be rejected"
    );
    return false;
  }

  if (!signatureHeader) return false;

  // Constant-time comparison prevents timing attacks
  const expected = Buffer.from(secret);
  const received = Buffer.from(signatureHeader);

  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(expected, received);
};

// ═════════════════════════════════════════════════════════════
// STATUS NORMALISATION
// Maps all FLW status strings → our internal status
// ═════════════════════════════════════════════════════════════

/**
 * @param {string} flwStatus - raw status from Flutterwave
 * @returns {"success" | "failed" | "processing" | "pending"}
 */
export const normaliseTransferStatus = (flwStatus = "") => {
  const s = flwStatus.toUpperCase().trim();

  if (["SUCCESSFUL", "SUCCESS", "COMPLETED"].includes(s)) {
    return "success";
  }
  if (["FAILED", "FAILURE", "CANCELLED", "CANCELED"].includes(s)) {
    return "failed";
  }
  if (["NEW", "PENDING"].includes(s)) {
    return "pending";
  }

  return "processing";
};

// ═════════════════════════════════════════════════════════════
// SUPPORTED BANKS
// Commercial + Microfinance + Digital banks
// ═════════════════════════════════════════════════════════════
const BANKS = {
  // ── Commercial banks ──────────────────────────────────────
  "access bank":              { code: "044",   name: "Access Bank"                  },
  "citibank":                 { code: "023",   name: "Citibank Nigeria"              },
  "citibank nigeria":         { code: "023",   name: "Citibank Nigeria"              },
  "ecobank":                  { code: "050",   name: "Ecobank Nigeria"               },
  "ecobank nigeria":          { code: "050",   name: "Ecobank Nigeria"               },
  "fidelity bank":            { code: "070",   name: "Fidelity Bank"                 },
  "first bank":               { code: "011",   name: "First Bank of Nigeria"         },
  "first bank of nigeria":    { code: "011",   name: "First Bank of Nigeria"         },
  "fcmb":                     { code: "214",   name: "First City Monument Bank"      },
  "first city monument bank": { code: "214",   name: "First City Monument Bank"      },
  "globus bank":              { code: "00103", name: "Globus Bank"                   },
  "gtbank":                   { code: "058",   name: "Guaranty Trust Bank"           },
  "gtb":                      { code: "058",   name: "Guaranty Trust Bank"           },
  "guaranty trust bank":      { code: "058",   name: "Guaranty Trust Bank"           },
  "guaranty trust":           { code: "058",   name: "Guaranty Trust Bank"           },
  "heritage bank":            { code: "030",   name: "Heritage Bank"                 },
  "keystone bank":            { code: "082",   name: "Keystone Bank"                 },
  "polaris bank":             { code: "076",   name: "Polaris Bank"                  },
  "premiumtrust bank":        { code: "105",   name: "PremiumTrust Bank"             },
  "providus bank":            { code: "101",   name: "Providus Bank"                 },
  "stanbic ibtc":             { code: "221",   name: "Stanbic IBTC Bank"             },
  "stanbic ibtc bank":        { code: "221",   name: "Stanbic IBTC Bank"             },
  "standard chartered":       { code: "068",   name: "Standard Chartered Bank"       },
  "standard chartered bank":  { code: "068",   name: "Standard Chartered Bank"       },
  "sterling bank":            { code: "232",   name: "Sterling Bank"                 },
  "suntrust bank":            { code: "100",   name: "SunTrust Bank"                 },
  "suntrust":                 { code: "100",   name: "SunTrust Bank"                 },
  "titan trust bank":         { code: "102",   name: "Titan Trust Bank"              },
  "titan trust":              { code: "102",   name: "Titan Trust Bank"              },
  "union bank":               { code: "032",   name: "Union Bank of Nigeria"         },
  "union bank of nigeria":    { code: "032",   name: "Union Bank of Nigeria"         },
  "uba":                      { code: "033",   name: "United Bank for Africa"        },
  "united bank for africa":   { code: "033",   name: "United Bank for Africa"        },
  "unity bank":               { code: "215",   name: "Unity Bank"                    },
  "wema bank":                { code: "035",   name: "Wema Bank"                     },
  "zenith bank":              { code: "057",   name: "Zenith Bank"                   },

  // ── Digital / Fintech banks ───────────────────────────────
  "opay":                     { code: "999992", name: "OPay"                         },
  "opay digital":             { code: "999992", name: "OPay"                         },
  "palmpay":                  { code: "999991", name: "PalmPay"                      },
  "kuda":                     { code: "50211",  name: "Kuda Bank"                    },
  "kuda bank":                { code: "50211",  name: "Kuda Bank"                    },
  "moniepoint":               { code: "50515",  name: "Moniepoint MFB"               },
  "moniepoint mfb":           { code: "50515",  name: "Moniepoint MFB"               },
  "moniepoint microfinance":  { code: "50515",  name: "Moniepoint MFB"               },
  "carbon":                   { code: "565",    name: "Carbon (OneFi)"               },
  "carbon onefi":             { code: "565",    name: "Carbon (OneFi)"               },
  "vfd microfinance":         { code: "566",    name: "VFD Microfinance Bank"        },
  "vfd mfb":                  { code: "566",    name: "VFD Microfinance Bank"        },
  "fairmoney":                { code: "51318",  name: "FairMoney Microfinance Bank"  },
  "fairmoney mfb":            { code: "51318",  name: "FairMoney Microfinance Bank"  },
  "rubies bank":              { code: "125",    name: "Rubies MFB"                   },
  "rubies":                   { code: "125",    name: "Rubies MFB"                   },
  "sparkle":                  { code: "51310",  name: "Sparkle Microfinance Bank"    },
  "sparkle mfb":              { code: "51310",  name: "Sparkle Microfinance Bank"    },
  "mint":                     { code: "50304",  name: "Mint MFB"                     },
  "mint mfb":                 { code: "50304",  name: "Mint MFB"                     },
  "eyowo":                    { code: "50126",  name: "Eyowo"                        },
  "gomoney":                  { code: "100022", name: "GoMoney"                      },

  // ── Microfinance banks ────────────────────────────────────
  "lapo mfb":                 { code: "90177",  name: "LAPO Microfinance Bank"       },
  "lapo microfinance":        { code: "90177",  name: "LAPO Microfinance Bank"       },
  "ab microfinance":          { code: "309",    name: "AB Microfinance Bank"         },
  "ab mfb":                   { code: "309",    name: "AB Microfinance Bank"         },
  "accion mfb":               { code: "602",    name: "Accion Microfinance Bank"     },
  "accion microfinance":      { code: "602",    name: "Accion Microfinance Bank"     },
  "mutual trust mfb":         { code: "090190", name: "Mutual Trust Microfinance Bank"},
};

// ═════════════════════════════════════════════════════════════
// BANK HELPERS
// ═════════════════════════════════════════════════════════════

/**
 * Look up bank by name (case-insensitive, trims whitespace)
 * @param {string} bankName
 * @returns {{ code: string, name: string } | null}
 */
export const getBankCode = (bankName) => {
  if (!bankName) return null;
  return BANKS[bankName.toLowerCase().trim()] ?? null;
};

/**
 * Get deduplicated list of supported banks sorted A→Z
 * @returns {Array<{ code: string, name: string }>}
 */
export const getSupportedBanks = () => {
  const seen = new Set();
  const list = [];

  for (const bank of Object.values(BANKS)) {
    if (!seen.has(bank.code)) {
      seen.add(bank.code);
      list.push(bank);
    }
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Validate Nigerian account number (exactly 10 digits)
 * @param {string} num
 * @returns {boolean}
 */
export const validateAccountNumber = (num) =>
  typeof num === "string" && /^\d{10}$/.test(num.trim());

// ═════════════════════════════════════════════════════════════
// ACCOUNT RESOLUTION
// ═════════════════════════════════════════════════════════════

/**
 * Resolve account name via Flutterwave
 * @param {string} accountNumber - 10-digit NUBAN
 * @param {string} bankCode      - FLW bank code
 * @returns {Promise<{ account_name: string, account_number: string } | null>}
 */
export const resolveAccount = async (accountNumber, bankCode) => {
  return withRetry(async () => {
    const { data } = await getFlwClient().post("/accounts/resolve", {
      account_number: accountNumber,
      account_bank:   bankCode,
    });
    return data?.data ?? null;
  });
};

/**
 * Full account verification — resolves name from number + bank name
 * @param {string} accountNumber
 * @param {string} bankName
 * @returns {Promise<{
 *   valid:           boolean,
 *   account_name?:   string,
 *   account_number?: string,
 *   bank_code?:      string,
 *   bank_name?:      string,
 *   message?:        string,
 * }>}
 */
export const verifyAccountName = async (accountNumber, bankName) => {
  const bank = getBankCode(bankName);
  if (!bank) {
    return {
      valid:   false,
      message: `"${bankName}" is not a supported bank.`,
    };
  }

  if (!validateAccountNumber(accountNumber)) {
    return {
      valid:   false,
      message: "Account number must be exactly 10 digits.",
    };
  }

  try {
    const resolved = await resolveAccount(
      accountNumber.trim(),
      bank.code
    );

    if (!resolved?.account_name) {
      return {
        valid:   false,
        message: "Could not verify account. Please check the details.",
      };
    }

    return {
      valid:          true,
      account_name:   resolved.account_name,
      account_number: resolved.account_number ?? accountNumber.trim(),
      bank_code:      bank.code,
      bank_name:      bank.name,
    };

  } catch (err) {
    return {
      valid:   false,
      message: err.message ?? "Account verification failed",
    };
  }
};

// ═════════════════════════════════════════════════════════════
// NIGERIA DATE
// WAT = UTC+1 — used for daily withdrawal counting
// ═════════════════════════════════════════════════════════════

/**
 * Get today's date in Nigeria timezone (YYYY-MM-DD)
 * @returns {string}
 */
export const getNigeriaDate = () =>
  new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  });

// ═════════════════════════════════════════════════════════════
// FEE TIERS
// First 3 withdrawals per calendar day → FREE (WAT)
// 4th+ withdrawal uses amount-based tiers below
// null replaces Infinity so tiers are JSON-serialisable
// ═════════════════════════════════════════════════════════════
export const FEE_TIERS = [
  { label: "₦0 – ₦9,999",         max_amount: 9_999,   fee_amount: 50  },
  { label: "₦10,000 – ₦99,999",   max_amount: 99_999,  fee_amount: 100 },
  { label: "₦100,000 – ₦500,000", max_amount: 500_000, fee_amount: 150 },
  { label: "Above ₦500,000",       max_amount: null,    fee_amount: 200 },
];

// Number of free withdrawals per day before fees kick in
const FREE_PER_DAY = 3;

/**
 * Calculate fee for a single withdrawal
 * @param {number} amount           - gross withdrawal amount
 * @param {number} withdrawalsToday - completed withdrawals so far today
 * @returns {number} fee in NGN
 */
export const calculateWithdrawalFee = (amount, withdrawalsToday) => {
  if (withdrawalsToday < FREE_PER_DAY) return 0;

  for (const tier of FEE_TIERS) {
    // null max_amount means "no upper limit" (last tier)
    if (tier.max_amount === null || amount <= tier.max_amount) {
      return tier.fee_amount;
    }
  }

  // Fallback — should never reach here
  return 200;
};

/**
 * Human-readable fee schedule label
 * @param {number} withdrawalsToday
 * @returns {string}
 */
export const feeScheduleLabel = (withdrawalsToday) => {
  const freeLeft = Math.max(0, FREE_PER_DAY - withdrawalsToday);

  return freeLeft > 0
    ? `${freeLeft} free withdrawal${freeLeft > 1 ? "s" : ""} remaining today`
    : "Fees apply — ₦50 / ₦100 / ₦150 / ₦200 (by amount)";
};

// ═════════════════════════════════════════════════════════════
// DB-AWARE FEE CALCULATOR
// Works with both pool (for standalone queries) and a
// connected pg client (inside a transaction)
// ═════════════════════════════════════════════════════════════

/**
 * @param {import("pg").Pool | import("pg").PoolClient} dbClient
 * @param {string} vendorId
 * @param {number} amount - 0 to get stats without fee calculation
 * @returns {Promise<{
 *   fee:              number,
 *   netAmount:        number,
 *   withdrawalsToday: number,
 *   dailyUsed:        number,
 *   freeRemaining:    number,
 * }>}
 */
export const calculateWithdrawalFees = async (
  dbClient,
  vendorId,
  amount
) => {
  const today = getNigeriaDate();

  const { rows: [row] } = await dbClient.query(
    `SELECT
       COUNT(*)                 AS withdrawals_today,
       COALESCE(SUM(amount), 0) AS daily_used
     FROM market.vendor_withdrawal_requests
     WHERE vendor_id = $1
       AND status    IN ('pending', 'processing', 'success', 'paid')
       AND DATE(created_at AT TIME ZONE 'Africa/Lagos') = $2`,
    [vendorId, today]
  );

  const withdrawalsToday = Number(row.withdrawals_today);
  const dailyUsed        = parseFloat(row.daily_used);
  const fee              = calculateWithdrawalFee(amount, withdrawalsToday);
  const netAmount        = parseFloat((amount - fee).toFixed(2));
  const freeRemaining    = Math.max(0, FREE_PER_DAY - withdrawalsToday);

  return {
    fee,
    netAmount,
    withdrawalsToday,
    dailyUsed,
    freeRemaining,
  };
};

// ═════════════════════════════════════════════════════════════
// GENERATE TRANSACTION REFERENCE
// ═════════════════════════════════════════════════════════════

/**
 * Generate a unique, collision-resistant transaction reference
 * Format: WD-{uuid}
 * @returns {string}
 */
export const generateTxRef = () =>
  `WD-${crypto.randomUUID()}`;

// ═════════════════════════════════════════════════════════════
// INITIATE TRANSFER
// Sends money to vendor bank account via Flutterwave
// ═════════════════════════════════════════════════════════════

/**
 * @param {{
 *   vendorId:      string,
 *   amount:        number,  gross amount debited from wallet
 *   fee:           number,
 *   netAmount:     number,  amount actually sent to bank
 *   bankName:      string,
 *   bankCode?:     string,  optional — resolved from bankName if absent
 *   accountNumber: string,
 *   accountName:   string,
 *   txRef:         string,
 * }} params
 *
 * @returns {Promise<{
 *   flw_transfer_id:  string,
 *   status:           string,
 *   reference:        string,
 *   complete_message: string,
 * }>}
 */
export const initiateTransfer = async ({
  vendorId,
  amount,
  fee,
  netAmount,
  bankName,
  bankCode,
  accountNumber,
  accountName,
  txRef,
}) => {
  // ── Resolve bank code ──────────────────────────────────
  let resolvedCode = bankCode ?? null;
  if (!resolvedCode) {
    const bank = getBankCode(bankName);
    if (!bank) {
      throw new Error(
        `Unsupported bank: "${bankName}". Update bank details in Settings.`
      );
    }
    resolvedCode = bank.code;
  }

  // ── Validate inputs ────────────────────────────────────
  if (!validateAccountNumber(accountNumber)) {
    throw new Error(
      "Invalid account number — must be exactly 10 digits"
    );
  }

  if (!netAmount || netAmount <= 0) {
    throw new Error("Net amount must be greater than zero");
  }

  if (!txRef) {
    throw new Error("Transaction reference is required");
  }

  // ── Build payload ──────────────────────────────────────
  const payload = {
    account_bank:   resolvedCode,
    account_number: accountNumber,
    amount:         netAmount,        // we send net amount to bank
    narration:      `Minimart withdrawal — ${txRef}`,
    currency:       "NGN",
    reference:      txRef,            // our unique reference (idempotency)
    debit_currency: "NGN",
    beneficiary_name: accountName,
    meta: {
      vendor_id:    String(vendorId),
      tx_ref:       txRef,
      gross_amount: amount,           // original amount debited from wallet
      fee,
    },
  };

  // Optional transfer webhook for real-time status updates
  if (process.env.FLW_TRANSFER_WEBHOOK_URL) {
    payload.callback_url = process.env.FLW_TRANSFER_WEBHOOK_URL;
  }

  // ── Call FLW with retry ────────────────────────────────
  return withRetry(async () => {
    const { data } = await getFlwClient().post("/transfers", payload);

    if (data.status !== "success") {
      const err     = new Error(data.message ?? "Transfer initiation failed");
      err.flwStatus = 400;
      throw err;
    }

    const transfer = data.data;

    if (process.env.NODE_ENV !== "test") {
      console.log("[FLW] Transfer initiated:", {
        flw_id:       transfer.id,
        reference:    transfer.reference,
        amount:       transfer.amount,
        bank_code:    resolvedCode,
        account:      accountNumber,
        account_name: accountName,
        status:       transfer.status,
      });
    }

    return {
      flw_transfer_id:  String(transfer.id),
      status:           normaliseTransferStatus(transfer.status),
      reference:        transfer.reference,
      complete_message: transfer.complete_message ?? "",
    };
  });
};

// ═════════════════════════════════════════════════════════════
// CHECK TRANSFER STATUS
// ═════════════════════════════════════════════════════════════

/**
 * Fetch current transfer status from Flutterwave
 * @param {string | number} flwTransferId - FLW internal transfer ID
 * @returns {Promise<{
 *   status:    "success" | "failed" | "processing" | "pending",
 *   message:   string,
 *   reference: string,
 *   raw:       object,
 * }>}
 */
export const checkTransferStatus = async (flwTransferId) => {
  return withRetry(async () => {
    const { data } = await getFlwClient().get(
      `/transfers/${flwTransferId}`
    );

    if (!data?.data) {
      throw new Error(
        "Invalid response from Flutterwave status check"
      );
    }

    const transfer = data.data;

    return {
      status:    normaliseTransferStatus(transfer.status),
      message:   transfer.complete_message ?? "",
      reference: transfer.reference,
      raw:       transfer,
    };
  });
};

// ═════════════════════════════════════════════════════════════
// VERIFY PAYMENT (used by payment webhook + redirect verify)
// ═════════════════════════════════════════════════════════════

/**
 * Verify a completed customer payment by transaction ID
 * @param {string | number} transactionId - FLW transaction ID
 * @returns {Promise<object>} FLW transaction data
 */
export const verifyPayment = async (transactionId) => {
  return withRetry(async () => {
    const { data } = await getFlwClient().get(
      `/transactions/${transactionId}/verify`
    );

    if (!data?.data) {
      throw new Error(
        "Invalid response from Flutterwave payment verify"
      );
    }

    return data.data;
  });
};

// ═════════════════════════════════════════════════════════════
// CREATE PAYMENT LINK (for checkout)
// ═════════════════════════════════════════════════════════════

/**
 * Generate a Flutterwave hosted payment link
 * @param {{
 *   amount:        number,
 *   currency:      string,
 *   reference:     string,
 *   orderId:       string,
 *   customerEmail: string,
 *   customerName:  string,
 *   customerPhone: string,
 *   redirectUrl:   string,
 * }} params
 * @returns {Promise<string>} Hosted payment URL
 */
export const createPaymentLink = async ({
  amount,
  currency = "NGN",
  reference,
  orderId,
  customerEmail,
  customerName,
  customerPhone,
  redirectUrl,
}) => {
  return withRetry(async () => {
    const { data } = await getFlwClient().post("/payments", {
      tx_ref:       reference,
      amount,
      currency,
      redirect_url: redirectUrl,
      customer: {
        email:       customerEmail,
        name:        customerName,
        phonenumber: customerPhone,
      },
      customizations: {
        title:       "MiniMart Payment",
        description: `Payment for Order ${orderId}`,
        logo:        process.env.LOGO_URL ?? "",
      },
      meta: {
        order_id: orderId,
      },
    });

    if (data?.status !== "success") {
      throw new Error(
        data?.message ?? "Failed to create payment link"
      );
    }

    const link = data?.data?.link;
    if (!link) {
      throw new Error(
        "Flutterwave did not return a payment link"
      );
    }

    return link;
  });
};