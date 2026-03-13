import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../server.js";
import { sendMail } from "../utils/sendMail.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await pool.query(
      `INSERT INTO users (name,email,password_hash,role,verification_code)
       VALUES ($1,$2,$3,$4,$5)`,
      [name, email, hashedPassword, "buyer", code]
    );

    await sendMail(
      email,
      "MiniMart Email Verification",
      `Your verification code is: ${code}`
    );

    res.json({
      success: true,
      message: "Verification code sent to email"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});

export default router;