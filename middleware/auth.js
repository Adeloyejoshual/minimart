// middleware/auth.js
import jwt      from "jsonwebtoken";
import { pool } from "../server.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ── Hard auth ─────────────────────────────────────────────────
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token   = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    let user = null;

    // ── 1. Check market.users (seller accounts) ───────────
    try {
      const { rows } = await pool.query(
        `SELECT id, name, email, status
         FROM market.users
         WHERE id = $1`,
        [decoded.id]
      );
      if (rows.length) user = rows[0];
    } catch (e) {
      console.warn("[auth] market.users:", e.message);
    }

    // ── 2. Fall back to public.users (marketplace buyers) ─
    if (!user) {
      try {
        const { rows } = await pool.query(
          `SELECT id, name, email, status
           FROM public.users
           WHERE id = $1`,
          [decoded.id]
        );
        if (rows.length) user = rows[0];
      } catch (e) {
        console.warn("[auth] public.users:", e.message);
      }
    }

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.status === "banned" || user.status === "suspended") {
      return res.status(403).json({ message: "Account suspended" });
    }

    req.user = user;
    next();

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

// ── Soft auth — never blocks ──────────────────────────────────
export const softAuth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token   = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      let user = null;

      try {
        const { rows } = await pool.query(
          `SELECT id, name, email, status
           FROM market.users WHERE id = $1`,
          [decoded.id]
        );
        if (rows.length) user = rows[0];
      } catch {}

      if (!user) {
        try {
          const { rows } = await pool.query(
            `SELECT id, name, email, status
             FROM public.users WHERE id = $1`,
            [decoded.id]
          );
          if (rows.length) user = rows[0];
        } catch {}
      }

      if (user && user.status === "active") {
        req.user = user;
      }
    }
  } catch {
    // Silently ignore
  }
  next();
};

// ── Admin guard ───────────────────────────────────────────────
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export default authenticate;