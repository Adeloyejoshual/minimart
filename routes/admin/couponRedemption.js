// routes/admin/couponRedemption.js
// Base: /api/admin/coupon-redemption

import express    from "express";
import { pool }   from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   ENSURE COLUMNS
═══════════════════════════════════════════════════════════════ */
async function ensureColumns() {
  const migrations = [
    /* Who redeemed it */
    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS redeemed_by_admin      UUID NULL`,

    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS redeemed_by_admin_name TEXT NULL`,

    /* Reward snapshot — accurate even if coupon changes later */
    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS reward_type        TEXT NULL`,

    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS reward_value       DECIMAL NULL`,

    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS reward_description TEXT NULL`,

    /* Optional admin note */
    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS admin_note TEXT NULL`,
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (e) {
      if (!e.message.includes("already exists")) {
        console.warn("[admin/coupon-redemption] migration:", e.message);
      }
    }
  }
}

ensureColumns().catch((err) =>
  console.warn("[admin/coupon-redemption] column init:", err.message)
);

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const buildRewardLabel = (type, value) => {
  if (type === "percentage")    return `${value}% Discount`;
  if (type === "fixed")         return `₦${Number(value).toLocaleString("en-NG")} Coupon`;
  if (type === "free_shipping") return "Free Shipping";
  return String(value);
};

const normalizePhone = (raw) => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234")) return "+" + digits;
  if (digits.startsWith("0"))   return "+234" + digits.slice(1);
  return "+" + digits;
};

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/coupon-redemption/stats
   Summary cards for the admin dashboard
═══════════════════════════════════════════════════════════════ */
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                                                   AS total_coupons,
         COUNT(*) FILTER (WHERE is_active = true)::int                  AS available,
         COUNT(*) FILTER (WHERE is_active = false)::int                 AS redeemed,
         COUNT(*) FILTER (
           WHERE is_active = false
             AND EXISTS (
               SELECT 1 FROM public.coupon_redemptions r
               WHERE r.coupon_id = c.id
                 AND r.redeemed_at >= CURRENT_DATE
             )
         )::int                                                          AS today
       FROM public.coupons c`
    );

    return res.json({
      success       : true,
      totalCoupons  : rows[0].total_coupons,
      available     : rows[0].available,
      redeemed      : rows[0].redeemed,
      today         : rows[0].today,
    });

  } catch (err) {
    console.error("[admin/coupon-redemption] GET /stats:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/coupon-redemption/lookup?code=XXXX&email=&phone=
   Look up a coupon and verify it belongs to the buyer
   before showing the Redeem button.

   Query params:
     code   — required
     email  — optional: buyer's email to verify ownership
     phone  — optional: buyer's phone to verify ownership
═══════════════════════════════════════════════════════════════ */
router.get("/lookup", verifyAdmin, async (req, res) => {
  const code  = req.query.code?.trim().toUpperCase();
  const email = req.query.email?.trim().toLowerCase() || null;
  const phone = req.query.phone?.trim() || null;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Coupon code is required.",
    });
  }

  try {
    /* ── Find the coupon + owner ── */
    const { rows: couponRows } = await pool.query(
      `SELECT
         c.id,
         c.code,
         c.type,
         c.value,
         c.description,
         c.is_active,
         c.usage_limit,
         c.usage_count,
         c.expires_at,
         c.created_by,
         c.is_private,
         u.id    AS owner_id,
         u.name  AS owner_name,
         u.email AS owner_email,
         u.phone AS owner_phone
       FROM public.coupons c
       LEFT JOIN public.users u ON u.id = c.created_by
       WHERE UPPER(c.code) = $1
       LIMIT 1`,
      [code]
    );

    if (!couponRows.length) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code. No coupon found with that code.",
      });
    }

    const c   = couponRows[0];
    const now = new Date();

    /* ── Inactive ── */
    if (!c.is_active) {
      return res.status(400).json({
        success: false,
        message: "This coupon has been deactivated.",
      });
    }

    /* ── Expired ── */
    if (c.expires_at && new Date(c.expires_at) < now) {
      return res.status(400).json({
        success: false,
        message: "This coupon has expired.",
      });
    }

    /* ── Usage limit ── */
    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit.",
      });
    }

    /* ── Already redeemed ── */
    const { rows: redemptionRows } = await pool.query(
      `SELECT
         r.id,
         r.redeemed_at,
         r.redeemed_by_admin_name,
         u.name  AS redeemed_by_user_name,
         u.email AS redeemed_by_user_email
       FROM public.coupon_redemptions r
       LEFT JOIN public.users u ON u.id = r.user_id
       WHERE r.coupon_id = $1
       LIMIT 1`,
      [c.id]
    );

    if (redemptionRows.length) {
      const r = redemptionRows[0];
      return res.status(409).json({
        success: false,
        message: "This coupon has already been redeemed.",
        already_redeemed: {
          redeemed_at  : r.redeemed_at,
          redeemed_by  : r.redeemed_by_admin_name || r.redeemed_by_user_name || "Unknown",
          redeemed_by_email: r.redeemed_by_user_email || null,
        },
      });
    }

    /* ── Ownership verification ──
     *
     * If the admin provides an email or phone number,
     * verify it matches the coupon owner.
     * This ensures the admin is redeeming for the right buyer.
     *
     * Public coupons (is_private = false, no created_by)
     * skip this check since they have no specific owner.
     */
    if (c.is_private && c.owner_id) {
      let ownerMismatch = false;
      let mismatchReason = "";

      if (email && c.owner_email) {
        if (c.owner_email.toLowerCase() !== email.toLowerCase()) {
          ownerMismatch  = true;
          mismatchReason = "The email address does not match the coupon owner.";
        }
      }

      if (!ownerMismatch && phone && c.owner_phone) {
        const normalizedInput = normalizePhone(phone);
        const normalizedOwner = normalizePhone(c.owner_phone);
        if (normalizedInput !== normalizedOwner) {
          ownerMismatch  = true;
          mismatchReason = "The phone number does not match the coupon owner.";
        }
      }

      if (ownerMismatch) {
        return res.status(403).json({
          success: false,
          message: mismatchReason,
          hint   : "Ask the buyer to confirm their registered email or phone number.",
        });
      }
    }

    /* ── All checks passed ── */
    return res.json({
      success: true,
      coupon: {
        id           : c.id,
        code         : c.code,
        type         : c.type,
        value        : Number(c.value),
        description  : c.description,
        expires_at   : c.expires_at,
        is_private   : c.is_private,
        reward_label : buildRewardLabel(c.type, c.value),
        status       : "available",
        owner: {
          id    : c.owner_id    || null,
          name  : c.owner_name  || "Public Coupon",
          email : c.owner_email || null,
          phone : c.owner_phone || null,
        },
      },
    });

  } catch (err) {
    console.error("[admin/coupon-redemption] GET /lookup:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/coupon-redemption/redeem
   Body: { code, email?, phone?, note? }

   email / phone are used to verify the buyer's identity.
   note  is an optional admin note saved on the redemption.
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", verifyAdmin, async (req, res) => {
  const {
    code,
    email  = null,
    phone  = null,
    note   = null,
  } = req.body;

  const adminId   = req.admin.id;
  const adminName = req.admin.name || req.admin.email;

  if (!code?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Coupon code is required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── Lock the coupon row ── */
    const { rows: couponRows } = await client.query(
      `SELECT
         c.id,
         c.code,
         c.type,
         c.value,
         c.description,
         c.is_active,
         c.usage_limit,
         c.usage_count,
         c.expires_at,
         c.created_by,
         c.is_private,
         u.id    AS owner_id,
         u.name  AS owner_name,
         u.email AS owner_email,
         u.phone AS owner_phone
       FROM public.coupons c
       LEFT JOIN public.users u ON u.id = c.created_by
       WHERE UPPER(c.code) = UPPER($1)
       LIMIT 1
       FOR UPDATE`,
      [code.trim()]
    );

    if (!couponRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code. No coupon found with that code.",
      });
    }

    const c   = couponRows[0];
    const now = new Date();

    /* ── Inactive ── */
    if (!c.is_active) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This coupon has been deactivated.",
      });
    }

    /* ── Expired ── */
    if (c.expires_at && new Date(c.expires_at) < now) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This coupon has expired.",
      });
    }

    /* ── Usage limit ── */
    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit.",
      });
    }

    /* ── Already redeemed ── */
    const { rows: existing } = await client.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1 LIMIT 1`,
      [c.id]
    );

    if (existing.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This coupon has already been redeemed.",
      });
    }

    /* ── Ownership verification ──
     *
     * Private coupons must be redeemed for their owner.
     * The admin must provide the buyer's email or phone
     * and it must match what is on file.
     */
    if (c.is_private && c.owner_id) {
      if (email && c.owner_email) {
        if (c.owner_email.toLowerCase() !== email.trim().toLowerCase()) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            success: false,
            message: "The email address does not match the coupon owner.",
            hint   : "Ask the buyer to confirm their registered email address.",
          });
        }
      }

      if (phone && c.owner_phone) {
        const normalizedInput = normalizePhone(phone);
        const normalizedOwner = normalizePhone(c.owner_phone);
        if (normalizedInput !== normalizedOwner) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            success: false,
            message: "The phone number does not match the coupon owner.",
            hint   : "Ask the buyer to confirm their registered phone number.",
          });
        }
      }
    }

    /* ── Insert redemption record with reward snapshot ── */
    await client.query(
      `INSERT INTO public.coupon_redemptions
         (coupon_id, user_id, discount,
          redeemed_by_admin, redeemed_by_admin_name,
          reward_type, reward_value, reward_description,
          admin_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        c.id,
        c.owner_id   || null,
        Number(c.value || 0),
        adminId,
        adminName,
        c.type,
        Number(c.value),
        c.description || buildRewardLabel(c.type, c.value),
        note?.trim()  || null,
      ]
    );

    /* ── Increment usage_count AND deactivate ──
     *
     * is_active = false prevents any future reuse.
     * Even if there is a bug elsewhere, the coupon cannot
     * be redeemed again once this UPDATE runs.
     */
    await client.query(
      `UPDATE public.coupons
       SET
         usage_count = usage_count + 1,
         is_active   = false
       WHERE id = $1`,
      [c.id]
    );

    await client.query("COMMIT");

    /* ── Audit log (non-fatal) ── */
    pool.query(
      `INSERT INTO public.audit_logs
         (actor_id, action, target_type, target_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        adminId,
        "admin_coupon_redeem",
        "coupon",
        c.id,
        JSON.stringify({
          code         : c.code,
          type         : c.type,
          value        : Number(c.value),
          reward_label : buildRewardLabel(c.type, c.value),
          owner_id     : c.owner_id,
          owner_email  : c.owner_email,
          owner_phone  : c.owner_phone,
          admin_name   : adminName,
          admin_note   : note?.trim() || null,
        }),
      ]
    ).catch((e) =>
      console.warn("[admin/coupon-redemption] audit log failed:", e.message)
    );

    return res.json({
      success: true,
      message: "Coupon redeemed successfully.",
      redemption: {
        code         : c.code,
        type         : c.type,
        value        : Number(c.value),
        reward_label : buildRewardLabel(c.type, c.value),
        description  : c.description,
        redeemed_by  : adminName,
        redeemed_at  : new Date().toISOString(),
        admin_note   : note?.trim() || null,
        owner: {
          id    : c.owner_id    || null,
          name  : c.owner_name  || "Public Coupon",
          email : c.owner_email || null,
          phone : c.owner_phone || null,
        },
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[admin/coupon-redemption] POST /redeem:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/coupon-redemption/history
   Full redemption history with filters + pagination
   Query: ?page=1&limit=20&search=
═══════════════════════════════════════════════════════════════ */
router.get("/history", verifyAdmin, async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const page   = Math.max(1,   parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params     = [];

    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      conditions.push(
        `(c.code                     ILIKE $${i}
          OR u.name                  ILIKE $${i}
          OR u.email                 ILIKE $${i}
          OR r.redeemed_by_admin_name ILIKE $${i})`
      );
    }

    const where = conditions.length
      ? "WHERE " + conditions.join(" AND ")
      : "";

    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.discount,
         r.redeemed_at,
         r.redeemed_by_admin_name,
         r.reward_type,
         r.reward_value,
         r.reward_description,
         r.admin_note,
         r.order_id,
         c.code,
         c.type,
         c.value,
         c.description,
         u.id    AS user_id,
         u.name  AS user_name,
         u.email AS user_email
       FROM public.coupon_redemptions r
       JOIN public.coupons c ON c.id = r.coupon_id
       LEFT JOIN public.users u ON u.id = r.user_id
       ${where}
       ORDER BY r.redeemed_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.coupon_redemptions r
       JOIN public.coupons c ON c.id = r.coupon_id
       LEFT JOIN public.users u ON u.id = r.user_id
       ${where}`,
      params
    );

    return res.json({
      success : true,
      total   : countRows[0].total,
      page,
      pages   : Math.ceil(countRows[0].total / limit),
      history : rows.map((r) => {
        /* Use the reward snapshot if available,
           otherwise fall back to live coupon data */
        const type  = r.reward_type  || r.type;
        const value = r.reward_value ?? r.value;
        return {
          id              : r.id,
          code            : r.code,
          type,
          value           : Number(value || 0),
          discount        : Number(r.discount || 0),
          reward_label    : buildRewardLabel(type, value),
          description     : r.reward_description || r.description,
          admin_note      : r.admin_note,
          redeemed_at     : r.redeemed_at,
          redeemed_by     : r.redeemed_by_admin_name || "User",
          order_id        : r.order_id,
          user: {
            id    : r.user_id,
            name  : r.user_name  || "—",
            email : r.user_email || "—",
          },
        };
      }),
    });

  } catch (err) {
    console.error("[admin/coupon-redemption] GET /history:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;