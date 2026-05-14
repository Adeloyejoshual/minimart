// src/config/promotions.js
//
// `discount` — percentage off the base price (0 = no discount).
// Must match discount_percent in the promotion_plans DB table.
// Effective price = Math.round(price * (1 - discount / 100))
//
// To run a sale:
//   1. Update discount here  → frontend shows crossed-out price
//   2. UPDATE promotion_plans SET discount_percent = N WHERE id = X  → server validates it

export const promotionPlans = [
  {
    id:       0,
    name:     "Free Listing",
    duration: "Always",
    price:    0,
    discount: 0,
    priority: 0,
    badge:    null,
    features: [
      "Standard visibility",
      "Basic search inclusion",
      "Limited impressions",
    ],
    limits: {
      maxViewsPerDay: 50,
      boost:          false,
    },
    description: "List your product for free with basic exposure",
  },

  {
    id:       1,
    name:     "Starter Boost",
    duration: "3 days",
    price:    300,
    discount: 0,   // e.g. set to 20 for 20% off → effective ₦240
    priority: 1,
    badge:    "Popular",
    features: [
      "Boost in search results",
      "Appears in 'Fresh Deals'",
      "Increased impressions",
    ],
    limits: {
      maxViewsPerDay: 200,
      boost:          true,
    },
    description: "Quick visibility boost for fast sales",
  },

  {
    id:       2,
    name:     "Basic Boost",
    duration: "7 days",
    price:    800,
    discount: 0,
    priority: 2,
    badge:    null,
    features: [
      "Featured in category",
      "Higher search ranking",
      "More impressions",
    ],
    limits: {
      maxViewsPerDay: 500,
      boost:          true,
    },
    description: "Reliable exposure for steady engagement",
  },

  {
    id:       3,
    name:     "Premium Boost",
    duration: "14 days",
    price:    2000,
    discount: 0,
    priority: 3,
    badge:    "Best Value",
    features: [
      "Top placement in category",
      "Homepage exposure",
      "Priority ranking",
      "High impressions",
    ],
    limits: {
      maxViewsPerDay: 1500,
      boost:          true,
    },
    description: "High visibility plan for serious sellers",
  },

  {
    id:       4,
    name:     "Elite Boost",
    duration: "30 days",
    price:    5000,
    discount: 0,
    priority: 4,
    badge:    "Top Seller",
    features: [
      "Homepage spotlight",
      "Top of search results",
      "Maximum exposure",
      "Priority in recommendations",
      "Verified seller badge",
    ],
    limits: {
      maxViewsPerDay: 5000,
      boost:          true,
    },
    description: "Maximum reach and dominance for top sellers",
  },
];
