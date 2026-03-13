import express from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../server.js";
import { sendMail } from "../utils/email.js";

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

    // Check if email already exists
    const existing = await pool.query("SELECT id FROM public.users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Generate email verification code
    const verification_code = Math.floor(100000 + Math.random() * 900000).toString();

    // Insert user (role default is 'user')
    const insertQuery = `
      INSERT INTO public.users (name, email, password_hash, verification_code, email_verified)
      VALUES ($1, $2, $3, $4, false)
      RETURNING id, name, email, email_verified
    `;
    const { rows } = await pool.query(insertQuery, [name, email, password_hash, verification_code]);

    // Send verification email
    await sendMail(
      email,
      "MiniMart Email Verification",
      `<p>Hello ${name},</p>
       <p>Your MiniMart verification code is: <b>${verification_code}</b></p>
       <p>Thank you for joining MiniMart!</p>`
    );

    res.status(201).json({ message: "Registration successful! Check your email for verification code", user: rows[0] });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// -------------------
// Verify Email
// -------------------
router.post("/verify", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and code are required" });

    const { rows } = await pool.query(
      "SELECT id, verification_code, email_verified FROM public.users WHERE email = $1",
      [email]
    );

    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    if (user.email_verified) return res.status(400).json({ message: "Email already verified" });

    if (user.verification_code !== code) return res.status(400).json({ message: "Invalid verification code" });

    // Mark email as verified
    await pool.query(
      "UPDATE public.users SET email_verified = true, verification_code = NULL WHERE id = $1",
      [user.id]
    );

    res.json({ message: "Email verified successfully!" });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

// -------------------
// Login User
// -------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const { rows } = await pool.query(
      "SELECT id, name, email, password_hash, email_verified FROM public.users WHERE email = $1",
      [email]
    );

    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    if (!user.email_verified) return res.status(403).json({ message: "Email not verified" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Incorrect password" });

    // Successful login (return basic user info; optionally add JWT token here)
    res.json({ message: "Login successful", user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;