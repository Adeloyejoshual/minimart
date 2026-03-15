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

  if (!name || !email || !password || !phone_number || !country || !state || !city) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const query = `
      INSERT INTO public.users
      (name, email, password_hash, phone_number, country, state, city)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, name, email, phone_number, country, state, city, created_at
    `;

    const { rows } = await pool.query(query, [
      name, email, hashedPassword, phone_number, country, state, city,
    ]);

    const user = rows[0];

    // Create a long-lived token (1 year)
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "365d" });

    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === "23505") { // duplicate key
      return res.status(409).json({ message: "Email or phone already registered" });
    }
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
      `SELECT id, name, email, password_hash, phone_number, country, state, city FROM public.users WHERE email=$1`,
      [email]
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    // Long-lived token (1 year)
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "365d" });

    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;