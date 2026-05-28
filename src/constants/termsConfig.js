// src/constants/termsConfig.js
import { TERMS_VERSION } from "./termsVersion";

/**
 * Central configuration for all legal/compliance behavior.
 * All components and hooks read from here.
 * Never hardcode these values elsewhere.
 */
export const TERMS_CONFIG = {
  // ── Legal metadata ──────────────────────────────────
  version       : TERMS_VERSION,
  effectiveDate : "January 1, 2025",
  lastReviewed  : "January 2025",
  minimumAge    : 18,
  jurisdiction  : "International",
  governingLaw  : "Platform's registered jurisdiction",

  // ── UX behavior ─────────────────────────────────────
  readThreshold        : 95,   // percent scrolled before unlock
  estimatedReadMinutes : 4,

  // ── Contact ─────────────────────────────────────────
  contact: {
    support : "support@minimart.com",
    fraud   : "report@minimart.com",
    legal   : "legal@minimart.com",
  },

  // ── Platform identity ────────────────────────────────
  platformName : "MiniMart",
  platformUrl  : "https://minimart.com",
};