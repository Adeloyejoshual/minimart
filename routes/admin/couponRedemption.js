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
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin      UUID    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin_name TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_type            TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_value           DECIMAL NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_description     TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS admin_note             TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS verified_user_id       UUID    NULL`,
    `ALTER TABLE public.coupon_redemptions ALTER COLUMN user_id DROP NOT NULL`,
  ];

  for (const sql of migrations) {
    try { await pool.query(sql); }
    catch (e) {
      if (!e.message.includes("already exists") && !e.message.includes("does not exist")) {
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
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "+" + digits;
  if (digits.startsWith("0"))   return "+234" + digits.slice(1);
  if (digits.length >= 10)      return "+234" + digits;
  return null;
};

/*
 * findUser
 * Looks up a user by email OR phone.
 * Returns null if not found — this is fine, see design note below.
 *
 * DESIGN NOTE:
 * We do NOT require the buyer to have a verified account.
 * The admin is the trusted party here. If the admin says
 * "this buyer used code X", we record it and mark the coupon used.
 * The email/phone fields are optional hints — not hard requirements.
 */
async function findUser(email, phone) {
  if (!email && !phone) return null;

  const conditions = [];
  const params     = [];

  if (email?.trim()) {
    params.push(email.trim().toLowerCase());
    conditions.push(`LOWER(u.email) = $${params.length}`);
  }

  if (phone?.trim()) {
    const norm = normalizePhone(phone.trim());
    if (norm) {
      params.push(norm);
      /* Also match raw format stored without +234 */
      const local = norm.replace("+234", "0");
      params.push(local);
      conditions.push(`(u.phone = $${params.length - 1} OR u.phone = $${params.length})`);
    }
  }

  if (!conditions.length) return null;

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, phone_verified
       FROM public.users
       WHERE ${conditions.join(" OR ")}
       LIMIT 1`,
      params
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/coupon-redemption/stats
═══════════════════════════════════════════════════════════════ */
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                                   AS total_coupons,
         COUNT(*) FILTER (WHERE is_active = true)::int   AS available,
         COUNT(*) FILTER (WHERE is_active = false)::int  AS redeemed
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

   KEY CHANGE:
   Email and phone are now OPTIONAL hints used to:
     - Identify which user the coupon belongs to (for display)
     - Pre-populate the owner info shown to the admin
     - Detect if the coupon has already been used by this buyer

   They are NO LONGER hard blockers.
   The admin sees the coupon details and decides whether to redeem.

   Flow:
   1. Find the coupon — check validity (inactive, expired, used)
   2. Try to find the buyer by email/phone (optional)
   3. If coupon is private, show owner details from created_by
   4. Return coupon + owner info for admin to review
   5. Admin clicks Redeem — that's where the final action happens
═══════════════════════════════════════════════════════════════ */
router.get("/lookup", verifyAdmin, async (req, res) => {
  const code  = req.query.code?.trim().toUpperCase();
  const email = req.query.email?.trim() || null;
  const phone = req.query.phone?.trim() || null;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: "Coupon code is required.",
    });
  }

  try {
    /* ── Find the coupon ── */
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
        message: "Invalid coupon code. No coupon found with that code.",
      });
    }

    const c   = couponRows[0];
    const now = new Date();

    /* ── Inactive ── */
    if (!c.is_active) {
      return res.status(400).json({
        success: false,
        message: "This coupon has been deactivated and can no longer be used.",
      });
    }

    /* ── Expired ── */
    if (c.expires_at && new Date(c.expires_at) < now) {
      return res.status(400).json({
        success: false,
        message: `This coupon expired on ${new Date(c.expires_at).toLocaleDateString("en-NG")}.`,
      });
    }

    /* ── Usage limit ── */
    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its maximum usage limit.",
      });
    }

    /* ── Already redeemed (global — for single-use coupons) ── */
    const { rows: anyRedemption } = await pool.query(
      `SELECT
         r.id,
         r.redeemed_at,
         r.redeemed_by_admin_name,
         u.name  AS user_name,
         u.email AS user_email
       FROM public.coupon_redemptions r
       LEFT JOIN public.users u ON u.id = r.user_id
       WHERE r.coupon_id = $1
       LIMIT 1`,
      [c.id]
    );

    if (anyRedemption.length) {
      const r = anyRedemption[0];
      return res.status(409).json({
        success: false,
        message: "This coupon has already been redeemed.",
        already_redeemed: {
          redeemed_at  : r.redeemed_at,
          redeemed_by  : r.redeemed_by_admin_name || r.user_name || "Admin",
          redeemed_by_email: r.user_email || null,
        },
      });
    }

    /* ══════════════════════════════════════════════════════════
       RESOLVE OWNER INFO
       For private coupons: use created_by (the winner)
       For public coupons: try to find by email/phone (optional)
       Either way — always return coupon details to admin
    ══════════════════════════════════════════════════════════ */
    let owner      = null;
    let buyerFound = false;
    let ownerMatch = null; // "email" | "phone" | "created_by" | null

    if (c.is_private && c.owner_id) {
      /* Private — owner is whoever won the spin */
      owner      = {
        id    : c.owner_id,
        name  : c.owner_name  || "Unknown",
        email : c.owner_email || null,
        phone : c.owner_phone || null,
      };
      buyerFound = true;
      ownerMatch = "created_by";

      /* Soft-check: warn admin if email/phone doesn't match */
      let emailMismatch = false;
      let phoneMismatch = false;

      if (email && c.owner_email) {
        emailMismatch = c.owner_email.toLowerCase() !== email.toLowerCase();
      }
      if (phone && c.owner_phone) {
        const inp = normalizePhone(phone);
        const own = normalizePhone(c.owner_phone);
        phoneMismatch = inp && own && inp !== own;
      }

      /* Return warning but still show coupon */
      if (emailMismatch || phoneMismatch) {
        return res.json({
          success     : true,
          coupon_type : "private",
          warning     : emailMismatch
            ? "The email entered does not match the coupon owner. Please confirm with the buyer before redeeming."
            : "The phone number entered does not match the coupon owner. Please confirm with the buyer before redeeming.",
          coupon: buildCouponResponse(c, owner),
        });
      }

    } else {
      /* Public coupon — try to find buyer by email/phone */
      if (email || phone) {
        const buyer = await findUser(email, phone);
        if (buyer) {
          owner      = buyer;
          buyerFound = true;
          ownerMatch = email && buyer.email?.toLowerCase() === email?.toLowerCase()
            ? "email" : "phone";

          /* Check if this buyer already used this public coupon */
          const { rows: buyerUsed } = await pool.query(
            `SELECT id, redeemed_at FROM public.coupon_redemptions
             WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
            [c.id, buyer.id]
          );

          if (buyerUsed.length) {
            return res.status(409).json({
              success: false,
              message: `This coupon has already been used by ${buyer.name || buyer.email}.`,
              already_redeemed: {
                redeemed_at : buyerUsed[0].redeemed_at,
                user_name   : buyer.name,
                user_email  : buyer.email,
              },
            });
          }
        } else {
          /*
           * No account found for that email/phone.
           * This is NOT a hard error — admin can still redeem.
           * We just won't link it to a user account.
           */
          owner      = {
            id    : null,
            name  : email || phone || "Unknown Buyer",
            email : email || null,
            phone : phone || null,
          };
          buyerFound = false;
          ownerMatch = null;
        }
      }
    }

    return res.json({
      success     : true,
      coupon_type : c.is_private ? "private" : "public",
      buyer_found : buyerFound,
      owner_match : ownerMatch,
      /*
       * If no email/phone given and it's a public coupon,
       * hint to the admin that they can optionally provide one.
       */
      hint: (!email && !phone && !c.is_private)
        ? "You can optionally enter the buyer's email or phone to link this redemption to their account."
        : null,
      coupon: buildCouponResponse(c, owner),
    });

  } catch (err) {
    console.error("[admin/coupon-redemption] GET /lookup:", err.message);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ─── helper: build consistent coupon response object ─── */
function buildCouponResponse(c, owner) {
  return {
    id           : c.id,
    code         : c.code,
    type         : c.type,
    value        : Number(c.value),
    description  : c.description,
    expires_at   : c.expires_at,
    usage_count  : Number(c.usage_count || 0),
    usage_limit  : c.usage_limit ? Number(c.usage_limit) : null,
    is_private   : c.is_private,
    reward_label : buildRewardLabel(c.type, c.value),
    status       : "available",
    owner        : owner || null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/coupon-redemption/redeem
   Body: { code, email?, phone?, note? }

   KEY CHANGE:
   Email and phone are completely optional.
   The admin is fully trusted to redeem any valid coupon.
   We try to link to a user account if possible, but never
   block the redemption if we can't find one.
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

    /* ── Lock the coupon row ── */
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
      return res.status(400).json({
        success: false,
        message: "This coupon has been deactivated.",
      });
    }

    if (c.expires_at && new Date(c.expires_at) < now) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This coupon has expired.",
      });
    }

    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit.",
      });
    }

    /* ── Check already redeemed ── */
    const { rows: alreadyUsed } = await client.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1 LIMIT 1`,
      [c.id]
    );

    if (alreadyUsed.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This coupon has already been redeemed.",
      });
    }

    /* ══════════════════════════════════════════════════════════
       RESOLVE USER TO LINK REDEMPTION TO
       Priority order:
         1. Private coupon  → use created_by (the winner)
         2. Email/phone given → look up user account
         3. Nothing found   → record redemption with user_id = NULL
       In ALL cases the admin can proceed.
    ══════════════════════════════════════════════════════════ */
    let resolvedUserId   = null;
    let resolvedUserName = null;

    if (c.is_private && c.owner_id) {
      /* Private spin coupon — always link to the winner */
      resolvedUserId   = c.owner_id;
      resolvedUserName = c.owner_name || c.owner_email;

    } else if (email || phone) {
      /* Public coupon — try to find by email/phone */
      const buyer = await findUser(email, phone);
      if (buyer) {
        /* Check this buyer hasn't used it before */
        const { rows: buyerUsed } = await client.query(
          `SELECT id FROM public.coupon_redemptions
           WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
          [c.id, buyer.id]
        );

        if (buyerUsed.length) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            success: false,
            message: `This coupon has already been used by ${buyer.name || buyer.email}.`,
          });
        }

        resolvedUserId   = buyer.id;
        resolvedUserName = buyer.name || buyer.email;
      }
      /* If buyer not found — that's fine, we proceed without user_id */
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
        resolvedUserId,
        Number(c.value || 0),
        adminId,
        adminName,
        c.type,
        Number(c.value),
        c.description || buildRewardLabel(c.type, c.value),
        note?.trim() || null,
        resolvedUserId,
      ]
    );

    /* ── Increment usage_count + deactivate ──
     *
     * Single-use coupons  (usage_limit = 1) → always deactivate
     * Multi-use coupons   (usage_limit > 1) → deactivate only when limit hit
     * No limit coupons    (usage_limit NULL) → keep active
     */
    const newCount      = Number(c.usage_count) + 1;
    const isSingleUse   = c.usage_limit !== null && Number(c.usage_limit) === 1;
    const limitReached  = c.usage_limit !== null && newCount >= Number(c.usage_limit);
    const shouldDeactivate = isSingleUse || limitReached;

    await client.query(
      `UPDATE public.coupons
       SET
         usage_count = usage_count + 1,
         is_active   = CASE WHEN $1 THEN false ELSE is_active END
       WHERE id = $2`,
      [shouldDeactivate, c.id]
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
          code           : c.code,
          type           : c.type,
          value          : Number(c.value),
          is_private     : c.is_private,
          reward_label   : buildRewardLabel(c.type, c.value),
          resolved_user  : resolvedUserId,
          resolved_name  : resolvedUserName,
          input_email    : email || null,
          input_phone    : phone || null,
          admin_name     : adminName,
          admin_note     : note?.trim() || null,
          deactivated    : shouldDeactivate,
        }),
      ]
    ).catch((e) =>
      console.warn("[admin/coupon-redemption] audit log:", e.message)
    );

    /* ── Build owner display ── */
    const ownerDisplay = resolvedUserId
      ? {
          id    : resolvedUserId,
          name  : resolvedUserName || "Unknown",
          email : email || c.owner_email || null,
          phone : phone || c.owner_phone || null,
        }
      : {
          id    : null,
          name  : email || phone || "Unregistered Buyer",
          email : email || null,
          phone : phone || null,
        };

    return res.json({
      success: true,
      message: resolvedUserId
        ? `Coupon redeemed successfully for ${ownerDisplay.name}.`
        : "Coupon redeemed successfully.",
      redemption: {
        code         : c.code,
        type         : c.type,
        value        : Number(c.value),
        reward_label : buildRewardLabel(c.type, c.value),
        description  : c.description,
        redeemed_by  : adminName,
        redeemed_at  : new Date().toISOString(),
        admin_note   : note?.trim() || null,
        linked_to_account: !!resolvedUserId,
        owner        : ownerDisplay,
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
            id    : r.user_id   || null,
            name  : r.user_name || "Unregistered Buyer",
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