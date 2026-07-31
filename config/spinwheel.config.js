// FILE: config/spinwheel.config.js

/* ════════════════════════════════════════════════════════════
   TYPE DEFINITIONS  (JSDoc — no build step required)
════════════════════════════════════════════════════════════ */

/**
 * @typedef {"airtime"|"fixed"|"percentage"|"free_shipping"|"none"} RewardType
 *
 * @typedef {Object} WheelSegment
 * @property {number}      id           - Unique segment identifier
 * @property {string}      label        - Display label on the wheel
 * @property {RewardType}  type         - Reward category
 * @property {number}      value        - Reward value (0 for none/free_shipping)
 * @property {string}      color        - Primary hex colour (text / border)
 * @property {string}      bg           - Background hex colour for result card
 * @property {string}      emoji        - Emoji icon rendered on the wheel slice
 * @property {number}      probability  - Weight out of 100; all segments must sum to 100
 * @property {boolean}     is_big_win   - Flags premium prizes for special UI treatment
 *
 * @typedef {"follow"|"join"} TaskType
 * @typedef {"social"|"community"} TaskCategory
 * @typedef {"honor"} VerifyType
 *
 * @typedef {Object} EarnTask
 * @property {string}        id            - Stable snake_case identifier
 * @property {string}        label         - Human-readable task name
 * @property {string}        platform      - Platform display name
 * @property {TaskType}      type          - Action the user must perform
 * @property {TaskCategory}  category      - Grouping used by the UI
 * @property {number}        spins_reward  - Bonus spins credited on completion
 * @property {VerifyType}    verify_type   - How completion is verified
 * @property {string}        url           - Deep-link / channel URL (never null)
 *
 * @typedef {Object} SpinConstants
 * @property {number} MAX_FREE_DAILY      - Free spins granted per calendar day
 * @property {number} MAX_BONUS_STACKED   - Hard cap on banked bonus spins
 * @property {number} COUPON_EXPIRY_DAYS  - Days before an unused coupon expires
 */

/* ════════════════════════════════════════════════════════════
   WHEEL SEGMENTS
   ▸ probability values MUST sum to exactly 100
   ▸ Order determines visual layout on the wheel
════════════════════════════════════════════════════════════ */

/** @type {Readonly<WheelSegment[]>} */
export const WHEEL_SEGMENTS = Object.freeze([
  {
    id          : 1,
    label       : "₦100 Airtime",
    type        : "airtime",
    value       : 100,
    color       : "#0891b2",
    bg          : "#f0f9ff",
    emoji       : "📱",
    probability : 14,
    is_big_win  : false,
  },
  {
    id          : 2,
    label       : "₦100 Coupon",
    type        : "fixed",
    value       : 100,
    color       : "#e8630a",
    bg          : "#fff0e6",
    emoji       : "🎟️",
    probability : 23,
    is_big_win  : false,
  },
  {
    id          : 3,
    label       : "5% Discount",
    type        : "percentage",
    value       : 5,
    color       : "#6366f1",
    bg          : "#eef2ff",
    emoji       : "🏷️",
    probability : 15,
    is_big_win  : false,
  },
  {
    id          : 4,
    label       : "₦500 Coupon",
    type        : "fixed",
    value       : 500,
    color       : "#16a34a",
    bg          : "#f0fdf4",
    emoji       : "💰",
    probability : 7,
    is_big_win  : false,
  },
  {
    id          : 5,
    label       : "Try Again",
    type        : "none",
    value       : 0,
    color       : "#6b7280",
    bg          : "#f3f4f6",
    emoji       : "😅",
    probability : 33,
    is_big_win  : false,
  },
  {
    id          : 6,
    label       : "Free Shipping",
    type        : "free_shipping",
    value       : 0,
    color       : "#d97706",
    bg          : "#fffbeb",
    emoji       : "🚚",
    probability : 5,
    is_big_win  : true,
  },
  {
    id          : 7,
    label       : "10% Discount",
    type        : "percentage",
    value       : 10,
    color       : "#dc2626",
    bg          : "#fef2f2",
    emoji       : "🔥",
    probability : 3,
    is_big_win  : true,
  },
]);
// Segment probability total: 14+23+15+7+33+5+3 = 100 ✓

/* ════════════════════════════════════════════════════════════
   SOCIAL LINKS
   ▸ Every value must be a non-empty string.
   ▸ If a platform page does not exist yet, remove the key
     and delete the corresponding EARN_TASKS_DEF entry until
     it is ready — never set a value to null here.
════════════════════════════════════════════════════════════ */

/** @type {Readonly<Record<string, string>>} */
export const SOCIAL_LINKS = Object.freeze({
  instagram : "https://www.instagram.com/loemartmarketplace?igsh=ZnVsemNjeXJqd25v",
  tiktok    : "https://www.tiktok.com/@loemartmarketplace?_r=1&_t=ZS-98Oc4twCrv5",
  // facebook : "https://facebook.com/loemartmarketplace",  // TODO: uncomment when page is live
  telegram  : "https://t.me/loemartmarketplace",
  whatsapp  : "https://whatsapp.com/channel/0029VbCkfHbGZNCm5XkWd347",
});

/* ════════════════════════════════════════════════════════════
   EARN TASKS
   ▸ Single source of truth — must mirror backend reward logic.
   ▸ url must reference a key that exists in SOCIAL_LINKS.
   ▸ verify_type "honor" = user self-reports; no API check.
   ▸ To temporarily disable a task, remove it from this array.
════════════════════════════════════════════════════════════ */

/** @type {Readonly<EarnTask[]>} */
export const EARN_TASKS = Object.freeze([
  {
    id           : "follow_instagram",
    label        : "Follow on Instagram",
    platform     : "Instagram",
    type         : "follow",
    category     : "social",
    spins_reward : 3,
    verify_type  : "honor",
    url          : SOCIAL_LINKS.instagram,
  },
  {
    id           : "follow_tiktok",
    label        : "Follow on TikTok",
    platform     : "TikTok",
    type         : "follow",
    category     : "social",
    spins_reward : 3,
    verify_type  : "honor",
    url          : SOCIAL_LINKS.tiktok,
  },
  // follow_facebook is intentionally omitted until the page is live.
  // Restore by uncommenting SOCIAL_LINKS.facebook above and adding
  // the task entry below:
  //
  // {
  //   id           : "follow_facebook",
  //   label        : "Follow on Facebook",
  //   platform     : "Facebook",
  //   type         : "follow",
  //   category     : "social",
  //   spins_reward : 5,
  //   verify_type  : "honor",
  //   url          : SOCIAL_LINKS.facebook,
  // },
  {
    id           : "join_telegram",
    label        : "Join Telegram Channel",
    platform     : "Telegram",
    type         : "join",
    category     : "community",
    spins_reward : 3,
    verify_type  : "honor",
    url          : SOCIAL_LINKS.telegram,
  },
  {
    id           : "join_whatsapp",
    label        : "Follow WhatsApp Channel",
    platform     : "WhatsApp Channel",
    type         : "join",
    category     : "community",
    spins_reward : 3,
    verify_type  : "honor",
    url          : SOCIAL_LINKS.whatsapp,
  },
]);

/* ════════════════════════════════════════════════════════════
   TASK MAP  — O(1) lookup by task id
════════════════════════════════════════════════════════════ */

/** @type {Readonly<Record<string, EarnTask>>} */
export const TASK_MAP = Object.freeze(
  Object.fromEntries(EARN_TASKS.map((task) => [task.id, task]))
);

/* ════════════════════════════════════════════════════════════
   SPIN CONSTANTS
════════════════════════════════════════════════════════════ */

/** @type {Readonly<SpinConstants>} */
export const SPIN_CONSTANTS = Object.freeze({
  MAX_FREE_DAILY     : 1,
  MAX_BONUS_STACKED  : 100,
  COUPON_EXPIRY_DAYS : 30,
});

/* ════════════════════════════════════════════════════════════
   CONFIG VALIDATION
   ▸ Runs once at module load in every environment.
   ▸ Export allows explicit re-invocation in test suites.
   ▸ Throws for hard contract violations (probability sum,
     duplicate ids, missing URLs).
   ▸ Warns for soft issues that don't break runtime behaviour.
════════════════════════════════════════════════════════════ */

/**
 * Validates the entire spinwheel configuration.
 * Called automatically on module load; also exported for unit tests.
 *
 * @throws {Error} If any hard contract is violated.
 * @returns {void}
 */
export function validateConfig() {
  const errors   = /** @type {string[]} */ ([]);
  const warnings = /** @type {string[]} */ ([]);

  /* ── 1. Wheel segment probability sum ─────────────────── */
  const probTotal = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.probability, 0);
  if (probTotal !== 100) {
    errors.push(
      `WHEEL_SEGMENTS probabilities sum to ${probTotal} — must equal 100.`
    );
  }

  /* ── 2. Duplicate segment ids ──────────────────────────── */
  const segmentIds = WHEEL_SEGMENTS.map((s) => s.id);
  const dupSegmentIds = segmentIds.filter(
    (id, idx) => segmentIds.indexOf(id) !== idx
  );
  if (dupSegmentIds.length > 0) {
    errors.push(
      `Duplicate WHEEL_SEGMENTS id(s): ${dupSegmentIds.join(", ")}.`
    );
  }

  /* ── 3. Segment probability values are positive integers ─ */
  const badProbs = WHEEL_SEGMENTS.filter(
    (s) => !Number.isInteger(s.probability) || s.probability <= 0
  );
  if (badProbs.length > 0) {
    errors.push(
      `Segments with invalid probability (must be a positive integer): ` +
      badProbs.map((s) => `"${s.label}" (${s.probability})`).join(", ") + "."
    );
  }

  /* ── 4. Duplicate task ids ─────────────────────────────── */
  const taskIds = EARN_TASKS.map((t) => t.id);
  const dupTaskIds = taskIds.filter(
    (id, idx) => taskIds.indexOf(id) !== idx
  );
  if (dupTaskIds.length > 0) {
    errors.push(
      `Duplicate EARN_TASKS id(s): ${dupTaskIds.join(", ")}.`
    );
  }

  /* ── 5. Tasks must have a non-empty string URL ─────────── */
  const badUrlTasks = EARN_TASKS.filter(
    (t) => typeof t.url !== "string" || t.url.trim() === ""
  );
  if (badUrlTasks.length > 0) {
    errors.push(
      `EARN_TASKS entries with missing or empty url: ` +
      badUrlTasks.map((t) => `"${t.id}"`).join(", ") +
      `. Remove the task or add a valid URL.`
    );
  }

  /* ── 6. Social links referenced by tasks must exist ───── */
  EARN_TASKS.forEach((task) => {
    const matched = Object.values(SOCIAL_LINKS).includes(task.url);
    if (!matched) {
      warnings.push(
        `Task "${task.id}" url is not found in SOCIAL_LINKS — ` +
        `ensure it is intentional and the link is correct.`
      );
    }
  });

  /* ── 7. Emit warnings ──────────────────────────────────── */
  warnings.forEach((msg) =>
    console.warn(`[spinwheel.config] ⚠️  ${msg}`)
  );

  /* ── 8. Throw aggregated errors ────────────────────────── */
  if (errors.length > 0) {
    throw new Error(
      `[spinwheel.config] Configuration invalid:\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join("\n")
    );
  }
}

// Run immediately so misconfiguration is caught at startup,
// not silently at the point of first use.
validateConfig();