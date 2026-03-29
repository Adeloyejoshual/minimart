import { PROMOTION_PLANS } from "../config/promotions";

/* get plan safely */
export const getPlan = (id) => PROMOTION_PLANS[id];

/* check if promotion active */
export const isPromotionActive = (product) => {
  if (!product?.promotion?.active) return false;
  if (!product?.promotion?.expires_at) return false;

  return new Date(product.promotion.expires_at) > new Date();
};

/* compute ranking score */
export const getBoostScore = (product) => {
  if (!isPromotionActive(product)) return 0;
  return product?.promotion?.boost_score || 0;
};

/* marketplace ranking function */
export const sortByBoost = (items = []) => {
  return [...items].sort((a, b) => {
    const scoreA =
      getBoostScore(a) +
      new Date(a.createdAt || 0).getTime() / 1e12;

    const scoreB =
      getBoostScore(b) +
      new Date(b.createdAt || 0).getTime() / 1e12;

    return scoreB - scoreA;
  });
};