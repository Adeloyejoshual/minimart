import { FaGift } from "react-icons/fa";

export const coupons = [
  { id: 1, label: "₦500 Off", type: "money", value: 500, icon: <FaGift />, expiresInDays: 7 },
  { id: 2, label: "Free Delivery", type: "freeDelivery", value: 2, icon: <FaGift />, expiresInDays: 3 },
  { id: 3, label: "₦1000 Off", type: "money", value: 1000, icon: <FaGift />, expiresInDays: 10 },
  { id: 4, label: "10% Off", type: "percentage", value: 10, icon: <FaGift />, expiresInDays: 5 },
  { id: 5, label: "No Reward", type: "none", value: 0, icon: <FaGift />, expiresInDays: 0 },
  { id: 6, label: "Spin Again", type: "repeat", value: 0, icon: <FaGift />, expiresInDays: 0 },
];