// utils/flutterwaveTransfer.js
import axios  from "axios";
import crypto from "crypto";
import { pool } from "../server.js";

const FLW_BASE = "https://api.flutterwave.com/v3";

// ── Create FLW instance lazily (reads env at call time) ───────
// ✅ Fixes: FLW_SECRET being undefined at module load
const flw = () => {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) {
    throw new Error("FLW_SECRET_KEY is not set in environment variables");
  }

  const instance = axios.create({
    baseURL: FLW_BASE,
    headers: {
      Authorization:  `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });

  // ── Intercept & normalize errors ──────────────────────
  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const msg =
        err.response?.data?.message ??
        err.response?.data?.error   ??
        err.message                 ??
        "Flutterwave request failed";

      console.error("[FLW error]", {
        status:  err.response?.status,
        message: msg,
        data:    err.response?.data ?? null,
      });

      return Promise.reject(new Error(msg));
    }
  );

  return instance;
};

// ══════════════════════════════════════════════════════════════
// COMMERCIAL BANKS ONLY — no microfinance / fintech
// ══════════════════════════════════════════════════════════════
const COMMERCIAL_BANKS = {
  "access bank":              { code: "044",   name: "Access Bank" },
  "citibank":                 { code: "023",   name: "Citibank Nigeria" },
  "citibank nigeria":         { code: "023",   name: "Citibank Nigeria" },
  "ecobank":                  { code: "050",   name: "Ecobank Nigeria" },
  "ecobank nigeria":          { code: "050",   name: "Ecobank Nigeria" },
  "fidelity bank":            { code: "070",   name: "Fidelity Bank" },
  "first bank":               { code: "011",   name: "First Bank of Nigeria" },
  "first bank of nigeria":    { code: "011",   name: "First Bank of Nigeria" },
  "fcmb":                     { code: "214",   name: "First City Monument Bank" },
  "first city monument bank": { code: "214",   name: "First City Monument Bank" },
  "globus bank":              { code: "00103", name: "Globus Bank" },
  "gtbank":                   { code: "058",   name: "Guaranty Trust Bank" },
  "gtb":                      { code: "058",   name: "Guaranty Trust Bank" },
  "guaranty trust bank":      { code: "058",   name: "Guaranty Trust Bank" },
  "guaranty trust":           { code: "058",   name: "Guaranty Trust Bank" },
  "heritage bank":            { code: "030",   name: "Heritage Bank" },
  "keystone bank":            { code: "082",   name: "Keystone Bank" },
  "polaris bank":             { code: "076",   name: "Polaris Bank" },
  "premiumtrust bank":        { code: "105",   name: "PremiumTrust Bank" },
  "providus bank":            { code: "101",   name: "Providus Bank" },
  "stanbic ibtc":             { code: "221",   name: "Stanbic IBTC Bank" },
  "stanbic ibtc bank":        { code: "221",   name: "Stanbic IBTC Bank" },
  "standard chartered":       { code: "068",   name: "Standard Chartered Bank" },
  "standard chartered bank":  { code: "068",   name: "Standard Chartered Bank" },
  "sterling bank":            { code: "232",   name: "Sterling Bank" },
  "suntrust bank":            { code: "100",   name: "SunTrust Bank" },
  "suntrust":                 { code: "100",   name: "SunTrust Bank" },
  "titan trust bank":         { code: "102",   name: "Titan Trust Bank" },
  "titan trust":              { code: "102",   name: "Titan Trust Bank" },
  "union bank":               { code: "032",   name: "Union Bank of Nigeria" },
  "union bank of nigeria":    { code: "032",   name: "Union Bank of Nigeria" },
  "uba":                      { code: "033",   name: "United Bank for Africa" },
  "united bank for africa":   { code: "033",   name: "United Bank for Africa" },
  "unity bank":               { code: "215",   name: "Unity Bank" },
  "wema bank":                { code: "035",   name: "Wema Bank" },
  "zenith bank":              { code: "057",   name: "Zenith Bank" },
};

// ── Get bank by name ──────────────────────────────────────────
export const getBankCode = (bankName) => {
  if (!bankName) return null;
  return COMMERCIAL_BANKS[bankName.toLowerCase().trim()] ?? null;
};

// ── Get all supported banks (unique, sorted) ──────────────────
export const getSupportedBanks = () => {
  const seen = new Set();
  const list = [];
  Object.values(COMMERCIAL_BANKS).forEach((b) => {
    if (!seen.has(b.code)) {
      seen.add(b.code);
      list.push(b);
    }
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
};

// ── Validate Nigerian account number (10 digits) ──────────────
export const validateAccountNumber = (num) => {
  if (!num || typeof num !== "string") return false;
  return /^\d{10}$/.test(num.trim());
};

// ── Resolve account name via FLW ──────────────────────────────
export const resolveAccount = async (accountNumber, bankCode) => {
  const { data } = await flw().post("/accounts/resolve", {
    account_number: accountNumber,
    account_bank:   bankCode,
  });
  return data?.data ?? null;
};

// ── Full account verification ─────────────────────────────────
// Used when seller saves bank details — FLW verifies the name
export const verifyAccountName = async (accountNumber, bankName) => {
  const bank = getBankCode(bankName);
  if (!bank) {
    return {
      valid:   false,
      message: `"${bankName}" is not a supported commercial bank.`,
    };
  }

  if (!validateAccountNumber(accountNumber)) {
    return {
      valid:   false,
      message: "Invalid account number. Must be exactly 10 digits.",
    };
  }

  try {
    const resolved = await resolveAccount(accountNumber, bank.code);
    if (!resolved) {
      return {
        valid:   false,
        message: "Could not verify account. Check details and try again.",
      };
    }

    return {
      valid:          true,
      account_name:   resolved.account_name,   // ✅ FLW-verified name
      account_number: resolved.account_number,
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

// ── Nigeria date string (UTC+1) ───────────────────────────────
export const getNigeriaDate = () =>
  new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
  });

// ── Calculate withdrawal fees ─────────────────────────────────
// Rule 1: amount > ₦10,000  → ₦50 flat fee
// Rule 2: 3rd+ today        → +₦10 extra
export const calculateWithdrawalFees = async (vendorId, amount) => {
  const today = getNigeriaDate();

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) FROM market.vendor_withdrawal_requests
     WHERE vendor_id = $1
       AND status    IN ('pending','processing','success')
       AND DATE(created_at AT TIME ZONE 'Africa/Lagos') = $2`,
    [vendorId, today]
  );

  const dailyCount = Number(count);
  let fee = 0;

  const breakdown = {
    above_10k_fee:        0,
    extra_withdrawal_fee: 0,
  };

  if (amount > 10000) {
    breakdown.above_10k_fee = 50;
    fee += 50;
  }

  if (dailyCount >= 2) {
    breakdown.extra_withdrawal_fee = 10;
    fee += 10;
  }

  return {
    amount,
    fee,
    net_amount:      amount - fee,
    daily_count:     dailyCount,
    daily_remaining: Math.max(5 - dailyCount, 0),
    breakdown,
  };
};

// ── Generate unique TX ref ────────────────────────────────────
export const generateTxRef = () =>
  `WD-${crypto.randomUUID()}`;

// ── Initiate transfer via Flutterwave ─────────────────────────
// FLW resolves and uses its own account name — no need to pass it
export const initiateTransfer = async ({
  vendorId,
  amount,
  fee,
  netAmount,
  bankName,
  accountNumber,
  accountName,
  txRef,
}) => {
  const bank = getBankCode(bankName);
  if (!bank) {
    throw new Error(
      `Unsupported bank: "${bankName}". Only commercial banks are allowed.`
    );
  }

  if (!validateAccountNumber(accountNumber)) {
    throw new Error("Invalid account number — must be exactly 10 digits");
  }

  const { data } = await flw().post("/transfers", {
    account_bank:   bank.code,
    account_number: accountNumber,
    amount:         netAmount,
    narration:      `Wallet withdrawal — ${txRef}`,
    currency:       "NGN",
    reference:      txRef,
    callback_url:   process.env.FLW_TRANSFER_WEBHOOK_URL,
    debit_currency: "NGN",
    meta: {
      vendor_id: String(vendorId),
      tx_ref:    txRef,
      gross:     amount,
      fee,
    },
  });

  if (data.status !== "success") {
    throw new Error(data.message ?? "Transfer initiation failed");
  }

  console.log("[FLW transfer] initiated:", {
    flw_id:    data.data.id,
    reference: data.data.reference,
    status:    data.data.status,
    amount:    data.data.amount,
    bank:      bank.name,
  });

  return {
    flw_transfer_id:  data.data.id,
    status:           data.data.status,
    reference:        data.data.reference,
    amount:           data.data.amount,
    complete_message: data.data.complete_message ?? "",
  };
};

// ── Check transfer status ─────────────────────────────────────
export const checkTransferStatus = async (flwTransferId) => {
  const { data } = await flw().get(`/transfers/${flwTransferId}`);

  return {
    status:    data.data.status,
    message:   data.data.complete_message ?? "",
    reference: data.data.reference,
    raw:       data.data,
  };
};

// ── Named exports only — no default needed ────────────────────
// Import with: import { getBankCode, initiateTransfer, ... }