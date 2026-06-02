// routes/sellerAuth.routes.js
import express from "express";
import bcrypt  from "bcrypt";
import jwt     from "jsonwebtoken";
import { pool } from "../server.js";

const router = express.Router();

const JWT_SECRET     = process.env.JWT_SECRET     || "supersecretkey";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ── In-memory rate limiter ────────────────────────────────────
const _attempts = new Map();

const authLimiter = (req, res, next) => {
  const ip  =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket.remoteAddress ??
    "unknown";

  const now = Date.now();
  const key = `auth:${ip}`;
  let   rec = _attempts.get(key);

  if (!rec || now - rec.time > 15 * 60_000) {
    rec = { count: 1, time: now };
  } else {
    rec.count++;
  }

  _attempts.set(key, rec);

  if (rec.count > 10) {
    return res.status(429).json({
      success:    false,
      message:    "Too many attempts. Try again in 15 minutes.",
      retryAfter: Math.ceil((15 * 60_000 - (now - rec.time)) / 1000),
    });
  }

  next();
};

// ════════════════════════════════════════════════════════════
// POST /api/auth/register
// ════════════════════════════════════════════════════════════
router.post("/register", authLimiter, async (req, res) => {
  // ── Log incoming body for debugging ──────────────────────
  console.log("[register] body:", {
    name:  req.body?.name,
    email: req.body?.email,
    phone: req.body?.phone,
    hasPassword: !!req.body?.password,
  });

  const { name, email, phone, password } = req.body;

  // ── Validate required fields ──────────────────────────────
  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: "Name is required" });
  }
  if (!email?.trim()) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }
  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Check for duplicate email ─────────────────────────
    const { rows: existing } = await client.query(
      `SELECT id FROM market.users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (existing.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        code:    "EMAIL_TAKEN",
        message: "An account with this email already exists",
      });
    }

    // ── Hash password ─────────────────────────────────────
    const password_hash = await bcrypt.hash(password, 12);

    // ── Insert user ───────────────────────────────────────
    const { rows: [user] } = await client.query(
      `INSERT INTO market.users
         (name, email, password_hash, phone_number, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, name, email, phone_number, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        password_hash,
        phone?.trim() ?? null,
      ]
    );

    await client.query("COMMIT");

    console.log("[register] success — user id:", user.id);

    // ── Sign JWT ──────────────────────────────────────────
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully!",
      token,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        phone: user.phone_number,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK");

    // ── Detailed error logging ────────────────────────────
    console.error("[register] DB error:", {
      message: err.message,
      code:    err.code,
      detail:  err.detail,
      table:   err.table,
    });

    // ── Handle known DB error codes ───────────────────────
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        code:    "EMAIL_TAKEN",
        message: "An account with this email already exists",
      });
    }

    if (err.code === "42P01") {
      // Table does not exist
      return res.status(500).json({
        success: false,
        code:    "TABLE_MISSING",
        message: "Database not initialized. Contact support.",
      });
    }

    if (err.code === "3D000") {
      // Schema does not exist
      return res.status(500).json({
        success: false,
        code:    "SCHEMA_MISSING",
        message: "Database schema not found. Contact support.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });

  } finally {
    client.release();
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/auth/login
// ════════════════════════════════════════════════════════════
router.post("/login", authLimiter, async (req, res) => {
  console.log("[login] attempt:", req.body?.email);

  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status
       FROM market.users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // Generic message — prevents user enumeration
    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = rows[0];

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        code:    "ACCOUNT_SUSPENDED",
        message: "Your account has been suspended",
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log("[login] success — user id:", user.id);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
      },
    });

  } catch (err) {
    console.error("[login] DB error:", {
      message: err.message,
      code:    err.code,
    });

    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/auth/me  — verify token + return user
// ════════════════════════════════════════════════════════════
router.get("/me", async (req, res) => {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, name, email, phone_number, status, created_at
       FROM market.users WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user:    rows[0],
    });

  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;