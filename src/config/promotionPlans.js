// src/config/promotionPlans.js

/**
 * Promotion Plans Configuration
 * Each plan can be used to boost product visibility.
 * - id: unique identifier
 * - label: display name
 * - icon: emoji or icon for UI
 * - days: duration of promotion in days
 * - price: original price (₦)
 * - discountPrice: discounted price (₦)
 * - priority: higher number = higher boost
 * - type: 'free' or 'paid'
 */

export const promotionPlans = [
  {
    id: "starter",
    label: "Starter Boost",
    icon: "🌟",
    days: 7,
    price: 0,
    discountPrice: 0,
    priority: 1,
    type: "free",
  },
  {
    id: "silver",
    label: "Silver Boost",
    icon: "💎",
    days: 14,
    price: 0,
    discountPrice: 0,
    priority: 2,
    type: "free",
  },
  {
    id: "gold",
    label: "Gold Boost",
    icon: "🥇",
    days: 30,
    price: 0,
    discountPrice: 0,
    priority: 3,
    type: "free",
  },
  {
    id: "platinum",
    label: "Platinum Boost",
    icon: "👑",
    days: 60,
    price: 200,
    discountPrice: 150,
    priority: 4,
    type: "paid",
  },
  {
    id: "pro",
    label: "Pro Boost",
    icon: "⚡",
    days: 120,
    price: 500,
    discountPrice: 400,
    priority: 5,
    type: "paid",
  },
];

/**
 * Helper Functions
 */

/**
 * Get plan by ID
 * @param {string} planId 
 * @returns plan object or undefined
 */
export const getPromotionPlan = (planId) =>
  promotionPlans.find((plan) => plan.id === planId);

/**
 * Get final price after discount
 * @param {string} planId 
 * @returns number
 */
export const getPromotionPrice = (planId) => {
  const plan = getPromotionPlan(planId);
  if (!plan) return 0;
  return plan.discountPrice || plan.price || 0;
};

/**
 * Check if a plan is paid
 * @param {string} planId 
 * @returns boolean
 */
export const isPaidPlan = (planId) => {
  const plan = getPromotionPlan(planId);
  return plan?.type === "paid";
};