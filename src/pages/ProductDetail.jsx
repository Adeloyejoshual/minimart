/**
 * src/pages/ProductDetail.jsx — v2
 * Route: /product/:slug
 *
 * Changes from v1:
 *  ─ All product sections rendered directly (no black-box ProductHeader)
 *  ─ Image gallery with thumbnail strip
 *  ─ Features, Specifications, Highlights, FAQ, Delivery all shown
 *  ─ Condition, Brand, Model, Negotiable badge
 *  ─ Seller info from joined data (no extra fetch needed)
 *  ─ Price with discount if original_price exists
 *  ─ Trial listing expiry banner
 *  ─ Share button with Web Share API
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

import ContactStrip   from "./ProductDetail/ContactStrip";
import ReviewSection  from "./ProductDetail/Review";
import SafetyTips     from "./ProductDetail/SafetyTips";
import SimilarProducts from "./ProductDetail/SimilarProducts";
import MoreFromSeller from "./ProductDetail/MoreFromSeller";

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
   SKELETON
═══════════════════════════════════════════════════════════════ */
const Skeleton = memo(function Skeleton() {
  return (
    <div className="pd-page" aria-busy="true" aria-label="Loading product">
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
   Shows large image + thumbnail strip if multiple images
═══════════════════════════════════════════════════════════════ */
const ImageGallery = memo(function ImageGallery({ images, title }) {
  const [active, setActive] = useState(0);

  /* images is array of { url, order } from backend */
  const urls = useMemo(() => {
    if (Array.isArray(images) && images.length > 0) {
      return images.map((img) => (typeof img === "string" ? img : img.url));
    }
    return [];
  }, [images]);

  if (!urls.length) {
    return (
      <div className="pd-gallery-empty" aria-label="No image available">
        <span>📷</span>
      </div>
    );
  }

  const prev = () => setActive((i) => (i - 1 + urls.length) % urls.length);
  const next = () => setActive((i) => (i + 1) % urls.length);

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
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f0f0f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";
          }}
        />

        {/* Prev / Next arrows */}
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

            {/* Dot indicators */}
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
          </>
        )}

        {/* Counter badge */}
        {urls.length > 1 && (
          <span className="pd-gallery-counter" aria-hidden="true">
            {active + 1} / {urls.length}
          </span>
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
          <span className="pd-price-original" aria-label={`Original price: ${symbol}${fmt(original_price)}`}>
            {symbol}{fmt(original_price)}
          </span>
          {discount_percent > 0 && (
            <span className="pd-price-discount" aria-label={`${discount_percent}% off`}>
              -{discount_percent}%
            </span>
          )}
        </>
      )}

      {negotiable && (
        <span className="pd-badge pd-badge--negotiable" aria-label="Price is negotiable">
          Negotiable
        </span>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   META BADGES  (condition, brand, model, location)
═══════════════════════════════════════════════════════════════ */
const MetaBadges = memo(function MetaBadges({ product }) {
  const items = [
    product.condition     && { label: "Condition", value: product.condition },
    product.brand         && { label: "Brand",     value: product.brand     },
    product.model         && { label: "Model",     value: product.model     },
    (product.location_city || product.location_state) && {
      label: "Location",
      value: [product.location_city, product.location_state]
        .filter(Boolean)
        .join(", "),
    },
    product.category_name && {
      label: "Category",
      value: product.subcategory_name
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
   FEATURES  — array of strings
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
   SPECIFICATIONS  — array of { label, value }
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
   HIGHLIGHTS  — array of strings
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
   FAQ  — array of { question, answer }
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
═══════════════════════════════════════════════════════════════ */
const DeliveryInfo = memo(function DeliveryInfo({ delivery }) {
  if (!delivery || typeof delivery !== "object") return null;

  const rows = Object.entries(delivery).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ""
  );

  if (!rows.length) return null;

  /* Pretty-print keys */
  const prettify = (k) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <section className="pd-section" aria-label="Delivery information">
      <h3 className="pd-section-h">Delivery &amp; Shipping</h3>
      <div className="pd-delivery-grid">
        {rows.map(([k, v]) => (
          <div key={k} className="pd-delivery-row">
            <span className="pd-delivery-label">{prettify(k)}</span>
            <span className="pd-delivery-value">{String(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ATTRIBUTES  — raw JSONB object catch-all
   Shows any attributes not already shown in specifications
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
  /* seller info is now joined from backend — no separate state needed */
  const name   = product.seller_store || product.seller_name || "Seller";
  const avatar = product.seller_image || null;
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
        {/* Avatar */}
        <div className="pd-seller-avatar">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          {online && (
            <span
              className="pd-seller-online"
              aria-label="Seller is online"
            />
          )}
        </div>

        {/* Info */}
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
            <div
              className="pd-trust"
              aria-label={`Trust score: ${trust}%`}
            >
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

        {/* Chevron */}
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
   EXPIRY BANNER  — shown for trial listings
═══════════════════════════════════════════════════════════════ */
const ExpiryBanner = memo(function ExpiryBanner({ product, isOwn }) {
  if (!isOwn)              return null;
  if (!product.active_until) return null;
  if (!product.is_trial)   return null;

  const days = product.days_remaining ?? 0;

  return (
    <div
      className={`pd-expiry-banner ${days <= 3 ? "pd-expiry-banner--urgent" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">⏳</span>
      {days > 0
        ? `Trial listing — expires in ${days} day${days !== 1 ? "s" : ""}. Verify your identity to post permanently.`
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
        /* Track share */
        fetch(`${API}/product/products/${product.id}/share`, {
          method: "POST",
        }).catch(() => {});
      } catch {
        /* User cancelled share — not an error */
      }
    } else {
      /* Fallback — copy to clipboard */
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
   CHAT ERROR TOAST
═══════════════════════════════════════════════════════════════ */
const ChatErrorToast = memo(function ChatErrorToast({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      className="pd-toast pd-toast--error"
      role="alert"
      aria-live="assertive"
    >
      <span>{message}</span>
      <button
        className="pd-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss error"
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

  /* ── state ── */
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
  const [chatError,   setChatError]   = useState(null);

  /* ── refs ── */
  const favTimerRef = useRef(null);
  const abortRef    = useRef(null);

  /* ── derived ── */
  const userId = useMemo(() => user?.id || readUserId(), [user]);

  const isOwn = useMemo(
    () => !!(userId && product?.seller_id && userId === String(product.seller_id)),
    [userId, product?.seller_id]
  );

  /* ═══════════════════════════════════════════════════════════
     FETCH — PRIMARY PRODUCT
     Backend now joins seller info — no separate seller fetch needed
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
    return () => abortRef.current?.abort();
  }, [loadProduct]);

  /* ═══════════════════════════════════════════════════════════
     FETCH — SECONDARY DATA
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!product?.id) return;

    const { id, seller_id, category_id } = product;

    Promise.allSettled([

      /* View already tracked server-side in /slug/:slug — skip here */

      /* More from seller */
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

      /* Similar products */
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

    ]).catch(() => {});
  }, [product?.id, product?.seller_id, product?.category_id]);

  /* ═══════════════════════════════════════════════════════════
     FETCH — REVIEWS
  ═══════════════════════════════════════════════════════════ */
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
  const toggleFav = useCallback(() => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);

    const favs = loadFavs();
    if (next) favs[product.id] = true;
    else      delete favs[product.id];
    saveFavs(favs);

    if (!userId) return;

    clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => {
      fetch(`${API}/product/products/${product.id}/favorite`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ user_id: userId }),
      }).catch(() => {
        setFav(!next);
        const rollback = loadFavs();
        if (!next) rollback[product.id] = true;
        else       delete rollback[product.id];
        saveFavs(rollback);
      });
    }, FAV_DEBOUNCE);
  }, [fav, product, userId]);

  const openWhatsApp = useCallback(() => {
    if (!product) return;
    fetch(`${API}/product/products/${product.id}/click`, { method: "POST" })
      .catch(() => {});

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

    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, [product]);

  const openCall = useCallback(() => {
    const phone = product?.phone || product?.contact?.phone;
    if (phone) window.location.href = `tel:${phone}`;
  }, [product]);

  const openChat = useCallback(async () => {
    if (!userId) {
      navigate(`/auth?redirect=/product/${encodeURIComponent(slug)}`);
      return;
    }
    if (isOwn || !product?.seller_id) return;

    setChatBusy(true);
    setChatError(null);

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
      setChatError(err.message || "Could not open chat. Please try again.");
    } finally {
      setChatBusy(false);
    }
  }, [userId, isOwn, product, slug, navigate]);

  const goProduct = useCallback(
    (p) => navigate(`/product/${p.slug || p.id}`),
    [navigate]
  );

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  if (loading) return <Skeleton />;

  if (error)
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

  if (!product) return null;

  return (
    <div className="pd-page" role="main">

      {/* ── Toast ───────────────────────────────────────────── */}
      <ChatErrorToast
        message={chatError}
        onDismiss={() => setChatError(null)}
      />

      {/* ── Back + Share bar ────────────────────────────────── */}
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

      {/* ── Trial expiry banner (own listings only) ──────────  */}
      <ExpiryBanner product={product} isOwn={isOwn} />

      {/* ── Image gallery ───────────────────────────────────── */}
      <ImageGallery images={product.images} title={product.title} />

      {/* ── Title + Price ───────────────────────────────────── */}
      <div className="pd-title-block">
        {/* Category breadcrumb */}
        {product.category_name && (
          <p className="pd-breadcrumb" aria-label="Category">
            {product.category_name}
            {product.subcategory_name && (
              <> › {product.subcategory_name}</>
            )}
          </p>
        )}

        <h1 className="pd-title">{product.title}</h1>

        {/* Favourite + Edit row */}
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

        {/* Price */}
        <PriceBlock
          price={product.price}
          original_price={product.original_price}
          discount_percent={product.discount_percent}
          currency={product.currency}
          negotiable={product.negotiable}
        />

        {/* Meta badges — condition, brand, location, category */}
        <MetaBadges product={product} />
      </div>

      {/* ── Contact buttons ─────────────────────────────────── */}
      <ContactStrip
        product={product}
        userId={userId}
        isOwn={isOwn}
        chatBusy={chatBusy}
        onChat={openChat}
        onWhatsApp={openWhatsApp}
        onCall={openCall}
      />

      {/* ── Description ─────────────────────────────────────── */}
      <Description text={product.description} />

      {/* ── Features ────────────────────────────────────────── */}
      <Features features={product.features} />

      {/* ── Highlights ──────────────────────────────────────── */}
      <Highlights highlights={product.highlights} />

      {/* ── Specifications ──────────────────────────────────── */}
      <Specifications specifications={product.specifications} />

      {/* ── Additional attributes ───────────────────────────── */}
      <Attributes attributes={product.attributes} />

      {/* ── Delivery info ───────────────────────────────────── */}
      <DeliveryInfo delivery={product.delivery} />

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <FAQ faq={product.faq} />

      {/* ── Seller card ─────────────────────────────────────── */}
      <SellerCard
        product={product}
        onNavigate={() => navigate(`/seller/${product.seller_id}`)}
      />

      {/* ── Reviews ─────────────────────────────────────────── */}
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

      {/* ── Safety tips ─────────────────────────────────────── */}
      <SafetyTips />

      {/* ── More from seller ────────────────────────────────── */}
      <MoreFromSeller
        products={moreSeller}
        seller={{
          name  : product.seller_store || product.seller_name,
          image : product.seller_image,
        }}
        sellerId={product.seller_id}
        onProductClick={goProduct}
      />

      {/* ── Similar products ────────────────────────────────── */}
      <SimilarProducts
        products={similar}
        onProductClick={goProduct}
      />

      {/* ── Scoped styles ───────────────────────────────────── */}
      <style>{`
        /* Spinner */
        @keyframes pd-spin { to { transform: rotate(360deg); } }
        .pd-spinner {
          display: inline-block;
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: pd-spin .7s linear infinite;
        }

        /* Toast */
        .pd-toast {
          position: fixed; bottom: 20px; left: 50%;
          transform: translateX(-50%);
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          border-radius: 8px; font-size: 14px;
          box-shadow: 0 4px 16px rgba(0,0,0,.15);
          z-index: 9999; max-width: 90vw;
        }
        .pd-toast--error { background: #ff4d4f; color: #fff; }
        .pd-toast-close {
          background: none; border: none; color: inherit;
          cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px;
        }

        /* Gallery */
        .pd-gallery { width: 100%; background: #f8f8f8; }
        .pd-gallery-main { position: relative; width: 100%; aspect-ratio: 4/3; overflow: hidden; }
        .pd-gallery-img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .pd-gallery-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(0,0,0,.45); color: #fff;
          border: none; border-radius: 50%;
          width: 36px; height: 36px; font-size: 22px; line-height: 1;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        .pd-gallery-arrow--left  { left: 10px; }
        .pd-gallery-arrow--right { right: 10px; }
        .pd-gallery-dots {
          position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
          display: flex; gap: 6px;
        }
        .pd-gallery-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(255,255,255,.5); border: none; cursor: pointer; padding: 0;
        }
        .pd-gallery-dot--active { background: #fff; }
        .pd-gallery-counter {
          position: absolute; bottom: 10px; right: 12px;
          background: rgba(0,0,0,.5); color: #fff;
          font-size: 12px; padding: 2px 8px; border-radius: 999px;
        }
        .pd-gallery-thumbs {
          display: flex; gap: 6px; padding: 8px;
          overflow-x: auto; background: #fff;
        }
        .pd-gallery-thumb {
          flex-shrink: 0; width: 60px; height: 60px;
          border: 2px solid transparent; border-radius: 6px;
          overflow: hidden; cursor: pointer; padding: 0; background: #eee;
        }
        .pd-gallery-thumb--active { border-color: #2563eb; }
        .pd-gallery-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pd-gallery-empty {
          height: 200px; background: #f0f0f0;
          display: flex; align-items: center; justify-content: center;
          font-size: 48px; color: #ccc;
        }

        /* Title block */
        .pd-topbar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 16px;
        }
        .pd-back-btn {
          background: none; border: none; font-size: 15px;
          color: #2563eb; cursor: pointer; padding: 4px 0;
        }
        .pd-share-btn {
          background: none; border: 1px solid #e5e7eb;
          border-radius: 6px; padding: 6px 14px; font-size: 13px;
          cursor: pointer; color: #374151;
        }
        .pd-title-block { padding: 12px 16px 0; }
        .pd-breadcrumb { font-size: 12px; color: #6b7280; margin: 0 0 4px; }
        .pd-title { font-size: 20px; font-weight: 700; margin: 0 0 10px; line-height: 1.3; }
        .pd-title-actions { display: flex; gap: 10px; margin-bottom: 12px; }
        .pd-fav-btn {
          background: none; border: 1px solid #e5e7eb;
          border-radius: 20px; padding: 6px 16px; font-size: 14px; cursor: pointer;
        }
        .pd-fav-btn--active { background: #fff1f2; border-color: #f43f5e; color: #f43f5e; }
        .pd-edit-btn {
          background: #f3f4f6; border: none; border-radius: 20px;
          padding: 6px 16px; font-size: 14px; cursor: pointer;
        }

        /* Price */
        .pd-price-block { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .pd-price { font-size: 26px; font-weight: 800; color: #111; }
        .pd-price-original { font-size: 16px; color: #9ca3af; text-decoration: line-through; }
        .pd-price-discount {
          background: #dcfce7; color: #16a34a;
          font-size: 13px; font-weight: 600;
          padding: 2px 8px; border-radius: 999px;
        }
        .pd-badge { font-size: 12px; padding: 3px 10px; border-radius: 999px; font-weight: 600; }
        .pd-badge--negotiable { background: #fef9c3; color: #854d0e; }

        /* Meta badges */
        .pd-meta-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .pd-meta-badge {
          background: #f9fafb; border: 1px solid #e5e7eb;
          border-radius: 8px; padding: 6px 10px;
          display: flex; flex-direction: column; min-width: 90px;
        }
        .pd-meta-badge-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
        .pd-meta-badge-value { font-size: 13px; font-weight: 600; color: #111; margin-top: 2px; }

        /* Sections */
        .pd-section { padding: 16px; border-top: 1px solid #f3f4f6; }
        .pd-section-h { font-size: 16px; font-weight: 700; margin: 0 0 12px; color: #111; }

        /* Description */
        .pd-description { font-size: 14px; line-height: 1.65; color: #374151; margin: 0; }
        .pd-expand-btn {
          background: none; border: none; color: #2563eb;
          font-size: 13px; cursor: pointer; padding: 6px 0 0; display: block;
        }

        /* Features */
        .pd-features-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .pd-features-item { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: #374151; }
        .pd-features-dot { color: #16a34a; font-weight: 700; flex-shrink: 0; }

        /* Highlights */
        .pd-highlights-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .pd-highlights-item { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: #374151; }

        /* Specs */
        .pd-specs-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .pd-specs-table td, .pd-specs-table th { padding: 9px 10px; text-align: left; }
        .pd-specs-row--even td, .pd-specs-row--even th { background: #f9fafb; }
        .pd-specs-label { color: #6b7280; font-weight: 500; width: 40%; }
        .pd-specs-value { color: #111; font-weight: 600; }

        /* Attributes */
        .pd-attrs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pd-attrs-row { background: #f9fafb; border-radius: 8px; padding: 8px 10px; }
        .pd-attrs-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
        .pd-attrs-value { font-size: 13px; font-weight: 600; color: #111; }

        /* Delivery */
        .pd-delivery-grid { display: flex; flex-direction: column; gap: 8px; }
        .pd-delivery-row { display: flex; justify-content: space-between; font-size: 14px; padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
        .pd-delivery-label { color: #6b7280; }
        .pd-delivery-value { color: #111; font-weight: 600; }

        /* FAQ */
        .pd-faq { display: flex; flex-direction: column; gap: 8px; }
        .pd-faq-item { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .pd-faq-q {
          width: 100%; background: #f9fafb; border: none;
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 14px; font-size: 14px; font-weight: 600;
          color: #111; cursor: pointer; text-align: left;
        }
        .pd-faq-a { padding: 12px 14px; font-size: 14px; color: #374151; line-height: 1.6; }

        /* Seller */
        .pd-seller-card {
          display: flex; align-items: center; gap: 12px;
          padding: 12px; background: #f9fafb; border-radius: 12px; cursor: pointer;
        }
        .pd-seller-avatar {
          position: relative; width: 48px; height: 48px; flex-shrink: 0;
          border-radius: 50%; background: #e5e7eb;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 700; color: #6b7280; overflow: hidden;
        }
        .pd-seller-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .pd-seller-online {
          position: absolute; bottom: 1px; right: 1px;
          width: 10px; height: 10px; background: #22c55e;
          border-radius: 50%; border: 2px solid #fff;
        }
        .pd-seller-info { flex: 1; min-width: 0; }
        .pd-seller-name-row { display: flex; align-items: center; gap: 6px; }
        .pd-seller-name { font-size: 15px; font-weight: 700; color: #111; }
        .pd-seller-badge {
          font-size: 11px; background: #dbeafe; color: #1d4ed8;
          padding: 2px 7px; border-radius: 999px; font-weight: 600;
        }
        .pd-seller-stats { font-size: 12px; color: #6b7280; margin-top: 2px; display: flex; gap: 6px; }
        .pd-seller-chevron { color: #9ca3af; flex-shrink: 0; }
        .pd-trust { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
        .pd-trust-bar { flex: 1; height: 4px; background: #e5e7eb; border-radius: 2px; }
        .pd-trust-fill { height: 100%; background: #22c55e; border-radius: 2px; transition: width .3s; }
        .pd-trust-label { font-size: 11px; color: #6b7280; white-space: nowrap; }

        /* Expiry banner */
        .pd-expiry-banner {
          margin: 0 16px 12px; padding: 10px 14px;
          background: #fef9c3; border: 1px solid #fcd34d;
          border-radius: 8px; font-size: 13px; color: #78350f;
          display: flex; gap: 8px; align-items: flex-start;
        }
        .pd-expiry-banner--urgent {
          background: #fff1f2; border-color: #fca5a5; color: #991b1b;
        }

        /* Skeleton */
        .pd-sk-hero { height: 280px; background: #e5e7eb; animation: pd-pulse 1.5s ease-in-out infinite; }
        .pd-sk-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .pd-sk-line { background: #e5e7eb; border-radius: 6px; animation: pd-pulse 1.5s ease-in-out infinite; }
        @keyframes pd-pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

        /* Error */
        .pd-error-wrap { padding: 60px 24px; text-align: center; }
        .pd-error-emoji { font-size: 48px; display: block; margin-bottom: 16px; }
        .pd-error-title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
        .pd-error-sub { color: #6b7280; margin: 0 0 20px; }
        .pd-error-btn {
          display: inline-block; background: #2563eb; color: #fff;
          padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;
        }
      `}</style>
    </div>
  );
}