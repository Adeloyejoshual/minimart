// server/utils/flagSuspiciousSellers.js
export const flagSuspiciousSellers = (seller) => {
  const reasons = [];

  if (seller.refundRate > 0.3) reasons.push("High refund rate");
  if (seller.products > 100 && seller.accountAgeDays < 30) reasons.push("Rapid product uploads");
  if (seller.negativeReviews > 10) reasons.push("High negative reviews");

  if (reasons.length > 0) {
    return { suspicious: true, flagReason: reasons.join(", ") };
  }
  return { suspicious: false, flagReason: "" };
};