// utils/createVirtualAccount.js
import axios          from "axios";
import { randomUUID } from "crypto";
import { pool }       from "../server.js";

const flw = () =>
  axios.create({
    baseURL: "https://api.flutterwave.com/v3",
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 20_000,
  });

const cleanPhone = (raw) => {
  if (!raw) return "08000000000";
  const p = raw.replace(/\s/g, "")
    .replace(/^\+234/, "0")
    .replace(/^234/,  "0");
  return /^0\d{10}$/.test(p) ? p : "08000000000";
};

export const createVirtualAccount = async (vendorId) => {

  // ── Fetch vendor + user + verification (for NIN) ──────────
  const { rows } = await pool.query(
    `SELECT
       v.id, v.user_id, v.status, v.store_name,
       v.bank_name, v.bank_code,
       v.account_name, v.bank_account,
       u.name, u.email, u.phone_number,
       -- Get NIN from verification if submitted
       vv.id_type,
       vv.id_number
     FROM market.vendors v
     JOIN market.users u ON u.id = v.user_id
     LEFT JOIN market.vendor_verifications vv ON vv.vendor_id = v.id
     WHERE v.id = $1`,
    [vendorId]
  );

  if (!rows.length) throw new Error("Vendor not found");

  const vendor = rows[0];

  if (vendor.status !== "active") {
    throw new Error(`Vendor must be active. Current: "${vendor.status}"`);
  }

  if (!vendor.email) throw new Error("Vendor email is required");
  if (!vendor.name)  throw new Error("Vendor name is required");

  // ── Check already exists ──────────────────────────────────
  const { rows: existing } = await pool.query(
    `SELECT * FROM market.vendor_virtual_accounts WHERE vendor_id = $1`,
    [vendorId]
  );

  if (existing.length) {
    const { rows: wallet } = await pool.query(
      `SELECT * FROM market.vendor_wallets WHERE vendor_id = $1`,
      [vendorId]
    );
    return {
      virtual_account: existing[0],
      wallet:          wallet[0] ?? null,
      already_exists:  true,
    };
  }

  const txRef     = `VA-${randomUUID()}`;
  const nameParts = vendor.name.trim().split(/\s+/);

  // ── Build payload ─────────────────────────────────────────
  const payload = {
    email:        vendor.email,
    is_permanent: true,
    tx_ref:       txRef,
    currency:     "NGN",
    narration:    `${vendor.store_name} — Minimart`,
    phonenumber:  cleanPhone(vendor.phone_number),
    firstname:    nameParts[0],
    lastname:     nameParts.slice(1).join(" ") || "Store",
  };

  // ── Add NIN if available from verification ────────────────
  if (vendor.id_type === "nin" && vendor.id_number?.trim()) {
    payload.bvn = vendor.id_number.trim(); // FLW accepts NIN in bvn field
    console.log("[createVirtualAccount] using NIN:", vendor.id_number.slice(0, 4) + "***");
  } else if (vendor.id_type === "bvn" && vendor.id_number?.trim()) {
    payload.bvn = vendor.id_number.trim();
    console.log("[createVirtualAccount] using BVN:", vendor.id_number.slice(0, 4) + "***");
  } else {
    console.warn("[createVirtualAccount] no NIN/BVN — trying without");
  }

  console.log("[createVirtualAccount] payload:", {
    email:       payload.email,
    phonenumber: payload.phonenumber,
    has_bvn:     !!payload.bvn,
    tx_ref:      payload.tx_ref,
  });

  let va;
  try {
    const { data } = await flw().post("/virtual-account-numbers", payload);

    console.log("[createVirtualAccount] FLW:", data.status, data.message);

    if (data.status !== "success") {
      throw new Error(data.message ?? "Flutterwave error");
    }

    va = data.data;

  } catch (flwErr) {
    const msg =
      flwErr.response?.data?.message ??
      flwErr.message ??
      "Flutterwave API error";

    console.error("[createVirtualAccount] ❌", {
      status:  flwErr.response?.status,
      message: msg,
    });

    throw new Error(`Flutterwave: ${msg}`);
  }

  // ── Save to DB ────────────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Race condition check
    const { rows: existingAfter } = await client.query(
      `SELECT * FROM market.vendor_virtual_accounts
       WHERE vendor_id = $1 FOR UPDATE`,
      [vendorId]
    );

    if (existingAfter.length) {
      await client.query("COMMIT");
      return { virtual_account: existingAfter[0], already_exists: true };
    }

    const { rows: [savedVA] } = await client.query(
      `INSERT INTO market.vendor_virtual_accounts
         (vendor_id, user_id, flw_account_id, account_number,
          account_name, bank_name, bank_code, order_ref,
          flw_ref, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
       RETURNING *`,
      [
        vendorId,
        vendor.user_id,
        va.id?.toString()  ?? null,
        va.account_number,
        va.account_name    ?? vendor.store_name,
        va.bank_name       ?? "Wema Bank",
        va.bank_code       ?? null,
        txRef,
        va.flw_ref         ?? null,
      ]
    );

    await client.query(
      `INSERT INTO market.vendor_wallets
         (vendor_id, available_balance, pending_balance,
          total_received, total_withdrawn, currency)
       VALUES ($1, 0.00, 0.00, 0.00, 0.00, 'NGN')
       ON CONFLICT (vendor_id) DO NOTHING`,
      [vendorId]
    );

    const { rows: [wallet] } = await client.query(
      `SELECT * FROM market.vendor_wallets WHERE vendor_id = $1`,
      [vendorId]
    );

    await client.query("COMMIT");

    console.log("[createVirtualAccount] ✅ saved:", savedVA.account_number);

    return { virtual_account: savedVA, wallet, already_exists: false };

  } catch (dbErr) {
    await client.query("ROLLBACK");
    throw dbErr;
  } finally {
    client.release();
  }
};