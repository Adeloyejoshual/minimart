// src/pages/Profile/SavedItems.jsx — v3
//
// Changes from v2:
//  ─ Moved all styles to SavedItems.css (no inline <style> block)
//  ─ Cards match real product listing style
//  ─ Price shown in green (var(--gn)) matching site tokens
//  ─ Image uses aspect-ratio 4/3 like product cards
//  ─ Negotiable removed from tags
//  ─ Better typography hierarchy

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../styles/SavedItems.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API       = `${BASE_URL}/api`;
const FAV_KEY   = "loemart_favs";
const PH        = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect fill='%23f3f4f6' width='300' height='300'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23d1d5db' font-size='13'%3ENo image%3C/text%3E%3C/svg%3E";
const PAGE_SIZE = 20;

/* ═══════════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)        return "just now";
  if (s < 3_600)     return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400)    return `${Math.floor(s / 3_600)}h ago`;
  if (s < 2_592_000) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
};

const getItemImage = (item) => {
  if (Array.isArray(item.images) && item.images.length > 0) {
    const sorted = [...item.images]
      .filter((img) => img?.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (sorted.length > 0) return sorted[0].url;
  }
  if (typeof item.images === "string") {
    try {
      const parsed = JSON.parse(item.images);
      if (Array.isArray(parsed) && parsed[0]?.url) return parsed[0].url;
    } catch {}
  }
  return item.thumbnail_url || item.main_image || item.image || PH;
};

const removeFavFromStorage = (productId) => {
  try {
    const favs = JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
    delete favs[productId];
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   ICONS  (transparent SVG)
═══════════════════════════════════════════════════════════════ */
const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const IconHeart = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconPin = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconEye = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconSort = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="7" y1="12" x2="17" y2="12" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </svg>
);

const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconRefresh = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   UNDO TOAST
═══════════════════════════════════════════════════════════════ */
const UndoToast = memo(function UndoToast({ item, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4_000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  if (!item) return null;

  return (
    <div className="sv-undo-toast" role="status" aria-live="polite">
      <span className="sv-undo-text">
        "{item.title?.slice(0, 28)}{item.title?.length > 28 ? "…" : ""}" removed
      </span>
      <button className="sv-undo-btn" onClick={onUndo} type="button">
        Undo
      </button>
      <button
        className="sv-undo-close"
        onClick={onDismiss}
        type="button"
        aria-label="Dismiss"
      >
        <IconX />
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON CARD — matches real card proportions
═══════════════════════════════════════════════════════════════ */
const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="sv-skeleton" aria-hidden="true">
      <div className="sv-sk sv-sk-img" />
      <div className="sv-sk-body">
        <div className="sv-sk sv-sk-line" style={{ width: "40%",  height: 9  }} />
        <div className="sv-sk sv-sk-line" style={{ width: "88%",  height: 14, marginTop: 5 }} />
        <div className="sv-sk sv-sk-line" style={{ width: "65%",  height: 14, marginTop: 3 }} />
        <div className="sv-sk sv-sk-line" style={{ width: "50%",  height: 20, marginTop: 8 }} />
        <div className="sv-sk sv-sk-line" style={{ width: "55%",  height: 10, marginTop: 8 }} />
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SAVED CARD  — matches real product card style
═══════════════════════════════════════════════════════════════ */
const SavedCard = memo(function SavedCard({ item, onRemove, isRemoving }) {
  const image    = getItemImage(item);
  const discount = item.original_price && item.original_price > item.price
    ? Math.round((1 - item.price / item.original_price) * 100)
    : null;
  const daysLeft = item.active_until
    ? Math.ceil((new Date(item.active_until) - Date.now()) / 86_400_000)
    : null;
  const expireSoon = item.is_trial && daysLeft !== null && daysLeft <= 3;

  return (
    <article
      className={[
        "sv-card",
        isRemoving  ? "sv-card--removing"  : "",
        expireSoon  ? "sv-card--expiring"  : "",
      ].filter(Boolean).join(" ")}
      aria-label={item.title}
    >
      {/* ── Image ── */}
      <Link
        to={`/product/${item.slug}`}
        className="sv-card-img-wrap"
        aria-label={`View ${item.title}`}
        tabIndex={-1}
      >
        <img
          src={image}
          alt={item.title}
          className="sv-card-img"
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {/* Promoted */}
        {item.is_promoted && (
          <span className="sv-badge sv-badge--promoted">Featured</span>
        )}

        {/* Discount */}
        {discount && (
          <span className="sv-badge sv-badge--discount">-{discount}%</span>
        )}

        {/* Trial */}
        {item.is_trial && daysLeft !== null && daysLeft > 0 && (
          <span className={`sv-badge sv-badge--trial${expireSoon ? " sv-badge--urgent" : ""}`}>
            {daysLeft}d left
          </span>
        )}

        {/* Expired */}
        {item.is_trial && daysLeft !== null && daysLeft <= 0 && (
          <span className="sv-badge sv-badge--expired">Expired</span>
        )}

        {/* Remove */}
        <button
          className="sv-remove-btn"
          onClick={(e) => { e.preventDefault(); onRemove(item); }}
          disabled={isRemoving}
          aria-label={`Remove ${item.title} from saved`}
          type="button"
        >
          <IconTrash />
        </button>
      </Link>

      {/* ── Body ── */}
      <div className="sv-card-body">

        {/* Category breadcrumb */}
        {item.category_name && (
          <p className="sv-card-cat">
            {item.category_name}
            {item.subcategory_name && (
              <span className="sv-cat-sep"> › {item.subcategory_name}</span>
            )}
          </p>
        )}

        {/* Title */}
        <Link to={`/product/${item.slug}`} className="sv-card-title">
          {item.title}
        </Link>

        {/* Condition */}
        {item.condition && (
          <p className="sv-card-condition">{item.condition}</p>
        )}

        {/* Price */}
        <div className="sv-card-price-row">
          <span className="sv-card-price">{naira(item.price)}</span>
          {item.original_price && item.original_price > item.price && (
            <span className="sv-card-price-old">{naira(item.original_price)}</span>
          )}
        </div>

        {/* Location + views */}
        <div className="sv-card-meta">
          {(item.location_city || item.location_state) && (
            <span className="sv-card-meta-item">
              <IconPin />
              {[item.location_city, item.location_state].filter(Boolean).join(", ")}
            </span>
          )}
          {item.views > 0 && (
            <span className="sv-card-meta-item">
              <IconEye />
              {Number(item.views).toLocaleString()}
            </span>
          )}
        </div>

        {/* Saved time */}
        <p className="sv-card-saved">Saved {timeAgo(item.saved_at)}</p>
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SavedItems({ user }) {
  const navigate = useNavigate();

  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [removing,    setRemoving]    = useState(null);
  const [undoItem,    setUndoItem]    = useState(null);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(false);
  const [total,       setTotal]       = useState(0);
  const [query,       setQuery]       = useState("");
  const [sort,        setSort]        = useState("newest");
  const [refreshing,  setRefreshing]  = useState(false);

  const pendingRemove = useRef(null);
  const pullStartY    = useRef(null);

  /* ── Fetch ──────────────────────────────────────────────── */
  const fetchItems = useCallback(async (pageNum = 1, append = false) => {
    const token = getToken();
    if (!token) { navigate("/auth"); return; }

    try {
      append ? setLoadingMore(true) : setLoading(true);
      setError(null);

      const params = new URLSearchParams({ page: pageNum, limit: PAGE_SIZE });
      const res = await fetch(`${API}/favorites?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) { navigate("/auth"); return; }
      if (!res.ok) throw new Error("Failed to load saved items");

      const data = await res.json();
      const rows = data.data || [];

      setItems((prev) => append ? [...prev, ...rows] : rows);
      setTotal(data.total ?? rows.length);
      setHasMore(data.has_more ?? false);
      setPage(pageNum);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => { fetchItems(1); }, [fetchItems]);

  /* ── Pull to refresh ────────────────────────────────────── */
  const handleTouchStart = useCallback((e) => {
    if (window.scrollY === 0) pullStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (pullStartY.current === null) return;
    const diff = e.changedTouches[0].clientY - pullStartY.current;
    pullStartY.current = null;
    if (diff > 80) { setRefreshing(true); fetchItems(1); }
  }, [fetchItems]);

  /* ── Remove with undo ───────────────────────────────────── */
  const handleRemove = useCallback((item) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setTotal((t) => Math.max(0, t - 1));
    setUndoItem(item);
    removeFavFromStorage(item.id);

    if (pendingRemove.current) clearTimeout(pendingRemove.current.timer);

    const timer = setTimeout(async () => {
      const token = getToken();
      if (!token) return;
      try {
        setRemoving(item.id);
        await fetch(`${API}/favorites/${item.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        setItems((prev) =>
          [...prev, item].sort(
            (a, b) => new Date(b.saved_at) - new Date(a.saved_at)
          )
        );
        setTotal((t) => t + 1);
        try {
          const favs = JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
          favs[item.id] = true;
          localStorage.setItem(FAV_KEY, JSON.stringify(favs));
        } catch {}
      } finally {
        setRemoving(null);
        pendingRemove.current = null;
      }
    }, 4_000);

    pendingRemove.current = { item, timer };
  }, []);

  const handleUndo = useCallback(() => {
    if (!pendingRemove.current) return;
    clearTimeout(pendingRemove.current.timer);
    const { item } = pendingRemove.current;
    pendingRemove.current = null;

    setItems((prev) =>
      [...prev, item].sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at))
    );
    setTotal((t) => t + 1);

    try {
      const favs = JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
      favs[item.id] = true;
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    } catch {}

    setUndoItem(null);
  }, []);

  const dismissUndo = useCallback(() => setUndoItem(null), []);

  /* ── Filter + Sort ──────────────────────────────────────── */
  const displayed = useMemo(() => {
    let result = [...items];

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.category_name?.toLowerCase().includes(q) ||
          item.location_city?.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case "price_asc":
        result.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price_desc":
        result.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      default:
        result.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
    }

    return result;
  }, [items, query, sort]);

  /* ── Loading ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="sv-page">
        <header className="sv-header">
          <button className="sv-back-btn" onClick={() => navigate(-1)}
            type="button" aria-label="Go back">
            <IconBack />
          </button>
          <h1 className="sv-header-title">Saved Items</h1>
          <div className="sv-header-spacer" />
        </header>
        <div className="sv-scroll">
          <div className="sv-grid">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ──────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="sv-page">
        <header className="sv-header">
          <button className="sv-back-btn" onClick={() => navigate(-1)}
            type="button" aria-label="Go back">
            <IconBack />
          </button>
          <h1 className="sv-header-title">Saved Items</h1>
          <div className="sv-header-spacer" />
        </header>
        <div className="sv-error-wrap" role="alert">
          <p className="sv-error-msg">{error}</p>
          <button className="sv-retry-btn" onClick={() => fetchItems(1)} type="button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* ── Main render ────────────────────────────────────────── */
  return (
    <div
      className="sv-page"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {undoItem && (
        <UndoToast item={undoItem} onUndo={handleUndo} onDismiss={dismissUndo} />
      )}

      {refreshing && (
        <div className="sv-refreshing" role="status" aria-live="polite">
          <IconRefresh />
          <span>Refreshing…</span>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sv-header">
        <button className="sv-back-btn" onClick={() => navigate(-1)}
          type="button" aria-label="Go back">
          <IconBack />
        </button>
        <h1 className="sv-header-title">
          Saved Items
          {total > 0 && (
            <span className="sv-count" aria-label={`${total} saved items`}>
              {total}
            </span>
          )}
        </h1>
        <div className="sv-header-spacer" />
      </header>

      <div className="sv-scroll">

        {/* ── Toolbar ── */}
        {items.length > 0 && (
          <div className="sv-toolbar">
            <div className="sv-search-wrap">
              <span className="sv-search-icon"><IconSearch /></span>
              <input
                className="sv-search"
                type="search"
                placeholder="Search saved items…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search saved items"
              />
              {query && (
                <button className="sv-search-clear" onClick={() => setQuery("")}
                  type="button" aria-label="Clear search">
                  <IconX />
                </button>
              )}
            </div>
            <div className="sv-sort-wrap">
              <span className="sv-sort-icon"><IconSort /></span>
              <select
                className="sv-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort saved items"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Empty — no saved items ── */}
        {items.length === 0 ? (
          <div className="sv-empty" role="status">
            <div className="sv-empty-icon"><IconHeart /></div>
            <h2 className="sv-empty-title">No saved items yet</h2>
            <p className="sv-empty-sub">
              Tap the heart on any listing to save it here
            </p>
            <Link to="/" className="sv-empty-cta">Browse Products</Link>
          </div>

        /* ── Empty — search returned nothing ── */
        ) : displayed.length === 0 ? (
          <div className="sv-empty" role="status">
            <div className="sv-empty-icon">
              <IconSearch />
            </div>
            <h2 className="sv-empty-title">No results for "{query}"</h2>
            <button className="sv-empty-cta" onClick={() => setQuery("")} type="button">
              Clear search
            </button>
          </div>

        /* ── Grid ── */
        ) : (
          <>
            <p className="sv-result-count" aria-live="polite">
              {query
                ? `${displayed.length} result${displayed.length !== 1 ? "s" : ""} for "${query}"`
                : `${total} saved item${total !== 1 ? "s" : ""}`}
            </p>

            <div className="sv-grid" role="list" aria-label="Saved products">
              {displayed.map((item) => (
                <div key={item.favorite_id || item.id} role="listitem">
                  <SavedCard
                    item={item}
                    onRemove={handleRemove}
                    isRemoving={removing === item.id}
                  />
                </div>
              ))}
            </div>

            {hasMore && !query && (
              <div className="sv-load-more-wrap">
                <button
                  className="sv-load-more-btn"
                  onClick={() => fetchItems(page + 1, true)}
                  disabled={loadingMore}
                  type="button"
                >
                  {loadingMore ? (
                    <><span className="sv-spinner" aria-hidden="true" /> Loading…</>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}