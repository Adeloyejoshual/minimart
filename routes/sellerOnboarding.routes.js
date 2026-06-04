// routes/sellerOnboarding.routes.js
import express              from "express";
import multer               from "multer";
import axios                from "axios";
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
// KEY HELPER: Ensure user exists in market.users
// Handles users who registered via the old routes/users.js
// which only inserts into public.users
// ─────────────────────────────────────────────────────────────
const ensureUserInMarket = async (client, userId) => {
  // Check market.users first
  const { rows: existing } = await client.query(
    `SELECT id FROM market.users WHERE id = $1`,
    [userId]
  );

  if (existing.length) {
    return; // Already in market.users — all good
  }

  console.log("[ensureUserInMarket] user not in market.users, syncing:", userId);

  // Fetch from public.users
  const { rows: pubRows } = await client.query(
    `SELECT
       id, name, email, password_hash,
       phone_number, status, created_at
     FROM public.users
     WHERE id = $1`,
    [userId]
  );

  if (!pubRows.length) {
    throw new Error(
      `User ${userId} not found in public.users or market.users`
    );
  }

  const u = pubRows[0];

  // Validate status matches market.users CHECK constraint
  const validStatuses = ["active", "suspended", "banned"];
  const safeStatus    = validStatuses.includes(u.status)
    ? u.status
    : "active";

  // Insert into market.users with SAME UUID
  await client.query(
    `INSERT INTO market.users
       (id, name, email, password_hash,
        phone_number, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      u.id,
      u.name,
      u.email,
      u.password_hash,
      u.phone_number ?? null,
      safeStatus,
      u.created_at,
    ]
  );

  console.log("[ensureUserInMarket] ✅ synced:", userId);
};

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/status
// ════════════════════════════════════════════════════════════
router.get("/status", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.id,
         v.store_name,
         v.store_logo,
         v.store_banner,
         v.store_category,
         v.store_description,
         v.status,
         v.rejection_reason,
         v.suspended_reason,
         v.approved_at,
         v.activated_at,
         v.products_count,
         v.total_sales,
         v.total_revenue,
         v.rating,
         v.trust_score,
         v.bank_account,
         v.bank_name,
         v.account_name,
         v.bank_code,
         v.created_at,
         v.updated_at,
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
    return res.status(500).json({
      success: false, message: "Server error",
    });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/banks
// ════════════════════════════════════════════════════════════
router.get("/banks", authenticate, async (req, res) => {
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
    return res.status(500).json({
      success: false, message: "Failed to fetch banks",
    });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/verify-account
// ════════════════════════════════════════════════════════════
router.get("/verify-account", authenticate, async (req, res) => {
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
      message:
        err.response?.data?.message ??
        "Account not found. Check number and bank.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/seller-onboarding/setup-store
// ════════════════════════════════════════════════════════════
router.post("/setup-store", authenticate, storeUpload, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ✅ KEY FIX: sync user to market.users before vendor insert
    // Handles users who registered via old routes/users.js
    await ensureUserInMarket(client, req.user.id);

    const {
      store_name,
      store_description,
      store_category,
      bank_account,
      bank_name,
      bank_code,
      account_name,
    } = req.body;

    console.log("[setup-store] body:", {
      store_name,
      store_category,
      bank_account,
      bank_name,
      bank_code,
      account_name,
      user_id: req.user.id,
    });

    // ── Validate ─────────────────────────────────────────
    if (!store_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, message: "Store name is required",
      });
    }
    if (!bank_account?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, message: "Bank account number is required",
      });
    }
    if (!bank_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, message: "Bank name is required",
      });
    }
    if (!account_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Please verify your bank account first",
      });
    }

    // ── Check existing vendor ─────────────────────────────
    const { rows: existing } = await client.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    const isReapply =
      existing.length && existing[0].status === "rejected";

    if (existing.length && !isReapply) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        code:    "VENDOR_EXISTS",
        message: "Store already exists",
        status:  existing[0].status,
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
        success: false,
        code:    "NAME_TAKEN",
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
         RETURNING
           id, store_name, store_logo, store_banner, status`,
        [
          store_name.trim(),
          store_description?.trim() ?? null,
          store_category            ?? null,
          store_logo,
          store_banner,
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
           (user_id,
            store_name,
            store_description,
            store_category,
            store_logo,
            store_banner,
            withdrawal_method,
            bank_account,
            bank_name,
            account_name,
            bank_code,
            status)
         VALUES
           ($1, $2, $3, $4, $5, $6,
            'bank_transfer',
            $7, $8, $9, $10,
            'pending')
         RETURNING
           id, store_name, store_logo, store_banner, status`,
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
          bank_code?.trim()         ?? null,
        ]
      );
      vendor = created;
    }

    // ── COMMIT vendor ─────────────────────────────────────
    await client.query("COMMIT");

    console.log("[setup-store] ✅ vendor saved:", vendor.id);

    // ── Status log — fire and forget AFTER commit ─────────
    logStatusChange(
      vendor.id,
      oldStatus,
      "pending",
      req.user.id,
      "Store setup submitted"
    );

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

    console.error("[setup-store] ❌", {
      message: err.message,
      code:    err.code,
      detail:  err.detail,
      hint:    err.hint,
    });

    if (err.code === "23503") {
      return res.status(400).json({
        success: false,
        message: `Foreign key error: ${err.detail ?? err.message}`,
      });
    }
    if (err.code === "42703") {
      return res.status(500).json({
        success: false,
        message: `Column missing: ${err.message}`,
      });
    }
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Store name already taken",
      });
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
        success: false, message: "Complete store setup first",
      });
    }

    const vendor = rows[0];

    if (vendor.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Cannot submit — current status is "${vendor.status}"`,
      });
    }

    if (!req.files?.id_card?.[0] || !req.files?.selfie?.[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, message: "ID card and selfie are required",
      });
    }

    const ts = Date.now();

    const [
      id_card_url,
      selfie_url,
      business_doc_url,
      address_proof_url,
    ] = await Promise.all([
      uploadToCloudinary(
        req.files.id_card[0].buffer,
        "vendor_docs/id_cards",
        `id_${vendor.id}_${ts}`
      ),
      uploadToCloudinary(
        req.files.selfie[0].buffer,
        "vendor_docs/selfies",
        `selfie_${vendor.id}_${ts}`
      ),
      maybeUpload(req.files, "business_doc",
        "vendor_docs/business", `biz_${vendor.id}_${ts}`),
      maybeUpload(req.files, "address_proof",
        "vendor_docs/address",  `addr_${vendor.id}_${ts}`),
    ]);

    await client.query(
      `INSERT INTO market.vendor_verifications
         (vendor_id, id_card_url, selfie_url,
          business_doc_url, address_proof_url, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (vendor_id) DO UPDATE SET
         id_card_url       = EXCLUDED.id_card_url,
         selfie_url        = EXCLUDED.selfie_url,
         business_doc_url  = COALESCE(
                               EXCLUDED.business_doc_url,
                               vendor_verifications.business_doc_url),
         address_proof_url = COALESCE(
                               EXCLUDED.address_proof_url,
                               vendor_verifications.address_proof_url),
         status            = 'pending',
         updated_at        = NOW()`,
      [vendor.id, id_card_url, selfie_url,
       business_doc_url, address_proof_url]
    );

    await client.query(
      `UPDATE market.vendors
       SET status = 'under_review', updated_at = NOW()
       WHERE id = $1`,
      [vendor.id]
    );

    await client.query("COMMIT");

    console.log("[verify] ✅ submitted:", vendor.id);

    logStatusChange(
      vendor.id, "pending", "under_review",
      req.user.id, "Verification docs submitted"
    );

    return res.json({
      success: true,
      message: "Verification submitted! We'll review within 1–3 business days.",
      vendor:  { id: vendor.id, status: "under_review" },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[verify] ❌", { message: err.message, code: err.code });
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
router.post("/reapply", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status FROM market.vendors WHERE user_id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false, message: "No vendor account found",
      });
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
       SET status           = 'pending',
           rejection_reason = NULL,
           rejected_at      = NULL,
           updated_at       = NOW()
       WHERE id = $1`,
      [vendor.id]
    );

    logStatusChange(
      vendor.id, "rejected", "pending",
      req.user.id, "Seller reapplied"
    );

    console.log("[reapply] ✅ vendor:", vendor.id);

    return res.json({
      success: true,
      message: "Reapplication submitted.",
      status:  "pending",
    });

  } catch (err) {
    console.error("[reapply] ❌", err.message);
    return res.status(500).json({
      success: false, message: "Server error",
    });
  }
});

export default router;