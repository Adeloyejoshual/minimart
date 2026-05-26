// controllers/auth.controller.js
import bcrypt    from "bcryptjs";
import jwt       from "jsonwebtoken";
import { pool }  from "../config/db.js";

// ── POST /api/auth/register ───────────────────────────────────
export const register = async (req, res) => {
  const { name, email, phone, password } = req.body;

  // ── Basic validation ────────────────────────────────────────
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, email and password are required",
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

    // ── Check duplicate email ───────────────────────────────
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

    // ── Hash password ───────────────────────────────────────
    const password_hash = await bcrypt.hash(password, 12);

    // ── Insert user ─────────────────────────────────────────
    const { rows: [user] } = await client.query(
      `INSERT INTO market.users
         (name, email, password_hash, phone_number)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone_number, status, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        password_hash,
        phone?.trim() ?? null,
      ]
    );

    await client.query("COMMIT");

    // ── Sign JWT ────────────────────────────────────────────
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
    );

    res.status(201).json({
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
    next(err);
  } finally {
    client.release();
  }
};

// ── POST /api/auth/login ──────────────────────────────────────
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  try {
    // Fetch user
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, status
       FROM market.users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = rows[0];

    // Check status
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        code:    "ACCOUNT_SUSPENDED",
        message: "Your account has been suspended",
      });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" }
    );

    res.json({
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
    next(err);
  }
};