// src/types/terms.types.js

/**
 * Pseudo-type definitions for the legal/terms domain.
 * Serves as documentation and structural reference.
 * Migrate to TypeScript interfaces when the project scales.
 *
 * AcceptanceRecord shape:
 * {
 *   userId              : string,
 *   acceptedVersion     : string,    // e.g. "2025.01"
 *   acceptedAt          : number,    // Unix timestamp (ms)
 *   userAgent           : string,
 *   ipAddress           : string,    // resolved server-side
 *   consentMethod       : string,    // "scroll+checkbox"
 * }
 *
 * TermsSectionShape:
 * {
 *   id       : string,
 *   title    : string,
 *   required : boolean,
 *   content  : ReactNode,
 * }
 *
 * TermsConfigShape:
 * {
 *   version              : string,
 *   effectiveDate        : string,
 *   lastReviewed         : string,
 *   minimumAge           : number,
 *   jurisdiction         : string,
 *   governingLaw         : string,
 *   readThreshold        : number,
 *   estimatedReadMinutes : number,
 *   contact              : { support, fraud, legal },
 *   platformName         : string,
 *   platformUrl          : string,
 * }
 *
 * ScrollState:
 * {
 *   scrollProgress : number,   // 0–100
 *   hasRead        : boolean,
 * }
 *
 * AcceptanceState:
 * {
 *   agreed           : boolean,
 *   alreadyAccepted  : boolean,
 *   acceptedVersion  : string | null,
 *   acceptedAt       : number | null,
 * }
 */

// Consent method identifier — extend if you add new methods
export const CONSENT_METHODS = {
  SCROLL_AND_CHECKBOX : "scroll+checkbox",
  CHECKBOX_ONLY       : "checkbox",
  API_PREFILLED       : "api-prefilled",
};