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
  /* ── user / account ── */
  active            : "pill pa",
  verified          : "pill pa",
  flagged           : "pill pb",
  banned            : "pill pb",
  suspended         : "pill pb",
  inactive          : "pill pd",

  /* ── verification ── */
  pending           : "pill pp",
  approved          : "pill pa",
  rejected          : "pill pb",
  reset             : "pill pd",
  unknown           : "pill pd",

  /* ── orders / payments ── */
  draft             : "pill pd",
  completed         : "pill pa",
  failed            : "pill pb",
  refunded          : "pill pv",
  cancelled         : "pill pb",
  paid              : "pill pa",
  success           : "pill pa",

  /* ── admin roles — legacy ── */
  moderator         : "pill pv",
  support           : "pill pd",

  /* ── admin roles — current ── */
  super_admin       : "pill pc",
  admin             : "pill pp",
  content_moderator : "pill pv",
  finance_admin     : "pill py",
  support_admin     : "pill pd",
};

/* ── Friendly label for admin roles ── */
export const ROLE_LABEL = {
  super_admin       : "Super Admin",
  admin             : "Admin / Manager",
  content_moderator : "Content Moderator",
  finance_admin     : "Finance Admin",
  support_admin     : "Support Admin",
  moderator         : "Moderator",
  support           : "Support",
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

export const riskColor = (score) => {
  if (!score || score === 0) return "#6b7280";
  if (score >= 80) return "#dc2626";
  if (score >= 50) return "#ea580c";
  if (score >= 20) return "#d97706";
  return "#6b7280";
};

export const isOverdue = (createdAt) => {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000 > 24;
};

export const overdueDays = (createdAt) => {
  if (!isOverdue(createdAt)) return null;
  return Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 86_400_000,
  );
};

export const safeRiskFlags = (flags) => {
  if (Array.isArray(flags)) return flags;
  if (typeof flags === "string") {
    try { return JSON.parse(flags); } catch { return []; }
  }
  return [];
};

export const storeLogoUrl = (documentsUrl) => {
  if (!documentsUrl) return null;
  if (typeof documentsUrl === "object") return documentsUrl.logo_url ?? null;
  if (typeof documentsUrl === "string") {
    try { return JSON.parse(documentsUrl)?.logo_url ?? null; }
    catch { return null; }
  }
  return null;
};

export const trustColor = (score) => {
  if ((score ?? 0) >= 60) return "#16a34a";
  if ((score ?? 0) >= 30) return "#d97706";
  return "#dc2626";
};

/* ════════════════════════════════════════════════════════════
   SOURCE ANALYTICS HELPERS
   Used by SourceAnalytics.jsx and any Overview summary card.
════════════════════════════════════════════════════════════ */

/*
  SOURCE_ICONS
  Emoji icon for every known traffic platform.
  Matches the ALLOWED_SOURCES list in auth.routes.js —
  keep both in sync if you add new platforms.
*/
export const SOURCE_ICONS = {
  // Social Media
  tiktok     : "🎵",
  instagram  : "📸",
  facebook   : "📘",
  twitter    : "🐦",
  snapchat   : "👻",
  pinterest  : "📌",
  linkedin   : "💼",
  reddit     : "🤖",
  youtube    : "▶️",
  threads    : "🧵",
  // Messaging Apps
  whatsapp   : "💬",
  telegram   : "✈️",
  discord    : "🎮",
  signal     : "🔒",
  viber      : "📞",
  wechat     : "💚",
  slack      : "💛",
  line       : "🟢",
  skype      : "🔵",
  kakao      : "💛",
  // Search Engines
  google     : "🔍",
  bing       : "🔎",
  yahoo      : "🟣",
  duckduckgo : "🦆",
  // Other Traffic
  email      : "📧",
  sms        : "📱",
  blog       : "📝",
  podcast    : "🎙️",
  referral   : "🔗",
  direct     : "🌐",
  other      : "❓",
};

/*
  SOURCE_COLORS
  Consistent accent colour per source — used in charts and bars.
  Falls back to the default accent colour if source not listed.
*/
export const SOURCE_COLORS = {
  tiktok     : "#010101",
  instagram  : "#e1306c",
  facebook   : "#1877f2",
  twitter    : "#1da1f2",
  snapchat   : "#fffc00",
  pinterest  : "#e60023",
  linkedin   : "#0a66c2",
  reddit     : "#ff4500",
  youtube    : "#ff0000",
  threads    : "#000000",
  whatsapp   : "#25d366",
  telegram   : "#229ed9",
  discord    : "#5865f2",
  signal     : "#3a76f0",
  viber      : "#7360f2",
  wechat     : "#07c160",
  slack      : "#4a154b",
  line       : "#00c300",
  skype      : "#00aff0",
  kakao      : "#fee500",
  google     : "#4285f4",
  bing       : "#008373",
  yahoo      : "#720e9e",
  duckduckgo : "#de5833",
  email      : "#6366f1",
  sms        : "#10b981",
  blog       : "#f59e0b",
  podcast    : "#8b5cf6",
  referral   : "#ec4899",
  direct     : "#6b7280",
  other      : "#9ca3af",
};

/*
  KNOWN_SOURCES
  Ordered list of all valid platforms.
  Used to detect zero-traffic platforms and build marketing links.
*/
export const KNOWN_SOURCES = Object.freeze([
  "tiktok", "instagram", "facebook", "twitter",
  "snapchat", "pinterest", "linkedin", "reddit",
  "youtube", "threads",
  "whatsapp", "telegram", "discord", "signal",
  "viber", "wechat", "slack", "line", "skype", "kakao",
  "google", "bing", "yahoo", "duckduckgo",
  "email", "sms", "blog", "podcast",
  "referral", "direct", "other",
]);

/*
  capSource
  Capitalises a source slug for display.
  "tiktok" → "Tiktok"  |  undefined → "—"
*/
export const capSource = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

/*
  sourceIcon
  Returns the emoji icon for a source, falling back to 🌐.
*/
export const sourceIcon = (s) => SOURCE_ICONS[s] ?? "🌐";

/*
  sourceColor
  Returns the brand colour for a source, falling back to accent.
*/
export const sourceColor = (s) => SOURCE_COLORS[s] ?? "var(--accent)";

/*
  buildMarketingLink
  Generates a utm_source link for a given platform.
  origin defaults to window.location.origin in the browser.
*/
export const buildMarketingLink = (source, origin) => {
  const base = origin ?? (typeof window !== "undefined"
    ? window.location.origin
    : "");
  return `${base}/auth?utm_source=${source}`;
};

/*
  safeSources
  Ensures a source breakdown array is always an array,
  even if the API returned null or undefined.
*/
export const safeSources = (arr) =>
  Array.isArray(arr) ? arr : [];