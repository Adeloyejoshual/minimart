// src/pages/HomepageDesktop.tsx
import {
  useEffect, useRef, memo,
  useCallback, useMemo, useState,
} from "react";
import { useNavigate }    from "react-router-dom";
import CATEGORIES         from "../config/categories";
import TopNav             from "../components/TopNav";
import Footer             from "../components/Footer";
import LocationPicker     from "../components/LocationPicker";
import MasonryCard, {
  naira, getImageUrl, formatCity, PinIcon,
}                         from "../components/MasonryCard";
import {
  useLocation      as useStoredLocation,
  formatLocationLabel,
}                         from "../hooks/useLocation";
import { useDesktopFeed } from "../hooks/useDesktopFeed";
import type { Product, Filters } from "../hooks/useDesktopFeed";
import "./HomepageDesktop.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const PH      = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const API     = `${import.meta.env.VITE_API_BASE_URL || window.location.origin}/api`;
const ALL_CAT = { id: "all", name: "All", icon: "✦" };
const CAT_LIST = [ALL_CAT, ...CATEGORIES];

const TRENDING_SEARCHES = [
  "iPhone 15", "Toyota Camry", "MacBook Pro",
  "Generator", "Sofa set", "Fridge",
];

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const TrendingIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const DealsIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

const DiamondIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h12l4 6-10 13L2 9z" />
    <path d="M2 9h20" />
    <path d="M10 3l-4 6 6 13 6-13-4-6" />
  </svg>
);

const FlashIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const SponsoredIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const TagIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const CartIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
  </svg>
);

const ChevronRightIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
  </svg>
);

const ChevronUpIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
       aria-hidden="true">
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

const ZapIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const BagIcon = ({ size = 36 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
);

const MegaphoneIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M3 11l19-9-9 19-2-8-8-2z" />
  </svg>
);

const FilterIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="11" y1="18" x2="13" y2="18" />
  </svg>
);

const LocationIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const PlusIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
       aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const WifiOffIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={2} strokeLinecap="round"
       strokeLinejoin="round" aria-hidden="true">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
    <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0122.58 9" />
    <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
    <path d="M8.53 16.11a6 6 0 016.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const SparkleIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
       aria-hidden="true">
    <path d="M12 0l2.4 7.6L22 10l-7.6 2.4L12 20l-2.4-7.6L2 10l7.6-2.4z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const discountLabel = (p: Product): string | null => {
  const orig = Number(p.attributes?.original_price || 0);
  const curr = p.price;
  if (orig > curr && curr > 0)
    return `${Math.round(((orig - curr) / orig) * 100)}% off`;
  return null;
};

const fmtCount = (n: number): string => {
  if (n <= 0)         return "0";
  if (n < 1_000)      return `${n}+`;
  if (n < 10_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k+`;
  if (n < 1_000_000)  return `${Math.round(n / 1_000)}k+`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
};

/* ══════════════════════════════════════════════════════════════
   GRID SKELETON
══════════════════════════════════════════════════════════════ */
const GridSkeleton = memo(function GridSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="dsk-grid"
         style={{ "--cols": cols } as React.CSSProperties}
         aria-busy="true">
      {Array.from({ length: cols * 3 }).map((_, i) => (
        <div key={i} className="dsk-sk dsk-shimmer"
             style={{ height: 260 }} aria-hidden="true" />
      ))}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   OFFLINE BANNER (soft — only when cache still visible)
══════════════════════════════════════════════════════════════ */
const OfflineBanner = memo(function OfflineBanner({
  visible, onRetry, onDismiss,
}: {
  visible : boolean;
  onRetry : () => void;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="dsk-offline-banner" role="status" aria-live="polite">
      <span className="dsk-offline-icon"><WifiOffIcon size={14} /></span>
      <p className="dsk-offline-text">
        You're offline — showing saved listings.
      </p>
      <button className="dsk-offline-btn" onClick={onRetry}>Retry</button>
      <button className="dsk-offline-close" onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   LEFT SIDEBAR
══════════════════════════════════════════════════════════════ */
interface SidebarProps {
  category       : string;
  onCategory     : (id: string) => void;
  savedLocation  : ReturnType<typeof useStoredLocation>["location"];
  onOpenPicker   : () => void;
  onClearLoc     : () => void;
  filters        : Filters;
  onUpdateFilters: (f: Partial<Filters>) => void;
  onClearFilters : () => void;
  resultCount    : number;
}

const LeftSidebar = memo(function LeftSidebar({
  category, onCategory, savedLocation, onOpenPicker, onClearLoc,
  filters, onUpdateFilters, onClearFilters, resultCount,
}: SidebarProps) {
  const [priceMin,       setPriceMin]       = useState("");
  const [priceMax,       setPriceMax]       = useState("");
  const [localCondition, setLocalCondition] = useState("all");

  const locLabel = formatLocationLabel(savedLocation) || "";

  useEffect(() => {
    setPriceMin(filters.priceMin != null ? String(filters.priceMin) : "");
    setPriceMax(filters.priceMax != null ? String(filters.priceMax) : "");
    setLocalCondition(filters.condition || "all");
  }, [filters]);

  const handleApplyPrice = useCallback(() => {
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;
    onUpdateFilters({ priceMin: min, priceMax: max });
  }, [priceMin, priceMax, onUpdateFilters]);

  const handleConditionChange = useCallback((value: string) => {
    setLocalCondition(value);
    onUpdateFilters({ condition: value });
  }, [onUpdateFilters]);

  const handleClearAll = useCallback(() => {
    setPriceMin("");
    setPriceMax("");
    setLocalCondition("all");
    onClearFilters();
  }, [onClearFilters]);

  const handlePriceKeyDown = useCallback(
    (e: React.KeyboardEvent) => { if (e.key === "Enter") handleApplyPrice(); },
    [handleApplyPrice]
  );

  const hasActiveFilters =
    filters.priceMin != null ||
    filters.priceMax != null ||
    (filters.condition && filters.condition !== "all");

  return (
    <aside className="dsk-sidebar-left" aria-label="Filters">

      {hasActiveFilters && (
        <div className="dsk-sb-active-filters">
          <div className="dsk-sb-active-head">
            <span className="dsk-sb-active-badge">
              <FilterIcon size={12} /> Filters active
            </span>
            <button className="dsk-sb-active-clear" onClick={handleClearAll}>
              Clear all
            </button>
          </div>
          <div className="dsk-sb-active-tags">
            {filters.priceMin != null && (
              <span className="dsk-sb-tag">
                Min: ₦{filters.priceMin.toLocaleString()}
                <button
                  onClick={() => { setPriceMin(""); onUpdateFilters({ priceMin: null }); }}
                  aria-label="Remove min price"
                >×</button>
              </span>
            )}
            {filters.priceMax != null && (
              <span className="dsk-sb-tag">
                Max: ₦{filters.priceMax.toLocaleString()}
                <button
                  onClick={() => { setPriceMax(""); onUpdateFilters({ priceMax: null }); }}
                  aria-label="Remove max price"
                >×</button>
              </span>
            )}
            {filters.condition && filters.condition !== "all" && (
              <span className="dsk-sb-tag">
                {filters.condition.charAt(0).toUpperCase() + filters.condition.slice(1)}
                <button
                  onClick={() => { setLocalCondition("all"); onUpdateFilters({ condition: "all" }); }}
                  aria-label="Remove condition filter"
                >×</button>
              </span>
            )}
          </div>
          <p className="dsk-sb-result-count">
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      <section className="dsk-sb-section">
        <h3 className="dsk-sb-title">Categories</h3>
        <ul className="dsk-sb-cat-list" role="list">
          {CAT_LIST.map((cat) => (
            <li key={cat.id}>
              <button
                className={`dsk-sb-cat-btn${category === cat.id ? " dsk-sb-cat-btn--active" : ""}`}
                onClick={() => onCategory(cat.id)}
                aria-pressed={category === cat.id}
              >
                <span className="dsk-sb-cat-icon" aria-hidden="true">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="dsk-sb-section">
        <h3 className="dsk-sb-title">Location</h3>
        <button className="dsk-sb-loc-btn" onClick={onOpenPicker}>
          <LocationIcon size={13} />
          <span>{locLabel || "Set location"}</span>
        </button>
        {locLabel && (
          <button className="dsk-sb-loc-clear" onClick={onClearLoc}>
            Clear location ×
          </button>
        )}
      </section>

      <section className="dsk-sb-section">
        <h3 className="dsk-sb-title">Price Range (₦)</h3>
        <div className="dsk-sb-price-row">
          <input
            className="dsk-sb-price-inp"
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            onKeyDown={handlePriceKeyDown}
            min="0"
          />
          <span className="dsk-sb-price-sep">–</span>
          <input
            className="dsk-sb-price-inp"
            type="number"
            placeholder="Max"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            onKeyDown={handlePriceKeyDown}
            min="0"
          />
        </div>
        <button className="dsk-sb-apply-btn" onClick={handleApplyPrice}>
          Apply Price Filter
        </button>
      </section>

      <section className="dsk-sb-section">
        <h3 className="dsk-sb-title">Condition</h3>
        {[
          { value: "all",         label: "Any condition" },
          { value: "new",         label: "Brand New"     },
          { value: "used",        label: "Used"          },
          { value: "refurbished", label: "Refurbished"   },
        ].map((opt) => (
          <label
            key={opt.value}
            className={`dsk-sb-radio${localCondition === opt.value ? " dsk-sb-radio--active" : ""}`}
          >
            <input
              type="radio"
              name="condition"
              value={opt.value}
              checked={localCondition === opt.value}
              onChange={() => handleConditionChange(opt.value)}
            />
            <span className="dsk-sb-radio-dot" />
            <span>{opt.label}</span>
          </label>
        ))}
      </section>
    </aside>
  );
});

/* ══════════════════════════════════════════════════════════════
   RIGHT SIDEBAR
══════════════════════════════════════════════════════════════ */
interface RightSidebarProps { navigate: (path: string) => void }

const RightSidebar = memo(function RightSidebar({ navigate }: RightSidebarProps) {
  return (
    <aside className="dsk-sidebar-right" aria-label="Trending">
      <section className="dsk-sb-section">
        <h3 className="dsk-sb-title">
          <TrendingIcon size={14} /> Trending Searches
        </h3>
        <ul className="dsk-trend-list" role="list">
          {TRENDING_SEARCHES.map((q, i) => (
            <li key={q}>
              <button
                className="dsk-trend-item"
                onClick={() => navigate(`/search?q=${encodeURIComponent(q)}`)}
              >
                <span className="dsk-trend-rank">{i + 1}</span>
                <span className="dsk-trend-label">{q}</span>
                <ChevronRightIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="dsk-sb-section">
        <h3 className="dsk-sb-title">Popular Categories</h3>
        <div className="dsk-pop-cats">
          {CATEGORIES.slice(0, 6).map((cat) => (
            <button
              key={cat.id}
              className="dsk-pop-cat"
              onClick={() => navigate(`/category/${cat.id}`)}
            >
              <span aria-hidden="true">{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="dsk-sb-section dsk-sb-ad">
        <p className="dsk-sb-ad-label">Sponsored</p>
        <div className="dsk-sb-ad-slot">
          <MegaphoneIcon size={28} />
          <p>Advertise here</p>
          <button onClick={() => navigate("/advertise")}>Learn more</button>
        </div>
      </section>
    </aside>
  );
});

/* ══════════════════════════════════════════════════════════════
   FEATURED CARD
══════════════════════════════════════════════════════════════ */
const FeatCard = memo(function FeatCard({
  product, onClick,
}: { product: Product; onClick: (p: Product) => void }) {
  const disc  = discountLabel(product);
  const badge = product.promotion_badge || "promoted";

  return (
    <article
      className="dsk-feat-card"
      role="button" tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
    >
      <div className="dsk-feat-img-wrap">
        <img
          className="dsk-feat-img"
          src={getImageUrl(product) || PH}
          alt={product.title}
          loading="eager"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PH; }}
        />
        <div className="dsk-feat-overlay" aria-hidden="true" />
        {disc && <span className="dsk-feat-disc"><TagIcon size={11} /> {disc}</span>}
        <span className={`dsk-feat-tag dsk-feat-tag--${badge}`}>
          {badge === "featured" ? (
            <><DiamondIcon size={11} /> Featured</>
          ) : badge === "premium" ? (
            <><SponsoredIcon size={11} /> Premium</>
          ) : (
            <><FlashIcon size={11} /> Promoted</>
          )}
        </span>
      </div>
      <div className="dsk-feat-body">
        <p className="dsk-feat-title">{product.title}</p>
        <div className="dsk-feat-foot">
          <span className="dsk-feat-price">{naira(product.price)}</span>
          <span className="dsk-feat-loc">
            <PinIcon size={10} /> {formatCity(product)}
          </span>
        </div>
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   DEAL CARD
══════════════════════════════════════════════════════════════ */
const DealCard = memo(function DealCard({
  product, onClick,
}: { product: Product; onClick: (p: Product) => void }) {
  const disc = discountLabel(product);
  return (
    <article
      className="dsk-deal-card"
      role="button" tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
    >
      <div className="dsk-deal-img-wrap">
        <img
          src={getImageUrl(product) || PH}
          alt={product.title}
          className="dsk-deal-img"
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PH; }}
        />
        {disc && (
          <span className="dsk-deal-disc">
            <TagIcon size={11} /> {disc}
          </span>
        )}
      </div>
      <div className="dsk-deal-body">
        <p className="dsk-deal-title">{product.title}</p>
        <span className="dsk-deal-price">{naira(product.price)}</span>
        <span className="dsk-deal-loc">
          <PinIcon size={10} /> {formatCity(product)}
        </span>
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
interface Props { user?: unknown }

export default function HomepageDesktop({ user }: Props) {
  const navigate = useNavigate();

  const {
    location : savedLocation,
    save     : saveLocation,
    clear    : clearLocation,
  } = useStoredLocation();

  const {
    products, featured, deals, meta,
    loading, loadingMore, error,
    hasMore, total, category,
    filters,
    showOfflineBar,
    loadFeed, loadMore, switchCategory,
    updateFilters, clearFilters,
    dismissOfflineBar,
  } = useDesktopFeed(savedLocation);

  const [pickerOpen, setPickerOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  /* Infinite scroll */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  /* Tracking */
  const handleProductClick = useCallback((product: Product) => {
    if (!product?.id) return;
    navigator.sendBeacon?.(`${API}/homepage/products/${product.id}/click`);
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  const trackView = useCallback((id: string) => {
    if (!id) return;
    navigator.sendBeacon?.(`${API}/homepage/products/${id}/view`);
  }, []);

  const feedTitle = useMemo(() => {
    if (category !== "all")
      return CAT_LIST.find((c) => c.id === category)?.name || "Products";
    const loc = formatLocationLabel(savedLocation);
    if (loc) return `Near ${loc}`;
    if (meta.personalised) return "Recommended for You";
    return "Discover";
  }, [category, savedLocation, meta.personalised]);

  const heroLoc = useMemo(() => {
    const manual = formatLocationLabel(savedLocation);
    if (manual) return manual;
    if (meta?.nearbySource === "gps" && meta.location) return meta.location;
    return null;
  }, [savedLocation, meta]);

  const cols = useMemo(
    () => (typeof window !== "undefined" && window.innerWidth >= 1400 ? 5 : 4),
    []
  );

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="dsk-root">
      <TopNav user={user} />

      <div className="dsk-body">

        {/* ══ HERO ══ */}
        <section className="dsk-hero" aria-label="Welcome">
          <div className="dsk-hero-blob dsk-hero-blob--1" aria-hidden="true" />
          <div className="dsk-hero-blob dsk-hero-blob--2" aria-hidden="true" />

          <div className="dsk-hero-copy">
            <span className="dsk-hero-kicker">
              <CartIcon size={15} /> Loemart Marketplace
            </span>
            <h1 className="dsk-hero-h1">
              Buy &amp; Sell<br />
              <em className="dsk-hero-em">Near You</em>
            </h1>
            <p className="dsk-hero-sub">
              Thousands of verified listings from sellers across Nigeria.
            </p>

            {heroLoc && (
              <p className="dsk-hero-loc">
                <LocationIcon size={13} /> {heroLoc}
              </p>
            )}

            <div className="dsk-hero-actions">
              <button className="dsk-hero-cta"
                      onClick={() => navigate("/search")}>
                Browse Listings
              </button>
              <button className="dsk-hero-cta dsk-hero-cta--outline"
                      onClick={() => navigate("/minimart/add")}>
                <PlusIcon size={14} /> Sell for Free
              </button>
            </div>

            <div className="dsk-hero-stats">
              {loading && total === 0 ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="dsk-hero-stat">
                    <div className="dsk-sk dsk-shimmer"
                         style={{ width: 56, height: 24, borderRadius: 6 }} />
                    <div className="dsk-sk dsk-shimmer"
                         style={{ width: 60, height: 12, borderRadius: 4, marginTop: 4 }} />
                  </div>
                ))
              ) : (
                [
                  { val: fmtCount(total), label: "Listings" },
                  { val: "24/7",          label: "Live"      },
                  { val: "Free",          label: "To list"   },
                ].map((s) => (
                  <div key={s.label} className="dsk-hero-stat">
                    <span className="dsk-hero-stat-val">{s.val}</span>
                    <span className="dsk-hero-stat-label">{s.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dsk-hero-right" aria-hidden={loading}>
            {loading && featured.length === 0 ? (
              <div className="dsk-sk dsk-shimmer dsk-hero-img-sk" />
            ) : featured.slice(0, 1).map((p) => (
              <button key={p.id} className="dsk-hero-feat-preview"
                      onClick={() => handleProductClick(p)}>
                <img src={getImageUrl(p) || PH} alt={p.title}
                     onError={(e) => { (e.currentTarget as HTMLImageElement).src = PH; }} />
                <div className="dsk-hero-feat-info">
                  <span className="dsk-hero-feat-tag">
                    <DiamondIcon size={12} /> Featured
                  </span>
                  <p className="dsk-hero-feat-title">{p.title}</p>
                  <span className="dsk-hero-feat-price">{naira(p.price)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ══ CATEGORIES ══ */}
        <section className="dsk-cat-section" aria-label="Categories">
          <div className="dsk-inner">
            <div className="dsk-cat-grid">
              {CAT_LIST.map((cat) => (
                <button
                  key={cat.id}
                  className={`dsk-cat-btn${category === cat.id ? " dsk-cat-btn--active" : ""}`}
                  onClick={() => switchCategory(cat.id)}
                  aria-pressed={category === cat.id}
                >
                  <span className="dsk-cat-icon" aria-hidden="true">{cat.icon}</span>
                  <span className="dsk-cat-name">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ══ OFFLINE BANNER (soft) ══ */}
        <div className="dsk-inner">
          <OfflineBanner
            visible={showOfflineBar && products.length > 0}
            onRetry={() => loadFeed(category, filters)}
            onDismiss={dismissOfflineBar}
          />
        </div>

        {/* ══ 3-COLUMN LAYOUT ══ */}
        <div className="dsk-inner dsk-layout">

          <LeftSidebar
            category={category}
            onCategory={switchCategory}
            savedLocation={savedLocation}
            onOpenPicker={() => setPickerOpen(true)}
            onClearLoc={clearLocation}
            filters={filters}
            onUpdateFilters={updateFilters}
            onClearFilters={clearFilters}
            resultCount={products.length}
          />

          <main className="dsk-feed" id="dsk-main">

            {/* Hard error — only when nothing cached to show */}
            {error && products.length === 0 && (
              <div className="dsk-error" role="alert">
                <span className="dsk-error-icon"><ZapIcon size={20} /></span>
                <p className="dsk-error-title">Marketplace unavailable</p>
                <p>{error}</p>
                <button onClick={() => loadFeed(category, filters, { forceSpinner: true })}>
                  Try again
                </button>
              </div>
            )}

            {/* Featured */}
            {(loading || featured.length > 0) && (
              <section className="dsk-section">
                <div className="dsk-section-head">
                  <h2 className="dsk-section-title">
                    <DiamondIcon size={15} /> Featured
                  </h2>
                </div>
                {loading && featured.length === 0 ? (
                  <div className="dsk-feat-grid">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="dsk-sk dsk-shimmer"
                           style={{ height: 280, borderRadius: 14 }} />
                    ))}
                  </div>
                ) : (
                  <div className="dsk-feat-grid">
                    {featured.map((p) => (
                      <FeatCard key={p.id} product={p}
                                onClick={handleProductClick} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Deals */}
            {!loading && deals.length > 0 && (
              <section className="dsk-section">
                <div className="dsk-section-head">
                  <h2 className="dsk-section-title">
                    <DealsIcon size={15} /> Cheap Deals
                  </h2>
                  <button className="dsk-section-link"
                          onClick={() => navigate("/deals")}>
                    See all <ChevronRightIcon size={12} />
                  </button>
                </div>
                <div className="dsk-deals-grid">
                  {deals.map((p) => (
                    <DealCard key={p.id} product={p}
                              onClick={handleProductClick} />
                  ))}
                </div>
              </section>
            )}

            {/* Main Feed — blended (organic + promoted + random) */}
            <section className="dsk-section">
              <div className="dsk-section-head">
                <h2 className="dsk-section-title">
                  {feedTitle}
                  {meta.personalised && (
                    <span
                      className="dsk-feed-personalised"
                      title="Tailored to your recent activity"
                    >
                      <SparkleIcon size={11} /> For you
                    </span>
                  )}
                </h2>
                {category !== "all" && (
                  <button className="dsk-cat-clear"
                          onClick={() => switchCategory("all")}>
                    × Clear filter
                  </button>
                )}
              </div>

              {loading && products.length === 0 ? (
                <GridSkeleton cols={cols} />
              ) : (error && products.length === 0) ? null : products.length === 0 ? (
                <div className="dsk-empty">
                  <span className="dsk-empty-icon"><BagIcon size={36} /></span>
                  <h3>No listings found</h3>
                  <p>Try adjusting your filters or location.</p>
                  <div className="dsk-empty-actions">
                    <button onClick={() => clearFilters()}>
                      Clear filters
                    </button>
                    <button className="dsk-empty-btn--outline"
                            onClick={() => switchCategory("all")}>
                      Browse all
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="dsk-grid"
                       style={{ "--cols": cols } as React.CSSProperties}
                       role="list">
                    {products.map((p, i) => (
                      <div key={p.id} role="listitem" data-slot={p.feed_slot}>
                        <MasonryCard
                          product={p}
                          priority={i < 8}
                          onView={trackView}
                          onClick={handleProductClick}
                        />
                      </div>
                    ))}
                  </div>

                  <div ref={sentinelRef} aria-hidden="true"
                       style={{ height: 1 }} />

                  {loadingMore && (
                    <p className="dsk-loading-more">
                      <span className="dsk-spinner" /> Loading more…
                    </p>
                  )}

                  {!hasMore && products.length > 0 && (
                    <div className="dsk-feed-end">
                      <p>You've seen it all</p>
                      <button onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }>
                        Back to top <ChevronUpIcon size={13} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Sell Banner */}
            {!loading && (
              <section className="dsk-sell-banner">
                <div className="dsk-sell-blob" aria-hidden="true" />
                <div className="dsk-sell-content">
                  <div>
                    <h2>Start Selling on Loemart</h2>
                    <p>List your products for free and reach thousands of buyers.</p>
                  </div>
                  <button onClick={() => navigate("/minimart/add")}>
                    <PlusIcon size={14} /> List for Free
                  </button>
                </div>
              </section>
            )}

            {!loading && <Footer />}
          </main>

          <RightSidebar navigate={navigate} />
        </div>
      </div>

      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(loc) => { saveLocation(loc); setPickerOpen(false); }}
      />
    </div>
  );
}