/**
 * src/config/topCategories.jsx
 * Curated e-commerce categories with React Icons
 */

import {
  FiGrid,
  FiSmartphone,
  FiShoppingBag,
  FiSmile,
  FiTv,
  FiMonitor,
  FiWatch,
} from "react-icons/fi";

export const TOP_CATEGORIES = [
  {
    id: "all",
    name: "Explore All",
    Icon: FiGrid,
  },
  {
    id: "102055d1-180a-4b8f-a39b-3b20a4838e90",
    slug: "phones-tablets",
    name: "Phones",
    Icon: FiSmartphone,
  },
  {
    id: "8ba64fb7-33a6-415e-a895-38d778a49075",
    slug: "fashion",
    name: "Fashion",
    Icon: FiShoppingBag,
  },
  {
    id: "4aba6a69-2b1c-4b19-9ca0-3b2630ef6fdb",
    slug: "beauty-personal-care",
    name: "Beauty",
    Icon: FiSmile,
  },
  {
    id: "bba9b3e7-4118-42c4-9ea9-4aa2afd445dc",
    slug: "electronics",
    name: "Electronics",
    Icon: FiTv,
  },
  {
    id: "fc1acba9-a5ca-4a82-8305-81586ecb75e1",
    slug: "computers-laptops",
    name: "Computers",
    Icon: FiMonitor,
  },
  {
    id: "e5a9f2c1-8b4d-4e7a-a3c6-5b9d1e2f8a4c",
    slug: "watches-jewelry",
    name: "Watches",
    Icon: FiWatch,
  },
];

export default TOP_CATEGORIES;