// routes/users.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../server.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

// ✅ Never send password_hash to client
const SAFE_USER_FIELDS = `
  id, name, email, phone_number, country, state, city,
  profile_image, store_name, store_description, store_logo,
  store_verified, status, last_login, balance, role,
  rating, trust_score, verified, products_count,
  total_sales, total_purchases, created_at
`;

const makeToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

// ✅ Normalize empty strings to null (prevents unique constraint crash on phone)
const nullIfEmpty = (val) => (val && val.trim() !== "" ? val.trim() : null);

/* ══════════════════════════════════════════
   REGISTER
══════════════════════════════════════════ */
router.post("/register", async (req, res) => {
  let { name, email, password, phone_number, country, state, city } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  // Sanitize
  name        = name.trim();
  email       = email.trim().toLowerCase();       // ✅ normalize email
  phone_number = nullIfEmpty(phone_number);       // ✅ null not "" — avoids unique crash
  country     = nullIfEmpty(country);
  state       = nullIfEmpty(state);
  city        = nullIfEmpty(city);

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows } = await pool.query(
      `INSERT INTO public.users
         (name, email, password_hash, phone_number, country, state, city, last_login)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING ${SAFE_USER_FIELDS}`,
      [name, email, hashedPassword, phone_number, country, state, city]
    );

    const user  = rows[0];
    const token = makeToken(user);

    // ✅ Return token immediately — no need for a second /login call
    return res.status(201).json({ token, user });

  } catch (err) {
    if (err.code === "23505") {
      // Figure out which field is duplicated
      const detail = err.detail || "";
      if (detail.includes("phone")) {
        return res.status(409).json({ message: "Phone number already registered" });
      }
      return res.status(409).json({ message: "Email already registered" });
    }
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

/* ══════════════════════════════════════════
   LOGIN
══════════════════════════════════════════ */
router.post("/login", async (req, res) => {
  let { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  // ✅ Normalize email so "User@Gmail.com" matches "user@gmail.com"
  email = email.trim().toLowerCase();

  try {
    const { rows } = await pool.query(
      // ✅ Only select password_hash here for comparison — NOT returned to client
      `SELECT id, name, email, password_hash, phone_number, country, state, city,
              profile_image, store_name, store_description, store_logo,
              store_verified, status, last_login, balance, role,
              rating, trust_score, verified, products_count,
              total_sales, total_purchases, created_at
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

    // ✅ Update last_login (fire and forget — don't await)
    pool.query("UPDATE public.users SET last_login = NOW() WHERE id = $1", [row.id])
      .catch((e) => console.error("last_login update failed:", e));

    // ✅ Strip password_hash before sending
    const { password_hash, ...user } = row;

    const token = makeToken(user);
    return res.json({ token, user });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

/* ══════════════════════════════════════════
   GET CURRENT USER  (protected)
══════════════════════════════════════════ */
router.get("/me", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${SAFE_USER_FIELDS} FROM public.users WHERE id = $1`,
      [req.user.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(rows[0]);

  } catch (err) {
    console.error("GET /me error:", err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

/* ══════════════════════════════════════════
   UPDATE PROFILE  (protected)
══════════════════════════════════════════ */
router.put("/me", authenticate, async (req, res) => {
  const {
    name, phone_number, country, state, city,
    profile_image, store_name, store_description, store_logo,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE public.users
       SET
         name              = COALESCE($1, name),
         phone_number      = $2,
         country           = $3,
         state             = $4,
         city              = $5,
         profile_image     = $6,
         store_name        = $7,
         store_description = $8,
         store_logo        = $9,
         updated_at        = NOW()
       WHERE id = $10
       RETURNING ${SAFE_USER_FIELDS}`,
      [
        name ? name.trim() : null,
        nullIfEmpty(phone_number),
        nullIfEmpty(country),
        nullIfEmpty(state),
        nullIfEmpty(city),
        nullIfEmpty(profile_image),
        nullIfEmpty(store_name),
        nullIfEmpty(store_description),
        nullIfEmpty(store_logo),
        req.user.id,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(rows[0]);

  } catch (err) {
    // Handle duplicate phone on update
    if (err.code === "23505" && (err.detail || "").includes("phone")) {
      return res.status(409).json({ message: "Phone number already in use" });
    }
    console.error("PUT /me error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

export default router;