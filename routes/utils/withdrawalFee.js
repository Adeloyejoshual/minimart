// utils/withdrawalFee.js

/**
 * Withdrawal fee schedule
 *
 * First 3 withdrawals per calendar day → free
 * Withdrawal #4+ today:
 *   ₦0      – ₦9,999     → ₦50
 *   ₦10,000 – ₦99,999    → ₦100
 *   ₦100,000– ₦500,000   → ₦150
 *   > ₦500,000            → ₦200  (large-transfer surcharge)
 *
 * @param {number} amount           - gross withdrawal amount (NGN)
 * @param {number} withdrawalsToday - completed/pending/processing count today
 * @returns {number} fee in NGN
 */
export const calculateWithdrawalFee = (amount, withdrawalsToday) => {
  // First 3 are always free
  if (withdrawalsToday < 3) return 0;

  if (amount <= 9_999)   return 50;
  if (amount <= 99_999)  return 100;
  if (amount <= 500_000) return 150;

  return 200; // > ₦500,000
};

/**
 * Human-readable fee explanation shown in the UI.
 * @param {number} withdrawalsToday
 * @returns {string}
 */
export const feeScheduleLabel = (withdrawalsToday) => {
  const free = Math.max(0, 3 - withdrawalsToday);

  if (free > 0) {
    return `${free} free withdrawal${free > 1 ? "s" : ""} remaining today`;
  }

  return "₦50 · ₦100 · ₦150 · ₦200 (by amount)";
};

/**
 * Preview fee tiers for display in the UI fee table.
 */
export const FEE_TIERS = [
  { label: "₦0 – ₦9,999",          fee: 50  },
  { label: "₦10,000 – ₦99,999",    fee: 100 },
  { label: "₦100,000 – ₦500,000",  fee: 150 },
  { label: "Above ₦500,000",        fee: 200 },
];