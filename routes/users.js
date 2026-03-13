// routes/users.js
import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../server.js";

const router = express.Router();

// POST /api/users/register
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'user') RETURNING id, name, email, role`,
      [name, email, hashedPassword]
    );

    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error("Registration error:", err);
    // If email already exists, PostgreSQL throws a UNIQUE violation
    if (err.code === "23505") {
      return res.status(400).json({ message: "Email already registered" });
    }
    res.status(500).json({ message: "Registration failed" });
  }
});

export default router;