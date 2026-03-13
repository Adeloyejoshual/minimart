import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { pool } from "../server.js";

router.post("/login", async (req, res) => {

  const { email, password } = req.body;

  const { rows } = await pool.query(
    `SELECT * FROM users WHERE email=$1`,
    [email]
  );

  if (!rows.length) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const user = rows[0];

  if (!user.email_verified) {
    return res.status(403).json({
      message: "Verify your email first"
    });
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    return res.status(400).json({
      message: "Invalid credentials"
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    success: true,
    token
  });

});