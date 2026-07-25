// FILE: config/spinwheel.config.js

/* ════════════════════════════════════════════════════════════
   WHEEL SEGMENTS
   probability values must sum to 100
   Order matters for visual layout on the wheel
════════════════════════════════════════════════════════════ */
export const WHEEL_SEGMENTS = Object.freeze([
  { id: 1, label: "₦100 Airtime",  type: "airtime",       value: 100, color: "#0891b2", bg: "#f0f9ff", emoji: "📱",  probability: 7,  is_big_win: false },
  { id: 2, label: "₦100 Coupon",   type: "fixed",         value: 100, color: "#e8630a", bg: "#fff0e6", emoji: "🎟️", probability: 25, is_big_win: false },
  { id: 3, label: "5% Discount",   type: "percentage",    value: 5,   color: "#6366f1", bg: "#eef2ff", emoji: "%",   probability: 15, is_big_win: false },
  { id: 4, label: "₦500 Coupon",   type: "fixed",         value: 500, color: "#16a34a", bg: "#f0fdf4", emoji: "💰",  probability: 10, is_big_win: false },
  { id: 5, label: "Try Again",     type: "none",          value: 0,   color: "#6b7280", bg: "#f3f4f6", emoji: "😅",  probability: 35, is_big_win: false },
  { id: 6, label: "Free Shipping", type: "free_shipping", value: 0,   color: "#d97706", bg: "#fffbeb", emoji: "🚚",  probability: 5,  is_big_win: true  },
  { id: 7, label: "10% Discount",  type: "percentage",    value: 10,  color: "#dc2626", bg: "#fef2f2", emoji: "🔥",  probability: 3,  is_big_win: true  },
]);

/* ════════════════════════════════════════════════════════════
   SOCIAL LINKS
   One place to update all platform URLs
════════════════════════════════════════════════════════════ */
export const SOCIAL_LINKS = Object.freeze({
  instagram : "https://www.instagram.com/loemartmarketplace?igsh=ZnVsemNjeXJqd25v",
  tiktok    : "https://www.tiktok.com/@loemart01?_r=1&_t=ZS-98JWnHsupEN",
  facebook  : null,
  telegram  : "https://t.me/loemartmarketplace",
  whatsapp  : "https://whatsapp.com/channel/0029VbCkfHbGZNCm5XkWd347",
});

/* ════════════════════════════════════════════════════════════
   EARN TASKS
   Single source of truth — must mirror the frontend config.
   spins_reward  → bonus spins credited on completion
   verify_type   → "honor" = user self-reports (no API check)
════════════════════════════════════════════════════════════ */
export const EARN_TASKS_DEF = Object.freeze([
  {
    id          : "follow_instagram",
    label       : "Follow on Instagram",
    platform    : "Instagram",
    type        : "follow",
    category    : "social",
    spins_reward: 3,
    verify_type : "honor",
    url         : SOCIAL_LINKS.instagram,
  },
  {
    id          : "follow_tiktok",
    label       : "Follow on TikTok",
    platform    : "TikTok",
    type        : "follow",
    category    : "social",
    spins_reward: 3,
    verify_type : "honor",
    url         : SOCIAL_LINKS.tiktok,
  },
  {
    id          : "follow_facebook",
    label       : "Follow on Facebook",
    platform    : "Facebook",
    type        : "follow",
    category    : "social",
    spins_reward: 5,
    verify_type : "honor",
    url         : SOCIAL_LINKS.facebook,
  },
  {
    id          : "join_telegram",
    label       : "Join Telegram Channel",
    platform    : "Telegram",
    type        : "join",
    category    : "community",
    spins_reward: 3,
    verify_type : "honor",
    url         : SOCIAL_LINKS.telegram,
  },
  {
    id          : "join_whatsapp",
    label       : "Follow WhatsApp Channel",
    platform    : "WhatsApp Channel",
    type        : "join",
    category    : "community",
    spins_reward: 3,
    verify_type : "honor",
    url         : SOCIAL_LINKS.whatsapp,
  },
]);

/* ════════════════════════════════════════════════════════════
   TASK_MAP  — fast O(1) lookup by task id
════════════════════════════════════════════════════════════ */
export const TASK_MAP = Object.freeze(
  Object.fromEntries(EARN_TASKS_DEF.map((t) => [t.id, t]))
);

/* ════════════════════════════════════════════════════════════
   SPIN CONSTANTS
════════════════════════════════════════════════════════════ */
export const SPIN_CONSTANTS = Object.freeze({
  MAX_FREE_DAILY     : 1,
  MAX_BONUS_STACKED  : 10,
  COUPON_EXPIRY_DAYS : 30,
});

/* ════════════════════════════════════════════════════════════
   VALIDATION GUARD  (runs once at startup)
   Throws if probabilities don't sum to exactly 100
════════════════════════════════════════════════════════════ */
const probTotal = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.probability, 0);
if (probTotal !== 100) {
  throw new Error(
    `[spinwheel.config] WHEEL_SEGMENTS probabilities sum to ${probTotal}, must be 100`
  );
}