import { pool } from '../db.js';

// Never throws — audit must never crash main flow
export const writeAudit = async ({
  actorId    = null,
  action,
  targetType,
  targetId   = null,
  metadata   = null,
  ipAddress  = null,
}) => {
  try {
    await pool.query(`
      INSERT INTO audit_logs
        (actor_id, action, target_type, target_id, metadata, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [actorId, action, targetType, targetId, metadata, ipAddress]);
  } catch (err) {
    console.error('[audit-write-failed]', err.message);
  }
};