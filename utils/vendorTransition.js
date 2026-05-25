// utils/vendorTransition.js
import { ALLOWED_TRANSITIONS, VENDOR_STATUSES } from "../config/vendorPolicy.js";

// ─────────────────────────────────────────────────────────────
// Validates a status transition BEFORE hitting the database.
// Throws a structured error on invalid jumps.
// ─────────────────────────────────────────────────────────────

export class TransitionError extends Error {
  constructor(from, to) {
    super(`Invalid transition: "${from}" → "${to}"`);
    this.name   = "TransitionError";
    this.from   = from;
    this.to     = to;
    this.code   = "INVALID_TRANSITION";
    this.allowed = ALLOWED_TRANSITIONS[from] ?? [];
  }
}

// ── Check if transition is valid ──────────────────────────────
export const isValidTransition = (from, to) => {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
};

// ── Assert transition — throws on failure ─────────────────────
export const assertTransition = (from, to) => {
  if (!isValidTransition(from, to)) {
    throw new TransitionError(from, to);
  }
};

// ── Get what a status can transition TO ──────────────────────
export const getAllowedNextStatuses = (currentStatus) => {
  return ALLOWED_TRANSITIONS[currentStatus] ?? [];
};

// ── Build full transition map for admin UI ───────────────────
export const buildTransitionGraph = () => {
  return Object.entries(ALLOWED_TRANSITIONS).map(([from, targets]) => ({
    from,
    targets,
    terminal: targets.length === 0,
  }));
};