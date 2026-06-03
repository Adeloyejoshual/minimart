// utils/createVirtualAccount.js
import axios    from "axios";
import { pool } from "../server.js";

const flw = () =>
  axios.create({
    baseURL: "https://api.flutterwave.com/v3",
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 20_000,
  });

// ─────────────────────────────────────────────────────────────
// Called ONLY when admin sets vendor status → active
// Creates:
//   1. Flutterwave permanent virtual account
//   2. market.vendor_virtual_accounts row
//   3. market.vendor_wallets row
// ─────────────────────────────────────────────────────────────
export const createVirtualAccount = async (vendorId) => {
  // ── Fetch vendor + user ──────────────────────────────────
  const { rows } = await pool.query(
    `SELECT
       v.id, v.store_name,
       v.bank_account, v.bank_name,
       v.account_name, v.bank_code,
       u.id AS user_id, u.name,
       u.email, u.phone_number
     FROM market.vendors v
     JOIN market.users u ON u.id = v.user_id
     WHERE v.id = $1`,
    [vendorId]
  );

  if (!rows.length) {
    throw new Error(`Vendor ${vendorId} not found`);
  }

  const vendor = rows[0];

  // ── Check virtual account already exists ─────────────────
  const { rows: existing } = await pool.query(
    `SELECT id, account_number
     FROM market.vendor_virtual_accounts
     WHERE vendor_id = $1`,
    [vendorId]
  );

  if (existing.length) {
    console.log(
      `[createVirtualAccount] already exists:`,
      existing[0].account_number
    );
    return existing[0];
  }

  const orderRef  = `VA-${vendorId}-${Date.now()}`;
  const nameParts = (vendor.name ?? "Seller Store").split(" ");

  // ── Call Flutterwave ─────────────────────────────────────
  console.log("[createVirtualAccount] creating for vendor:", vendorId);

  const { data } = await flw().post("/virtual-account-numbers", {
    email:        vendor.email,
    is_permanent: true,
    tx_ref:       orderRef,
    currency:     "NGN",
    narration:    `${vendor.store_name} — Minimart`,
    phonenumber:  vendor.phone_number ?? "08000000000",
    firstname:    nameParts[0],
    lastname:     nameParts.slice(1).join(" ") || "Store",
  });

  if (data.status !== "success") {
    throw new Error(
      data.message ?? "Flutterwave virtual account creation failed"
    );
  }

  const va = data.data;
  console.log("[createVirtualAccount] FLW response:", va.account_number);

  // ── Save virtual account + create wallet in transaction ──
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Save virtual account
    const { rows: [savedVA] } = await client.query(
      `INSERT INTO market.vendor_virtual_accounts
         (vendor_id, user_id, flw_account_id, account_number,
          account_name, bank_name, bank_code, order_ref, flw_ref, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
       ON CONFLICT (vendor_id) DO UPDATE SET
         account_number = EXCLUDED.account_number,
         account_name   = EXCLUDED.account_name,
         bank_name      = EXCLUDED.bank_name,
         order_ref      = EXCLUDED.order_ref,
         status         = 'active',
         updated_at     = NOW()
       RETURNING *`,
      [
        vendorId,
        vendor.user_id,
        va.id?.toString()   ?? null,
        va.account_number,
        va.account_name     ?? vendor.store_name,
        va.bank_name        ?? "Wema Bank",
        va.bank_code        ?? null,
        orderRef,
        va.flw_ref          ?? null,
      ]
    );

    // 2. Create wallet with zero balance
    const { rows: [savedWallet] } = await client.query(
      `INSERT INTO market.vendor_wallets
         (vendor_id, available_balance, pending_balance,
          total_received, total_withdrawn, currency)
       VALUES ($1, 0.00, 0.00, 0.00, 0.00, 'NGN')
       ON CONFLICT (vendor_id) DO NOTHING
       RETURNING *`,
      [vendorId]
    );

    await client.query("COMMIT");

    console.log(
      `[createVirtualAccount] complete — account: ${va.account_number}`,
      `| wallet: ${savedWallet?.id ?? "already existed"}`
    );

    return {
      virtual_account: savedVA,
      wallet:          savedWallet,
    };

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};