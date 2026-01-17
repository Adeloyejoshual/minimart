// /utils/validateAdWithCategory.js
import categoryRules from '../config/categoryRules.js';
import { validateAd as baseValidateAd } from './validator.js';

export const validateAdWithCategory = (ad) => {
  // Use the category from the ad, fallback to Default
  const rules = categoryRules[ad.category] || categoryRules.Default;

  // Call the existing validator with the rules
  const errors = baseValidateAd({ ...ad, rules });

  return errors;
};