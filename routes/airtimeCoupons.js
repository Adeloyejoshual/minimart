// routes/airtimeCoupons.js
import express      from "express";
import { pool }     from "../config/db.js";
import authenticate from "../middleware/auth.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   PHONE HELPERS
═══════════════════════════════════════════════════════════════ */
const normalizePhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

const isValidPhone = (local) =>
  /^0[789][01]\d{8}$/.test(local);

const maskPhone = (phone) => {
  if (!phone) return null;
  const d = normalizePhone(phone);
  return d.slice(0, 4) + "****" + d.slice(-3);
};

const detectNetwork = (phone) => {
  const local  = normalizePhone(phone);
  const prefix = local.slice(0, 4);
  const map = {
    "0703":"MTN","0704":"MTN","0706":"MTN",
    "0803":"MTN","0806":"MTN","0810":"MTN",
    "0813":"MTN","0814":"MTN","0816":"MTN",
    "0903":"MTN","0906":"MTN","0913":"MTN","0916":"MTN",
    "0701":"Airtel","0708":"Airtel","0802":"Airtel",
    "0808":"Airtel","0812":"Airtel","0901":"Airtel",
    "0902":"Airtel","0904":"Airtel","0907":"Airtel","0912":"Airtel",
    "0705":"Glo","0805":"Glo","0807":"Glo",
    "0811":"Glo","0815":"Glo","0905":"Glo","0915":"Glo",
    "0809":"9mobile","0817":"9mobile","0818":"9mobile",
    "0908":"9mobile","0909":"9mobile",
  };
  return map[prefix] || null;
};

/* ═══════════════════════════════════════════════════════════════
   DB SETUP — runs once on startup
═══════════════════════════════════════════════════════════════ */
async function setup() {
  /* Ensure email_verified columns exist on users */
  await pool.query(`
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS email_verified    BOOLEAN     NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL
  `).catch((e) => console.warn("[airtime] users email columns:", e.message));

  /* Ensure airtime_coupons has all needed columns */
  await pool.query(`
    ALTER TABLE public.airtime_coupons
      ADD COLUMN IF NOT EXISTS phone       TEXT        NULL,
      ADD COLUMN IF NOT EXISTS network     TEXT        NULL,
      ADD COLUMN IF NOT EXISTS redeemed_by UUID        NULL,
      ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ NULL
  `).catch((e) => console.warn("[airtime] coupon columns:", e.message));

  /* Index for admin dashboard queries */
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_airtime_coupons_status
      ON public.airtime_coupons (status, redeemed_at)
  `).catch(() => {});

  console.log("[airtime] ✓ ready");
}

setup().catch((e) =>
  console.error("[airtime] setup failed:", e.message)
);

/* ═══════════════════════════════════════════════════════════════
   ROUTE 1 — GET /api/airtime-coupons
   Returns the logged-in user's airtime coupons
═══════════════════════════════════════════════════════════════ */
router.get("/", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, code, amount, status,
              redeemed_at, phone, network, created_at
       FROM public.airtime_coupons
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      coupons: rows.map((c) => ({
        id         : c.id,
        code       : c.code,
        amount     : Number(c.amount),
        status     : c.status,
        can_redeem : c.status === "available",
        redeemed_at: c.redeemed_at,
        phone      : maskPhone(c.phone),
        network    : c.network,
        created_at : c.created_at,
      })),
    });

  } catch (err) {
    console.error("[airtime] list error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch coupons.",
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ROUTE 2 — POST /api/airtime-coupons/redeem
   Body: { code, phone }

   Flow:
     1. Validate inputs
     2. Check email_verified === true  ← THE GATE
     3. Validate phone number
     4. Lock & validate coupon
     5. Mark coupon as "pending" (admin processes manually)
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", authenticate, async (req, res) => {
  const userId = req.user.id;
  const code   = String(req.body?.code  || "").trim();
  const phone  = normalizePhone(req.body?.phone);

  /* ── Input validation ── */
  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Coupon code is required.",
    });
  }

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required.",
    });
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid 11-digit Nigerian mobile number.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Step 1: Fetch user & check email_verified ── */
    const { rows: userRows } = await client.query(
      `SELECT email, email_verified
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (!userRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = userRows[0];

    /* ── THE GATE — email must be verified ── */
    if (!user.email_verified) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        code   : "EMAIL_NOT_VERIFIED",
        message: "Please verify your email address before redeeming a coupon.",
        email  : user.email,
      });
    }

    /* ── Step 2: Lock coupon row to prevent race conditions ── */
    const { rows: couponRows } = await client.query(
      `SELECT id, user_id, status, amount
       FROM public.airtime_coupons
       WHERE UPPER(code) = UPPER($1)
       LIMIT 1
       FOR UPDATE`,
      [code]
    );

    if (!couponRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    const coupon = couponRows[0];

    /* ── Step 3: Ownership check ── */
    if (coupon.user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "This coupon does not belong to your account.",
      });
    }

    /* ── Step 4: Status check ── */
    if (coupon.status !== "available") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `This coupon has already been ${coupon.status}.`,
      });
    }

    const network = detectNetwork(phone);

    /* ── Step 5: Mark as "pending" — admin processes manually ──
       We use "pending" not "redeemed" so the admin dashboard
       can clearly see what needs to be actioned.
       Admin changes to "completed" after sending the airtime.   */
    const { rows: updated } = await client.query(
      `UPDATE public.airtime_coupons
       SET
         status      = 'pending',
         redeemed_by = $1,
         redeemed_at = NOW(),
         phone       = $2,
         network     = $3
       WHERE id     = $4
         AND status = 'available'
       RETURNING id, code, amount, status, redeemed_at`,
      [userId, phone, network, coupon.id]
    );

    /* Race condition — another request beat us */
    if (!updated.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Coupon was just redeemed. Please refresh.",
      });
    }

    await client.query("COMMIT");

    const r = updated[0];

    console.log(
      `[airtime] Redeemed ✓ | user=${userId} | ` +
      `code=${r.code} | ₦${r.amount} | ` +
      `phone=${maskPhone(phone)} | network=${network}`
    );

    return res.json({
      success: true,
      message: `₦${r.amount} airtime claim submitted! Our team will process it shortly.`,
      coupon : {
        id         : r.id,
        code       : r.code,
        amount     : Number(r.amount),
        status     : r.status,          // "pending"
        redeemed_at: r.redeemed_at,
        phone      : maskPhone(phone),
        network,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[airtime] redeem error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Redemption failed. Please try again.",
      ...(!IS_PROD && { debug: err.message }),
    });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   ROUTE 3 — GET /api/airtime-coupons/status/:id
   User can poll this to see pending → completed
═══════════════════════════════════════════════════════════════ */
router.get("/status/:id", authenticate, async (req, res) => {
  const userId   = req.user.id;
  const couponId = req.params.id;

  try {
    const { rows } = await pool.query(
      `SELECT id, code, amount, status,
              redeemed_at, phone, network
       FROM public.airtime_coupons
       WHERE id      = $1
         AND user_id = $2
       LIMIT 1`,
      [couponId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found.",
      });
    }

    const c = rows[0];

    return res.json({
      success: true,
      coupon : {
        id         : c.id,
        code       : c.code,
        amount     : Number(c.amount),
        status     : c.status,
        redeemed_at: c.redeemed_at,
        phone      : maskPhone(c.phone),
        network    : c.network,
      },
    });

  } catch (err) {
    console.error("[airtime] status error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch coupon status.",
    });
  }
});

export default router;