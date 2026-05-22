import { pool }            from '../db.js';
import { getCapabilities } from '../lib/permissions.js';

// ── Error messages ─────────────────────────────────────────────────────────────
const ERROR_MESSAGES = {
  account_restricted         : 'Your account has been restricted. Contact support.',
  email_required             : 'Email verification is required for this action.',
  seller_role_required       : 'You need a seller account to do this.',
  store_verification_required: 'Store verification is required for this action.',
  admin_required             : 'Admin access required.',
};

const getErrorMessage = (reason) =>
  ERROR_MESSAGES[reason] || 'Access denied.';

// ── Generic capability gate factory ───────────────────────────────────────────
export const requireCapability = (capabilityMethod) =>
  async (req, res, next) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          id, role, seller_type, status,
          email_verified, store_verified,
          trust_score, created_at
        FROM users
        WHERE id = $1
      `, [req.user.id]);

      const user = rows[0];

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const caps   = getCapabilities(user);
      const result = caps[capabilityMethod]?.();

      if (!result) {
        return res.status(500).json({
          error: `Unknown capability: ${capabilityMethod}`,
        });
      }

      if (!result.granted) {
        return res.status(403).json({
          error  : getErrorMessage(result.reason),
          reason : result.reason,
          action : result.action,
        });
      }

      // Attach to request for use in route handlers
      req.capabilities = caps;
      req.userRecord   = user;
      next();

    } catch (err) {
      console.error(`[requireCapability:${capabilityMethod}]`, err.message);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };

// ── Named exports for clean route imports ─────────────────────────────────────
export const requireEmailVerified = requireCapability('canChat');
export const requireSellerRole    = requireCapability('canPost');
export const requireStoreVerified = requireCapability('canWithdraw');
export const requireAdmin         = requireCapability('canReviewStores');