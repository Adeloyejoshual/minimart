/**
 * src/pages/ProductDetail.jsx — v3
 *
 * Fixes from v2:
 *  ─ #1  : Secondary data useEffect depends on product (not product?.id etc.)
 *  ─ #2  : Favourites rollback logic corrected (was inverted)
 *  ─ #3  : favTimerRef cleared on unmount — no memory leak
 *  ─ #4  : Promise.allSettled receives only real Promises (.filter(Boolean))
 *  ─ #5  : Review state reset when slug changes
 *  ─ #6  : openWhatsApp shows toast when no contact info available
 *  ─ #7  : Inline <style> removed — all CSS lives in ProductDetail.css
 *  ─ #8  : Skeleton has aria-live="polite"
 *  ─ #9  : ImageGallery prev/next wrapped in useCallback
 *  ─ #10 : openCall / openWhatsApp guard against isOwn
 *  ─ #11 : DeliveryInfo formats booleans as "Yes" / "No"
 *  ─ #12 : Reviews keyed by review.id not array index
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

import ContactStrip    from "./ProductDetail/ContactStrip";
import ReviewSection   from "./ProductDetail/Review";
import SafetyTips      from "./ProductDetail/SafetyTips";
import SimilarProducts from "./ProductDetail/SimilarProducts";
import MoreFromSeller  from "./ProductDetail/MoreFromSeller";

/* Fix #7: all styles live in this file — no inline <style> block */
import "../styles/ProductDetail.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const BASE_URL      = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API           = `${BASE_URL}/api`;
const FAV_KEY       = "loemart_favs";
const REVIEWS_LIMIT = 5;
const FAV_DEBOUNCE  = 400;

/* ═══════════════════════════════════════════════════════════════
   AUTH UTILS
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const decodeJWT = (token) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
};

const readUserId = () => {
  try {
    const token = getToken();
    if (token) {
      const p  = decodeJWT(token);
      const id = p?.id || p?.sub || p?.userId || p?.user_id;
      if (id) return String(id);
    }
    for (const key of ["user", "loemart_user", "authUser"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const p  = JSON.parse(raw);
      const id = p?.id || p?.user?.id;
      if (id) return String(id);
    }
    return null;
  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════
   FAVOURITES UTILS
═══════════════════════════════════════════════════════════════ */
const loadFavs = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); }
  catch { return {}; }
};

const saveFavs = (f) => {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const onEnter = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") fn();
};

const fmt = (n) =>
  Number(n).toLocaleString("en-NG", { minimumFractionDigits: 0 });

/* ═══════════════════════════════════════════════════════════════
   SKELETON  — Fix #8: aria-live added
═══════════════════════════════════════════════════════════════ */
const Skeleton = memo(function Skeleton() {
  return (
    <div
      className="pd-page"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading product"
    >
      <div className="pd-sk-hero" />
      <div className="pd-sk-body">
        <div className="pd-sk-line" style={{ width: "35%",  height: 11 }} />
        <div className="pd-sk-line" style={{ width: "90%",  height: 24, marginTop: 8  }} />
        <div className="pd-sk-line" style={{ width: "45%",  height: 32, marginTop: 10 }} />
        <div className="pd-sk-line" style={{ width: "100%", height: 90,  marginTop: 20, borderRadius: 12 }} />
        <div className="pd-sk-line" style={{ width: "100%", height: 120, marginTop: 12, borderRadius: 12 }} />
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   IMAGE GALLERY
   Fix #9: prev / next wrapped in useCallback
═══════════════════════════════════════════════════════════════ */
const ImageGallery = memo(function ImageGallery({ images, title }) {
  const [active, setActive] = useState(0);

  const urls = useMemo(() => {
    if (Array.isArray(images) && images.length > 0) {
      return images.map((img) => (typeof img === "string" ? img : img.url));
    }
    return [];
  }, [images]);

  /* Fix #9: stable references so memo children don't re-render */
  const prev = useCallback(
    () => setActive((i) => (i - 1 + urls.length) % urls.length),
    [urls.length]
  );
  const next = useCallback(
    () => setActive((i) => (i + 1) % urls.length),
    [urls.length]
  );

  /* Reset to first image when product changes */
  useEffect(() => { setActive(0); }, [urls]);

  if (!urls.length) {
    return (
      <div className="pd-gallery-empty" aria-label="No image available">
        <span>📷</span>
      </div>
    );
  }

  return (
    <div className="pd-gallery">
      {/* Main image */}
      <div className="pd-gallery-main">
        <img
          src={urls[active]}
          alt={`${title} — image ${active + 1}`}
          className="pd-gallery-img"
          loading="eager"
          onError={(e) => {
            e.currentTarget.src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'" +
              " width='400' height='300'%3E%3Crect fill='%23f0f0f0' width='400'" +
              " height='300'/%3E%3Ctext x='50%25' y='50%25'" +
              " dominant-baseline='middle' text-anchor='middle'" +
              " fill='%23999' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";
          }}
        />

        {urls.length > 1 && (
          <>
            <button
              className="pd-gallery-arrow pd-gallery-arrow--left"
              onClick={prev}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              className="pd-gallery-arrow pd-gallery-arrow--right"
              onClick={next}
              aria-label="Next image"
            >
              ›
            </button>

            <div className="pd-gallery-dots" aria-label="Image navigation">
              {urls.map((_, i) => (
                <button
                  key={i}
                  className={`pd-gallery-dot${i === active ? " pd-gallery-dot--active" : ""}`}
                  onClick={() => setActive(i)}
                  aria-label={`Image ${i + 1}`}
                  aria-current={i === active}
                />
              ))}
            </div>

            <span className="pd-gallery-counter" aria-hidden="true">
              {active + 1} / {urls.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {urls.length > 1 && (
        <div className="pd-gallery-thumbs" role="list" aria-label="All images">
          {urls.map((url, i) => (
            <button
              key={i}
              role="listitem"
              className={`pd-gallery-thumb${i === active ? " pd-gallery-thumb--active" : ""}`}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PRICE BLOCK
═══════════════════════════════════════════════════════════════ */
const PriceBlock = memo(function PriceBlock({
  price,
  original_price,
  discount_percent,
  currency = "NGN",
  negotiable,
}) {
  const symbol = currency === "NGN" ? "₦" : currency;

  return (
    <div className="pd-price-block">
      <span className="pd-price" aria-label={`Price: ${symbol}${fmt(price)}`}>
        {symbol}{fmt(price)}
      </span>

      {original_price && original_price > price && (
        <>
          <span
            className="pd-price-original"
            aria-label={`Original price: ${symbol}${fmt(original_price)}`}
          >
            {symbol}{fmt(original_price)}
          </span>
          {discount_percent > 0 && (
            <span
              className="pd-price-discount"
              aria-label={`${discount_percent}% off`}
            >
              -{discount_percent}%
            </span>
          )}
        </>
      )}

      {negotiable && (
        <span
          className="pd-badge pd-badge--negotiable"
          aria-label="Price is negotiable"
        >
          Negotiable
        </span>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   META BADGES
═══════════════════════════════════════════════════════════════ */
const MetaBadges = memo(function MetaBadges({ product }) {
  const items = [
    product.condition && { label: "Condition", value: product.condition },
    product.brand     && { label: "Brand",     value: product.brand     },
    product.model     && { label: "Model",     value: product.model     },
    (product.location_city || product.location_state) && {
      label : "Location",
      value : [product.location_city, product.location_state]
        .filter(Boolean)
        .join(", "),
    },
    product.category_name && {
      label : "Category",
      value : product.subcategory_name
        ? `${product.category_name} › ${product.subcategory_name}`
        : product.category_name,
    },
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div className="pd-meta-badges">
      {items.map(({ label, value }) => (
        <div key={label} className="pd-meta-badge">
          <span className="pd-meta-badge-label">{label}</span>
          <span className="pd-meta-badge-value">{value}</span>
        </div>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   DESCRIPTION
═══════════════════════════════════════════════════════════════ */
const Description = memo(function Description({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const LIMIT    = 300;
  const isLong   = text.length > LIMIT;
  const displayed = !isLong || expanded ? text : `${text.slice(0, LIMIT)}…`;

  return (
    <section className="pd-section" aria-label="Description">
      <h3 className="pd-section-h">Description</h3>
      <p className="pd-description" style={{ whiteSpace: "pre-wrap" }}>
        {displayed}
      </p>
      {isLong && (
        <button
          className="pd-expand-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less ▲" : "Read more ▼"}
        </button>
      )}
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FEATURES
═══════════════════════════════════════════════════════════════ */
const Features = memo(function Features({ features }) {
  if (!Array.isArray(features) || !features.length) return null;

  return (
    <section className="pd-section" aria-label="Features">
      <h3 className="pd-section-h">Features</h3>
      <ul className="pd-features-list">
        {features.map((f, i) => (
          <li key={i} className="pd-features-item">
            <span className="pd-features-dot" aria-hidden="true">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SPECIFICATIONS
═══════════════════════════════════════════════════════════════ */
const Specifications = memo(function Specifications({ specifications }) {
  if (!Array.isArray(specifications) || !specifications.length) return null;

  return (
    <section className="pd-section" aria-label="Specifications">
      <h3 className="pd-section-h">Specifications</h3>
      <table className="pd-specs-table" aria-label="Product specifications">
        <tbody>
          {specifications.map(({ label, value }, i) => (
            <tr key={i} className={i % 2 === 0 ? "pd-specs-row--even" : ""}>
              <th className="pd-specs-label" scope="row">{label}</th>
              <td className="pd-specs-value">{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   HIGHLIGHTS
═══════════════════════════════════════════════════════════════ */
const Highlights = memo(function Highlights({ highlights }) {
  if (!Array.isArray(highlights) || !highlights.length) return null;

  return (
    <section className="pd-section" aria-label="Highlights">
      <h3 className="pd-section-h">Highlights</h3>
      <ul className="pd-highlights-list">
        {highlights.map((h, i) => (
          <li key={i} className="pd-highlights-item">
            <span aria-hidden="true">⚡</span>
            {h}
          </li>
        ))}
      </ul>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FAQ
═══════════════════════════════════════════════════════════════ */
const FAQ = memo(function FAQ({ faq }) {
  const [openIdx, setOpenIdx] = useState(null);
  if (!Array.isArray(faq) || !faq.length) return null;

  return (
    <section className="pd-section" aria-label="Frequently asked questions">
      <h3 className="pd-section-h">FAQ</h3>
      <div className="pd-faq">
        {faq.map((item, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={i} className="pd-faq-item">
              <button
                className="pd-faq-q"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <span>{item.question || item.q}</span>
                <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="pd-faq-a" role="region">
                  {item.answer || item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   DELIVERY INFO
   Fix #11: boolean values rendered as "Yes" / "No"
═══════════════════════════════════════════════════════════════ */
const formatDeliveryValue = (v) => {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
};

const DeliveryInfo = memo(function DeliveryInfo({ delivery }) {
  if (!delivery || typeof delivery !== "object") return null;

  const rows = Object.entries(delivery).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ""
  );

  if (!rows.length) return null;

  const prettify = (k) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <section className="pd-section" aria-label="Delivery information">
      <h3 className="pd-section-h">Delivery &amp; Shipping</h3>
      <div className="pd-delivery-grid">
        {rows.map(([k, v]) => (
          <div key={k} className="pd-delivery-row">
            <span className="pd-delivery-label">{prettify(k)}</span>
            {/* Fix #11: booleans shown as Yes/No */}
            <span className="pd-delivery-value">{formatDeliveryValue(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ATTRIBUTES
═══════════════════════════════════════════════════════════════ */
const Attributes = memo(function Attributes({ attributes }) {
  if (!attributes || typeof attributes !== "object") return null;

  const rows = Object.entries(attributes).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ""
  );

  if (!rows.length) return null;

  const prettify = (k) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <section className="pd-section" aria-label="Additional details">
      <h3 className="pd-section-h">Additional Details</h3>
      <div className="pd-attrs-grid">
        {rows.map(([k, v]) => (
          <div key={k} className="pd-attrs-row">
            <span className="pd-attrs-label">{prettify(k)}</span>
            <span className="pd-attrs-value">{String(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SELLER CARD
═══════════════════════════════════════════════════════════════ */
const SellerCard = memo(function SellerCard({ product, onNavigate }) {
  const name     = product.seller_store || product.seller_name || "Seller";
  const avatar   = product.seller_image ?? null;
  const verified = product.seller_verified;
  const trust    = product.seller_trust;
  const rating   = product.seller_rating;
  const online   = product.seller_online;

  return (
    <section className="pd-section" aria-label="Seller information">
      <h3 className="pd-section-h">Seller</h3>
      <div
        className="pd-seller-card"
        onClick={onNavigate}
        role="button"
        tabIndex={0}
        aria-label={`View seller profile for ${name}`}
        onKeyDown={onEnter(onNavigate)}
      >
        <div className="pd-seller-avatar">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          )}
          {online && (
            <span className="pd-seller-online" aria-label="Seller is online" />
          )}
        </div>

        <div className="pd-seller-info">
          <div className="pd-seller-name-row">
            <span className="pd-seller-name">{name}</span>
            {verified && (
              <span className="pd-seller-badge" aria-label="Verified seller">
                ✔ Verified
              </span>
            )}
          </div>

          <div className="pd-seller-stats">
            {rating > 0 && (
              <span aria-label={`Rating: ${Number(rating).toFixed(1)} stars`}>
                {Number(rating).toFixed(1)}★
              </span>
            )}
          </div>

          {trust != null && (
            <div className="pd-trust" aria-label={`Trust score: ${trust}%`}>
              <div className="pd-trust-bar" role="presentation">
                <div
                  className="pd-trust-fill"
                  style={{ width: `${Math.min(100, trust)}%` }}
                />
              </div>
              <span className="pd-trust-label">{trust}% trust</span>
            </div>
          )}
        </div>

        <svg
          className="pd-seller-chevron"
          width="16" height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   EXPIRY BANNER
═══════════════════════════════════════════════════════════════ */
const ExpiryBanner = memo(function ExpiryBanner({ product, isOwn }) {
  if (!isOwn)               return null;
  if (!product.active_until) return null;
  if (!product.is_trial)    return null;

  const days = product.days_remaining ?? 0;

  return (
    <div
      className={`pd-expiry-banner${days <= 3 ? " pd-expiry-banner--urgent" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">⏳</span>
      {days > 0
        ? `Trial listing — expires in ${days} day${days !== 1 ? "s" : ""}. ` +
          "Verify your identity to post permanently."
        : "Trial listing has expired. Verify your identity to restore it."}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SHARE BUTTON
═══════════════════════════════════════════════════════════════ */
const ShareButton = memo(function ShareButton({ product }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const shareData = {
      title : product.title,
      text  : `Check out ${product.title} on Loemart`,
      url   : window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        fetch(`${API}/product/products/${product.id}/share`, {
          method: "POST",
        }).catch(() => {});
      } catch {
        /* User cancelled — not an error */
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2_000);
      } catch {}
    }
  }, [product]);

  return (
    <button
      className="pd-share-btn"
      onClick={handleShare}
      aria-label="Share this listing"
    >
      {copied ? "✓ Copied!" : "Share"}
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   TOAST  — used for chat errors and missing contact info
   Fix #6: WhatsApp / call errors surfaced here
═══════════════════════════════════════════════════════════════ */
const Toast = memo(function Toast({ message, onDismiss, type = "error" }) {
  if (!message) return null;
  return (
    <div
      className={`pd-toast pd-toast--${type}`}
      role="alert"
      aria-live="assertive"
    >
      <span>{message}</span>
      <button
        className="pd-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ProductDetail({ user }) {
  const { slug }             = useParams();
  const navigate             = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── State ── */
  const [product,     setProduct]     = useState(null);
  const [similar,     setSimilar]     = useState([]);
  const [moreSeller,  setMoreSeller]  = useState([]);
  const [reviews,     setReviews]     = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPage,  setReviewPage]  = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [fav,         setFav]         = useState(false);
  const [chatBusy,    setChatBusy]    = useState(false);

  /* Fix #6: single toast state handles all user-facing errors */
  const [toast, setToast] = useState(null); // { message, type }

  /* ── Refs ── */
  const favTimerRef = useRef(null);
  const abortRef    = useRef(null);

  /* ── Derived ── */
  const userId = useMemo(() => user?.id || readUserId(), [user]);

  const isOwn = useMemo(
    () => !!(
      userId &&
      product?.seller_id &&
      userId === String(product.seller_id)
    ),
    [userId, product?.seller_id]
  );

  const showToast = useCallback((message, type = "error") => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  /* ═══════════════════════════════════════════════════════════
     FETCH — PRIMARY PRODUCT
  ═══════════════════════════════════════════════════════════ */
  const loadProduct = useCallback(async () => {
    if (!slug || slug === "undefined") {
      setError("Invalid product link.");
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}`,
        { signal: controller.signal }
      );

      if (res.status === 404) throw new Error("Product not found");
      if (!res.ok)            throw new Error("Could not load product");

      const data = await res.json();
      setProduct(data);
      addSingleProduct?.(data);
      setFav(!!loadFavs()[data.id]);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug, addSingleProduct]);

  useEffect(() => {
    loadProduct();
    return () => {
      abortRef.current?.abort();
      /* Fix #3: clear pending fav sync on unmount */
      clearTimeout(favTimerRef.current);
    };
  }, [loadProduct]);

  /* ═══════════════════════════════════════════════════════════
     FETCH — SECONDARY DATA
     Fix #1: depend on full `product` object, not individual fields
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!product?.id) return;

    const { id, seller_id, category_id } = product;

    /* Fix #4: filter out falsy values before passing to allSettled */
    const fetches = [
      seller_id &&
        fetch(
          `${API}/product/by-seller?${new URLSearchParams({
            seller_id,
            exclude : id,
            limit   : "8",
          })}`
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setMoreSeller(Array.isArray(d) ? d : [])),

      category_id &&
        fetch(
          `${API}/product/similar?${new URLSearchParams({
            category_id,
            exclude : id,
            limit   : "8",
          })}`
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setSimilar(Array.isArray(d) ? d : [])),

    ].filter(Boolean); // Fix #4

    Promise.allSettled(fetches).catch(() => {});
  }, [product]); // Fix #1

  /* ═══════════════════════════════════════════════════════════
     FETCH — REVIEWS
     Fix #5: reset review state when slug changes
  ═══════════════════════════════════════════════════════════ */

  /* Fix #5: wipe review state whenever the slug (product) changes */
  useEffect(() => {
    setReviews([]);
    setReviewPage(1);
    setReviewStats(null);
    setReviewTotal(0);
  }, [slug]);

  const loadReviews = useCallback(
    async (page = 1) => {
      if (!slug) return;
      try {
        const res = await fetch(
          `${API}/product/slug/${encodeURIComponent(slug)}/reviews` +
            `?limit=${REVIEWS_LIMIT}&page=${page}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setReviews((prev) =>
          page === 1
            ? data.reviews || []
            : [...prev, ...(data.reviews || [])]
        );
        if (data.stats) {
          setReviewStats(data.stats);
          setReviewTotal(data.stats.total || 0);
        }
      } catch {}
    },
    [slug]
  );

  useEffect(() => { loadReviews(1); }, [loadReviews]);

  /* ═══════════════════════════════════════════════════════════
     ACTIONS
  ═══════════════════════════════════════════════════════════ */

  /* ── Favourite ──────────────────────────────────────────── */
  const toggleFav = useCallback(() => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);

    /* Optimistic local update */
    const favs = loadFavs();
    if (next) favs[product.id] = true;
    else      delete favs[product.id];
    saveFavs(favs);

    if (!userId) return;

    clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => {
      fetch(`${API}/product/products/${product.id}/favorite`, {
        method  : "POST",
        headers : { "Content-Type": "application/json", ...authH() },
        body    : JSON.stringify({ user_id: userId }),
      }).catch(() => {
        /* Fix #2: rollback — revert to the state BEFORE the toggle */
        setFav(!next);
        const rollback = loadFavs();
        if (next) {
          /* We tried to ADD (next=true) → revert = remove */
          delete rollback[product.id];
        } else {
          /* We tried to REMOVE (next=false) → revert = restore */
          rollback[product.id] = true;
        }
        saveFavs(rollback);
      });
    }, FAV_DEBOUNCE);
  }, [fav, product, userId]);

  /* ── WhatsApp ───────────────────────────────────────────── */
  const openWhatsApp = useCallback(() => {
    if (!product) return;
    /* Fix #10: owner should not contact themselves */
    if (isOwn) return;

    fetch(`${API}/product/products/${product.id}/click`, {
      method: "POST",
    }).catch(() => {});

    const waNumber = product.whatsapp || product.contact?.whatsapp;
    const waLink   = product.whatsapp_link || product.contact?.whatsapp_link;
    const msg      = encodeURIComponent(
      `Hi, I'm interested in: ${product.title} — ${window.location.href}`
    );
    const url =
      waLink ||
      (waNumber
        ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${msg}`
        : null);

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      /* Fix #6: surface the failure instead of silently doing nothing */
      showToast("No WhatsApp contact available for this seller.", "info");
    }
  }, [product, isOwn, showToast]);

  /* ── Call ───────────────────────────────────────────────── */
  const openCall = useCallback(() => {
    /* Fix #10: owner should not call themselves */
    if (isOwn) return;

    const phone = product?.phone || product?.contact?.phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      /* Fix #6: surface missing phone */
      showToast("No phone number available for this seller.", "info");
    }
  }, [product, isOwn, showToast]);

  /* ── Chat ───────────────────────────────────────────────── */
  const openChat = useCallback(async () => {
    if (!userId) {
      navigate(`/auth?redirect=/product/${encodeURIComponent(slug)}`);
      return;
    }
    if (isOwn || !product?.seller_id) return;

    setChatBusy(true);
    setToast(null);

    try {
      const res = await fetch(`${API}/conversations`, {
        method  : "POST",
        headers : { "Content-Type": "application/json", ...authH() },
        body    : JSON.stringify({
          buyerId   : userId,
          sellerId  : product.seller_id,
          productId : product.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Server error");
      const threadId = data.thread_id || data.id;
      if (!threadId) throw new Error("No thread ID returned");
      navigate(`/chat/${threadId}`);
    } catch (err) {
      showToast(err.message || "Could not open chat. Please try again.");
    } finally {
      setChatBusy(false);
    }
  }, [userId, isOwn, product, slug, navigate, showToast]);

  /* ── Navigation ─────────────────────────────────────────── */
  const goProduct = useCallback(
    (p) => navigate(`/product/${p.slug || p.id}`),
    [navigate]
  );

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="pd-page" role="main">
        <div className="pd-error-wrap" role="alert">
          <span className="pd-error-emoji" aria-hidden="true">🔍</span>
          <h2 className="pd-error-title">{error}</h2>
          <p className="pd-error-sub">
            This listing may have been removed or the link is incorrect.
          </p>
          <Link to="/" className="pd-error-btn">Browse Marketplace</Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="pd-page" role="main">

      {/* ── Toast (chat errors, missing contact info) ────────
          Fix #6: single Toast replaces ChatErrorToast        */}
      <Toast
        message={toast?.message}
        type={toast?.type}
        onDismiss={dismissToast}
      />

      {/* ── Back + Share bar ─────────────────────────────── */}
      <div className="pd-topbar">
        <button
          className="pd-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          ← Back
        </button>
        <ShareButton product={product} />
      </div>

      {/* ── Trial expiry banner (own listings only) ──────── */}
      <ExpiryBanner product={product} isOwn={isOwn} />

      {/* ── Image gallery ────────────────────────────────── */}
      <ImageGallery images={product.images} title={product.title} />

      {/* ── Title block ──────────────────────────────────── */}
      <div className="pd-title-block">
        {product.category_name && (
          <p className="pd-breadcrumb" aria-label="Category">
            {product.category_name}
            {product.subcategory_name && (
              <> › {product.subcategory_name}</>
            )}
          </p>
        )}

        <h1 className="pd-title">{product.title}</h1>

        <div className="pd-title-actions">
          <button
            className={`pd-fav-btn${fav ? " pd-fav-btn--active" : ""}`}
            onClick={toggleFav}
            aria-label={fav ? "Remove from favourites" : "Add to favourites"}
            aria-pressed={fav}
          >
            {fav ? "♥ Saved" : "♡ Save"}
          </button>

          {isOwn && (
            <button
              className="pd-edit-btn"
              onClick={() => navigate(`/listings/edit/${product.id}`)}
              aria-label="Edit this listing"
            >
              Edit Listing
            </button>
          )}
        </div>

        <PriceBlock
          price={product.price}
          original_price={product.original_price}
          discount_percent={product.discount_percent}
          currency={product.currency}
          negotiable={product.negotiable}
        />

        <MetaBadges product={product} />
      </div>

      {/* ── Contact strip ────────────────────────────────── */}
      <ContactStrip
        product={product}
        userId={userId}
        isOwn={isOwn}
        chatBusy={chatBusy}
        onChat={openChat}
        onWhatsApp={openWhatsApp}
        onCall={openCall}
      />

      {/* ── Rich content sections ────────────────────────── */}
      <Description    text={product.description}            />
      <Features       features={product.features}           />
      <Highlights     highlights={product.highlights}       />
      <Specifications specifications={product.specifications} />
      <Attributes     attributes={product.attributes}       />
      <DeliveryInfo   delivery={product.delivery}           />
      <FAQ            faq={product.faq}                     />

      {/* ── Seller card ──────────────────────────────────── */}
      <SellerCard
        product={product}
        onNavigate={() => navigate(`/seller/${product.seller_id}`)}
      />

      {/* ── Reviews ──────────────────────────────────────── */}
      {/* Fix #12: ReviewSection must key each review by review.id */}
      <ReviewSection
        slug={slug}
        userId={userId}
        reviews={reviews}
        reviewStats={reviewStats}
        reviewTotal={reviewTotal}
        reviewPage={reviewPage}
        onLoadMore={() => {
          const next = reviewPage + 1;
          setReviewPage(next);
          loadReviews(next);
        }}
        onReviewDone={() => {
          setReviewPage(1);
          loadReviews(1);
        }}
      />

      {/* ── Safety tips ──────────────────────────────────── */}
      <SafetyTips />

      {/* ── More from seller ─────────────────────────────── */}
      <MoreFromSeller
        products={moreSeller}
        seller={{
          name  : product.seller_store || product.seller_name,
          image : product.seller_image,
        }}
        sellerId={product.seller_id}
        onProductClick={goProduct}
      />

      {/* ── Similar products ─────────────────────────────── */}
      <SimilarProducts
        products={similar}
        onProductClick={goProduct}
      />

    </div>
  );
}