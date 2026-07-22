// ════════════════════════════════════════════════════════════════
// FILE: routes/settings.js
//
// Endpoints:
//  GET    /api/settings/profile
//  PATCH  /api/settings/profile
//  POST   /api/settings/change-password
//  PATCH  /api/settings/email
//  PATCH  /api/settings/phone
//  GET    /api/settings/preferences
//  PATCH  /api/settings/preferences
//  GET    /api/settings/notifications
//  PATCH  /api/settings/notifications
//  GET    /api/settings/blocked-users
//  POST   /api/settings/blocked-users
//  DELETE /api/settings/blocked-users/:id
//  GET    /api/settings/login-activity
//  GET    /api/settings/sessions
//  DELETE /api/settings/sessions/:id
//  DELETE /api/settings/sessions          (all except current)
//  POST   /api/settings/logout
//  DELETE /api/settings/delete-account
//  POST   /api/settings/restore-account
// ════════════════════════════════════════════════════════════════

import express     from "express";
import bcrypt      from "bcrypt";
import crypto      from "crypto";
import rateLimit   from "express-rate-limit";
import * as Sentry from "@sentry/node";

import { pool }         from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit }   from "../lib/audit.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const BCRYPT_ROUNDS        = 12;
const MAX_BIO_LENGTH       = 300;
const MAX_NAME_LENGTH      = 60;
const DELETION_GRACE_DAYS  = 60;
const LOGIN_ACTIVITY_LIMIT = 50;
const SESSIONS_LIMIT       = 20;
const BLOCKED_USERS_LIMIT  = 100;

const ALLOWED_LANGUAGES = new Set(["en", "yo", "ha", "ig", "pcm"]);
const ALLOWED_GENDERS   = new Set([
  "male", "female", "non-binary", "prefer_not_to_say",
]);

const PHONE_RE    = /^\+?[0-9]{7,15}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
const UUID_RE     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════════ */
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

const ok = (res, data = {}) =>
  res.json({ success: true, ...data });

const cleanText = (v) => {
  const s = String(v ?? "").trim();
  return s || null;
};

const isValidUuid = (v) => UUID_RE.test(String(v ?? ""));

const sanitizePhone = (v = "") =>
  String(v).replace(/[\s\-().]/g, "");

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const extractToken = (req) => {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
};

const parseDeviceName = (ua = "") => {
  if (!ua)                   return "Unknown device";
  if (/iPhone/i.test(ua))    return "iPhone";
  if (/iPad/i.test(ua))      return "iPad";
  if (/Android/i.test(ua))   return "Android device";
  if (/Windows/i.test(ua))   return "Windows PC";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua))     return "Linux device";
  return "Unknown device";
};

const parseDeviceType = (ua = "") => {
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) return "mobile";
  if (/Tablet/i.test(ua))                      return "tablet";
  return "desktop";
};

const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

const daysFromNow = (days) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const daysRemaining = (futureDate) => {
  if (!futureDate) return null;
  return Math.max(
    0,
    Math.ceil(
      (new Date(futureDate).getTime() - Date.now()) / 86_400_000
    )
  );
};

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const makeLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? req.ip),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const readLimiter = makeLimiter({
  windowMin : 5,
  max       : IS_PROD ? 120 : 1_000,
  message   : "Too many requests. Slow down.",
});

const writeLimiter = makeLimiter({
  windowMin : 15,
  max       : IS_PROD ? 30 : 500,
  message   : "Too many update requests. Please wait.",
});

const sensitiveWriteLimiter = makeLimiter({
  windowMin : 60,
  max       : IS_PROD ? 5 : 100,
  message   : "Too many sensitive requests. Try again later.",
});

const deleteLimiter = makeLimiter({
  windowMin : 60,
  max       : IS_PROD ? 3 : 50,
  message   : "Too many delete requests.",
});

const restoreLimiter = makeLimiter({
  windowMin : 60,
  max       : IS_PROD ? 5 : 50,
  message   : "Too many restore attempts.",
});

/* ═══════════════════════════════════════════════════════════════
   SESSION UPSERT
   Call this from your auth/login route after issuing a JWT.
═══════════════════════════════════════════════════════════════ */
export const upsertSession = async (userId, token, req) => {
  try {
    const tokenHash  = hashToken(token);
    const ua         = req.headers["user-agent"] ?? "";
    const ip         = getIp(req);
    const deviceName = parseDeviceName(ua);
    const deviceType = parseDeviceType(ua);
    const expiryDays = Number(process.env.JWT_EXPIRY_DAYS ?? 30);
    const expiresAt  = new Date(Date.now() + expiryDays * 86_400_000);

    await pool.query(
      `INSERT INTO user_sessions
         (user_id, token_hash, device_name, device_type,
          ip_address, user_agent, last_active, expires_at, is_current)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, TRUE)
       ON CONFLICT (token_hash) DO UPDATE
         SET last_active = NOW(),
             is_current  = TRUE`,
      [userId, tokenHash, deviceName, deviceType, ip, ua, expiresAt]
    );
  } catch (err) {
    console.warn("[settings] upsertSession error:", err.message);
  }
};

/* ═══════════════════════════════════════════════════════════════
   PROFILE COLUMNS ALLOWLIST
   Explicit list prevents newly added sensitive columns from
   leaking accidentally via SELECT *.
═══════════════════════════════════════════════════════════════ */
const PROFILE_COLS = `
  id, name, first_name, last_name, username, email,
  phone, bio, gender, date_of_birth,
  profile_image, cover_image,
  store_name, store_description, store_logo, store_banner,
  store_slug, store_category, business_name, address,
  country, state, city, latitude, longitude,
  preferred_language, preferred_currency, locale,
  email_verified, phone_verified, identity_verified, store_verified,
  is_premium, premium_plan, subscription_plan, subscription_status,
  role, seller_type, trust_score, rating, verification_level,
  followers_count, following_count, profile_views,
  active_products_count, products_count,
  social_links, business_hours,
  status, deletion_scheduled_at, deletion_requested_at,
  created_at, last_login, last_seen
`.trim();

/* ═══════════════════════════════════════════════════════════════
   GET /api/settings/profile
═══════════════════════════════════════════════════════════════ */
router.get(
  "/profile",
  authenticate,
  readLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, "Not authenticated.");

    try {
      const { rows } = await pool.query(
        `SELECT ${PROFILE_COLS} FROM public.users WHERE id = $1`,
        [userId]
      );

      if (!rows.length) return fail(res, 404, "User not found.");

      const profile = rows[0];

      const pendingDeletion =
        profile.status === "pending_deletion" && profile.deletion_scheduled_at
          ? {
              scheduled_at   : profile.deletion_scheduled_at,
              days_remaining : daysRemaining(profile.deletion_scheduled_at),
              can_restore    : true,
            }
          : null;

      return ok(res, { profile, pending_deletion: pendingDeletion });

    } catch (err) {
      console.error("[settings] GET /profile:", err.message);
      Sentry.captureException(err, { tags: { route: "settings_profile_get" } });
      return fail(res, 500, "Failed to load profile.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/settings/profile
═══════════════════════════════════════════════════════════════ */
router.patch(
  "/profile",
  authenticate,
  writeLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const {
      first_name, last_name, username, bio,
      gender, date_of_birth, profile_image, cover_image,
      store_name, store_description, country, state, city,
      address, social_links,
    } = req.body;

    /* ── Validation ── */
    if (first_name !== undefined) {
      const v = cleanText(first_name);
      if (!v || v.length > MAX_NAME_LENGTH)
        return fail(res, 400, `First name must be 1–${MAX_NAME_LENGTH} characters.`);
    }

    if (last_name !== undefined) {
      const v = cleanText(last_name);
      if (!v || v.length > MAX_NAME_LENGTH)
        return fail(res, 400, `Last name must be 1–${MAX_NAME_LENGTH} characters.`);
    }

    if (username !== undefined) {
      const v = cleanText(username);
      if (!v || !USERNAME_RE.test(v))
        return fail(
          res, 400,
          "Username must be 3–30 characters (letters, numbers, _ . - only)."
        );
    }

    if (bio !== undefined) {
      const v = cleanText(bio) ?? "";
      if (v.length > MAX_BIO_LENGTH)
        return fail(res, 400, `Bio must be at most ${MAX_BIO_LENGTH} characters.`);
    }

    if (gender !== undefined && gender !== null) {
      if (!ALLOWED_GENDERS.has(String(gender)))
        return fail(res, 400, "Invalid gender value.");
    }

    if (date_of_birth !== undefined && date_of_birth !== null) {
      const d   = new Date(date_of_birth);
      const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000);
      if (isNaN(d.getTime())) return fail(res, 400, "Invalid date of birth.");
      if (age < 13)           return fail(res, 400, "You must be at least 13 years old.");
      if (age > 120)          return fail(res, 400, "Invalid date of birth.");
    }

    if (social_links !== undefined && social_links !== null) {
      if (typeof social_links !== "object" || Array.isArray(social_links))
        return fail(res, 400, "social_links must be an object.");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      /* Username uniqueness check */
      if (username !== undefined) {
        const uname = cleanText(username);
        const { rows: existing } = await client.query(
          `SELECT id FROM public.users
           WHERE LOWER(username) = LOWER($1) AND id <> $2`,
          [uname, userId]
        );
        if (existing.length) return fail(res, 409, "Username already taken.");
      }

      const updates = [];
      const values  = [];
      let   idx     = 1;

      const addField = (col, val) => {
        updates.push(`${col} = $${idx++}`);
        values.push(val);
      };

      if (first_name        !== undefined) addField("first_name",        cleanText(first_name));
      if (last_name         !== undefined) addField("last_name",         cleanText(last_name));
      if (username          !== undefined) addField("username",          cleanText(username));
      if (bio               !== undefined) addField("bio",               cleanText(bio));
      if (gender            !== undefined) addField("gender",            gender ?? null);
      if (date_of_birth     !== undefined) addField("date_of_birth",     date_of_birth ?? null);
      if (profile_image     !== undefined) addField("profile_image",     cleanText(profile_image));
      if (cover_image       !== undefined) addField("cover_image",       cleanText(cover_image));
      if (store_name        !== undefined) addField("store_name",        cleanText(store_name));
      if (store_description !== undefined) addField("store_description", cleanText(store_description));
      if (country           !== undefined) addField("country",           cleanText(country));
      if (state             !== undefined) addField("state",             cleanText(state));
      if (city              !== undefined) addField("city",              cleanText(city));
      if (address           !== undefined) addField("address",           cleanText(address));
      if (social_links      !== undefined)
        addField("social_links", social_links ? JSON.stringify(social_links) : null);

      /* Sync composite name when either name part changes */
      if (first_name !== undefined || last_name !== undefined) {
        const { rows: cur } = await client.query(
          "SELECT first_name, last_name FROM public.users WHERE id = $1",
          [userId]
        );
        const fn   = cleanText(first_name) ?? cur[0]?.first_name ?? "";
        const ln   = cleanText(last_name)  ?? cur[0]?.last_name  ?? "";
        const full = [fn, ln].filter(Boolean).join(" ");
        if (full) addField("name", full);
      }

      if (!updates.length) return fail(res, 400, "No fields to update.");

      addField("updated_at", new Date());
      values.push(userId);

      const { rows } = await client.query(
        `UPDATE public.users
         SET ${updates.join(", ")}
         WHERE id = $${idx}
         RETURNING ${PROFILE_COLS}`,
        values
      );

      await client.query("COMMIT");

      setImmediate(() => {
        writeAudit({
          actorId    : userId,
          action     : "profile_updated",
          targetType : "user",
          targetId   : userId,
          metadata   : { fields: updates.map((u) => u.split(" =")[0]) },
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, { profile: rows[0] });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[settings] PATCH /profile:", err.message);
      Sentry.captureException(err, { tags: { route: "settings_profile_patch" } });
      return fail(res, 500, "Failed to update profile.");
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /api/settings/change-password
═══════════════════════════════════════════════════════════════ */
router.post(
  "/change-password",
  authenticate,
  sensitiveWriteLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password)
      return fail(res, 400, "All password fields are required.");

    if (new_password !== confirm_password)
      return fail(res, 400, "New passwords do not match.");

    if (new_password.length < 8)
      return fail(res, 400, "New password must be at least 8 characters.");

    if (new_password.length > 128)
      return fail(res, 400, "Password too long.");

    if (new_password === current_password)
      return fail(res, 400, "New password must differ from current password.");

    try {
      const { rows } = await pool.query(
        "SELECT password_hash FROM public.users WHERE id = $1",
        [userId]
      );
      if (!rows.length) return fail(res, 404, "User not found.");

      const valid = await bcrypt.compare(current_password, rows[0].password_hash);
      if (!valid) return fail(res, 401, "Current password is incorrect.");

      const newHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);

      await pool.query(
        `UPDATE public.users
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2`,
        [newHash, userId]
      );

      /* Invalidate all other sessions — forces re-login on other devices */
      const currentTokenHash = hashToken(extractToken(req) ?? "");
      await pool.query(
        `DELETE FROM user_sessions
         WHERE user_id = $1 AND token_hash <> $2`,
        [userId, currentTokenHash]
      );

      setImmediate(() => {
        writeAudit({
          actorId    : userId,
          action     : "password_changed",
          targetType : "user",
          targetId   : userId,
          metadata   : { sessions_invalidated: true },
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, {
        message: "Password updated. Other devices have been logged out.",
      });

    } catch (err) {
      console.error("[settings] POST /change-password:", err.message);
      Sentry.captureException(err, { tags: { route: "settings_change_password" } });
      return fail(res, 500, "Failed to change password.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/settings/email
═══════════════════════════════════════════════════════════════ */
router.patch(
  "/email",
  authenticate,
  sensitiveWriteLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const { email, password } = req.body;

    if (!email || !password)
      return fail(res, 400, "Email and current password are required.");

    const newEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(newEmail))
      return fail(res, 400, "Invalid email address.");

    try {
      const { rows } = await pool.query(
        "SELECT email, password_hash FROM public.users WHERE id = $1",
        [userId]
      );
      if (!rows.length) return fail(res, 404, "User not found.");

      if (rows[0].email.toLowerCase() === newEmail)
        return fail(res, 400, "This is already your current email address.");

      const valid = await bcrypt.compare(password, rows[0].password_hash);
      if (!valid) return fail(res, 401, "Password is incorrect.");

      const { rows: taken } = await pool.query(
        `SELECT id FROM public.users
         WHERE LOWER(email) = $1 AND id <> $2`,
        [newEmail, userId]
      );
      if (taken.length) return fail(res, 409, "This email is already in use.");

      await pool.query(
        `UPDATE public.users
         SET email             = $1,
             email_verified    = FALSE,
             email_verified_at = NULL,
             updated_at        = NOW()
         WHERE id = $2`,
        [newEmail, userId]
      );

      setImmediate(() => {
        writeAudit({
          actorId    : userId,
          action     : "email_changed",
          targetType : "user",
          targetId   : userId,
          metadata   : { new_email: newEmail },
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, {
        message : "Email updated. Please verify your new email address.",
        email   : newEmail,
      });

    } catch (err) {
      console.error("[settings] PATCH /email:", err.message);
      Sentry.captureException(err, { tags: { route: "settings_email" } });
      return fail(res, 500, "Failed to update email.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/settings/phone
═══════════════════════════════════════════════════════════════ */
router.patch(
  "/phone",
  authenticate,
  sensitiveWriteLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const { phone, password } = req.body;

    if (!phone || !password)
      return fail(res, 400, "Phone number and current password are required.");

    const cleaned = sanitizePhone(String(phone));
    if (!PHONE_RE.test(cleaned))
      return fail(
        res, 400,
        "Phone must be 7–15 digits (e.g. 08012345678 or +2348012345678)."
      );

    try {
      const { rows } = await pool.query(
        "SELECT phone, password_hash FROM public.users WHERE id = $1",
        [userId]
      );
      if (!rows.length) return fail(res, 404, "User not found.");

      const valid = await bcrypt.compare(password, rows[0].password_hash);
      if (!valid) return fail(res, 401, "Password is incorrect.");

      if (rows[0].phone === cleaned)
        return fail(res, 400, "This is already your current phone number.");

      const { rows: taken } = await pool.query(
        `SELECT id FROM public.users WHERE phone = $1 AND id <> $2`,
        [cleaned, userId]
      );
      if (taken.length) return fail(res, 409, "This phone number is already in use.");

      await pool.query(
        `UPDATE public.users
         SET phone             = $1,
             phone_verified    = FALSE,
             phone_verified_at = NULL,
             phone_changed_at  = NOW(),
             updated_at        = NOW()
         WHERE id = $2`,
        [cleaned, userId]
      );

      setImmediate(() => {
        writeAudit({
          actorId    : userId,
          action     : "phone_changed",
          targetType : "user",
          targetId   : userId,
          metadata   : { new_phone: cleaned },
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, { message: "Phone number updated.", phone: cleaned });

    } catch (err) {
      console.error("[settings] PATCH /phone:", err.message);
      Sentry.captureException(err, { tags: { route: "settings_phone" } });
      return fail(res, 500, "Failed to update phone number.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/settings/preferences
═══════════════════════════════════════════════════════════════ */
router.get(
  "/preferences",
  authenticate,
  readLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, "Not authenticated.");

    try {
      const { rows } = await pool.query(
        `SELECT preferred_language, preferred_currency, locale
         FROM public.users WHERE id = $1`,
        [userId]
      );
      if (!rows.length) return fail(res, 404, "User not found.");

      return ok(res, {
        preferences: {
          language : rows[0].preferred_language ?? "en",
          currency : rows[0].preferred_currency ?? "NGN",
          locale   : rows[0].locale             ?? "en-NG",
        },
      });

    } catch (err) {
      console.error("[settings] GET /preferences:", err.message);
      return fail(res, 500, "Failed to load preferences.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/settings/preferences
═══════════════════════════════════════════════════════════════ */
router.patch(
  "/preferences",
  authenticate,
  writeLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, "Not authenticated.");

    const { language } = req.body;

    if (language !== undefined) {
      if (!ALLOWED_LANGUAGES.has(String(language)))
        return fail(
          res, 400,
          `Invalid language. Allowed: ${[...ALLOWED_LANGUAGES].join(", ")}`
        );
    }

    const updates = [];
    const values  = [];
    let   idx     = 1;

    if (language !== undefined) {
      updates.push(`preferred_language = $${idx++}`);
      values.push(language);
    }

    if (!updates.length) return fail(res, 400, "No preferences to update.");

    updates.push(`updated_at = $${idx++}`);
    values.push(new Date());
    values.push(userId);

    try {
      await pool.query(
        `UPDATE public.users SET ${updates.join(", ")} WHERE id = $${idx}`,
        values
      );

      return ok(res, { message: "Preferences updated.", language });

    } catch (err) {
      console.error("[settings] PATCH /preferences:", err.message);
      return fail(res, 500, "Failed to update preferences.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/settings/notifications
═══════════════════════════════════════════════════════════════ */
router.get(
  "/notifications",
  authenticate,
  readLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, "Not authenticated.");

    try {
      const { rows } = await pool.query(
        `SELECT push_enabled, email_enabled, sms_enabled, marketing_enabled
         FROM notification_preferences
         WHERE user_id = $1`,
        [userId]
      );

      /* Return sensible defaults when no row exists yet */
      const prefs = rows[0] ?? {
        push_enabled      : true,
        email_enabled     : true,
        sms_enabled       : false,
        marketing_enabled : true,
      };

      return ok(res, { notifications: prefs });

    } catch (err) {
      console.error("[settings] GET /notifications:", err.message);
      return fail(res, 500, "Failed to load notification preferences.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/settings/notifications
═══════════════════════════════════════════════════════════════ */
router.patch(
  "/notifications",
  authenticate,
  writeLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, "Not authenticated.");

    const {
      push_enabled,
      email_enabled,
      sms_enabled,
      marketing_enabled,
    } = req.body;

    const toBool = (v) => (v === undefined ? undefined : Boolean(v));

    const push      = toBool(push_enabled);
    const email     = toBool(email_enabled);
    const sms       = toBool(sms_enabled);
    const marketing = toBool(marketing_enabled);

    if (
      push      === undefined &&
      email     === undefined &&
      sms       === undefined &&
      marketing === undefined
    ) return fail(res, 400, "No notification preferences provided.");

    try {
      await pool.query(
        `INSERT INTO notification_preferences
           (user_id, push_enabled, email_enabled,
            sms_enabled, marketing_enabled, updated_at)
         VALUES ($1,
           COALESCE($2, TRUE),
           COALESCE($3, TRUE),
           COALESCE($4, FALSE),
           COALESCE($5, TRUE),
           NOW()
         )
         ON CONFLICT (user_id) DO UPDATE SET
           push_enabled      = COALESCE($2, notification_preferences.push_enabled),
           email_enabled     = COALESCE($3, notification_preferences.email_enabled),
           sms_enabled       = COALESCE($4, notification_preferences.sms_enabled),
           marketing_enabled = COALESCE($5, notification_preferences.marketing_enabled),
           updated_at        = NOW()`,
        [userId, push ?? null, email ?? null, sms ?? null, marketing ?? null]
      );

      const { rows } = await pool.query(
        `SELECT push_enabled, email_enabled, sms_enabled, marketing_enabled
         FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );

      return ok(res, {
        message       : "Notification preferences updated.",
        notifications : rows[0],
      });

    } catch (err) {
      console.error("[settings] PATCH /notifications:", err.message);
      Sentry.captureException(err, { tags: { route: "settings_notifications" } });
      return fail(res, 500, "Failed to update notification preferences.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/settings/blocked-users
═══════════════════════════════════════════════════════════════ */
router.get(
  "/blocked-users",
  authenticate,
  readLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, "Not authenticated.");

    try {
      const { rows } = await pool.query(
        `SELECT
           bu.id          AS block_id,
           bu.created_at  AS blocked_at,
           bu.reason,
           u.id           AS user_id,
           u.name,
           u.username,
           u.profile_image,
           u.store_name,
           u.verified
         FROM blocked_users bu
         JOIN public.users  u ON u.id = bu.blocked_id
         WHERE bu.blocker_id = $1
         ORDER BY bu.created_at DESC
         LIMIT $2`,
        [userId, BLOCKED_USERS_LIMIT]
      );

      return ok(res, { blocked_users: rows });

    } catch (err) {
      console.error("[settings] GET /blocked-users:", err.message);
      return fail(res, 500, "Failed to load blocked users.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /api/settings/blocked-users
═══════════════════════════════════════════════════════════════ */
router.post(
  "/blocked-users",
  authenticate,
  writeLimiter,
  async (req, res) => {
    const blockerId = req.user?.id;
    const ip        = getIp(req);
    if (!blockerId) return fail(res, 401, "Not authenticated.");

    const { user_id, reason } = req.body;

    if (!user_id || !isValidUuid(user_id))
      return fail(res, 400, "Valid user_id required.");

    if (user_id === blockerId)
      return fail(res, 400, "You cannot block yourself.");

    try {
      const { rows: target } = await pool.query(
        `SELECT id, name FROM public.users
         WHERE id = $1 AND status <> 'deleted'`,
        [user_id]
      );
      if (!target.length) return fail(res, 404, "User not found.");

      await pool.query(
        `INSERT INTO blocked_users (blocker_id, blocked_id, reason)
         VALUES ($1, $2, $3)
         ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
        [blockerId, user_id, cleanText(reason) ?? null]
      );

      setImmediate(() => {
        writeAudit({
          actorId    : blockerId,
          action     : "user_blocked",
          targetType : "user",
          targetId   : user_id,
          metadata   : { reason: cleanText(reason) },
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, { message: `${target[0].name} has been blocked.` });

    } catch (err) {
      console.error("[settings] POST /blocked-users:", err.message);
      Sentry.captureException(err, { tags: { route: "settings_block_user" } });
      return fail(res, 500, "Failed to block user.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/settings/blocked-users/:id
═══════════════════════════════════════════════════════════════ */
router.delete(
  "/blocked-users/:id",
  authenticate,
  writeLimiter,
  async (req, res) => {
    const blockerId = req.user?.id;
    const blockId   = req.params.id;
    const ip        = getIp(req);
    if (!blockerId) return fail(res, 401, "Not authenticated.");
    if (!isValidUuid(blockId)) return fail(res, 400, "Invalid block ID.");

    try {
      const { rows } = await pool.query(
        `DELETE FROM blocked_users
         WHERE id = $1 AND blocker_id = $2
         RETURNING blocked_id`,
        [blockId, blockerId]
      );

      if (!rows.length)
        return fail(res, 404, "Block not found or already removed.");

      setImmediate(() => {
        writeAudit({
          actorId    : blockerId,
          action     : "user_unblocked",
          targetType : "user",
          targetId   : rows[0].blocked_id,
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, { message: "User unblocked." });

    } catch (err) {
      console.error("[settings] DELETE /blocked-users/:id:", err.message);
      return fail(res, 500, "Failed to unblock user.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/settings/login-activity
═══════════════════════════════════════════════════════════════ */
router.get(
  "/login-activity",
  authenticate,
  readLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return fail(res, 401, "Not authenticated.");

    try {
      const { rows } = await pool.query(
        `SELECT id, action, ip_address, metadata, created_at
         FROM audit_logs
         WHERE actor_id = $1
           AND action IN (
             'login', 'login_failed', 'logout',
             'password_changed', 'email_changed',
             'phone_changed', 'session_revoked',
             'all_sessions_revoked'
           )
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, LOGIN_ACTIVITY_LIMIT]
      );

      const activity = rows.map((r) => ({
        id         : r.id,
        action     : r.action,
        ip_address : r.ip_address ?? "Unknown",
        device     : r.metadata?.device     ?? "Unknown device",
        location   : r.metadata?.location   ?? null,
        user_agent : r.metadata?.user_agent ?? null,
        created_at : r.created_at,
      }));

      return ok(res, { login_activity: activity });

    } catch (err) {
      console.error("[settings] GET /login-activity:", err.message);
      return fail(res, 500, "Failed to load login activity.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   GET /api/settings/sessions
═══════════════════════════════════════════════════════════════ */
router.get(
  "/sessions",
  authenticate,
  readLimiter,
  async (req, res) => {
    const userId       = req.user?.id;
    const currentToken = extractToken(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const currentHash = currentToken ? hashToken(currentToken) : null;

    try {
      /* Prune expired sessions first */
      await pool.query(
        `DELETE FROM user_sessions
         WHERE user_id = $1 AND expires_at < NOW()`,
        [userId]
      );

      const { rows } = await pool.query(
        `SELECT id, device_name, device_type, ip_address,
                last_active, created_at, expires_at, token_hash
         FROM user_sessions
         WHERE user_id = $1
         ORDER BY last_active DESC
         LIMIT $2`,
        [userId, SESSIONS_LIMIT]
      );

      const sessions = rows.map((s) => ({
        id          : s.id,
        device_name : s.device_name,
        device_type : s.device_type,
        ip_address  : s.ip_address ?? "Unknown",
        last_active : s.last_active,
        created_at  : s.created_at,
        expires_at  : s.expires_at,
        is_current  : currentHash ? s.token_hash === currentHash : false,
      }));

      return ok(res, { sessions });

    } catch (err) {
      console.error("[settings] GET /sessions:", err.message);
      return fail(res, 500, "Failed to load sessions.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/settings/sessions/:id  — revoke one session
═══════════════════════════════════════════════════════════════ */
router.delete(
  "/sessions/:id",
  authenticate,
  writeLimiter,
  async (req, res) => {
    const userId    = req.user?.id;
    const sessionId = req.params.id;
    const ip        = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");
    if (!isValidUuid(sessionId)) return fail(res, 400, "Invalid session ID.");

    const currentHash = hashToken(extractToken(req) ?? "");

    try {
      const { rows } = await pool.query(
        `DELETE FROM user_sessions
         WHERE id = $1 AND user_id = $2
         RETURNING token_hash, device_name`,
        [sessionId, userId]
      );

      if (!rows.length) return fail(res, 404, "Session not found.");

      if (rows[0].token_hash === currentHash)
        return fail(
          res, 400,
          "Cannot revoke your current session. Use Log Out instead."
        );

      setImmediate(() => {
        writeAudit({
          actorId    : userId,
          action     : "session_revoked",
          targetType : "user",
          targetId   : userId,
          metadata   : { device: rows[0].device_name, session_id: sessionId },
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, { message: "Session revoked." });

    } catch (err) {
      console.error("[settings] DELETE /sessions/:id:", err.message);
      return fail(res, 500, "Failed to revoke session.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/settings/sessions  — revoke ALL except current
═══════════════════════════════════════════════════════════════ */
router.delete(
  "/sessions",
  authenticate,
  writeLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const currentHash = hashToken(extractToken(req) ?? "");

    try {
      const { rowCount } = await pool.query(
        `DELETE FROM user_sessions
         WHERE user_id = $1 AND token_hash <> $2`,
        [userId, currentHash]
      );

      setImmediate(() => {
        writeAudit({
          actorId    : userId,
          action     : "all_sessions_revoked",
          targetType : "user",
          targetId   : userId,
          metadata   : { count: rowCount },
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, {
        message : `${rowCount} other session${rowCount !== 1 ? "s" : ""} logged out.`,
        count   : rowCount,
      });

    } catch (err) {
      console.error("[settings] DELETE /sessions:", err.message);
      return fail(res, 500, "Failed to revoke sessions.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /api/settings/logout
   ─────────────────────────────────────────────────────────────
   Also called by App.jsx via DELETE /api/users/me which sets
   is_online = false.  This endpoint handles the session row
   deletion and the audit log entry.

   Both endpoints can be hit simultaneously — both are safe
   to call independently or together:
     DELETE /api/users/me   → is_online = false
     POST /api/settings/logout → deletes session row + audit
═══════════════════════════════════════════════════════════════ */
router.post(
  "/logout",
  authenticate,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    const token  = extractToken(req);

    try {
      /* Remove this device's session */
      if (token) {
        await pool.query(
          "DELETE FROM user_sessions WHERE token_hash = $1",
          [hashToken(token)]
        );
      }

      /* Mark user offline */
      if (userId) {
        await pool.query(
          `UPDATE public.users
           SET is_online = false
           WHERE id = $1`,
          [userId]
        );
      }

      setImmediate(() => {
        writeAudit({
          actorId    : userId,
          action     : "logout",
          targetType : "user",
          targetId   : userId,
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, { message: "Logged out successfully." });

    } catch (err) {
      console.error("[settings] POST /logout:", err.message);
      /* Always succeed from the client's perspective */
      return ok(res, { message: "Logged out." });
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/settings/delete-account
   ─────────────────────────────────────────────────────────────
   Flow:
     1. Verify password + "delete" confirmation word
     2. Mark status = 'pending_deletion'
     3. Set deletion_scheduled_at = NOW() + 60 days
     4. Pause all active listings
     5. Revoke ALL sessions → forces logout everywhere
     6. Audit log

   The user is NOT hard-deleted here.
   A nightly cron job handles hard deletion after 60 days.
   If the user logs in before then, offer /restore-account.
═══════════════════════════════════════════════════════════════ */
router.delete(
  "/delete-account",
  authenticate,
  deleteLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const { password, confirm } = req.body;

    if (!password)
      return fail(res, 400, "Password is required to delete your account.");

    if (String(confirm ?? "").trim().toLowerCase() !== "delete")
      return fail(res, 400, 'Type "delete" to confirm account deletion.');

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT password_hash, email, name, status
         FROM public.users WHERE id = $1
         FOR UPDATE`,
        [userId]
      );

      if (!rows.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "User not found.");
      }

      /* Already scheduled — return current state rather than erroring */
      if (rows[0].status === "pending_deletion") {
        await client.query("ROLLBACK");
        const { rows: cur } = await pool.query(
          "SELECT deletion_scheduled_at FROM public.users WHERE id = $1",
          [userId]
        );
        return fail(
          res, 409,
          "Your account is already scheduled for deletion.",
          {
            scheduled_at   : cur[0]?.deletion_scheduled_at,
            days_remaining : daysRemaining(cur[0]?.deletion_scheduled_at),
          }
        );
      }

      const valid = await bcrypt.compare(password, rows[0].password_hash);
      if (!valid) {
        await client.query("ROLLBACK");
        return fail(res, 401, "Password is incorrect.");
      }

      const scheduledAt = daysFromNow(DELETION_GRACE_DAYS);

      /* Mark account pending deletion */
      await client.query(
        `UPDATE public.users
         SET status                = 'pending_deletion',
             deletion_requested_at = NOW(),
             deletion_scheduled_at = $1,
             is_online             = false,
             updated_at            = NOW()
         WHERE id = $2`,
        [scheduledAt, userId]
      );

      /* Pause all active listings — they stay in DB during grace period */
      await client.query(
        `UPDATE products
         SET is_active  = FALSE,
             status     = 'paused',
             updated_at = NOW()
         WHERE seller_id = $1
           AND status NOT IN ('deleted', 'paused')`,
        [userId]
      );

      /* Revoke ALL sessions — logs user out on every device */
      await client.query(
        "DELETE FROM user_sessions WHERE user_id = $1",
        [userId]
      );

      await client.query("COMMIT");

      setImmediate(() => {
        writeAudit({
          actorId    : userId,
          action     : "account_deletion_requested",
          targetType : "user",
          targetId   : userId,
          metadata   : {
            email        : rows[0].email,
            scheduled_at : scheduledAt.toISOString(),
            grace_days   : DELETION_GRACE_DAYS,
          },
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, {
        message:
          `Your account has been scheduled for deletion. ` +
          `It will be permanently removed after ${DELETION_GRACE_DAYS} days. ` +
          `You can restore it by logging in before the deletion date.`,
        scheduled_at   : scheduledAt.toISOString(),
        days_remaining : DELETION_GRACE_DAYS,
        can_restore    : true,
        logged_out     : true,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[settings] DELETE /delete-account:", err.message);
      Sentry.captureException(err, {
        tags: { route: "settings_delete_account" },
      });
      return fail(res, 500, "Account deletion failed. Please try again.");
    } finally {
      client.release();
    }
  }
);

/* ═══════════════════════════════════════════════════════════════
   POST /api/settings/restore-account
   ─────────────────────────────────────────────────────────────
   Flow:
     1. Confirm account is in pending_deletion state
     2. Confirm grace period has not expired
     3. Restore status to 'active'
     4. Clear deletion fields
     5. Restore listings that were paused at deletion time
     6. Audit log
═══════════════════════════════════════════════════════════════ */
router.post(
  "/restore-account",
  authenticate,
  restoreLimiter,
  async (req, res) => {
    const userId = req.user?.id;
    const ip     = getIp(req);
    if (!userId) return fail(res, 401, "Not authenticated.");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT status, deletion_scheduled_at, deletion_requested_at, restore_count
         FROM public.users
         WHERE id = $1
         FOR UPDATE`,
        [userId]
      );

      if (!rows.length) {
        await client.query("ROLLBACK");
        return fail(res, 404, "User not found.");
      }

      const user = rows[0];

      if (user.status !== "pending_deletion") {
        await client.query("ROLLBACK");
        return fail(res, 400, "Your account is not scheduled for deletion.");
      }

      /* Grace period has already passed */
      if (
        user.deletion_scheduled_at &&
        new Date(user.deletion_scheduled_at) <= new Date()
      ) {
        await client.query("ROLLBACK");
        return fail(
          res, 410,
          "The restoration window has passed. " +
          "Your account can no longer be recovered."
        );
      }

      /* Restore account */
      await client.query(
        `UPDATE public.users
         SET status                = 'active',
             deletion_requested_at = NULL,
             deletion_scheduled_at = NULL,
             deletion_reason       = NULL,
             restored_at           = NOW(),
             restore_count         = restore_count + 1,
             updated_at            = NOW()
         WHERE id = $1`,
        [userId]
      );

      /*
        Only restore listings that were paused when the deletion was
        requested — avoids accidentally reactivating listings that were
        paused for unrelated reasons (e.g. policy violations).
      */
      const { rowCount: restoredListings } = await client.query(
        `UPDATE products
         SET is_active  = TRUE,
             status     = 'active',
             updated_at = NOW()
         WHERE seller_id  = $1
           AND status     = 'paused'
           AND updated_at >= $2`,
        [userId, user.deletion_requested_at]
      );

      await client.query("COMMIT");

      setImmediate(() => {
        writeAudit({
          actorId    : userId,
          action     : "account_restored",
          targetType : "user",
          targetId   : userId,
          metadata   : {
            restore_count     : (user.restore_count ?? 0) + 1,
            listings_restored : restoredListings,
          },
          ipAddress  : ip,
        }).catch(() => {});
      });

      return ok(res, {
        message:
          "Welcome back! Your account has been fully restored. " +
          `${restoredListings} listing${restoredListings !== 1 ? "s" : ""} ` +
          "have been reactivated.",
        listings_restored : restoredListings,
        restore_count     : (user.restore_count ?? 0) + 1,
      });

    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[settings] POST /restore-account:", err.message);
      Sentry.captureException(err, {
        tags: { route: "settings_restore_account" },
      });
      return fail(res, 500, "Account restoration failed. Please try again.");
    } finally {
      client.release();
    }
  }
);

export default router;