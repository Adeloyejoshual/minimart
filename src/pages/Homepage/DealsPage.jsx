// src/pages/DealsPage.jsx
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav          from "../../components/TopNav";
import BottomNav       from "../../components/BottomNav";
import Footer          from "../../components/Footer";
import MasonryCard, {
  naira,
  getImageUrl,
  formatCity,
  PinIcon,
}                      from "../../components/MasonryCard";
import "../../styles/DealsPage.css";

const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const PAGE_SIZE = 40;
const STALE_MS  = 5 * 60_000;

const SORT_OPTIONS = [
  { value: "newest",       label: "Newest",  apiVal: "created_desc"   },
  { value: "price_lo",     label: "Price ↑", apiVal: "price_asc"      },
  { value: "price_hi",     label: "Price ↓", apiVal: "price_desc"     },
  { value: "most_popular", label: "Popular", apiVal: "engagement_desc" },
];

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const BackIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

const ShareIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
  </svg>
);

const TagIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59
      8.59a2 2 0 010 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const FlashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const SortIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 20V4" />
  </svg>
);

const ChevronUpIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
    aria-hidden="true">
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

const ZapIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const BagIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
);

const DiamondIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h12l4 6-10 13L2 9z" />
    <path d="M2 9h20M10 3l-4 6 6 13 6-13-4-6" />
  </svg>
);

const StarIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"
    fill="currentColor" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12
      17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const normalizeProduct = (p) => {
  if (!p || typeof p !== "object" || !p.id) return null;

  let image = p.image || p.main_image || p.thumbnail_url || null;
  if (!image && Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    image = typeof first === "string" ? first : (first?.url || null);
  }

  return {
    ...p,
    image,
    price             : Number(p.price              || 0),
    engagement_score  : Number(p.engagement_score   || 0),
    clicks_count      : Number(p.clicks_count        || 0),
    impression_count  : Number(p.impression_count    || 0),
    views             : Number(p.views               || 0),
    ctr               : Number(p.ctr                 || 0),
    promotion_priority: Number(p.promotion_priority  || 0),
    search_priority   : Number(p.search_priority     || 0),
    favorites_count   : Number(p.favorites_count     || 0),
    discount_pct      : Number(p.discount_pct        || 0),
    is_promoted       : !!p.is_promoted,
    is_featured       : !!p.is_featured,
    promotion_badge   : p.promotion_badge || null,
    original_price    : Number(
      p.attributes?.original_price ||
      p.original_price             ||
      0
    ),
    location_city  : p.location?.city  || p.location_city  || null,
    location_state : p.location?.state || p.location_state || null,
    seller: {
      id              : p.seller?.id               || p.seller_id   || null,
      name            : p.seller?.name             || p.seller_name || null,
      verified        : !!(p.seller?.verified      ?? false),
      subscriptionPlan: p.seller?.subscriptionPlan || null,
      subscriptionRank: Number(p.seller?.subscriptionRank || 0),
    },
  };
};

const dedup = (arr) => {
  const seen = new Set();
  return arr.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
};

const discountPct = (p) => {
  if (!p) return 0;
  if (p.discount_pct > 0) return p.discount_pct;
  const orig = p.original_price || 0;
  const curr = p.price          || 0;
  if (orig > curr && curr > 0)
    return Math.round(((orig - curr) / orig) * 100);
  return 0;
};

const discountLabel = (p) => {
  const pct = discountPct(p);
  return pct > 0 ? `${pct}% off` : null;
};

const getBadgeConfig = (badge) => {
  if (badge === "featured") return {
    label: "Elite",
    icon : <DiamondIcon size={11} />,
    style: { background: "linear-gradient(135deg,#7c3aed,#0ea5e9)",
             color: "#fff" },
  };
  if (badge === "premium") return {
    label: "Premium",
    icon : <StarIcon size={11} />,
    style: { background: "linear-gradient(135deg,#f59e0b,#ef4444)",
             color: "#fff" },
  };
  if (badge === "promoted") return {
    label: "Ad",
    icon : <FlashIcon size={11} />,
    style: { background: "rgba(0,0,0,0.55)", color: "#fff" },
  };
  return null;
};

/* ══════════════════════════════════════════════════════════════
   BUILD URL
══════════════════════════════════════════════════════════════ */
const buildUrl = (pg = 0, sortOpt = "newest") => {
  const params = new URLSearchParams({
    section: "deals",
    limit  : PAGE_SIZE,
    page   : pg,
  });

  const apiVal = SORT_OPTIONS.find((s) => s.value === sortOpt)?.apiVal;
  if (apiVal && apiVal !== "created_desc") params.set("sort", apiVal);

  return `${API}/homepage?${params}`;
};

/* ══════════════════════════════════════════════════════════════
   SKELETON
══════════════════════════════════════════════════════════════ */
const MasonrySkeleton = memo(function MasonrySkeleton() {
  return (
    <div className="deals-masonry" aria-busy="true"
      aria-label="Loading deals">
      {[180, 220, 160, 200, 180, 190, 220, 170, 200, 180].map((h, i) => (
        <div key={i} className="dc-sk deals-shimmer"
          style={{ height: h }} aria-hidden="true" />
      ))}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   DEAL CARD
══════════════════════════════════════════════════════════════ */
const PH = "https://placehold.co/600x500/e8e4dc/b0a89e?text=No+Image";

const DealCard = memo(function DealCard({ product, onView, onClick }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !product?.id) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onView?.(product.id);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [product?.id, onView]);

  if (!product) return null;

  const imgUrl = getImageUrl(product) || PH;
  const disc   = discountLabel(product);
  const loc    = formatCity(product);
  const badge  = getBadgeConfig(product.promotion_badge);

  return (
    <article
      ref={cardRef}
      className="masonry-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      aria-label={`${product.title} — ${naira(product.price)}`}>

      {badge && (
        <span className="bd" style={badge.style}>
          {badge.icon} {badge.label}
        </span>
      )}

      {disc && !badge && (
        <span className="bd" style={{ background: "#e74c3c", color: "#fff" }}>
          {disc}
        </span>
      )}

      <div style={{ position: "relative", overflow: "hidden",
        background: "rgba(0,0,0,0.04)" }}>

        {!imgLoaded && (
          <div className="deals-shimmer"
            style={{ position: "absolute", inset: 0, minHeight: 140 }}
            aria-hidden="true" />
        )}

        <img
          className="masonry-img"
          src={imgUrl}
          alt={product.title || "Deal"}
          loading="lazy"
          style={{
            opacity   : imgLoaded ? 1 : 0,
            transition: "opacity .3s ease",
          }}
          onLoad={() => setImgLoaded(true)}
          onError={(e) => {
            e.currentTarget.src = PH;
            setImgLoaded(true);
          }}
        />

        {disc && (
          <span className="deals-disc-pip" aria-hidden="true">
            <FlashIcon size={10} /> {disc}
          </span>
        )}
      </div>

      <div className="masonry-body">
        <p className="masonry-name">{product.title}</p>
        <p className="masonry-price">{naira(product.price)}</p>

        {product.original_price > product.price && (
          <p className="deals-orig-price">
            {naira(product.original_price)}
          </p>
        )}

        {loc && (
          <p className="masonry-loc">
            <PinIcon size={10} /> {loc}
          </p>
        )}

        {product.seller?.verified && (
          <p className="vfd">✓ Verified Seller</p>
        )}

        {product.seller?.subscriptionRank >= 5 && (
          <p className="deals-elite-seller">
            <DiamondIcon size={10} />{" "}
            {product.seller.subscriptionPlan}
          </p>
        )}
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   MOBILE HEADER
══════════════════════════════════════════════════════════════ */
const DealsHeader = memo(function DealsHeader({ onBack, onShare }) {
  return (
    <header className="dh-wrap">
      <button className="dh-back" onClick={onBack}
        aria-label="Go back">
        <BackIcon size={18} />
      </button>

      <div className="dh-title-wrap">
        <h1 className="dh-title">Deals</h1>
        <span className="dh-chip">
          <span className="dh-chip-dot" aria-hidden="true" />
          Live
        </span>
      </div>

      <button className="dh-share" onClick={onShare}
        aria-label="Share deals">
        <ShareIcon size={16} />
      </button>
    </header>
  );
});

/* ══════════════════════════════════════════════════════════════
   FILTER BAR
══════════════════════════════════════════════════════════════ */
const FilterBar = memo(function FilterBar({ total, filtered, sort, onSort }) {
  return (
    <div className="df-bar" role="search" aria-label="Filter deals">
      <span className="df-count">
        {filtered} of {total}
      </span>

      <div className="df-controls">
        <div className="df-select-wrap">
          <label className="df-label" htmlFor="deals-sort-select">
            <SortIcon size={11} /> Sort
          </label>
          <select
            id="deals-sort-select"
            className="df-select"
            value={sort}
            onChange={(e) => onSort(e.target.value)}
            aria-label="Sort deals">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   SCROLL TO TOP
══════════════════════════════════════════════════════════════ */
function ScrollTopBtn() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <button
      className={`deals-scroll-top${visible ? " visible" : ""}`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      tabIndex={visible ? 0 : -1}>
      <ChevronUpIcon size={16} />
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   DEALS PAGE
══════════════════════════════════════════════════════════════ */
export default function DealsPage({ user }) {
  const navigate = useNavigate();

  const [allDeals,    setAllDeals]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(0);
  const [total,       setTotal]       = useState(0);
  const [sort,        setSort]        = useState("newest");

  const dealsRef    = useRef([]);
  const sentinelRef = useRef(null);
  const hiddenAtRef = useRef(null);

  const applyData = useCallback((data, append = false) => {
    const raw = Array.isArray(data.products) ? data.products
              : Array.isArray(data.deals)    ? data.deals
              : [];

    const normalized = dedup(raw).map(normalizeProduct).filter(Boolean);
    const merged = append
      ? dedup([...dealsRef.current, ...normalized])
      : normalized;

    dealsRef.current = merged;
    setAllDeals(merged);
    setTotal((prev) => data.meta?.total > 0 ? data.meta.total : prev);
    setHasMore(
      data.hasMore        ??
      data.meta?.has_more ??
      raw.length >= PAGE_SIZE
    );
  }, []);

  const loadFeed = useCallback(async (sortVal = "newest") => {
    setLoading(true);
    setError(null);
    setPage(0);
    dealsRef.current = [];
    try {
      const res = await fetch(buildUrl(0, sortVal));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyData(await res.json(), false);
    } catch (err) {
      console.error("[DealsPage]", err);
      setError("Could not load deals. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [applyData]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res  = await fetch(buildUrl(next, sort));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyData(await res.json(), true);
      setPage(next);
    } catch (err) {
      console.error("[DealsPage] loadMore:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, sort, applyData]);

  const switchSort = useCallback((sortVal) => {
    if (sortVal === sort) return;
    setSort(sortVal);
    loadFeed(sortVal);
  }, [sort, loadFeed]);

  useEffect(() => {
    loadFeed("newest");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else {
        const elapsed = Date.now() - (hiddenAtRef.current || 0);
        if (!loading && elapsed > STALE_MS) loadFeed(sort);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loading, sort, loadFeed]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1, rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  const trackView = useCallback((id) => {
    if (!id) return;
    fetch(`${API}/homepage/products/${id}/view`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
  }, []);

  const handleProductClick = useCallback((product) => {
    if (!product?.id) return;
    fetch(`${API}/homepage/products/${product.id}/click`, {
      method: "POST", keepalive: true,
    }).catch(() => {});
    navigate(`/product/${product.slug || product.id}`);
  }, [navigate]);

  const handleBack  = useCallback(() => window.history.back(), []);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: "Cheap Deals on Loemart",
      text : "Check out these discounted listings!",
      url  : window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(shareData.url);
    } catch {}
  }, []);

  const displayDeals = useMemo(() => {
    const out = [...allDeals];
    if (sort === "price_lo")      out.sort((a, b) => a.price - b.price);
    else if (sort === "price_hi") out.sort((a, b) => b.price - a.price);
    else if (sort === "most_popular")
      out.sort((a, b) => b.engagement_score - a.engagement_score);
    return out;
  }, [allDeals, sort]);

  return (
    <div className="deals-root">
      <TopNav user={user} />

      <main className="deals-page" id="deals-main">

        <DealsHeader onBack={handleBack} onShare={handleShare} />

        {/* FILTER BAR */}
        {!loading && !error && (
          <FilterBar
            total={total}
            filtered={displayDeals.length}
            sort={sort}
            onSort={switchSort}
          />
        )}

        {/* RESULT COUNT */}
        {!loading && !error && displayDeals.length > 0 && (
          <div className="deals-result-count"
            aria-live="polite" aria-atomic="true">
            Showing{" "}
            <span className="deals-result-count-num">
              {displayDeals.length}
            </span>
            {" "}deal{displayDeals.length !== 1 ? "s" : ""} under ₦50,000
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="deals-err" role="alert">
            <span className="deals-err-icon"><ZapIcon size={20} /></span>
            <p className="deals-err-title">Could not load deals</p>
            <p className="deals-err-msg">{error}</p>
            <button className="deals-err-btn"
              onClick={() => loadFeed(sort)}>
              Try again
            </button>
          </div>
        )}

        {/* SKELETON */}
        {loading && !error && <MasonrySkeleton />}

        {/* EMPTY */}
        {!loading && !error && displayDeals.length === 0 && (
          <div className="deals-empty">
            <span className="deals-empty-emoji">
              <BagIcon size={40} />
            </span>
            <h3 className="deals-empty-title">No deals right now</h3>
            <p className="deals-empty-sub">
              Check back soon — sellers add new discounts daily.
            </p>
            <button className="deals-empty-btn"
              onClick={() => loadFeed(sort)}>
              Reload
            </button>
          </div>
        )}

        {/* MASONRY GRID */}
        {!loading && !error && displayDeals.length > 0 && (
          <section className="hm-section">
            <div className="hm-section-head">
              <h2 className="hm-section-title">
                <TagIcon size={16} /> All Deals
              </h2>
            </div>

            <div className="deals-masonry" role="list"
              aria-label="Deals grid">
              {displayDeals.map((p) => (
                <div key={p.id} role="listitem">
                  <DealCard
                    product={p}
                    onView={trackView}
                    onClick={handleProductClick}
                  />
                </div>
              ))}
            </div>

            <div ref={sentinelRef} aria-hidden="true"
              style={{ height: 1 }} />

            {loadingMore && (
              <p className="deals-loading-more" aria-live="polite">
                <span className="deals-spinner" aria-hidden="true" />
                Loading more deals…
              </p>
            )}

            {!hasMore && displayDeals.length > 0 && !loadingMore && (
              <div className="deals-feed-end-wrap">
                <p className="deals-feed-end">
                  🎉 You've seen all {displayDeals.length} deals!
                </p>
                <button className="deals-feed-end-btn"
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }>
                  Back to top <ChevronUpIcon size={14} />
                </button>
              </div>
            )}
          </section>
        )}

        {!loading && <Footer />}
      </main>

      <ScrollTopBtn />
      <BottomNav />
    </div>
  );
}