// src/utils/termsStorage.js
import { TERMS_VERSION } from "../constants/termsVersion";

const KEYS = {
  accepted  : "terms_accepted",
  version   : "terms_version",
  timestamp : "terms_accepted_at",
};

/**
 * Returns true only if the stored version matches
 * the currently deployed terms version.
 */
export function hasAcceptedCurrentVersion() {
  return (
    localStorage.getItem(KEYS.accepted) === "true" &&
    localStorage.getItem(KEYS.version)  === TERMS_VERSION
  );
}

/**
 * Persists acceptance record locally.
 * Always call acceptanceService.post() alongside this
 * for server-side persistence.
 */
export function saveAcceptanceLocally() {
  localStorage.setItem(KEYS.accepted,  "true");
  localStorage.setItem(KEYS.version,   TERMS_VERSION);
  localStorage.setItem(KEYS.timestamp, Date.now().toString());
}

/**
 * Returns the stored acceptance timestamp or null.
 */
export function getAcceptedAt() {
  const raw = localStorage.getItem(KEYS.timestamp);
  return raw ? parseInt(raw, 10) : null;
}

/**
 * Returns the version the user last accepted or null.
 */
export function getAcceptedVersion() {
  return localStorage.getItem(KEYS.version) ?? null;
}

/**
 * Clears all stored acceptance data.
 * Use when terms version changes or user revokes consent.
 */
export function clearAcceptance() {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}