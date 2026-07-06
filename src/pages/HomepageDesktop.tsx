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

/* ── constants ── */
const PH      = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";
const API     = `${import.meta.env.VITE_API_BASE_URL || window.location.origin}/api`;
const ALL_CAT = { id: "all", name: "All", icon: "✦" };
const CAT_LIST = [ALL_CAT, ...CATEGORIES];

const TRENDING_SEARCHES = [
  "iPhone 15", "Toyota Camry", "MacBook Pro",
  "Generator", "Sofa set", "Fridge",
];

/* ── helpers ── */
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

/* ════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════ */

/* ── Grid Skeleton ── */
const GridSkeleton = memo(function GridSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="dsk-grid" style={{ "--cols": cols } as React.CSSProperties}
         aria-busy="true">
      {Array.from({ length: cols * 3 }).map((_, i) => (
        <div key={i} className="dsk-sk dsk-shimmer" style={{ height: 260 }}
             aria-hidden="true" />
      ))}
    </div>
  );
});

/* ── Left Sidebar with WORKING FILTERS ── */
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
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [localCondition, setLocalCondition] = useState("all");
  const locLabel = formatLocationLabel(savedLocation);

  /* sync from external filters */
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
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleApplyPrice();
    },
    [handleApplyPrice]
  );

  const hasActiveFilters =
    filters.priceMin != null ||
    filters.priceMax != null ||
    (filters.condition && filters.condition !== "all");

  return (
    <aside className="dsk-sidebar-left" aria-label="Filters">

      {/* Active filters badge */}
      {hasActiveFilters && (
        <div className="dsk-sb-active-filters">
          <div className="dsk-sb-active-head">
            <span className="dsk-sb-active-badge">
              Filters active
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

      {/* Categories */}
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

      {/* Location */}
      <section className="dsk-sb-section">
        <h3 className="dsk-sb-title">Location</h3>
        <button className="dsk-sb-loc-btn" onClick={onOpenPicker}>
          <PinIcon size={13} />
          <span>{locLabel || "Set location"}</span>
        </button>
        {locLabel && (
          <button className="dsk-sb-loc-clear" onClick={onClearLoc}>
            Clear location ✕
          </button>
        )}
      </section>

      {/* Price Range — WORKING */}
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

      {/* Condition — WORKING (instant) */}
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

/* ── Right Sidebar ── */
interface RightSidebarProps { navigate: (path: string) => void }

const RightSidebar = memo(function RightSidebar({ navigate }: RightSidebarProps) {
  return (
    <aside className="dsk-sidebar-right" aria-label="Trending">

      <section className="dsk-sb-section">
        <h3 className="dsk-sb-title">🔥 Trending Searches</h3>
        <ul className="dsk-trend-list" role="list">
          {TRENDING_SEARCHES.map((q, i) => (
            <li key={q}>
              <button
                className="dsk-trend-item"
                onClick={() => navigate(`/search?q=${encodeURIComponent(q)}`)}
              >
                <span className="dsk-trend-rank">{i + 1}</span>
                <span className="dsk-trend-label">{q}</span>
                <svg width="12" height="12" viewBox="0 0 24 24"
                     fill="currentColor" aria-hidden="true">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                </svg>
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
          <span aria-hidden="true">📢</span>
          <p>Advertise here</p>
          <button onClick={() => navigate("/advertise")}>Learn more</button>
        </div>
      </section>
    </aside>
  );
});

/* ── Featured Card ── */
const FeatCard = memo(function FeatCard({
  product, onClick,
}: { product: Product; onClick: (p: Product) => void }) {
  const disc = discountLabel(product);
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
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        <div className="dsk-feat-overlay" aria-hidden="true" />
        {disc && <span className="dsk-feat-disc">{disc}</span>}
        <span className="dsk-feat-tag">
          {product.promotion_type === "flash" ? "⚡ Flash" : "💎 Sponsored"}
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

/* ── Deal Card ── */
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
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        {disc && <span className="dsk-deal-disc">{disc}</span>}
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

/* ════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════ */
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
    loadFeed, loadMore, switchCategory,
    updateFilters, clearFilters,
  } = useDesktopFeed(savedLocation);

  const [pickerOpen, setPickerOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  /* infinite scroll */
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

  /* click + view tracking */
  const handleProductClick = useCallback((product: Product) => {
    if (!product?.id) return;
    navigator.sendBeacon?.(`${API}/products/${product.id}/click`);
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  const trackView = useCallback((id: string) => {
    if (!id) return;
    navigator.sendBeacon?.(`${API}/products/${id}/view`);
  }, []);

  /* derived */
  const feedTitle = useMemo(() => {
    if (category !== "all")
      return CAT_LIST.find((c) => c.id === category)?.name || "Products";
    const loc = formatLocationLabel(savedLocation);
    return loc ? `Near ${loc}` : "Recommended for You";
  }, [category, savedLocation]);

  const cols = useMemo(
    () => (typeof window !== "undefined" && window.innerWidth >= 1400 ? 5 : 4),
    []
  );

  /* ── RENDER ── */
  return (
    <div className="dsk-root">
      <TopNav user={user} />

      <div className="dsk-body">

        {/* ══ HERO ══ */}
        <section className="dsk-hero" aria-label="Welcome">
          <div className="dsk-hero-blob dsk-hero-blob--1" aria-hidden="true" />
          <div className="dsk-hero-blob dsk-hero-blob--2" aria-hidden="true" />

          <div className="dsk-hero-copy">
            <span className="dsk-hero-kicker">🛒 Loemart Marketplace</span>
            <h1 className="dsk-hero-h1">
              Buy &amp; Sell<br />
              <em className="dsk-hero-em">Near You</em>
            </h1>
            <p className="dsk-hero-sub">
              Thousands of verified listings from sellers across Nigeria.
            </p>
            <div className="dsk-hero-actions">
              <button className="dsk-hero-cta"
                      onClick={() => navigate("/search")}>
                Browse Listings
              </button>
              <button className="dsk-hero-cta dsk-hero-cta--outline"
                      onClick={() => navigate("/minimart/add")}>
                Sell for Free
              </button>
            </div>

            <div className="dsk-hero-stats">
              {loading ? (
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
                  { val: "24/7",          label: "Live" },
                  { val: "Free",          label: "To list" },
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
            {loading ? (
              <div className="dsk-sk dsk-shimmer dsk-hero-img-sk" />
            ) : featured.slice(0, 1).map((p) => (
              <button key={p.id} className="dsk-hero-feat-preview"
                      onClick={() => handleProductClick(p)}>
                <img src={getImageUrl(p) || PH} alt={p.title}
                     onError={(e) => { e.currentTarget.src = PH; }} />
                <div className="dsk-hero-feat-info">
                  <span className="dsk-hero-feat-tag">💎 Featured</span>
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

        {/* ══ 3-COLUMN LAYOUT ══ */}
        <div className="dsk-inner dsk-layout">

          {/* Left Sidebar — with working filters */}
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

          {/* Centre Feed */}
          <main className="dsk-feed" id="dsk-main">

            {error && (
              <div className="dsk-error" role="alert">
                <span>⚡</span>
                <p>{error}</p>
                <button onClick={() => loadFeed(category)}>Try again</button>
              </div>
            )}

            {/* Featured */}
            {(loading || featured.length > 0) && (
              <section className="dsk-section">
                <div className="dsk-section-head">
                  <h2 className="dsk-section-title">💎 Featured</h2>
                </div>
                {loading ? (
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
                  <h2 className="dsk-section-title">💸 Cheap Deals</h2>
                  <button className="dsk-section-link"
                          onClick={() => navigate("/deals")}>
                    See all →
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

            {/* Main Feed */}
            <section className="dsk-section">
              <div className="dsk-section-head">
                <h2 className="dsk-section-title">{feedTitle}</h2>
                {category !== "all" && (
                  <button className="dsk-cat-clear"
                          onClick={() => switchCategory("all")}>
                    ✕ Clear filter
                  </button>
                )}
              </div>

              {loading ? (
                <GridSkeleton cols={cols} />
              ) : error ? null : products.length === 0 ? (
                <div className="dsk-empty">
                  <span className="dsk-empty-emoji">🛍️</span>
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
                      <div key={p.id} role="listitem">
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
                      <p>You've seen it all 🎉</p>
                      <button onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }>Back to top ↑</button>
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
                    List for Free →
                  </button>
                </div>
              </section>
            )}

            {!loading && <Footer />}
          </main>

          {/* Right Sidebar */}
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