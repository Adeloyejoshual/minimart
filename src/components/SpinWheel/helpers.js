/* ================================================================
   helpers.js
   ================================================================ */

/* ── Social links (set to null to auto-hide that task) ── */
export const SOCIAL_LINKS = {
  instagram : "https://www.instagram.com/loemartmarketplace?igsh=ZnVsemNjeXJqd25v",
  tiktok    : "https://www.tiktok.com/@loemartmarketplace?_r=1&_t=ZS-98Oc4twCrv5",
  facebook  : null,
  telegram  : "https://t.me/loemartmarketplace",
  whatsapp  : "https://whatsapp.com/channel/0029VbCkfHbGZNCm5XkWd347",
};

/* ── Internal helper ── */
const hasLink = (url) => typeof url === "string" && url.trim() !== "";

/* ── Money ── */
export const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

/* ── Time ── */
export const timeAgo = (d) => {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const s = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1_000));
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

export const fmtCountdown = (secs) => {
  const total = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};

/* ── Win check ── */
export const isBigWin = (result) => {
  if (!result?.is_win)                                              return false;
  if (result.is_big_win)                                            return true;
  if (result.type === "fixed"       && Number(result.value) >= 2000) return true;
  if (result.type === "percentage"  && Number(result.value) >= 20)   return true;
  if (result.type === "free_shipping")                               return true;
  return false;
};

/* ── Earn tasks ── */
const ALL_EARN_TASKS = [
  {
    id          : "follow_instagram",
    type        : "follow",
    platform    : "Instagram",
    label       : "Follow on Instagram",
    description : "Follow @loemartmarketplace on Instagram and earn 3 bonus spins",
    spins_reward: 3,
    iconName    : "instagram",
    color       : "#e1306c",
    bg          : "#fff0f5",
    url         : SOCIAL_LINKS.instagram,
    category    : "social",
    verifyDelay : 10_000,
  },
  {
    id          : "follow_tiktok",
    type        : "follow",
    platform    : "TikTok",
    label       : "Follow on TikTok",
    description : "Follow @loemart01 on TikTok and earn 3 bonus spins",
    spins_reward: 3,
    iconName    : "tiktok",
    color       : "#010101",
    bg          : "#f5f5f5",
    url         : SOCIAL_LINKS.tiktok,
    category    : "social",
    verifyDelay : 10_000,
  },
  {
    id          : "follow_facebook",
    type        : "follow",
    platform    : "Facebook",
    label       : "Follow on Facebook",
    description : "Follow Loemart on Facebook and earn 5 bonus spins",
    spins_reward: 5,
    iconName    : "facebook",
    color       : "#1877f2",
    bg          : "#f0f5ff",
    url         : SOCIAL_LINKS.facebook,   // null → auto-hidden
    category    : "social",
    verifyDelay : 10_000,
  },
  {
    id          : "join_telegram",
    type        : "join",
    platform    : "Telegram",
    label       : "Join Telegram Group",
    description : "Join Loemart's Telegram group and earn 3 bonus spins",
    spins_reward: 3,
    iconName    : "telegram",
    color       : "#0088cc",
    bg          : "#f0f8ff",
    url         : SOCIAL_LINKS.telegram,
    category    : "community",
    verifyDelay : 15_000,
  },
  {
    id          : "join_whatsapp",
    type        : "join",
    platform    : "WhatsApp Channel",
    label       : "Join WhatsApp Channel",
    description : "Join Loemart's WhatsApp channel and earn 3 bonus spins",
    spins_reward: 3,
    iconName    : "whatsapp",
    color       : "#25d366",
    bg          : "#f0fff8",
    url         : SOCIAL_LINKS.whatsapp,
    category    : "community",
    verifyDelay : 15_000,
  },
];

/* Auto-hide any task whose url is null / empty */
export const EARN_TASKS = ALL_EARN_TASKS.filter((task) => hasLink(task.url));

/* ── Task categories ── */
const ALL_TASK_CATEGORIES = [
  { key: "all",       label: "All Tasks", iconName: null    },
  { key: "social",    label: "Social",    iconName: "phone" },
  { key: "community", label: "Groups",    iconName: "users" },
];

/* Auto-hide categories that have no active tasks */
export const TASK_CATEGORIES = ALL_TASK_CATEGORIES.filter(
  (cat) =>
    cat.key === "all" ||
    EARN_TASKS.some((task) => task.category === cat.key)
);

/* ── History filters ── */
export const HISTORY_FILTERS = [
  { key: "all",    label: "All",     iconName: null     },
  { key: "wins",   label: "Wins",    iconName: "trophy" },
  { key: "losses", label: "Losses",  iconName: "frown"  },
  { key: "bonus",  label: "Bonus",   iconName: "gift"   },
  { key: "coupon", label: "Coupons", iconName: "ticket" },
];

export const filterHistory = (history = [], filter) => {
  const items = Array.isArray(history) ? history : [];
  switch (filter) {
    case "wins":   return items.filter((h) =>  h.is_win);
    case "losses": return items.filter((h) => !h.is_win);
    case "bonus":  return items.filter((h) =>  h.spin_type === "bonus");
    case "coupon": return items.filter((h) => !!h.coupon_code);
    default:       return items;
  }
};

/* ── API ── */
export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

export const API = `${BASE_URL}/api`;

export const getToken = () => {
  if (typeof localStorage === "undefined") return null;
  return (
    localStorage.getItem("marketplace_token") ||
    localStorage.getItem("token") ||
    null
  );
};

export const authH = () => {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };
};