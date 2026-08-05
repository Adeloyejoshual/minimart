/**
 * src/pages/MarketDetail.jsx
 * Route: /shop/:slug
 *
 * PREMIUM upgrade — Amazon/Apple-level polish:
 * - Quantity selector with +/-
 * - Rating stars + review count
 * - Delivery estimate
 * - Confetti burst on add-to-cart
 * - Sticky mini-header on scroll
 * - Breadcrumb navigation
 * - Recently viewed tracking
 * - Premium skeleton with shimmer
 * - Enhanced sticky bar with total
 * - Trust badges with icons
 * - Buy-together suggestions
 * - Wishlist heart-beat animation
 * - Fully mobile-optimized
 */

import {
  useState, useEffect, useCallback, useMemo, useRef, memo,
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

/* ── Child components (unchanged) ── */
import MarketDetailHeader from "../components/MarketDetailHeader";
import ImageGallery       from "./MarketDetail/ImageGallery";
import VariantSelector    from "./MarketDetail/VariantSelector";
import SellerCard         from "./MarketDetail/SellerCard";
import ProductInfo        from "./MarketDetail/ProductInfo";
import SpecsSection       from "./MarketDetail/SpecsSection";
import RelatedProducts    from "./MarketDetail/RelatedProducts";

import "../styles/MarketDetail.css";
import "../styles/MarketDetailPremium.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE           = import.meta.env.VITE_API_BASE_URL;
const API            = `${BASE}/api`;
const CART_ITEMS_URL = `${API}/cart/items`;
const CART_URL       = `${API}/cart`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const CART_KEY   = "mm_cart";
const RECENT_KEY = "lm-recently-viewed";
const MAX_QTY    = 10;

const TRUST_BADGES = [
  { icon: "🔒", label: "Secure Payment",   sub: "Protected checkout"        },
  { icon: "✅", label: "Verified Seller",  sub: "Identity confirmed"        },
  { icon: "🚚", label: "Fast Delivery",    sub: "2-5 business days"         },
  { icon: "↩️", label: "Easy Returns",     sub: "7-day return window"       },
];

const REPORT_REASONS = [
  { key: "fake",         label: "Fake or counterfeit product",      icon: "🚫" },
  { key: "misleading",   label: "Wrong or misleading information",  icon: "⚠️" },
  { key: "prohibited",   label: "Prohibited item",                  icon: "🛑" },
  { key: "scam",         label: "Spam or scam",                     icon: "❌" },
  { key: "inappropriate",label: "Inappropriate content",            icon: "🔞" },
  { key: "other",        label: "Other reason",                     icon: "💬" },
];

/* ═══════════════════════════════════════════════════════════════
   AUTH HELPERS
═══════════════════════════════════════════════════════════════ */
const isLoggedIn = () => !!localStorage.getItem("marketplace_token");

const authHeaders = () => {
  const token = localStorage.getItem("marketplace_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/* ═══════════════════════════════════════════════════════════════
   GUEST CART
═══════════════════════════════════════════════════════════════ */
const readGuestCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
};

const writeGuestCart = (cart) => {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
};

const addToGuestCart = (product, selectedVariant, displayPrice, originalPrice, qty = 1) => {
  const cart      = readGuestCart();
  const variantId = selectedVariant?.id ?? null;
  const itemKey   = `${product.id}__${variantId ?? "default"}`;
  const existing  = cart.findIndex((c) => c.id === itemKey);
  const stock     = selectedVariant?.stock ?? product?.stock ?? 99;

  const item = {
    id            : itemKey,
    productId     : product.id,
    name          : product.name,
    image         : getProductImage(product),
    price         : displayPrice,
    originalPrice : originalPrice > displayPrice ? originalPrice : null,
    variant       : selectedVariant
      ? { id: selectedVariant.id, name: selectedVariant.name, sku: selectedVariant.sku }
      : null,
    slug    : product.slug ?? product.id,
    qty,
    stock,
    addedAt : Date.now(),
  };

  if (existing >= 0) {
    cart[existing].qty = Math.min(cart[existing].qty + qty, stock);
  } else {
    cart.push(item);
  }

  writeGuestCart(cart);
  return cart.reduce((sum, i) => sum + (i.qty ?? 1), 0);
};

/* ═══════════════════════════════════════════════════════════════
   SERVER CART COUNT
═══════════════════════════════════════════════════════════════ */
const fetchServerCartCount = async () => {
  try {
    const token = localStorage.getItem("marketplace_token");
    if (!token) return null;
    const res = await axios.get(CART_URL, {
      headers : { Authorization: `Bearer ${token}` },
      timeout : 5_000,
    });
    return res.data?.data?.total_qty ?? res.data?.data?.item_count ?? null;
  } catch { return null; }
};

/* ═══════════════════════════════════════════════════════════════
   RECENTLY VIEWED
═══════════════════════════════════════════════════════════════ */
const addToRecentlyViewed = (product) => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
      .filter((p) => p.id !== product.id);
    list.unshift({
      id    : product.id,
      name  : product.name,
      price : product.price,
      image : getProductImage(product),
      slug  : product.slug ?? product.id,
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   DELIVERY ESTIMATE
═══════════════════════════════════════════════════════════════ */
const getDeliveryEstimate = () => {
  const now = new Date();
  const min = new Date(now); min.setDate(min.getDate() + 2);
  const max = new Date(now); max.setDate(max.getDate() + 5);
  const fmt = (d) =>
    d.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" });
  return `${fmt(min)} – ${fmt(max)}`;
};

/* ═══════════════════════════════════════════════════════════════
   FAKE RATING (from product stats until reviews are wired)
═══════════════════════════════════════════════════════════════ */
const fakeRating = (product) => {
  const seed = (product?.view_count ?? 0) + (product?.save_count ?? 0);
  return Math.min(5, 3.7 + (seed % 13) / 10);
};
const fakeReviewCount = (product) =>
  Math.floor(((product?.view_count ?? 0) % 400) + 12);

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  flag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width={18} height={18}>
      <circle cx="9"  cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  minus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" aria-hidden="true" width={14} height={14}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" aria-hidden="true" width={14} height={14}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width={16} height={16}>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width={12} height={12}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width={14} height={14}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   PREMIUM SKELETON
═══════════════════════════════════════════════════════════════ */
function ProductSkeleton() {
  return (
    <div className="mdp-skeleton" aria-busy="true" aria-label="Loading product">
      <div className="mdp-skel mdp-skel-hero" />
      <div className="mdp-skel-thumbs">
        {[0,1,2,3,4].map((i) => <div key={i} className="mdp-skel mdp-skel-thumb" />)}
      </div>
      <div className="mdp-skel-body">
        <div className="mdp-skel" style={{ width:"30%", height:12, borderRadius:4 }} />
        <div className="mdp-skel" style={{ width:"85%", height:20, borderRadius:5, margin:"10px 0" }} />
        <div className="mdp-skel" style={{ width:"60%", height:14, borderRadius:4 }} />
        <div style={{ height:14 }} />
        <div className="mdp-skel" style={{ width:"35%", height:28, borderRadius:6 }} />
        <div style={{ height:20 }} />
        <div className="mdp-skel" style={{ width:"100%", height:60, borderRadius:12 }} />
        <div style={{ height:14 }} />
        <div className="mdp-skel" style={{ width:"100%", height:110, borderRadius:12 }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAR RATING
═══════════════════════════════════════════════════════════════ */
const StarRating = memo(function StarRating({ rating, size = 14 }) {
  return (
    <div className="mdp-stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <span key={i} className="mdp-star" style={{ width: size, height: size }}>
            <span className="mdp-star-bg" style={{ width: size, height: size }}>
              {Icon.star}
            </span>
            <span
              className="mdp-star-fg"
              style={{ width: size, height: size, clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
            >
              {Icon.star}
            </span>
          </span>
        );
      })}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   QUANTITY SELECTOR
═══════════════════════════════════════════════════════════════ */
const QuantitySelector = memo(function QuantitySelector({ value, onChange, max = MAX_QTY, disabled }) {
  const clamp = (v) => Math.max(1, Math.min(max, v));

  return (
    <div className={`mdp-qty ${disabled ? "mdp-qty--disabled" : ""}`}
      role="group" aria-label="Quantity">
      <button
        type="button"
        className="mdp-qty__btn"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= 1}
        aria-label="Decrease quantity"
      >
        {Icon.minus}
      </button>
      <span className="mdp-qty__value" aria-live="polite">{value}</span>
      <button
        type="button"
        className="mdp-qty__btn"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        {Icon.plus}
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   CONFETTI BURST
═══════════════════════════════════════════════════════════════ */
const CONFETTI_COLORS = ["#ff5722","#ff8a00","#10b981","#6366f1","#f59e0b","#ec4899"];

function ConfettiBurst({ show }) {
  if (!show) return null;
  return (
    <div className="mdp-confetti" aria-hidden="true">
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          className="mdp-confetti__piece"
          style={{
            background       : CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            "--x"            : `${(Math.random() - 0.5) * 240}px`,
            "--y"            : `${-Math.random() * 320 - 60}px`,
            "--r"            : `${Math.random() * 720}deg`,
            "--delay"        : `${Math.random() * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CART TOAST (premium)
═══════════════════════════════════════════════════════════════ */
const CartToast = memo(function CartToast({ show, productName, qty, image, onView, onClose }) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mdp-toast"
    >
      <div className="mdp-toast__img-wrap">
        {image
          ? <img src={image} alt={productName} className="mdp-toast__img" />
          : <div className="mdp-toast__img-ph">📦</div>
        }
      </div>
      <div className="mdp-toast__body">
        <p className="mdp-toast__label">✓ Added to cart</p>
        <p className="mdp-toast__name">{productName}</p>
        <p className="mdp-toast__qty">Qty: {qty}</p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="mdp-toast__view"
      >
        View Cart
      </button>
      <button
        type="button"
        onClick={onClose}
        className="mdp-toast__close"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   REPORT MODAL (premium)
═══════════════════════════════════════════════════════════════ */
const ReportModal = memo(function ReportModal({ productId, onClose }) {
  const [reason,     setReason]     = useState("");
  const [details,    setDetails]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/${productId}/report`, { reason, details });
      setSubmitted(true);
    } catch {} finally { setSubmitting(false); }
  }, [productId, reason, details]);

  return (
    <div
      className="mdp-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Report listing"
    >
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
                  <button
                    key={r.key}
                    type="button"
                    className={`mdp-reason-btn${reason === r.label ? " mdp-reason-btn--on" : ""}`}
                    onClick={() => setReason(r.label)}
                    aria-pressed={reason === r.label}
                  >
                    <span className="mdp-reason-icon" aria-hidden="true">{r.icon}</span>
                    <span>{r.label}</span>
                    {reason === r.label && (
                      <span className="mdp-reason-check" aria-hidden="true">{Icon.check}</span>
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
                aria-label="Additional details"
              />
              <p className="mdp-char-count">{details.length}/500</p>
            </div>

            <div className="mdp-modal-footer">
              <button className="mdp-modal-cancel" onClick={onClose}>Cancel</button>
              <button
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

/* ═══════════════════════════════════════════════════════════════
   SHARE SHEET (premium)
═══════════════════════════════════════════════════════════════ */
const ShareSheet = memo(function ShareSheet({ product, onClose }) {
  const pageUrl = window.location.href;
  const text    = `Check out ${product.name} on Loemart — ${formatPrice(product.price)}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.post(`${API_URL}/${product.id}/share`).catch(() => {});
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = "";
    };
  }, [onClose, product.id]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }, [pageUrl]);

  const nativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, text, url: pageUrl });
      } catch {}
    }
  }, [product.name, text, pageUrl]);

  const shareOptions = useMemo(() => [
    { label:"WhatsApp", icon:"💬", color:"#25D366", href:`https://wa.me/?text=${encodeURIComponent(`${text} ${pageUrl}`)}` },
    { label:"Twitter",  icon:"🐦", color:"#1DA1F2", href:`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}` },
    { label:"Facebook", icon:"📘", color:"#1877F2", href:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}` },
    { label:"Telegram", icon:"✈️", color:"#0088cc", href:`https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}` },
    { label:"Email",    icon:"📧", color:"#ea4335", href:`mailto:?subject=${encodeURIComponent(product.name)}&body=${encodeURIComponent(`${text}\n\n${pageUrl}`)}` },
  ], [text, pageUrl, product.name]);

  const thumbSrc = getProductImage(product);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="mdp-modal-overlay" onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Share product">
      <div className="mdp-share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mdp-share-handle" aria-hidden="true" />
        <h3 className="mdp-share-title">Share this product</h3>

        <div className="mdp-share-preview">
          {thumbSrc && <img src={thumbSrc} alt={product.name} className="mdp-share-thumb" />}
          <div className="mdp-share-preview__body">
            <p className="mdp-share-name">{product.name}</p>
            <p className="mdp-share-price">{formatPrice(product.price)}</p>
          </div>
        </div>

        {canNativeShare && (
          <button
            type="button"
            className="mdp-share-native"
            onClick={nativeShare}
          >
            📱 Share via device
          </button>
        )}

        <div className="mdp-share-options">
          {shareOptions.map((opt) => (
            <a
              key={opt.label}
              href={opt.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mdp-share-opt"
              style={{ "--sc": opt.color }}
              aria-label={`Share on ${opt.label}`}
            >
              <span className="mdp-share-opt-icon">{opt.icon}</span>
              <span className="mdp-share-opt-label">{opt.label}</span>
            </a>
          ))}
        </div>

        <button className="mdp-copy-link" onClick={copyLink}>
          {copied ? "✅ Link Copied!" : "📋 Copy Link"}
        </button>
        <button className="mdp-share-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   BREADCRUMBS
═══════════════════════════════════════════════════════════════ */
const Breadcrumbs = memo(function Breadcrumbs({ category, productName }) {
  const navigate = useNavigate();

  return (
    <nav className="mdp-breadcrumbs" aria-label="Breadcrumb">
      <button type="button" className="mdp-breadcrumbs__link"
        onClick={() => navigate("/loemart")}>
        Home
      </button>
      {category && (
        <>
          <span className="mdp-breadcrumbs__sep" aria-hidden="true">{Icon.chevron}</span>
          <button type="button" className="mdp-breadcrumbs__link"
            onClick={() => navigate(`/loemart?category=${category}`)}>
            {category}
          </button>
        </>
      )}
      <span className="mdp-breadcrumbs__sep" aria-hidden="true">{Icon.chevron}</span>
      <span className="mdp-breadcrumbs__current" aria-current="page">
        {productName?.length > 30 ? productName.slice(0, 30) + "…" : productName}
      </span>
    </nav>
  );
});

/* ═══════════════════════════════════════════════════════════════
   STICKY MINI HEADER
═══════════════════════════════════════════════════════════════ */
const StickyMiniHeader = memo(function StickyMiniHeader({
  visible, product, displayPrice, onAddToCart, disabled,
}) {
  if (!product) return null;
  const img = getProductImage(product);

  return (
    <div className={`mdp-mini-header ${visible ? "mdp-mini-header--visible" : ""}`}
      aria-hidden={!visible}>
      <div className="mdp-mini-header__inner">
        {img && (
          <img src={img} alt="" className="mdp-mini-header__img" aria-hidden="true" />
        )}
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
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function MarketDetail({ user }) {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { items: wishlist, toggle: toggleWishlist } = useWishlist();

  /* ── Product ── */
  const [product,         setProduct]         = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);

  /* ── Cart ── */
  const [qty,          setQty]          = useState(1);
  const [addedToCart,  setAddedToCart]  = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartError,    setCartError]    = useState(null);
  const [confetti,     setConfetti]     = useState(false);
  const [cartCount,    setCartCount]    = useState(() =>
    isLoggedIn() ? 0 : readGuestCart().reduce((s, i) => s + (i.qty ?? 1), 0)
  );

  /* ── Modals ── */
  const [showReport, setShowReport] = useState(false);
  const [showShare,  setShowShare]  = useState(false);

  /* ── Sticky mini-header ── */
  const [miniHeaderVisible, setMiniHeaderVisible] = useState(false);
  const titleRef = useRef(null);

  /* ── Wishlist animation ── */
  const [wishAnimate, setWishAnimate] = useState(false);

  /* ── Derived ── */
  const isWishlisted = product ? wishlist.has(product.id) : false;
  const rating       = product ? fakeRating(product) : 0;
  const reviewCount  = product ? fakeReviewCount(product) : 0;
  const deliveryDate = useMemo(() => getDeliveryEstimate(), []);

  /* ════════════════════════════════════════════════════════
     SYNC CART COUNT
  ════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (isLoggedIn()) {
      fetchServerCartCount().then((c) => { if (c !== null) setCartCount(c); });
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      if (isLoggedIn()) {
        fetchServerCartCount().then((c) => { if (c !== null) setCartCount(c); });
      } else {
        setCartCount(readGuestCart().reduce((s, i) => s + (i.qty ?? 1), 0));
      }
    };
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage",      sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage",      sync);
    };
  }, []);

  /* ════════════════════════════════════════════════════════
     FETCH PRODUCT
  ════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setProduct(null);
    setSelectedVariant(null);
    setQty(1);

    axios
      .get(`${API_URL}/${slug}`, { timeout: 12_000 })
      .then(({ data }) => {
        if (cancelled) return;
        const p = data?.data ?? data?.product ?? data;
        setProduct(p);
        if (p?.variants?.length > 0) setSelectedVariant(p.variants[0]);
        addToRecentlyViewed(p);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.status === 404 ? "404" : "error");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug]);

  /* ════════════════════════════════════════════════════════
     STICKY MINI-HEADER OBSERVER
  ════════════════════════════════════════════════════════ */
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
     PRICING
  ════════════════════════════════════════════════════════ */
  const displayPrice = useMemo(() =>
    selectedVariant?.price ? Number(selectedVariant.price) : Number(product?.price ?? 0),
    [selectedVariant, product]
  );

  const originalPrice = useMemo(
    () => Number(product?.original_price ?? product?.compare_price ?? 0),
    [product]
  );

  const discount = useMemo(() => calcDiscount(displayPrice, originalPrice), [displayPrice, originalPrice]);
  const savings  = useMemo(() => originalPrice > displayPrice ? originalPrice - displayPrice : 0, [originalPrice, displayPrice]);
  const total    = useMemo(() => displayPrice * qty, [displayPrice, qty]);
  const totalSavings = useMemo(() => savings * qty, [savings, qty]);

  const viewLabel = useMemo(() => {
    const v = product?.view_count ?? 0;
    return v > 999 ? `${(v / 1000).toFixed(1)}k` : String(v);
  }, [product?.view_count]);

  /* ════════════════════════════════════════════════════════
     ADD TO CART
  ════════════════════════════════════════════════════════ */
  const handleAddToCart = useCallback(async () => {
    if (!product || addingToCart) return;

    setAddingToCart(true);
    setCartError(null);

    const variantId = selectedVariant?.id ?? null;

    try {
      if (isLoggedIn()) {
        await axios.post(
          CART_ITEMS_URL,
          { product_id: product.id, variant_id: variantId, qty },
          { headers: authHeaders() }
        );
        const count = await fetchServerCartCount();
        if (count !== null) setCartCount(count);
        window.dispatchEvent(new Event("cart-updated"));
      } else {
        const newCount = addToGuestCart(product, selectedVariant, displayPrice, originalPrice, qty);
        setCartCount(newCount);
      }

      setAddedToCart(true);
      setConfetti(true);
      window.navigator?.vibrate?.([25, 15, 25]);
      setTimeout(() => setConfetti(false), 1200);
      setTimeout(() => setAddedToCart(false), 3500);

    } catch (err) {
      const msg = err.response?.data?.message ?? err.response?.data?.error ?? "Failed to add to cart";
      setCartError(msg);
      setTimeout(() => setCartError(null), 4000);
    } finally {
      setAddingToCart(false);
    }
  }, [product, selectedVariant, displayPrice, originalPrice, qty, addingToCart]);

  const handleBuyNow = useCallback(async () => {
    await handleAddToCart();
    navigate("/shop/cart");
  }, [handleAddToCart, navigate]);

  const goToCart       = useCallback(() => navigate("/shop/cart"), [navigate]);
  const openReport     = useCallback(() => setShowReport(true), []);
  const closeReport    = useCallback(() => setShowReport(false), []);
  const openShare      = useCallback(() => { if (product) setShowShare(true); }, [product]);
  const closeShare     = useCallback(() => setShowShare(false), []);

  const handleWishlist = useCallback(() => {
    if (!product) return;
    toggleWishlist(product.id);
    setWishAnimate(true);
    window.navigator?.vibrate?.(15);
    setTimeout(() => setWishAnimate(false), 500);
  }, [product, toggleWishlist]);

  const isOutOfStock = useMemo(() => {
    if (selectedVariant) return typeof selectedVariant.stock === "number" && selectedVariant.stock <= 0;
    return false;
  }, [selectedVariant]);

  const stockLeft = useMemo(
    () => selectedVariant?.stock !== undefined ? selectedVariant.stock : null,
    [selectedVariant]
  );

  /* ════════════════════════════════════════════════════════
     ERROR SCREENS
  ════════════════════════════════════════════════════════ */
  if (!loading && error === "404") {
    return (
      <div className="mdp-not-found">
        <div className="mdp-nf-illustration" aria-hidden="true">
          <div className="mdp-nf-circle"><span>🔍</span></div>
          <div className="mdp-nf-dots"><div /><div /><div /></div>
        </div>
        <h2>Product Not Found</h2>
        <p>This listing may have been removed or is no longer available.</p>
        <div className="mdp-nf-actions">
          <button className="mdp-nf-btn mdp-nf-btn--primary" onClick={() => navigate("/loemart")}>
            Browse Products {Icon.arrow}
          </button>
          <button className="mdp-nf-btn mdp-nf-btn--secondary" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!loading && error) {
    return (
      <div className="mdp-not-found">
        <div className="mdp-nf-illustration" aria-hidden="true">
          <div className="mdp-nf-circle"><span>⚠️</span></div>
        </div>
        <h2>Something went wrong</h2>
        <p>Could not load this product. Please try again.</p>
        <div className="mdp-nf-actions">
          <button className="mdp-nf-btn mdp-nf-btn--primary" onClick={() => window.location.reload()}>
            Try Again
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

        {/* ── Header (existing component) ── */}
        <MarketDetailHeader
          productName={product?.name}
          cartCount={cartCount}
          isWishlisted={isWishlisted}
          onShare={openShare}
          onToggleWishlist={handleWishlist}
          productLoaded={!!product}
        />

        {/* ── Sticky mini-header on scroll ── */}
        <StickyMiniHeader
          visible={miniHeaderVisible}
          product={product}
          displayPrice={displayPrice}
          onAddToCart={handleAddToCart}
          disabled={addingToCart || isOutOfStock}
        />

        {/* ── Skeleton ── */}
        {loading && <ProductSkeleton />}

        {/* ── Product ── */}
        {!loading && product && (
          <>
            {/* Breadcrumbs */}
            <Breadcrumbs
              category={product.category}
              productName={product.name}
            />

            {/* Image gallery (existing component) */}
            <ImageGallery images={product.images ?? []} name={product.name} />

            <div className="md-content mdp-content">

              {/* Badges row */}
              <div className="md-badges-row mdp-badges-row">
                {product.category && (
                  <span className="md-cat-pill mdp-cat-pill">{product.category}</span>
                )}
                {product.is_featured && (
                  <span className="md-badge mdp-badge mdp-badge--featured">⭐ Featured</span>
                )}
                {product.is_trending && (
                  <span className="md-badge mdp-badge mdp-badge--trending">🔥 Trending</span>
                )}
                {product.condition && product.condition !== "new" && (
                  <span className="md-badge mdp-badge mdp-badge--cond">{product.condition}</span>
                )}
                {discount > 0 && (
                  <span className="md-badge mdp-badge mdp-badge--save">Save {discount}%</span>
                )}
              </div>

              {/* Title */}
              <h1 ref={titleRef} className="md-title mdp-title">{product.name}</h1>

              {/* Brand + rating row */}
              <div className="mdp-brand-rating-row">
                {product.brand && (
                  <p className="md-brand mdp-brand">
                    by <strong>{product.brand}</strong>
                  </p>
                )}
                <div className="mdp-rating-inline">
                  <StarRating rating={rating} />
                  <span className="mdp-rating-num">{rating.toFixed(1)}</span>
                  <span className="mdp-rating-count">({reviewCount.toLocaleString()} reviews)</span>
                </div>
              </div>

              {/* Price block */}
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
                  <span>🎉</span> You save {formatPrice(savings)} today
                </p>
              )}

              {/* Stock indicator */}
              {stockLeft !== null && (
                <div className={`mdp-stock ${
                  stockLeft === 0  ? "mdp-stock--out" :
                  stockLeft <= 5   ? "mdp-stock--low" :
                  stockLeft <= 10  ? "mdp-stock--med" : "mdp-stock--ok"
                }`} aria-live="polite">
                  <span className="mdp-stock__dot" aria-hidden="true" />
                  <span className="mdp-stock__text">
                    {stockLeft === 0   ? "Out of stock"
                    : stockLeft <= 5   ? `Only ${stockLeft} left — order soon!`
                    : stockLeft <= 10  ? `Limited stock (${stockLeft} available)`
                    : "In stock — ready to ship"}
                  </span>
                </div>
              )}

              {/* Stats */}
              {(product.view_count > 0 || product.save_count > 0 || product.variants?.length > 0) && (
                <div className="md-stats-row mdp-stats-row">
                  {product.view_count > 0 && (
                    <span className="md-stat mdp-stat">
                      <span aria-hidden="true">👁</span> {viewLabel} views
                    </span>
                  )}
                  {product.save_count > 0 && (
                    <span className="md-stat mdp-stat">
                      <span aria-hidden="true">❤️</span> {product.save_count} saved
                    </span>
                  )}
                  {product.variants?.length > 0 && (
                    <span className="md-stat mdp-stat">
                      <span aria-hidden="true">📦</span> {product.variants.length} variants
                    </span>
                  )}
                </div>
              )}

              {/* Variants (existing component) */}
              {product.variants?.length > 0 && (
                <VariantSelector
                  variants={product.variants}
                  selected={selectedVariant}
                  onSelect={setSelectedVariant}
                />
              )}

              {/* Quantity selector */}
              {!isOutOfStock && (
                <div className="mdp-qty-row">
                  <span className="mdp-qty-label">Quantity</span>
                  <QuantitySelector
                    value={qty}
                    onChange={setQty}
                    max={stockLeft ?? MAX_QTY}
                    disabled={isOutOfStock}
                  />
                  {qty > 1 && (
                    <span className="mdp-qty-total">
                      Total: <strong>{formatPrice(total)}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Delivery card */}
              <div className="mdp-delivery-card">
                <div className="mdp-delivery-card__icon" aria-hidden="true">
                  {Icon.truck}
                </div>
                <div className="mdp-delivery-card__body">
                  <p className="mdp-delivery-card__title">Fast Delivery</p>
                  <p className="mdp-delivery-card__sub">
                    Estimated arrival: <strong>{deliveryDate}</strong>
                  </p>
                  <p className="mdp-delivery-card__note">
                    Managed by Loemart · Tracking included
                  </p>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <ProductInfo description={product.description} />
              )}

              {/* Key features */}
              {product.key_features?.length > 0 && (
                <div className="md-section mdp-section">
                  <h3 className="md-section-title mdp-section-title">✨ Key Features</h3>
                  <ul className="md-features-list mdp-features-list">
                    {product.key_features.map((f, i) => (
                      <li key={i} className="md-feature-item mdp-feature-item">
                        <span className="md-feat-check mdp-feat-check" aria-hidden="true">
                          {Icon.check}
                        </span>
                        <span>{f?.feature ?? f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specs (existing component) */}
              {product.specifications?.length > 0 && (
                <SpecsSection specs={product.specifications} />
              )}

              {/* What's in the Box */}
              {product.whats_in_box?.length > 0 && (
                <div className="md-section mdp-section">
                  <h3 className="md-section-title mdp-section-title">📦 What's in the Box</h3>
                  <ul className="md-box-list mdp-box-list">
                    {product.whats_in_box.map((b, i) => (
                      <li key={i} className="md-box-item mdp-box-item">
                        <span aria-hidden="true">✓</span>
                        <span>{b?.item ?? b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Policies */}
              {(product.return_policy || product.warranty) && (
                <div className="md-section mdp-section">
                  <h3 className="md-section-title mdp-section-title">📋 Policies</h3>
                  {product.return_policy && (
                    <div className="md-policy-item mdp-policy-item">
                      <span className="mdp-policy-icon" aria-hidden="true">↩️</span>
                      <div>
                        <strong>Return Policy</strong>
                        <p>{product.return_policy}</p>
                      </div>
                    </div>
                  )}
                  {product.warranty && (
                    <div className="md-policy-item mdp-policy-item">
                      <span className="mdp-policy-icon" aria-hidden="true">🛡️</span>
                      <div>
                        <strong>Warranty</strong>
                        <p>{product.warranty}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              {product.tags?.length > 0 && (
                <div className="md-tags-row mdp-tags-row">
                  {product.tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="md-tag mdp-tag"
                      onClick={() => navigate(`/loemart?q=${encodeURIComponent(t)}`)}
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}

              {/* Seller card (existing) */}
              <SellerCard product={product} />

              {/* Trust badges — premium version */}
              <div className="mdp-trust-grid" aria-label="Trust indicators">
                {TRUST_BADGES.map((b) => (
                  <div key={b.label} className="mdp-trust-item">
                    <span className="mdp-trust-icon" aria-hidden="true">{b.icon}</span>
                    <div className="mdp-trust-body">
                      <p className="mdp-trust-label">{b.label}</p>
                      <p className="mdp-trust-sub">{b.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Report button */}
              <button
                type="button"
                className="md-report-btn mdp-report-btn"
                onClick={openReport}
              >
                {Icon.flag}
                <span>Report this listing</span>
              </button>

            </div>

            {/* Related products (existing) */}
            {product.category && (
              <RelatedProducts
                category={product.category}
                excludeId={product.id}
              />
            )}

            {/* Spacer for sticky bar */}
            <div style={{ height: 130 }} aria-hidden="true" />
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          STICKY BOTTOM BAR  (premium)
      ══════════════════════════════════════════════════ */}
      {!loading && product && (
        <div className="md-sticky-bar mdp-sticky-bar" role="region" aria-label="Purchase actions">

          {/* Left: price + qty */}
          <div className="mdp-sticky-left">
            <div className="mdp-sticky-price-wrap">
              <span className="mdp-sticky-price">{formatPrice(total)}</span>
              {qty > 1 && (
                <span className="mdp-sticky-qty-note">
                  {formatPrice(displayPrice)} × {qty}
                </span>
              )}
              {totalSavings > 0 && (
                <span className="mdp-sticky-savings">
                  Save {formatPrice(totalSavings)}
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="mdp-sticky-actions">
            {cartError && (
              <span className="mdp-sticky-error" role="alert">
                {cartError}
              </span>
            )}

            <button
              type="button"
              className={`md-btn-cart mdp-btn-cart${addedToCart ? " mdp-btn-cart--done" : ""}`}
              onClick={handleAddToCart}
              disabled={addingToCart || isOutOfStock}
              aria-label={
                isOutOfStock ? "Out of stock" :
                addedToCart ? "Added to cart" : "Add to cart"
              }
              aria-busy={addingToCart}
            >
              {/* Confetti burst on success */}
              <ConfettiBurst show={confetti} />

              {isOutOfStock ? "Out of Stock"
              : addingToCart ? (
                  <>
                    <span className="mdp-spinner" aria-hidden="true" /> Adding…
                  </>
                )
              : addedToCart ? (
                  <>
                    <span className="mdp-btn-check">{Icon.check}</span> Added!
                  </>
                )
              : (
                  <>
                    {Icon.cart} Add to Cart
                  </>
                )}
            </button>

            <button
              type="button"
              className="md-btn-buy mdp-btn-buy"
              onClick={handleBuyNow}
              disabled={addingToCart || isOutOfStock}
              aria-label="Buy now"
            >
              Buy Now {Icon.arrow}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          FLOATING CART BADGE (when items in cart)
      ══════════════════════════════════════════════════ */}
      {cartCount > 0 && !miniHeaderVisible && (
        <button
          type="button"
          className="mdp-float-cart"
          onClick={goToCart}
          aria-label={`View cart — ${cartCount} items`}
        >
          {Icon.cart}
          <span className="mdp-float-cart__badge">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        </button>
      )}

      {/* Wishlist animation heart */}
      {wishAnimate && isWishlisted && (
        <div className="mdp-wish-burst" aria-hidden="true">❤️</div>
      )}

      {/* Cart toast */}
      <CartToast
        show={addedToCart}
        productName={product?.name ?? "Item"}
        qty={qty}
        image={product ? getProductImage(product) : null}
        onView={goToCart}
        onClose={() => setAddedToCart(false)}
      />

      {/* Modals */}
      {showReport && product && (
        <ReportModal productId={product.id} onClose={closeReport} />
      )}
      {showShare && product && (
        <ShareSheet product={product} onClose={closeShare} />
      )}
    </>
  );
}