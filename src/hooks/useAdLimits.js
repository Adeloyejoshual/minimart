// /hooks/useAdLimits.js

import categoryRules from "../config/categoryRules";
import { checkAdLimit } from "../services/adsService";

export const useAdLimitCheck = async (userId, category) => {
  const rules = categoryRules[category] || categoryRules.Default;
  return await checkAdLimit(userId, category, rules.freeAdsLimit);
};