/**
 * src/loemart/mobile/mobileHelpers.js
 *
 * Production Mobile Helpers, Hooks, and Constants.
 * Engineered for absolute responsiveness and zero simulated data layers.
 *
 * v4.0 — Zero Simulation Production Release
 * ──────────────────────────────────────────────────────────
 * ✓ Removed fake ratings, reviews, and sold count calculations
 * ✓ Real-Time Event-Driven Countdown Hook (targets actual dates)
 * ✓ Exception-protected guest LocalStorage synchronization
 * ✓ Modern Vector icon maps for cross-device visual parity
 */

import { useState, useEffect, useRef } from "react";
import {
  FiHome, FiGrid, FiShoppingCart, FiHeart, FiUser,
} from "react-icons/fi";
import { Flame, Sparkles, ShieldCheck } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   ENVIRONMENT VARIABLES & STORAGE KEYS
═══════════════════════════════════════════════════════════════ */
export const API                = `${import.meta.env.VITE_API_BASE_URL}/api`;
export const CART_KEY           = "mm_cart";
export const RECENT_KEY         = "lm-recently-viewed";
export const SEARCH_HISTORY_KEY = "lm-search-history";
export const WISH_KEY           = "loemart-wishlist";

export const DEFAULT_LIMIT  = 12;
export const SLIDE_INTERVAL = 6000;

/* ═══════════════════════════════════════════════════════════════
   CORE CONFIGURATIONS
═══════════════════════════════════════════════════════════════ */
export const SORT_OPTIONS = [
  { value: "newest",     label: "Newest"    },
  { value: "price_asc",  label: "Price ↑"   },
  { value: "price_desc", label: "Price ↓"   },
  { value: "trending",   label: "Trending"  },
  { value: "views",      label: "Popular"   },
  { value: "saves",      label: "Loved"     },
];

export const HERO_SLIDES = [
  {
    id     : "slide-flash",
    eyebrow: "Flash Sale",
    title  : "Up to 70% Off",
    sub    : "Exclusive deals from verified sellers",
    cta    : "Shop Now",
    bg     : "linear-gradient(135deg, #0f0c29 0%, #302b63 100%)",
    accent : "#ff5722",
    Icon   : Flame,
  },
  {
    id     : "slide-arrivals",
    eyebrow: "New Arrivals",
    title  : "Fresh Picks",
    sub    : "Latest products from top sellers near you",
    cta    : "Explore",
    bg     : "linear-gradient(135deg, #134e5e 0%, #71b280 100%)",
    accent : "#10b981",
    Icon   : Sparkles,
  },
  {
    id     : "slide-safety",
    eyebrow: "Verified Safe",
    title  : "Shop Trusted",
    sub    : "Buyer protection on every order",
    cta    : "Browse",
    bg     : "linear-gradient(135deg, #1a0533 0%, #11998e 100%)",
    accent : "#6366f1",
    Icon   : ShieldCheck,
  },
];

export const TRENDING_SEARCHES = [
  "iPhone", "Laptop", "Sneakers", "PlayStation",
  "Fashion", "TV", "Watch", "Camera",
];

export const BOTTOM_NAV = [
  { icon: FiHome,         label: "Home",    path: "/loemart"   },
  { icon: FiGrid,         label: "Browse",  path: "/loemart"   },
  { icon: FiShoppingCart, label: "Cart",    path: "/shop/cart" },
  { icon: FiHeart,        label: "Saved",   path: "/saved"     },
  { icon: FiUser,         label: "Account", path: "/profile"   },
];

/* ═══════════════════════════════════════════════════════════════
   BASIC HELPERS
═══════════════════════════════════════════════════════════════ */
export const normalize = (s = "") => String(s).replace(/\s+/g, " ").trim();

export const fmtPrice = (n) => {
  const amount = Number(n || 0);
  return `₦${amount.toLocaleString("en-NG")}`;
};

export const calcDiscount = (p) => {
  const base = Number(p.price || 0);
  const orig = Number(p.original_price ?? 0);
  return !orig || orig <= base ? 0 : Math.round(((orig - base) / orig) * 100);
};

export const primaryImg = (images = []) => {
  if (!Array.isArray(images) || !images.length) return null;
  return (images.find((i) => i.is_primary) ?? images[0])?.url ?? null;
};

/* ═══════════════════════════════════════════════════════════════
   SECURE LOCAL GUEST CART PIPELINE
═══════════════════════════════════════════════════════════════ */
export const loadCart = () => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch (err) {
    console.error("[Helper] LocalStorage Cart load failed:", err);
    return [];
  }
};

export const saveCart = (cart) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    // Immediately notify other components listening to storage/updates
    window.dispatchEvent(new Event("cart-updated"));
  } catch (err) {
    console.error("[Helper] LocalStorage Cart save failed:", err);
  }
};

export const addToCart = (product) => {
  const cart     = loadCart();
  const existing = cart.find((i) => i.productId === product.id && !i.variant);
  
  if (existing) {
    existing.qty = (existing.qty ?? 1) + 1;
  } else {
    cart.push({
      id: `${product.id}__default`,
      productId : product.id,
      name      : product.name,
      price     : Number(product.price || 0),
      image     : primaryImg(product.images),
      qty       : 1,
      variant   : null,
      slug      : product.slug ?? product.id,
      addedAt   : Date.now(),
    });
  }
  saveCart(cart);
};

export const getCartCount = () => {
  return loadCart().reduce((sum, item) => sum + (item.qty ?? 1), 0);
};

/* ═══════════════════════════════════════════════════════════════
   RECENTLY VIEWED
═══════════════════════════════════════════════════════════════ */
export const getRecentlyViewed = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
};

export const addToRecentlyViewed = (product) => {
  if (!product?.id) return;
  try {
    const list = getRecentlyViewed().filter((p) => p.id !== product.id);
    list.unshift({
      id    : product.id,
      name  : product.name,
      price : product.price,
      image : primaryImg(product.images),
      slug  : product.slug ?? product.id,
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  } catch (err) {
    console.warn("[Helper] Failed to update recently viewed:", err);
  }
};

/* ═══════════════════════════════════════════════════════════════
   SEARCH HISTORY
═══════════════════════════════════════════════════════════════ */
export const getSearchHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
};

export const addToSearchHistory = (q) => {
  const query = q?.trim();
  if (!query) return;
  try {
    const list = getSearchHistory().filter((s) => s !== query);
    list.unshift(query);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, 6)));
  } catch (err) {
    console.warn("[Helper] Failed to update search history:", err);
  }
};

/* ═══════════════════════════════════════════════════════════════
   REAL-TIME COUNTDOWN HOOK (Consumes target event dates)
═══════════════════════════════════════════════════════════════ */
export function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({ h: "00", m: "00", s: "00", expired: true });

  useEffect(() => {
    if (!targetDate) return;

    const target = new Date(targetDate).getTime();
    if (isNaN(target)) return;

    const calculateTime = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ h: "00", m: "00", s: "00", expired: true });
        clearInterval(intervalId);
      } else {
        const hours   = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        setTimeLeft({
          h: String(hours).padStart(2, "0"),
          m: String(minutes).padStart(2, "0"),
          s: String(seconds).padStart(2, "0"),
          expired: false,
        });
      }
    };

    calculateTime();
    const intervalId = setInterval(calculateTime, 1000);

    return () => clearInterval(intervalId);
  }, [targetDate]);

  return timeLeft;
}

/* ═══════════════════════════════════════════════════════════════
   FADE-IN INTERSECTION OBSERVER
═══════════════════════════════════════════════════════════════ */
export function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

/* ═══════════════════════════════════════════════════════════════
   TACTILE HAPTIC TRIGGER
═══════════════════════════════════════════════════════════════ */
export const haptic = (pattern = 10) => {
  if (typeof window !== "undefined" && window.navigator?.vibrate) {
    try {
      window.navigator.vibrate(pattern);
    } catch {}
  }
};

/* ═══════════════════════════════════════════════════════════════
   REAL DELIVERY ESTIMATES
═══════════════════════════════════════════════════════════════ */
export const getDeliveryEstimate = () => {
  const now = new Date();
  const minDelivery = new Date(now);
  
  // Standard delivery: 2-3 business days
  minDelivery.setDate(minDelivery.getDate() + 2);
  
  return minDelivery.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};