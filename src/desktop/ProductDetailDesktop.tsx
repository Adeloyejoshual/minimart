/**
 * src/desktop/ProductDetailDesktop.jsx
 *
 * v3 — COMPLETE REWRITE
 * ─────────────────────────────────────────────────────────────
 *  - Stock status removed entirely
 *  - Phone/WhatsApp optional — no toasts for missing contacts
 *  - ContactStrip only shows available contact methods
 *  - Clean professional layout
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │ Breadcrumb                                   │
 *   ├──────────────────────┬──────────────────────┤
 *   │ Gallery              │ Title + Price + Meta  │
 *   │                      │ Contact (sticky)      │
 *   ├──────────────────────┼──────────────────────┤
 *   │ Tabs: Desc/Specs/Rev │ Safety + Seller card  │
 *   ├──────────────────────┴──────────────────────┤
 *   │ More from Seller                             │
 *   │ Similar Products                             │
 *   └─────────────────────────────────────────────┘
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

/* ── Sub-components ───────────────────────────────────────── */
import SafetyTips      from "../pages/ProductDetail/SafetyTips";
import MoreFromSeller  from "../pages/ProductDetail/MoreFromSeller";
import SimilarProducts from "../pages/ProductDetail/SimilarProducts";
import ContactStrip    from "../pages/ProductDetail/ContactStrip";
import ReviewSection   from "../pages/ProductDetail/Review";

import "./ProductDetailDesktop.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const BASE_URL      =
  import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API           = `${BASE_URL}/api`;
const FAV_KEY       = "loemart_favs";
const REVIEWS_LIMIT = 5;
const FAV_DEBOUNCE  = 400;

/* ═══════════════════════════════════════════════════════════════
   AUTH HELPERS
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authHeaders = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const decodeJWT = (token) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
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
   FAVOURITES
═══════════════════════════════════════════════════════════════ */
const loadFavs = () => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveFavs = (f) => {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(f));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   FORMAT HELPERS
═══════════════════════════════════════════════════════════════ */
const fmt = (n) =>
  "₦" +
  Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
  });

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor(
    (Date.now() - new Date(d).getTime()) / 1_000
  );
  if (s < 3_600)     return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400)    return `${Math.floor(s / 3_600)}h ago`;
  if (s < 2_592_000) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short",
    year : "numeric",
  });
};

const compactNum = (n) => {
  const num = Number(n) || 0;
  if (num >= 1_000_000)
    return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)
    return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};

const onEnter = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") fn();
};

const prettify = (k) =>
  String(k)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatDeliveryValue = (v) => {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
};

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
const DesktopSkeleton = memo(function DesktopSkeleton() {
  return (
    <div
      className="pdd-page pdd-page--loading"
      aria-busy="true"
      aria-label="Loading product"
    >
      <div className="pdd-sk-breadcrumb" />
      <div className="pdd-sk-body">
        <div className="pdd-sk-gallery" />
        <div className="pdd-sk-panel">
          {[
            { w: "40%",  h: 14, mt: 0  },
            { w: "80%",  h: 32, mt: 12 },
            { w: "30%",  h: 40, mt: 16 },
            { w: "100%", h: 56, mt: 24, r: 10 },
            { w: "100%", h: 56, mt: 8,  r: 10 },
            { w: "100%", h: 56, mt: 8,  r: 10 },
          ].map(({ w, h, mt, r }, i) => (
            <div
              key={i}
              className="pdd-sk-line"
              style={{
                width    : w,
                height   : h,
                marginTop: mt,
                ...(r ? { borderRadius: r } : {}),
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   BREADCRUMB
═══════════════════════════════════════════════════════════════ */
const Breadcrumb = memo(function Breadcrumb({
  title,
  category,
  subcategory,
}) {
  return (
    <nav className="pdd-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><Link to="/">Home</Link></li>
        <li aria-hidden="true">›</li>

        {category && (
          <>
            <li>
              <Link
                to={`/?category=${encodeURIComponent(
                  category
                )}`}
              >
                {category}
              </Link>
            </li>
            <li aria-hidden="true">›</li>
          </>
        )}

        {subcategory && (
          <>
            <li><span>{subcategory}</span></li>
            <li aria-hidden="true">›</li>
          </>
        )}

        <li aria-current="page">
          <span>
            {title
              ? title.length > 50
                ? `${title.slice(0, 50)}…`
                : title
              : "Product"}
          </span>
        </li>
      </ol>
    </nav>
  );
});

/* ═══════════════════════════════════════════════════════════════
   GALLERY — desktop with side thumbnails
═══════════════════════════════════════════════════════════════ */
const DesktopGallery = memo(function DesktopGallery({
  images,
  title,
  slug,
}) {
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  const urls = useMemo(() => {
    if (!Array.isArray(images) || !images.length) return [];
    return images
      .map((img) =>
        typeof img === "string" ? img : img?.url
      )
      .filter(Boolean);
  }, [images]);

  useEffect(() => {
    setActive(0);
    setLoaded(false);
  }, [urls]);

  const openViewer = useCallback(() => {
    if (slug && urls.length) {
      navigate(`/product/${slug}/images`, {
        state: {
          images    : urls,
          startIndex: active,
          title,
        },
      });
    }
  }, [slug, urls, active, title, navigate]);

  if (!urls.length) {
    return (
      <div className="pdd-gallery-empty">
        <svg
          width="48" height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span>No photos available</span>
      </div>
    );
  }

  return (
    <div className="pdd-gallery">
      {/* Side thumbnails */}
      {urls.length > 1 && (
        <div className="pdd-gallery-thumbs">
          {urls.map((url, i) => (
            <button
              key={i}
              className={
                `pdd-gallery-thumb` +
                (i === active
                  ? " pdd-gallery-thumb--active"
                  : "")
              }
              onClick={() => {
                setLoaded(false);
                setActive(i);
              }}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === active}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.opacity = "0.25";
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Main image */}
      <div
        className="pdd-gallery-main"
        onClick={openViewer}
        role="button"
        tabIndex={0}
        aria-label="View full image"
        onKeyDown={(e) => {
          if (e.key === "Enter") openViewer();
        }}
      >
        {!loaded && (
          <div className="pdd-gallery-shimmer" />
        )}

        <img
          key={urls[active]}
          src={urls[active]}
          alt={`${title} — photo ${active + 1}`}
          className={
            `pdd-gallery-img` +
            (loaded ? " pdd-gallery-img--loaded" : "")
          }
          loading="eager"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            e.currentTarget.src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' " +
              "width='400' height='300'%3E%3Crect fill='%23f3f4f6' " +
              "width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' " +
              "dominant-baseline='middle' text-anchor='middle' " +
              "fill='%23999' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";
            setLoaded(true);
          }}
        />

        {/* Expand icon */}
        <div
          className="pdd-gallery-expand"
          aria-hidden="true"
        >
          <svg
            width="16" height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
        </div>

        {/* Counter */}
        {urls.length > 1 && (
          <span className="pdd-gallery-counter">
            {active + 1}/{urls.length}
          </span>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   META BADGES
   ✅ No stock badge
═══════════════════════════════════════════════════════════════ */
const MetaBadges = memo(function MetaBadges({ product }) {
  const items = [
    product.condition && {
      label: "Condition",
      value: product.condition,
    },
    product.brand && {
      label: "Brand",
      value: product.brand,
    },
    product.model && {
      label: "Model",
      value: product.model,
    },
    (product.location_city || product.location_state) && {
      label: "Location",
      value: [
        product.location_city,
        product.location_state,
      ]
        .filter(Boolean)
        .join(", "),
    },
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div className="pdd-meta-badges">
      {items.map(({ label, value }) => (
        <div key={label} className="pdd-meta-badge">
          <span className="pdd-meta-badge-label">
            {label}
          </span>
          <span className="pdd-meta-badge-value">
            {value}
          </span>
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
  if (!text?.trim()) return null;

  const LIMIT  = 500;
  const isLong = text.length > LIMIT;
  const shown  =
    !isLong || expanded ? text : `${text.slice(0, LIMIT)}…`;

  return (
    <section
      className="pdd-tab-section"
      aria-label="Description"
    >
      <h3 className="pdd-tab-section-h">Description</h3>
      <p className="pdd-description">{shown}</p>
      {isLong && (
        <button
          className="pdd-expand-btn"
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
    <section className="pdd-tab-section" aria-label="Features">
      <h3 className="pdd-tab-section-h">Features</h3>
      <ul className="pdd-features-list">
        {features.map((f, i) => (
          <li key={i} className="pdd-features-item">
            <span
              className="pdd-features-dot"
              aria-hidden="true"
            >
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   HIGHLIGHTS
═══════════════════════════════════════════════════════════════ */
const Highlights = memo(function Highlights({ highlights }) {
  if (!Array.isArray(highlights) || !highlights.length)
    return null;
  return (
    <section
      className="pdd-tab-section"
      aria-label="Highlights"
    >
      <h3 className="pdd-tab-section-h">Highlights</h3>
      <ul className="pdd-highlights-list">
        {highlights.map((h, i) => (
          <li key={i} className="pdd-highlights-item">
            <span aria-hidden="true">⚡</span>
            {h}
          </li>
        ))}
      </ul>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SPECIFICATIONS
═══════════════════════════════════════════════════════════════ */
const Specifications = memo(function Specifications({
  specifications,
}) {
  if (!Array.isArray(specifications) || !specifications.length)
    return null;
  return (
    <section
      className="pdd-tab-section"
      aria-label="Specifications"
    >
      <h3 className="pdd-tab-section-h">Specifications</h3>
      <table className="pdd-specs-table">
        <tbody>
          {specifications.map(({ label, value }, i) => (
            <tr
              key={i}
              className={
                i % 2 === 0 ? "pdd-specs-row--even" : ""
              }
            >
              <th
                className="pdd-specs-label"
                scope="row"
              >
                {label}
              </th>
              <td className="pdd-specs-value">
                {String(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ATTRIBUTES
═══════════════════════════════════════════════════════════════ */
const Attributes = memo(function Attributes({ attributes }) {
  if (!attributes || typeof attributes !== "object") return null;

  const rows = Object.entries(attributes).filter(
    ([k, v]) =>
      k !== "features" &&
      v !== null       &&
      v !== undefined  &&
      String(v).trim() !== ""
  );
  if (!rows.length) return null;

  return (
    <section
      className="pdd-tab-section"
      aria-label="Additional details"
    >
      <h3 className="pdd-tab-section-h">Additional Details</h3>
      <div className="pdd-attrs-grid">
        {rows.map(([k, v]) => (
          <div key={k} className="pdd-attrs-row">
            <span className="pdd-attrs-label">
              {prettify(k)}
            </span>
            <span className="pdd-attrs-value">{String(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   DELIVERY
═══════════════════════════════════════════════════════════════ */
const DeliveryInfo = memo(function DeliveryInfo({ delivery }) {
  if (!delivery || typeof delivery !== "object") return null;

  const available =
    delivery.available === true ||
    delivery.available === "Yes";

  const rows = Object.entries(delivery).filter(
    ([key, value]) => {
      if (value == null || String(value).trim() === "")
        return false;
      if (key === "duration" && !available) return false;
      if (typeof value === "object") return false;
      return true;
    }
  );
  if (!rows.length) return null;

  return (
    <section className="pdd-tab-section" aria-label="Delivery">
      <h3 className="pdd-tab-section-h">
        Delivery &amp; Shipping
      </h3>
      <div className="pdd-delivery-grid">
        {rows.map(([k, v]) => (
          <div key={k} className="pdd-delivery-row">
            <span className="pdd-delivery-label">
              {prettify(k)}
            </span>
            <span className="pdd-delivery-value">
              {formatDeliveryValue(v)}
            </span>
          </div>
        ))}
      </div>
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
    <section className="pdd-tab-section" aria-label="FAQ">
      <h3 className="pdd-tab-section-h">FAQ</h3>
      <div className="pdd-faq">
        {faq.map((item, i) => {
          const isOpen   = openIdx === i;
          const question = item.question || item.q || "";
          const answer   = item.answer   || item.a || "";
          return (
            <div key={i} className="pdd-faq-item">
              <button
                className="pdd-faq-q"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`pdd-faq-a-${i}`}
              >
                <span>{question}</span>
                <span aria-hidden="true">
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>
              {isOpen && (
                <div
                  id={`pdd-faq-a-${i}`}
                  className="pdd-faq-a"
                  role="region"
                  aria-label={question}
                >
                  {answer}
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
   SELLER CARD — desktop sidebar
═══════════════════════════════════════════════════════════════ */
const DesktopSellerCard = memo(function DesktopSellerCard({
  product,
  onNavigate,
}) {
  if (!product?.seller_id) return null;

  const name     =
    product.seller_store ||
    product.seller_name  || "Seller";
  const avatar   = product.seller_image  ?? null;
  const verified = product.seller_verified;
  const trust    = product.seller_trust;
  const rating   = product.seller_rating;
  const online   = product.seller_online;

  return (
    <div className="pdd-seller-card">
      <h4 className="pdd-seller-card-h">Seller</h4>

      <div
        className="pdd-seller-card-body"
        onClick={onNavigate}
        role="button"
        tabIndex={0}
        aria-label={`View profile for ${name}`}
        onKeyDown={onEnter(onNavigate)}
      >
        <div className="pdd-seller-avatar">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          {online && (
            <span
              className="pdd-seller-online"
              aria-label="Currently online"
            />
          )}
        </div>

        <div className="pdd-seller-info">
          <div className="pdd-seller-name-row">
            <span className="pdd-seller-name">{name}</span>
            {verified && (
              <span className="pdd-seller-badge">
                ✔ Verified
              </span>
            )}
          </div>
          {rating > 0 && (
            <div className="pdd-seller-rating">
              {Number(rating).toFixed(1)}★
            </div>
          )}
          {trust != null && (
            <div className="pdd-seller-trust">
              <div className="pdd-seller-trust-bar">
                <div
                  className="pdd-seller-trust-fill"
                  style={{
                    width: `${Math.min(
                      100, Number(trust)
                    )}%`,
                  }}
                />
              </div>
              <span className="pdd-seller-trust-label">
                {trust}% trust
              </span>
            </div>
          )}
        </div>

        <span
          className="pdd-seller-chevron"
          aria-hidden="true"
        >
          ›
        </span>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   TABS — Description | Details | Reviews
═══════════════════════════════════════════════════════════════ */
const TABS = [
  { id: "description", label: "Description" },
  { id: "details",     label: "Details"     },
  { id: "reviews",     label: "Reviews"     },
];

const ProductTabs = memo(function ProductTabs({
  product,
  slug,
  userId,
  reviews,
  reviewStats,
  reviewTotal,
  reviewPage,
  onLoadMore,
  onReviewDone,
}) {
  const [activeTab, setActiveTab] = useState("description");

  return (
    <div className="pdd-tabs">
      {/* Tab buttons */}
      <div className="pdd-tabs-bar" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            className={
              `pdd-tab-btn` +
              (activeTab === tab.id
                ? " pdd-tab-btn--active"
                : "")
            }
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            aria-controls={`pdd-panel-${tab.id}`}
          >
            {tab.label}
            {tab.id === "reviews" && reviewTotal > 0 && (
              <span className="pdd-tab-badge">
                {reviewTotal}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="pdd-tabs-content">

        {activeTab === "description" && (
          <div
            id="pdd-panel-description"
            role="tabpanel"
          >
            <Description text={product.description}    />
            <Features    features={product.features}   />
            <Highlights  highlights={product.highlights} />
            <DeliveryInfo delivery={product.delivery}  />
            <FAQ         faq={product.faq}             />
          </div>
        )}

        {activeTab === "details" && (
          <div id="pdd-panel-details" role="tabpanel">
            <Specifications
              specifications={product.specifications}
            />
            <Attributes attributes={product.attributes} />
          </div>
        )}

        {activeTab === "reviews" && (
          <div id="pdd-panel-reviews" role="tabpanel">
            <ReviewSection
              slug={slug}
              userId={userId}
              reviews={reviews}
              reviewStats={reviewStats}
              reviewTotal={reviewTotal}
              reviewPage={reviewPage}
              onLoadMore={onLoadMore}
              onReviewDone={onReviewDone}
            />
          </div>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
const Toast = memo(function Toast({
  message,
  type = "error",
  onDismiss,
}) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, 4_000);
    return () => clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`pdd-toast pdd-toast--${type}`}
      role="alert"
      aria-live="assertive"
    >
      <span>{message}</span>
      <button
        className="pdd-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN DESKTOP COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ProductDetailDesktop({ user }) {
  const { slug }             = useParams();
  const navigate             = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── State ──────────────────────────────────────────── */
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
  const [toast,       setToast]       = useState(null);

  /* ── Refs ───────────────────────────────────────────── */
  const favTimerRef = useRef(null);
  const abortRef    = useRef(null);

  /* ── Derived ────────────────────────────────────────── */
  const userId = useMemo(
    () => (user?.id ? String(user.id) : readUserId()),
    [user]
  );

  const isOwn = useMemo(
    () =>
      !!(
        userId             &&
        product?.seller_id &&
        userId === String(product.seller_id)
      ),
    [userId, product?.seller_id]
  );

  const showToast = useCallback(
    (message, type = "error") => setToast({ message, type }),
    []
  );
  const dismissToast = useCallback(() => setToast(null), []);

  /* ═════════════════════════════════════════════════════
     FETCH — PRODUCT
  ═════════════════════════════════════════════════════ */
  const loadProduct = useCallback(async () => {
    if (!slug || slug === "undefined") {
      setError("Invalid product link.");
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}`,
        { signal: controller.signal }
      );
      if (res.status === 404)
        throw new Error("Product not found");
      if (!res.ok)
        throw new Error("Could not load product");

      const data = await res.json();
      setProduct(data);
      addSingleProduct?.(data);
      setFav(!!loadFavs()[data.id]);
    } catch (err) {
      if (err.name !== "AbortError")
        setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [slug, addSingleProduct]);

  useEffect(() => {
    loadProduct();
    return () => {
      abortRef.current?.abort();
      clearTimeout(favTimerRef.current);
    };
  }, [loadProduct]);

  /* ═════════════════════════════════════════════════════
     FETCH — SECONDARY
  ═════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!product?.id) return;
    const { id, seller_id, category_id } = product;

    const jobs = [
      seller_id &&
        fetch(
          `${API}/product/by-seller?${new URLSearchParams({
            seller_id,
            exclude: id,
            limit  : "8",
          })}`
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((d) =>
            setMoreSeller(Array.isArray(d) ? d : [])
          )
          .catch(() => {}),

      category_id &&
        fetch(
          `${API}/product/similar?${new URLSearchParams({
            category_id,
            exclude: id,
            limit  : "8",
          })}`
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((d) =>
            setSimilar(Array.isArray(d) ? d : [])
          )
          .catch(() => {}),
    ].filter(Boolean);

    Promise.allSettled(jobs);
  }, [product]);

  /* ═════════════════════════════════════════════════════
     FETCH — REVIEWS
  ═════════════════════════════════════════════════════ */
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
          `${API}/product/slug/` +
          `${encodeURIComponent(slug)}/reviews` +
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

  useEffect(() => {
    loadReviews(1);
  }, [loadReviews]);

  /* ═════════════════════════════════════════════════════
     ACTIONS
  ═════════════════════════════════════════════════════ */

  /* ── Favourite ────────────────────────────────────── */
  const toggleFav = useCallback(() => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);

    const favs = loadFavs();
    if (next) favs[product.id] = true;
    else delete favs[product.id];
    saveFavs(favs);

    if (!userId) return;

    clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => {
      fetch(
        `${API}/product/products/${product.id}/favorite`,
        {
          method : "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({ user_id: userId }),
        }
      ).catch(() => {
        setFav(!next);
        const rb = loadFavs();
        if (next) delete rb[product.id];
        else rb[product.id] = true;
        saveFavs(rb);
      });
    }, FAV_DEBOUNCE);
  }, [fav, product, userId]);

  /* ── WhatsApp ─────────────────────────────────────── */
  const openWhatsApp = useCallback(() => {
    if (!product || isOwn) return;

    fetch(
      `${API}/product/products/${product.id}/click`,
      { method: "POST" }
    ).catch(() => {});

    const waNumber =
      product.whatsapp || product.contact?.whatsapp;
    const waLink   =
      product.whatsapp_link ||
      product.contact?.whatsapp_link;
    const msg      = encodeURIComponent(
      `Hi, I'm interested in: ${product.title} — ` +
      `${window.location.href}`
    );
    const url =
      waLink ||
      (waNumber
        ? `https://wa.me/${
            String(waNumber).replace(/\D/g, "")
          }?text=${msg}`
        : null);

    /*
     * ✅ No toast — button only renders when url exists
     */
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [product, isOwn]);

  /* ── Call ─────────────────────────────────────────── */
  const openCall = useCallback(() => {
    if (isOwn) return;
    const phone =
      product?.phone || product?.contact?.phone;
    /*
     * ✅ No toast — button only renders when phone exists
     */
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }, [product, isOwn]);

  /* ── Chat ─────────────────────────────────────────── */
  const openChat = useCallback(async () => {
    if (!userId) {
      navigate(
        `/auth?redirect=/product/${encodeURIComponent(slug)}`
      );
      return;
    }
    if (isOwn || !product?.seller_id) return;

    setChatBusy(true);
    setToast(null);

    try {
      const res = await fetch(`${API}/conversations`, {
        method : "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          buyerId  : userId,
          sellerId : product.seller_id,
          productId: product.id,
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Server error");

      const threadId = data.thread_id || data.id;
      if (!threadId)
        throw new Error("No thread ID returned");

      navigate(`/chat/${threadId}`);
    } catch (err) {
      showToast(err.message || "Could not open chat.");
    } finally {
      setChatBusy(false);
    }
  }, [userId, isOwn, product, slug, navigate, showToast]);

  /* ── Navigation ───────────────────────────────────── */
  const goProduct = useCallback(
    (p) => navigate(`/product/${p.slug || p.id}`),
    [navigate]
  );

  /* ═════════════════════════════════════════════════════
     RENDER GUARDS
  ═════════════════════════════════════════════════════ */
  if (loading) return <DesktopSkeleton />;

  if (error) {
    return (
      <div className="pdd-page" role="main">
        <div className="pdd-error" role="alert">
          <span
            className="pdd-error-emoji"
            aria-hidden="true"
          >
            🔍
          </span>
          <h2 className="pdd-error-title">{error}</h2>
          <p className="pdd-error-sub">
            This listing may have been removed or the link
            is incorrect.
          </p>
          <div className="pdd-error-actions">
            {error !== "Invalid product link." && (
              <button
                className="pdd-error-btn pdd-error-btn--secondary"
                onClick={loadProduct}
              >
                Try Again
              </button>
            )}
            <Link to="/" className="pdd-error-btn">
              Browse Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  /* ═════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════ */
  return (
    <div className="pdd-page" role="main">

      {/* ── Toast ────────────────────────────────────── */}
      <Toast
        message={toast?.message}
        type={toast?.type}
        onDismiss={dismissToast}
      />

      {/* ── Breadcrumb ───────────────────────────────── */}
      <Breadcrumb
        title={product.title}
        category={product.category_name}
        subcategory={product.subcategory_name}
      />

      {/* ══════════════════════════════════════════════
          HERO — Gallery (left) + Info Panel (right)
      ══════════════════════════════════════════════ */}
      <div className="pdd-hero">

        {/* Left: Gallery */}
        <div className="pdd-hero-gallery">
          <DesktopGallery
            images={product.images}
            title={product.title}
            slug={slug}
          />
        </div>

        {/* Right: Product info + contact */}
        <div className="pdd-hero-panel">

          <header className="pdd-product-header">
            <h1 className="pdd-product-title">
              {product.title}
            </h1>

            <div className="pdd-product-meta-row">
              {(product.location_city ||
                product.location_state) && (
                <span className="pdd-product-loc">
                  📍{" "}
                  {[
                    product.location_city,
                    product.location_state,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
              {product.views > 0 && (
                <span className="pdd-product-views">
                  👁 {compactNum(product.views)} views
                </span>
              )}
              {product.created_at && (
                <span className="pdd-product-age">
                  Posted {timeAgo(product.created_at)}
                </span>
              )}
            </div>

            {product.average_rating > 0 && (
              <div className="pdd-product-rating-row">
                <span
                  className="pdd-product-stars"
                  aria-hidden="true"
                >
                  {"★".repeat(
                    Math.round(product.average_rating)
                  )}
                  {"☆".repeat(
                    5 - Math.round(product.average_rating)
                  )}
                </span>
                <span className="pdd-product-rating-num">
                  {Number(product.average_rating).toFixed(1)}
                </span>
                {product.reviews_count > 0 && (
                  <span className="pdd-product-rating-count">
                    ({product.reviews_count} review
                    {product.reviews_count !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
            )}
          </header>

          {/* Price */}
          <div className="pdd-price-block">
            <span className="pdd-price">
              {fmt(product.price)}
            </span>
            {product.original_price != null &&
              product.original_price > product.price && (
                <>
                  <span className="pdd-price-old">
                    {fmt(product.original_price)}
                  </span>
                  {product.discount_percent > 0 && (
                    <span className="pdd-price-off">
                      -{product.discount_percent}%
                    </span>
                  )}
                </>
              )}
          </div>

          {/* Meta badges — no stock */}
          <MetaBadges product={product} />

          {/* Save + Edit */}
          <div className="pdd-action-row">
            <button
              className={
                `pdd-action-btn` +
                (fav ? " pdd-action-btn--active" : "")
              }
              onClick={toggleFav}
              aria-label={
                fav
                  ? "Remove from favourites"
                  : "Add to favourites"
              }
              aria-pressed={fav}
            >
              {fav ? "♥ Saved" : "♡ Save"}
            </button>

            {isOwn && (
              <button
                className="pdd-action-btn pdd-action-btn--edit"
                onClick={() =>
                  navigate(`/listings/edit/${product.id}`)
                }
              >
                ✏️ Edit Listing
              </button>
            )}
          </div>

          {/*
           * ✅ ContactStrip — only shows buttons with data
           *    Phone optional, WhatsApp optional
           *    No toasts for missing contacts
           *    Only Chat if no phone/whatsapp
           */}
          <div className="pdd-contact-block">
            <ContactStrip
              product={product}
              userId={userId}
              isOwn={isOwn}
              chatBusy={chatBusy}
              onChat={openChat}
              onWhatsApp={openWhatsApp}
              onCall={openCall}
            />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          CONTENT — Tabs (left) + Sidebar (right)
      ══════════════════════════════════════════════ */}
      <div className="pdd-content-area">

        <div className="pdd-tabs-col">
          <ProductTabs
            product={product}
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
        </div>

        <aside className="pdd-sidebar">
          <SafetyTips />
          <DesktopSellerCard
            product={product}
            onNavigate={() =>
              navigate(`/seller/${product.seller_id}`)
            }
          />
        </aside>
      </div>

      {/* ══════════════════════════════════════════════
          MORE FROM SELLER
      ══════════════════════════════════════════════ */}
      <MoreFromSeller
        products={moreSeller}
        seller={{
          name : product.seller_store || product.seller_name,
          image: product.seller_image,
        }}
        sellerId={product.seller_id}
        onProductClick={goProduct}
      />

      {/* ══════════════════════════════════════════════
          SIMILAR PRODUCTS
      ══════════════════════════════════════════════ */}
      <SimilarProducts
        products={similar}
        onProductClick={goProduct}
      />

    </div>
  );
}