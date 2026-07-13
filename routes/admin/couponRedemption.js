// routes/admin/couponRedemption.js
// Base: /api/admin/coupon-redemption

import express from "express";
import { pool } from "../../config/db.js";
import { verifyAdmin } from "./middleware.js";

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   ENSURE COLUMNS
═══════════════════════════════════════════════════════════════ */
async function ensureColumns() {
  const migrations = [
    /* Make user_id nullable — admin redemptions may not have a user */
    `ALTER TABLE public.coupon_redemptions ALTER COLUMN user_id DROP NOT NULL`,

    /* Admin redemption tracking */
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin      UUID    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin_name TEXT    NULL`,

    /* Reward snapshot — stored so history stays accurate if coupon changes */
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_type            TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_value           DECIMAL NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_description     TEXT    NULL`,

    /* Optional admin note */
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS admin_note             TEXT    NULL`,

    /* Which user was identified at redemption time */
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS verified_user_id       UUID    NULL`,
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (e) {
      /* Ignore "already exists" and "does not exist" — both are fine */
      if (
        !e.message.includes("already exists") &&
        !e.message.includes("does not exist") &&
        !e.message.includes("cannot alter")
      ) {
        console.warn("[coupon-redemption] migration warning:", e.message);
      }
    }
  }

  /* Partial unique index — allows NULL user_id (admin-only redemptions) */
  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_user_coupon
      ON public.coupon_redemptions (coupon_id, user_id)
      WHERE user_id IS NOT NULL
    `);
  } catch (e) {
    if (!e.message.includes("already exists")) {
      console.warn("[coupon-redemption] index warning:", e.message);
    }
  }

  /* Ensure audit_logs exists and has text-compatible ID columns */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.audit_logs (
      id          UUID        NOT NULL DEFAULT gen_random_uuid(),
      actor_id    TEXT        NULL,
      action      TEXT        NOT NULL,
      target_type TEXT        NULL,
      target_id   TEXT        NULL,
      metadata    JSONB       NULL,
      ip_address  TEXT        NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT  audit_logs_pkey PRIMARY KEY (id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_created
    ON public.audit_logs (created_at DESC)
  `);
}

ensureColumns().catch((err) =>
  console.warn("[coupon-redemption] init:", err.message)
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

/* Try to find a user by email or phone — returns null if not found */
async function findUser(email, phone) {
  const conditions = [];
  const params     = [];

  if (email?.trim()) {
    params.push(email.trim().toLowerCase());
    conditions.push(`LOWER(email) = $${params.length}`);
  }

  if (phone?.trim()) {
    const norm  = normalizePhone(phone.trim());
    const local = norm ? norm.replace("+234", "0") : null;
    if (norm) {
      params.push(norm);
      conditions.push(`phone = $${params.length}`);
    }
    if (local) {
      params.push(local);
      conditions.push(`phone = $${params.length}`);
    }
  }

  if (!conditions.length) return null;

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone
       FROM public.users
       WHERE ${conditions.join(" OR ")}
       LIMIT 1`,
      params
    );
    return rows[0] || null;
  } catch (e) {
    console.warn("[coupon-redemption] findUser error:", e.message);
    return null;
  }
}

/* Safe audit log — never throws, never blocks the response */
function writeAuditLog(payload) {
  pool.query(
    `INSERT INTO public.audit_logs
       (actor_id, action, target_type, target_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      String(payload.actor_id   || ""),
      String(payload.action     || ""),
      String(payload.target_type|| ""),
      String(payload.target_id  || ""),
      JSON.stringify(payload.metadata || {}),
    ]
  ).catch((e) =>
    console.warn("[coupon-redemption] audit log failed:", e.message)
  );
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/coupon-redemption/stats
═══════════════════════════════════════════════════════════════ */
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const [couponRes, todayRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int                                   AS total,
           COUNT(*) FILTER (WHERE is_active = true)::int   AS available,
           COUNT(*) FILTER (WHERE is_active = false)::int  AS redeemed
         FROM public.coupons`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS today
         FROM public.coupon_redemptions
         WHERE redeemed_at >= CURRENT_DATE`
      ),
    ]);

    return res.json({
      success      : true,
      totalCoupons : couponRes.rows[0].total,
      available    : couponRes.rows[0].available,
      redeemed     : couponRes.rows[0].redeemed,
      today        : todayRes.rows[0].today,
    });

  } catch (err) {
    console.error("[coupon-redemption] GET /stats:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load stats." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/coupon-redemption/lookup
   Query: ?code=XXXX&email=&phone=

   Always returns the coupon if it is valid.
   Email and phone are optional hints — they are never hard blockers.
   A warning is returned if they do not match, but the admin
   can still proceed to redeem.
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
    const { rows } = await pool.query(
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

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code. No coupon found with that code.",
      });
    }

    const c   = rows[0];
    const now = new Date();

    /* ── Hard validity checks ── */
    if (!c.is_active) {
      return res.status(400).json({
        success: false,
        message: "This coupon has been deactivated.",
      });
    }

    if (c.expires_at && new Date(c.expires_at) < now) {
      return res.status(400).json({
        success: false,
        message: `This coupon expired on ${new Date(c.expires_at).toLocaleDateString("en-NG")}.`,
      });
    }

    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      return res.status(400).json({
        success: false,
        message: "This coupon has reached its usage limit.",
      });
    }

    /* ── Already redeemed? ── */
    const { rows: redemptions } = await pool.query(
      `SELECT r.id, r.redeemed_at, r.redeemed_by_admin_name, u.name AS user_name
       FROM public.coupon_redemptions r
       LEFT JOIN public.users u ON u.id = r.user_id
       WHERE r.coupon_id = $1
       LIMIT 1`,
      [c.id]
    );

    if (redemptions.length) {
      const r = redemptions[0];
      return res.status(409).json({
        success: false,
        message: "This coupon has already been redeemed.",
        already_redeemed: {
          redeemed_at : r.redeemed_at,
          redeemed_by : r.redeemed_by_admin_name || r.user_name || "Admin",
        },
      });
    }

    /* ══════════════════════════════════════════════════════════
       RESOLVE OWNER + BUYER INFO
       We never block on email/phone mismatch — just warn.
    ══════════════════════════════════════════════════════════ */
    let owner      = null;
    let buyerFound = false;
    let warning    = null;

    if (c.is_private && c.owner_id) {
      /* Private Spin & Win coupon — owner is the winner */
      owner = {
        id    : c.owner_id,
        name  : c.owner_name  || "Unknown",
        email : c.owner_email || null,
        phone : c.owner_phone || null,
      };
      buyerFound = true;

      /* Soft-check email/phone — warn but never block */
      if (email && c.owner_email &&
          c.owner_email.toLowerCase() !== email.toLowerCase()) {
        warning = "The email entered does not match the coupon winner. Confirm with the buyer before redeeming.";
      } else if (phone && c.owner_phone) {
        const inp = normalizePhone(phone);
        const own = normalizePhone(c.owner_phone);
        if (inp && own && inp !== own) {
          warning = "The phone number entered does not match the coupon winner. Confirm with the buyer before redeeming.";
        }
      }

    } else {
      /* Public coupon — try to find buyer by email/phone */
      if (email || phone) {
        const buyer = await findUser(email, phone);
        if (buyer) {
          buyerFound = true;
          owner      = buyer;

          /* Check if this buyer already used the public coupon */
          const { rows: used } = await pool.query(
            `SELECT id FROM public.coupon_redemptions
             WHERE coupon_id = $1 AND user_id = $2 LIMIT 1`,
            [c.id, buyer.id]
          );

          if (used.length) {
            return res.status(409).json({
              success: false,
              message: `This coupon has already been used by ${buyer.name || buyer.email}.`,
            });
          }
        } else {
          /* No account found — still show coupon, just without a linked account */
          owner = {
            id    : null,
            name  : email || phone || "Unregistered Buyer",
            email : email || null,
            phone : phone || null,
          };
        }
      }
    }

    return res.json({
      success     : true,
      coupon_type : c.is_private ? "private" : "public",
      buyer_found : buyerFound,
      warning,
      hint        : (!email && !phone && !c.is_private)
        ? "Optionally enter the buyer's email or phone to link this redemption to their account."
        : null,
      coupon: {
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
        owner,
      },
    });

  } catch (err) {
    console.error("[coupon-redemption] GET /lookup:", err.message);
    return res.status(500).json({ success: false, message: "Lookup failed." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/coupon-redemption/redeem
   Body: { code, email?, phone?, note? }

   Email and phone are optional.
   Admin is fully trusted — we never block on missing identity.
   We try to link to a user account if possible.
═══════════════════════════════════════════════════════════════ */
router.post("/redeem", verifyAdmin, async (req, res) => {
  const { code, email, phone, note } = req.body;
  const adminId   = req.admin.id;
  const adminName = req.admin.name || req.admin.email;

  if (!code?.trim()) {
    return res.status(400).json({ success: false, message: "Coupon code is required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ── 1. Find + lock coupon ── */
    const { rows: couponRows } = await client.query(
      `SELECT
         c.id, c.code, c.type, c.value, c.description,
         c.is_active, c.is_private, c.usage_limit, c.usage_count,
         c.expires_at, c.created_by,
         owner.id    AS owner_id,
         owner.name  AS owner_name,
         owner.email AS owner_email
       FROM public.coupons c
       LEFT JOIN public.users owner ON owner.id = c.created_by
       WHERE UPPER(c.code) = UPPER($1)
       LIMIT 1
       FOR UPDATE`,
      [code.trim()]
    );

    if (!couponRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    const c   = couponRows[0];
    const now = new Date();

    /* ── 2. Validity ── */
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

    /* ── 3. Already redeemed? ── */
    const { rows: existing } = await client.query(
      `SELECT id FROM public.coupon_redemptions
       WHERE coupon_id = $1 LIMIT 1`,
      [c.id]
    );

    if (existing.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "This coupon has already been redeemed." });
    }

    /* ── 4. Resolve user (best effort) ── */
    let resolvedUserId   = null;
    let resolvedUserName = null;

    if (c.is_private && c.owner_id) {
      /* Private coupon → always link to the winner */
      resolvedUserId   = c.owner_id;
      resolvedUserName = c.owner_name || c.owner_email;
    } else if (email || phone) {
      /* Public coupon → try to find buyer account */
      const buyer = await findUser(email, phone);
      if (buyer) {
        /* Make sure this buyer has not already used this coupon */
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
      /* If buyer not found — fine, proceed without a user link */
    }

    /* ── 5. INSERT redemption record ──
     *
     * Only insert the columns we KNOW exist.
     * reward_description, admin_note, verified_user_id
     * are added by ensureColumns() above — but in case
     * the migration ran after this code was deployed,
     * we wrap each optional column in a try/fallback.
     */
    let insertSuccess = false;

    /* Try with all columns first */
    try {
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
          note?.trim()   || null,
          resolvedUserId,
        ]
      );
      insertSuccess = true;
    } catch (fullInsertErr) {
      console.warn("[coupon-redemption] full INSERT failed:", fullInsertErr.message);
      console.warn("[coupon-redemption] trying minimal INSERT…");

      /* Fallback — only the columns guaranteed to exist */
      try {
        await client.query(
          `INSERT INTO public.coupon_redemptions
             (coupon_id, user_id, discount,
              redeemed_by_admin, redeemed_by_admin_name,
              reward_type, reward_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            c.id,
            resolvedUserId,
            Number(c.value || 0),
            adminId,
            adminName,
            c.type,
            Number(c.value),
          ]
        );
        insertSuccess = true;
        console.log("[coupon-redemption] minimal INSERT succeeded");
      } catch (minInsertErr) {
        await client.query("ROLLBACK");
        console.error("[coupon-redemption] minimal INSERT also failed:", minInsertErr.message);
        return res.status(500).json({
          success : false,
          message : "Redemption failed: " + minInsertErr.message,
          debug   : {
            message : minInsertErr.message,
            code    : minInsertErr.code,
            detail  : minInsertErr.detail,
            hint    : minInsertErr.hint,
          },
        });
      }
    }

    /* ── 6. UPDATE coupon — increment count + deactivate if needed ── */
    const isSingleUse  = c.usage_limit !== null && Number(c.usage_limit) === 1;
    const newCount     = Number(c.usage_count) + 1;
    const limitReached = c.usage_limit !== null && newCount >= Number(c.usage_limit);
    const deactivate   = isSingleUse || limitReached;

    await client.query(
      `UPDATE public.coupons
       SET
         usage_count = usage_count + 1,
         is_active   = CASE WHEN $1 THEN false ELSE is_active END
       WHERE id = $2`,
      [deactivate, c.id]
    );

    /* ── 7. COMMIT ── */
    await client.query("COMMIT");

    /* ── 8. Audit log (non-fatal — never blocks the response) ── */
    writeAuditLog({
      actor_id    : String(adminId),
      action      : "admin_coupon_redeem",
      target_type : "coupon",
      target_id   : String(c.id),
      metadata    : {
        code           : c.code,
        type           : c.type,
        value          : Number(c.value),
        is_private     : c.is_private,
        reward_label   : buildRewardLabel(c.type, c.value),
        resolved_user  : resolvedUserId ? String(resolvedUserId) : null,
        resolved_name  : resolvedUserName,
        input_email    : email || null,
        input_phone    : phone || null,
        admin_name     : adminName,
        note           : note?.trim() || null,
        deactivated    : deactivate,
      },
    });

    return res.json({
      success: true,
      message: resolvedUserName
        ? `Coupon redeemed successfully for ${resolvedUserName}.`
        : "Coupon redeemed successfully.",
      redemption: {
        code         : c.code,
        type         : c.type,
        value        : Number(c.value),
        reward_label : buildRewardLabel(c.type, c.value),
        description  : c.description,
        redeemed_by  : adminName,
        redeemed_at  : new Date().toISOString(),
        note         : note?.trim() || null,
        deactivated  : deactivate,
        linked_to_account: !!resolvedUserId,
        owner: resolvedUserId
          ? { id: resolvedUserId, name: resolvedUserName }
          : null,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[coupon-redemption] POST /redeem unhandled error:");
    console.error("  message:", err.message);
    console.error("  code:",    err.code);
    console.error("  detail:",  err.detail);
    console.error("  hint:",    err.hint);

    return res.status(500).json({
      success : false,
      message : err.message || "Server error.",
      debug   : {
        message : err.message,
        code    : err.code    || null,
        detail  : err.detail  || null,
        hint    : err.hint    || null,
      },
    });
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/admin/coupon-redemption/history
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
         r.admin_note,
         c.code,
         c.type,
         c.value,
         c.description,
         c.is_private,
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
        const type  = r.reward_type  || r.type;
        const value = r.reward_value ?? r.value;
        return {
          id           : r.id,
          code         : r.code,
          type,
          value        : Number(value || 0),
          discount     : Number(r.discount || 0),
          reward_label : buildRewardLabel(type, value),
          description  : r.description,
          is_private   : r.is_private,
          admin_note   : r.admin_note,
          redeemed_at  : r.redeemed_at,
          redeemed_by  : r.redeemed_by_admin_name || "Admin",
          user: {
            id    : r.user_id    || null,
            name  : r.user_name  || "Unregistered Buyer",
            email : r.user_email || "—",
          },
        };
      }),
    });

  } catch (err) {
    console.error("[coupon-redemption] GET /history:", err.message);
    return res.status(500).json({ success: false, message: "Failed to load history." });
  }
});

export default router;