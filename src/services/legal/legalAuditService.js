// src/services/legal/legalAuditService.js
import { TERMS_VERSION }    from "../../constants/termsVersion";
import { CONSENT_METHODS }  from "../../types/terms.types";
import { getAcceptedAt }    from "../../utils/termsStorage";
import { toISODate }        from "../../utils/dateFormatter";

/**
 * Legal Audit Service
 *
 * Handles structured logging of all legal compliance events.
 * Designed for:
 *   - Dispute resolution
 *   - Seller verification audits
 *   - Regulatory compliance checks
 *   - Law enforcement cooperation (valid legal orders only)
 *   - Platform trust and safety reporting
 *
 * All methods fail silently — audit failures must never
 * block the user experience.
 */

// ── Audit event type identifiers ──────────────────────────────────────────
export const AUDIT_EVENTS = {
  TERMS_VIEWED       : "terms.viewed",
  TERMS_ACCEPTED     : "terms.accepted",
  TERMS_REACCEPTED   : "terms.reaccepted",
  TERMS_DECLINED     : "terms.declined",
  VERSION_MISMATCH   : "terms.version_mismatch",
  ACCEPTANCE_EXPIRED : "terms.acceptance_expired",
};

/**
 * Builds a structured audit payload for backend submission.
 * IP address is intentionally absent — resolved server-side only.
 *
 * @param {string} eventType - One of AUDIT_EVENTS values
 * @param {string|null} userId
 * @param {object} [metadata] - Additional event-specific data
 * @returns {object}
 */
function buildAuditPayload(eventType, userId, metadata = {}) {
  return {
    eventType,
    userId          : userId ?? "guest",
    termsVersion    : TERMS_VERSION,
    occurredAt      : new Date().toISOString(),
    userAgent       : navigator.userAgent,
    consentMethod   : CONSENT_METHODS.SCROLL_AND_CHECKBOX,
    platform        : "web",
    ...metadata,
  };
}

/**
 * Posts a legal audit event to the backend.
 * Fails silently — never throws or blocks UI.
 *
 * @param {string} eventType
 * @param {string|null} userId
 * @param {object} [metadata]
 */
async function postAuditEvent(eventType, userId, metadata = {}) {
  try {
    const payload = buildAuditPayload(eventType, userId, metadata);

    const response = await fetch("/api/legal/audit", {
      method  : "POST",
      headers : { "Content-Type": "application/json" },
      body    : JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Audit endpoint returned ${response.status}`);
    }

  } catch (error) {
    // Audit failures are non-critical — log only in development
    if (process.env.NODE_ENV === "development") {
      console.warn("[legalAuditService] Audit event failed:", error.message);
    }
  }
}

/**
 * Logs that the user viewed the terms page.
 *
 * @param {string|null} userId
 */
export function logTermsViewed(userId) {
  postAuditEvent(AUDIT_EVENTS.TERMS_VIEWED, userId);
}

/**
 * Logs a successful terms acceptance.
 *
 * @param {string|null} userId
 * @param {boolean} isReacceptance - True if user previously accepted older version
 */
export function logTermsAccepted(userId, isReacceptance = false) {
  const eventType = isReacceptance
    ? AUDIT_EVENTS.TERMS_REACCEPTED
    : AUDIT_EVENTS.TERMS_ACCEPTED;

  postAuditEvent(eventType, userId, {
    acceptedDate : toISODate(Date.now()),
  });
}

/**
 * Logs a version mismatch — user had accepted an older version.
 *
 * @param {string|null} userId
 * @param {string} previousVersion - The version the user previously accepted
 */
export function logVersionMismatch(userId, previousVersion) {
  postAuditEvent(AUDIT_EVENTS.VERSION_MISMATCH, userId, {
    previousVersion,
    currentVersion : TERMS_VERSION,
  });
}

/**
 * Logs that the user declined or exited without accepting.
 *
 * @param {string|null} userId
 * @param {number} scrollProgressAtExit - How far they scrolled before leaving
 */
export function logTermsDeclined(userId, scrollProgressAtExit) {
  postAuditEvent(AUDIT_EVENTS.TERMS_DECLINED, userId, {
    scrollProgressAtExit,
  });
}

/**
 * Fetches the full audit history for a user.
 * Intended for admin moderation and compliance dashboards.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function fetchAuditHistory(userId) {
  try {
    const response = await fetch(`/api/legal/audit/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch audit history");
    return await response.json();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[legalAuditService] fetchAuditHistory failed:", error.message);
    }
    return [];
  }
}