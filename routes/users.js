// routes/users.js
import express                          from "express";
import bcrypt                           from "bcrypt";
import jwt                              from "jsonwebtoken";
import { pool }                         from "../server.js";
import { authenticate }                 from "../middleware/auth.js";
import { cacheGet, cacheSet, cacheDel } from "../lib/redis.js";

const router      = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET  = process.env.JWT_SECRET || "supersecretkey";

/* ═══════════════════════════════════════════════════════════════
   REDIS
═══════════════════════════════════════════════════════════════ */
const KEY = {
  me: (userId) => `user:me:${userId}`,
};

const TTL = {
  ME: 5 * 60, // 5 minutes
};

const invalidateMeCache = (userId) =>
  cacheDel(KEY.me(userId)).catch(() => {});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

/* Every safe column returned to the client */
const SAFE_USER_FIELDS = `
  id,
  name,
  first_name,
  last_name,
  username,
  email,
  email_verified,

  phone_number,
  phone,
  phone_verified,
  phone_verified_at,
  phone_network,

  country,
  state,
  city,
  address,

  profile_image,
  cover_image,
  bio,
  gender,
  date_of_birth,

  store_name,
  store_slug,
  store_description,
  store_logo,
  store_banner,
  store_verified,
  store_category,

  status,
  "role",
  is_online,
  verified,
  identity_verified,
  trust_score,
  rating,

  seller_type,
  referral_code,
  bonus_spins,
  total_referrals,

  followers_count,
  following_count,
  products_count,
  active_products_count,
  profile_views,

  is_premium,
  premium_plan,
  premium_expires_at,

  subscription_plan,
  subscription_status,
  subscription_expires_at,

  total_sales,
  total_purchases,

  created_at,
  last_login
`;

const makeToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

/* Convert empty strings → null */
const nullIfEmpty = (val) =>
  val && String(val).trim() !== "" ? String(val).trim() : null;

/* Normalise any phone → 08012345678 */
const normalisePhone = (raw) => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

/* Validate Nigerian phone */
const isValidNgPhone = (phone) => {
  const digits = normalisePhone(phone);
  return !!digits && /^0[789][01]\d{8}$/.test(digits);
};

const VALID_NETWORKS = ["mtn", "airtel", "glo", "9mobile"];

/* ═══════════════════════════════════════════════════════════════
   SHAPE USER — add helper fields for the frontend
═══════════════════════════════════════════════════════════════ */
const shapeUser = (row) => {
  if (!row) return null;

  const registeredPhone = row.phone_number ? normalisePhone(row.phone_number) : null;
  const verifiedPhone   = row.phone        ? normalisePhone(row.phone)        : null;

  /* Priority:
       1. verified phone (via OTP)
       2. registered phone (from signup)
  */
  const bestPhone =
    (row.phone_verified && verifiedPhone) ? verifiedPhone :
    registeredPhone                       ? registeredPhone :
    verifiedPhone                         ? verifiedPhone :
    null;

  const phoneSource =
    (row.phone_verified && verifiedPhone) ? "verified"   :
    registeredPhone                       ? "registered" :
    verifiedPhone                         ? "unverified" :
    null;

  return {
    ...row,
    /* Normalised copies */
    phone_number : registeredPhone,
    phone        : verifiedPhone,

    /* Convenience fields for the client */
    best_phone   : bestPhone,
    best_network : row.phone_network || null,
    phone_source : phoneSource,
  };
};

/* ═══════════════════════════════════════════════════════════════
   REGISTER
═══════════════════════════════════════════════════════════════ */
router.post("/register", async (req, res) => {
  let { name, email, password, phone_number, country, state, city } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email and password are required" });
  }

  name         = name.trim();
  email        = email.trim().toLowerCase();
  phone_number = nullIfEmpty(phone_number);
  country      = nullIfEmpty(country);
  state        = nullIfEmpty(state);
  city         = nullIfEmpty(city);

  /* Normalise incoming phone */
  if (phone_number) phone_number = normalisePhone(phone_number);

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows } = await pool.query(
      `INSERT INTO public.users
         (name, email, password_hash, phone_number,
          country, state, city, last_login)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING ${SAFE_USER_FIELDS}`,
      [name, email, hashedPassword, phone_number, country, state, city]
    );

    const user  = shapeUser(rows[0]);
    const token = makeToken(user);

    return res.status(201).json({ token, user });

  } catch (err) {
    console.error("Register error code:",   err.code);
    console.error("Register error msg:",    err.message);
    console.error("Register error detail:", err.detail);

    if (err.code === "23505") {
      const detail = (err.detail || "").toLowerCase();
      if (detail.includes("phone")) {
        return res
          .status(409)
          .json({ message: "Phone number already registered" });
      }
      return res.status(409).json({ message: "Email already registered" });
    }

    return res.status(500).json({
      message : "Registration failed. Please try again.",
      debug   : process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
});

/* ═══════════════════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════════════════ */
router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  email = email.trim().toLowerCase();

  try {
    const { rows } = await pool.query(
      `SELECT ${SAFE_USER_FIELDS}, password_hash
       FROM public.users
       WHERE lower(email) = $1`,
      [email]
    );

    const row = rows[0];
    if (!row) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    /* Fire-and-forget last_login update */
    pool.query(
      "UPDATE public.users SET last_login = NOW(), is_online = true WHERE id = $1",
      [row.id]
    ).catch((e) => console.error("last_login update failed:", e));

    /* Strip password_hash then shape */
    const { password_hash, ...clean } = row;
    const user  = shapeUser(clean);
    const token = makeToken(user);

    /* Invalidate cache so next /me returns fresh */
    await invalidateMeCache(user.id);

    return res.json({ token, user });

  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Login failed. Please try again." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/users/me  (protected + cached)
═══════════════════════════════════════════════════════════════ */
router.get("/me", authenticate, async (req, res) => {
  const userId = req.user.id;

  try {
    /* ── Try cache ── */
    const cached = await cacheGet(KEY.me(userId));
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    /* ── DB ── */
    const { rows } = await pool.query(
      `SELECT ${SAFE_USER_FIELDS}
       FROM   public.users
       WHERE  id = $1
       LIMIT  1`,
      [userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = shapeUser(rows[0]);

    /* ── Cache ── */
    await cacheSet(KEY.me(userId), user, TTL.ME);

    /* Return user directly (matches your 