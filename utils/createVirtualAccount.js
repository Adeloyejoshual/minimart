// utils/createVirtualAccount.js

import axios from "axios";
import { randomUUID } from "crypto";
import { pool } from "../server.js";

const flw = () =>
  axios.create({
    baseURL: "https://api.flutterwave.com/v3",
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 20000,
  });

export const createVirtualAccount = async (vendorId) => {
  const lockClient = await pool.connect();

  try {
    await lockClient.query("BEGIN");

    // Lock vendor row to prevent duplicate account creation
    const { rows: vendorRows } = await lockClient.query(
      `
      SELECT
        v.id,
        v.user_id,
        v.status,
        v.store_name,
        v.bank_name,
        v.bank_code,
        v.account_name,
        v.bank_account,

        u.name,
        u.email,
        u.phone_number

      FROM market.vendors v
      JOIN market.users u
        ON u.id = v.user_id

      WHERE v.id = $1
      FOR UPDATE
      `,
      [vendorId]
    );

    if (!vendorRows.length) {
      throw new Error("Vendor not found");
    }

    const vendor = vendorRows[0];

    if (vendor.status !== "active") {
      throw new Error(
        `Vendor must be active before virtual account creation. Current status: ${vendor.status}`
      );
    }

    if (!vendor.email) {
      throw new Error("Vendor email is required");
    }

    if (!vendor.name) {
      throw new Error("Vendor name is required");
    }

    // Check if account already exists
    const { rows: existingAccounts } = await lockClient.query(
      `
      SELECT *
      FROM market.vendor_virtual_accounts
      WHERE vendor_id = $1
      `,
      [vendorId]
    );

    if (existingAccounts.length) {
      const { rows: existingWallets } = await lockClient.query(
        `
        SELECT *
        FROM market.vendor_wallets
        WHERE vendor_id = $1
        `,
        [vendorId]
      );

      await lockClient.query("COMMIT");

      return {
        virtual_account: existingAccounts[0],
        wallet: existingWallets[0] ?? null,
        already_exists: true,
      };
    }

    await lockClient.query("COMMIT");

    // Release lock before external API call
    lockClient.release();

    const txRef = `VA-${randomUUID()}`;

    const nameParts = vendor.name.trim().split(" ");

    const { data } = await flw().post(
      "/virtual-account-numbers",
      {
        email: vendor.email,
        is_permanent: true,
        tx_ref: txRef,
        currency: "NGN",
        narration: `${vendor.store_name} - Marketplace`,
        phonenumber:
          vendor.phone_number || "08000000000",
        firstname: nameParts[0],
        lastname:
          nameParts.slice(1).join(" ") || "Seller",
      }
    );

    if (data.status !== "success") {
      throw new Error(
        data.message ||
          "Flutterwave virtual account creation failed"
      );
    }

    const va = data.data;

    const saveClient = await pool.connect();

    try {
      await saveClient.query("BEGIN");

      // Re-check inside transaction
      const { rows: existingAfterApi } =
        await saveClient.query(
          `
          SELECT *
          FROM market.vendor_virtual_accounts
          WHERE vendor_id = $1
          FOR UPDATE
          `,
          [vendorId]
        );

      if (existingAfterApi.length) {
        const { rows: walletRows } =
          await saveClient.query(
            `
            SELECT *
            FROM market.vendor_wallets
            WHERE vendor_id = $1
            `,
            [vendorId]
          );

        await saveClient.query("COMMIT");

        return {
          virtual_account: existingAfterApi[0],
          wallet: walletRows[0] ?? null,
          already_exists: true,
        };
      }

      // Save virtual account
      const { rows: savedVA } =
        await saveClient.query(
          `
          INSERT INTO market.vendor_virtual_accounts (
            vendor_id,
            user_id,
            flw_account_id,
            account_number,
            account_name,
            bank_name,
            bank_code,
            order_ref,
            flw_ref,
            flw_payload,
            status
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active'
          )
          RETURNING *
          `,
          [
            vendorId,
            vendor.user_id,
            va.id?.toString() ?? null,
            va.account_number,
            va.account_name ??
              vendor.store_name,
            va.bank_name ?? "Wema Bank",
            va.bank_code ?? null,
            txRef,
            va.flw_ref ?? null,
            JSON.stringify(data),
          ]
        );

      // Create wallet
      await saveClient.query(
        `
        INSERT INTO market.vendor_wallets (
          vendor_id,
          available_balance,
          pending_balance,
          total_received,
          total_withdrawn,
          currency
        )
        VALUES (
          $1,
          0.00,
          0.00,
          0.00,
          0.00,
          'NGN'
        )
        ON CONFLICT (vendor_id)
        DO NOTHING
        `,
        [vendorId]
      );

      const { rows: walletRows } =
        await saveClient.query(
          `
          SELECT *
          FROM market.vendor_wallets
          WHERE vendor_id = $1
          `,
          [vendorId]
        );

      await saveClient.query("COMMIT");

      return {
        virtual_account: savedVA[0],
        wallet: walletRows[0],
        already_exists: false,
      };
    } catch (error) {
      await saveClient.query("ROLLBACK");
      throw error;
    } finally {
      saveClient.release();
    }
  } catch (error) {
    try {
      await lockClient.query("ROLLBACK");
    } catch (_) {}

    throw error;
  } finally {
    try {
      lockClient.release();
    } catch (_) {}
  }
};