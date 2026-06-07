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

// ─────────────────────────────────────────────────────────────
// MULTER
// ─────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB per file
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
  { name: "id_card",       maxCount: 1 }, // NIN slip front
  { name: "id_card_back",  maxCount: 1 }, // NIN slip back
  { name: "selfie",        maxCount: 1 }, // selfie holding NIN slip
  { name: "business_doc",  maxCount: 1 }, // optional CAC
  { name: "address_proof", maxCount: 1 }, // optional utility bill
]);

// ─────────────────────────────────────────────────────────────
// CLOUDINARY HELPERS
// ─────────────────────────────────────────────────────────────
const uploadToCloudinary = (buffer, folder, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: "auto" },
      (err, result) => {
        if (err) reject(err);
        else     resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

const maybeUpload = async (files, field, folder, id) => {
  const file = files?.[field]?.[0];
  if (!file) return null;
  return uploadToCloudinary(file.buffer, folder, id);
};

// ─────────────────────────────────────────────────────────────
// FLUTTERWAVE CLIENT
// ─────────────────────────────────────────────────────────────
const flw = () =>
  axios.create({
    baseURL: "https://api.flutterwave.com/v3",
    headers: {
      Authorization: `Bearer ${FLW_KEY()}`,
      "Content-Type": "application/json",
    },
    timeout: 15_000,
  });

// ─────────────────────────────────────────────────────────────
// NIN VALIDATION — 11 numeric digits only
// ─────────────────────────────────────────────────────────────
const validateNIN = (rawNin) => {
  if (!rawNin?.trim()) {
    return { valid: false, message: "NIN is required" };
  }
  const cleaned = rawNin.replace(/\s/g, "").replace(/\D/g, "");
  if (cleaned.length !== 11) {
    return {
      valid:   false,
      message: "NIN must be exactly 11 digits",
      cleaned,
    };
  }
  return { valid: true, cleaned };
};

// ─────────────────────────────────────────────────────────────
// HASH NIN for duplicate detection (never store plain NIN)
// ─────────────────────────────────────────────────────────────
const hashNIN = (nin) =>
  crypto
    .createHash("sha256")
    .update(nin.replace(/\s/g, ""))
    .digest("hex");

// ─────────────────────────────────────────────────────────────
// STATUS LOG — fire and forget
// ─────────────────────────────────────────────────────────────
const logStatusChange = (vendorId, oldStatus, newStatus, changedBy, reason) => {
  pool.query(
    `INSERT INTO market.vendor_status_logs
       (vendor_id, old_status, new_status, changed_by, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      vendorId,
      oldStatus   ?? null,
      newStatus,
      changedBy   ?? null,
      reason      ?? null,
    ]
  ).catch((err) => {
    console.warn("[status_log] non-fatal:", err.message);
  });
};

// ─────────────────────────────────────────────────────────────
// SELLER ACCOUNT GUARD
// Confirms token belongs to market.users only
// Rejects public.users (marketplace / Gmail accounts)
// ─────────────────────────────────────────────────────────────
const requireSellerAccount = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM market.users
       WHERE id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(403).json({
        success: false,
        code:    "NOT_SELLER_ACCOUNT",
        message:
          "This route requires a seller account. "
          + "Please register at /become-seller.",
      });
    }

    if (rows[0].status !== "active") {
      return res.status(403).json({
        success: false,
        code:    "ACCOUNT_SUSPENDED",
        message: "Your seller account has been suspended.",
      });
    }

    req.sellerUser = rows[0];
    next();

  } catch (err) {
    console.error("[requireSellerAccount]", err.message);
    return res.status(500).json({
      success: false, message: "Auth error",
    });
  }
};

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/status
// ════════════════════════════════════════════════════════════
router.get(
  "/status",
  authenticate,
  requireSellerAccount,
  async (req, res) => {
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
  }
);

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/banks
// Commercial banks only — no MFBs / fintech wallets
// ════════════════════════════════════════════════════════════
router.get(
  "/banks",
  authenticate,
  requireSellerAccount,
  async (req, res) => {
    try {
      const { data } = await flw().get("/banks/NG");

      const MFB_KEYWORDS = [
        "microfinance", "mfb", "mfbank",
        "opay", "palmpay", "kuda", "moniepoint",
        "9psb", "rubies", "fairmoney", "carbon",
        "piggyvest", "eyowo", "sparkle",
      ];

      const banks = (data.data ?? [])
        .filter((b) => {
          const n = b.name.toLowerCase();
          return !MFB_KEYWORDS.some((kw) => n.includes(kw));
        })
        .map((b) => ({ code: b.code, name: b.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return res.json({ success: true, banks });

    } catch (err) {
      console.error("[banks]", err.response?.data ?? err.message);

      // Return fallback list — don't fail the whole flow
      const FALLBACK = [
        { code: "044", name: "Access Bank"              },
        { code: "023", name: "Citibank"                 },
        { code: "050", name: "EcoBank"                  },
        { code: "070", name: "Fidelity Bank"            },
        { code: "011", name: "First Bank of Nigeria"    },
        { code: "214", name: "First City Monument Bank" },
        { code: "058", name: "Guaranty Trust Bank"      },
        { code: "030", name: "Heritage Bank"            },
        { code: "082", name: "Keystone Bank"            },
        { code: "076", name: "Polaris Bank"             },
        { code: "101", name: "Providus Bank"            },
        { code: "221", name: "Stanbic IBTC Bank"        },
        { code: "068", name: "Standard Chartered"       },
        { code: "232", name: "Sterling Bank"            },
        { code: "032", name: "Union Bank"               },
        { code: "033", name: "United Bank for Africa"   },
        { code: "215", name: "Unity Bank"               },
        { code: "035", name: "Wema Bank"                },
        { code: "057", name: "Zenith Bank"              },
      ];

      return res.json({
        success:  true,
        banks:    FALLBACK,
        fallback: true,
      });
    }
  }
);

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/verify-account
// Verify bank account number via Flutterwave
// ════════════════════════════════════════════════════════════
router.get(
  "/verify-account",
  authenticate,
  requireSellerAccount,
  async (req, res) => {
    const { account_number, bank_code } = req.query;

    // ── Validate inputs ─────────────────────────────────
    if (!account_number?.trim() || !bank_code?.trim()) {
      return res.status(400).json({
        success: false,
        message: "account_number and bank_code are required",
      });
    }

    if (!/^\d{10}$/.test(account_number.trim())) {
      return res.status(400).json({
        success: false,
        message: "Account number must be exactly 10 digits",
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
        account_number: account_number.trim(),
        account_bank:   bank_code.trim(),
      });

      if (data.status !== "success" || !data.data?.account_name) {
        return res.status(400).json({
          success: false,
          message: data.message ?? "Account not found",
        });
      }

      return res.json({
        success:        true,
        account_name:   data.data.account_name,
        account_number: data.data.account_number ?? account_number.trim(),
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
          err.response?.data?.message
          ?? "Account not found. Please check the number and bank.",
      });
    }
  }
);

// ════════════════════════════════════════════════════════════
// POST /api/seller-onboarding/setup-store
// ════════════════════════════════════════════════════════════
router.post(
  "/setup-store",
  authenticate,
  requireSellerAccount,
  storeUpload,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

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
        store_name, store_category,
        bank_account, bank_name, bank_code,
        account_name: account_name ? "[present]" : "[missing]",
        user_id: req.user.id,
      });

      // ── Validate required fields ──────────────────────
      const required = [
        [store_name?.trim(),    "Store name is required"],
        [bank_account?.trim(),  "Bank account number is required"],
        [bank_name?.trim(),     "Bank name is required"],
        [account_name?.trim(),  "Please verify your bank account first"],
      ];

      for (const [val, msg] of required) {
        if (!val) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, message: msg });
        }
      }

      // ── Validate bank account is 10 digits ────────────
      if (!/^\d{10}$/.test(bank_account.trim())) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Bank account number must be exactly 10 digits",
        });
      }

      // ── Check existing vendor ─────────────────────────
      const { rows: existing } = await client.query(
        `SELECT id, status FROM market.vendors WHERE user_id = $1`,
        [req.user.id]
      );

      const isReapply = existing.length
        && existing[0].status === "rejected";

      if (existing.length && !isReapply) {
        await client.query("ROLLBACK");
        const v = existing[0];
        return res.status(409).json({
          success: false,
          code:    "VENDOR_EXISTS",
          message: v.status === "pending"
            ? "Store already set up — please proceed to verification"
            : v.status === "under_review"
              ? "Your store is under review"
              : "Store already exists",
          status: v.status,
          vendor: { id: v.id, status: v.status },
        });
      }

      // ── Check store name not taken ────────────────────
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

      // ── Upload images ─────────────────────────────────
      const [store_logo_url, store_banner_url] = await Promise.all([
        maybeUpload(
          req.files, "store_logo",
          "vendor_logos",   `logo_${req.user.id}`
        ),
        maybeUpload(
          req.files, "store_banner",
          "vendor_banners", `banner_${req.user.id}`
        ),
      ]);

      const oldStatus = existing[0]?.status ?? null;
      let vendor;

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
            store_logo_url,
            store_banner_url,
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
              bank_account, bank_name, account_name, bank_code,
              status)
           VALUES
             ($1,$2,$3,$4,$5,$6,'bank_transfer',$7,$8,$9,$10,'pending')
           RETURNING id, store_name, store_logo, store_banner, status`,
          [
            req.user.id,
            store_name.trim(),
            store_description?.trim() ?? null,
            store_category            ?? null,
            store_logo_url,
            store_banner_url,
            bank_account.trim(),
            bank_name.trim(),
            account_name.trim(),
            bank_code?.trim()         ?? null,
          ]
        );
        vendor = created;
      }

      await client.query("COMMIT");

      console.log("[setup-store] ✅ saved:", vendor.id);

      logStatusChange(
        vendor.id, oldStatus, "pending",
        req.user.id, "Store setup submitted"
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
      });

      if (err.code === "23505") {
        return res.status(409).json({
          success: false, message: "Store name already taken",
        });
      }
      if (err.code === "23503") {
        return res.status(400).json({
          success: false,
          message: `Reference error: ${err.detail ?? err.message}`,
        });
      }

      return res.status(500).json({
        success: false,
        message: err.message ?? "Server error. Please try again.",
      });

    } finally {
      client.release();
    }
  }
);

// ════════════════════════════════════════════════════════════
// POST /api/seller-onboarding/verify
// NIN-ONLY verification
// ════════════════════════════════════════════════════════════
router.post(
  "/verify",
  authenticate,
  requireSellerAccount,
  verifyUpload,
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ── Vendor must exist and be pending ─────────────
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
          message: `Cannot submit — current status is "${vendor.status}"`,
        });
      }

      // ── Required documents ────────────────────────────
      if (!req.files?.id_card?.[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "NIN slip front photo is required",
        });
      }

      if (!req.files?.id_card_back?.[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "NIN slip back photo is required",
        });
      }

      if (!req.files?.selfie?.[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Selfie holding NIN slip is required",
        });
      }

      // ── Extract text fields ───────────────────────────
      const { id_type, id_number, address } = req.body;

      // ── Enforce NIN only ──────────────────────────────
      if (!id_type?.trim() || id_type.trim().toLowerCase() !== "nin") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Only NIN verification is accepted at this time",
        });
      }

      if (!address?.trim()) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Home address is required",
        });
      }

      // ── Validate NIN ──────────────────────────────────
      const ninResult = validateNIN(id_number);
      if (!ninResult.valid) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: ninResult.message,
        });
      }

      const cleanedNIN = ninResult.cleaned;

      // ── Duplicate NIN check ───────────────────────────
      const ninHash = hashNIN(cleanedNIN);

      const { rows: dupRows } = await client.query(
        `SELECT vendor_id
         FROM market.vendor_verifications
         WHERE id_type = 'nin'
           AND id_number_hash = $1
           AND vendor_id != $2`,
        [ninHash, vendor.id]
      );

      if (dupRows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          code:    "DUPLICATE_NIN",
          message: "This NIN is already linked to another seller account. Contact support if this is an error.",
        });
      }

      // ── Upload documents in parallel ──────────────────
      const ts = Date.now();

      const [
        id_card_url,
        id_card_back_url,
        selfie_url,
        business_doc_url,
        address_proof_url,
      ] = await Promise.all([
        uploadToCloudinary(
          req.files.id_card[0].buffer,
          "vendor_docs/nin_slips",
          `nin_front_${vendor.id}_${ts}`
        ),
        uploadToCloudinary(
          req.files.id_card_back[0].buffer,
          "vendor_docs/nin_slips",
          `nin_back_${vendor.id}_${ts}`
        ),
        uploadToCloudinary(
          req.files.selfie[0].buffer,
          "vendor_docs/selfies",
          `selfie_${vendor.id}_${ts}`
        ),
        maybeUpload(
          req.files, "business_doc",
          "vendor_docs/business",
          `cac_${vendor.id}_${ts}`
        ),
        maybeUpload(
          req.files, "address_proof",
          "vendor_docs/address",
          `addr_${vendor.id}_${ts}`
        ),
      ]);

      // ── Upsert verification record ────────────────────
      await client.query(
        `INSERT INTO market.vendor_verifications
           (vendor_id,
            id_card_url, id_card_back_url, selfie_url,
            business_doc_url, address_proof_url,
            id_type, id_number, id_number_hash,
            seller_address, status)
         VALUES ($1,$2,$3,$4,$5,$6,'nin',$7,$8,$9,'pending')
         ON CONFLICT (vendor_id) DO UPDATE SET
           id_card_url       = EXCLUDED.id_card_url,
           id_card_back_url  = EXCLUDED.id_card_back_url,
           selfie_url        = EXCLUDED.selfie_url,
           business_doc_url  = COALESCE(
             EXCLUDED.business_doc_url,
             vendor_verifications.business_doc_url
           ),
           address_proof_url = COALESCE(
             EXCLUDED.address_proof_url,
             vendor_verifications.address_proof_url
           ),
           id_type           = 'nin',
           id_number         = EXCLUDED.id_number,
           id_number_hash    = EXCLUDED.id_number_hash,
           seller_address    = EXCLUDED.seller_address,
           status            = 'pending',
           updated_at        = NOW()`,
        [
          vendor.id,
          id_card_url,
          id_card_back_url,
          selfie_url,
          business_doc_url   ?? null,
          address_proof_url  ?? null,
          cleanedNIN,        // stored (can be hashed at rest by DB)
          ninHash,           // sha256 hash for dedup
          address.trim(),
        ]
      );

      // ── Advance vendor to under_review ────────────────
      await client.query(
        `UPDATE market.vendors
         SET status     = 'under_review',
             updated_at = NOW()
         WHERE id = $1`,
        [vendor.id]
      );

      await client.query("COMMIT");

      console.log("[verify] ✅ NIN submitted for vendor:", vendor.id);

      logStatusChange(
        vendor.id, "pending", "under_review",
        req.user.id, "NIN verification submitted"
      );

      return res.json({
        success: true,
        message:
          "Verification submitted! "
          + "We'll review your application within 1–3 business days.",
        vendor: { id: vendor.id, status: "under_review" },
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[verify] ❌", {
        message: err.message,
        code:    err.code,
        detail:  err.detail,
      });

      if (err.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This NIN has already been submitted.",
        });
      }

      return res.status(500).json({
        success: false,
        message: err.message ?? "Server error. Please try again.",
      });

    } finally {
      client.release();
    }
  }
);

// ════════════════════════════════════════════════════════════
// POST /api/seller-onboarding/reapply
// ════════════════════════════════════════════════════════════
router.post(
  "/reapply",
  authenticate,
  requireSellerAccount,
  async (req, res) => {
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
          message:
            `Cannot reapply — current status: "${vendor.status}"`,
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
        message: "Reapplication submitted. Please redo your verification.",
        status:  "pending",
      });

    } catch (err) {
      console.error("[reapply] ❌", err.message);
      return res.status(500).json({
        success: false, message: "Server error",
      });
    }
  }
);

export default router;