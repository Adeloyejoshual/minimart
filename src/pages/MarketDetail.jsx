/**
 * src/pages/MarketDetail.jsx
 * Route: /shop/:slug
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

import {
  formatPrice,
  calcDiscount,
  getProductImage,
  shouldShowSizeGuide,
  getSizeGuideData,
} from "../config/marketplace";
import useWishlist from "../hooks/useWishlist";

import MarketDetailHeader from "../components/MarketDetailHeader";
import ImageGallery from "./MarketDetail/ImageGallery";
import SellerCard from "./MarketDetail/SellerCard";
import RateProductModal from "./MarketDetail/RateProductModal";
import ProductReviews from "./MarketDetail/ProductReviews";
import VariantBottomSheet from "./MarketDetail/VariantBottomSheet";
import ProductRails from "./MarketDetail/ProductRails";
import DeliveryCard from "./MarketDetail/DeliveryCard";
import DescriptionPage from "./MarketDetail/DescriptionPage";
import SizeGuidePage from "./MarketDetail/SizeGuidePage";
import ReviewsPage from "./MarketDetail/ReviewsPage";
import MarketDetailDebugPanel from "./MarketDetail/MarketDetailDebugPanel";
import FloatingCartButton from "../components/FloatingCartButton";
import Footer from "../components/Footer";

import "../styles/MarketDetail.css";

/* ════════════════════════════════════════════════════════════
   ENV + API
════════════════════════════════════════════════════════════ */
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_ROOT = RAW_BASE
  ? RAW_BASE.endsWith("/api")
    ? RAW_BASE
    : `${RAW_BASE}/api`
  : "/api";
const SHOP_URL = `${API_ROOT}/shop`;
const API_URL = SHOP_URL;
const CART_URL = `${API_ROOT}/cart`;
const CART_ITEMS_URL = `${API_ROOT}/cart/items`;

const CART_KEY = "mm_cart";
const RECENT_KEY = "lm-recently-viewed";
const MAX_QTY = 10;

const pickPrice = (...vals) => {
  for (const v of vals) {
    if (v == null || v === "") continue;
    const n =
      typeof v === "string"
        ? Number(String(v).replace(/,/g, ""))
        : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};

const parsePositiveStock = (val) => {
  if (val == null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const resolveStockCap = (selectedVariant, product, fallback = 99) => {
  return (
    parsePositiveStock(selectedVariant?.stock) ??
    parsePositiveStock(product?.stock) ??
    fallback
  );
};

const nowTime = () => new Date().toLocaleTimeString();

/* ════════════════════════════════════════════════════════════
   ICONS
════════════════════════════════════════════════════════════ */
const Icon = {
  flag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  starOutline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  money: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <line x1="12" y1="18" x2="12" y2="6" />
    </svg>
  ),
  return: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  scale: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M12 3v18" />
      <rect x="4" y="16" width="16" height="5" rx="2" />
      <path d="M6 8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 8v8H6z" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={48} height={48}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={48} height={48}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
};

const TRUST_BADGES = [
  { icon: Icon.lock, label: "Secure Payment", sub: "Protected checkout" },
  { icon: Icon.check, label: "Verified Seller", sub: "Identity confirmed" },
  { icon: Icon.truck, label: "Fast Delivery", sub: "2-4 business days" },
  { icon: Icon.return, label: "Easy Returns", sub: "7-day return window" },
];

const REPORT_REASONS = [
  { key: "fake", label: "Fake or counterfeit product", icon: Icon.alert },
  { key: "misleading", label: "Wrong or misleading information", icon: Icon.info },
  { key: "prohibited", label: "Prohibited item", icon: Icon.alert },
  { key: "scam", label: "Spam or scam", icon: Icon.alert },
  { key: "other", label: "Other reason", icon: Icon.info },
];

/* ════════════════════════════════════════════════════════════
   AUTH + CART
════════════════════════════════════════════════════════════ */
const TOKEN_KEYS = ["marketplace_token", "buyer_token", "token", "auth_token"];

const getAuthToken = () => {
  for (const k of TOKEN_KEYS) {
    const t = localStorage.getItem(k);
    if (t && t !== "null" && t !== "undefined") return t.trim();
  }
  return null;
};

const isLoggedIn = () => !!getAuthToken();

const authHeaders = () => {
  const token = getAuthToken();
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

const readGuestCart = () => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeGuestCart = (cart) => {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
};

const guestCartCount = (cart = readGuestCart()) =>
  cart.reduce((s, i) => s + (Number(i.qty) || 1), 0);

const lineKey = (productId, variantId) =>
  `${productId}__${variantId ?? "default"}`;

const addToGuestCart = (
  product,
  selectedVariant,
  displayPrice,
  originalPrice,
  qty = 1
) => {
  const cart = readGuestCart();
  const variantId = selectedVariant?.id ?? null;
  const itemKey = lineKey(product.id, variantId);
  const idx = cart.findIndex((c) => c.id === itemKey);
  const stock = resolveStockCap(selectedVariant, product, 99);
  const addQty = Math.max(1, Number(qty) || 1);

  const item = {
    id: itemKey,
    productId: product.id,
    product_id: product.id,
    name: product.name,
    image: getProductImage(product),
    price: Number(displayPrice),
    originalPrice: originalPrice > displayPrice ? Number(originalPrice) : null,
    variant: selectedVariant
      ? {
          id: selectedVariant.id,
          name: selectedVariant.name,
          sku: selectedVariant.sku,
        }
      : null,
    variant_id: variantId,
    slug: product.slug ?? product.id,
    qty: addQty,
    stock,
    addedAt: Date.now(),
  };

  if (idx >= 0) {
    cart[idx].qty = Math.min((Number(cart[idx].qty) || 0) + addQty, stock);
  } else {
    cart.push(item);
  }

  writeGuestCart(cart);
  return guestCartCount(cart);
};

const setGuestLineQty = (
  product,
  selectedVariant,
  displayPrice,
  originalPrice,
  newQty
) => {
  const cart = readGuestCart();
  const variantId = selectedVariant?.id ?? null;
  const itemKey = lineKey(product.id, variantId);
  const idx = cart.findIndex((c) => c.id === itemKey);
  const stock = resolveStockCap(selectedVariant, product, 99);

  if (newQty <= 0) {
    if (idx >= 0) cart.splice(idx, 1);
    writeGuestCart(cart);
    return guestCartCount(cart);
  }

  const qty = Math.min(Math.max(1, Number(newQty) || 1), stock);
  if (idx >= 0) {
    cart[idx].qty = qty;
  } else {
    cart.push({
      id: itemKey,
      productId: product.id,
      product_id: product.id,
      name: product.name,
      image: getProductImage(product),
      price: Number(displayPrice),
      originalPrice:
        originalPrice > displayPrice ? Number(originalPrice) : null,
      variant: selectedVariant
        ? {
            id: selectedVariant.id,
            name: selectedVariant.name,
            sku: selectedVariant.sku,
          }
        : null,
      variant_id: variantId,
      slug: product.slug ?? product.id,
      qty,
      stock,
      addedAt: Date.now(),
    });
  }
  writeGuestCart(cart);
  return guestCartCount(cart);
};

const fetchServerCartCount = async () => {
  try {
    if (!getAuthToken()) return null;
    const res = await axios.get(CART_URL, {
      headers: authHeaders(),
      timeout: 8000,
    });
    const d = res.data?.data ?? res.data;
    return d?.total_qty ?? d?.item_count ?? null;
  } catch {
    return null;
  }
};

const findServerCartLine = async (productId, variantId) => {
  try {
    if (!getAuthToken()) return null;
    const res = await axios.get(CART_URL, {
      headers: authHeaders(),
      timeout: 8000,
    });
    const d = res.data?.data ?? res.data;
    const items = d?.items ?? d?.data?.items ?? [];
    return (
      items.find(
        (it) =>
          String(it.product_id) === String(productId) &&
          String(it.variant_id ?? "") === String(variantId ?? "")
      ) || null
    );
  } catch {
    return null;
  }
};

/* ── Offline-first pending queue (logged-in users) ──────────────
   Items are saved locally first, then synced to the server in the
   background with retries, so slow/bad networks never block the UI. */
const PENDING_KEY = "mm_cart_pending";

const readPending = () => {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const writePending = (list) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
};

const pendingCount = () =>
  readPending().reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

const pendingKey = (productId, variantId) =>
  `${productId}__${variantId ?? "default"}`;

const hasPendingLine = (productId, variantId) =>
  readPending().some((p) => p.id === pendingKey(productId, variantId));

const queuePending = (productId, variantId, qty) => {
  const list = readPending();
  const id = pendingKey(productId, variantId);
  const idx = list.findIndex((p) => p.id === id);
  if (idx >= 0) {
    list[idx].qty = (Number(list[idx].qty) || 0) + qty;
  } else {
    list.push({
      id,
      product_id: productId,
      variant_id: variantId ?? null,
      qty,
      addedAt: Date.now(),
    });
  }
  writePending(list);
};

const setPendingQty = (productId, variantId, qty) => {
  const list = readPending();
  const id = pendingKey(productId, variantId);
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return;
  if (qty <= 0) list.splice(idx, 1);
  else list[idx].qty = qty;
  writePending(list);
};

const removePending = (id, sentQty) => {
  const list = readPending();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const remaining = (Number(list[idx].qty) || 0) - sentQty;
  if (remaining > 0) list[idx].qty = remaining;
  else list.splice(idx, 1);
  writePending(list);
};

let pendingSyncRunning = false;

const syncPendingCart = async () => {
  if (pendingSyncRunning || !getAuthToken()) {
    return { synced: 0, rejected: [], remaining: readPending().length };
  }
  pendingSyncRunning = true;
  const rejected = [];
  let synced = 0;
  try {
    for (const item of readPending()) {
      const sentQty = Number(item.qty) || 1;
      try {
        await axios.post(
          CART_ITEMS_URL,
          {
            product_id: item.product_id,
            variant_id: item.variant_id ?? null,
            qty: sentQty,
          },
          { headers: authHeaders(), timeout: 20000 }
        );
        removePending(item.id, sentQty);
        synced++;
      } catch (err) {
        const status = err?.response?.status;
        const isValidationError =
          status >= 400 &&
          status < 500 &&
          ![401, 403, 408, 429].includes(status);
        if (isValidationError) {
          removePending(item.id, sentQty);
          rejected.push({
            item,
            status,
            message: err.response?.data?.message || "Failed to add item to cart",
            fullResponse: err.response?.data,
          });
          continue;
        }
        break; // network / timeout / 5xx / auth: keep queued, retry later
      }
    }
  } finally {
    pendingSyncRunning = false;
  }
  return { synced, rejected, remaining: readPending().length };
};

const addToRecentlyViewed = (product) => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter(
      (p) => p.id !== product.id
    );
    list.unshift({
      id: product.id,
      name: product.name,
      price: pickPrice(product.price, product.sale_price, product.selling_price),
      image: getProductImage(product),
      slug: product.slug ?? product.id,
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* ignore */
  }
};

const getRating = (product) => {
  if (product?.rating && Number(product.rating) > 0)
    return Number(product.rating);
  if (product?.average_rating && Number(product.average_rating) > 0)
    return Number(product.average_rating);
  return 0;
};

/* ════════════════════════════════════════════════════════════
   BREADCRUMBS
════════════════════════════════════════════════════════════ */
const isUuid = (str) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(str || "")
  );

const buildBreadcrumbs = (product) => {
  if (!product) return [];
  const items = [{ label: "Home", path: "/loemart" }];
  const rawPath =
    product.category_path ||
    product.breadcrumb_path ||
    product.category_tree ||
    product.categories;

  if (Array.isArray(rawPath) && rawPath.length > 0) {
    rawPath.forEach((cat) => {
      const name = typeof cat === "string" ? cat : cat?.name || cat?.title;
      const s = cat?.slug || name;
      if (name && !isUuid(name)) {
        items.push({
          label: name,
          path: `/catalog?category=${encodeURIComponent(s)}`,
        });
      }
    });
  } else if (product.category && typeof product.category === "object") {
    const catList = [];
    let curr = product.category;
    while (curr && typeof curr === "object") {
      if (curr.name && !isUuid(curr.name)) {
        catList.unshift({
          label: curr.name,
          path: `/catalog?category=${encodeURIComponent(
            curr.slug || curr.name
          )}`,
        });
      }
      curr = curr.parent || curr.category;
    }
    items.push(...catList);
  } else {
    const catName =
      typeof product.category === "string"
        ? product.category
        : product.category?.name;
    if (catName && !isUuid(catName)) {
      items.push({
        label: catName,
        path: `/catalog?category=${encodeURIComponent(catName)}`,
      });
    }
  }

  if (product.brand) {
    const last = items[items.length - 1]?.label?.toLowerCase();
    if (last !== product.brand.toLowerCase()) {
      items.push({
        label: product.brand,
        path: `/catalog?brand=${encodeURIComponent(product.brand)}`,
      });
    }
  }

  if (product.name) items.push({ label: product.name, isCurrent: true });
  return items;
};

const Breadcrumbs = memo(function Breadcrumbs({ product }) {
  const navigate = useNavigate();
  const items = useMemo(() => buildBreadcrumbs(product), [product]);
  if (!items.length) return null;

  return (
    <nav className="mdp-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="mdp-breadcrumbs__item">
            {idx > 0 && (
              <span className="mdp-breadcrumbs__sep" aria-hidden="true">
                &gt;
              </span>
            )}
            {isLast ? (
              <span className="mdp-breadcrumbs__current" aria-current="page">
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                className="mdp-breadcrumbs__link"
                onClick={() => item.path && navigate(item.path)}
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
});

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════════════════════════ */
const StickyMiniHeader = memo(function StickyMiniHeader({
  visible,
  product,
  displayPrice,
  onCartClick,
  disabled,
}) {
  if (!product) return null;
  const img = getProductImage(product);
  return (
    <div
      className={`mdp-mini-header ${visible ? "mdp-mini-header--visible" : ""}`}
      aria-hidden={!visible}
    >
      <div className="mdp-mini-header__inner">
        {img && (
          <img
            src={img}
            alt=""
            className="mdp-mini-header__img"
            aria-hidden="true"
          />
        )}
        <div className="mdp-mini-header__body">
          <p className="mdp-mini-header__name">{product.name}</p>
          <p className="mdp-mini-header__price">{formatPrice(displayPrice)}</p>
        </div>
        <button
          type="button"
          className="mdp-mini-header__cta"
          onClick={onCartClick}
          disabled={disabled}
        >
          ADD
        </button>
      </div>
    </div>
  );
});

function ProductSkeleton() {
  return (
    <div className="mdp-skeleton" aria-busy="true" aria-label="Loading product">
      <div className="mdp-skel mdp-skel-hero" />
      <div className="mdp-skel-thumbs">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="mdp-skel mdp-skel-thumb" />
        ))}
      </div>
      <div className="mdp-skel-body">
        <div
          className="mdp-skel"
          style={{ width: "85%", height: 24, marginBottom: 16 }}
        />
        <div
          className="mdp-skel"
          style={{ width: "60%", height: 16, marginBottom: 24 }}
        />
        <div
          className="mdp-skel"
          style={{ width: "35%", height: 32, marginBottom: 32 }}
        />
      </div>
    </div>
  );
}

const StarRating = memo(function StarRating({ rating }) {
  return (
    <div
      className="mdp-stars"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <span key={i} className="mdp-star-wrapper">
            <span className="mdp-star-bg">{Icon.starOutline}</span>
            <span
              className="mdp-star-fg"
              style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
            >
              {Icon.star}
            </span>
          </span>
        );
      })}
    </div>
  );
});

const CartToast = memo(function CartToast({
  show,
  productName,
  qty,
  image,
  onView,
  onClose,
}) {
  if (!show) return null;
  const line = { margin: 0, lineHeight: 1.3 };
  return (
    <div
      role="status"
      aria-live="polite"
      className="mdp-toast"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        maxWidth: "min(92vw, 320px)",
        borderRadius: 12,
        fontSize: 12,
      }}
    >
      <div
        className="mdp-toast__img-wrap"
        style={{ width: 36, height: 36, flexShrink: 0 }}
      >
        {image ? (
          <img
            src={image}
            alt=""
            className="mdp-toast__img"
            style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }}
          />
        ) : (
          <div className="mdp-toast__img-ph">{Icon.box}</div>
        )}
      </div>
      <div className="mdp-toast__body" style={{ flex: 1, minWidth: 0 }}>
        <p
          className="mdp-toast__label"
          style={{ ...line, fontSize: 12, fontWeight: 700 }}
        >
          <span aria-hidden="true">{Icon.check}</span> Added to cart
        </p>
        <p
          className="mdp-toast__name"
          style={{
            ...line,
            fontSize: 11,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {productName}
        </p>
        <p className="mdp-toast__qty" style={{ ...line, fontSize: 11 }}>
          Qty: {qty}
        </p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="mdp-toast__view"
        style={{ fontSize: 12, padding: "4px 8px", whiteSpace: "nowrap" }}
      >
        View Cart
      </button>
      <button
        type="button"
        onClick={onClose}
        className="mdp-toast__close"
        aria-label="Dismiss"
        style={{ fontSize: 14, padding: 4 }}
      >
        ✕
      </button>
    </div>
  );
});

const ReportModal = memo(function ReportModal({ productId, onClose }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = prev || "";
    };
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await axios.post(
        `${SHOP_URL}/${productId}/report`,
        { reason, details },
        { headers: authHeaders() }
      );
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }, [productId, reason, details]);

  return (
    <div
      className="mdp-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="mdp-modal" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="mdp-report-done">
            <div className="mdp-report-check">{Icon.check}</div>
            <h3>Report Submitted</h3>
            <p>Our team will review this listing.</p>
            <button type="button" className="mdp-done-btn" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mdp-modal-header">
              <h3>Report Listing</h3>
              <button
                type="button"
                className="mdp-modal-x"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mdp-modal-body">
              <p className="mdp-modal-sub">Why are you reporting this listing?</p>
              <div className="mdp-report-reasons">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={`mdp-reason-btn${
                      reason === r.label ? " mdp-reason-btn--on" : ""
                    }`}
                    onClick={() => setReason(r.label)}
                  >
                    <span className="mdp-reason-icon">{r.icon}</span>
                    <span>{r.label}</span>
                    {reason === r.label && (
                      <span className="mdp-reason-check">{Icon.check}</span>
                    )}
                  </button>
                ))}
              </div>
              <textarea
                className="mdp-report-textarea"
                placeholder="Additional details (optional)…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="mdp-modal-footer">
              <button
                type="button"
                className="mdp-modal-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mdp-modal-submit"
                onClick={handleSubmit}
                disabled={!reason || submitting}
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

const BuyerProtectionModal = memo(function BuyerProtectionModal({ onClose }) {
  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = prev || "";
    };
  }, [onClose]);

  return (
    <div
      className="mdp-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mdp-modal mdp-modal--protection"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mdp-modal-header">
          <h3>
            <span className="mdp-icon-inline">{Icon.shield}</span> Buyer
            Protection
          </h3>
          <button
            type="button"
            className="mdp-modal-x"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mdp-modal-body">
          <div className="mdp-protection-grid">
            <div className="mdp-protection-item">
              <span className="mdp-p-icon">{Icon.lock}</span>
              <div>
                <h5>Payment Protection</h5>
                <p>
                  Your payment is processed securely and protected while your
                  order is being completed.
                </p>
              </div>
            </div>
            <div className="mdp-protection-item">
              <span className="mdp-p-icon">{Icon.money}</span>
              <div>
                <h5>Refund Protection</h5>
                <p>
                  If your order doesn’t arrive or arrives damaged, you may be
                  eligible for a refund under our refund policy.
                </p>
              </div>
            </div>
            <div className="mdp-protection-item">
              <span className="mdp-p-icon">{Icon.return}</span>
              <div>
                <h5>7-Day Returns</h5>
                <p>
                  Check your order when it arrives. Eligible items can be
                  returned within 7 days.
                </p>
              </div>
            </div>
            <div className="mdp-protection-item">
              <span className="mdp-p-icon">{Icon.scale}</span>
              <div>
                <h5>Dispute Support</h5>
                <p>
                  If there’s a problem with your order, report it from your
                  Account and our support team will help resolve the issue.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mdp-modal-footer">
          <button
            type="button"
            className="mdp-modal-submit"
            style={{ width: "100%" }}
            onClick={onClose}
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
});

const FAQAccordion = memo(function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(null);
  const faqs = useMemo(
    () => [
      {
        q: "How do returns and refunds work?",
        a: "Go to Account > Purchases, select the order, and request a return/refund within 7 days.",
      },
      {
        q: "When is the seller paid?",
        a: "After you confirm satisfaction, or automatically when the 7-day window closes.",
      },
      {
        q: "What is covered under Guarantee?",
        a: "Non-delivery, counterfeit, damaged items, or items that don't match the listing.",
      },
    ],
    []
  );

  return (
    <div className="mdp-faq-section">
      <h3 className="mdp-section-title">
        <span className="mdp-icon-inline">{Icon.info}</span> FAQ
      </h3>
      <div className="mdp-faq-list">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`mdp-faq-item ${isOpen ? "mdp-faq-item--open" : ""}`}
            >
              <button
                type="button"
                className="mdp-faq-trigger"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                aria-expanded={isOpen}
              >
                <span>{faq.q}</span>
                <span className="mdp-faq-arrow" aria-hidden="true">
                  {Icon.chevron}
                </span>
              </button>
              {isOpen && (
                <div className="mdp-faq-content">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const SelectionTrigger = memo(function SelectionTrigger({
  label,
  value,
  onClick,
  rightSlot = null,
  multiline = false,
}) {
  return (
    <div
      className="mdp-selection-trigger"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      <div className="mdp-sel-text">
        <span className="mdp-sel-label">{label}</span>
        <span
          className={`mdp-sel-value ${
            multiline ? "mdp-sel-value--multiline" : ""
          }`}
        >
          {value}
        </span>
      </div>
      {rightSlot}
      <span className="mdp-sel-chevron" aria-hidden="true">
        &gt;
      </span>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
export default function MarketDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items: wishlist, toggle: toggleWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

  const [qty, setQty] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartError, setCartError] = useState(null);
  const [cartCount, setCartCount] = useState(() =>
    isLoggedIn() ? 0 : guestCartCount()
  );

  const [inCart, setInCart] = useState(false);
  const [cartLineQty, setCartLineQty] = useState(0);
  const [cartItemId, setCartItemId] = useState(null);
  const [updatingQty, setUpdatingQty] = useState(false);

  /* Debug states */
  const [lastRequest, setLastRequest] = useState(null);
  const [lastResponse, setLastResponse] = useState(null);
  const [lastError, setLastError] = useState(null);

  const [showReport, setShowReport] = useState(false);
  const [showProtection, setShowProtection] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [miniHeaderVisible, setMiniHeaderVisible] = useState(false);
  const [sheetIntent, setSheetIntent] = useState(null);
  const [showDescriptionPage, setShowDescriptionPage] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const titleRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const errorTimeoutRef = useRef(null);

  const isWishlisted = product ? wishlist.has(product.id) : false;
  const rating = useMemo(
    () => (product ? getRating(product) : 0),
    [product]
  );
  const hasVariants = useMemo(
    () => Array.isArray(product?.variants) && product.variants.length > 0,
    [product]
  );

  const canShowSizeGuide = useMemo(
    () => shouldShowSizeGuide(product),
    [product]
  );

  const sizeGuideData = useMemo(
    () => (canShowSizeGuide ? getSizeGuideData(product) : null),
    [canShowSizeGuide, product]
  );

  const galleryImages = useMemo(() => {
    if (!product) return [];
    if (selectedVariant?.images?.length) return selectedVariant.images;
    if (selectedVariant?.image) {
      const parentImgs = product.images ?? [];
      if (!parentImgs.includes(selectedVariant.image)) {
        return [selectedVariant.image, ...parentImgs];
      }
    }
    return product.images ?? [];
  }, [product, selectedVariant]);

  const firstKeyFeature = useMemo(() => {
    if (!product?.key_features?.length) return null;
    const f = product.key_features[0];
    return typeof f === "string" ? f : f?.feature;
  }, [product]);

  const displayPrice = useMemo(
    () =>
      pickPrice(
        selectedVariant?.price,
        selectedVariant?.sale_price,
        product?.price,
        product?.sale_price,
        product?.selling_price
      ),
    [selectedVariant, product]
  );

  const originalPrice = useMemo(
    () =>
      pickPrice(
        product?.original_price,
        product?.compare_price,
        product?.list_price,
        selectedVariant?.original_price
      ),
    [product, selectedVariant]
  );

  const discount = useMemo(() => {
    if (displayPrice <= 0 || originalPrice <= displayPrice) return 0;
    return calcDiscount(displayPrice, originalPrice);
  }, [displayPrice, originalPrice]);

  const savings = useMemo(
    () =>
      originalPrice > displayPrice && displayPrice > 0
        ? originalPrice - displayPrice
        : 0,
    [originalPrice, displayPrice]
  );

  const stockLeft = useMemo(() => {
    return (
      parsePositiveStock(selectedVariant?.stock) ??
      parsePositiveStock(product?.stock) ??
      null
    );
  }, [selectedVariant, product]);

  const isOutOfStock = useMemo(() => {
    if (!product) return false;
    if (product.is_active === false) return true;
    if (
      product.is_out_of_stock === true ||
      product.stock_status === "out_of_stock"
    ) {
      return true;
    }
    return false;
  }, [product]);

  const descriptionPreview = useMemo(() => {
    if (!product?.description) return "";

    const stripped = String(product.description)
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const MAX_CHARS = 400;

    if (stripped.length <= MAX_CHARS) return stripped;

    let cutText = stripped.slice(0, MAX_CHARS);
    const lastSpace = cutText.lastIndexOf(" ");
    if (lastSpace > 0) {
      cutText = cutText.slice(0, lastSpace);
    }

    return cutText.trim() + "…";
  }, [product]);

  const variantLabel = useMemo(() => {
    if (!selectedVariant) return "Select options";
    return (
      selectedVariant.name ||
      selectedVariant.attributes?.color ||
      selectedVariant.attributes?.size ||
      selectedVariant.attributes?.Size ||
      selectedVariant.sku ||
      "Selected"
    );
  }, [selectedVariant]);

  /* Route cleanup */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setInCart(false);
    setCartLineQty(0);
    setCartItemId(null);
    setAddedToCart(false);
    setQty(1);
    setCartError(null);
    setSizeGuideOpen(false);
    setShowDescriptionPage(false);
    setShowAllReviews(false);
    setLastRequest(null);
    setLastResponse(null);
    setLastError(null);
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [slug]);

  /* Cart badge sync */
  useEffect(() => {
    const sync = () => {
      if (isLoggedIn()) {
        fetchServerCartCount().then((c) => {
          if (c !== null) setCartCount(c + pendingCount());
        });
      } else {
        setCartCount(guestCartCount());
      }
    };
    sync();
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const fetchProduct = useCallback(async () => {
    if (!slug) return;
    const reqUrl = `${API_URL}/${slug}`;
    setLastRequest({ method: "GET", url: reqUrl, payload: null, time: nowTime() });
    try {
      const res = await axios.get(reqUrl, { timeout: 12000 });
      setLastResponse({ status: res.status, data: res.data, time: nowTime() });
      setLastError(null);
      const p = res.data?.data ?? res.data?.product ?? res.data;
      setProduct(p);
      if (Array.isArray(p?.variants) && p.variants.length > 0) {
        const bestVariant =
          p.variants.find((v) => parsePositiveStock(v.stock) !== null) ||
          p.variants[0];
        setSelectedVariant((prev) => prev || bestVariant);
      }
      addToRecentlyViewed(p);
    } catch (err) {
      setLastError({
        status: err.response?.status,
        message: err.response?.data?.message || err.message,
        url: reqUrl,
        fullResponse: err.response?.data,
        time: nowTime(),
      });
      setError(err.response?.status === 404 ? "404" : "error");
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProduct(null);
    setSelectedVariant(null);

    const reqUrl = `${API_URL}/${slug}`;
    setLastRequest({ method: "GET", url: reqUrl, payload: null, time: nowTime() });

    axios
      .get(reqUrl, { timeout: 12000 })
      .then((res) => {
        if (cancelled) return;
        setLastResponse({ status: res.status, data: res.data, time: nowTime() });
        setLastError(null);
        const p = res.data?.data ?? res.data?.product ?? res.data;
        setProduct(p);
        if (Array.isArray(p?.variants) && p.variants.length > 0) {
          const bestVariant =
            p.variants.find((v) => parsePositiveStock(v.stock) !== null) ||
            p.variants[0];
          setSelectedVariant(bestVariant);
        }
        addToRecentlyViewed(p);
      })
      .catch((err) => {
        if (cancelled) return;
        setLastError({
          status: err.response?.status,
          message: err.response?.data?.message || err.message,
          url: reqUrl,
          fullResponse: err.response?.data,
          time: nowTime(),
        });
        setError(err.response?.status === 404 ? "404" : "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (product?.name) {
      document.title = `${product.name}${
        product.brand ? ` | ${product.brand}` : ""
      } - Loemart`;
    }
    return () => {
      document.title = "Loemart Marketplace";
    };
  }, [product]);

  useEffect(() => {
    if (!titleRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setMiniHeaderVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );
    obs.observe(titleRef.current);
    return () => obs.disconnect();
  }, [product]);

  useEffect(() => {
    if (stockLeft != null && stockLeft > 0 && qty > stockLeft) {
      setQty(stockLeft);
    }
  }, [stockLeft, qty]);

  /* Restore cart line */
  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;

    const restore = async () => {
      if (isLoggedIn()) {
        let line = await findServerCartLine(
          product.id,
          selectedVariant?.id ?? null
        );
        if (!line) {
          try {
            const res = await axios.get(CART_URL, {
              headers: authHeaders(),
              timeout: 8000,
            });
            const d = res.data?.data ?? res.data;
            const items = d?.items ?? d?.data?.items ?? [];
            const productLines = items.filter(
              (it) => String(it.product_id) === String(product.id)
            );
            if (productLines.length) {
              line = productLines[0];
              if (line.variant_id && Array.isArray(product.variants)) {
                const v = product.variants.find(
                  (x) => String(x.id) === String(line.variant_id)
                );
                if (v) setSelectedVariant(v);
              }
            }
          } catch {
            /* ignore */
          }
        }
        if (cancelled) return;
        const pend = !line
          ? readPending().find(
              (x) => x.id === pendingKey(product.id, selectedVariant?.id ?? null)
            )
          : null;
        if (line) {
          setInCart(true);
          setCartLineQty(Number(line.qty) || 1);
          setCartItemId(line.id);
          setQty(Number(line.qty) || 1);
        } else if (pend) {
          setInCart(true);
          setCartLineQty(Number(pend.qty) || 1);
          setCartItemId(null);
          setQty(Number(pend.qty) || 1);
        } else {
          setInCart(false);
          setCartLineQty(0);
          setCartItemId(null);
        }
      } else {
        const cart = readGuestCart();
        const key = lineKey(product.id, selectedVariant?.id ?? null);
        let row = cart.find((c) => c.id === key);
        if (!row) {
          row = cart.find(
            (c) =>
              String(c.productId || c.product_id) === String(product.id)
          );
          if (row?.variant_id && Array.isArray(product.variants)) {
            const v = product.variants.find(
              (x) => String(x.id) === String(row.variant_id)
            );
            if (v) setSelectedVariant(v);
          }
        }
        if (cancelled) return;
        if (row) {
          setInCart(true);
          setCartLineQty(Number(row.qty) || 1);
          setQty(Number(row.qty) || 1);
        } else {
          setInCart(false);
          setCartLineQty(0);
        }
      }
    };
    restore();
    return () => {
      cancelled = true;
    };
  }, [product?.id, selectedVariant?.id, product?.variants]);

  const latestRef = useRef({});
  latestRef.current = { product, selectedVariant };

  const runSync = useCallback(async () => {
    if (!isLoggedIn() || readPending().length === 0) return;
    const res = await syncPendingCart();

    if (res.rejected.length) {
      const first = res.rejected[0];
      setLastError({
        status: first.status,
        message: first.message,
        url: CART_ITEMS_URL,
        fullResponse: first.fullResponse,
        time: nowTime(),
      });
      setCartError(first.message);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => setCartError(null), 5000);
      setAddedToCart(false);
    }

    if (res.synced > 0 || res.rejected.length) {
      const { product: prod, selectedVariant: variant } = latestRef.current;
      const count = await fetchServerCartCount();
      if (count !== null) setCartCount(count + pendingCount());
      if (prod?.id) {
        const line = await findServerCartLine(prod.id, variant?.id ?? null);
        if (line) {
          setInCart(true);
          setCartItemId(line.id ?? null);
          if (line.qty != null) setCartLineQty(Number(line.qty));
        } else if (!hasPendingLine(prod.id, variant?.id ?? null)) {
          setInCart(false);
          setCartLineQty(0);
          setCartItemId(null);
        }
      }
      if (res.synced > 0) {
        setLastResponse({
          status: 200,
          data: { message: "Pending cart items synced to server", synced: res.synced },
          time: nowTime(),
        });
        window.dispatchEvent(new Event("cart-updated"));
      }
    }
  }, []);

  /* Retry pending cart sync: on load, when back online, and every 15s */
  useEffect(() => {
    runSync();
    const onOnline = () => runSync();
    window.addEventListener("online", onOnline);
    const t = setInterval(() => {
      if (readPending().length) runSync();
    }, 15000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(t);
    };
  }, [runSync]);

  const handleAddToCart = useCallback(async () => {
    if (!product || isOutOfStock) return false;
    const addQty = Math.max(1, parseInt(qty, 10) || 1);

    setAddedToCart(true);
    setInCart(true);
    const newQty = inCart ? cartLineQty + addQty : addQty;
    setCartLineQty(newQty);
    setCartCount((c) => c + addQty);
    setCartError(null);

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setAddedToCart(false), 3500);

    const payload = {
      product_id: product.id,
      variant_id: selectedVariant?.id ?? null,
      qty: addQty,
    };

    if (isLoggedIn()) {
      // Save locally first (instant), then sync to the server in the background
      queuePending(product.id, selectedVariant?.id ?? null, addQty);
      setLastRequest({
        method: "QUEUED → POST",
        url: CART_ITEMS_URL,
        payload,
        time: nowTime(),
      });
      setLastResponse({
        status: 202,
        data: {
          message: "Saved locally, syncing to server in background",
          pending: readPending(),
        },
        time: nowTime(),
      });
      setLastError(null);
      runSync();
    } else {
      setLastRequest({
        method: "LOCALSTORAGE (GUEST)",
        url: CART_KEY,
        payload,
        time: nowTime(),
      });
      const guestCount = addToGuestCart(
        product,
        selectedVariant,
        displayPrice,
        originalPrice,
        addQty
      );
      setCartCount(guestCount);
      setLastResponse({
        status: 200,
        data: { message: "Added to guest localStorage cart", total_qty: guestCount },
        time: nowTime(),
      });
    }
    return true;
  }, [
    product,
    selectedVariant,
    displayPrice,
    originalPrice,
    qty,
    inCart,
    cartLineQty,
    isOutOfStock,
    runSync,
  ]);

  const handleStickyQtyChange = useCallback(
    async (nextQty) => {
      if (!product || updatingQty) return;

      const stockCap =
        stockLeft != null && stockLeft > 0
          ? Math.min(stockLeft, MAX_QTY)
          : MAX_QTY;
      const q = Math.max(0, Math.min(Number(nextQty) || 0, stockCap));
      const oldQty = cartLineQty;
      const diff = q - oldQty;

      setUpdatingQty(true);

      if (q <= 0) {
        setInCart(false);
        setCartLineQty(0);
        setCartItemId(null);
        setAddedToCart(false);
        setCartCount((c) => Math.max(0, c - oldQty));
      } else {
        setCartLineQty(q);
        setQty(q);
        setCartCount((c) => Math.max(0, c + diff));
      }

      if (
        isLoggedIn() &&
        hasPendingLine(product.id, selectedVariant?.id ?? null)
      ) {
        setPendingQty(product.id, selectedVariant?.id ?? null, q);
        setUpdatingQty(false);
        runSync();
        return;
      }

      try {
        if (isLoggedIn()) {
          if (q <= 0) {
            if (cartItemId) {
              const delUrl = `${CART_ITEMS_URL}/${cartItemId}`;
              setLastRequest({ method: "DELETE", url: delUrl, payload: null, time: nowTime() });
              const res = await axios.delete(delUrl, {
                headers: authHeaders(),
                timeout: 10000,
              });
              setLastResponse({ status: res.status, data: res.data, time: nowTime() });
            }
          } else {
            let itemId = cartItemId;
            if (!itemId) {
              const line = await findServerCartLine(
                product.id,
                selectedVariant?.id ?? null
              );
              itemId = line?.id ?? null;
              if (itemId) setCartItemId(itemId);
            }
            if (itemId) {
              const patchUrl = `${CART_ITEMS_URL}/${itemId}`;
              setLastRequest({ method: "PATCH", url: patchUrl, payload: { qty: q }, time: nowTime() });
              const res = await axios.patch(
                patchUrl,
                { qty: q },
                { headers: authHeaders(), timeout: 10000 }
              );
              setLastResponse({ status: res.status, data: res.data, time: nowTime() });
            } else {
              const payload = {
                product_id: product.id,
                variant_id: selectedVariant?.id ?? null,
                qty: q,
              };
              setLastRequest({ method: "POST", url: CART_ITEMS_URL, payload, time: nowTime() });
              const res = await axios.post(CART_ITEMS_URL, payload, {
                headers: authHeaders(),
                timeout: 10000,
              });
              setLastResponse({ status: res.status, data: res.data, time: nowTime() });
            }
          }
          const count = await fetchServerCartCount();
          if (count !== null) setCartCount(count);
          window.dispatchEvent(new Event("cart-updated"));
        } else {
          setGuestLineQty(
            product,
            selectedVariant,
            displayPrice,
            originalPrice,
            q
          );
        }
      } catch (err) {
        setLastError({
          status: err.response?.status,
          message: err.response?.data?.message || err.message,
          url: CART_ITEMS_URL,
          fullResponse: err.response?.data,
          time: nowTime(),
        });
        setCartError("Could not update quantity");
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = setTimeout(() => setCartError(null), 4000);
      } finally {
        setUpdatingQty(false);
      }
    },
    [
      product,
      selectedVariant,
      displayPrice,
      originalPrice,
      stockLeft,
      cartItemId,
      cartLineQty,
      updatingQty,
    ]
  );

  const handleCartClick = useCallback(() => {
    if (!product || isOutOfStock) return;
    if (hasVariants) {
      setSheetIntent("cart");
      return;
    }
    if (inCart) return;
    handleAddToCart();
  }, [product, isOutOfStock, hasVariants, inCart, handleAddToCart]);

  const openSizeGuide = useCallback(
    (e) => {
      e?.stopPropagation?.();
      if (!canShowSizeGuide) return;
      setSizeGuideOpen(true);
    },
    [canShowSizeGuide]
  );

  const handleShare = useCallback(() => {
    if (navigator.share && product) {
      navigator
        .share({
          title: product.name,
          text: `Check out ${product.name} on Loemart!`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  }, [product]);

  const goToCart = useCallback(() => navigate("/shop/cart"), [navigate]);

  if (!loading && error) {
    return (
      <div className="mdp-not-found">
        <MarketDetailDebugPanel
          slug={slug}
          apiRoot={API_ROOT}
          shopUrl={SHOP_URL}
          cartUrl={CART_URL}
          cartItemsUrl={CART_ITEMS_URL}
          token={getAuthToken()}
          product={product}
          selectedVariant={selectedVariant}
          hasVariants={hasVariants}
          displayPrice={displayPrice}
          originalPrice={originalPrice}
          discount={discount}
          stockLeft={stockLeft}
          isOutOfStock={isOutOfStock}
          qty={qty}
          inCart={inCart}
          cartLineQty={cartLineQty}
          cartItemId={cartItemId}
          cartCount={cartCount}
          cartError={cartError}
          guestCart={readGuestCart()}
          lastRequest={lastRequest}
          lastResponse={lastResponse}
          lastError={lastError}
          onReloadProduct={fetchProduct}
        />
        <div className="mdp-nf-illustration" aria-hidden="true">
          {error === "404" ? Icon.search : Icon.alert}
        </div>
        <h2>
          {error === "404" ? "Product Not Found" : "Something went wrong"}
        </h2>
        <p>
          {error === "404"
            ? "This listing may have been removed."
            : "Could not load this product. Please try again."}
        </p>
        <div className="mdp-nf-actions">
          <button
            type="button"
            className="mdp-nf-btn mdp-nf-btn--primary"
            onClick={() =>
              error === "404" ? navigate("/loemart") : window.location.reload()
            }
          >
            {error === "404" ? "Browse Products" : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  const stickyQty = inCart ? cartLineQty : qty;
  const stickyTotal = displayPrice * stickyQty;
  const hasDescriptionData = !!(
    product?.description ||
    product?.key_features?.length > 0 ||
    product?.specifications?.length > 0 ||
    product?.specs?.length > 0 ||
    product?.attributes?.length > 0
  );

  const optionsValue = selectedVariant
    ? `${variantLabel} · Qty: ${stickyQty}${inCart ? " · In cart" : ""}`
    : "Select options";

  const sizeGuideSlot = canShowSizeGuide ? (
    <button
      type="button"
      className="mdp-size-guide-inline"
      onClick={openSizeGuide}
    >
      Size guide
    </button>
  ) : null;

  return (
    <>
      <div className="md-page mdp-page">
        <MarketDetailHeader
          productName={product?.name}
          cartCount={cartCount}
          isWishlisted={isWishlisted}
          onToggleWishlist={() => toggleWishlist(product?.id)}
          productLoaded={!!product}
        />

        {/* INLINE DEBUG PANEL */}
        <MarketDetailDebugPanel
          slug={slug}
          apiRoot={API_ROOT}
          shopUrl={SHOP_URL}
          cartUrl={CART_URL}
          cartItemsUrl={CART_ITEMS_URL}
          token={getAuthToken()}
          product={product}
          selectedVariant={selectedVariant}
          hasVariants={hasVariants}
          displayPrice={displayPrice}
          originalPrice={originalPrice}
          discount={discount}
          stockLeft={stockLeft}
          isOutOfStock={isOutOfStock}
          qty={qty}
          inCart={inCart}
          cartLineQty={cartLineQty}
          cartItemId={cartItemId}
          cartCount={cartCount}
          cartError={cartError}
          guestCart={readGuestCart()}
          lastRequest={lastRequest}
          lastResponse={lastResponse}
          lastError={lastError}
          onReloadProduct={fetchProduct}
          onTestAddToCart={handleAddToCart}
        />

        <StickyMiniHeader
          visible={miniHeaderVisible}
          product={product}
          displayPrice={displayPrice}
          onCartClick={handleCartClick}
          disabled={isOutOfStock}
        />

        {loading && <ProductSkeleton />}

        {!loading && product && (
          <div className="mdp-main-layout">
            <Breadcrumbs product={product} />

            <div className="mdp-section mdp-section-gallery">
              <ImageGallery images={galleryImages} name={product.name} />
            </div>

            <div className="md-content mdp-content">
              {discount > 0 && displayPrice > 0 && (
                <div className="md-badges-row mdp-badges-row">
                  <span className="md-badge mdp-badge mdp-badge--save">
                    Save {discount}%
                  </span>
                </div>
              )}

              <h1 ref={titleRef} className="md-title mdp-title">
                {product.name}
              </h1>

              {firstKeyFeature && (
                <h2 className="mdp-seo-subtitle">
                  <span className="mdp-icon-inline" aria-hidden="true">
                    {Icon.tag}
                  </span>
                  <strong>Highlight:</strong> {firstKeyFeature}
                </h2>
              )}

              <div className="mdp-brand-rating-row">
                {product.brand && (
                  <p className="md-brand mdp-brand">
                    Brand: <strong>{product.brand}</strong>
                  </p>
                )}
                {rating > 0 && (
                  <div className="mdp-rating-inline">
                    <StarRating rating={rating} />
                    <span className="mdp-rating-num">
                      {rating.toFixed(1)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className="mdp-share-btn"
                  onClick={handleShare}
                  aria-label="Share product"
                >
                  {Icon.share}
                </button>
              </div>

              <div className="md-price-block mdp-price-block">
                <span className="md-price mdp-price">
                  {formatPrice(displayPrice)}
                </span>
                {originalPrice > displayPrice && (
                  <>
                    <span className="md-original mdp-original">
                      {formatPrice(originalPrice)}
                    </span>
                    <span className="md-disc-badge mdp-disc-badge">
                      -{discount}%
                    </span>
                  </>
                )}
              </div>

              {savings > 0 && (
                <p className="md-savings mdp-savings">
                  You save {formatPrice(savings)} today
                </p>
              )}

              {isOutOfStock && (
                <div className="mdp-stock mdp-stock--out">
                  <span className="mdp-stock__dot" />
                  <span className="mdp-stock__text">Out of stock</span>
                </div>
              )}

              {/* Options row */}
              {hasVariants && (
                <SelectionTrigger
                  label="Options & Quantity"
                  value={optionsValue}
                  onClick={() => setSheetIntent("cart")}
                  rightSlot={sizeGuideSlot}
                />
              )}

              {/* No variants but apparel: still show a slim size guide row */}
              {!hasVariants && canShowSizeGuide && (
                <button
                  type="button"
                  className="mdp-size-guide-link mdp-size-guide-link--solo"
                  onClick={openSizeGuide}
                >
                  <span className="mdp-size-guide-link__text">Size guide</span>
                  <span className="mdp-sel-chevron" aria-hidden="true">
                    &gt;
                  </span>
                </button>
              )}

              {/* Multiline Details */}
              {hasDescriptionData && (
                <SelectionTrigger
                  label="Product Details"
                  value={descriptionPreview || "Description, specs & features"}
                  onClick={() => setShowDescriptionPage(true)}
                  multiline={true}
                />
              )}

              <DeliveryCard />

              <SelectionTrigger
                label="Loemart Buyer Protection"
                value="Get item ordered or money back"
                onClick={() => setShowProtection(true)}
              />

              <div
                className="mdp-section"
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid var(--bd)",
                }}
              >
                <FAQAccordion />
              </div>

              <div
                className="mdp-section"
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid var(--bd)",
                }}
              >
                <h3 className="mdp-section-title">Sold by</h3>
                <SellerCard product={product} />
              </div>

              <div
                className="mdp-reviews-wrapper"
                style={{ borderTop: "1px solid var(--bd)" }}
              >
                <ProductReviews
                  productId={product.id}
                  rating={rating}
                  reviewsCount={product.reviews_count}
                  maxVisible={3}
                  onOpenRateModal={() => setShowRateModal(true)}
                  onSeeAll={() => setShowAllReviews(true)}
                  refreshKey={reviewRefreshKey}
                />
              </div>

              <div
                className="mdp-section"
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid var(--bd)",
                }}
              >
                <div className="mdp-trust-grid">
                  {TRUST_BADGES.map((b) => (
                    <div key={b.label} className="mdp-trust-item">
                      <span className="mdp-trust-icon">{b.icon}</span>
                      <div>
                        <p className="mdp-trust-label">{b.label}</p>
                        <p className="mdp-trust-sub">{b.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="md-report-btn mdp-report-btn"
                  onClick={() => setShowReport(true)}
                >
                  {Icon.flag} <span>Report this listing</span>
                </button>
              </div>

              <div className="mdp-section mdp-section--rails">
                <ProductRails product={product} />
              </div>
            </div>
          </div>
        )}

        {!loading && <Footer />}
      </div>

      {/* Sticky Action Bar */}
      {!loading && product && (
        <div className="md-sticky-bar mdp-sticky-bar">
          <div className="mdp-sticky-left">
            <div className="mdp-sticky-price-wrap">
              <span className="mdp-sticky-price">
                {formatPrice(stickyTotal)}
              </span>
              {stickyQty > 1 && (
                <span className="mdp-sticky-qty-note">
                  {formatPrice(displayPrice)} × {stickyQty}
                </span>
              )}
            </div>
          </div>

          <div className="mdp-sticky-actions">
            {cartError && (
              <span className="mdp-sticky-error">{cartError}</span>
            )}

            {inCart ? (
              <>
                {hasVariants && (
                  <button
                    type="button"
                    className="mdp-sticky-options-btn"
                    onClick={() => setSheetIntent("cart")}
                    aria-label="Options"
                  >
                    Options
                  </button>
                )}
                <div
                  className="mdp-sticky-qty mdp-sticky-qty--full"
                  role="group"
                  aria-label="Quantity"
                >
                  <button
                    type="button"
                    className="mdp-sticky-qty__btn"
                    onClick={() => handleStickyQtyChange(cartLineQty - 1)}
                    disabled={updatingQty}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="mdp-sticky-qty__val" aria-live="polite">
                    {cartLineQty}
                  </span>
                  <button
                    type="button"
                    className="mdp-sticky-qty__btn"
                    onClick={() => handleStickyQtyChange(cartLineQty + 1)}
                    disabled={
                      updatingQty ||
                      isOutOfStock ||
                      cartLineQty >= MAX_QTY ||
                      (stockLeft != null &&
                        stockLeft > 0 &&
                        cartLineQty >= stockLeft)
                    }
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </>
            ) : (
              <>
                {!hasVariants && (
                  <div
                    className="mdp-sticky-qty"
                    role="group"
                    aria-label="Quantity"
                  >
                    <button
                      type="button"
                      className="mdp-sticky-qty__btn"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      disabled={qty <= 1 || isOutOfStock}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="mdp-sticky-qty__val">{qty}</span>
                    <button
                      type="button"
                      className="mdp-sticky-qty__btn"
                      onClick={() =>
                        setQty((q) =>
                          Math.min(
                            MAX_QTY,
                            stockLeft != null && stockLeft > 0
                              ? Math.min(stockLeft, q + 1)
                              : q + 1
                          )
                        )
                      }
                      disabled={
                        isOutOfStock ||
                        qty >= MAX_QTY ||
                        (stockLeft != null && stockLeft > 0 && qty >= stockLeft)
                      }
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className={`mdp-btn-cart-primary${
                    addedToCart ? " mdp-btn-cart-primary--done" : ""
                  }`}
                  onClick={handleCartClick}
                  disabled={isOutOfStock}
                >
                  {isOutOfStock ? "OUT OF STOCK" : "ADD TO CART"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Draggable Floating Cart Button */}
      {cartCount > 0 && (
        <FloatingCartButton
          count={cartCount}
          onClick={goToCart}
          icon={Icon.cart}
        />
      )}

      <VariantBottomSheet
        isOpen={!!sheetIntent}
        onClose={() => setSheetIntent(null)}
        product={product}
        variants={product?.variants || []}
        selectedVariant={selectedVariant}
        onSelectVariant={setSelectedVariant}
        qty={qty}
        setQty={setQty}
        stockLeft={stockLeft}
        maxQty={MAX_QTY}
        onConfirm={handleAddToCart}
        isSubmitting={false}
        showSizeGuide={canShowSizeGuide}
        onOpenSizeGuide={() => {
          if (!canShowSizeGuide) return;
          setSheetIntent(null);
          setSizeGuideOpen(true);
        }}
      />

      <CartToast
        show={addedToCart}
        productName={product?.name ?? "Item"}
        qty={inCart ? cartLineQty : qty}
        image={product ? getProductImage(product) : null}
        onView={goToCart}
        onClose={() => setAddedToCart(false)}
      />

      <DescriptionPage
        isOpen={showDescriptionPage}
        onClose={() => setShowDescriptionPage(false)}
        product={product}
        maxChars={1000}
      />

      {canShowSizeGuide && (
        <SizeGuidePage
          isOpen={sizeGuideOpen}
          onClose={() => setSizeGuideOpen(false)}
          product={product}
          sizeGuide={sizeGuideData}
        />
      )}

      <ReviewsPage
        isOpen={showAllReviews}
        onClose={() => setShowAllReviews(false)}
        productId={product?.id}
        productName={product?.name}
        rating={rating}
        reviewsCount={product?.reviews_count}
        onOpenRateModal={() => {
          setShowAllReviews(false);
          setShowRateModal(true);
        }}
        refreshKey={reviewRefreshKey}
      />

      {showReport && product && (
        <ReportModal
          productId={product.id}
          onClose={() => setShowReport(false)}
        />
      )}
      {showProtection && (
        <BuyerProtectionModal onClose={() => setShowProtection(false)} />
      )}
      {showRateModal && product && (
        <RateProductModal
          productId={product.id}
          productName={product.name}
          onClose={() => setShowRateModal(false)}
          onRatingSubmitted={() => {
            setShowRateModal(false);
            fetchProduct();
            setReviewRefreshKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}
