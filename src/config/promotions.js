// src/config/promotionPlans.js
import { FaStar, FaRocket, FaGift, FaBullhorn, FaBolt, FaCrown, FaChartLine } from "react-icons/fa";

export const promotionPlans = [
  {
    id: 1,
    name: "TOP Promo",
    duration: "7 days",
    price: 500,
    discount: 100,
    originalPrice: 600,
    icon: FaStar,
    description: "Top 3 placement + featured badge (highest clicks)",
    priority: 1,
    features: ["Top 3 listing", "Featured badge", "Priority support"],
  },
  {
    id: 2,
    name: "Boost Premium",
    duration: "30 days",
    price: 1500,
    discount: 300,
    originalPrice: 1800,
    icon: FaRocket,
    description: "Homepage + category featured for 1 month",
    priority: 2,
    features: ["Homepage rotation", "Category top 5", "Push notifications", "Analytics dashboard"],
  },
  {
    id: 3,
    name: "Trial Free",
    duration: "14 days",
    price: 0,
    discount: 0,
    originalPrice: 0,
    icon: FaGift,
    description: "FREE trial - see 3x more views instantly",
    priority: 3,
    features: ["Priority listing", "View analytics", "WhatsApp leads"],
  },
  {
    id: 4,
    name: "Professional Pro",
    duration: "30 days",
    price: 2500,
    discount: 500,
    originalPrice: 3000,
    icon: FaBullhorn,
    description: "Max exposure + WhatsApp blast to 10K buyers",
    priority: 4,
    features: ["Homepage banner", "WhatsApp blast", "Email promotion", "Priority customer service"],
  },
  {
    id: 5,
    name: "Lightning Boost",
    duration: "7 days",
    price: 800,
    discount: 200,
    originalPrice: 1000,
    icon: FaBolt,
    description: "Instant top ranking for immediate sales",
    priority: 5,
    features: ["Instant #1 position", "Urgent badge", "24/7 top placement"],
  },
  {
    id: 6,
    name: "Super Spotlight",
    duration: "60 days",
    price: 2800,
    discount: 700,
    originalPrice: 3500,
    icon: FaCrown,
    description: "King of listings - guaranteed top 1 position",
    priority: 6,
    features: ["Permanent #1", "Spotlight badge", "VIP support", "Custom banner"],
  },
  {
    id: 7,
    name: "Market Leader",
    duration: "90 days",
    price: 4500,
    discount: 1000,
    originalPrice: 5500,
    icon: FaChartLine,
    description: "Dominate your category for 3 months",
    priority: 7,
    features: ["Category takeover", "Analytics Pro", "Dedicated manager", "Performance guarantee"],
  },
];

// --- UTILS ---
export const getDiscountPercent = (price, discount) => {
  if (!price || price === 0 || !discount) return 0;
  return Math.round((discount / (price + discount)) * 100);
};

export const getActivePrice = (price, discount) => Math.max(0, price - discount);

export const getPlanById = (id) => promotionPlans.find(plan => plan.id === id) || null;