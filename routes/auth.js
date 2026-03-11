import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../server.js"; // your pg pool

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ---------------- SIGNUP ----------------
router.post("/signup", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO public.users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
    `;
    const { rows } = await pool.query(query, [name, email, hashed, role || "buyer"]);

    const token = jwt.sign({ id: rows[0].id, email: rows[0].email, role: rows[0].role }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ user: rows[0], token });
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

    const match = await bcrypt.compare(password, rows[0].password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: rows[0].id, email: rows[0].email, role: rows[0].role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
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