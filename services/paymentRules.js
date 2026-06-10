/**
 * services/paymentRules.js
 *
 * Payment method availability based on order total.
 * Logic is hidden — user only sees available options.
 */

const PAYMENT_RULES = [
  {
    label:   "Small order",
    maxAmount: 3_000,
    methods: ["ONLINE_PAYMENT"],
  },
  {
    label:   "Mid order",
    maxAmount: 100_000,
    methods: ["ONLINE_PAYMENT", "CASH_ON_DELIVERY"],
  },
  {
    label:   "High-value order",
    maxAmount: Infinity,
    methods: ["ONLINE_PAYMENT"],
  },
];

/**
 * Get available payment methods for a given total.
 * @param {number} grandTotal - total including delivery fee
 * @returns {string[]} available payment methods
 */
export function getPaymentOptions(grandTotal) {
  const amount = Number(grandTotal) || 0;

  for (const rule of PAYMENT_RULES) {
    if (amount <= rule.maxAmount) {
      return rule.methods;
    }
  }

  return ["ONLINE_PAYMENT"];
}

/**
 * Validate that a payment method is allowed for a given total.
 */
export function isPaymentMethodAllowed(method, grandTotal) {
  const allowed = getPaymentOptions(grandTotal);
  return allowed.includes(method);
}

/**
 * Human-readable label for each payment method.
 */
export const PAYMENT_LABELS = {
  ONLINE_PAYMENT:   { label: "Pay Online",       icon: "💳", desc: "Card, bank transfer, USSD" },
  CASH_ON_DELIVERY: { label: "Cash on Delivery", icon: "💵", desc: "Pay when your order arrives" },
};