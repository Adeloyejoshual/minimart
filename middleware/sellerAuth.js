/**
 * middleware/sellerAuth.js
 *
 * Authenticates requests from market.users (sellers).
 *
 * Uses JWT_SECRET (must be set — hard crash at startup if missing).
 * Looks up market.users — NOT public.users.
 *
 * This ensures req.user.id === market.users.id
 * which matches market.products.user_id correctly.
 *
 * Confirmed market.users columns used here:
 *   id, name, email, status, is_verified
 *
 * NOTE: column is "name"   NOT "full_name"
 *       column is "status" NOT "is_active"
 *       active check: status = 'active'
 *
 * v2 — Hardened
 * ──────────────────────────────────────────────────────────────
 * ✓ JWT_SECRET validated at startup — hard crash if missing
 * ✓ decoded.id validated before DB query
 * ✓ Whitespace-only tokens rejected before auth attempt
 * ✓ debug field removed from all error responses
 * ✓ req.ip included in all auth failure logs
 * ✓ Stack traces gated to non-production only
 * ✓ Response messages centralised in one object
 */

import jwt      from "jsonwebtoken";
import { pool } from "../config/db.js";

/* ══════════════════════════════════════════════════════════════
   STARTUP GUARD
   ─────────────────────────────────────────────────────────────
   Crash immediately if JWT_SECRET is absent.
   A missing secret means jwt.verify() would use `undefined`,
   which some jsonwebtoken versions accept — silently destroying
   all security guarantees.
══════════════════════════════════════════════════════════════ */
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "[sellerAuth] FATAL: JWT_SECRET environment variable is not set. " +
    "Server cannot start safely."
  );
}

/* ══════════════════════════════════════════════════════════════
   RESPONSE MESSAGES
   ─────────────────────────────────────────────────────────────
   Centralised so wording changes and i18n happen in one place.
   All messages are intentionally vague enough not to leak
   internal state to a potential attacker.
══════════════════════════════════════════════════════════════ */
const MSG = {
  NO_TOKEN      : "Authentication required. Please log in to your seller account.",
  TOKEN_EXPIRED : "Your session has expired. Please log in again.",
  TOKEN_INVALID : "Invalid token. Please log in again.",
  BAD_PAYLOAD   : "Invalid token payload. Please log in again.",
  USER_NOT_FOUND: "Seller account not found. Please log in again.",
  NOT_VERIFIED  : "Please verify your email before accessing seller features.",
  NOT_ACTIVE    : "Your seller account has been suspended. Please contact support.",
  SERVER_ERROR  : "Authentication error. Please try again.",
};

/* ══════════════════════════════════════════════════════════════
   TOKEN EXTRACTOR
   ─────────────────────────────────────────────────────────────
   Returns the raw token string, or null if:
     - Authorization header is absent
     - Header does not start with "Bearer "
     - Token portion is empty or whitespace-only
══════════════════════════════════════════════════════════════ */
function extractToken(req) {
  const header = req.headers.authorization ?? "";

  if (!header.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/* ══════════════════════════════════════════════════════════════
   AUTHENTICATE SELLER
══════════════════════════════════════════════════════════════ */
export async function authenticateSeller(req, res, next) {
  /*
   * ip is logged on every failure so auth errors can be traced
   * back to a caller without needing full request logging.
   */
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

  try {
    /* ── 1. Extract token ── */
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: MSG.NO_TOKEN,
      });
    }

    /* ── 2. Verify JWT signature + expiry ── */
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      const expired = err.name === "TokenExpiredError";

      console.warn("[sellerAuth] Token rejected:", {
        reason : expired ? "expired" : "invalid",
        ip,
      });

      return res.status(401).json({
        success: false,
        message: expired ? MSG.TOKEN_EXPIRED : MSG.TOKEN_INVALID,
      });
    }

    /* ── 3. Validate payload ── */
    /*
     * decoded.id must be a non-empty string (UUID).
     * If the payload is missing `id`, the DB query would execute
     * with undefined as $1 — returning no rows at best, or throwing
     * a type error at worst. Reject early with a clear message.
     */
    if (!decoded.id || typeof decoded.id !== "string") {
      console.warn("[sellerAuth] JWT payload missing or invalid `id`:", {
        payload: decoded,
        ip,
      });
      return res.status(401).json({
        success: false,
        message: MSG.BAD_PAYLOAD,
      });
    }

    /* ── 4. Look up seller in market.users ── */
    /*
     * Columns used (confirmed from schema):
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
      console.warn("[sellerAuth] User not found:", { id: decoded.id, ip });
      return res.status(401).json({
        success: false,
        message: MSG.USER_NOT_FOUND,
      });
    }

    const seller = rows[0];

    /* ── 5. Account status checks ── */
    /*
     * Verification is checked before active status.
     * An unverified account should fix email first,
     * a suspended account should contact support.
     * Order is intentional and documented.
     */
    if (!seller.is_verified) {
      console.warn("[sellerAuth] Unverified seller attempted access:", {
        id: seller.id,
        ip,
      });
      return res.status(403).json({
        success: false,
        message: MSG.NOT_VERIFIED,
      });
    }

    if (seller.status !== "active") {
      console.warn("[sellerAuth] Inactive seller attempted access:", {
        id:     seller.id,
        status: seller.status,
        ip,
      });
      return res.status(403).json({
        success: false,
        message: MSG.NOT_ACTIVE,
      });
    }

    /* ── 6. Attach seller to request ── */
    req.user = {
      id   : seller.id,     // market.users.id ✓
      email: seller.email,
      name : seller.name,   // "name" not "full_name" ✓
    };

    next();

  } catch (err) {
    /*
     * Only unexpected errors reach here (e.g. DB down, pool exhausted).
     * JWT errors are caught and handled above.
     *
     * Stack traces are only logged in non-production to avoid
     * flooding production log aggregators with noise.
     */
    console.error("[sellerAuth] CRASH:", {
      message : err.message,
      code    : err.code,
      ip,
      ...(process.env.NODE_ENV !== "production"
        ? { stack: err.stack?.split("\n").slice(0, 3).join(" | ") }
        : {}),
    });

    /*
     * No debug field in the response — ever.
     * Internal error details must never reach the client,
     * even in staging, because staging tokens are often
     * reused or shared.
     */
    return res.status(500).json({
      success: false,
      message: MSG.SERVER_ERROR,
    });
  }
}