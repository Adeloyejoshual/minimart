// src/config/promotion.js
import { FaStar, FaRocket, FaGift, FaBullhorn, FaBolt } from "react-icons/fa";

export const promotionPlans = [
  {
    name: "TOP Promo",
    duration: "7 days",
    price: 300,
    discount: 50, // NGN off
    icon: FaStar,
    description: "Get top placement for your product for 7 days",
  },
  {
    name: "Boost Premium",
    duration: "1 month",
    price: 1000,
    discount: 200,
    icon: FaRocket,
    description: "Premium promotion for maximum visibility for 1 month",
  },
  {
    name: "Trial Free",
    duration: "14 days",
    price: 0,
    discount: 0,
    icon: FaGift,
    description: "Try our promotion for free and see the impact",
  },
  {
    name: "Professional Pro",
    duration: "30 days",
    price: 2000,
    discount: 500,
    icon: FaBullhorn,
    description: "Professional promotion for high engagement and exposure",
  },
  {
    name: "Lightning Boost",
    duration: "3 days",
    price: 500,
    discount: 100,
    icon: FaBolt,
    description: "Quick boost to your product for immediate attention",
  },
];

// Helper function to auto-generate discount percentage
export const getDiscountPercent = (price, discount) => {
  if (!price || price === 0 || !discount) return 0;
  return Math.round((discount / price) * 100);
};