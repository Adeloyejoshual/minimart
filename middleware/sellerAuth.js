/**
 * middleware/sellerAuth.js
 *
 * Authenticates requests from market.users (sellers).
 * Uses the same JWT_SECRET as the marketplace auth but
 * looks up market.users — NOT public.users.
 *
 * This ensures req.user.id === market.users.id
 * which matches market.products.user_id correctly.
 *
 * Columns confirmed from market.users schema:
 *   id, name, email, password_hash, phone_number,
 *   country, city, profile_image, verified, status,
 *   created_at, updated_at, is_verified,
 *   verify_code, verify_expires, reset_code, reset_expires
 *
 * NOTE: column is "name" NOT "full_name"
 *       column is "status" NOT "is_active"
 *       suspended check: status IN ('suspended', 'banned')
 */

import jwt      from "jsonwebtoken";
import { pool } from "../config/db.js";

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

    /* ── 3. Look up market.users ── */
    /*
     * Uses only columns that actually exist in market.users:
     *   name        (NOT full_name)
     *   status      (NOT is_active)
     *   is_verified (exists)
     */
    const { rows } = await pool.query(
      `SELECT
         id,
         name,
         email,
         status,
         is_verified
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

    /*
     * status column: 'active' | 'suspended' | 'banned'
     * (confirmed from CHECK constraint in schema)
     */
    if (seller.status !== "active") {
      return res.status(403).json({
        success : false,
        message : "Your seller account has been suspended. Please contact support.",
      });
    }

    /* ── 5. Attach seller to request ── */
    req.user = {
      id       : seller.id,      // market.users.id ✓
      email    : seller.email,
      name     : seller.name,    // "name" not "full_name"
    };

    next();

  } catch (err) {
    console.error("[authenticateSeller] CRASH:", {
      message : err.message,
      code    : err.code,
      detail  : err.detail,
      stack   : err.stack?.split("\n").slice(0, 3).join(" | "),
    });
    return res.status(500).json({
      success : false,
      message : "Authentication error. Please try again.",
      ...(process.env.NODE_ENV !== "production"
        ? { debug: err.message }
        : {}),
    });
  }
}