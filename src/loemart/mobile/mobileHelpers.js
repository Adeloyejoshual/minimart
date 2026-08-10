/**
 * src/loemart/mobile/mobileHelpers.js
 *
 * Shared helpers, hooks, constants for all mobile sub-components.
 *
 * v3 — Emojis replaced with SVG icons (lucide-react)
 * Better rendering across devices, no font-emoji issues,
 * customizable size/color, professional look.
 */

import { useState, useEffect, useRef } from "react";
import {
  FiHome, FiGrid, FiShoppingCart, FiHeart, FiUser,
} from "react-icons/fi";
import {
  Flame, Sparkles, ShieldCheck,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   ENV + KEYS
═══════════════════════════════════════════════════════════════ */
export const API                = `${import.meta.env.VITE_API_BASE_URL}/api`;
export const CART_KEY           = "mm_cart";
export const RECENT_KEY         = "lm-recently-viewed";
export const SEARCH_HISTORY_KEY = "lm-search-history";
export const WISH_KEY           = "loemart-wishlist";

export const DEFAULT_LIMIT  = 12;
export const SLIDE_INTERVAL = 6000;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
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
    id     : 1,
    eyebrow: "Flash Sale",
    title  : "Up to 70% Off",
    sub    : "Exclusive deals from verified sellers",
    cta    : "Shop Now",
    bg     : "linear-gradient(135deg,#0f0c29 0%,#302b63 100%)",
    accent : "#ff5722",
    Icon   : Flame,           // ← SVG component (not string)
  },
  {
    id     : 2,
    eyebrow: "New Arrivals",
    title  : "Fresh Picks",
    sub    : "Latest products from top sellers near you",
    cta    : "Explore",
    bg     : "linear-gradient(135deg,#134e5e 0%,#71b280 100%)",
    accent : "#10b981",
    Icon   : Sparkles,        // ← SVG component
  },
  {
    id     : 3,
    eyebrow: "Verified Safe",
    title  : "Shop Trusted",
    sub    : "Buyer protection on every order",
    cta    : "Browse",
    bg     : "linear-gradient(135deg,#1a0533 0%,#11998e 100%)",
    accent : "#6366f1",
    Icon   : ShieldCheck,     // ← SVG component
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

export const fmtPrice = (n) => `₦${Number(n).toLocaleString("en-NG")}`;

export const calcDiscount = (p) => {
  const base = Number(p.price);
  const orig = Number(p.original_price ?? 0);
  return !orig || orig <= base ? 0 : Math.round(((orig - base) / orig) * 100);
};

export const primaryImg = (images = []) => {
  if (!Array.isArray(images) || !images.length) return null;
  return (images.find((i) => i.is_primary) ?? images[0])?.url ?? null;
};

/* Ratings + sold count (fake until real reviews wired) */
export const fakeRating = (product) => {
  const seed = (product.view_count ?? 0) + (product.save_count ?? 0);
  return Math.min(5, 3.6 + (seed % 12) / 10);
};

export const fakeSold = (product) => {
  const s = product.view_count ?? 0;
  if (s > 1000) return `${Math.floor(s / 100) * 10}+ sold`;
  if (s > 100)  return `${Math.floor(s / 10)  * 10}+ sold`;
  return null;
};

export const fakeReviewCount = (product) =>
  ((product?.view_count ?? 0) % 500) + 10;

/* ═══════════════════════════════════════════════════════════════
   CART HELPERS
═══════════════════════════════════════════════════════════════ */
export const loadCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
};

export const saveCart = (cart) => {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  window.dispatchEvent(new Event("cart-updated"));
};

export const addToCart = (product) => {
  const cart     = loadCart();
  const existing = cart.find((i) => i.productId === product.id && !i.variant);
  if (existing) { existing.qty += 1; }
  else {
    cart.push({
      productId : product.id,
      name      : product.name,
      price     : Number(product.price),
      image     : primaryImg(product.images),
      qty       : 1,
      variant   : null,
      slug      : product.slug ?? product.id,
    });
  }
  saveCart(cart);
};

export const getCartCount = () =>
  loadCart().reduce((s, i) => s + (i.qty ?? 1), 0);

/* ═══════════════════════════════════════════════════════════════
   RECENTLY VIEWED
═══════════════════════════════════════════════════════════════ */
export const getRecentlyViewed = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};

export const addToRecentlyViewed = (product) => {
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
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   SEARCH HISTORY
═══════════════════════════════════════════════════════════════ */
export const getSearchHistory = () => {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]"); }
  catch { return []; }
};

export const addToSearchHistory = (q) => {
  if (!q.trim()) return;
  try {
    const list = getSearchHistory().filter((s) => s !== q);
    list.unshift(q);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN HOOK
═══════════════════════════════════════════════════════════════ */
export function useCountdown(hours = 4) {
  const end = useRef(Date.now() + hours * 3600000 + 22 * 60000);
  const [t, setT] = useState({ h:"04", m:"22", s:"00" });

  useEffect(() => {
    const tick = () => {
      const d = Math.max(0, end.current - Date.now());
      setT({
        h: String(Math.floor(d / 3600000)).padStart(2, "0"),
        m: String(Math.floor((d % 3600000) / 60000)).padStart(2, "0"),
        s: String(Math.floor((d % 60000) / 1000)).padStart(2, "0"),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return t;
}

/* ═══════════════════════════════════════════════════════════════
   FADE-IN ON SCROLL
═══════════════════════════════════════════════════════════════ */
export function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

/* ═══════════════════════════════════════════════════════════════
   HAPTIC FEEDBACK
═══════════════════════════════════════════════════════════════ */
export const haptic = (pattern = 10) => {
  window.navigator?.vibrate?.(pattern);
};

/* ═══════════════════════════════════════════════════════════════
   DELIVERY ESTIMATE
═══════════════════════════════════════════════════════════════ */
export const getDeliveryEstimate = () => {
  const now = new Date();
  const min = new Date(now); min.setDate(min.getDate() + 2);
  const fmt = (d) => d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
  return fmt(min);
};