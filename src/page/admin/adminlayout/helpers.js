// src/page/admin/adminlayout/helpers.js

export const fmt = (n) => Number(n ?? 0).toLocaleString();

export const fmtN = (n) => `₦${Number(n ?? 0).toLocaleString()}`;

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-NG", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

export const fmtDateS = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-NG", { dateStyle: "medium" })
    : "—";

export const initials = (s = "") => {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "SA";
  return words.map((w) => w[0]).join("").toUpperCase().slice(0, 2);
};

export const safeFeatures = (f) => {
  if (Array.isArray(f)) return f.filter((x) => typeof x === "string");
  if (typeof f === "string") {
    try {
      const parsed = JSON.parse(f);
      return Array.isArray(parsed)
        ? parsed.filter((x) => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
};

/* ── Status → pill class map ── */
export const PILL = {
  /* user / account */
  active        : "pill pa",
  verified      : "pill pa",
  flagged       : "pill pb",
  banned        : "pill pb",
  suspended     : "pill pb",
  inactive      : "pill pd",
  /* verification */
  pending       : "pill pp",
  approved      : "pill pa",
  rejected      : "pill pb",
  reset         : "pill pd",
  unknown       : "pill pd",
  /* orders / payments */
  draft         : "pill pd",
  completed     : "pill pa",
  failed        : "pill pb",
  refunded      : "pill pv",
  cancelled     : "pill pb",
  paid          : "pill pa",
  success       : "pill pa",
  /* admin roles */
  super_admin   : "pill pc",
  moderator     : "pill pv",
  support       : "pill pd",
};

/* ── Recharts tooltip shared style ── */
export const TT = {
  background   : "#0f1320",
  border       : "1px solid #222c44",
  borderRadius : 8,
  color        : "#dde4f5",
};

export const PIE_COLORS = [
  "#4f8cff", "#1dd6a0", "#f59e42", "#f43f5e", "#a78bfa",
];

/* ── Verification status helpers ── */

/**
 * Returns a human-readable label for an identity / store status.
 */
export const verificationLabel = (status) => {
  const map = {
    pending  : "Pending Review",
    approved : "Approved",
    rejected : "Rejected",
    flagged  : "Flagged",
    reset    : "Awaiting Resubmission",
    unknown  : "Unknown",
  };
  return map[status] ?? status ?? "—";
};

/**
 * Returns a hex colour for a verification status.
 */
export const verificationColor = (status) => {
  const map = {
    pending  : "#d97706",
    approved : "#16a34a",
    rejected : "#dc2626",
    flagged  : "#9333ea",
    reset    : "#6b7280",
    unknown  : "#6b7280",
  };
  return map[status] ?? "#6b7280";
};

/**
 * Returns a hex colour for a risk score (0–100).
 */
export const riskColor = (score) => {
  if (!score || score === 0) return "#6b7280";
  if (score >= 80) return "#dc2626";
  if (score >= 50) return "#ea580c";
  if (score >= 20) return "#d97706";
  return "#6b7280";
};

/**
 * Returns true if a submission is overdue (pending > 24 h).
 */
export const isOverdue = (createdAt) => {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000 > 24;
};

/**
 * Returns how many days overdue a pending submission is.
 * Returns null if not overdue.
 */
export const overdueDays = (createdAt) => {
  if (!isOverdue(createdAt)) return null;
  return Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  );
};

/**
 * Safely parses risk_flags from DB — can be a JSON string or already an array.
 */
export const safeRiskFlags = (flags) => {
  if (Array.isArray(flags)) return flags;
  if (typeof flags === "string") {
    try { return JSON.parse(flags); } catch { return []; }
  }
  return [];
};

/**
 * Extracts logo_url from a store's documents_url jsonb field.
 * documents_url is stored as a JSON object: { logo_url: "..." }
 */
export const storeLogoUrl = (documentsUrl) => {
  if (!documentsUrl) return null;
  if (typeof documentsUrl === "object") return documentsUrl.logo_url ?? null;
  if (typeof documentsUrl === "string") {
    try { return JSON.parse(documentsUrl)?.logo_url ?? null; }
    catch { return null; }
  }
  return null;
};

/**
 * Returns the trust score colour tier.
 */
export const trustColor = (score) => {
  if ((score ?? 0) >= 60) return "#16a34a";
  if ((score ?? 0) >= 30) return "#d97706";
  return "#dc2626";
};