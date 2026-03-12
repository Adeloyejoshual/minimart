// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { pool } from "../server.js"; // your pg pool
import dotenv from "dotenv";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // Fetch user from DB
    const { rows } = await pool.query(
      "SELECT id, name, email, email_verified FROM public.users WHERE id=$1",
      [decoded.id]
    );

    if (!rows[0]) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    // Attach user to request
    req.user = rows[0];
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    console.error("Auth middleware error:", error.message);
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

export default auth;