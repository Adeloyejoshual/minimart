/**
 * src/loemart/mobile/mobileHelpers.js
 *
 * Production Mobile Helpers, Hooks, and Constants.
 * Engineered for absolute responsiveness and zero simulated data layers.
 * Auto-prunes deleted and sold-out products from local browser storage.
 */

import { useState, useEffect, useRef } from "react";
import {
  FiHome, FiGrid, FiShoppingCart, FiHeart, FiUser,
} from "react-icons/fi";
import { Flame, Sparkles, ShieldCheck } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   ENVIRONMENT VARIABLES & STORAGE KEYS
═══════════════════════════════════════════════════════════════ */
const RAW = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
export const API = RAW ? (RAW.endsWith("/api") ? RAW : `${RAW}/api`) : "/api";

export const CART_KEY           = "mm_cart";
export const RECENT_KEY         = "lm-recently-viewed";
export const SEARCH_HISTORY_KEY = "lm-search-history";
export const WISH_KEY           = "loemart-wishlist";

export const DEFAULT_LIMIT  = 40;
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
  { icon: FiGrid,         label: "Browse",  path: "/catalog"   },
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
  const base = Number(p.price || p.selling_price || p.sale_price || 0);
  const orig = Number(p.original_price ?? p.compare_price ?? 0);
  return !orig || orig <= base ? 0 : Math.round(((orig - base) / orig) * 100);
};

/* ── BULLETPROOF IMAGE RESOLVER ── */
export const primaryImg = (images, product = null) => {
  if (product) {
    const direct =
      product.thumbnail ||
      product.image ||
      product.image_url ||
      product.cover_image ||
      product.primary_image;
    if (typeof direct === "string" && direct.length > 4) return direct;
  }

  if (!images) return null;

  if (typeof images === "string") {
    const s = images.trim();
    if (s.startsWith("http") || s.startsWith("/")) return s;
    if (s.startsWith("[")) {
      try {
        return primaryImg(JSON.parse(s), null);
      } catch {
        return null;
      }
    }
    return null;
  }

  if (Array.isArray(images) && images.length > 0) {
    const first = images.find((i) => i && i.is_primary) ?? images[0];
    if (typeof first === "string") return first;
    return (
      first?.url ||
      first?.src ||
      first?.secure_url ||
      first?.path ||
      first?.large ||
      null
    );
  }

  return null;
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
    window.dispatchEvent(new Event("cart-updated"));
  } catch (err) {
    console.error("[Helper] LocalStorage Cart save failed:", err);
  }
};

export const addToCart = (product) => {
  const cart = loadCart();
  const existing = cart.find((i) => i.productId === product.id && !i.variant);

  if (existing) {
    existing.qty = (existing.qty ?? 1) + 1;
  } else {
    cart.push({
      id: `${product.id}__default`,
      productId: product.id,
      name: product.name || product.title,
      price: Number(product.price || product.selling_price || 0),
      image: primaryImg(product.images, product),
      qty: 1,
      variant: null,
      slug: product.slug ?? product.id,
      addedAt: Date.now(),
    });
  }
  saveCart(cart);
};

export const getCartCount = () => {
  return loadCart().reduce((sum, item) => sum + (item.qty ?? 1), 0);
};

/* ═══════════════════════════════════════════════════════════════
   RECENTLY VIEWED ENGINE (Auto-Filters Deleted & Out-Of-Stock)
═══════════════════════════════════════════════════════════════ */
export const getRecentlyViewed = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return raw.filter((p) => {
      if (!p) return false;
      // Filter out deleted, sold out, or out of stock items
      if (p.deleted || p.status === "deleted" || p.status === "out_of_stock" || p.status === "sold_out") return false;
      if (p.is_sold_out || p.sold_out) return false;
      if (p.stock !== undefined && p.stock !== null && Number(p.stock) <= 0) return false;
      return true;
    });
  } catch {
    return [];
  }
};

export const addToRecentlyViewed = (product) => {
  if (!product?.id) return;
  
  // Do NOT save deleted or out of stock items
  if (product.status === "deleted" || product.status === "out_of_stock" || product.status === "sold_out") return;
  if (product.stock !== undefined && product.stock !== null && Number(product.stock) <= 0) return;
  if (product.is_sold_out || product.sold_out) return;

  try {
    const list = getRecentlyViewed().filter((p) => p.id !== product.id);
    list.unshift({
      id: product.id,
      name: product.name || product.title,
      price: product.price || product.selling_price,
      image: primaryImg(product.images, product),
      slug: product.slug ?? product.id,
      stock: product.stock ?? 1,
      status: product.status ?? "active",
      is_sold_out: false,
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  } catch (err) {
    console.warn("[Helper] Failed to update recently viewed:", err);
  }
};

export const clearRecentlyViewed = () => {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {}
};

/**
 * Validates locally stored recently viewed items against the live backend API.
 * Any item that no longer exists (404), is deleted, or is out of stock (stock <= 0)
 * is automatically pruned from browser localStorage.
 */
export const syncRecentlyViewed = async () => {
  try {
    const list = getRecentlyViewed();
    if (!list.length) return [];

    const checks = await Promise.allSettled(
      list.map((item) =>
        fetch(`${API}/products/${item.id}`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      )
    );

    const validList = [];
    checks.forEach((res, idx) => {
      if (res.status === "fulfilled" && res.value?.data) {
        const live = res.value.data;
        const isLiveActive = live.status === "active" && !live.deleted_at;
        const isLiveInStock = Number(live.stock ?? 1) > 0 && !live.is_sold_out;

        if (isLiveActive && isLiveInStock) {
          validList.push(list[idx]);
        }
      }
    });

    localStorage.setItem(RECENT_KEY, JSON.stringify(validList));
    return validList;
  } catch {
    return getRecentlyViewed();
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
   REAL-TIME COUNTDOWN HOOK
═══════════════════════════════════════════════════════════════ */
export function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState({
    h: "00",
    m: "00",
    s: "00",
    expired: true,
  });

  useEffect(() => {
    if (!targetDate) return;

    const target = new Date(targetDate).getTime();
    if (isNaN(target)) return;

    let intervalId;

    const calculateTime = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ h: "00", m: "00", s: "00", expired: true });
        clearInterval(intervalId);
      } else {
        const hours = Math.floor(diff / 3600000);
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
    intervalId = setInterval(calculateTime, 1000);

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
   TACTILE HAPTIC TRIGGER (No-op)
═══════════════════════════════════════════════════════════════ */
export const haptic = () => {};

/* ═══════════════════════════════════════════════════════════════
   REAL DELIVERY ESTIMATES
═══════════════════════════════════════════════════════════════ */
export const getDeliveryEstimate = () => {
  const now = new Date();
  const minDelivery = new Date(now);
  minDelivery.setDate(minDelivery.getDate() + 2);

  return minDelivery.toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};