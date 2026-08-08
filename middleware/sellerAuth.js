/**
 * middleware/sellerAuth.js
 *
 * Authenticates requests from market.users (sellers).
 * Uses the same JWT_SECRET as the marketplace auth but
 * looks up market.users — NOT public.users.
 *
 * This ensures req.user.id === market.users.id
 * which matches market.products.user_id correctly.
 */

import jwt        from "jsonwebtoken";
import { pool }   from "../config/db.js";

export async function authenticateSeller(req, res, next) {
  try {
    /* ── 1. Extract Bearer token ── */
    const authHeader = req.headers.authorization ?? "";
    const token      = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({
        success : false,
        message : "Authentication required. Please log in to your seller account.",
      });
    }

    /* ── 2. Verify JWT signature + expiry ── */
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success : false,
        message : err.name === "TokenExpiredError"
          ? "Your session has expired. Please log in again."
          : "Invalid token. Please log in again.",
      });
    }

    /* ── 3. Look up in market.users (NOT public.users) ── */
    const { rows } = await pool.query(
      `SELECT
         id,
         email,
         full_name,
         is_verified,
         is_active
       FROM market.users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({
        success : false,
        message : "Seller account not found. Please log in again.",
      });
    }

    const seller = rows[0];

    /* ── 4. Account checks ── */
    if (!seller.is_verified) {
      return res.status(403).json({
        success : false,
        message : "Please verify your email before accessing seller features.",
      });
    }

    if (seller.is_active === false) {
      return res.status(403).json({
        success : false,
        message : "Your seller account has been suspended. Please contact support.",
      });
    }

    /* ── 5. Attach seller to request ── */
    req.user = {
      id        : seller.id,        // market.users.id ✓
      email     : seller.email,
      full_name : seller.full_name,
    };

    next();

  } catch (err) {
    console.error("[authenticateSeller]", err.message);
    return res.status(500).json({
      success : false,
      message : "Authentication error. Please try again.",
    });
  }
}