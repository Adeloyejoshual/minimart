/**
 * hooks/useSellerLimits.js
 * Fetches and manages seller posting limits.
 * Skipped automatically in edit mode.
 *
 * v2 — 3-TIER SUPPORT
 *   Exposes tier, isSubscriber, lifetimeExhausted, upgradeTo, upgradeUrl
 *   Backward-compatible: all v1 fields still work.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../utils/apiFetch.js";

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

export function useSellerLimits(apiBase, isEditMode = false) {
  const [sellerLimits,  setSellerLimits]  = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(!isEditMode);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ── Fetch limits from backend ── */
  const fetchLimits = useCallback(() => {
    if (isEditMode) {
      if (mountedRef.current) setLimitsLoading(false);
      return;
    }
    const token = getToken();
    if (!token) {
      if (mountedRef.current) setLimitsLoading(false);
      return;
    }
    if (mountedRef.current) setLimitsLoading(true);

    apiFetch(`${apiBase}/addproduct/seller/limits`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((d) => {
        if (d.success && mountedRef.current) setSellerLimits(d);
      })
      .catch((err) => console.warn("[useSellerLimits]", err.message))
      .finally(() => { if (mountedRef.current) setLimitsLoading(false); });
  }, [apiBase, isEditMode]);

  /* Initial fetch */
  useEffect(() => { fetchLimits(); }, [fetchLimits]);

  /* Auto-refresh when cooldown expires */
  const cooldownSecs = sellerLimits?.cooldown_seconds ?? 0;
  useEffect(() => {
    if (!cooldownSecs || cooldownSecs <= 0) return;
    const tid = setTimeout(fetchLimits, (cooldownSecs + 2) * 1_000);
    return () => clearTimeout(tid);
  }, [cooldownSecs, fetchLimits]);

  /* ═══════════════════════════════════════════════════════════
     DERIVED VALUES
  ═══════════════════════════════════════════════════════════ */

  /* ── Tier identification (v2) ── */
  const tier          = sellerLimits?.tier               ?? "unverified";
  const isSubscriber  = sellerLimits?.is_subscriber      ?? false;

  const subscriptionPlan    = sellerLimits?.subscription_plan    ?? null;
  const subscriptionExpires = sellerLimits?.subscription_expires ?? null;

  /* ── Legacy verification fields (kept for backward compat) ── */
  const isVerifiedSeller = sellerLimits?.seller_verified  ?? false;
  const trialExhausted   = sellerLimits?.trial_exhausted  ?? false;
  const trialRemaining   = sellerLimits?.trial_remaining  ?? null;

  /* ── Lifetime info (v2 — applies to both tiers) ── */
  const lifetimeUsed      = sellerLimits?.lifetime_used      ?? 0;
  const lifetimeMax       = sellerLimits?.lifetime_max       ?? null;
  const lifetimeRemaining = sellerLimits?.lifetime_remaining ?? null;
  const lifetimeExhausted = sellerLimits?.lifetime_exhausted ?? false;

  /* ── Daily / concurrent limits ── */
  const dailyLimit     = sellerLimits?.daily_limit     ?? null;
  const dailyUsed      = sellerLimits?.daily_used      ?? 0;
  const dailyRemaining = sellerLimits?.daily_remaining ?? null;

  const activeLimit     = sellerLimits?.active_limit     ?? null;
  const activeCount     = sellerLimits?.active_count     ?? 0;
  const activeRemaining = sellerLimits?.active_remaining ?? null;

  /* ── Expiry / reactivation ── */
  const expiryDays     = sellerLimits?.expiry_days     ?? null;
  const canReactivate  = sellerLimits?.can_reactivate  ?? false;

  /* ── Upgrade suggestions (v2) ── */
  const canUpgrade     = sellerLimits?.can_upgrade     ?? (tier !== "subscriber");
  const upgradeTo      = sellerLimits?.upgrade_to      ?? (
    tier === "unverified" ? "verified"
    : tier === "verified" ? "subscriber"
    : null
  );
  const upgradeUrl     = sellerLimits?.upgrade_url     ?? (
    upgradeTo === "verified"   ? "/verification"
    : upgradeTo === "subscriber" ? "/subscribe"
    : null
  );

  /* ═══════════════════════════════════════════════════════════
     CAN POST — blocks any tier when their specific cap is hit
  ═══════════════════════════════════════════════════════════ */
  const canPost = isEditMode
    ? true
    : !sellerLimits
    ? true
    : !lifetimeExhausted &&                                  // 3, 500, or ∞
      !trialExhausted    &&                                  // Legacy check
      (dailyRemaining  === null || dailyRemaining  > 0) &&
      (activeRemaining === null || activeRemaining > 0) &&
      cooldownSecs === 0;

  /* ═══════════════════════════════════════════════════════════
     BLOCK REASON — tier-aware messaging for the UI
  ═══════════════════════════════════════════════════════════ */
  const blockReason = (() => {
    if (isEditMode || !sellerLimits || canPost) return null;

    if (lifetimeExhausted) {
      if (tier === "unverified") return {
        type   : "verify",
        title  : "Trial listings used up",
        message: "You've posted all 3 free trial listings. Verify your identity to get 500 free listings.",
        cta    : "Verify Identity",
        url    : "/verification",
      };
      if (tier === "verified") return {
        type   : "subscribe",
        title  : "500-listing limit reached",
        message: "You've reached your 500 free listings. Subscribe for unlimited posting.",
        cta    : "View Subscription Plans",
        url    : "/subscribe",
      };
    }

    if (dailyRemaining === 0) return {
      type   : "daily",
      title  : "Daily limit reached",
      message: `You've hit today's limit of ${dailyLimit} listings. Try again tomorrow${
        tier === "verified" ? " or subscribe for higher limits." : "."
      }`,
      cta    : tier === "verified" ? "Subscribe" : null,
      url    : tier === "verified" ? "/subscribe" : null,
    };

    if (activeRemaining === 0) return {
      type   : "active",
      title  : "Active listing limit reached",
      message: tier === "unverified"
        ? `You can have ${activeLimit} active trial listings at a time.`
        : `Delete or pause some listings to add more.`,
      cta    : tier === "unverified" ? "Verify Identity" : null,
      url    : tier === "unverified" ? "/verification"   : null,
    };

    if (cooldownSecs > 0) {
      const mins = Math.ceil(cooldownSecs / 60);
      return {
        type   : "cooldown",
        title  : "Please wait",
        message: `You can post again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
        cta    : "Verify Identity to Remove Cooldown",
        url    : "/verification",
      };
    }

    return null;
  })();

  /* ═══════════════════════════════════════════════════════════
     RETURN — public API
  ═══════════════════════════════════════════════════════════ */
  return {
    /* ── Raw payload ── */
    sellerLimits,
    limitsLoading,
    fetchLimits,

    /* ── Tier (v2) ── */
    tier,
    isSubscriber,
    subscriptionPlan,
    subscriptionExpires,

    /* ── Verification (legacy — still works) ── */
    isVerifiedSeller,
    trialExhausted,
    trialRemaining,

    /* ── Lifetime (v2) ── */
    lifetimeUsed,
    lifetimeMax,
    lifetimeRemaining,
    lifetimeExhausted,

    /* ── Daily / active caps ── */
    dailyLimit,
    dailyUsed,
    dailyRemaining,
    activeLimit,
    activeCount,
    activeRemaining,

    /* ── Expiry ── */
    expiryDays,
    canReactivate,
    cooldownSecs,

    /* ── Upgrade path ── */
    canUpgrade,
    upgradeTo,
    upgradeUrl,

    /* ── Combined state ── */
    canPost,
    blockReason,
  };
}