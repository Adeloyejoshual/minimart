// src/config/spinRewards.js
import { FaGift } from "react-icons/fa";

export const spinRewards = [
  { id: 1, label: "₦500 Off", type: "money", value: 500, icon: <FaGift /> },
  { id: 2, label: "Free Delivery", type: "freeDelivery", value: 2, icon: <FaGift /> },
  { id: 3, label: "₦1000 Off", type: "money", value: 1000, icon: <FaGift /> },
  { id: 4, label: "10% Off", type: "percentage", value: 10, icon: <FaGift /> },
  { id: 5, label: "Free Shipping for 2 shipped", type: "freeDelivery", value: 2, icon: <FaGift /> },
  { id: 6, label: "No Reward", type: "none", value: 0, icon: <FaGift /> },
  { id: 7, label: "Spin Again", type: "repeat", value: 0, icon: <FaGift /> },
];