// ════════════════════════════════════════════════════════════
// FILE: routes/admin/middleware.js
// ════════════════════════════════════════════════════════════

import jwt      from "jsonwebtoken";
import { pool } from "../../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ─────────────────────────────────────────────────────────────
// verifyAdmin
// — Decodes JWT
// — Fetches fresh admin row from DB using plain role column
// — Blocks banned admins immediately
// — Attaches req.admin = { id, name, email, role, status }
// ─────────────────────────────────────────────────────────────
export const verifyAdmin = async (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized — no token provided." });
  }

  let decoded;
  try {
    decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, name, email, role, status
       FROM admins
       WHERE id = $1`,
      [decoded.id],
    );

    if (!rows.length) {
      return res.status(401).json({ error: "Admin account not found." });
    }

    if (rows[0].status === "banned") {
      return res.status(403).json({ error: "Your account has been deactivated." });
    }

    req.admin = rows[0];
    next();
  } catch (err) {
    console.error("[verifyAdmin]", err.message);
    res.status(500).json({ error: "Auth check failed." });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// requireSuperAdmin
// — Use after verifyAdmin
// — Blocks anyone who is not super_admin
// ─────────────────────────────────────────────────────────────
export const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== "super_admin") {
    return res.status(403).json({ error: "Forbidden — Super Admin only." });
  }
  next();
};

// ─────────────────────────────────────────────────────────────
// requireRole(...roles)
// — Use after verifyAdmin
// — Blocks anyone not in the allowed roles list
//
// Usage:
//   router.get("/payments", verifyAdmin, requireRole("super_admin", "finance_admin"), handler)
// ─────────────────────────────────────────────────────────────
export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin?.role)) {
    return res.status(403).json({
      error: `Forbidden — requires one of: ${roles.join(", ")}`,
    });
  }
  next();
};