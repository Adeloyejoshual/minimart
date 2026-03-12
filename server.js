// server.js
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import dotenv from "dotenv";
import crypto from "crypto";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();

// -------------------
// CockroachDB / PostgreSQL
// -------------------
export const pool = new Pool({
  connectionString: process.env.COCKROACH_URI,
  ssl: { rejectUnauthorized: false },
});

pool.connect()
  .then(() => console.log("✅ Connected to CockroachDB"))
  .catch(err => console.error("❌ CockroachDB connection error:", err.message));

// -------------------
// Middlewares
// -------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------
// Nodemailer setup
// -------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,        // Gmail email
    pass: process.env.GMAIL_PASSWORD,    // Gmail App Password
  },
});

// Utility to send verification email
const sendVerificationEmail = async (to, code) => {
  const html = `<p>Your MiniMart verification code is: <b>${code}</b></p>`;
  return transporter.sendMail({
    from: `"MiniMart" <${process.env.GMAIL_USER}>`,
    to,
    subject: "MiniMart Verification Code",
    text: `Your code is: ${code}`,
    html,
  });
};

// -------------------
// Routes
// -------------------

// Root / health
app.get("/", (req, res) => {
  res.send("MiniMart API running 🚀");
});

app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 as status");
    res.json({ success: true, db: rows[0].status === 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send verification code
app.post("/api/send-code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await sendVerificationEmail(email, code);

    // TODO: save code in DB or cache (Redis) for verification later
    res.json({ message: "Verification code sent", code }); // Remove code from response in production
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).json({ message: "Failed to send verification code" });
  }
});

// Example: get users (for testing)
app.get("/api/users", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, email, role FROM users ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// -------------------
// Start server
// -------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;