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

// ── Flutterwave axios instance ────────────────────────────────
const flw = () =>
  axios.create({
    baseURL: "https://api.flutterwave.com/v3",
    headers: {
      Authorization: `Bearer ${FLW_KEY()}`,
      "Content-Type": "application/json",
    },
    timeout: 15_000,
  });

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/status
// ════════════════════════════════════════════════════════════
router.get("/status", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.id, v.store_name, v.store_logo, v.store_banner,
         v.store_category, v.store_description,
         v.status, v.rejection_reason, v.suspended_reason,
         v.approved_at, v.activated_at,
         v.products_count, v.total_sales,
         v.total_revenue, v.rating,
         v.withdrawal_method, v.bank_account,
         v.bank_name, v.account_name,
         v.created_at,
         -- Virtual account info
         va.account_number  AS virtual_account_number,
         va.account_name    AS virtual_account_name,
         va.bank_name       AS virtual_bank_name,
         va.available_balance
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
// Fetch Nigerian banks from Flutterwave
// ════════════════════════════════════════════════════════════
router.get("/banks", authenticate, async (req, res) => {
  try {
    const { data } = await flw().get("/banks/NG");

    const banks = (data.data ?? [])
      .map((b) => ({ code: b.code, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ success: true, banks });

  } catch (err) {
    console.error("[banks]", err.response?.data ?? err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch banks",
    });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/seller-onboarding/verify-account
// Verify bank account via Flutterwave
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
      success: false,
      message: "Invalid account number format",
    });
  }

  if (!FLW_KEY()?.startsWith("FLWSECK")) {
    console.error("[verify-account] Invalid or missing FLW_SECRET_KEY");
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

    const msg = err.response?.data?.message ?? "";

    if (err.response?.status === 401) {
      return res.status(500).json({
        success: false,
        message: "Payment service authentication failed. Contact admin.",
      });
    }

    return res.status(400).json({
      success: false,
      message: msg || "Account not found. Check number and bank.",
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

    const {
      store_name, store_description, store_category,
      bank_account, bank_name, bank_code, account_name,
    } = req.body;

    // ── Validate ────────────────────────────────────────────
    if (!store_name?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, message: "Store name is required",
      });
    }

    if (!bank_account?.trim() || !/^\d{6,12}$/.test(bank_account.trim())) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, message: "Valid bank account number is required",
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
        success: false, message: "Verified account name is required",
      });
    }

    // ── Check existing vendor ────────────────────────────────
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

    // ── Check store name ────────────────────────────────────
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
           withdrawal_method = 'bank_transfer',
           bank_account      = $6,
           bank_name         = $7,
           account_name      = $8,
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
          store_logo, store_banner,
          bank_account.trim(),
          bank_name.trim(),
          account_name.trim(),
          req.user.id,
        ]
      );
      vendor = updated;
    } else {
      const { rows: [created] } = await client.query(
        `INSERT INTO market.vendors
           (user_id, store_name, store_description, store_category,
            store_logo, store_banner, withdrawal_method,
            bank_account, bank_name, account_name, status)
         VALUES ($1,$2,$3,$4,$5,$6,'bank_transfer',$7,$8,$9,'pending')
         RETURNING *`,
        [
          req.user.id,
          store_name.trim(),
          store_description?.trim() ?? null,
          store_category            ?? null,
          store_logo, store_banner,
          bank_account.trim(),
          bank_name.trim(),
          account_name.trim(),
        ]
      );
      vendor = created;
    }

    // ── Status log ───────────────────────────────────────────
    await client.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1,$2,'pending',$3,'Store setup submitted')`,
      [vendor.id, oldStatus, req.user.id]
    );

    // ── Create Flutterwave Virtual Account ───────────────────
    // Only create if not reapplying (already has one)
    if (!isReapply) {
      try {
        await createVirtualAccount(client, vendor, req.user, bank_code);
      } catch (vaErr) {
        // Don't fail store setup if virtual account fails
        console.error("[setup-store] virtual account error:", vaErr.message);
      }
    }

    await client.query("COMMIT");

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
    await client.query("ROLLBACK");
    console.error("[setup-store]", {
      message: err.message,
      code:    err.code,
      detail:  err.detail,
    });
    return res.status(500).json({ success: false, message: "Server error" });
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
        message: `Cannot submit — status is "${vendor.status}"`,
      });
    }

    if (!req.files?.id_card?.[0] || !req.files?.selfie?.[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false, message: "ID card and selfie are required",
      });
    }

    const ts = Date.now();
    const [id_card_url, selfie_url, business_doc_url, address_proof_url] =
      await Promise.all([
        uploadToCloudinary(req.files.id_card[0].buffer, "vendor_docs/id_cards", `id_${vendor.id}_${ts}`),
        uploadToCloudinary(req.files.selfie[0].buffer,  "vendor_docs/selfies",  `selfie_${vendor.id}_${ts}`),
        maybeUpload(req.files, "business_doc",  "vendor_docs/business", `biz_${vendor.id}_${ts}`),
        maybeUpload(req.files, "address_proof", "vendor_docs/address",  `addr_${vendor.id}_${ts}`),
      ]);

    await client.query(
      `INSERT INTO market.vendor_verifications
         (vendor_id, id_card_url, selfie_url, business_doc_url, address_proof_url, status)
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
      message: "Verification submitted! Review within 1–3 business days.",
      vendor:  { id: vendor.id, status: "under_review" },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[verify]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
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

    if (rows[0].status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: `Cannot reapply — status: "${rows[0].status}"`,
      });
    }

    await pool.query(
      `UPDATE market.vendors
       SET status = 'pending', rejection_reason = NULL,
           rejected_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [rows[0].id]
    );

    await pool.query(
      `INSERT INTO market.vendor_status_logs
         (vendor_id, old_status, new_status, changed_by, reason)
       VALUES ($1,'rejected','pending',$2,'Seller reapplied')`,
      [rows[0].id, req.user.id]
    );

    return res.json({
      success: true, message: "Reapplication submitted.", status: "pending",
    });

  } catch (err) {
    console.error("[reapply]", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
// HELPER — Create Flutterwave Virtual Account
// ════════════════════════════════════════════════════════════
async function createVirtualAccount(client, vendor, user, bankCode) {
  const orderRef = `VA-${vendor.id}-${Date.now()}`;

  const payload = {
    email:        user.email,
    is_permanent: true,
    bvn:          null,           // add if you collect BVN
    tx_ref:       orderRef,
    amount:       null,           // permanent account — no amount
    currency:     "NGN",
    narration:    `${vendor.store_name} Minimart Store`,
    phonenumber:  user.phone_number ?? "08000000000",
    firstname:    user.name?.split(" ")[0] ?? "Seller",
    lastname:     user.name?.split(" ").slice(1).join(" ") || "Account",
  };

  console.log("[virtual-account] creating for vendor:", vendor.id);

  const { data } = await flw().post("/virtual-account-numbers", payload);

  if (data.status !== "success") {
    throw new Error(data.message ?? "Virtual account creation failed");
  }

  const va = data.data;

  console.log("[virtual-account] created:", va.account_number);

  // Save to DB
  await client.query(
    `INSERT INTO market.vendor_virtual_accounts
       (vendor_id, user_id, flw_account_id, account_number,
        account_name, bank_name, bank_code, order_ref, flw_ref,
        payout_bank_account, payout_bank_name,
        payout_account_name, payout_bank_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (vendor_id) DO UPDATE SET
       account_number = EXCLUDED.account_number,
       account_name   = EXCLUDED.account_name,
       bank_name      = EXCLUDED.bank_name,
       order_ref      = EXCLUDED.order_ref,
       updated_at     = NOW()`,
    [
      vendor.id,
      user.id,
      va.id?.toString()           ?? null,
      va.account_number,
      va.account_name             ?? vendor.store_name,
      va.bank_name                ?? "Wema Bank",
      bankCode                    ?? null,
      orderRef,
      va.flw_ref                  ?? null,
      // Payout = seller's real bank
      vendor.bank_account,
      vendor.bank_name,
      vendor.account_name,
      bankCode,
    ]
  );

  return va;
}

export default router;