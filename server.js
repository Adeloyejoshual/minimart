// server.js
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();

// -------------------
// CockroachDB
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
// Nodemailer
// -------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
});

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
app.get("/", (req, res) => res.send("MiniMart API running 🚀"));
app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 as status");
    res.json({ success: true, db: rows[0].status === 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Register new user
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  const hashed = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role`,
      [name.trim(), email.trim(), hashed]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ message: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// Login user
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [email.trim()]);
    if (!rows[0]) return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ message: "Invalid password" });

    // Return user info (in prod, generate JWT instead)
    res.json({ id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

// Send Gmail verification code
app.post("/api/send-code", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await sendVerificationEmail(email, code);
    // TODO: store code in DB/Redis with TTL
    res.json({ message: "Verification code sent", code }); // remove code in production
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send code" });
  }
});

// -------------------
// Start server
// -------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

export default app;