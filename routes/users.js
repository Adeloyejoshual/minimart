// routes/users.js
import express from "express";
import { pool } from "../server.js";
import bcrypt from "bcrypt";
import { sendMail } from "../utils/email.js"; // your nodemailer Gmail setup
import crypto from "crypto";

const router = express.Router();

// -------------------
// Register User
// -------------------
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Check if user exists
    const { rows: existing } = await pool.query(
      "SELECT id FROM public.users WHERE email=$1",
      [email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate 6-digit verification code
    const verification_code = Math.floor(100000 + Math.random() * 900000).toString();

    // Insert user
    const { rows } = await pool.query(
      `INSERT INTO public.users (name, email, password_hash, verification_code)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, email_verified`,
      [name.trim(), email.trim(), password_hash, verification_code]
    );

    // Send verification email
    const emailSent = await sendMail(
      email,
      "MiniMart Email Verification",
      `Hello ${name},\n\nYour verification code is: ${verification_code}\n\nThank you!`
    );

    if (!emailSent) {
      return res.status(500).json({ message: "Failed to send verification email" });
    }

    res.status(201).json({
      message: "Registration successful. Check your email for the verification code.",
      user: rows[0],
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// -------------------
// Login User
// -------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const { rows } = await pool.query(
      "SELECT id, name, email, password_hash, email_verified FROM public.users WHERE email=$1",
      [email]
    );
    if (rows.length === 0) return res.status(400).json({ message: "Invalid credentials" });

    const user = rows[0];

    // Check password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.email_verified) return res.status(400).json({ message: "Email not verified" });

    res.json({ message: "Login successful", user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// -------------------
// Verify Email
// -------------------
router.post("/verify", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and code required" });

    const { rows } = await pool.query(
      "SELECT id, email_verified, verification_code FROM public.users WHERE email=$1",
      [email]
    );
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    if (user.email_verified) return res.status(400).json({ message: "Email already verified" });
    if (user.verification_code !== code) return res.status(400).json({ message: "Invalid verification code" });

    // Update user
    await pool.query(
      "UPDATE public.users SET email_verified=true, verification_code=NULL, updated_at=now() WHERE email=$1",
      [email]
    );

    res.json({ message: "Email successfully verified" });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

export default router;