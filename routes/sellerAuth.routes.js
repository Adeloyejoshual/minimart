// routes/sellerAuth.routes.js
import express  from "express";
import bcrypt   from "bcrypt";
import jwt      from "jsonwebtoken";
import { pool } from "../server.js";

const router         = express.Router();
const JWT_SECRET     = process.env.JWT_SECRET     || "supersecretkey";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// ── Rate limiter ──────────────────────────────────────────────
const _attempts = new Map();

const authLimiter = (req, res, next) => {
  const ip  =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ??
    req.socket.remoteAddress ?? "unknown";
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
// Inserts into market.users ONLY
// ════════════════════════════════════════════════════════════
router.post("/register", authLimiter, async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: "Name is required" });
  }
  if (!email?.trim()) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }
  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required" });
  }
  if (password.length < 8) {
    return res.status(400).json({
      success: false, message: "Password must be at least 8 characters",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({
      success: false, message: "Enter a valid email address",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Check duplicate in market.users ONLY ─────────────
    const { rows: existing } = await client.query(
      `SELECT id FROM market.users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (existing.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        code:    "EMAIL_TAKEN",
        message: "A seller account with this email already exists",
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // ── INSERT into market.users only ─────────────────────
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

    console.log("[register] ✅ market.users created:", user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      success: true,
      message: "Seller account created successfully!",
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
    console.error("[register] ❌", {
      message: err.message,
      code:    err.code,
      detail:  err.detail,
    });

    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A seller account with this email already exists",
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
// Checks market.users ONLY
// ════════════════════════════════════════════════════════════
router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({
      success: false, message: "Email and password are required",
    });
  }

  try {
    // ── market.users ONLY ─────────────────────────────────
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status
       FROM market.users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "No seller account found with this email. Please create one.",
      });
    }

    const user = rows[0];

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        code:    "ACCOUNT_SUSPENDED",
        message: "Your seller account has been suspended",
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

    console.log("[login] ✅ market.users:", user.id);

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
    console.error("[login] ❌", err.message);
    return res.status(500).json({
      success: false, message: "Login failed. Please try again.",
    });
  }
});

// ════════════════════════════════════════════════════════════
// GET /api/auth/me
// Returns user from market.users ONLY
// ════════════════════════════════════════════════════════════
router.get("/me", async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false, message: "No token provided",
      });
    }

    const token   = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // ── market.users ONLY ─────────────────────────────────
    const { rows } = await pool.query(
      `SELECT id, name, email, phone_number, status, created_at
       FROM market.users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Seller account not found",
      });
    }

    return res.json({ success: true, user: rows[0] });

  } catch (err) {
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false, message: "Invalid or expired token",
      });
    }
    return res.status(500).json({
      success: false, message: "Server error",
    });
  }
});

export default router;