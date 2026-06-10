/**
 * services/delivery.js
 *
 * Delivery fee calculation.
 * Fee is based on total cart value — NOT per seller.
 * Logic is hidden from the frontend.
 */

const DELIVERY_TIERS = [
  { max: 5_000,       fee: 800   },
  { max: 50_000,      fee: 1_000 },
  { max: 100_000,     fee: 1_500 },
  { max: 500_000,     fee: 2_000 },
  { max: 1_000_000,   fee: 3_000 },
  { max: 10_000_000,  fee: 5_000 },
  { max: Infinity,    fee: 8_000 }, /* CAP */
];

/**
 * Calculate delivery fee from cart subtotal.
 * @param {number} subtotal - total cart value in Naira
 * @returns {number} delivery fee in Naira
 */
export function calculateDeliveryFee(subtotal) {
  const amount = Number(subtotal) || 0;

  for (const tier of DELIVERY_TIERS) {
    if (amount <= tier.max) {
      return tier.fee;
    }
  }

  return 8_000; /* safety fallback — should never reach here */
}

/**
 * Get delivery fee for display (no breakdown exposed).
 */
export function getDeliveryInfo(subtotal) {
  return {
    fee:      calculateDeliveryFee(subtotal),
    estimate: "1 – 3 business days",
  };
}