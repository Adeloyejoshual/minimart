export const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

export const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

export const fmtCountdown = (secs) => {
  if (!secs || secs <= 0) return "00:00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};

export const isBigWin = (result) => {
  if (!result?.is_win)                                            return false;
  if (result.is_big_win)                                          return true;
  if (result.type === "fixed"      && Number(result.value) >= 2000) return true;
  if (result.type === "percentage" && Number(result.value) >= 20)   return true;
  if (result.type === "free_shipping")                              return true;
  return false;
};

/* ── Earn tasks config ── */
export const EARN_TASKS = [
  {
    id          : "follow_instagram",
    type        : "follow",
    platform    : "Instagram",
    label       : "Follow on Instagram",
    description : "Follow @Loemart on Instagram and earn 3 bonus spins",
    spins_reward: 3,
    iconName    : "instagram",
    color       : "#e1306c",
    bg          : "#fff0f5",
    url         : "https://instagram.com/loemart",
    category    : "social",
    verifyDelay : 10_000,
  },
  {
    id          : "follow_tiktok",
    type        : "follow",
    platform    : "TikTok",
    label       : "Follow on TikTok",
    description : "Follow @Loemart on TikTok and earn 3 bonus spins",
    spins_reward: 3,
    iconName    : "tiktok",
    color       : "#010101",
    bg          : "#f5f5f5",
    url         : "https://tiktok.com/@loemart",
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
    url         : "https://facebook.com/loemart",
    category    : "social",
    verifyDelay : 10_000,
  },
  {
    id          : "join_telegram",
    type        : "join",
    platform    : "Telegram",
    label       : "Join Telegram Channel",
    description : "Join Loemart's Telegram channel and earn 3 bonus spins",
    spins_reward: 3,
    iconName    : "telegram",
    color       : "#0088cc",
    bg          : "#f0f8ff",
    url         : "https://t.me/loemart",
    category    : "community",
    verifyDelay : 15_000,
  },
  {
    id          : "join_whatsapp",
    type        : "join",
    platform    : "WhatsApp Channel",
    label       : "Follow WhatsApp Channel",
    description : "Follow Loemart's WhatsApp Channel and earn 3 bonus spins",
    spins_reward: 3,
    iconName    : "whatsapp",
    color       : "#25d366",
    bg          : "#f0fff8",
    url         : "https://whatsapp.com/channel/loemart",
    category    : "community",
    verifyDelay : 15_000,
  },
];

export const TASK_CATEGORIES = [
  { key: "all",       label: "All Tasks", iconName: null      },
  { key: "social",    label: "Social",    iconName: "phone"   },
  { key: "community", label: "Groups",    iconName: "users"   },
];

export const HISTORY_FILTERS = [
  { key: "all",    label: "All",     iconName: null      },
  { key: "wins",   label: "Wins",    iconName: "trophy"  },
  { key: "losses", label: "Losses",  iconName: "frown"   },
  { key: "bonus",  label: "Bonus",   iconName: "gift"    },
  { key: "coupon", label: "Coupons", iconName: "ticket"  },
];

export const filterHistory = (history, filter) => {
  switch (filter) {
    case "wins":   return history.filter((h) => h.is_win);
    case "losses": return history.filter((h) => !h.is_win);
    case "bonus":  return history.filter((h) => h.spin_type === "bonus");
    case "coupon": return history.filter((h) => !!h.coupon_code);
    default:       return history;
  }
};

/* ── API ── */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
export const API      = `${BASE_URL}/api`;

export const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

export const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});