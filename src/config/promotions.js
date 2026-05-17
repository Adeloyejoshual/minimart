export const promotionPlans = [
  {
    id: 0, // FREE (handled separately — NOT in DB)
    name: "Free",
    price: 0,
    discount: 0,
    duration: "Unlimited",
    badge: null,
  },

  {
    id: 1,
    name: "Starter",
    price: 300,
    discount: 0,
    duration: "3 days",
    badge: null,
  },

  {
    id: 2,
    name: "Basic",
    price: 800,
    discount: 0,
    duration: "7 days",
    badge: null,
  },

  {
    id: 3,
    name: "Premium",
    price: 2000,
    discount: 0,
    duration: "14 days",
    badge: "Best Value",
  },

  {
    id: 4,
    name: "Elite",
    price: 5000,
    discount: 0,
    duration: "30 days",
    badge: "Top",
  },
];