// src/config/promotion.js
import { FaStar, FaRocket, FaGift, FaBullhorn, FaBolt } from "react-icons/fa";

export const promotionPlans = [
{
id: 1,
name: "TOP Promo",
duration: "7 days",
price: 300,
discount: 50, // NGN off
icon: FaStar,
description: "Get top placement for your product for 7 days",
},
{
id: 2,
name: "Boost Premium",
duration: "1 month",
price: 1000,
discount: 200,
icon: FaRocket,
description: "Premium promotion for maximum visibility for 1 month",
},
{
id: 3,
name: "Trial Free",
duration: "14 days",
price: 0,
discount: 0,
icon: FaGift,
description: "Try our promotion for free and see the impact",
},
{
id: 4,
name: "Professional Pro",
duration: "30 days",
price: 2000,
discount: 500,
icon: FaBullhorn,
description: "Professional promotion for high engagement and exposure",
},
{
id: 5,
name: "Lightning Boost",
duration: "47 days",
price: 500,
discount: 100,
icon: FaBolt,
description: "Quick boost to your product for immediate attention",
},
{
id: 6,
name: "Super Spotlight",
duration: "60 days",
price: 800,
discount: 150,
icon: FaRocket,
description: "Highlight your product in the spotlight section",
},
{
id: 7,
name: "Ultimate Max",
duration: "120 days",
price: 1500,
discount: 300,
icon: FaBullhorn,
description: "Ultimate visibility for maximum reach",
},
];

// Helper function to auto-calculate discount percentage
export const getDiscountPercent = (price, discount) => {
if (!price || price === 0 || !discount) return 0;
return Math.round((discount / price) * 100);
};