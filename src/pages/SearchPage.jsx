// src/pages/SearchPage.jsx
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import "../styles/SearchPage.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;
const PAGE_SIZE = 24;

const PRICE_PRESETS = [
  { label: "Under ₦5k", min: "", max: "5000" },
  { label: "₦5k–20k", min: "5000", max: "20000" },
  { label: "₦20k–50k", min: "20000", max: "50000" },
  { label: "₦50k–100k", min: "50000", max: "100000" },
  { label: "₦100k+", min: "100000", max: "" },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function naira(v) {
  return "₦" + Number(v).toLocaleString("en-NG");
}

function getImageUrl(p) {
  if (p.images && p.images.length > 0) return p.images[0];
  if (p.image) return p.image;
  return "/placeholder.webp";
}

function formatCity(city, state) {
  return [city, state].filter(Boolean).join(", ");
}

function timeAgo(iso) {
  if (!iso) return "";
  var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function calcDiscount(p) {
  if (!p.original_price || p.original_price <= p.price) return null;
  return Math.round(
    ((p.original_price - p.price) / p.original_price) * 100
  );
}

/* ═══════════════════════════════════════════════════════════════
   SVG COMPONENTS
   ═══════════════════════════════════════════════════════════════ */
function SearchIcon({ size }) {
  var s = size || 18;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function FilterIcon({ size }) {
  var s = size || 16;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function GridIcon({ size }) {
  var s = size || 15;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ListIcon({ size }) {
  var s = size || 15;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function MasonryIcon({ size }) {
  var s = size || 15;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="10" rx="1.5" />
      <rect x="14" y="3" width="7" height="6" rx="1.5" />
      <rect x="3" y="15" width="7" height="6" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
    </svg>
  );
}

function CloseIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronLeftIcon({ size }) {
  var s = size || 16;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ size }) {
  var s = size || 16;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function PinIcon({ size }) {
  var s = size || 12;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function HeartIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function StarIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function StarOutlineIcon({ size }) {
  var s = size || 12;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ClockIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function TrendUpIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 6l-9.5 9.5-5-5L1 18" />
      <path d="M17 6h6v6" />
    </svg>
  );
}

function TrendDownIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 18l-9.5-9.5-5 5L1 6" />
      <path d="M17 18h6v-6" />
    </svg>
  );
}

function EyeIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CameraIcon({ size }) {
  var s = size || 11;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function VerifiedIcon({ size }) {
  var s = size || 13;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#1565c0" />
      <path
        d="M8 12l3 3 5-6"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}

function ExternalLinkIcon({ size }) {
  var s = size || 13;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

function HomeIcon({ size }) {
  var s = size || 13;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function TagIcon({ size }) {
  var s = size || 12;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function SlidersIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function SparkleIcon({ size }) {
  var s = size || 14;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M12 2L14.4 8.2L21 9.2L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9.2L9.6 8.2L12 2Z" />
    </svg>
  );
}

function FlashIcon({ size }) {
  var s = size || 12;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function FireIcon({ size }) {
  var s = size || 12;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M12 23c-4.97 0-9-3.58-9-8 0-3.07 2.31-6.64 4.5-9 .37-.4 1.02-.11 1 .44-.09 2.41 1.49 3.94 3.08 4.35C12.23 11 13 10 13 8c0-1.5-.5-3.5-2-5 3.34 1 7 5 7 10 0 5-4 8-6 8z" />
    </svg>
  );
}

function ArrowUpIcon({ size }) {
  var s = size || 12;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function EmptyIcon({ size }) {
  var s = size || 64;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="8" opacity="0.3" />
      <path d="M21 21l-4.35-4.35" opacity="0.3" />
      <path d="M8 11h6" strokeWidth="2" />
    </svg>
  );
}

function ErrorIcon({ size }) {
  var s = size || 48;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="10" opacity="0.2" />
      <path d="M12 8v4M12 16h.01" strokeWidth="2.5" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SORT ICON RESOLVER
   ═══════════════════════════════════════════════════════════════ */
function renderSortIcon(name) {
  switch (name) {
    case "star":
      return <StarIcon size={14} />;
    case "clock":
      return <ClockIcon size={14} />;
    case "trend-up":
      return <TrendUpIcon size={14} />;
    case "trend-down":
      return <TrendDownIcon size={14} />;
    case "heart":
      return <HeartIcon size={14} />;
    default:
      return null;
  }
}

/* sort options use string keys */
var SORT_OPTIONS = [
  { value: "relevance", label: "Best Match", iconName: "star" },
  { value: "newest", label: "Newest First", iconName: "clock" },
  { value: "price_asc", label: "Price: Low → High", iconName: "trend-up" },
  { value: "price_desc", label: "Price: High → Low", iconName: "trend-down" },
  { value: "rating", label: "Top Rated", iconName: "heart" },
];

/* ═══════════════════════════════════════════════════════════════
   STARS
   ═══════════════════════════════════════════════════════════════ */
var StarsDisplay = memo(function StarsDisplay({ rating, size }) {
  var s = size || 11;
  return (
    <span className="sp-stars" aria-label={rating + " out of 5 stars"}>
      {Array.from({ length: 5 }, function (_, i) {
        return (
          <span
            key={i}
            className={
              i < Math.round(rating) ? "sp-star--filled" : "sp-star--empty"
            }
          >
            {i < Math.round(rating) ? (
              <StarIcon size={s} />
            ) : (
              <StarOutlineIcon size={s} />
            )}
          </span>
        );
      })}
    </span>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON CARD
   ═══════════════════════════════════════════════════════════════ */
var SkeletonCard = memo(function SkeletonCard({ view, index }) {
  return (
    <div
      className={
        "sp-card sp-card--sk " +
        (view === "list" ? "sp-card--list" : "sp-card--grid")
      }
      aria-hidden="true"
      style={{ animationDelay: index * 35 + "ms" }}
    >
      <div className="sp-card__img-wrap sp-sk-pulse" />
      <div className="sp-card__body">
        <div className="sp-sk-line" style={{ width: "85%", height: 13 }} />
        <div
          className="sp-sk-line"
          style={{ width: "55%", height: 17, marginTop: 6 }}
        />
        <div
          className="sp-sk-line"
          style={{ width: "65%", height: 10, marginTop: 8 }}
        />
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT CARD
   ═══════════════════════════════════════════════════════════════ */
var ProductCard = memo(function ProductCard({
  product,
  index,
  view,
  active,
  onHover,
  onClick,
}) {
  var p = product;
  var disc = calcDiscount(p);
  var loc = formatCity(p.city, p.state);
  var imgCount = (p.images && p.images.length) || 0;
  var isList = view === "list";

  var badge = null;
  if (p.is_featured) {
    badge = {
      cls: "sp-badge--feat",
      icon: <SparkleIcon size={9} />,
      text: "Featured",
    };
  } else if (p.is_flash) {
    badge = {
      cls: "sp-badge--flash",
      icon: <FlashIcon size={9} />,
      text: "Flash",
    };
  } else if (p.is_hot) {
    badge = {
      cls: "sp-badge--hot",
      icon: <FireIcon size={9} />,
      text: "Hot",
    };
  } else if (p.is_trending) {
    badge = {
      cls: "sp-badge--trend",
      icon: <TrendUpIcon size={9} />,
      text: "Trending",
    };
  } else if (p.is_new) {
    badge = {
      cls: "sp-badge--new",
      icon: <StarIcon size={9} />,
      text: "New",
    };
  }

  var cardClass = "sp-card ";
  cardClass += isList ? "sp-card--list" : "sp-card--grid";
  if (active) cardClass += " sp-card--active";

  return (
    <article
      className={cardClass}
      style={{ animationDelay: index * 40 + "ms" }}
      tabIndex={0}
      role="button"
      aria-label={p.title + " — " + naira(p.price)}
      onMouseEnter={function () {
        onHover(p);
      }}
      onFocus={function () {
        onHover(p);
      }}
      onClick={function () {
        onClick(p);
      }}
      onKeyDown={function (e) {
        if (e.key === "Enter") onClick(p);
      }}
    >
      {/* Image */}
      <div className="sp-card__img-wrap">
        <img
          className="sp-card__img"
          src={getImageUrl(p)}
          alt={p.title}
          loading="lazy"
          decoding="async"
        />

        {badge && (
          <span className={"sp-badge " + badge.cls}>
            {badge.icon}
            {badge.text}
          </span>
        )}

        {disc && disc > 0 && (
          <span className="sp-badge sp-badge--disc">-{disc}%</span>
        )}

        {imgCount > 1 && (
          <span className="sp-img-count">
            <CameraIcon size={9} />
            {imgCount}
          </span>
        )}

        {/* Hover overlay */}
        <div className="sp-card__overlay">
          <button
            className="sp-card__overlay-btn"
            onClick={function (e) {
              e.stopPropagation();
            }}
            aria-label="Add to wishlist"
            type="button"
          >
            <HeartIcon size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="sp-card__body">
        <h3 className="sp-card__title">{p.title}</h3>

        {isList && p.description && (
          <p className="sp-card__desc">{p.description}</p>
        )}

        <div className="sp-card__price-row">
          <span className="sp-card__price">{naira(p.price)}</span>
          {p.original_price && p.original_price > p.price && (
            <span className="sp-card__orig">{naira(p.original_price)}</span>
          )}
        </div>

        {p.rating != null && p.rating > 0 && (
          <div className="sp-card__rating">
            <StarsDisplay rating={p.rating} />
            {p.review_count != null && (
              <span className="sp-card__reviews">({p.review_count})</span>
            )}
          </div>
        )}

        <div className="sp-card__foot">
          {loc && (
            <span className="sp-card__loc">
              <PinIcon size={10} />
              {loc}
            </span>
          )}
          {p.created_at && (
            <span className="sp-card__time">{timeAgo(p.created_at)}</span>
          )}
        </div>

        {p.condition && (
          <span
            className={
              "sp-card__condition sp-cond--" +
              p.condition.toLowerCase().replace(/\s+/g, "")
            }
          >
            {p.condition}
          </span>
        )}
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FILTER PANEL
   ═══════════════════════════════════════════════════════════════ */
var FilterPanel = memo(function FilterPanel({
  aggregations,
  draft,
  onChange,
  onApply,
  onReset,
  activeCount,
}) {
  var price = aggregations.price || { min: 0, max: 0 };
  var conditions = aggregations.conditions || [];
  var states = aggregations.states || [];
  var categories = aggregations.categories || [];

  var activePreset = null;
  for (var i = 0; i < PRICE_PRESETS.length; i++) {
    var pp = PRICE_PRESETS[i];
    if (pp.min === (draft.min_price || "") && pp.max === (draft.max_price || "")) {
      activePreset = pp;
      break;
    }
  }

  function togglePreset(preset) {
    if (activePreset && activePreset.label === preset.label) {
      onChange("min_price", "");
      onChange("max_price", "");
    } else {
      onChange("min_price", preset.min);
      onChange("max_price", preset.max);
    }
  }

  return (
    <aside className="sp-panel" aria-label="Search filters">
      {/* Header */}
      <div className="sp-panel__head">
        <div className="sp-panel__head-left">
          <SlidersIcon size={15} />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="sp-panel__count">{activeCount}</span>
          )}
        </div>
        {activeCount > 0 && (
          <button className="sp-panel__reset" onClick={onReset} type="button">
            Clear all
          </button>
        )}
      </div>

      <div className="sp-panel__scroll">
        {/* Sort */}
        <section className="sp-panel__section">
          <h3 className="sp-panel__label">Sort by</h3>
          <div className="sp-panel__sort-list">
            {SORT_OPTIONS.map(function (opt) {
              return (
                <button
                  key={opt.value}
                  className={
                    "sp-panel__sort-btn" +
                    (draft.sort === opt.value
                      ? " sp-panel__sort-btn--active"
                      : "")
                  }
                  onClick={function () {
                    onChange("sort", opt.value);
                  }}
                  type="button"
                >
                  {renderSortIcon(opt.iconName)}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Categories */}
        {categories.length > 0 && (
          <section className="sp-panel__section">
            <h3 className="sp-panel__label">
              <TagIcon size={11} />
              Category
            </h3>
            <div className="sp-panel__cat-list">
              {categories.map(function (cat) {
                var isActive = draft.category_id === cat.id;
                return (
                  <button
                    key={cat.id}
                    className={
                      "sp-panel__cat" +
                      (isActive ? " sp-panel__cat--active" : "")
                    }
                    onClick={function () {
                      onChange("category_id", isActive ? "" : cat.id);
                    }}
                    type="button"
                  >
                    <span>{cat.name}</span>
                    {cat.count != null && (
                      <span className="sp-panel__cat-count">{cat.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Price */}
        <section className="sp-panel__section">
          <h3 className="sp-panel__label">Price Range</h3>
          <div className="sp-panel__price-inputs">
            <div className="sp-panel__price-field">
              <span className="sp-panel__price-prefix">₦</span>
              <input
                type="number"
                min={0}
                placeholder={
                  price.min ? price.min.toLocaleString() : "Min"
                }
                value={draft.min_price}
                onChange={function (e) {
                  onChange("min_price", e.target.value);
                }}
              />
            </div>
            <span className="sp-panel__price-sep">
              <ChevronRightIcon size={12} />
            </span>
            <div className="sp-panel__price-field">
              <span className="sp-panel__price-prefix">₦</span>
              <input
                type="number"
                min={0}
                placeholder={
                  price.max ? price.max.toLocaleString() : "Max"
                }
                value={draft.max_price}
                onChange={function (e) {
                  onChange("max_price", e.target.value);
                }}
              />
            </div>
          </div>
          <div className="sp-panel__presets">
            {PRICE_PRESETS.map(function (preset) {
              return (
                <button
                  key={preset.label}
                  className={
                    "sp-panel__preset" +
                    (activePreset && activePreset.label === preset.label
                      ? " sp-panel__preset--active"
                      : "")
                  }
                  onClick={function () {
                    togglePreset(preset);
                  }}
                  type="button"
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Condition */}
        {conditions.length > 0 && (
          <section className="sp-panel__section">
            <h3 className="sp-panel__label">Condition</h3>
            <div className="sp-panel__cond-list">
              {conditions.map(function (c) {
                var isActive = draft.condition === c;
                return (
                  <button
                    key={c}
                    className={
                      "sp-panel__cond" +
                      (isActive ? " sp-panel__cond--active" : "")
                    }
                    onClick={function () {
                      onChange("condition", isActive ? "" : c);
                    }}
                    type="button"
                  >
                    <span className="sp-panel__cond-dot" />
                    {c}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* State / Location */}
        {states.length > 0 && (
          <section className="sp-panel__section">
            <h3 className="sp-panel__label">
              <PinIcon size={11} />
              Location
            </h3>
            <div className="sp-panel__select-wrap">
              <select
                className="sp-panel__select"
                value={draft.state}
                onChange={function (e) {
                  onChange("state", e.target.value);
                }}
              >
                <option value="">All States</option>
                {states.map(function (s) {
                  return (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  );
                })}
              </select>
              <ChevronRightIcon size={12} />
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="sp-panel__foot">
        <button className="sp-panel__apply" onClick={onApply} type="button">
          Apply Filters
        </button>
      </div>
    </aside>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PREVIEW PANE
   ═══════════════════════════════════════════════════════════════ */
var PreviewPane = memo(function PreviewPane({ product, onClose, onNavigate }) {
  if (!product) {
    return (
      <aside
        className="sp-preview sp-preview--empty"
        aria-label="Product preview"
      >
        <div className="sp-preview__placeholder">
          <EyeIcon size={32} />
          <p>Hover over a product to preview</p>
        </div>
      </aside>
    );
  }

  var p = product;
  var disc = calcDiscount(p);
  var loc = formatCity(p.city, p.state);

  return (
    <aside
      className="sp-preview sp-preview--active"
      aria-label={"Preview of " + p.title}
    >
      {/* Header */}
      <div className="sp-preview__header">
        <span className="sp-preview__header-tag">Quick View</span>
        <button
          className="sp-preview__close"
          onClick={onClose}
          type="button"
          aria-label="Close preview"
        >
          <CloseIcon size={12} />
        </button>
      </div>

      {/* Gallery */}
      <div className="sp-preview__gallery">
        <img
          className="sp-preview__img"
          src={getImageUrl(p)}
          alt={p.title}
          key={p.id}
        />
        {disc != null && disc > 0 && (
          <span className="sp-preview__disc">-{disc}%</span>
        )}
      </div>

      {/* Thumbnails */}
      {p.images && p.images.length > 1 && (
        <div className="sp-preview__thumbs">
          {p.images.slice(0, 5).map(function (img, i) {
            return (
              <img key={i} src={img} alt="" className="sp-preview__thumb" />
            );
          })}
          {p.images.length > 5 && (
            <span className="sp-preview__thumb-more">
              +{p.images.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Info */}
      <div className="sp-preview__info">
        <h2 className="sp-preview__title">{p.title}</h2>

        <div className="sp-preview__price-block">
          <span className="sp-preview__price">{naira(p.price)}</span>
          {p.original_price && p.original_price > p.price && (
            <span className="sp-preview__orig">
              {naira(p.original_price)}
            </span>
          )}
        </div>

        {p.rating != null && p.rating > 0 && (
          <div className="sp-preview__rating">
            <StarsDisplay rating={p.rating} size={13} />
            {p.review_count != null && (
              <span className="sp-preview__reviews">
                {p.review_count} review{p.review_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {p.description && (
          <p className="sp-preview__desc">{p.description}</p>
        )}

        {/* Meta tags */}
        <div className="sp-preview__meta">
          {p.condition && (
            <span className="sp-preview__meta-item">
              <TagIcon size={11} />
              {p.condition}
            </span>
          )}
          {loc && (
            <span className="sp-preview__meta-item">
              <PinIcon size={11} />
              {loc}
            </span>
          )}
          {p.created_at && (
            <span className="sp-preview__meta-item">
              <ClockIcon size={11} />
              {timeAgo(p.created_at)}
            </span>
          )}
          {p.views != null && (
            <span className="sp-preview__meta-item">
              <EyeIcon size={11} />
              {p.views.toLocaleString()} views
            </span>
          )}
        </div>

        {/* Seller */}
        {p.seller_name && (
          <div className="sp-preview__seller">
            {p.seller_avatar ? (
              <img
                src={p.seller_avatar}
                alt=""
                className="sp-preview__seller-avatar"
              />
            ) : (
              <span className="sp-preview__seller-avatar sp-preview__seller-avatar--placeholder">
                {p.seller_name[0] ? p.seller_name[0].toUpperCase() : "?"}
              </span>
            )}
            <span className="sp-preview__seller-name">{p.seller_name}</span>
            {p.seller_verified && <VerifiedIcon size={14} />}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="sp-preview__actions">
        <button
          className="sp-preview__btn sp-preview__btn--primary"
          onClick={function () {
            onNavigate(p);
          }}
          type="button"
        >
          <ExternalLinkIcon size={13} />
          View Full Details
        </button>
        <div className="sp-preview__btn-row">
          <button
            className="sp-preview__btn sp-preview__btn--icon"
            type="button"
            aria-label="Save"
          >
            <HeartIcon size={15} />
          </button>
          <button
            className="sp-preview__btn sp-preview__btn--icon"
            type="button"
            aria-label="Share"
          >
            <ShareIcon size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
});

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════ */
function EmptyState({ query, onReset }) {
  return (
    <div className="sp-empty">
      <EmptyIcon size={72} />
      <h2 className="sp-empty__title">No results for &ldquo;{query}&rdquo;</h2>
      <p className="sp-empty__sub">
        We searched everywhere but couldn&apos;t find a match.
      </p>
      <ul className="sp-empty__tips">
        <li>
          <SparkleIcon size={10} /> Try different or fewer keywords
        </li>
        <li>
          <SparkleIcon size={10} /> Check for spelling mistakes
        </li>
        <li>
          <SparkleIcon size={10} /> Remove active filters
        </li>
        <li>
          <SparkleIcon size={10} /> Use broader search terms
        </li>
      </ul>
      <button className="sp-empty__btn" onClick={onReset} type="button">
        <CloseIcon size={12} />
        Clear filters &amp; retry
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL TO TOP
   ═══════════════════════════════════════════════════════════════ */
function ScrollToTop() {
  var _useState = useState(false),
    visible = _useState[0],
    setVisible = _useState[1];

  useEffect(function () {
    function onScroll() {
      setVisible(window.scrollY > 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return function () {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      className="sp-scroll-top"
      onClick={function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      type="button"
      aria-label="Scroll to top"
    >
      <ArrowUpIcon size={16} />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN — SearchPage
   ═══════════════════════════════════════════════════════════════ */
export default function SearchPage({ user }) {
  var _useSearchParams = useSearchParams(),
    searchParams = _useSearchParams[0],
    setSearchParams = _useSearchParams[1];
  var navigate = useNavigate();

  /* URL state */
  var query = searchParams.get("q") || "";
  var sort = searchParams.get("sort") || "relevance";
  var category_id = searchParams.get("category_id") || "";
  var min_price = searchParams.get("min_price") || "";
  var max_price = searchParams.get("max_price") || "";
  var condition = searchParams.get("condition") || "";
  var state = searchParams.get("state") || "";
  var city = searchParams.get("city") || "";
  var page = Number(searchParams.get("page") || 0);

  /* Component state */
  var _s1 = useState([]),
    products = _s1[0],
    setProducts = _s1[1];

  var _s2 = useState({
      price: { min: 0, max: 0 },
      conditions: [],
      states: [],
      categories: [],
    }),
    aggregations = _s2[0],
    setAggregations = _s2[1];

  var _s3 = useState(null),
    meta = _s3[0],
    setMeta = _s3[1];

  var _s4 = useState(false),
    loading = _s4[0],
    setLoading = _s4[1];

  var _s5 = useState(null),
    error = _s5[0],
    setError = _s5[1];

  var _s6 = useState("grid"),
    view = _s6[0],
    setView = _s6[1];

  var _s7 = useState(null),
    preview = _s7[0],
    setPreview = _s7[1];

  var _s8 = useState(false),
    filterCollapsed = _s8[0],
    setFilterCollapsed = _s8[1];

  /* Draft filters */
  var _s9 = useState({
      sort: sort,
      category_id: category_id,
      min_price: min_price,
      max_price: max_price,
      condition: condition,
      state: state,
      city: city,
    }),
    draft = _s9[0],
    setDraft = _s9[1];

  var filterOpenRef = useRef(false);
  var abortRef = useRef(null);

  /* Sync draft from URL when not editing */
  useEffect(
    function () {
      if (!filterOpenRef.current) {
        setDraft({
          sort: sort,
          category_id: category_id,
          min_price: min_price,
          max_price: max_price,
          condition: condition,
          state: state,
          city: city,
        });
      }
    },
    [sort, category_id, min_price, max_price, condition, state, city]
  );

  /* Fetch */
  var fetchResults = useCallback(
    function () {
      if (!query || query.length < 2) {
        setProducts([]);
        setMeta(null);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      setError(null);

      var params = new URLSearchParams({
        q: query,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (sort && sort !== "relevance") params.set("sort", sort);
      if (category_id) params.set("category_id", category_id);
      if (min_price) params.set("min_price", min_price);
      if (max_price) params.set("max_price", max_price);
      if (condition) params.set("condition", condition);
      if (state) params.set("state", state);
      if (city) params.set("city", city);

      fetch(API + "/search?" + params.toString(), {
        signal: abortRef.current.signal,
      })
        .then(function (res) {
          if (!res.ok) {
            return res
              .json()
              .catch(function () {
                return {};
              })
              .then(function (body) {
                throw new Error(body.message || "HTTP " + res.status);
              });
          }
          return res.json();
        })
        .then(function (data) {
          setProducts(data.products || []);
          setMeta(data.meta || null);
          setAggregations(
            data.aggregations || {
              price: { min: 0, max: 0 },
              conditions: [],
              states: [],
              categories: [],
            }
          );
          window.scrollTo({ top: 0, behavior: "smooth" });
        })
        .catch(function (err) {
          if (err.name !== "AbortError") {
            setError(err.message);
            setProducts([]);
          }
        })
        .finally(function () {
          setLoading(false);
        });
    },
    [query, page, sort, category_id, min_price, max_price, condition, state, city]
  );

  useEffect(
    function () {
      fetchResults();
      return function () {
        if (abortRef.current) abortRef.current.abort();
      };
    },
    [fetchResults]
  );

  /* Handlers */
  var handleDraftChange = useCallback(function (key, value) {
    filterOpenRef.current = true;
    setDraft(function (prev) {
      var next = {};
      for (var k in prev) next[k] = prev[k];
      next[key] = value;
      return next;
    });
  }, []);

  var handleApply = useCallback(
    function () {
      filterOpenRef.current = false;
      setSearchParams(function (prev) {
        var next = new URLSearchParams(prev);

        function setOrDel(k, v) {
          if (v) next.set(k, v);
          else next.delete(k);
        }

        if (draft.sort && draft.sort !== "relevance") next.set("sort", draft.sort);
        else next.delete("sort");

        setOrDel("category_id", draft.category_id);
        setOrDel("min_price", draft.min_price);
        setOrDel("max_price", draft.max_price);
        setOrDel("condition", draft.condition);
        setOrDel("state", draft.state);
        setOrDel("city", draft.city);
        next.delete("page");
        return next;
      });
    },
    [draft, setSearchParams]
  );

  var handleReset = useCallback(
    function () {
      filterOpenRef.current = false;
      setSearchParams({ q: query });
      setDraft({
        sort: "relevance",
        category_id: "",
        min_price: "",
        max_price: "",
        condition: "",
        state: "",
        city: "",
      });
    },
    [query, setSearchParams]
  );

  var removeFilter = useCallback(
    function () {
      var keys = Array.prototype.slice.call(arguments);
      setSearchParams(function (prev) {
        var next = new URLSearchParams(prev);
        keys.forEach(function (k) {
          next.delete(k);
        });
        next.delete("page");
        return next;
      });
    },
    [setSearchParams]
  );

  var handlePage = useCallback(
    function (dir) {
      setSearchParams(function (prev) {
        var next = new URLSearchParams(prev);
        var newPage = Math.max(0, page + dir);
        if (newPage === 0) next.delete("page");
        else next.set("page", String(newPage));
        return next;
      });
    },
    [page, setSearchParams]
  );

  var handleProductClick = useCallback(
    function (p) {
      navigate("/product/" + p.id);
    },
    [navigate]
  );

  /* Active chips */
  var activeChips = useMemo(
    function () {
      var chips = [];
      var SORT_LABELS = {
        newest: "Newest",
        price_asc: "Price ↑",
        price_desc: "Price ↓",
        rating: "Top Rated",
      };

      if (sort && sort !== "relevance") {
        chips.push({
          key: "sort",
          label: SORT_LABELS[sort] || sort,
          remove: function () {
            removeFilter("sort");
          },
        });
      }
      if (condition) {
        chips.push({
          key: "condition",
          label: condition,
          remove: function () {
            removeFilter("condition");
          },
        });
      }
      if (state) {
        chips.push({
          key: "state",
          label: state,
          remove: function () {
            removeFilter("state");
          },
        });
      }
      if (city) {
        chips.push({
          key: "city",
          label: city,
          remove: function () {
            removeFilter("city");
          },
        });
      }
      if (min_price || max_price) {
        var label =
          min_price && max_price
            ? naira(min_price) + " – " + naira(max_price)
            : min_price
            ? "From " + naira(min_price)
            : "Up to " + naira(max_price);
        chips.push({
          key: "price-" + min_price + "-" + max_price,
          label: label,
          remove: function () {
            removeFilter("min_price", "max_price");
          },
        });
      }
      if (category_id) {
        var cats = aggregations.categories || [];
        var found = null;
        for (var i = 0; i < cats.length; i++) {
          if (cats[i].id === category_id) {
            found = cats[i];
            break;
          }
        }
        chips.push({
          key: "category_id",
          label: found ? found.name : "Category",
          remove: function () {
            removeFilter("category_id");
          },
        });
      }
      return chips;
    },
    [sort, condition, state, city, min_price, max_price, category_id, aggregations, removeFilter]
  );

  var totalPages = meta && meta.total ? Math.ceil(meta.total / PAGE_SIZE) : null;

  /* ═══════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════ */
  return (
    <div className="sp">
      <TopNav user={user} />

      {/* HEADER */}
      <header className="sp__header">
        <div className="sp__header-inner">
          {/* Breadcrumb */}
          <nav className="sp__crumb" aria-label="Breadcrumb">
            <button
              className="sp__crumb-link"
              onClick={function () {
                navigate("/");
              }}
              type="button"
            >
              <HomeIcon size={11} />
              Home
            </button>
            <span className="sp__crumb-sep" aria-hidden="true">
              <ChevronRightIcon size={10} />
            </span>
            <span className="sp__crumb-current">Search</span>
            {query && (
              <>
                <span className="sp__crumb-sep" aria-hidden="true">
                  <ChevronRightIcon size={10} />
                </span>
                <span className="sp__crumb-query">&ldquo;{query}&rdquo;</span>
              </>
            )}
          </nav>

          {/* Title row */}
          <div className="sp__title-row">
            <h1 className="sp__title">
              {loading ? (
                <>
                  Searching{" "}
                  <span className="sp__title-q">&ldquo;{query}&rdquo;</span>
                  <span className="sp__dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </>
              ) : meta && meta.total > 0 ? (
                <>
                  <span className="sp__title-count">
                    {meta.total.toLocaleString()}
                  </span>{" "}
                  result{meta.total !== 1 ? "s" : ""} for{" "}
                  <span className="sp__title-q">&ldquo;{query}&rdquo;</span>
                </>
              ) : query ? (
                <>
                  No results for{" "}
                  <span className="sp__title-q">&ldquo;{query}&rdquo;</span>
                </>
              ) : (
                "Search"
              )}
            </h1>

            {/* Controls */}
            <div className="sp__controls">
              {/* View toggle */}
              <div
                className="sp__view-group"
                role="group"
                aria-label="View mode"
              >
                <button
                  className={
                    "sp__view-btn" +
                    (view === "grid" ? " sp__view-btn--active" : "")
                  }
                  onClick={function () {
                    setView("grid");
                  }}
                  aria-label="Grid"
                  aria-pressed={view === "grid"}
                  type="button"
                >
                  <GridIcon />
                </button>
                <button
                  className={
                    "sp__view-btn" +
                    (view === "masonry" ? " sp__view-btn--active" : "")
                  }
                  onClick={function () {
                    setView("masonry");
                  }}
                  aria-label="Masonry"
                  aria-pressed={view === "masonry"}
                  type="button"
                >
                  <MasonryIcon />
                </button>
                <button
                  className={
                    "sp__view-btn" +
                    (view === "list" ? " sp__view-btn--active" : "")
                  }
                  onClick={function () {
                    setView("list");
                  }}
                  aria-label="List"
                  aria-pressed={view === "list"}
                  type="button"
                >
                  <ListIcon />
                </button>
              </div>

              {/* Collapse filter panel */}
              <button
                className={
                  "sp__toggle-panel" +
                  (filterCollapsed ? " sp__toggle-panel--collapsed" : "")
                }
                onClick={function () {
                  setFilterCollapsed(function (v) {
                    return !v;
                  });
                }}
                type="button"
                aria-label={
                  filterCollapsed ? "Show filters" : "Hide filters"
                }
              >
                <FilterIcon />
                {filterCollapsed ? "Show Filters" : "Hide Filters"}
              </button>
            </div>
          </div>

          {/* Active chips */}
          {activeChips.length > 0 && (
            <div
              className="sp__chips"
              role="list"
              aria-label="Active filters"
            >
              {activeChips.map(function (chip) {
                return (
                  <span key={chip.key} className="sp__chip" role="listitem">
                    {chip.label}
                    <button
                      onClick={chip.remove}
                      type="button"
                      aria-label={"Remove " + chip.label}
                    >
                      <CloseIcon size={10} />
                    </button>
                  </span>
                );
              })}
              <button
                className="sp__chips-clear"
                onClick={handleReset}
                type="button"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 3-COLUMN LAYOUT */}
      <div
        className={
          "sp__layout" + (filterCollapsed ? " sp__layout--collapsed" : "")
        }
      >
        {/* Left: Filters */}
        {!filterCollapsed && (
          <FilterPanel
            aggregations={aggregations}
            draft={draft}
            onChange={handleDraftChange}
            onApply={handleApply}
            onReset={handleReset}
            activeCount={activeChips.length}
          />
        )}

        {/* Center: Results */}
        <main
          className="sp__main"
          aria-live="polite"
          aria-busy={loading}
          aria-label="Search results"
        >
          {/* No query */}
          {!query && !loading && (
            <div className="sp__placeholder">
              <SearchIcon size={44} />
              <h2>Start searching</h2>
              <p>
                Use the search bar above to find products, brands, and more.
              </p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="sp__error" role="alert">
              <ErrorIcon size={52} />
              <h3>Something went wrong</h3>
              <p>{error}</p>
              <button
                className="sp__error-btn"
                onClick={fetchResults}
                type="button"
              >
                Try again
              </button>
            </div>
          )}

          {/* Skeletons */}
          {loading && (
            <div className={"sp__grid sp__grid--" + view}>
              {Array.from({ length: 12 }, function (_, i) {
                return <SkeletonCard key={i} view={view} index={i} />;
              })}
            </div>
          )}

          {/* Results */}
          {!loading && !error && products.length > 0 && (
            <>
              <div className={"sp__grid sp__grid--" + view}>
                {products.map(function (p, i) {
                  return (
                    <ProductCard
                      key={p.id}
                      product={p}
                      index={i}
                      view={view}
                      active={preview && preview.id === p.id}
                      onHover={setPreview}
                      onClick={handleProductClick}
                    />
                  );
                })}
              </div>

              {/* Pagination */}
              <nav className="sp__pagination" aria-label="Pagination">
                <button
                  className="sp__page-btn"
                  onClick={function () {
                    handlePage(-1);
                  }}
                  disabled={page === 0}
                  type="button"
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon />
                  <span>Previous</span>
                </button>

                <span className="sp__page-info">
                  Page <strong>{page + 1}</strong>
                  {totalPages && (
                    <>
                      {" "}
                      of <strong>{totalPages}</strong>
                    </>
                  )}
                </span>

                <button
                  className="sp__page-btn"
                  onClick={function () {
                    handlePage(1);
                  }}
                  disabled={!meta || !meta.has_more}
                  type="button"
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRightIcon />
                </button>
              </nav>

              {meta && !meta.has_more && (
                <div className="sp__end">
                  <span className="sp__end-line" />
                  <span>
                    {(meta.total || products.length).toLocaleString()} result
                    {(meta.total || products.length) !== 1 ? "s" : ""}
                  </span>
                  <span className="sp__end-line" />
                </div>
              )}
            </>
          )}

          {/* Empty */}
          {!loading && !error && query && products.length === 0 && (
            <EmptyState query={query} onReset={handleReset} />
          )}
        </main>

        {/* Right: Preview */}
        <PreviewPane
          product={preview}
          onClose={function () {
            setPreview(null);
          }}
          onNavigate={handleProductClick}
        />
      </div>

      <ScrollToTop />
    </div>
  );
}