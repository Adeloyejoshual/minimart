// controllers/seller.controller.js
import { pool }              from "../config/db.js";
import { v2 as cloudinary }  from "cloudinary";
import streamifier           from "streamifier";

// ─── Cloudinary upload helper ─────────────────────────────────
const uploadToCloudinary = (buffer, folder, filename) => {
  return new Promise((resolve, reject) => {
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
};

// ── GET /api/seller/status ────────────────────────────────────
export const getVendorStatus = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.id, v.store_name, v.store_logo, v.store_banner,
         v.store_category, v.store_description,
         v.status, v.rejection_reason, v.suspended_reason,
         v.suspension_expires, v.approved_at, v.activated_at,
         v.products_count, v.total_sales, v.total_revenue,
         v.rating, v.trust_score, v.created_at,
         row_to_json(vp.*) AS permissions
       FROM market.vendors v
       LEFT JOIN market.vendor_permissions vp
         ON vp.vendor_id = v.id
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

    const vendor = rows[0];

    res.json({
      success: true,
      vendor,
    });

  } catch (err) {
    next(err);
  }
};

// ── POST /api/seller/setup-store ──────────────────────────────
export const setupStore = async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Check: vendor already exists? ──────────────────────
    const { rows: existing } = await client.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    if (existing.length) {
      // Allow resubmit only if rejected
      if (existing[0].status !== "rejected") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          code:    "VENDOR_EXISTS",
          message: "Store already exists",
          status:  existing[0].status,
        });
      }
    }

    const {
      store_name,
      store_description,
      store_category,
      withdrawal_method,
      bank_account,
      paypal_email,
      crypto_wallet,
    } = req.body;

    // ── Validate required fields ────────────────────────────
    if (!store_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Store name is required",
      });
    }

    // ── Check store name taken ──────────────────────────────
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

    // ── Upload logo to Cloudinary ───────────────────────────
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

    // ── Insert or update vendor ─────────────────────────────
    let vendor;

    if (existing.length) {
      // Reapply after rejection — update existing row
      const { rows: [updated] } = await client.query(
        `UPDATE market.vendors SET
           store_name        = $1,
           store_description = $2,
           store_category    = $3,
           store_logo        = COALESCE($4, store_logo),
           store_banner      = COALESCE($5, store_banner),
           withdrawal_method = $6,
           bank_account      = $7,
           paypal_email      = $8,
           crypto_wallet     = $9,
           status            = 'pending',
           rejection_reason  = NULL,
           rejected_at       = NULL,
           updated_at        = NOW()
         WHERE user_id = $10
         RETURNING *`,
        [
          store_name.trim(),
          store_description?.trim()  ?? null,
          store_category             ?? null,
          store_logo,
          store_banner,
          withdrawal_method          ?? null,
          bank_account?.trim()       ?? null,
          paypal_email?.trim()       ?? null,
          crypto_wallet?.trim()      ?? null,
          req.user.id,
        ]
      );
      vendor = updated;
    } else {
      // Fresh insert
      const { rows: [created] } = await client.query(
        `INSERT INTO market.vendors
           (user_id, store_name, store_description, store_category,
            store_logo, store_banner, withdrawal_method,
            bank_account, paypal_email, crypto_wallet, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
         RETURNING *`,
        [
          req.user.id,
          store_name.trim(),
          store_description?.trim()  ?? null,
          store_category             ?? null,
          store_logo,
          store_banner,
          withdrawal_method          ?? null,
          bank_account?.trim()       ?? null,
          paypal_email?.trim()       ?? null,
          crypto_wallet?.trim()      ?? null,
        ]
      );
      vendor = created;
    }

    // ── Log status change ───────────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, 'pending', $3, 'Store setup submitted')`,
      [vendor.id, existing[0]?.status ?? null, req.user.id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Store setup complete! Proceed to verification.",
      vendor: {
        id:           vendor.id,
        store_name:   vendor.store_name,
        store_logo:   vendor.store_logo,
        status:       vendor.status,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// ── POST /api/seller/verify ───────────────────────────────────
export const submitVerification = async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Check vendor exists ─────────────────────────────────
    const { rows: [vendor] } = await client.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    if (!vendor) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Complete store setup first",
      });
    }

    if (!["pending"].includes(vendor.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot submit verification — current status: "${vendor.status}"`,
      });
    }

    // ── Upload docs to Cloudinary ───────────────────────────
    const uploadDoc = async (fieldName, folder) => {
      const file = req.files?.[fieldName]?.[0];
      if (!file) return null;
      return uploadToCloudinary(
        file.buffer,
        folder,
        `${fieldName}_${vendor.id}_${Date.now()}`
      );
    };

    const [id_card_url, business_doc_url, address_proof_url, selfie_url] =
      await Promise.all([
        uploadDoc("id_card",       "vendor_docs/id_cards"),
        uploadDoc("business_doc",  "vendor_docs/business"),
        uploadDoc("address_proof", "vendor_docs/address"),
        uploadDoc("selfie",        "vendor_docs/selfies"),
      ]);

    // ── Require at minimum id_card + selfie ─────────────────
    if (!id_card_url || !selfie_url) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "ID card and selfie are required",
      });
    }

    // ── Upsert verification record ──────────────────────────
    await client.query(
      `INSERT INTO market.vendor_verifications
         (vendor_id, id_card_url, business_doc_url,
          address_proof_url, selfie_url, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       ON CONFLICT (vendor_id) DO UPDATE SET
         id_card_url       = EXCLUDED.id_card_url,
         business_doc_url  = COALESCE(EXCLUDED.business_doc_url, vendor_verifications.business_doc_url),
         address_proof_url = COALESCE(EXCLUDED.address_proof_url, vendor_verifications.address_proof_url),
         selfie_url        = EXCLUDED.selfie_url,
         status            = 'pending',
         verified_at       = NULL,
         updated_at        = NOW()`,
      [vendor.id, id_card_url, business_doc_url, address_proof_url, selfie_url]
    );

    // ── Update vendor status → under_review ────────────────
    await client.query(
      `UPDATE market.vendors
       SET status = 'under_review', updated_at = NOW()
       WHERE id = $1`,
      [vendor.id]
    );

    // ── Log status change ───────────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1, 'pending', 'under_review', $2, 'Verification docs submitted')`,
      [vendor.id, req.user.id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Verification documents submitted! Under review.",
      vendor: {
        id:     vendor.id,
        status: "under_review",
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};