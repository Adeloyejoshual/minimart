// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";
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

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // Fetch user using Prisma
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, email_verified: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    req.user = user;
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