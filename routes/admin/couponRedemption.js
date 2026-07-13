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
    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS redeemed_by_admin      UUID NULL`,

    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS redeemed_by_admin_name TEXT NULL`,

    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS reward_type        TEXT NULL`,

    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS reward_value       DECIMAL NULL`,

    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS reward_description TEXT NULL`,

    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS admin_note         TEXT NULL`,

    /* Store which user this redemption was verified against */
    `ALTER TABLE public.coupon_redemptions
     ADD COLUMN IF NOT EXISTS verified_user_id   UUID NULL`,
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

/*
 * findUserByEmailOrPhone
 * Looks up a user by email OR phone.
 * Returns null if not found.
 */
async function findUserByEmailOrPhone(email, phone) {
  if (!email && !phone) return null;

  const conditions = [];
  const params     = [];

  if (email) {
    params.push(email.trim().toLowerCase());
    conditions.push(`LOWER(email) = $${params.length}`);
  }

  if (phone) {
    const normalized = normalizePhone(phone);
    if (normalized) {
      params.push(normalized);
      conditions.push(`phone = $${params.length}`);
    }
  }

  if (!conditions.length) return null;

  const { rows } = await pool.query(
    `SELECT id, name, email, phone
     FROM public.users
     WHERE ${conditions.join(" OR ")}
     LIMIT 1`,
    params
  );

  return rows[0] || null;
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/coupon-redemption/stats
═══════════════════════════════════════════════════════════════ */
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                                  AS total_coupons,
         COUNT(*) FILTER (WHERE is_active = true)::int  AS available,
         COUNT(*) FILTER (WHERE is_active = false)::int AS redeemed
       FROM public.coupons`
    );

    const { rows: todayRows } = await pool.query(
      `SELECT COUNT(*)::int AS today
       FROM public.coupon_redemptions
       WHERE redeemed_at >= CURRENT_DATE`
    );

    return res.json({
      success      : true,
      totalCoupons : rows[0].total_coupons,
      available    : rows[0].available,
      redeemed     : rows[0].redeemed,
      today        : todayRows[0].today,
    });

  } catch (err) {
    console.error("[admin/coupon-redemption] GET /stats:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/coupon-redemption/lookup
   Query: ?code=XXXX&email=&phone=

   Flow:
   1. Find the coupon
   2. Run validity checks (inactive, expired, used)
   3. Find the user by email or phone
   4. For PRIVATE coupons (Spin & Win):
        - User must match created_by (the winner)
   5. For PUBLIC coupons (WELCOME10, LOEMART20 etc.):
        - User must exist in the system
        - User must NOT have already used this coupon
   6. Return full details for admin to confirm
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

  /* Both email and phone are optional but at least one is
     required for public coupons to identify the buyer. */

  try {
    /* ── Find coupon ── */
    const { rows: couponRows } = await pool.query(
      `SELECT
         c.id,
         c.code,
         c.type,
         c.value,
         c.description,
         c.is_active,
         c.is_private,
         c.usage_limit,
         c.usage_count,
         c.expires_at,
         c.created_by,
         owner.id    AS owner_id,
         owner.name  AS owner_name,
         owner.email AS owner_email,
         owner.phone AS owner_phone
       FROM public.coupons c
       LEFT JOIN public.users owner ON owner.id = c.created_by
       WHERE UPPER(c.code) = $1
       LIMIT 1`,
      [code]
    );

    if (!couponRows.length) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code. No coupon found.",
      });
    }

    const c   = couponRows[0];
    const now = new Date();

    /* ── Basic validity ── */
    if (!c.is_active) {
      return res.status(400).json({
        success: false,
        message: "This coupon has been deactivated.",
      });
    }

    if (c.expires_at && new Date(c.expires_at) < now) {
      return res.status(400).json({
        success: false,
        message: "This coupon has expired.",
      });
    }

    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit.",
      });
    }

    /* ── Already redeemed globally (for single-use coupons) ── */
    const { rows: globalRedeem } = await pool.query(
      `SELECT id, redeemed_at, redeemed_by_admin_name
       FROM public.coupon_redemptions
       WHERE coupon_id = $1
       LIMIT 1`,
      [c.id]
    );

    if (globalRedeem.length && c.usage_limit === 1) {
      return res.status(409).json({
        success: false,
        message: "This coupon has already been redeemed.",
        already_redeemed: {
          redeemed_at : globalRedeem[0].redeemed_at,
          redeemed_by : globalRedeem[0].redeemed_by_admin_name || "Admin",
        },
      });
    }

    /* ══════════════════════════════════════════════════════════
       PRIVATE COUPON (Spin & Win)
       Must be redeemed for its specific owner.
    ══════════════════════════════════════════════════════════ */
    if (c.is_private && c.owner_id) {

      /* Email or phone required to verify the winner */
      if (!email && !phone) {
        return res.status(400).json({
          success     : false,
          message     : "Please enter the buyer's email or phone to verify their identity.",
          requires    : "email_or_phone",
          coupon_type : "private",
        });
      }

      /* Check email matches */
      if (email && c.owner_email) {
        if (c.owner_email.toLowerCase() !== email.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: "The email address does not match the coupon owner.",
            hint   : "Ask the buyer to confirm their registered email address.",
          });
        }
      }

      /* Check phone matches */
      if (phone && c.owner_phone) {
        const normalizedInput = normalizePhone(phone);
        const normalizedOwner = normalizePhone(c.owner_phone);
        if (normalizedInput !== normalizedOwner) {
          return res.status(403).json({
            success: false,
            message: "The phone number does not match the coupon owner.",
            hint   : "Ask the buyer to confirm their registered phone number.",
          });
        }
      }

      /* Private coupon — owner verified */
      return res.json({
        success: true,
        coupon_type: "private",
        coupon: {
          id           : c.id,
          code         : c.code,
          type         : c.type,
          value        : Number(c.value),
          description  : c.description,
          expires_at   : c.expires_at,
          is_private   : true,
          reward_label : buildRewardLabel(c.type, c.value),
          status       : "available",
          owner: {
            id    : c.owner_id,
            name  : c.owner_name,
            email : c.owner_email,
            phone : c.owner_phone,
          },
        },
      });
    }

    /* ══════════════════════════════════════════════════════════
       PUBLIC COUPON (WELCOME10, LOEMART20, FREESHIP etc.)
       No fixed owner — but we still need to:
       1. Identify the buyer (by email or phone)
       2. Make sure they haven't already used this coupon
    ══════════════════════════════════════════════════════════ */

    /* Email or phone required to identify the buyer */
    if (!email && !phone) {
      return res.status(400).json({
        success     : false,
        message     : "Please enter the buyer's email or phone to identify them.",
        requires    : "email_or_phone",
        coupon_type : "public",
      });
    }

    /* Find the buyer */
    const buyer = await findUserByEmailOrPhone(email, phone);

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: "No Loemart account found with that email or phone number.",
        hint   : "Make sure the buyer is registered on Loemart.",
      });
    }

    /* Has this buyer already used this coupon? */
    const { rows: userRedeem } = await pool.query(
      `SELECT id, redeemed_at
       FROM public.coupon_redemptions
       WHERE coupon_id = $1
         AND user_id   = $2
       LIMIT 1`,
      [c.id, buyer.id]
    );

    if (userRedeem.length) {
      return res.status(409).json({
        success: false,
        message: `This coupon has already been used by ${buyer.name} (${buyer.email}).`,
        already_redeemed: {
          redeemed_at : userRedeem[0].redeemed_at,
          user_name   : buyer.name,
          user_email  : buyer.email,
        },
      });
    }

    /* Public coupon — buyer identified and has not used it */
    return res.json({
      success     : true,
      coupon_type : "public",
      coupon: {
        id           : c.id,
        code         : c.code,
        type         : c.type,
        value        : Number(c.value),
        description  : c.description,
        expires_at   : c.expires_at,
        is_private   : false,
        usage_count  : Number(c.usage_count),
        usage_limit  : c.usage_limit ? Number(c.usage_limit) : null,
        reward_label : buildRewardLabel(c.type, c.value),
        status       : "available",
        owner: {
          id    : buyer.id,
          name  : buyer.name,
          email : buyer.email,
          phone : buyer.phone,
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
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", verifyAdmin, async (req, res) => {
  const {
    code,
    email = null,
    phone = null,
    note  = null,
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

    /* ── Lock coupon row ── */
    const { rows: couponRows } = await client.query(
      `SELECT
         c.id, c.code, c.type, c.value, c.description,
         c.is_active, c.is_private, c.usage_limit, c.usage_count,
         c.expires_at, c.created_by,
         owner.id    AS owner_id,
         owner.name  AS owner_name,
         owner.email AS owner_email,
         owner.phone AS owner_phone
       FROM public.coupons c
       LEFT JOIN public.users owner ON owner.id = c.created_by
       WHERE UPPER(c.code) = UPPER($1)
       LIMIT 1
       FOR UPDATE`,
      [code.trim()]
    );

    if (!couponRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code. No coupon found.",
      });
    }

    const c   = couponRows[0];
    const now = new Date();

    /* ── Validity checks ── */
    if (!c.is_active) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "This coupon has been deactivated." });
    }

    if (c.expires_at && new Date(c.expires_at) < now) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "This coupon has expired." });
    }

    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "This coupon has reached its usage limit." });
    }

    /* ── Resolve which user this redemption belongs to ── */
    let resolvedUser = null;

    if (c.is_private && c.owner_id) {
      /* ── PRIVATE: verify email/phone matches owner ── */
      if (email && c.owner_email) {
        if (c.owner_email.toLowerCase() !== email.trim().toLowerCase()) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            success: false,
            message: "The email address does not match the coupon owner.",
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
          });
        }
      }

      resolvedUser = {
        id    : c.owner_id,
        name  : c.owner_name,
        email : c.owner_email,
        phone : c.owner_phone,
      };

      /* Check this owner hasn't used it */
      const { rows: ownerUsed } = await client.query(
        `SELECT id FROM public.coupon_redemptions
         WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
        [c.id, c.owner_id]
      );

      if (ownerUsed.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "This coupon has already been redeemed by its owner.",
        });
      }

    } else {
      /* ── PUBLIC: find buyer by email or phone ── */
      if (!email && !phone) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Please provide the buyer's email or phone number.",
        });
      }

      const buyer = await findUserByEmailOrPhone(email, phone);

      if (!buyer) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "No Loemart account found with that email or phone number.",
        });
      }

      /* Has this buyer already used this coupon? */
      const { rows: buyerUsed } = await client.query(
        `SELECT id FROM public.coupon_redemptions
         WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
        [c.id, buyer.id]
      );

      if (buyerUsed.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: `This coupon has already been used by ${buyer.name} (${buyer.email}).`,
        });
      }

      resolvedUser = buyer;
    }

    /* ── Insert redemption record ── */
    await client.query(
      `INSERT INTO public.coupon_redemptions
         (coupon_id, user_id, discount,
          redeemed_by_admin, redeemed_by_admin_name,
          reward_type, reward_value, reward_description,
          admin_note, verified_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        c.id,
        resolvedUser?.id   || null,
        Number(c.value     || 0),
        adminId,
        adminName,
        c.type,
        Number(c.value),
        c.description || buildRewardLabel(c.type, c.value),
        note?.trim()   || null,
        resolvedUser?.id   || null,
      ]
    );

    /* ── Increment usage_count + deactivate if single-use ──
     *
     * Single-use coupons (usage_limit = 1):
     *   → is_active = false immediately
     *
     * Multi-use public coupons (usage_limit > 1):
     *   → Only increment count, keep active
     *   → The per-user check above prevents the same person reusing it
     */
    const isSingleUse =
      c.usage_limit !== null && Number(c.usage_limit) === 1;

    const newUsageCount = Number(c.usage_count) + 1;
    const reachedLimit  = c.usage_limit && newUsageCount >= Number(c.usage_limit);

    await client.query(
      `UPDATE public.coupons
       SET
         usage_count = usage_count + 1,
         is_active   = CASE WHEN $1 THEN false ELSE is_active END
       WHERE id = $2`,
      [isSingleUse || reachedLimit, c.id]
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
          is_private   : c.is_private,
          reward_label : buildRewardLabel(c.type, c.value),
          buyer_id     : resolvedUser?.id,
          buyer_email  : resolvedUser?.email,
          buyer_phone  : resolvedUser?.phone,
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
          id    : resolvedUser?.id    || null,
          name  : resolvedUser?.name  || "Unknown",
          email : resolvedUser?.email || null,
          phone : resolvedUser?.phone || null,
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
        `(c.code                      ILIKE $${i}
          OR u.name                   ILIKE $${i}
          OR u.email                  ILIKE $${i}
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
         c.is_private,
         u.id    AS user_id,
         u.name  AS user_name,
         u.email AS user_email,
         u.phone AS user_phone
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
        const type  = r.reward_type  || r.type;
        const value = r.reward_value ?? r.value;
        return {
          id           : r.id,
          code         : r.code,
          type,
          value        : Number(value || 0),
          discount     : Number(r.discount || 0),
          reward_label : buildRewardLabel(type, value),
          description  : r.reward_description || r.description,
          is_private   : r.is_private,
          admin_note   : r.admin_note,
          redeemed_at  : r.redeemed_at,
          redeemed_by  : r.redeemed_by_admin_name || "Admin",
          order_id     : r.order_id,
          user: {
            id    : r.user_id,
            name  : r.user_name  || "—",
            email : r.user_email || "—",
            phone : r.user_phone || null,
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