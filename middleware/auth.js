// middleware/auth.js
import jwt      from "jsonwebtoken";
import { pool } from "../server.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ════════════════════════════════════════════════════════════
// authenticate
// Used by general routes — checks public.users
// ════════════════════════════════════════════════════════════
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token   = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // ── Check public.users (marketplace buyers) ───────────
    const { rows: pubRows } = await pool.query(
      `SELECT id, name, email, status FROM public.users WHERE id = $1`,
      [decoded.id]
    );

    if (pubRows.length) {
      const user = pubRows[0];
      if (user.status === "banned" || user.status === "suspended") {
        return res.status(403).json({ message: "Account suspended" });
      }
      req.user = user;
      return next();
    }

    // ── Fall back to market.users (seller accounts) ───────
    const { rows: mktRows } = await pool.query(
      `SELECT id, name, email, status FROM market.users WHERE id = $1`,
      [decoded.id]
    );

    if (mktRows.length) {
      const user = mktRows[0];
      if (user.status === "banned" || user.status === "suspended") {
        return res.status(403).json({ message: "Account suspended" });
      }
      req.user = user;
      return next();
    }

    return res.status(401).json({ message: "User not found" });

  } catch (err) {
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    return res.status(500).json({ message: "Auth error" });
  }
};

// ════════════════════════════════════════════════════════════
// softAuth — never blocks
// ════════════════════════════════════════════════════════════
export const softAuth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token   = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      // Check public.users first
      const { rows: pub } = await pool.query(
        `SELECT id, name, email, status FROM public.users WHERE id = $1`,
        [decoded.id]
      );

      if (pub.length && pub[0].status === "active") {
        req.user = pub[0];
      } else {
        // Check market.users
        const { rows: mkt } = await pool.query(
          `SELECT id, name, email, status FROM market.users WHERE id = $1`,
          [decoded.id]
        );
        if (mkt.length && mkt[0].status === "active") {
          req.user = mkt[0];
        }
      }
    }
  } catch {
    // Silently ignore
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export default authenticate;