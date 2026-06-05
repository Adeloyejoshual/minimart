// utils/createVirtualAccount.js
import axios        from "axios";
import { randomUUID } from "crypto";
import { pool }     from "../server.js";

const flw = () =>
  axios.create({
    baseURL: "https://api.flutterwave.com/v3",
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 20_000,
  });

// ── Clean phone to Nigerian format ────────────────────────────
const cleanPhone = (raw) => {
  if (!raw) return "08000000000";
  const p = raw.replace(/\s/g, "").replace(/^\+234/, "0").replace(/^234/, "0");
  return /^0\d{10}$/.test(p) ? p : "08000000000";
};

// ─────────────────────────────────────────────────────────────
export const createVirtualAccount = async (vendorId) => {

  // ── Step 1: fetch vendor + user (no lock yet) ─────────────
  const { rows } = await pool.query(
    `SELECT
       v.id, v.user_id, v.status, v.store_name,
       v.bank_name, v.bank_code, v.account_name, v.bank_account,
       u.name, u.email, u.phone_number
     FROM market.vendors v
     JOIN market.users u ON u.id = v.user_id
     WHERE v.id = $1`,
    [vendorId]
  );

  if (!rows.length) throw new Error("Vendor not found");

  const vendor = rows[0];

  if (vendor.status !== "active") {
    throw new Error(
      `Vendor must be active. Current status: "${vendor.status}"`
    );
  }

  if (!vendor.email) throw new Error("Vendor email is required");
  if (!vendor.name)  throw new Error("Vendor name is required");

  // ── Step 2: check if already exists ──────────────────────
  const { rows: existing } = await pool.query(
    `SELECT * FROM market.vendor_virtual_accounts WHERE vendor_id = $1`,
    [vendorId]
  );

  if (existing.length) {
    console.log("[createVirtualAccount] already exists:", existing[0].account_number);
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

  // ── Step 3: call Flutterwave ──────────────────────────────
  const txRef     = `VA-${randomUUID()}`;
  const nameParts = vendor.name.trim().split(/\s+/);

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

  console.log("[createVirtualAccount] FLW payload:", {
    email:       payload.email,
    phonenumber: payload.phonenumber,
    firstname:   payload.firstname,
    lastname:    payload.lastname,
    tx_ref:      payload.tx_ref,
  });

  let va;

  try {
    const { data } = await flw().post("/virtual-account-numbers", payload);

    console.log("[createVirtualAccount] FLW response:", {
      status:  data.status,
      message: data.message,
      data:    data.data,
    });

    if (data.status !== "success") {
      throw new Error(data.message ?? "Flutterwave returned non-success status");
    }

    va = data.data;

  } catch (flwErr) {
    const msg =
      flwErr.response?.data?.message ??
      flwErr.message ??
      "Flutterwave API error";

    console.error("[createVirtualAccount] ❌ FLW error:", {
      status:  flwErr.response?.status,
      message: msg,
      body:    flwErr.response?.data,
    });

    // ── Throw readable error back to admin ────────────────
    throw new Error(`Flutterwave: ${msg}`);
  }

  // ── Step 4: save to DB inside transaction ─────────────────
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Re-check inside transaction (race condition guard)
    const { rows: existingAfter } = await client.query(
      `SELECT * FROM market.vendor_virtual_accounts
       WHERE vendor_id = $1 FOR UPDATE`,
      [vendorId]
    );

    if (existingAfter.length) {
      await client.query("COMMIT");
      console.log("[createVirtualAccount] race: already saved by another request");
      return {
        virtual_account: existingAfter[0],
        wallet:          null,
        already_exists:  true,
      };
    }

    // Insert virtual account
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
        va.id?.toString()       ?? null,
        va.account_number,
        va.account_name         ?? vendor.store_name,
        va.bank_name            ?? "Wema Bank",
        va.bank_code            ?? null,
        txRef,
        va.flw_ref              ?? null,
      ]
    );

    // Create wallet
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

    return {
      virtual_account: savedVA,
      wallet,
      already_exists:  false,
    };

  } catch (dbErr) {
    await client.query("ROLLBACK");
    console.error("[createVirtualAccount] DB error:", dbErr.message);
    throw dbErr;
  } finally {
    client.release();
  }
};