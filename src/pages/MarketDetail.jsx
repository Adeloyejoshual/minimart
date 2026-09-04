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
  API_URL,
  formatPrice,
  calcDiscount,
  getProductImage,
} from "../config/marketplace";
import useWishlist from "../hooks/useWishlist";

/* ── Child components ── */
import MarketDetailHeader from "../components/MarketDetailHeader";
import ImageGallery       from "./MarketDetail/ImageGallery";
import SellerCard         from "./MarketDetail/SellerCard";
import ProductInfo        from "./MarketDetail/ProductInfo";
import SpecsSection       from "./MarketDetail/SpecsSection";
import RelatedProducts    from "./MarketDetail/RelatedProducts";
import RateProductModal   from "./MarketDetail/RateProductModal";
import ProductReviews     from "./MarketDetail/ProductReviews";
import VariantBottomSheet from "./MarketDetail/VariantBottomSheet";

import "../styles/MarketDetail.css";
import "../styles/MarketDetailPremium.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const RAW_BASE       = import.meta.env.VITE_API_BASE_URL || "";
const BASE           = RAW_BASE.replace(/\/+$/, "");
const API            = `${BASE}/api`;
const CART_ITEMS_URL = `${API}/cart/items`;
const CART_URL       = `${API}/cart`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const CART_KEY   = "mm_cart";
const RECENT_KEY = "lm-recently-viewed";
const MAX_QTY    = 10;

/* ═══════════════════════════════════════════════════════════════
   TRANSPARENT SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  flag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><polyline points="20 6 9 17 4 12"/></svg>,
  cart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  minus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  star: <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  starOutline: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  truck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><polyline points="9 18 15 12 9 6"/></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  box: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  sparkle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><polygon points="12 2 15 8 21 9 16 13 18 19 12 16 6 19 8 13 3 9 9 8 12 2"/></svg>,
  money: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><line x1="12" y1="18" x2="12" y2="6"/></svg>,
  return: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>,
  scale: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><path d="M12 3v18"/><rect x="4" y="16" width="16" height="5" rx="2"/><path d="M6 8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v8H6z"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={48} height={48}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={48} height={48}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  tag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  share: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  pencil: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
};

const TRUST_BADGES = [
  { icon: Icon.lock,   label: "Secure Payment",  sub: "Protected checkout"  },
  { icon: Icon.check,  label: "Verified Seller", sub: "Identity confirmed"  },
  { icon: Icon.truck,  label: "Fast Delivery",   sub: "2-5 business days"   },
  { icon: Icon.return, label: "Easy Returns",    sub: "7-day return window" },
];

const REPORT_REASONS = [
  { key: "fake",          label: "Fake or counterfeit product",     icon: Icon.alert },
  { key: "misleading",    label: "Wrong or misleading information", icon: Icon.info },
  { key: "prohibited",    label: "Prohibited item",                 icon: Icon.alert },
  { key: "scam",          label: "Spam or scam",                    icon: Icon.alert },
  { key: "other",         label: "Other reason",                    icon: Icon.info },
];

/* ═══════════════════════════════════════════════════════════════
   BREADCRUMBS & COMPONENTS
═══════════════════════════════════════════════════════════════ */
const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ""));
const buildBreadcrumbs = (product) => {
  if (!product) return [];
  const items = [{ label: "Home", path: "/loemart" }];
  const rawPath = product.category_path || product.breadcrumb_path || product.category_tree || product.categories;
  
  if (Array.isArray(rawPath) && rawPath.length > 0) {
    rawPath.forEach((cat) => {
      const name = typeof cat === "string" ? cat : cat?.name || cat?.title;
      const slug = cat?.slug || name;
      if (name && !isUuid(name)) {
        items.push({ label: name, path: `/catalog?category=${encodeURIComponent(slug)}` });
      }
    });
  } else if (product.category && typeof product.category === "object") {
    const catList = [];
    let curr = product.category;
    while (curr && typeof curr === "object") {
      if (curr.name && !isUuid(curr.name)) {
        catList.unshift({ label: curr.name, path: `/catalog?category=${encodeURIComponent(curr.slug || curr.name)}` });
      }
      curr = curr.parent || curr.category;
    }
    items.push(...catList);
  } else {
    const catName = typeof product.category === "string" ? product.category : product.category?.name;
    if (catName && !isUuid(catName)) {
      items.push({ label: catName, path: `/catalog?category=${encodeURIComponent(catName)}` });
    }
  }

  if (product.brand) {
    const lastItemLabel = items[items.length - 1]?.label?.toLowerCase();
    if (lastItemLabel !== product.brand.toLowerCase()) {
      const deepestCat = Array.isArray(rawPath) && rawPath.length > 0 ? (rawPath[rawPath.length - 1]?.slug || rawPath[rawPath.length - 1]?.name) : null;
      const brandPath = deepestCat
        ? `/catalog?category=${encodeURIComponent(deepestCat)}&brand=${encodeURIComponent(product.brand)}`
        : `/catalog?brand=${encodeURIComponent(product.brand)}`;
      items.push({ label: product.brand, path: brandPath });
    }
  }

  if (product.name) {
    items.push({ label: product.name, isCurrent: true });
  }
  return items;
};

const Breadcrumbs = memo(function Breadcrumbs({ product }) {
  const navigate = useNavigate();
  const items = useMemo(() => buildBreadcrumbs(product), [product]);
  if (!items.length) return null;

  return (
    <nav className="mdp-breadcrumbs" aria-label="Breadcrumb">
      <div className="mdp-breadcrumbs__inner">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <span key={idx} className="mdp-breadcrumbs__item">
              {idx > 0 && <span className="mdp-breadcrumbs__sep" aria-hidden="true">&gt;</span>}
              {isLast ? (
                <span className="mdp-breadcrumbs__current" aria-current="page">{item.label}</span>
              ) : (
                <button type="button" className="mdp-breadcrumbs__link" onClick={() => item.path && navigate(item.path)}>
                  {item.label}
                </button>
              )}
            </span>
          );
        })}
      </div>
    </nav>
  );
});

const StickyMiniHeader = memo(function StickyMiniHeader({
  visible, product, displayPrice, onAddToCart, disabled,
}) {
  if (!product) return null;
  const img = getProductImage(product);

  return (
    <div className={`mdp-mini-header ${visible ? "mdp-mini-header--visible" : ""}`} aria-hidden={!visible}>
      <div className="mdp-mini-header__inner">
        {img && <img src={img} alt="" className="mdp-mini-header__img" aria-hidden="true" />}
        <div className="mdp-mini-header__body">
          <p className="mdp-mini-header__name">{product.name}</p>
          <p className="mdp-mini-header__price">{formatPrice(displayPrice)}</p>
        </div>
        <button
          type="button"
          className="mdp-mini-header__cta"
          onClick={onAddToCart}
          disabled={disabled}
        >
          Add
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS & CART LOGIC
═══════════════════════════════════════════════════════════════ */
const isLoggedIn = () => !!localStorage.getItem("marketplace_token");
const authHeaders = () => {
  const token = localStorage.getItem("marketplace_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
};
const readGuestCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; } };
const writeGuestCart = (cart) => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); window.dispatchEvent(new Event("cart-updated")); };

const addToGuestCart = (product, selectedVariant, displayPrice, originalPrice, qty = 1) => {
  const cart      = readGuestCart();
  const variantId = selectedVariant?.id ?? null;
  const itemKey   = `${product.id}__${variantId ?? "default"}`;
  const existing  = cart.findIndex((c) => c.id === itemKey);
  const stock     = selectedVariant?.stock ?? product?.stock ?? 99;

  const item = {
    id: itemKey, productId: product.id, name: product.name,
    image: getProductImage(product), price: displayPrice,
    originalPrice: originalPrice > displayPrice ? originalPrice : null,
    variant: selectedVariant ? { id: selectedVariant.id, name: selectedVariant.name, sku: selectedVariant.sku } : null,
    slug: product.slug ?? product.id, qty, stock, addedAt: Date.now(),
  };

  if (existing >= 0) cart[existing].qty = Math.min(cart[existing].qty + qty, stock);
  else cart.push(item);
  writeGuestCart(cart);
  return cart.reduce((sum, i) => sum + (i.qty ?? 1), 0);
};

const fetchServerCartCount = async () => {
  try {
    const token = localStorage.getItem("marketplace_token");
    if (!token) return null;
    const res = await axios.get(CART_URL, { headers: { Authorization: `Bearer ${token}` }, timeout: 5_000 });
    return res.data?.data?.total_qty ?? res.data?.data?.item_count ?? null;
  } catch { return null; }
};

const addToRecentlyViewed = (product) => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter((p) => p.id !== product.id);
    list.unshift({
      id: product.id, name: product.name, price: product.price,
      image: getProductImage(product), slug: product.slug ?? product.id,
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
};

const getDeliveryEstimate = () => {
  const now = new Date();
  const min = new Date(now); min.setDate(min.getDate() + 2);
  const max = new Date(now); max.setDate(max.getDate() + 5);
  const fmt = (d) => d.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" });
  return `${fmt(min)} – ${fmt(max)}`;
};

const getRating = (product) => {
  if (product?.rating && Number(product.rating) > 0) return Number(product.rating);
  if (product?.average_rating && Number(product.average_rating) > 0) return Number(product.average_rating);
  return 0;
};

/* ═══════════════════════════════════════════════════════════════
   SKELETON & STARS
═══════════════════════════════════════════════════════════════ */
function ProductSkeleton() {
  return (
    <div className="mdp-skeleton" aria-busy="true" aria-label="Loading product">
      <div className="mdp-skel mdp-skel-hero" />
      <div className="mdp-skel-thumbs">
        {[0,1,2,3,4].map((i) => <div key={i} className="mdp-skel mdp-skel-thumb" />)}
      </div>
      <div className="mdp-skel-body">
        <div className="mdp-skel" style={{ width:"85%", height:24, borderRadius:5, marginBottom: 16 }} />
        <div className="mdp-skel" style={{ width:"60%", height:16, borderRadius:4, marginBottom: 24 }} />
        <div className="mdp-skel" style={{ width:"35%", height:32, borderRadius:6, marginBottom: 32 }} />
        <div className="mdp-skel" style={{ width:"100%", height:80, borderRadius:12, marginBottom: 16 }} />
        <div className="mdp-skel" style={{ width:"100%", height:120, borderRadius:12 }} />
      </div>
    </div>
  );
}

const StarRating = memo(function StarRating({ rating }) {
  return (
    <div className="mdp-stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <span key={i} className="mdp-star-wrapper">
            <span className="mdp-star-bg">{Icon.starOutline}</span>
            <span className="mdp-star-fg" style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}>
              {Icon.star}
            </span>
          </span>
        );
      })}
    </div>
  );
});

const CartToast = memo(function CartToast({ show, productName, qty, image, onView, onClose }) {
  if (!show) return null;
  return (
    <div role="status" aria-live="polite" className="mdp-toast">
      <div className="mdp-toast__img-wrap">
        {image ? <img src={image} alt="" className="mdp-toast__img" /> : <div className="mdp-toast__img-ph">{Icon.box}</div>}
      </div>
      <div className="mdp-toast__body">
        <p className="mdp-toast__label"><span aria-hidden="true">{Icon.check}</span> Added to cart</p>
        <p className="mdp-toast__name">{productName}</p>
        <p className="mdp-toast__qty">Qty: {qty}</p>
      </div>
      <button type="button" onClick={onView} className="mdp-toast__view">View Cart</button>
      <button type="button" onClick={onClose} className="mdp-toast__close" aria-label="Dismiss">✕</button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MODALS & FAQS
═══════════════════════════════════════════════════════════════ */
const ReportModal = memo(function ReportModal({ productId, onClose }) {
  const [reason,     setReason]     = useState("");
  const [details,    setDetails]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { 
      window.removeEventListener("keydown", fn); 
      document.body.style.overflow = originalOverflow; 
    };
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/${productId}/report`, { reason, details }, { headers: authHeaders() });
      setSubmitted(true);
    } catch { /* Fallback */ } finally { setSubmitting(false); }
  }, [productId, reason, details]);

  return (
    <div className="mdp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Report listing">
      <div className="mdp-modal" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="mdp-report-done">
            <div className="mdp-report-check">{Icon.check}</div>
            <h3>Report Submitted</h3>
            <p>Our team will review this listing. Thank you for keeping Loemart safe.</p>
            <button className="mdp-done-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="mdp-modal-header">
              <h3>Report Listing</h3>
              <button className="mdp-modal-x" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <div className="mdp-modal-body">
              <p className="mdp-modal-sub">Why are you reporting this listing?</p>
              <div className="mdp-report-reasons">
                {REPORT_REASONS.map((r) => (
                  <button key={r.key} type="button" className={`mdp-reason-btn${reason === r.label ? " mdp-reason-btn--on" : ""}`} onClick={() => setReason(r.label)}>
                    <span className="mdp-reason-icon" aria-hidden="true">{r.icon}</span>
                    <span>{r.label}</span>
                    {reason === r.label && <span className="mdp-reason-check" aria-hidden="true">{Icon.check}</span>}
                  </button>
                ))}
              </div>
              <textarea
                className="mdp-report-textarea"
                placeholder="Additional details (optional)…"
                value={details} onChange={(e) => setDetails(e.target.value)}
                rows={3} maxLength={500} aria-label="Additional details"
              />
            </div>
            <div className="mdp-modal-footer">
              <button className="mdp-modal-cancel" onClick={onClose}>Cancel</button>
              <button className="mdp-modal-submit" onClick={handleSubmit} disabled={!reason || submitting}>
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
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn); 
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { 
      window.removeEventListener("keydown", fn); 
      document.body.style.overflow = originalOverflow; 
    };
  }, [onClose]);

  return (
    <div className="mdp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Buyer Protection">
      <div className="mdp-modal mdp-modal--protection" onClick={(e) => e.stopPropagation()}>
        <div className="mdp-modal-header">
          <h3><span className="mdp-icon-inline">{Icon.shield}</span> Buyer Protection Guarantee</h3>
          <button className="mdp-modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="mdp-modal-body">
          <div className="mdp-protection-highlight">
            <span className="mdp-shield-icon">{Icon.lock}</span>
            <div>
              <h4>Payments Held in Escrow</h4>
              <p>We securely hold your payment. The seller is only paid after you confirm receipt, or after your 7-day inspection window closes.</p>
            </div>
          </div>
          <div className="mdp-protection-grid">
            <div className="mdp-protection-item">
              <span className="mdp-p-icon">{Icon.money}</span>
              <div><h5>Full Refund Guarantee</h5><p>Eligible for a 100% refund if your order never arrives or is damaged.</p></div>
            </div>
            <div className="mdp-protection-item">
              <span className="mdp-p-icon">{Icon.return}</span>
              <div><h5>7-Day Window</h5><p>Verify authenticity and condition. File returns easily from your Account.</p></div>
            </div>
            <div className="mdp-protection-item">
              <span className="mdp-p-icon">{Icon.scale}</span>
              <div><h5>Dispute Mediation</h5><p>If you face a disagreement, our claims team steps in to mediate fairly.</p></div>
            </div>
          </div>
        </div>
        <div className="mdp-modal-footer">
          <button className="mdp-done-btn" style={{ width: "100%" }} onClick={onClose}>Got it, thanks!</button>
        </div>
      </div>
    </div>
  );
});

const FAQAccordion = memo(function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(null);
  const faqs = useMemo(() => [
    { q: "How do returns and refunds work?", a: "Once your item is delivered, go to Account > Purchases, select the order, and tap 'Request Return/Refund' within 7 days." },
    { q: "When is the seller paid?", a: "Sellers are only paid after you confirm satisfaction, or automatically after the 7-day window closes." },
    { q: "What is covered under Guarantee?", a: "You are fully covered if your item does not arrive, is counterfeit, arrives broken, or does not match specs." }
  ], []);

  return (
    <div className="md-section mdp-section mdp-faq-section">
      <h3 className="md-section-title mdp-section-title"><span className="mdp-icon-inline">{Icon.info}</span> FAQ</h3>
      <div className="mdp-faq-list">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={idx} className={`mdp-faq-item ${isOpen ? "mdp-faq-item--open" : ""}`}>
              <button type="button" className="mdp-faq-trigger" onClick={() => setOpenIndex(isOpen ? null : idx)} aria-expanded={isOpen}>
                <span>{faq.q}</span>
                <span className="mdp-faq-arrow" aria-hidden="true">{Icon.chevron}</span>
              </button>
              {isOpen && <div className="mdp-faq-content" aria-live="polite"><p>{faq.a}</p></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function MarketDetail() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { items: wishlist, toggle: toggleWishlist } = useWishlist();

  /* ── Product State ── */
  const [product,          setProduct]          = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [selectedVariant,  setSelectedVariant]  = useState(null);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

  /* ── Cart State ── */
  const [qty,          setQty]          = useState(1);
  const [addedToCart,  setAddedToCart]  = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartError,    setCartError]    = useState(null);
  const [cartCount,    setCartCount]    = useState(() =>
    isLoggedIn() ? 0 : readGuestCart().reduce((s, i) => s + (i.qty ?? 1), 0)
  );

  /* ── Modals & Sticky Observers ── */
  const [showReport,        setShowReport]        = useState(false);
  const [showProtection,    setShowProtection]    = useState(false);
  const [showRateModal,     setShowRateModal]     = useState(false);
  const [miniHeaderVisible, setMiniHeaderVisible] = useState(false);
  const [sheetIntent,       setSheetIntent]       = useState(null); // 'cart' or null
  
  const titleRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  
  /* ── Derived Values ── */
  const isWishlisted = product ? wishlist.has(product.id) : false;
  const rating       = useMemo(() => (product ? getRating(product) : 0), [product]);
  const deliveryDate = useMemo(() => getDeliveryEstimate(), []);

  // Has Variants check
  const hasVariants = useMemo(() => (product?.variants?.length ?? 0) > 0, [product]);

  // Gallery Variant Sync
  const galleryImages = useMemo(() => {
    if (!product) return [];
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      return selectedVariant.images;
    }
    if (selectedVariant?.image) {
      const parentImgs = product.images ?? [];
      if (!parentImgs.includes(selectedVariant.image)) {
        return [selectedVariant.image, ...parentImgs];
      }
    }
    return product.images ?? [];
  }, [product, selectedVariant]);

  // Key Highlight Feature
  const firstKeyFeature = useMemo(() => {
    if (!product?.key_features || product.key_features.length === 0) return null;
    const f = product.key_features[0];
    return typeof f === "string" ? f : f?.feature;
  }, [product]);

  /* ════════════════════════════════════════════════════════
     SCROLL TO TOP & CLEANUP TIMEOUTS ON ROUTE CHANGE
  ════════════════════════════════════════════════════════ */
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [slug]);

  /* ════════════════════════════════════════════════════════
     DATA SYNC & SEO TITLE + JSON-LD SCHEMA
  ════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (isLoggedIn()) fetchServerCartCount().then((c) => { if (c !== null) setCartCount(c); });
    const sync = () => {
      if (isLoggedIn()) fetchServerCartCount().then((c) => { if (c !== null) setCartCount(c); });
      else setCartCount(readGuestCart().reduce((s, i) => s + (i.qty ?? 1), 0));
    };
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("cart-updated", sync); window.removeEventListener("storage", sync); };
  }, []);

  const fetchProduct = useCallback(() => {
    if (!slug) return;
    axios.get(`${API_URL}/${slug}`, { timeout: 12_000 })
      .then(({ data }) => {
        const p = data?.data ?? data?.product ?? data;
        setProduct(p);
      })
      .catch(() => {}); // silent refresh fail
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true); setError(null); setProduct(null); setSelectedVariant(null); setQty(1);

    axios.get(`${API_URL}/${slug}`, { timeout: 12_000 })
      .then(({ data }) => {
        if (cancelled) return;
        const p = data?.data ?? data?.product ?? data;
        setProduct(p);
        if (p?.variants?.length > 0) setSelectedVariant(p.variants[0]);
        addToRecentlyViewed(p);
      })
      .catch((err) => { if (!cancelled) setError(err.response?.status === 404 ? "404" : "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  /* Dynamic Meta Title and JSON-LD Rich Snippets for SEO */
  useEffect(() => {
    if (product?.name) {
      const suffix = product.brand ? ` | ${product.brand}` : "";
      document.title = `${product.name}${suffix} - Loemart`;

      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify({
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.name,
        "image": product.images || [getProductImage(product)],
        "description": product.description || product.name,
        "brand": { "@type": "Brand", "name": product.brand || "Loemart" },
        "offers": {
          "@type": "Offer",
          "priceCurrency": "NGN",
          "price": product.price,
          "availability": (product.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "url": window.location.href
        },
        ...(product.rating ? {
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": product.rating,
            "reviewCount": product.reviews_count || 1
          }
        } : {})
      });
      document.head.appendChild(script);

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
    return () => { document.title = "Loemart Marketplace"; };
  }, [product]);

  /* Sticky Mini Header Intersection Observer */
  useEffect(() => {
    if (!titleRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setMiniHeaderVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );
    obs.observe(titleRef.current);
    return () => obs.disconnect();
  }, [product]);

  /* ════════════════════════════════════════════════════════
     PRICING & STOCK LOGIC
  ════════════════════════════════════════════════════════ */
  const displayPrice = useMemo(() => selectedVariant?.price ? Number(selectedVariant.price) : Number(product?.price ?? 0), [selectedVariant, product]);
  const originalPrice = useMemo(() => Number(product?.original_price ?? product?.compare_price ?? 0), [product]);
  const discount = useMemo(() => calcDiscount(displayPrice, originalPrice), [displayPrice, originalPrice]);
  const savings = useMemo(() => originalPrice > displayPrice ? originalPrice - displayPrice : 0, [originalPrice, displayPrice]);
  const total = useMemo(() => displayPrice * qty, [displayPrice, qty]);

  const isOutOfStock = useMemo(() => {
    if (selectedVariant) return typeof selectedVariant.stock === "number" && selectedVariant.stock <= 0;
    if (product) return typeof product.stock === "number" && product.stock <= 0;
    return false;
  }, [selectedVariant, product]);

  const stockLeft = useMemo(() => {
    if (selectedVariant?.stock !== undefined) return selectedVariant.stock;
    if (product?.stock !== undefined) return product.stock;
    return null;
  }, [selectedVariant, product]);

  useEffect(() => {
    if (stockLeft !== null && stockLeft > 0 && qty > stockLeft) setQty(stockLeft);
  }, [stockLeft, qty]);

  /* ════════════════════════════════════════════════════════
     SMART ADD TO CART ACTIONS
  ════════════════════════════════════════════════════════ */
  const handleAddToCart = useCallback(async () => {
    if (!product || addingToCart || isOutOfStock) return false;
    setAddingToCart(true); setCartError(null);
    try {
      if (isLoggedIn()) {
        try {
          await axios.post(
            CART_ITEMS_URL, 
            { product_id: product.id, variant_id: selectedVariant?.id ?? null, qty, quantity: qty }, 
            { headers: authHeaders(), timeout: 15_000 }
          );
          const count = await fetchServerCartCount();
          if (count !== null) setCartCount(count);
          window.dispatchEvent(new Event("cart-updated"));
        } catch (apiErr) {
          if (apiErr.response?.status === 401) {
            localStorage.removeItem("marketplace_token");
            setCartCount(addToGuestCart(product, selectedVariant, displayPrice, originalPrice, qty));
          } else {
            throw apiErr;
          }
        }
      } else {
        setCartCount(addToGuestCart(product, selectedVariant, displayPrice, originalPrice, qty));
      }
      setAddedToCart(true);
      window.navigator?.vibrate?.([25, 15, 25]);
      
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setAddedToCart(false), 3500);
      return true;
    } catch (err) {
      setCartError(err.response?.data?.message ?? err.message ?? "Failed to add to cart");
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => setCartError(null), 4000);
      return false;
    } finally {
      setAddingToCart(false);
    }
  }, [product, selectedVariant, displayPrice, originalPrice, qty, addingToCart, isOutOfStock]);

  /** Open sheet if variants exist; otherwise add directly */
  const onAddToCartPress = useCallback(() => {
    if (!product || isOutOfStock || addingToCart) return;
    if (hasVariants) {
      setSheetIntent("cart");
      return;
    }
    handleAddToCart();
  }, [product, isOutOfStock, addingToCart, hasVariants, handleAddToCart]);

  /** Called by the bottom sheet Confirm button */
  const onSheetConfirm = useCallback(async () => {
    return await handleAddToCart();
  }, [handleAddToCart]);

  const handleShare = useCallback(() => {
    if (navigator.share && product) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} on Loemart!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  }, [product]);

  const goToCart = useCallback(() => navigate("/shop/cart"), [navigate]);

  /* ════════════════════════════════════════════════════════
     ERROR SCREENS
  ════════════════════════════════════════════════════════ */
  if (!loading && error) {
    return (
      <div className="mdp-not-found">
        <div className="mdp-nf-illustration" aria-hidden="true">{error === "404" ? Icon.search : Icon.alert}</div>
        <h2>{error === "404" ? "Product Not Found" : "Something went wrong"}</h2>
        <p>{error === "404" ? "This listing may have been removed." : "Could not load this product. Please try again."}</p>
        <div className="mdp-nf-actions">
          <button className="mdp-nf-btn mdp-nf-btn--primary" onClick={() => error === "404" ? navigate("/loemart") : window.location.reload()}>
            {error === "404" ? "Browse Products" : "Try Again"}
          </button>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
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

        <StickyMiniHeader
          visible={miniHeaderVisible}
          product={product}
          displayPrice={displayPrice}
          onAddToCart={onAddToCartPress}
          disabled={addingToCart || isOutOfStock}
        />

        {loading && <ProductSkeleton />}

        {!loading && product && (
          <div className="mdp-main-layout">
            <Breadcrumbs product={product} />

            <div className="mdp-section mdp-section-gallery">
              <ImageGallery images={galleryImages} name={product.name} />
            </div>

            <div className="md-content mdp-content">
              {discount > 0 && (
                <div className="md-badges-row mdp-badges-row">
                  <span className="md-badge mdp-badge mdp-badge--save">Save {discount}%</span>
                </div>
              )}

              <h1 ref={titleRef} className="md-title mdp-title">{product.name}</h1>
              
              {firstKeyFeature && (
                <h2 className="mdp-seo-subtitle">
                  <span className="mdp-icon-inline" aria-hidden="true">{Icon.tag}</span> 
                  <strong>Highlight:</strong> {firstKeyFeature}
                </h2>
              )}

              <div className="mdp-brand-rating-row">
                {product.brand && <p className="md-brand mdp-brand">by <strong>{product.brand}</strong></p>}
                {rating > 0 && (
                  <div className="mdp-rating-inline">
                    <StarRating rating={rating} />
                    <span className="mdp-rating-num">{rating.toFixed(1)}</span>
                  </div>
                )}
                <button type="button" className="mdp-share-btn" onClick={handleShare} aria-label="Share product">
                  {Icon.share}
                </button>
              </div>

              <div className="mdp-section mdp-section--price">
                <div className="md-price-block mdp-price-block">
                  <span className="md-price mdp-price">{formatPrice(displayPrice)}</span>
                  {originalPrice > displayPrice && (
                    <>
                      <span className="md-original mdp-original">{formatPrice(originalPrice)}</span>
                      <span className="md-disc-badge mdp-disc-badge">-{discount}%</span>
                    </>
                  )}
                </div>
                {savings > 0 && (
                  <p className="md-savings mdp-savings">
                    <span className="mdp-icon-inline">{Icon.sparkle}</span> You save {formatPrice(savings)} today
                  </p>
                )}
                {isOutOfStock && (
                  <div className="mdp-stock mdp-stock--out">
                    <span className="mdp-stock__dot" />
                    <span className="mdp-stock__text">Out of stock</span>
                  </div>
                )}
              </div>

              {/* ── MODERN SELECTION TRIGGER ROW ── */}
              <div 
                className="mdp-selection-trigger" 
                onClick={() => setSheetIntent('cart')}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "16px", background: "#f9fafb", borderRadius: "12px",
                  border: "1px solid #e5e7eb", cursor: "pointer", marginBottom: "24px",
                  transition: "background 0.2s"
                }}
              >
                <div>
                  <span style={{ fontSize: "0.85rem", color: "#6b7280", display: "block", marginBottom: "2px" }}>
                    Options & Quantity
                  </span>
                  <span style={{ fontSize: "1rem", fontWeight: "600", color: "#111827" }}>
                    {selectedVariant 
                      ? `${selectedVariant.name || selectedVariant.attributes?.color || selectedVariant.attributes?.size || ''} • Qty: ${qty}`
                      : hasVariants 
                        ? "Select Color, Size, Quantity" 
                        : `Qty: ${qty}`}
                  </span>
                </div>
                <span style={{ color: "#9ca3af", fontWeight: "bold" }}>&gt;</span>
              </div>

              {/* Delivery Cards */}
              <div className="mdp-section mdp-section--cards">
                <div className="mdp-delivery-card">
                  <div className="mdp-delivery-card__icon">{Icon.truck}</div>
                  <div className="mdp-delivery-card__body">
                    <p className="mdp-delivery-card__title">Fast Delivery</p>
                    <p className="mdp-delivery-card__sub">Estimated arrival: <strong>{deliveryDate}</strong></p>
                  </div>
                </div>
                <div className="mdp-protection-card">
                  <div className="mdp-protection-card__body">
                    <span className="mdp-protection-card__shield">{Icon.shield}</span>
                    <div className="mdp-protection-card__text">
                      <p className="mdp-protection-card__title">Loemart Buyer Protection</p>
                      <p className="mdp-protection-card__sub">Get the item you ordered or your money back. Payment is kept safe.</p>
                    </div>
                  </div>
                  <button type="button" className="mdp-protection-card__link" onClick={() => setShowProtection(true)}>Learn More &gt;</button>
                </div>
              </div>

              {/* Details & Specs */}
              {product.description && (
                <div className="mdp-section mdp-section--desc">
                  <ProductInfo description={product.description} />
                </div>
              )}
              {(product.specifications?.length > 0 || product.specs?.length > 0 || product.attributes?.length > 0) && (
                <div className="mdp-section mdp-section--specs">
                  <SpecsSection specs={product.specifications || product.specs || product.attributes} />
                </div>
              )}
              {product.key_features?.length > 0 && (
                <div className="md-section mdp-section mdp-section--features">
                  <h3 className="md-section-title mdp-section-title"><span className="mdp-icon-inline">{Icon.sparkle}</span> Key Features</h3>
                  <ul className="md-features-list mdp-features-list">
                    {product.key_features.map((f, i) => (
                      <li key={i} className="md-feature-item mdp-feature-item">
                        <span className="md-feat-check mdp-feat-check">{Icon.check}</span>
                        <span>{f?.feature ?? f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(product.return_policy || product.warranty) && (
                <div className="md-section mdp-section">
                  <h3 className="md-section-title mdp-section-title"><span className="mdp-icon-inline">{Icon.info}</span> Policies</h3>
                  {product.return_policy && (
                    <div className="md-policy-item mdp-policy-item">
                      <span className="mdp-policy-icon">{Icon.return}</span>
                      <div><strong>Return Policy</strong><p>{product.return_policy}</p></div>
                    </div>
                  )}
                  {product.warranty && (
                    <div className="md-policy-item mdp-policy-item">
                      <span className="mdp-policy-icon">{Icon.shield}</span>
                      <div><strong>Warranty</strong><p>{product.warranty}</p></div>
                    </div>
                  )}
                </div>
              )}

              <FAQAccordion />

              {/* Ratings & Reviews Feedback List */}
              <ProductReviews
                productId={product.id}
                rating={rating}
                reviewsCount={product.reviews_count}
                onOpenRateModal={() => setShowRateModal(true)}
                refreshKey={reviewRefreshKey}
              />

              <div className="mdp-section mdp-section--related">
                <RelatedProducts 
                  productId={product.id} 
                  category={product.category} 
                  brand={product.brand}
                />
              </div>

              <div className="mdp-section mdp-section--seller">
                <SellerCard product={product} />
                <div className="mdp-trust-grid">
                  {TRUST_BADGES.map((b) => (
                    <div key={b.label} className="mdp-trust-item">
                      <span className="mdp-trust-icon">{b.icon}</span>
                      <div className="mdp-trust-body">
                        <p className="mdp-trust-label">{b.label}</p>
                        <p className="mdp-trust-sub">{b.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="md-report-btn mdp-report-btn" onClick={() => setShowReport(true)}>
                  {Icon.flag}<span>Report this listing</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODERN STICKY BOTTOM BAR ── */}
      {!loading && product && (
        <div className="md-sticky-bar mdp-sticky-bar">
          <div className="mdp-sticky-left">
            <div className="mdp-sticky-price-wrap">
              <span className="mdp-sticky-price">{formatPrice(total)}</span>
              {qty > 1 && (
                <span className="mdp-sticky-qty-note">
                  {formatPrice(displayPrice)} × {qty}
                </span>
              )}
            </div>
          </div>

          <div className="mdp-sticky-actions">
            {cartError && <span className="mdp-sticky-error">{cartError}</span>}
            <button
              type="button"
              className={`mdp-btn-cart-modern${addedToCart ? " is-done" : ""}`}
              onClick={onAddToCartPress}
              disabled={addingToCart || isOutOfStock}
            >
              {isOutOfStock ? (
                "Out of Stock"
              ) : addingToCart ? (
                "Adding…"
              ) : addedToCart ? (
                <>
                  <span className="mdp-btn-cart-modern__icon" aria-hidden="true">{Icon.check}</span>
                  Added
                </>
              ) : (
                <>
                  <span className="mdp-btn-cart-modern__icon" aria-hidden="true">{Icon.cart}</span>
                  Add to Cart
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button type="button" className="mdp-float-cart" onClick={goToCart} aria-label="View cart">
          {Icon.cart}
          <span className="mdp-float-cart__badge">{cartCount > 99 ? "99+" : cartCount}</span>
        </button>
      )}

      {/* ── TEMU-STYLE VARIANT BOTTOM SHEET ── */}
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
        onConfirm={onSheetConfirm}
        isSubmitting={addingToCart}
      />

      {/* Toast & Modals */}
      <CartToast show={addedToCart} productName={product?.name ?? "Item"} qty={qty} image={product ? getProductImage(product) : null} onView={goToCart} onClose={() => setAddedToCart(false)} />
      {showReport && product && <ReportModal productId={product.id} onClose={() => setShowReport(false)} />}
      {showProtection && <BuyerProtectionModal onClose={() => setShowProtection(false)} />}
      {showRateModal && product && (
        <RateProductModal
          productId={product.id}
          productName={product.name}
          onClose={() => setShowRateModal(false)}
          onRatingSubmitted={() => {
            setShowRateModal(false);
            fetchProduct(); // silently refresh product stats
            setReviewRefreshKey((k) => k + 1); // refresh review feedback list
          }}
        />
      )}
    </>
  );
}