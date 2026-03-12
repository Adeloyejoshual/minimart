import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../server.js";
import { sendMail } from "../email/sendMail.js"; // your Gmail OAuth2 sender
import { randomBytes } from "crypto";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ---------------- SIGNUP ----------------
router.post("/signup", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });

  try {
    const hashed = await bcrypt.hash(password, 10);

    // Generate email verification code
    const verification_code = randomBytes(16).toString("hex");

    const query = `
      INSERT INTO public.users (name, email, password_hash, role, verification_code)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role
    `;
    const { rows } = await pool.query(query, [name, email, hashed, role || "buyer", verification_code]);

    // Send verification email
    const html = `
      <div style="font-family: Arial; max-width:600px; margin:auto; padding:20px; border:1px solid #eee; border-radius:10px;">
        <h2 style="color:#0D6EFD;">Welcome to MiniMart!</h2>
        <p>Hello ${name},</p>
        <p>Click the button below to verify your email:</p>
        <a href="https://minimart-ivrm.onrender.com/api/auth/verify?code=${verification_code}&email=${encodeURIComponent(email)}"
           style="display:inline-block; padding:12px 20px; background-color:#0D6EFD; color:#fff; text-decoration:none; border-radius:6px;">
          Verify Email
        </a>
        <p style="margin-top:20px; font-size:12px; color:#555;">If you didn’t register, ignore this email.</p>
      </div>
    `;
    await sendMail(email, "Verify your MiniMart account", html);

    res.status(201).json({ message: "User registered! Check your email for verification." });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ message: "Email already exists" });
    console.error(err);
    res.status(500).json({ message: "Signup failed" });
  }
});

// ---------------- LOGIN ----------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Missing fields" });

  try {
    const { rows } = await pool.query("SELECT * FROM public.users WHERE email=$1", [email]);
    if (!rows[0]) return res.status(401).json({ message: "Invalid credentials" });

    // Check if email verified
    if (!rows[0].email_verified) return res.status(403).json({ message: "Please verify your email first" });

    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: rows[0].id, email: rows[0].email, role: rows[0].role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ---------------- EMAIL VERIFICATION ----------------
router.get("/verify", async (req, res) => {
  const { code, email } = req.query;
  if (!code || !email) return res.status(400).send("Invalid verification link.");

  try {
    const { rows } = await pool.query(
      "SELECT id, email_verified FROM public.users WHERE email=$1 AND verification_code=$2",
      [email, code]
    );

    if (rows.length === 0) return res.status(400).send("Invalid or expired code.");

    if (rows[0].email_verified) return res.send("Email already verified!");

    await pool.query(
      "UPDATE public.users SET email_verified=TRUE, verification_code=NULL WHERE email=$1",
      [email]
    );

    res.send("Email verified successfully! You can now log in.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Verification failed.");
  }
});

// ---------------- Protected route example ----------------
router.get("/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "Missing token" });

  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query("SELECT id, name, email, role FROM public.users WHERE id=$1", [decoded.id]);
    res.json({ user: rows[0] });
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

export default router;