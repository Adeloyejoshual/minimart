// middleware/auth.js
import jwt      from "jsonwebtoken";
import { pool } from "../server.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ════════════════════════════════════════════════════════════
// authenticate
// Used by general routes — checks public.users, falls back to market.users
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
// authenticateBuyer
// Only allows public.users (buyers) — blocks market.users (sellers)
// Use this for: cart, checkout, orders, wishlist
// ════════════════════════════════════════════════════════════
export const authenticateBuyer = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token   = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM public.users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Buyer account not found. Please log in as a buyer.",
      });
    }

    const user = rows[0];

    if (user.status === "banned" || user.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended.",
      });
    }

    req.user = user;
    return next();

  } catch (err) {
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

// ════════════════════════════════════════════════════════════
// authenticateSeller
// Only allows market.users (sellers) — blocks public.users (buyers)
// Use this for: post product, manage listings, seller dashboard
// ════════════════════════════════════════════════════════════
export const authenticateSeller = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token   = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      `SELECT id, name, email, status
       FROM market.users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Seller account not found. Please log in as a seller.",
      });
    }

    const user = rows[0];

    if (user.status === "banned" || user.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Your seller account has been suspended.",
      });
    }

    req.user = { ...user, isSeller: true };
    return next();

  } catch (err) {
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
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

      const { rows: pub } = await pool.query(
        `SELECT id, name, email, status FROM public.users WHERE id = $1`,
        [decoded.id]
      );

      if (pub.length && pub[0].status === "active") {
        req.user = pub[0];
      } else {
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