// src/config/spinRewards.js
import { FaGift, FaTruck, FaPercentage, FaCoins } from "react-icons/fa";

export const spinRewards = [
  {
    id: 1,
    label: "₦500 Off",
    type: "money",
    value: 500,
    icon: <FaCoins />,
  },
  {
    id: 2,
    label: "Free Delivery",
    type: "freeDelivery",
    value: 1, // number of free deliveries
    icon: <FaTruck />,
  },
  {
    id: 3,
    label: "₦1000 Off",
    type: "money",
    value: 1000,
    icon: <FaCoins />,
  },
  {
    id: 4,
    label: "10% Off",
    type: "percentage",
    value: 10,
    icon: <FaPercentage />,
  },
  {
    id: 5,
    label: "Free Shipping for 2 Shipped",
    type: "freeDelivery",
    value: 2,
    icon: <FaTruck />,
  },
  {
    id: 6,
    label: "Spin Again",
    type: "repeat",
    value: 0,
    icon: <FaGift />,
  },
  {
    id: 7,
    label: "No Reward",
    type: "none",
    value: 0,
    icon: <FaGift />,
  },
];