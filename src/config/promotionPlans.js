// src/config/promotionPlans.js

import { FaBolt, FaStar } from "react-icons/fa"; // optional for badges

export const promotionPlans = [
  { name: "free", type: "free", priority: 0, icon: FaBolt },
  { name: "paid", type: "paid", priority: 2, icon: FaStar },
];

export const getPromotionPlan = (planName) => 
  promotionPlans.find((p) => p.name === planName);

export const getPromotionPrice = (planName) => {
  const plan = getPromotionPlan(planName);
  if (!plan) return 0;
  return plan.type === "paid" ? 1000 : 0; // example price in Naira
};

export const isPaidPlan = (planName) => {
  const plan = getPromotionPlan(planName);
  return plan && plan.type === "paid";
};