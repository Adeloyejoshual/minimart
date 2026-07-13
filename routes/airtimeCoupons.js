// routes/airtimeCoupons.js
import express      from "express";
import crypto       from "crypto";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";
import adminAuth    from "../middleware/adminAuth.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const OTP_TTL_MINUTES      = 10;
const OTP_MAX_ATTEMPTS     = 5;
const CHANGE_COOLDOWN_DAYS = 60;

/* ── Single source of truth for all valid statuses ── */
const AIRTIME_STATUS = Object.freeze({
  AVAILABLE  : "available",
  REDEEMED   : "redeemed",
  PROCESSING : "processing",
  COMPLETED  : "completed",
  FAILED     : "failed",
});

/* ── Valid admin status transitions ── */
const ADMIN_TRANSITIONS = Object.freeze({
  [AIRTIME_STATUS.REDEEMED]   : [AIRTIME_STATUS.PROCESSING, AIRTIME_STATUS.FAILED],
  [AIRTIME_STATUS.PROCESSING] : [AIRTIME_STATUS.COMPLETED,  AIRTIME_STATUS.FAILED],
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

const generateOtp = () =>
  crypto.randomInt(100_000, 999_999).toString();

const normalizePhone = (raw) => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return "+" + digits;
  if (digits.startsWith("0"))   return "+234" + digits.slice(1);
  return "+" + digits;
};

const isValidNigerianPhone = (normalized) =>
  /^\+234[789][01]\d{8}$/.test(normalized);

const maskPhone = (phone) => {
  if (!phone) return null;
  const local = phone.replace("+234", "0");
  return local.slice(0, 4) + "****" + local.slice(-3);
};

const daysSince = (date) =>
  Math.floor((Date.now() - new Date(date)) / 86_400_000);

/* ── Nigerian network detection ── */
const PREFIX_MAP = Object.freeze({
  /* MTN */
  "0703": "MTN", "0706": "MTN", "0803": "MTN", "0806": "MTN",
  "0810": "MTN", "0813": "MTN", "0814": "MTN", "0816": "MTN",
  "0903": "MTN", "0906": "MTN", "0913": "MTN", "0916": "MTN",
  /* Airtel */
  "0701": "Airtel", "0708": "Airtel", "0802": "Airtel", "0808": "Airtel",
  "0812": "Airtel", "0901": "Airtel", "0902": "Airtel", "0904": "Airtel",
  "0907": "Airtel", "0912": "Airtel",
  /* Glo */
  "0705": "Glo", "0805": "Glo", "0807": "Glo", "0811": "Glo",
  "0815": "Glo", "0905": "Glo", "0915": "Glo",
  /* 9mobile */
  "0809": "9mobile", "0817": "9mobile", "0818": "9mobile",
  "0908": "9mobile", "0909": "9mobile",
});

const detectNetwork = (phone) => {
  const local   = phone.replace("+234", "0");
  const prefix  = local.slice(0, 4);
  const network = PREFIX_MAP[prefix];
  if (!network) throw new Error(`Unrecognized network prefix: ${prefix}`);
  return network;
};

/* ── Build the CHECK constraint string from AIRTIME_STATUS ──
 *
 * Keeps the constraint and the constant in sync automatically.
 * If you add a new status to AIRTIME_STATUS it is immediately
 * reflected in the DB constraint without editing two places.
 */
const STATUS_CHECK = Object.values(AIRTIME_STATUS)
  .map((s) => `'${s}'`)
  .join(", ");
// → 'available', 'redeemed', 'processing', 'completed', 'failed'

/* ═══════════════════════════════════════════════════════════════
   ENSURE TABLES + INDEXES
═══════════════════════════════════════════════════════════════ */
async function ensureTables() {

  /* ── Phone columns on users ── */
  await pool.query(`
    ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS phone             TEXT        NULL,
    ADD COLUMN IF NOT EXISTS phone_verified    BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS phone_changed_at  TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS phone_network     TEXT        NULL
  `);

  /* One phone number per account */
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_users_phone
    ON public.users (phone)
    WHERE phone IS NOT NULL
  `);

  /* ── OTP table ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.phone_otps (
      id         UUID        NOT NULL DEFAULT gen_random_uuid(),
      user_id    UUID        NOT NULL,
      phone      TEXT        NOT NULL,
      otp        TEXT        NOT NULL,
      purpose    TEXT        NOT NULL DEFAULT 'verify',
      attempts   INT2        NOT NULL DEFAULT 0,
      used       BOOLEAN     NOT NULL DEFAULT false,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT phone_otps_pkey PRIMARY KEY (id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_otps_user
    ON public.phone_otps (user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_otps_expires
    ON public.phone_otps (expires_at)
  `);

  /* ── Airtime coupons ── */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.airtime_coupons (
      id           UUID        NOT NULL DEFAULT gen_random_uuid(),
      code         TEXT        NOT NULL,
      amount       DECIMAL     NOT NULL,
      user_id      UUID        NULL,
      status       TEXT        NOT NULL DEFAULT '${AIRTIME_STATUS.AVAILABLE}'
                               CHECK (status IN (${STATUS_CHECK})),
      redeemed_by  UUID        NULL,
      redeemed_at  TIMESTAMPTZ NULL,
      phone        TEXT        NULL,
      network      TEXT        NULL,
      processed_by UUID        NULL,
      processed_at TIMESTAMPTZ NULL,
      admin_note   TEXT        NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT airtime_coupons_pkey PRIMARY KEY (id)
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_airtime_code
    ON public.airtime_coupons (code)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_airtime_user
    ON public.airtime_coupons (user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_airtime_status
    ON public.airtime_coupons (status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_airtime_redeemed_by
    ON public.airtime_coupons (redeemed_by)
  `);
}

ensureTables().catch((err) =>
  console.warn("[airtime-coupons] table init:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   PHONE VERIFICATION
═══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────
   GET /api/airtime-coupons/phone-status
────────────────────────────────────────────────────────────── */
router.get("/phone-status", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         phone,
         phone_verified,
         phone_verified_at,
         phone_changed_at,
         phone_network
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const u = rows[0];

    const canChange = !u.phone_changed_at ||
      daysSince(u.phone_changed_at) >= CHANGE_COOLDOWN_DAYS;

    const daysUntilChange = u.phone_changed_at
      ? Math.max(0, CHANGE_COOLDOWN_DAYS - daysSince(u.phone_changed_at))
      : 0;

    return res.json({
      success: true,
      phone: {
        masked            : maskPhone(u.phone),
        verified          : u.phone_verified   || false,
        network           : u.phone_network    || null,
        verified_at       : u.phone_verified_at,
        can_change        : canChange,
        days_until_change : daysUntilChange,
      },
    });

  } catch (err) {
    console.error("[airtime-coupons] GET /phone-status:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /api/airtime-coupons/send-otp
   Body: { phone, purpose }   purpose = "verify" | "change"
────────────────────────────────────────────────────────────── */
router.post("/send-otp", authenticate, async (req, res) => {
  const { phone, purpose = "verify" } = req.body;
  const userId = req.user.id;

  if (!phone?.trim()) {
    return res.status(400).json({ success: false, message: "Phone number is required." });
  }

  const normalized = normalizePhone(phone.trim());

  if (!isValidNigerianPhone(normalized)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid Nigerian phone number (e.g. 0803 123 4567).",
    });
  }

  /* ── Reject unrecognized prefix early ── */
  try {
    detectNetwork(normalized);
  } catch {
    return res.status(400).json({
      success: false,
      message: "This phone number has an unrecognized network prefix.",
    });
  }

  try {
    /* ── Already linked to a different account? ── */
    const { rows: conflict } = await pool.query(
      `SELECT id FROM public.users
       WHERE phone          = $1
         AND phone_verified = true
         AND id            != $2
       LIMIT 1`,
      [normalized, userId]
    );

    if (conflict.length) {
      return res.status(409).json({
        success: false,
        message: "This phone number is already linked to another Loemart account.",
      });
    }

    /* ── 60-day cooldown for change requests ── */
    if (purpose === "change") {
      const { rows: userRows } = await pool.query(
        `SELECT phone_changed_at FROM public.users WHERE id = $1 LIMIT 1`,
        [userId]
      );

      const changedAt = userRows[0]?.phone_changed_at;

      if (changedAt && daysSince(changedAt) < CHANGE_COOLDOWN_DAYS) {
        const daysLeft = CHANGE_COOLDOWN_DAYS - daysSince(changedAt);
        return res.status(429).json({
          success        : false,
          message        : `You can change your phone number in ${daysLeft} day(s).`,
          days_remaining : daysLeft,
        });
      }
    }

    /* ── Invalidate all previous unused OTPs for this user + purpose ── */
    await pool.query(
      `UPDATE public.phone_otps
       SET used = true
       WHERE user_id = $1
         AND purpose = $2
         AND used    = false`,
      [userId, purpose]
    );

    /* ── Generate and store new OTP ── */
    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

    await pool.query(
      `INSERT INTO public.phone_otps
         (user_id, phone, otp, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, normalized, otp, purpose, expiresAt]
    );

    /*
     * ── SMS delivery ──
     * await smsProvider.send({
     *   to     : normalized,
     *   message: `Your Loemart code is ${otp}. Valid for ${OTP_TTL_MINUTES} minutes. Do not share it.`,
     * });
     */
    if (process.env.NODE_ENV !== "production") {
      console.log(`[OTP DEV] ${normalized} → ${otp}`);
    }

    return res.json({
      success    : true,
      message    : `OTP sent to ${maskPhone(normalized)}.`,
      masked     : maskPhone(normalized),
      expires_in : OTP_TTL_MINUTES * 60,
    });

  } catch (err) {
    console.error("[airtime-coupons] POST /send-otp:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send OTP. Try again." });
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /api/airtime-coupons/verify-otp
   Body: { phone, otp, purpose }
────────────────────────────────────────────────────────────── */
router.post("/verify-otp", authenticate, async (req, res) => {
  const { phone, otp, purpose = "verify" } = req.body;
  const userId = req.user.id;

  if (!phone?.trim() || !otp?.trim()) {
    return res.status(400).json({ success: false, message: "Phone and OTP are required." });
  }

  const normalized = normalizePhone(phone.trim());

  try {
    /* ── Find the latest valid OTP ── */
    const { rows } = await pool.query(
      `SELECT id, otp, attempts
       FROM public.phone_otps
       WHERE user_id    = $1
         AND phone      = $2
         AND purpose    = $3
         AND used       = false
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, normalized, purpose]
    );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found. Please request a new one.",
      });
    }

    const record = rows[0];

    /* ── Too many attempts ── */
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await pool.query(
        `UPDATE public.phone_otps SET used = true WHERE id = $1`,
        [record.id]
      );
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    /* ── Increment attempt count before checking ── */
    await pool.query(
      `UPDATE public.phone_otps SET attempts = attempts + 1 WHERE id = $1`,
      [record.id]
    );

    /* ── Wrong code ── */
    if (record.otp !== otp.trim()) {
      const remaining = OTP_MAX_ATTEMPTS - (record.attempts + 1);
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
      });
    }

    /* ── Detect network ── */
    let network;
    try {
      network = detectNetwork(normalized);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Could not detect the network for this number.",
      });
    }

    /* ── Mark OTP as used ── */
    await pool.query(
      `UPDATE public.phone_otps SET used = true WHERE id = $1`,
      [record.id]
    );

    /* ── Save verified phone to user ── */
    await pool.query(
      `UPDATE public.users
       SET
         phone             = $1,
         phone_verified    = true,
         phone_verified_at = NOW(),
         phone_network     = $2,
         phone_changed_at  = CASE WHEN $3 THEN NOW() ELSE phone_changed_at END
       WHERE id = $4`,
      [normalized, network, purpose === "change", userId]
    );

    return res.json({
      success: true,
      message: "Phone number verified successfully.",
      phone: {
        masked   : maskPhone(normalized),
        network,
        verified : true,
      },
    });

  } catch (err) {
    console.error("[airtime-coupons] POST /verify-otp:", err.message);
    return res.status(500).json({ success: false, message: "Verification failed." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   USER — AIRTIME COUPON ROUTES
═══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────
   GET /api/airtime-coupons
   Current user's airtime coupons
────────────────────────────────────────────────────────────── */
router.get("/", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id, code, amount, status,
         redeemed_at, processed_at,
         phone, network, admin_note,
         created_at
       FROM public.airtime_coupons
       WHERE user_id = $1
       ORDER BY
         CASE status
           WHEN '${AIRTIME_STATUS.AVAILABLE}'  THEN 0
           WHEN '${AIRTIME_STATUS.REDEEMED}'   THEN 1
           WHEN '${AIRTIME_STATUS.PROCESSING}' THEN 2
           WHEN '${AIRTIME_STATUS.COMPLETED}'  THEN 3
           ELSE 4
         END,
         created_at DESC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      coupons: rows.map((c) => ({
        id           : c.id,
        code         : c.code,
        amount       : Number(c.amount),
        status       : c.status,
        can_redeem   : c.status === AIRTIME_STATUS.AVAILABLE,
        redeemed_at  : c.redeemed_at,
        processed_at : c.processed_at,
        phone_masked : maskPhone(c.phone),
        network      : c.network,
        admin_note   : c.admin_note,
        created_at   : c.created_at,
      })),
    });

  } catch (err) {
    console.error("[airtime-coupons] GET /:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /api/airtime-coupons/redeem
   Body: { code }
────────────────────────────────────────────────────────────── */
router.post("/redeem", authenticate, async (req, res) => {
  const { code } = req.body;
  const userId   = req.user.id;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Coupon code is required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Lock row — concurrent requests queue here ── */
    const { rows: couponRows } = await client.query(
      `SELECT id, user_id, status, amount
       FROM public.airtime_coupons
       WHERE UPPER(code) = UPPER($1)
       LIMIT 1
       FOR UPDATE`,
      [code.trim()]
    );

    if (!couponRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const coupon = couponRows[0];

    /* ── Must belong to this user ── */
    if (coupon.user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "This coupon does not belong to your account.",
      });
    }

    /* ── Must be available ── */
    if (coupon.status !== AIRTIME_STATUS.AVAILABLE) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `This coupon has already been ${coupon.status}.`,
      });
    }

    /* ── Load verified phone ── */
    const { rows: userRows } = await client.query(
      `SELECT phone, phone_verified, phone_network
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const user = userRows[0];

    if (!user?.phone || !user?.phone_verified) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success : false,
        code    : "PHONE_NOT_VERIFIED",
        message : "Please verify your phone number before redeeming airtime.",
      });
    }

    /* ── Always re-detect network ── */
    let network;
    try {
      network = detectNetwork(user.phone);
    } catch {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Could not detect your network. Please contact support.",
      });
    }

    /* ── Conditional UPDATE — second safety net after the lock ── */
    const { rows: updated } = await client.query(
      `UPDATE public.airtime_coupons
       SET
         status      = $1,
         redeemed_by = $2,
         redeemed_at = NOW(),
         phone       = $3,
         network     = $4
       WHERE id     = $5
         AND status = $6
       RETURNING id, code, amount, status, redeemed_at, phone, network`,
      [
        AIRTIME_STATUS.REDEEMED,
        userId,
        user.phone,
        network,
        coupon.id,
        AIRTIME_STATUS.AVAILABLE,
      ]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This coupon has already been redeemed.",
      });
    }

    await client.query("COMMIT");

    const result = updated[0];

    return res.json({
      success: true,
      message: `₦${result.amount} airtime coupon redeemed. We will process it shortly.`,
      coupon: {
        id           : result.id,
        code         : result.code,
        amount       : Number(result.amount),
        status       : result.status,
        can_redeem   : false,
        redeemed_at  : result.redeemed_at,
        phone_masked : maskPhone(result.phone),
        network      : result.network,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[airtime-coupons] POST /redeem:", err.message);
    return res.status(500).json({ success: false, message: "Redemption failed. Try again." });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   ADMIN — AIRTIME COUPON ROUTES
═══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────
   GET /api/airtime-coupons/admin
   List redemption requests
   Query: ?status=redeemed&page=1&limit=20
────────────────────────────────────────────────────────────── */
router.get("/admin", adminAuth, async (req, res) => {
  try {
    const status = req.query.status || AIRTIME_STATUS.REDEEMED;
    const page   = Math.max(1, parseInt(req.query.page)   || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    /* Reject unknown status values */
    if (!Object.values(AIRTIME_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${Object.values(AIRTIME_STATUS).join(", ")}.`,
      });
    }

    /* ── Requests for the requested status ── */
    const { rows } = await pool.query(
      `SELECT
         a.id,
         a.code,
         a.amount,
         a.status,
         a.phone,
         a.network,
         a.redeemed_at,
         a.processed_at,
         a.admin_note,
         u.id    AS user_id,
         u.name  AS user_name,
         u.email AS user_email
       FROM public.airtime_coupons a
       LEFT JOIN public.users u ON u.id = a.redeemed_by
       WHERE a.status = $1
       ORDER BY a.redeemed_at DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    /* ── Total for pagination ── */
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.airtime_coupons
       WHERE status = $1`,
      [status]
    );

    /* ── Summary counts across all statuses ── */
    const { rows: summaryRows } = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM public.airtime_coupons
       GROUP BY status`
    );

    const summary = Object.fromEntries(
      Object.values(AIRTIME_STATUS).map((s) => [s, 0])
    );
    summaryRows.forEach((r) => { summary[r.status] = r.count; });

    return res.json({
      success  : true,
      total    : countRows[0].total,
      page,
      pages    : Math.ceil(countRows[0].total / limit),
      summary,
      requests : rows.map((r) => ({
        id          : r.id,
        code        : r.code,
        amount      : Number(r.amount),
        status      : r.status,
        phone       : r.phone,           // full number — admin only
        phone_masked: maskPhone(r.phone),
        network     : r.network,
        redeemed_at : r.redeemed_at,
        processed_at: r.processed_at,
        admin_note  : r.admin_note,
        user: {
          id   : r.user_id,
          name : r.user_name,
          email: r.user_email,
        },
      })),
    });

  } catch (err) {
    console.error("[airtime-coupons] GET /admin:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /api/airtime-coupons/admin/:id/processing
   Move a redeemed coupon to processing
────────────────────────────────────────────────────────────── */
router.post("/admin/:id/processing", adminAuth, async (req, res) => {
  await updateAdminStatus({
    req, res,
    targetStatus : AIRTIME_STATUS.PROCESSING,
  });
});

/* ──────────────────────────────────────────────────────────────
   POST /api/airtime-coupons/admin/:id/completed
   Mark a coupon as completed after airtime is sent
────────────────────────────────────────────────────────────── */
router.post("/admin/:id/completed", adminAuth, async (req, res) => {
  await updateAdminStatus({
    req, res,
    targetStatus : AIRTIME_STATUS.COMPLETED,
  });
});

/* ──────────────────────────────────────────────────────────────
   POST /api/airtime-coupons/admin/:id/failed
   Mark a coupon as failed and save an explanation
   Body: { note }   — required for failed so user knows why
────────────────────────────────────────────────────────────── */
router.post("/admin/:id/failed", adminAuth, async (req, res) => {
  if (!req.body.note?.trim()) {
    return res.status(400).json({
      success: false,
      message: "A note explaining the failure is required.",
    });
  }

  await updateAdminStatus({
    req, res,
    targetStatus : AIRTIME_STATUS.FAILED,
  });
});

/* ──────────────────────────────────────────────────────────────
   POST /api/airtime-coupons/admin/assign
   Assign a new airtime coupon to a user
   Body: { user_id, amount, code? }
────────────────────────────────────────────────────────────── */
router.post("/admin/assign", adminAuth, async (req, res) => {
  const { user_id, amount, code } = req.body;

  if (!user_id || !amount) {
    return res.status(400).json({
      success: false,
      message: "user_id and amount are required.",
    });
  }

  /* Auto-generate a code if none provided */
  const couponCode = code?.trim().toUpperCase() ||
    `AIR${Math.round(amount)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  try {
    const { rows: userRows } = await pool.query(
      `SELECT id FROM public.users WHERE id = $1 LIMIT 1`,
      [user_id]
    );

    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { rows } = await pool.query(
      `INSERT INTO public.airtime_coupons (code, amount, user_id, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING
       RETURNING id, code, amount, status, created_at`,
      [couponCode, Number(amount), user_id, AIRTIME_STATUS.AVAILABLE]
    );

    if (!rows.length) {
      return res.status(409).json({
        success: false,
        message: `Code "${couponCode}" already exists. Try again or provide a different code.`,
      });
    }

    return res.status(201).json({
      success: true,
      message: `₦${amount} airtime coupon assigned successfully.`,
      coupon : rows[0],
    });

  } catch (err) {
    console.error("[airtime-coupons] POST /admin/assign:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   SHARED ADMIN STATUS UPDATE HELPER
   Used by /processing, /completed, and /failed
═══════════════════════════════════════════════════════════════ */
async function updateAdminStatus({ req, res, targetStatus }) {
  const { id }   = req.params;
  const { note } = req.body;
  const adminId  = req.user.id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Lock the row ── */
    const { rows } = await client.query(
      `SELECT id, status, code, amount
       FROM public.airtime_coupons
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const current = rows[0];

    /* ── Validate transition using ADMIN_TRANSITIONS ── */
    const allowed = ADMIN_TRANSITIONS[current.status];

    if (!allowed) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Status "${current.status}" cannot be updated further.`,
      });
    }

    if (!allowed.includes(targetStatus)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Cannot move from "${current.status}" to "${targetStatus}". Allowed: ${allowed.join(", ")}.`,
      });
    }

    /* ── Apply update ── */
    const { rows: updated } = await client.query(
      `UPDATE public.airtime_coupons
       SET
         status       = $1,
         processed_by = $2,
         processed_at = NOW(),
         admin_note   = COALESCE($3, admin_note)
       WHERE id     = $4
         AND status = $5
       RETURNING id, code, amount, status, processed_at, admin_note`,
      [targetStatus, adminId, note?.trim() || null, id, current.status]
    );

    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Coupon status changed by another request. Please refresh.",
      });
    }

    await client.query("COMMIT");

    const result = updated[0];

    return res.json({
      success: true,
      message: `Coupon ${result.code} marked as ${targetStatus}.`,
      coupon: {
        id          : result.id,
        code        : result.code,
        amount      : Number(result.amount),
        status      : result.status,
        processed_at: result.processed_at,
        admin_note  : result.admin_note,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[airtime-coupons] status update → ${targetStatus}:`, err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  } finally {
    client.release();
  }
}

export default router;