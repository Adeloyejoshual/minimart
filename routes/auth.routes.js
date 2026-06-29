/**
 * routes/auth.routes.js
 *
 * POST /api/auth/register
 * POST /api/auth/login
 */

import express   from "express";
import bcrypt    from "bcrypt";
import jwt       from "jsonwebtoken";
import rateLimit from "express-rate-limit";

import { pool }                        from "../config/db.js";
import { writeAudit }                  from "../lib/audit.js";
import { sendEmailVerificationOtp }    from "../services/email.js";

const router  = express.Router();
const IS_PROD = process.env.NODE_ENV === "production";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const HASH_ROUNDS        = 12;
const OTP_EXPIRY_MINUTES = 15;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const getIp = (req) =>
  req.ip ??
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
  req.socket?.remoteAddress ??
  null;

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

/** Always trim + lowercase — mirrors AuthPage normalizeEmail() */
const normalizeEmail = (raw = "") => raw.trim().toLowerCase();

/** Stricter regex — matches frontend EMAIL_RE exactly */
const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isValidEmail = (email) => EMAIL_RE.test(email);

/** Safe user fields — never expose password_hash */
const SAFE_FIELDS = `
  id, name, email, phone_number,
  country, state, city,
  profile_image, store_name, store_description, store_logo,
  store_verified, status, last_login,
  rating, trust_score, verified, products_count,
  total_sales, total_purchases, created_at,
  "role", is_online, email_verified, identity_verified, seller_type
`;

const makeJwt = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role ?? null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
  );

/** 6-digit numeric OTP */
const generateOtp = () => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100_000 + (array[0] % 900_000));
};

/** SHA-256 hash OTP before storing — never store raw */
const hashOtp = (raw) =>
  crypto.createHash("sha256").update(String(raw)).digest("hex");

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITERS
═══════════════════════════════════════════════════════════════ */
const mkLimiter = ({ windowMin, max, message }) =>
  rateLimit({
    windowMs        : windowMin * 60 * 1_000,
    max             : IS_PROD ? max : max * 50,
    standardHeaders : true,
    legacyHeaders   : false,
    keyGenerator    : (req) => String(req.user?.id ?? getIp(req)),
    handler         : (_req, res) =>
      res.status(429).json({ success: false, message }),
  });

const authLimiter = mkLimiter({
  windowMin : 15,
  max       : 10,
  message   : "Too many attempts. Please try again later.",
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/register
═══════════════════════════════════════════════════════════════ */
router.post("/register", authLimiter, async (req, res, next) => {
  const {
    name, email, password,
    phone_number, country, state, city,
  } = req.body;

  /* ── Basic presence ── */
  if (!name || !email || !password)
    return fail(res, 400, "Name, email and password are required.");

  /* ── Name ── */
  if (typeof name !== "string" || name.trim().length < 2)
    return fail(res, 400, "Name must be at least 2 characters.");

  /* ── Normalize + validate email ── */
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail))
    return fail(res, 400, "Please enter a valid email address.");

  /* ── Password strength — matches frontend getStrength() ── */
  if (password.length < 8)
    return fail(res, 400, "Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password))
    return fail(res, 400, "Password must contain at least one uppercase letter.");
  if (!/[0-9]/.test(password))
    return fail(res, 400, "Password must contain at least one number.");

  const cleanName  = name.trim();
  const cleanPhone = phone_number?.trim() || null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* ── Check existing email ── */
    const { rows: existing } = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [cleanEmail]
    );
    if (existing.length) {
      await client.query("ROLLBACK");
      return fail(res, 409, "An account with this email already exists.", {
        code: "EMAIL_TAKEN",
      });
    }

    /* ── Hash password ── */
    const password_hash = await bcrypt.hash(password, HASH_ROUNDS);

    /* ── Insert user ── */
    const { rows: [user] } = await client.query(
      `INSERT INTO users
         (name, email, password_hash, phone_number, country, state, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SAFE_FIELDS}`,
      [
        cleanName, cleanEmail, password_hash, cleanPhone,
        country ?? null, state ?? null, city ?? null,
      ]
    );

    await client.query("COMMIT");

    /* ── Generate JWT ── */
    const token = makeJwt(user);

    /* ── Generate + store email verification OTP ── */
    const rawOtp  = generateOtp();
    const otpHash = hashOtp(rawOtp);

    await pool.query(
      `INSERT INTO email_verification_otps
         (user_id, otp_hash, expires_at)
       VALUES
         ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL)`,
      [user.id, otpHash, String(OTP_EXPIRY_MINUTES)]
    );

    /* ── Send verification email ── */
    let emailSent = true;
    try {
      await sendEmailVerificationOtp({
        to     : user.email,
        name   : user.name,
        otp    : rawOtp,
        expiry : OTP_EXPIRY_MINUTES,
      });
      console.log(`[auth] ✓ verification OTP email sent → ${user.email}`);
    } catch (mailErr) {
      emailSent = false;
      console.error("[auth] verification email send failed:", mailErr.message);
    }

    /* ── Always print OTP in dev console ── */
    if (!IS_PROD) {
      console.log("\n" + "═".repeat(60));
      console.log("[auth] 🔑  EMAIL VERIFICATION OTP (dev mode)");
      console.log(`   Email : ${user.email}`);
      console.log(`   OTP   : ${rawOtp}`);
      console.log(`   Exp   : ${OTP_EXPIRY_MINUTES} minutes`);
      console.log("═".repeat(60) + "\n");
    }

    writeAudit({
      actorId    : user.id,
      action     : "user_registered",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : getIp(req),
    }).catch(console.error);

    console.log(`[auth] ✓ register  user=${user.id}  email=${cleanEmail}`);

    /* ── Response ── */
    const response = {
      success : true,
      message : "Account created successfully.",
      token,
      user,
    };

    /* Dev only — expose OTP in response if email failed */
    if (!IS_PROD && !emailSent) {
      response.dev_otp  = rawOtp;
      response.dev_hint = "Email failed in dev — use the OTP printed in your server console.";
    }

    return res.status(201).json(response);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    if (err.code === "23505") {
      const detail = (err.detail ?? "").toLowerCase();
      if (detail.includes("phone"))
        return fail(res, 409, "Phone number already registered.", {
          code: "PHONE_TAKEN",
        });
      return fail(res, 409, "An account with this email already exists.", {
        code: "EMAIL_TAKEN",
      });
    }

    console.error("[auth] register error:", err.message);
    next(err);
  } finally {
    client.release();
  }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/auth/login
═══════════════════════════════════════════════════════════════ */
router.post("/login", authLimiter, async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return fail(res, 400, "Email and password are required.");

  /* ── Normalize + validate email ── */
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail))
    return fail(res, 400, "Please enter a valid email address.");

  try {
    const { rows } = await pool.query(
      `SELECT ${SAFE_FIELDS}, password_hash FROM users WHERE email = $1`,
      [cleanEmail]
    );

    /* Generic message — never reveal whether email exists */
    if (!rows.length)
      return fail(res, 401, "Invalid email or password.");

    const row = rows[0];

    /* ── Check account status ── */
    if (row.status === "flagged" || row.status === "banned") {
      return fail(res, 403, "Your account has been suspended. Contact support.", {
        code: "ACCOUNT_SUSPENDED",
      });
    }

    /* ── Verify password ── */
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid)
      return fail(res, 401, "Invalid email or password.");

    /* ── Update last_login + online status (fire-and-forget) ── */
    pool.query(
      "UPDATE users SET last_login = NOW(), is_online = true WHERE id = $1",
      [row.id]
    ).catch((e) => console.error("[auth] last_login update failed:", e.message));

    const { password_hash, ...user } = row;
    const token = makeJwt(user);

    writeAudit({
      actorId    : user.id,
      action     : "user_login",
      targetType : "user",
      targetId   : user.id,
      ipAddress  : getIp(req),
    }).catch(console.error);

    console.log(`[auth] ✓ login  user=${user.id}  email=${cleanEmail}`);

    return res.json({
      success : true,
      message : "Login successful.",
      token,
      user,
    });

  } catch (err) {
    console.error("[auth] login error:", err.message);
    next(err);
  }
});

export default router;