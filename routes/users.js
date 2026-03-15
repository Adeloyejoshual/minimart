// routes/users.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../server.js";

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// -------------------
// Register
// -------------------
router.post("/register", async (req, res) => {
  const { name, email, password, phone_number, country, state, city } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "All fields are required" });

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const query = `
      INSERT INTO public.users (name, email, password_hash, phone_number, country, state, city)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, phone_number, country, state, city
    `;
    const { rows } = await pool.query(query, [name, email, hashedPassword, phone_number, country, state, city]);
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Email or phone already registered" });
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// -------------------
// Login
// -------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, password_hash, phone_number, country, state, city FROM public.users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// -------------------
// Get current user (protected route)
// -------------------
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, phone_number, country, state, city, profile_image, store_name, store_description, store_logo, store_verified, status, last_login, balance FROM public.users WHERE id = $1",
      [id]
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// -------------------
// Update user profile
// -------------------
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phone_number, country, state, city, profile_image, store_name, store_description, store_logo } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE public.users
       SET name=$1, phone_number=$2, country=$3, state=$4, city=$5,
           profile_image=$6, store_name=$7, store_description=$8, store_logo=$9,
           updated_at=now()
       WHERE id=$10
       RETURNING id, name, email, phone_number, country, state, city, profile_image, store_name, store_description, store_logo`,
      [name, phone_number, country, state, city, profile_image, store_name, store_description, store_logo, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
});

export default router;