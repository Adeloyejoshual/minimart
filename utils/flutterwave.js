import axios  from "axios";
import crypto from "crypto";
import { pool } from "../server.js";

const FLW_BASE = "https://api.flutterwave.com/v3";

// ── Lazy FLW client ───────────────────────────────────────────────────────────
const flw = () => {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) throw new Error("FLW_SECRET_KEY is not set");

  const instance = axios.create({
    baseURL: FLW_BASE,
    headers: {
      Authorization:  `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    timeout: 30_000,
  });

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const msg =
        err.response?.data?.message ??
        err.response?.data?.error   ??
        err.message                 ??
        "Flutterwave request failed";
      console.error("[FLW]", {
        status:  err.response?.status,
        message: msg,
        url:     err.config?.url,
      });
      return Promise.reject(new Error(msg));
    }
  );

  return instance;
};

// ── Commercial banks ──────────────────────────────────────────────────────────
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

export const getBankCode = (bankName) =>
  bankName
    ? (COMMERCIAL_BANKS[bankName.toLowerCase().trim()] ?? null)
    : null;

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

export const validateAccountNumber = (num) =>
  typeof num === "string" && /^\d{10}$/.test(num.trim());

// ── Account resolution ────────────────────────────────────────────────────────
export const resolveAccount = async (accountNumber, bankCode) => {
  const { data } = await flw().post("/accounts/resolve", {
    account_number: accountNumber,
    account_bank:   bankCode,
  });
  return data?.data ?? null;
};

export const verifyAccountName = async (accountNumber, bankName) => {
  const bank = getBankCode(bankName);
  if (!bank) {
    return { valid: false, message: `"${bankName}" is not a supported bank.` };
  }
  if (!validateAccountNumber(accountNumber)) {
    return { valid: false, message: "Account number must be exactly 10 digits." };
  }
  try {
    const resolved = await resolveAccount(accountNumber.trim(), bank.code);
    if (!resolved) {
      return { valid: false, message: "Could not verify account." };
    }
    return {
      valid:          true,
      account_name:   resolved.account_name,
      account_number: resolved.account_number,
      bank_code:      bank.code,
      bank_name:      bank.name,
    };
  } catch (err) {
    return { valid: false, message: err.message ?? "Account verification failed" };
  }
};

// ── Nigeria date (UTC+1) ──────────────────────────────────────────────────────
export const getNigeriaDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

// ── Fee tiers ─────────────────────────────────────────────────────────────────
// First 3 withdrawals per day → FREE
// 4th+ withdrawal today:
//   ₦0      – ₦9,999    → ₦50
//   ₦10,000 – ₦99,999   → ₦100
//   ₦100,000– ₦500,000  → ₦150
//   > ₦500,000           → ₦200

export const FEE_TIERS = [
  {
    label:      "₦0 – ₦9,999",
    max_amount: 9_999,
    fee_amount: 50,
  },
  {
    label:      "₦10,000 – ₦99,999",
    max_amount: 99_999,
    fee_amount: 100,
  },
  {
    label:      "₦100,000 – ₦500,000",
    max_amount: 500_000,
    fee_amount: 150,
  },
  {
    label:      "Above ₦500,000",
    max_amount: Infinity,
    fee_amount: 200,
  },
];

export const calculateWithdrawalFee = (amount, withdrawalsToday) => {
  // First 3 withdrawals are always free
  if (withdrawalsToday < 3) return 0;

  for (const tier of FEE_TIERS) {
    if (amount <= tier.max_amount) return tier.fee_amount;
  }
  return 200;
};

export const feeScheduleLabel = (withdrawalsToday) => {
  const free = Math.max(0, 3 - withdrawalsToday);
  return free > 0
    ? `${free} free withdrawal${free > 1 ? "s" : ""} remaining today`
    : "Fees apply: ₦50 / ₦100 / ₦150 / ₦200 (by amount)";
};

// ── DB-aware fee calculator ───────────────────────────────────────────────────
// Pass pool or a connected pg client (works in or out of transactions)
export const calculateWithdrawalFees = async (dbClient, vendorId, amount) => {
  const today = getNigeriaDate();

  const { rows: [row] } = await dbClient.query(
    `SELECT
       COUNT(*)                 AS withdrawals_today,
       COALESCE(SUM(amount), 0) AS daily_used
     FROM market.vendor_withdrawal_requests
     WHERE vendor_id = $1
       AND status IN ('pending', 'processing', 'success')
       AND DATE(created_at AT TIME ZONE 'Africa/Lagos') = $2`,
    [vendorId, today]
  );

  const withdrawalsToday = Number(row.withdrawals_today);
  const dailyUsed        = parseFloat(row.daily_used);
  const fee              = calculateWithdrawalFee(amount, withdrawalsToday);

  return {
    fee,
    netAmount:      parseFloat((amount - fee).toFixed(2)),
    withdrawalsToday,
    dailyUsed,
    freeRemaining:  Math.max(0, 3 - withdrawalsToday),
  };
};

// ── Tx ref ────────────────────────────────────────────────────────────────────
export const generateTxRef = () => `WD-${crypto.randomUUID()}`;

// ── Initiate transfer ─────────────────────────────────────────────────────────
export const initiateTransfer = async ({
  vendorId,
  amount,       // gross amount deducted from wallet
  fee,
  netAmount,    // what hits the bank
  bankName,
  bankCode,     // optional override — derived from bankName if not given
  accountNumber,
  accountName,
  txRef,
}) => {
  // Resolve bank code
  let resolvedCode = bankCode ?? null;
  if (!resolvedCode) {
    const bank = getBankCode(bankName);
    if (!bank) throw new Error(`Unsupported bank: "${bankName}"`);
    resolvedCode = bank.code;
  }

  if (!validateAccountNumber(accountNumber)) {
    throw new Error("Invalid account number — must be exactly 10 digits");
  }

  if (netAmount <= 0) {
    throw new Error("Net amount must be greater than 0");
  }

  const payload = {
    account_bank:   resolvedCode,
    account_number: accountNumber,
    amount:         netAmount,
    narration:      `Minimart withdrawal — ${txRef}`,
    currency:       "NGN",
    reference:      txRef,
    debit_currency: "NGN",
    meta: {
      vendor_id:    String(vendorId),
      tx_ref:       txRef,
      gross_amount: amount,
      fee,
    },
  };

  // Only add callback if configured
  if (process.env.FLW_TRANSFER_WEBHOOK_URL) {
    payload.callback_url = process.env.FLW_TRANSFER_WEBHOOK_URL;
  }

  const { data } = await flw().post("/transfers", payload);

  if (data.status !== "success") {
    throw new Error(data.message ?? "Transfer initiation failed");
  }

  console.log("[FLW] transfer initiated:", {
    flw_id:    data.data.id,
    reference: data.data.reference,
    amount:    data.data.amount,
    bank_code: resolvedCode,
    account:   accountNumber,
  });

  return {
    flw_transfer_id:  String(data.data.id),
    status:           data.data.status,
    reference:        data.data.reference,
    complete_message: data.data.complete_message ?? "",
  };
};

// ── Check transfer status ─────────────────────────────────────────────────────
export const checkTransferStatus = async (flwTransferId) => {
  const { data } = await flw().get(`/transfers/${flwTransferId}`);

  if (!data?.data) {
    throw new Error("Invalid response from Flutterwave status check");
  }

  return {
    status:    data.data.status,
    message:   data.data.complete_message ?? "",
    reference: data.data.reference,
    raw:       data.data,
  };
};