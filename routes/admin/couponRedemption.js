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
    `ALTER TABLE public.coupon_redemptions ALTER COLUMN user_id DROP NOT NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin      UUID    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS redeemed_by_admin_name TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_type            TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_value           DECIMAL NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS reward_description     TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS admin_note             TEXT    NULL`,
    `ALTER TABLE public.coupon_redemptions ADD COLUMN IF NOT EXISTS verified_user_id       UUID    NULL`,
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (e) {
      if (
        !e.message.includes("already exists") &&
        !e.message.includes("does not exist") &&
        !e.message.includes("cannot alter")
      ) {
        console.warn("[coupon-redemption] migration:", e.message);
      }
    }
  }

  /* Partial unique index */
  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_user_coupon
      ON public.coupon_redemptions (coupon_id, user_id)
      WHERE user_id IS NOT NULL
    `);
  } catch (e) {
    if (!e.message.includes("already exists")) {
      console.warn("[coupon-redemption] index:", e.message);
    }
  }

  /* audit_logs — use TEXT for ID columns to avoid UUID cast issues */
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
    if (local && local !== phone.trim()) {
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
    console.warn("[coupon-redemption] findUser:", e.message);
    return null;
  }
}

function writeAuditLog(payload) {
  pool.query(
    `INSERT INTO public.audit_logs
       (actor_id, action, target_type, target_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      String(payload.actor_id    || ""),
      String(payload.action      || ""),
      String(payload.target_type || ""),
      String(payload.target_id   || ""),
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
           COUNT(*)::int                                  AS total,
           COUNT(*) FILTER (WHERE is_active = true)::int  AS available,
           COUNT(*) FILTER (WHERE is_active = false)::int AS redeemed
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
═══════════════════════════════════════════════════════════════ */
router.get("/lookup", verifyAdmin, async (req, res) => {
  const code  = req.query.code?.trim().toUpperCase();
  const email = req.query.email?.trim() || null;
  const phone = req.query.phone?.trim() || null;

  if (!code) {
    return res.status(400).json({ success: false, message: "Coupon code is required." });
  }

  try {
    /* ── Find the coupon (no JOIN — avoids FOR UPDATE issue) ── */
    const { rows: couponRows } = await pool.query(
      `SELECT
         id, code, type, value, description,
         is_active, is_private, usage_limit, usage_count,
         expires_at, created_by
       FROM public.coupons
       WHERE UPPER(code) = $1
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

    /* ── Validity checks ── */
    if (!c.is_active) {
      return res.status(400).json({ success: false, message: "This coupon has been deactivated." });
    }

    if (c.expires_at && new Date(c.expires_at) < now) {
      return res.status(400).json({
        success: false,
        message: `This coupon expired on ${new Date(c.expires_at).toLocaleDateString("en-NG")}.`,
      });
    }

    if (c.usage_limit && Number(c.usage_count) >= Number(c.usage_limit)) {
      return res.status(400).json({ success: false, message: "This coupon has reached its usage limit." });
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

    /* ── Fetch owner separately (only if created_by is set) ── */
    let ownerRow = null;
    if (c.created_by) {
      const { rows: ownerRows } = await pool.query(
        `SELECT id, name, email, phone FROM public.users WHERE id = $1 LIMIT 1`,
        [c.created_by]
      );
      ownerRow = ownerRows[0] || null;
    }

    /* ── Resolve owner + buyer info ── */
    let owner      = null;
    let buyerFound = false;
    let warning    = null;

    if (c.is_private && ownerRow) {
      owner      = {
        id    : ownerRow.id,
        name  : ownerRow.name  || "Unknown",
        email : ownerRow.email || null,
        phone : ownerRow.phone || null,
      };
      buyerFound = true;

      /* Soft-check — warn but never block */
      if (email && ownerRow.email &&
          ownerRow.email.toLowerCase() !== email.toLowerCase()) {
        warning = "The email entered does not match the coupon winner. Confirm with the buyer before redeeming.";
      } else if (phone && ownerRow.phone) {
        const inp = normalizePhone(phone);
        const own = normalizePhone(ownerRow.phone);
        if (inp && own && inp !== own) {
          warning = "The phone number entered does not match the coupon winner. Confirm with the buyer before redeeming.";
        }
      }

    } else if (!c.is_private) {
      /* Public coupon — try to find buyer by email/phone */
      if (email || phone) {
        const buyer = await findUser(email, phone);
        if (buyer) {
          buyerFound = true;
          owner      = buyer;

          /* Check if buyer already used this coupon */
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
    return res.status(500).json({ success: false, message: "Lookup failed: " + err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/admin/coupon-redemption/redeem
   Body: { code, email?, phone?, note? }
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

    /* ── 1. Lock ONLY the coupons row — no JOIN ──
     *
     * FOR UPDATE cannot be used with LEFT JOIN.
     * Fetch the coupon row alone, then fetch the owner
     * in a separate query. This is the fix for:
     * "FOR UPDATE cannot be applied to the nullable side of an outer join"
     */
    const { rows: couponRows } = await client.query(
      `SELECT
         id, code, type, value, description,
         is_active, is_private, usage_limit, usage_count,
         expires_at, created_by
       FROM public.coupons
       WHERE UPPER(code) = UPPER($1)
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

    /* ── 4. Fetch owner separately (no JOIN needed) ── */
    let ownerRow = null;
    if (c.created_by) {
      const { rows: ownerRows } = await client.query(
        `SELECT id, name, email, phone FROM public.users WHERE id = $1 LIMIT 1`,
        [c.created_by]
      );
      ownerRow = ownerRows[0] || null;
    }

    /* ── 5. Resolve which user to link the redemption to ── */
    let resolvedUserId   = null;
    let resolvedUserName = null;

    if (c.is_private && ownerRow) {
      /* Private Spin & Win coupon → always link to the winner */
      resolvedUserId   = ownerRow.id;
      resolvedUserName = ownerRow.name || ownerRow.email;

    } else if (!c.is_private && (email || phone)) {
      /* Public coupon → try to find buyer account */
      const buyer = await findUser(email, phone);
      if (buyer) {
        /* Check buyer has not already used it */
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
      /* Buyer not found — proceed without a user link */
    }

    /* ── 6. INSERT redemption ── */
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
    } catch (insertErr) {
      /* Fallback — some columns may not exist yet */
      console.warn("[coupon-redemption] full INSERT failed:", insertErr.message);
      console.warn("[coupon-redemption] trying minimal INSERT…");

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
        console.log("[coupon-redemption] minimal INSERT succeeded");
      } catch (minErr) {
        await client.query("ROLLBACK");
        console.error("[coupon-redemption] minimal INSERT failed:", minErr.message);
        return res.status(500).json({
          success : false,
          message : "Insert failed: " + minErr.message,
          debug   : {
            message : minErr.message,
            code    : minErr.code,
            detail  : minErr.detail,
            hint    : minErr.hint,
          },
        });
      }
    }

    /* ── 7. UPDATE coupon ── */
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

    /* ── 8. COMMIT ── */
    await client.query("COMMIT");

    /* ── 9. Audit log (non-fatal) ── */
    writeAuditLog({
      actor_id    : String(adminId),
      action      : "admin_coupon_redeem",
      target_type : "coupon",
      target_id   : String(c.id),
      metadata    : {
        code          : c.code,
        type          : c.type,
        value         : Number(c.value),
        is_private    : c.is_private,
        reward_label  : buildRewardLabel(c.type, c.value),
        resolved_user : resolvedUserId ? String(resolvedUserId) : null,
        resolved_name : resolvedUserName,
        admin_name    : adminName,
        note          : note?.trim() || null,
        deactivated   : deactivate,
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
    console.error("[coupon-redemption] POST /redeem error:", err.message);
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