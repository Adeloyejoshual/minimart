// ══════════════════════════════════════════════════════════════════════════════
// CAPABILITY-BASED PERMISSION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

export class UserCapabilities {
  constructor(user) {
    this.user       = user;
    this.role       = user.role         || 'buyer';
    this.emailOk    = user.email_verified === true;
    this.storeOk    = user.store_verified === true;
    this.sellerType = user.seller_type  || 'individual';
    this.status     = user.status       || 'active';
    this.trustScore = user.trust_score  || 0;
  }

  // ── Internal state checks ──────────────────────────────────────────────────
  get isFlagged()    { return this.status === 'flagged';   }
  get isSuspended()  { return this.status === 'suspended'; }
  get isActive()     { return this.status === 'active';    }
  get isBlocked()    { return this.isFlagged || this.isSuspended; }

  get isBuyer()      { return true; }
  get isSeller()     { return this.role === 'seller' || this.role === 'admin'; }
  get isStoreOwner() { return this.sellerType === 'store_owner' && this.storeOk; }
  get isAdmin()      { return this.role === 'admin'; }

  // ── BUYER LAYER — never gated ──────────────────────────────────────────────
  canBrowse() {
    return { granted: true, reason: null };
  }

  canBuy() {
    return { granted: true, reason: null };
  }

  // ── ENGAGEMENT LAYER ───────────────────────────────────────────────────────
  canChat() {
    if (this.isBlocked) {
      return {
        granted : false,
        reason  : 'account_restricted',
        action  : 'contact_support',
      };
    }
    if (!this.emailOk) {
      return {
        granted : false,
        reason  : 'email_required',
        action  : 'verify_email',
      };
    }
    return { granted: true, reason: null };
  }

  // ── SELLER LAYER ───────────────────────────────────────────────────────────
  canPost() {
    if (this.isBlocked) {
      return {
        granted : false,
        reason  : 'account_restricted',
        action  : 'contact_support',
      };
    }
    if (!this.emailOk) {
      return {
        granted : false,
        reason  : 'email_required',
        action  : 'verify_email',
      };
    }
    if (!this.isSeller) {
      return {
        granted : false,
        reason  : 'seller_role_required',
        action  : 'upgrade_to_seller',
      };
    }
    return { granted: true, reason: null };
  }

  canSell() {
    return this.canPost();
  }

  // ── STORE LAYER ────────────────────────────────────────────────────────────
  canWithdraw() {
    if (this.isBlocked) {
      return {
        granted : false,
        reason  : 'account_restricted',
        action  : 'contact_support',
      };
    }
    if (!this.emailOk) {
      return {
        granted : false,
        reason  : 'email_required',
        action  : 'verify_email',
      };
    }
    if (!this.isStoreOwner) {
      return {
        granted : false,
        reason  : 'store_verification_required',
        action  : 'verify_store',
      };
    }
    return { granted: true, reason: null };
  }

  canViewAnalytics() {
    if (!this.isStoreOwner) {
      return {
        granted : false,
        reason  : 'store_verification_required',
        action  : 'verify_store',
      };
    }
    return { granted: true, reason: null };
  }

  // ── ADMIN LAYER ────────────────────────────────────────────────────────────
  canReviewStores() {
    return {
      granted : this.isAdmin,
      reason  : this.isAdmin ? null : 'admin_required',
    };
  }

  canRevertDecisions() {
    return {
      granted : this.isAdmin,
      reason  : this.isAdmin ? null : 'admin_required',
    };
  }

  canViewAuditLogs() {
    return {
      granted : this.isAdmin,
      reason  : this.isAdmin ? null : 'admin_required',
    };
  }

  canFlagUsers() {
    return {
      granted : this.isAdmin,
      reason  : this.isAdmin ? null : 'admin_required',
    };
  }

  // ── Serialize for API response ─────────────────────────────────────────────
  toJSON() {
    return {
      can_browse           : this.canBrowse().granted,
      can_buy              : this.canBuy().granted,
      can_chat             : this.canChat().granted,
      can_post             : this.canPost().granted,
      can_sell             : this.canSell().granted,
      can_withdraw         : this.canWithdraw().granted,
      can_view_analytics   : this.canViewAnalytics().granted,
      can_review_stores    : this.canReviewStores().granted,
      can_revert_decisions : this.canRevertDecisions().granted,
      can_view_audit_logs  : this.canViewAuditLogs().granted,
      can_flag_users       : this.canFlagUsers().granted,
    };
  }

  // ── Detailed hints — tells frontend WHY + what action to take ─────────────
  toDetailedJSON() {
    return {
      can_browse           : this.canBrowse(),
      can_buy              : this.canBuy(),
      can_chat             : this.canChat(),
      can_post             : this.canPost(),
      can_sell             : this.canSell(),
      can_withdraw         : this.canWithdraw(),
      can_view_analytics   : this.canViewAnalytics(),
      can_review_stores    : this.canReviewStores(),
      can_revert_decisions : this.canRevertDecisions(),
      can_view_audit_logs  : this.canViewAuditLogs(),
      can_flag_users       : this.canFlagUsers(),
    };
  }
}

// ── Trust score — pure function ────────────────────────────────────────────────
export const computeTrustScore = (user) => {
  let score = 0;

  if (user.email_verified) score += 40;
  if (user.store_verified) score += 20;
  // future: phone_verified +20, identity_verified +20

  const ageInDays = (Date.now() - new Date(user.created_at)) / 86_400_000;
  if (ageInDays > 30) score += 10;
  if (ageInDays > 90) score += 10;

  return Math.min(score, 100);
};

// ── Factory ────────────────────────────────────────────────────────────────────
export const getCapabilities = (user) => new UserCapabilities(user);