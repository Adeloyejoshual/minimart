// controllers/seller.controller.js
import { pool }             from "../server.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier          from "streamifier";

// ─── Cloudinary upload helper ─────────────────────────────────
const uploadToCloudinary = (buffer, folder, filename) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id:      filename,
        resource_type:  "auto",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// ── GET /api/seller-onboarding/status ────────────────────────
export const getVendorStatus = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.id, v.store_name, v.store_logo, v.store_banner,
         v.store_category, v.store_description,
         v.status, v.rejection_reason, v.suspended_reason,
         v.approved_at, v.activated_at,
         v.products_count, v.total_sales, v.total_revenue,
         v.rating, v.trust_score,
         v.withdrawal_method, v.bank_account,
         v.bank_name, v.account_name,
         v.created_at
       FROM market.vendors v
       WHERE v.user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        code:    "NO_VENDOR",
        message: "No vendor account found",
      });
    }

    res.json({ success: true, vendor: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/seller-onboarding/setup-store ───────────────────
export const setupStore = async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Check existing vendor ─────────────────────────────
    const { rows: existing } = await client.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    if (existing.length && existing[0].status !== "rejected") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        code:    "VENDOR_EXISTS",
        message: "Store already exists",
        status:  existing[0].status,
      });
    }

    const {
      store_name,
      store_description,
      store_category,
      bank_account,
      bank_name,
      account_name,
    } = req.body;

    // ── Validate ──────────────────────────────────────────
    if (!store_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Store name is required" });
    }

    if (!bank_account?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Bank account is required" });
    }

    if (!bank_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Bank name is required" });
    }

    if (!account_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Account name is required" });
    }

    // ── Check store name taken ────────────────────────────
    const { rows: nameTaken } = await client.query(
      `SELECT id FROM market.vendors
       WHERE store_name = $1 AND user_id != $2`,
      [store_name.trim(), req.user.id]
    );

    if (nameTaken.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        code:    "NAME_TAKEN",
        message: "Store name is already taken",
      });
    }

    // ── Upload images ─────────────────────────────────────
    let store_logo   = null;
    let store_banner = null;

    if (req.files?.store_logo?.[0]) {
      store_logo = await uploadToCloudinary(
        req.files.store_logo[0].buffer,
        "vendor_logos",
        `logo_${req.user.id}`
      );
    }

    if (req.files?.store_banner?.[0]) {
      store_banner = await uploadToCloudinary(
        req.files.store_banner[0].buffer,
        "vendor_banners",
        `banner_${req.user.id}`
      );
    }

    let vendor;
    const oldStatus = existing[0]?.status ?? null;

    if (existing.length) {
      // ── Reapply — UPDATE ──────────────────────────────
      const { rows: [updated] } = await client.query(
        `UPDATE market.vendors SET
           store_name        = $1,
           store_description = $2,
           store_category    = $3,
           store_logo        = COALESCE($4, store_logo),
           store_banner      = COALESCE($5, store_banner),
           withdrawal_method = 'bank_transfer',
           bank_account      = $6,
           bank_name         = $7,
           account_name      = $8,
           paypal_email      = NULL,
           crypto_wallet     = NULL,
           status            = 'pending',
           rejection_reason  = NULL,
           rejected_at       = NULL,
           updated_at        = NOW()
         WHERE user_id = $9
         RETURNING *`,
        [
          store_name.trim(),
          store_description?.trim() ?? null,
          store_category            ?? null,
          store_logo,
          store_banner,
          bank_account.trim(),
          bank_name.trim(),
          account_name.trim(),
          req.user.id,
        ]
      );
      vendor = updated;
    } else {
      // ── Fresh INSERT ──────────────────────────────────
      const { rows: [created] } = await client.query(
        `INSERT INTO market.vendors
           (user_id, store_name, store_description, store_category,
            store_logo, store_banner,
            withdrawal_method, bank_account, bank_name, account_name,
            status)
         VALUES ($1,$2,$3,$4,$5,$6,'bank_transfer',$7,$8,$9,'pending')
         RETURNING *`,
        [
          req.user.id,
          store_name.trim(),
          store_description?.trim() ?? null,
          store_category            ?? null,
          store_logo,
          store_banner,
          bank_account.trim(),
          bank_name.trim(),
          account_name.trim(),
        ]
      );
      vendor = created;
    }

    // ── Status log ────────────────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, 'pending', $3, 'Store setup submitted')`,
      [vendor.id, oldStatus, req.user.id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Store setup complete! Proceed to verification.",
      vendor: {
        id:          vendor.id,
        store_name:  vendor.store_name,
        store_logo:  vendor.store_logo,
        status:      vendor.status,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");

    // ── Detailed error for debugging ──────────────────────
    console.error("[setupStore] error:", {
      message: err.message,
      code:    err.code,
      detail:  err.detail,
    });

    next(err);
  } finally {
    client.release();
  }
};

// ── POST /api/seller-onboarding/verify ───────────────────────
export const submitVerification = async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: [vendor] } = await client.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    if (!vendor) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Complete store setup first" });
    }

    if (vendor.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot submit verification — status: "${vendor.status}"`,
      });
    }

    const uploadDoc = async (fieldName, folder) => {
      const file = req.files?.[fieldName]?.[0];
      if (!file) return null;
      return uploadToCloudinary(
        file.buffer,
        folder,
        `${fieldName}_${vendor.id}_${Date.now()}`
      );
    };

    const [id_card_url, selfie_url, business_doc_url, address_proof_url] =
      await Promise.all([
        uploadDoc("id_card",       "vendor_docs/id_cards"),
        uploadDoc("selfie",        "vendor_docs/selfies"),
        uploadDoc("business_doc",  "vendor_docs/business"),
        uploadDoc("address_proof", "vendor_docs/address"),
      ]);

    if (!id_card_url || !selfie_url) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "ID card and selfie are required",
      });
    }

    await client.query(
      `INSERT INTO market.vendor_verifications
         (vendor_id, id_card_url, selfie_url,
          business_doc_url, address_proof_url, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       ON CONFLICT (vendor_id) DO UPDATE SET
         id_card_url       = EXCLUDED.id_card_url,
         selfie_url        = EXCLUDED.selfie_url,
         business_doc_url  = COALESCE(EXCLUDED.business_doc_url, vendor_verifications.business_doc_url),
         address_proof_url = COALESCE(EXCLUDED.address_proof_url, vendor_verifications.address_proof_url),
         status            = 'pending',
         verified_at       = NULL,
         updated_at        = NOW()`,
      [vendor.id, id_card_url, selfie_url, business_doc_url, address_proof_url]
    );

    await client.query(
      `UPDATE market.vendors SET status = 'under_review', updated_at = NOW() WHERE id = $1`,
      [vendor.id]
    );

    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1,'pending','under_review',$2,'Verification docs submitted')`,
      [vendor.id, req.user.id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Verification submitted! We'll review within 1–3 business days.",
      vendor:  { id: vendor.id, status: "under_review" },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};