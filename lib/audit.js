/**
 * lib/audit.js
 * Fire-and-forget audit logger.
 * Never throws — a failed audit must never crash the main request.
 */

import { pool } from "../config/db.js";

export const writeAudit = async ({
  actorId    = null,
  action,
  targetType = null,
  targetId   = null,
  metadata   = null,
  ipAddress  = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (actor_id, action, target_type, target_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorId,
        action,
        targetType,
        targetId,
        metadata ? JSON.stringify(metadata) : null,
        ipAddress,
      ]
    );
  } catch (err) {
    console.error("[audit] write failed:", err.message);
  }
};