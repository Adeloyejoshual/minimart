import { FaInfoCircle, FaFileContract, FaShieldAlt, FaMoneyBillWave, FaStore } from "react-icons/fa";

export const infoPages = [
  {
    id: 1,
    label: "About MiniMart",
    description: "Learn what MiniMart is and how it works.",
    path: "/settings/about",
    icon: <FaInfoCircle />,
  },
  {
    id: 2,
    label: "Terms & Conditions",
    description: "Understand your rights and responsibilities.",
    path: "/settings/terms",
    icon: <FaFileContract />,
  },
  {
    id: 3,
    label: "Privacy Policy",
    description: "How we handle your personal data.",
    path: "/settings/privacy",
    icon: <FaShieldAlt />,
  },
  {
    id: 4,
    label: "Make Money",
    description: "Learn to earn more by selling products.",
    path: "/profile/make-money",
    icon: <FaMoneyBillWave />,
  },
  {
    id: 5,
    label: "Become Seller",
    description: "Apply to sell products on MiniMart.",
    path: "/profile/become-seller",
    icon: <FaStore />,
  },
];