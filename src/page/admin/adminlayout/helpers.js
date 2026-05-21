export const fmt      = (n) => Number(n ?? 0).toLocaleString();
export const fmtN     = (n) => `₦${Number(n ?? 0).toLocaleString()}`;
export const fmtDate  = (d) =>
  d
    ? new Date(d).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" })
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
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const PILL = {
  active:      "pill pa",
  draft:       "pill pd",
  pending:     "pill pp",
  banned:      "pill pb",
  completed:   "pill pa",
  failed:      "pill pb",
  refunded:    "pill pv",
  cancelled:   "pill pb",
  paid:        "pill pa",
  success:     "pill pa",
  super_admin: "pill pc",
  moderator:   "pill pv",
  support:     "pill pd",
};

export const PIE_COLORS = ["#4f8cff", "#1dd6a0", "#f59e42", "#f43f5e", "#a78bfa"];

export const TT = {
  background:   "#0f1320",
  border:       "1px solid #222c44",
  borderRadius: 8,
  color:        "#dde4f5",
};