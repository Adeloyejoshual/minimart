// src/routes/auth.js
import express from "express";
import { pool } from "../server.js";
import bcrypt from "bcrypt";

const router = express.Router();

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const hashed = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO public.users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, role, created_at
    `;
    const { rows } = await pool.query(query, [name, email, hashed]);

    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error("Signup error:", err);
    if (err.code === "23505") return res.status(400).json({ message: "Email already exists" });
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const { rows } = await pool.query("SELECT * FROM public.users WHERE email = $1", [email]);
    if (rows.length === 0) return res.status(400).json({ message: "Invalid credentials" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    // Simple session token (replace with JWT in production)
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;