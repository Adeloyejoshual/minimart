// routes/sellerOnboarding.routes.js
import express              from "express";
import multer               from "multer";
import axios                from "axios";
import crypto               from "crypto";
import { pool }             from "../server.js";
import { authenticate }     from "../middleware/auth.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier          from "streamifier";

const router  = express.Router();
const FLW_KEY = () => process.env.FLW_SECRET_KEY;

// ── Multer ────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = [
      "image/jpeg", "image/png",
      "image/webp", "application/pdf",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

const storeUpload = upload.fields([
  { name: "store_logo",   maxCount: 1 },
  { name: "store_banner", maxCount: 1 },
]);

const verifyUpload = upload.fields([
  { name: "id_card",       maxCount: 1 },
  { name: "id_card_back",  maxCount: 1 },
  { name: "selfie",        maxCount: 1 },
  { name: "business_doc",  maxCount: 1 },
  { name: "address_proof", maxCount: 1 },
]);

// ── Cloudinary helper ─────────────────────────────────────────
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

// ── Flutterwave client ────────────────────────────────────────
const flw = () =>
  axios.create({
    baseURL: "https://api.flutterwave.com/v3",
    headers: {
      Authorization: `Bearer ${FLW_KEY()}`,
      "Content-Type": "application/json",
    },
    timeout: 15_000,
  });

// ── Hash ID for duplicate check ───────────────────────────────
const hashId = (idNumber) =>
  crypto
    .createHash("sha256")
    .update(idNumber.replace(/\s/g, "").toUpperCase())
    .digest("hex");

// ── Status log — fire and forget ──────────────────────────────
const logStatusChange = (vendorId, oldStatus, newStatus, changedBy, reason) => {
  pool.query(
    `INSERT INTO market.vendor_status_logs
       (vendor_id, old_status, new_status, changed_by, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [vendorId, oldStatus ?? null, newStatus, changedBy ?? null, reason ?? null]
  ).catch((err) => {
    console.warn("[status_log] non-fatal:", err.message);
  });
};

// ─────────────────────────────────────────────────────────────
// ✅ SELLER AUTH GUARD
// Ensures the token belongs to a market.users account ONLY
// Rejects public.users (Gmail/marketplace users)
// ─────────────────────────────────────────────────────────────
const requireSellerAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Check if user exists in market.users
    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM market.users
       WHERE id = $1`,
      [userId]
    );

    if (!rows.length) {
      // User is from public.users (Gmail/marketplace login)
      // NOT allowed to access seller system
      return res.status(403).json({
        success: false,
        code:    "NOT_SELLER_ACCOUNT",
        message:
          "Your account is not registered as a seller account. " +
          "Please create a seller account at /become-seller to continue.",
      });
    }

    const marketUser = rows[0];

    if (marketUser.status !== "active") {
      return res.status(403).json({
        success: false,
        code:    "ACCOUNT_SUSPENDED",
        message: "Your seller account has been suspended",
      });
    }

    // ✅ Attach market.users record to req
    req.sellerUser = marketUser;
    next();

  } catch (err) {
    console.error("[requireSellerAccount]", err.message);
    return res.status(500).json({ success: false, message: "Auth error" });
  }
};

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/status
// ════════════════════════════════════════════════════════════
router.get("/status", authenticate, requireSellerAccount, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.id, v.store_name, v.store_logo, v.store_banner,
         v.store_category, v.store_description,
         v.status, v.rejection_reason, v.suspended_reason,
         v.approved_at, v.activated_at,
         v.products_count, v.total_sales,
         v.total_revenue, v.rating, v.trust_score,
         v.bank_account, v.bank_name,
         v.account_name, v.bank_code,
         v.created_at, v.updated_at,
         va.account_number AS virtual_account_number,
         va.account_name   AS virtual_account_name,
         va.bank_name      AS virtual_bank_name
       FROM market.vendors v
       LEFT JOIN market.vendor_virtual_accounts va
         ON va.vendor_id = v.id
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
    console.error("[status]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/banks
// ════════════════════════════════════════════════════════════
router.get("/banks", authenticate, requireSellerAccount, async (req, res) => {
  try {
    const { data } = await flw().get("/banks/NG");

    const MFB_KEYWORDS = [
      "microfinance", "mfb",
      "opay", "palmpay", "kuda", "moniepoint",
      "9psb", "rubies", "fairmoney", "carbon",
    ];

    const banks = (data.data ?? [])
      .filter((b) => {
        const n = b.name.toLowerCase();
        return !MFB_KEYWORDS.some((kw) => n.includes(kw));
      })
      .map((b)  => ({ code: b.code, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ success: true, banks });

  } catch (err) {
    console.error("[banks]", err.response?.data ?? err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch banks" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/verify-account
// ════════════════════════════════════════════════════════════
router.get("/verify-account", authenticate, requireSellerAccount, async (req, res) => {
  const { account_number, bank_code } = req.query;

  if (!account_number || !bank_code) {
    return res.status(400).json({
      success: false,
      message: "account_number and bank_code are required",
    });
  }

  if (!/^\d{6,12}$/.test(account_number)) {
    return res.status(400).json({
      success: false, message: "Invalid account number format",
    });
  }

  if (!FLW_KEY()?.startsWith("FLWSECK")) {
    return res.status(500).json({
      success: false,
      message: "Payment service not configured. Contact admin.",
    });
  }

  try {
    const { data } = await flw().post("/accounts/resolve", {
      account_number,
      account_bank: bank_code,
    });

    if (data.status !== "success") {
      return res.status(400).json({
        success: false,
        message: data.message ?? "Account not found",
      });
    }

    return res.json({
      success:        true,
      account_name:   data.data.account_name,
      account_number: data.data.account_number,
    });

  } catch (err) {
    console.error("[verify-account]", {
      status:  err.response?.status,
      message: err.response?.data?.message,
    });

    if (err.response?.status === 401) {
      return res.status(500).json({
        success: false,
        message: "Payment service authentication failed.",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.response?.data?.message ?? "Account not found. Check number and bank.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-onboarding/setup-store
// ════════════════════════════════════════════════════════════
router.post("/setup-store", authenticate, requireSellerAccount, storeUpload, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      store_name, store_description, store_category,
      bank_account, bank_name, bank_code, account_name,
    } = req.body;

    console.log("[setup-store] body:", {
      store_name, store_category,
      bank_account, bank_name, bank_code, account_name,
      user_id: req.user.id,
    });

    // ── Validate ─────────────────────────────────────────
    if (!store_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Store name is required" });
    }
    if (!bank_account?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Bank account number is required" });
    }
    if (!bank_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Bank name is required" });
    }
    if (!account_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Please verify your bank account first" });
    }

    // ── Check existing vendor ─────────────────────────────
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
        message: existing[0].status === "pending"
          ? "Store already set up — please proceed to verification"
          : "Store already exists",
        status: existing[0].status,
        vendor: { id: existing[0].id, status: existing[0].status },
      });
    }

    // ── Check store name taken ────────────────────────────
    const { rows: taken } = await client.query(
      `SELECT id FROM market.vendors
       WHERE store_name = $1 AND user_id != $2`,
      [store_name.trim(), req.user.id]
    );

    if (taken.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false, code: "NAME_TAKEN",
        message: "That store name is already taken",
      });
    }

    // ── Upload images ─────────────────────────────────────
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
           withdrawal_method = 'bank_transfer',
           bank_account      = $6,
           bank_name         = $7,
           account_name      = $8,
           bank_code         = $9,
           status            = 'pending',
           rejection_reason  = NULL,
           rejected_at       = NULL,
           updated_at        = NOW()
         WHERE user_id = $10
         RETURNING id, store_name, store_logo, store_banner, status`,
        [
          store_name.trim(),
          store_description?.trim() ?? null,
          store_category            ?? null,
          store_logo, store_banner,
          bank_account.trim(),
          bank_name.trim(),
          account_name.trim(),
          bank_code?.trim()         ?? null,
          req.user.id,
        ]
      );
      vendor = updated;
    } else {
      const { rows: [created] } = await client.query(
        `INSERT INTO market.vendors
           (user_id, store_name, store_description, store_category,
            store_logo, store_banner, withdrawal_method,
            bank_account, bank_name, account_name, bank_code, status)
         VALUES
           ($1, $2, $3, $4, $5, $6, 'bank_transfer',
            $7, $8, $9, $10, 'pending')
         RETURNING id, store_name, store_logo, store_banner, status`,
        [
          req.user.id,
          store_name.trim(),
          store_description?.trim() ?? null,
          store_category            ?? null,
          store_logo, store_banner,
          bank_account.trim(),
          bank_name.trim(),
          account_name.trim(),
          bank_code?.trim()         ?? null,
        ]
      );
      vendor = created;
    }

    await client.query("COMMIT");

    console.log("[setup-store] ✅ vendor saved:", vendor.id);

    logStatusChange(vendor.id, oldStatus, "pending", req.user.id, "Store setup submitted");

    return res.status(201).json({
      success: true,
      message: "Store setup complete! Proceed to verification.",
      vendor: {
        id:         vendor.id,
        store_name: vendor.store_name,
        store_logo: vendor.store_logo,
        status:     vendor.status,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[setup-store] ❌", { message: err.message, code: err.code, detail: err.detail });

    if (err.code === "23503") {
      return res.status(400).json({ success: false, message: `Foreign key error: ${err.detail ?? err.message}` });
    }
    if (err.code === "42703") {
      return res.status(500).json({ success: false, message: `Column missing: ${err.message}` });
    }
    if (err.code === "23505") {
      return res.status(409).json({ success: false, message: "Store name already taken" });
    }

    return res.status(500).json({
      success: false,
      message: err.message ?? "Server error. Please try again.",
    });

  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-onboarding/verify
// ════════════════════════════════════════════════════════════
router.post("/verify", authenticate, requireSellerAccount, verifyUpload, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Complete store setup first" });
    }

    const vendor = rows[0];

    if (vendor.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot submit — current status is "${vendor.status}"`,
      });
    }

    if (!req.files?.id_card?.[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "ID card front photo is required" });
    }

    if (!req.files?.selfie?.[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Selfie with ID is required" });
    }

    const { id_type, id_number, address } = req.body;

    if (!id_type?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "ID type is required" });
    }

    if (!id_number?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "ID number is required" });
    }

    if (!address?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Home address is required" });
    }

    const cleanedId = id_number.replace(/\s/g, "").toUpperCase();

    const ID_DIGITS = { nin: 11, passport: 9, drivers: 12, voters: 19 };

    if (id_type === "passport") {
      if (!/^[A-Z0-9]{9}$/.test(cleanedId)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Invalid passport number (e.g. A12345678)" });
      }
    } else {
      const expected = ID_DIGITS[id_type];
      const actual   = cleanedId.replace(/\D/g, "").length;
      if (expected && actual !== expected) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: `${id_type.toUpperCase()} must be ${expected} digits` });
      }
    }

    const idHash = hashId(cleanedId);

    const { rows: dupRows } = await client.query(
      `SELECT vendor_id FROM market.vendor_verifications
       WHERE id_type = $1 AND id_number_hash = $2 AND vendor_id != $3`,
      [id_type, idHash, vendor.id]
    );

    if (dupRows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        code:    "DUPLICATE_ID",
        message: `This ${id_type.toUpperCase()} is already linked to another account`,
      });
    }

    const ts = Date.now();

    const [
      id_card_url,
      id_card_back_url,
      selfie_url,
      business_doc_url,
      address_proof_url,
    ] = await Promise.all([
      uploadToCloudinary(req.files.id_card[0].buffer, "vendor_docs/id_cards", `id_front_${vendor.id}_${ts}`),
      maybeUpload(req.files, "id_card_back", "vendor_docs/id_cards", `id_back_${vendor.id}_${ts}`),
      uploadToCloudinary(req.files.selfie[0].buffer,  "vendor_docs/selfies",  `selfie_${vendor.id}_${ts}`),
      maybeUpload(req.files, "business_doc",  "vendor_docs/business", `biz_${vendor.id}_${ts}`),
      maybeUpload(req.files, "address_proof", "vendor_docs/address",  `addr_${vendor.id}_${ts}`),
    ]);

    await client.query(
      `INSERT INTO market.vendor_verifications
         (vendor_id, id_card_url, id_card_back_url, selfie_url,
          business_doc_url, address_proof_url,
          id_type, id_number, id_number_hash, seller_address, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
       ON CONFLICT (vendor_id) DO UPDATE SET
         id_card_url       = EXCLUDED.id_card_url,
         id_card_back_url  = COALESCE(EXCLUDED.id_card_back_url,  vendor_verifications.id_card_back_url),
         selfie_url        = EXCLUDED.selfie_url,
         business_doc_url  = COALESCE(EXCLUDED.business_doc_url,  vendor_verifications.business_doc_url),
         address_proof_url = COALESCE(EXCLUDED.address_proof_url, vendor_verifications.address_proof_url),
         id_type           = EXCLUDED.id_type,
         id_number         = EXCLUDED.id_number,
         id_number_hash    = EXCLUDED.id_number_hash,
         seller_address    = EXCLUDED.seller_address,
         status            = 'pending',
         updated_at        = NOW()`,
      [
        vendor.id, id_card_url, id_card_back_url ?? null,
        selfie_url, business_doc_url ?? null, address_proof_url ?? null,
        id_type.trim(), cleanedId, idHash, address.trim(),
      ]
    );

    await client.query(
      `UPDATE market.vendors SET status = 'under_review', updated_at = NOW() WHERE id = $1`,
      [vendor.id]
    );

    await client.query("COMMIT");

    console.log("[verify] ✅ submitted:", vendor.id);

    logStatusChange(vendor.id, "pending", "under_review", req.user.id, "Verification docs submitted");

    return res.json({
      success: true,
      message: "Verification submitted! We'll review within 1–3 business days.",
      vendor:  { id: vendor.id, status: "under_review" },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[verify] ❌", { message: err.message, code: err.code, detail: err.detail });
    return res.status(500).json({
      success: false,
      message: err.message ?? "Server error",
    });
  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-onboarding/reapply
// ════════════════════════════════════════════════════════════
router.post("/reapply", authenticate, requireSellerAccount, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "No vendor account found" });
    }

    const vendor = rows[0];

    if (vendor.status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: `Cannot reapply — current status: "${vendor.status}"`,
      });
    }

    await pool.query(
      `UPDATE market.vendors
       SET status = 'pending', rejection_reason = NULL,
           rejected_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [vendor.id]
    );

    logStatusChange(vendor.id, "rejected", "pending", req.user.id, "Seller reapplied");

    return res.json({ success: true, message: "Reapplication submitted.", status: "pending" });

  } catch (err) {
    console.error("[reapply] ❌", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;