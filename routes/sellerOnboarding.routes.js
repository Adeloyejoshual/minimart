// routes/sellerOnboarding.routes.js
import express              from "express";
import multer               from "multer";
import { pool }             from "../server.js";
import { authenticate }     from "../middleware/auth.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier          from "streamifier";

const router = express.Router();

// ── Multer memory storage ──────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const storeUpload = upload.fields([
  { name: "store_logo",   maxCount: 1 },
  { name: "store_banner", maxCount: 1 },
]);

const verifyUpload = upload.fields([
  { name: "id_card",       maxCount: 1 },
  { name: "selfie",        maxCount: 1 },
  { name: "business_doc",  maxCount: 1 },
  { name: "address_proof", maxCount: 1 },
]);

// ── Cloudinary upload helper ───────────────────────────────────
const uploadToCloudinary = (buffer, folder, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: "auto" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

const maybeUpload = async (files, field, folder, id) => {
  const file = files?.[field]?.[0];
  if (!file) return null;
  return uploadToCloudinary(file.buffer, folder, id);
};

// ════════════════════════════════════════════════
// GET /api/seller-onboarding/status
// ════════════════════════════════════════════════
router.get("/status", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.id, v.store_name, v.store_logo, v.store_banner,
         v.store_category, v.store_description,
         v.status, v.rejection_reason, v.suspended_reason,
         v.approved_at, v.activated_at,
         v.products_count, v.total_sales,
         v.total_revenue, v.rating, v.created_at
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

    return res.json({ success: true, vendor: rows[0] });

  } catch (err) {
    console.error("[vendor status error]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════
// POST /api/seller-onboarding/setup-store
// ════════════════════════════════════════════════
router.post("/setup-store", authenticate, storeUpload, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      store_name, store_description, store_category,
      withdrawal_method, bank_account, paypal_email, crypto_wallet,
    } = req.body;

    if (!store_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Store name is required",
      });
    }

    // ── Check existing vendor ────────────────────────────────
    const { rows: existing } = await client.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    const isReapply = existing.length && existing[0].status === "rejected";

    if (existing.length && !isReapply) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        code:    "VENDOR_EXISTS",
        message: "Store already exists",
        status:  existing[0].status,
      });
    }

    // ── Check store name taken ───────────────────────────────
    const { rows: taken } = await client.query(
      `SELECT id FROM market.vendors
       WHERE store_name = $1 AND user_id != $2`,
      [store_name.trim(), req.user.id]
    );

    if (taken.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        code:    "NAME_TAKEN",
        message: "That store name is already taken",
      });
    }

    // ── Upload images ────────────────────────────────────────
    const [store_logo, store_banner] = await Promise.all([
      maybeUpload(req.files, "store_logo",   "vendor_logos",   `logo_${req.user.id}`),
      maybeUpload(req.files, "store_banner", "vendor_banners", `banner_${req.user.id}`),
    ]);

    let vendor;
    const oldStatus = existing[0]?.status ?? null;

    if (isReapply) {
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
           updated_at        = NOW()
         WHERE user_id = $10
         RETURNING *`,
        [
          store_name.trim(),
          store_description?.trim() ?? null,
          store_category            ?? null,
          store_logo,
          store_banner,
          withdrawal_method         ?? null,
          bank_account?.trim()      ?? null,
          paypal_email?.trim()      ?? null,
          crypto_wallet?.trim()     ?? null,
          req.user.id,
        ]
      );
      vendor = updated;
    } else {
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
          store_description?.trim() ?? null,
          store_category            ?? null,
          store_logo,
          store_banner,
          withdrawal_method         ?? null,
          bank_account?.trim()      ?? null,
          paypal_email?.trim()      ?? null,
          crypto_wallet?.trim()     ?? null,
        ]
      );
      vendor = created;
    }

    // ── Status log ───────────────────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, 'pending', $3, 'Store setup submitted')`,
      [vendor.id, oldStatus, req.user.id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Store setup complete!",
      vendor: {
        id:         vendor.id,
        store_name: vendor.store_name,
        store_logo: vendor.store_logo,
        status:     vendor.status,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[setup-store error]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════
// POST /api/seller-onboarding/verify
// ════════════════════════════════════════════════
router.post("/verify", authenticate, verifyUpload, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Complete store setup first",
      });
    }

    const vendor = rows[0];

    if (vendor.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot submit verification — status is "${vendor.status}"`,
      });
    }

    if (!req.files?.id_card?.[0] || !req.files?.selfie?.[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "ID card and selfie are required",
      });
    }

    const ts = Date.now();

    const [id_card_url, selfie_url, business_doc_url, address_proof_url] =
      await Promise.all([
        uploadToCloudinary(req.files.id_card[0].buffer,  "vendor_docs/id_cards", `id_${vendor.id}_${ts}`),
        uploadToCloudinary(req.files.selfie[0].buffer,   "vendor_docs/selfies",  `selfie_${vendor.id}_${ts}`),
        maybeUpload(req.files, "business_doc",  "vendor_docs/business", `biz_${vendor.id}_${ts}`),
        maybeUpload(req.files, "address_proof", "vendor_docs/address",  `addr_${vendor.id}_${ts}`),
      ]);

    await client.query(
      `INSERT INTO market.vendor_verifications
         (vendor_id, id_card_url, selfie_url,
          business_doc_url, address_proof_url, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       ON CONFLICT (vendor_id) DO UPDATE SET
         id_card_url       = EXCLUDED.id_card_url,
         selfie_url        = EXCLUDED.selfie_url,
         business_doc_url  = COALESCE(EXCLUDED.business_doc_url,  vendor_verifications.business_doc_url),
         address_proof_url = COALESCE(EXCLUDED.address_proof_url, vendor_verifications.address_proof_url),
         status            = 'pending',
         updated_at        = NOW()`,
      [vendor.id, id_card_url, selfie_url, business_doc_url, address_proof_url]
    );

    await client.query(
      `UPDATE market.vendors
       SET status = 'under_review', updated_at = NOW()
       WHERE id = $1`,
      [vendor.id]
    );

    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1,'pending','under_review',$2,'Verification submitted')`,
      [vendor.id, req.user.id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Verification submitted! We'll review within 1–3 business days.",
      vendor:  { id: vendor.id, status: "under_review" },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[verify error]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════
// POST /api/seller-onboarding/reapply
// ════════════════════════════════════════════════
router.post("/reapply", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No vendor account found",
      });
    }

    if (rows[0].status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: `Cannot reapply — current status: "${rows[0].status}"`,
      });
    }

    await pool.query(
      `UPDATE market.vendors
       SET status = 'pending', rejection_reason = NULL, updated_at = NOW()
       WHERE id = $1`,
      [rows[0].id]
    );

    return res.json({
      success: true,
      message: "Reapplication submitted.",
      status:  "pending",
    });

  } catch (err) {
    console.error("[reapply error]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;