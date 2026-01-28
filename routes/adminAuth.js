import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

// POST /api/admin/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Simple validation
  if (!username || !password) return res.status(400).json({ message: "Username and password required" });

  // Check password against environment variable
  if (password !== process.env.SUPERADMIN_PASSWORD) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Create JWT token (expires in 1 hour)
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "1h" });

  res.json({ message: "Login successful", token });
});

export default router;