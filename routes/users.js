// routes/users.js
import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../server.js";
import { sendMail } from "../utils/email.js";

const router = express.Router();

// -------------------
// REGISTER
// -------------------
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Check existing email
    const { rows: existing } = await pool.query(
      "SELECT id FROM users WHERE lower(email) = $1",
      [email.toLowerCase()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate 6-digit verification code
    const verification_code = Math.floor(100000 + Math.random() * 900000).toString();

    // Insert user
    const query = `
      INSERT INTO users (name, email, password_hash, role, email_verified, verification_code)
      VALUES ($1, $2, $3, 'user', false, $4)
      RETURNING id, name, email, email_verified
    `;
    const { rows } = await pool.query(query, [
      name.trim(),
      email.toLowerCase(),
      password_hash,
      verification_code
    ]);

    // Send verification email
    const html = `
      <h2>Welcome to MiniMart, ${name}!</h2>
      <p>Your verification code is: <strong>${verification_code}</strong></p>
      <p>Enter this code in the app to verify your email.</p>
    `;
    await sendMail(email, "MiniMart Email Verification", html);

    res.status(201).json({
      message: "Registration successful! Verification code sent to email.",
      user: rows[0]
    });
  } catch (err) {
    console.error("REGISTRATION ERROR:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// -------------------
// VERIFY EMAIL
// -------------------
router.post("/verify", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and code required" });

    const { rows } = await pool.query(
      "SELECT id, verification_code, email_verified FROM users WHERE lower(email) = $1",
      [email.toLowerCase()]
    );

    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    if (user.email_verified) return res.status(400).json({ message: "Email already verified" });

    if (user.verification_code !== code) return res.status(400).json({ message: "Invalid code" });

    await pool.query(
      "UPDATE users SET email_verified = true, verification_code = NULL, updated_at = now() WHERE id = $1",
      [user.id]
    );

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

// -------------------
// LOGIN
// -------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const { rows } = await pool.query(
      "SELECT id, name, email, password_hash, email_verified FROM users WHERE lower(email) = $1",
      [email.toLowerCase()]
    );

    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    if (!user.email_verified) return res.status(403).json({ message: "Email not verified" });

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ message: "Invalid password" });

    res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;