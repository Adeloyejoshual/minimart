// routes/users.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../server.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const TOKEN_EXPIRES = "30d"; // long-lived token

// -------------------
// Register & login with token
// -------------------
router.post("/register", async (req, res) => {
  const { name, email, password, phone_number, country, state, city } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const query = `
      INSERT INTO public.users (name, email, password_hash, phone_number, country, state, city, last_login)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, name, email, phone_number, country, state, city, created_at
    `;
    const { rows } = await pool.query(query, [name, email, hashedPassword, phone_number, country, state, city]);

    const token = jwt.sign({ id: rows[0].id, email: rows[0].email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });

    res.status(201).json({ token, user: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Email or phone already registered" });
    }
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, phone_number, country, state, city, profile_image,
              store_name, store_description, store_logo
       FROM public.users WHERE email = $1`,
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    // Update last_login timestamp
    await pool.query("UPDATE public.users SET last_login=NOW() WHERE id=$1", [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// -------------------
// Get current logged-in user
// -------------------
router.get("/me", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, phone_number, country, state, city, profile_image,
              store_name, store_description, store_logo, store_verified, status,
              last_login, balance, created_at
       FROM public.users WHERE id = $1`,
      [req.user.id]
    );

    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Get current user error:", err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// -------------------
// Update current user profile
// -------------------
router.put("/me", authenticate, async (req, res) => {
  const { name, phone_number, country, state, city, profile_image, store_name, store_description, store_logo } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE public.users
       SET name=$1, phone_number=$2, country=$3, state=$4, city=$5,
           profile_image=$6, store_name=$7, store_description=$8, store_logo=$9,
           updated_at=NOW()
       WHERE id=$10
       RETURNING id, name, email, phone_number, country, state, city,
                 profile_image, store_name, store_description, store_logo`,
      [name, phone_number, country, state, city, profile_image, store_name, store_description, store_logo, req.user.id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Update user profile error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
});

export default router;