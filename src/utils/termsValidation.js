// src/utils/termsValidation.js
import { TERMS_CONFIG }   from "../constants/termsConfig";
import { TERMS_VERSION }  from "../constants/termsVersion";

/**
 * Returns true if the user has scrolled enough to be
 * considered as having read the document.
 */
export function hasMetReadThreshold(progress) {
  return progress >= TERMS_CONFIG.readThreshold;
}

/**
 * Returns true if all acceptance conditions are satisfied.
 */
export function isAcceptanceValid({ hasRead, agreed }) {
  return hasRead === true && agreed === true;
}

/**
 * Returns true if the given version string matches
 * the current deployed terms version.
 */
export function isCurrentVersion(version) {
  return version === TERMS_VERSION;
}

/**
 * Clamps a scroll progress value between 0 and 100.
 * Guards against floating point drift and rAF race conditions.
 */
export function clampProgress(value) {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

/**
 * Safely computes scroll percentage.
 * Returns 100 if the element has no scrollable area.
 */
export function computeScrollProgress(scrollTop, scrollHeight, clientHeight) {
  const total = scrollHeight - clientHeight;
  if (total <= 0) return 100;
  return clampProgress((scrollTop / total) * 100);
}