import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../server.js";

const router = express.Router();

// REGISTER
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (name,email,password_hash,role)
       VALUES ($1,$2,$3,$4)`,
      [name, email, hash, "buyer"]
    );

    res.json({ message: "Registration successful" });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Registration failed"
    });

  }
});

// LOGIN
router.post("/login", async (req, res) => {

  const { email, password } = req.body;

  try {

    const { rows } = await pool.query(
      `SELECT * FROM users WHERE email=$1`,
      [email]
    );

    if (!rows.length)
      return res.status(400).json({ message: "Invalid credentials" });

    const user = rows[0];

    const valid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!valid)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Login failed"
    });

  }

});

export default router;