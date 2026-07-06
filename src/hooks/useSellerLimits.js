/**
 * hooks/useSellerLimits.js
 * Fetches and manages seller posting limits.
 * Skipped automatically in edit mode.
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

  /* Derived values */
  const isVerifiedSeller = sellerLimits?.seller_verified  ?? false;
  const trialExhausted   = sellerLimits?.trial_exhausted  ?? false;
  const trialRemaining   = sellerLimits?.trial_remaining  ?? null;
  const dailyRemaining   = sellerLimits?.daily_remaining  ?? null;
  const activeRemaining  = sellerLimits?.active_remaining ?? null;

  const canPost = isEditMode
    ? true
    : !sellerLimits
    ? true
    : !trialExhausted &&
      (dailyRemaining  === null || dailyRemaining  > 0) &&
      (activeRemaining === null || activeRemaining > 0) &&
      cooldownSecs === 0;

  return {
    sellerLimits,
    limitsLoading,
    fetchLimits,
    isVerifiedSeller,
    trialExhausted,
    trialRemaining,
    dailyRemaining,
    activeRemaining,
    cooldownSecs,
    canPost,
  };
}