// routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import prisma from "../prisma.js"; // Prisma client
import { sendMail } from "../email/sendMail.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ---------------- SIGNUP ----------------
router.post("/signup", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const verification_code = randomBytes(16).toString("hex");

    const user = await prisma.users.create({
      data: {
        name,
        email,
        password_hash: hashed,
        role: role || "buyer",
        verification_code,
      },
      select: { id: true, name: true, email: true, role: true },
    });

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
    if (err.code === "P2002") return res.status(400).json({ message: "Email already exists" }); // Prisma unique violation
    console.error(err);
    res.status(500).json({ message: "Signup failed" });
  }
});

// ---------------- LOGIN ----------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Missing fields" });

  try {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.email_verified) return res.status(403).json({ message: "Please verify your email first" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
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
    const user = await prisma.users.findFirst({ where: { email, verification_code: code } });
    if (!user) return res.status(400).send("Invalid or expired code.");
    if (user.email_verified) return res.send("Email already verified!");

    await prisma.users.update({
      where: { id: user.id },
      data: { email_verified: true, verification_code: null },
    });

    res.send("Email verified successfully! You can now log in.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Verification failed.");
  }
});

// ---------------- Protected route example ----------------
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Missing token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ user });
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

export default router;