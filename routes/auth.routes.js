// routes/auth.routes.js
import express          from "express";
import { register, login } from "../controllers/auth.controller.js";
import rateLimit        from "express-rate-limit";

const router = express.Router();

// Rate limit auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      10,
  message:  { success: false, message: "Too many attempts. Try again later." },
});

// POST /api/auth/register
router.post("/register", authLimiter, register);

// POST /api/auth/login
router.post("/login", authLimiter, login);

export default router;