export const STEPS = [
  { id: 1, label: "Photos",   icon: "camera"   },
  { id: 2, label: "Info",     icon: "tag"      },
  { id: 3, label: "Category", icon: "package"  },
  { id: 4, label: "Variants", icon: "zap"      },
  { id: 5, label: "Pricing",  icon: "dollar"   },
  { id: 6, label: "Review",   icon: "file"     },
];

export const BLANK_VARIANT = () => ({
  _id: `${Date.now()}-${Math.random()}`,
  sku: "", name: "", price: "", stock: "1",
  attributes: { color: "", size: "", storage: "", material: "" },
});

export const DRAFT_KEY = "add-product-draft-v2";

export const API =
  import.meta.env.VITE_API_URL || "https://minimart-ivrm.onrender.com/api";