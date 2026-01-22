// src/config/promotionPlans.js

export const promotionPlans = [
  {
    id: "starter",
    days: 7,
    label: "Starter Boost",
    icon: "🌟",
    price: 0,
    discountPrice: 0, // discount field added
    priority: 1,
    type: "free",
  },
  {
    id: "silver",
    days: 14,
    label: "Silver Boost",
    icon: "💎",
    price: 0,
    discountPrice: 0,
    priority: 2,
    type: "free",
  },
  {
    id: "gold",
    days: 30,
    label: "Gold Boost",
    icon: "🥇",
    price: 0,
    discountPrice: 0,
    priority: 3,
    type: "free",
  },
  {
    id: "platinum",
    days: 60,
    label: "Platinum Boost",
    icon: "👑",
    price: 200,
    discountPrice: 150, // discounted price added
    priority: 4,
    type: "paid",
  },
  {
    id: "pro",
    days: 120,
    label: "Pro Boost",
    icon: "⚡",
    price: 500,
    discountPrice: 400,
    priority: 5,
    type: "paid",
  },
];