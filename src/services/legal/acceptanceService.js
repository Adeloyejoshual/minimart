// src/services/legal/acceptanceService.js
import { TERMS_VERSION }       from "../../constants/termsVersion";
import { CONSENT_METHODS }     from "../../types/terms.types";
import { saveAcceptanceLocally } from "../../utils/termsStorage";

/**
 * Builds the acceptance payload for backend submission.
 *
 * IP address is intentionally excluded from the client payload.
 * It must be resolved server-side from the request context.
 *
 * Backend model reference:
 * {
 *   userId              : string,
 *   acceptedVersion     : string,
 *   acceptedAt          : string (ISO),
 *   userAgent           : string,
 *   ipAddress           : string,   // server-resolved
 *   consentMethod       : string,
 * }
 */
function buildPayload(userId) {
  return {
    userId,
    acceptedVersion : TERMS_VERSION,
    acceptedAt      : new Date().toISOString(),
    userAgent       : navigator.userAgent,
    consentMethod   : CONSENT_METHODS.SCROLL_AND_CHECKBOX,
  };
}

/**
 * Posts acceptance record to the backend API.
 * Falls back gracefully — local storage is always saved
 * regardless of API success.
 *
 * @param {string} userId - Authenticated user identifier
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function postAcceptance(userId) {
  // ── Always persist locally first ──
  saveAcceptanceLocally();

  if (!userId) {
    // Guest user — local persistence only
    return { success: true };
  }

  try {
    const response = await fetch("/api/legal/accept", {
      method  : "POST",
      headers : { "Content-Type": "application/json" },
      body    : JSON.stringify(buildPayload(userId)),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    return { success: true };

  } catch (error) {
    // ── Do not block the user — local record is sufficient ──
    console.error("[acceptanceService] Failed to sync with backend:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches the user's acceptance history from the backend.
 * Useful for admin dashboards and compliance audits.
 *
 * @param {string} userId
 * @returns {Promise<AcceptanceRecord[]>}
 */
export async function fetchAcceptanceHistory(userId) {
  try {
    const response = await fetch(`/api/legal/history/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch history");
    return await response.json();
  } catch (error) {
    console.error("[acceptanceService] fetchAcceptanceHistory failed:", error);
    return [];
  }
}