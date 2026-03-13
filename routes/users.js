import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../server.js";

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  try {
    // Check if user already exists
    const { rows: existing } = await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );
    if (existing.length) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Insert user with default role "user"
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name.trim(), email.trim(), hash, "user"] // always "user" here
    );

    res.status(201).json({ message: "Registration successful", user: rows[0] });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

export default router;