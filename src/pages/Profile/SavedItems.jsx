// src/pages/Profile/SavedItems.jsx — v2
//
// Changes from v1:
//  ─ Shows correct image from images JSONB (not just thumbnail_url)
//  ─ Pagination — load more button
//  ─ Optimistic remove with undo toast
//  ─ Pull-to-refresh on mobile
//  ─ Empty state per filter
//  ─ Search/filter bar (by title)
//  ─ Sort: newest saved / price low-high / price high-low
//  ─ Trial listing badge (expires soon)
//  ─ Original price + discount display
//  ─ localStorage sync on remove
//  ─ Skeleton matches real card layout

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
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;
const FAV_KEY  = "loemart_favs";
const PH       = "https://placehold.co/300x300/f0ede8/b0a89e?text=No+Image";
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

/* Get best image from item — mirrors productDetail logic */
const getItemImage = (item) => {
  /* Option 1 — images JSONB array */
  if (Array.isArray(item.images) && item.images.length > 0) {
    const sorted = [...item.images]
      .filter((img) => img?.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (sorted.length > 0) return sorted[0].url;
  }
  /* Option 2 — string images */
  if (typeof item.images === "string") {
    try {
      const parsed = JSON.parse(item.images);
      if (Array.isArray(parsed) && parsed[0]?.url) return parsed[0].url;
    } catch {}
  }
  /* Option 3 — fallback columns */
  return item.thumbnail_url || item.main_image || item.image || PH;
};

/* Sync localStorage after remove */
const removeFavFromStorage = (productId) => {
  try {
    const favs = JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
    delete favs[productId];
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = memo(function Icon({ d, size = 20, ...rest }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {Array.isArray(d)
        ? d.map((path, i) => <path key={i} d={path} />)
        : <path d={d} />}
    </svg>
  );
});

const ICONS = {
  back    : "M15 18l-6-6 6-6",
  heart   : "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  trash   : ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
  pin     : ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", "M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  eye     : ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  search  : ["M11 17.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5z", "M16 16l4.5 4.5"],
  refresh : "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  sort    : ["M3 6h18", "M7 12h10", "M10 18h4"],
  x       : "M18 6 6 18M6 6l12 12",
};

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
      <button
        className="sv-undo-btn"
        onClick={onUndo}
        type="button"
      >
        Undo
      </button>
      <button
        className="sv-undo-close"
        onClick={onDismiss}
        type="button"
        aria-label="Dismiss"
      >
        <Icon d={ICONS.x} size={14} />
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON CARD
═══════════════════════════════════════════════════════════════ */
const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="sv-skeleton" aria-hidden="true">
      <div className="sv-sk sv-sk-img" />
      <div className="sv-sk-body">
        <div className="sv-sk sv-sk-cat"   style={{ width: "40%", height: 10 }} />
        <div className="sv-sk sv-sk-title" style={{ width: "90%", height: 16, marginTop: 6 }} />
        <div className="sv-sk sv-sk-title" style={{ width: "70%", height: 16, marginTop: 4 }} />
        <div className="sv-sk sv-sk-price" style={{ width: "45%", height: 22, marginTop: 8 }} />
        <div className="sv-sk sv-sk-meta"  style={{ width: "60%", height: 12, marginTop: 8 }} />
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT CARD
═══════════════════════════════════════════════════════════════ */
const SavedCard = memo(function SavedCard({ item, onRemove, isRemoving }) {
  const image      = getItemImage(item);
  const discount   = item.original_price && item.original_price > item.price
    ? Math.round((1 - item.price / item.original_price) * 100)
    : null;
  const daysLeft   = item.active_until
    ? Math.ceil((new Date(item.active_until) - Date.now()) / 86_400_000)
    : null;
  const expireSoon = item.is_trial && daysLeft !== null && daysLeft <= 3;

  return (
    <div
      className={[
        "sv-card",
        isRemoving ? "sv-card--removing" : "",
        expireSoon ? "sv-card--expiring" : "",
      ].filter(Boolean).join(" ")}
    >
      {/* ── Image ── */}
      <Link
        to={`/product/${item.slug}`}
        className="sv-card-img-link"
        aria-label={`View ${item.title}`}
      >
        <img
          src={image}
          alt={item.title}
          className="sv-card-img"
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}
        />

        {/* Promoted badge */}
        {item.is_promoted && (
          <span className="sv-badge sv-badge--promoted" aria-label="Promoted listing">
            ⭐ Featured
          </span>
        )}

        {/* Discount badge */}
        {discount && (
          <span className="sv-badge sv-badge--discount" aria-label={`${discount}% off`}>
            -{discount}%
          </span>
        )}

        {/* Trial expiry badge */}
        {item.is_trial && daysLeft !== null && daysLeft > 0 && (
          <span
            className={`sv-badge sv-badge--trial${expireSoon ? " sv-badge--urgent" : ""}`}
            aria-label={`Listing expires in ${daysLeft} days`}
          >
            ⏳ {daysLeft}d left
          </span>
        )}

        {/* Expired */}
        {item.is_trial && daysLeft !== null && daysLeft <= 0 && (
          <span className="sv-badge sv-badge--expired" aria-label="Listing expired">
            Expired
          </span>
        )}
      </Link>

      {/* ── Remove button ── */}
      <button
        className="sv-remove-btn"
        onClick={() => onRemove(item)}
        disabled={isRemoving}
        aria-label={`Remove ${item.title} from saved`}
        type="button"
      >
        <Icon d={ICONS.trash} size={16} />
      </button>

      {/* ── Body ── */}
      <div className="sv-card-body">

        {/* Category */}
        {item.category_name && (
          <div className="sv-category" aria-label="Category">
            <span>{item.category_name}</span>
            {item.subcategory_name && (
              <>
                <span className="sv-cat-sep" aria-hidden="true">›</span>
                <span>{item.subcategory_name}</span>
              </>
            )}
          </div>
        )}

        {/* Title */}
        <Link to={`/product/${item.slug}`} className="sv-title">
          {item.title}
        </Link>

        {/* Condition + Negotiable */}
        {(item.condition || item.negotiable) && (
          <div className="sv-tags">
            {item.condition && (
              <span className="sv-tag">{item.condition}</span>
            )}
            {item.negotiable && (
              <span className="sv-tag sv-tag--negotiate">Negotiable</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="sv-price-row">
          <span className="sv-price" aria-label={`Price: ${naira(item.price)}`}>
            {naira(item.price)}
          </span>
          {item.original_price && item.original_price > item.price && (
            <span
              className="sv-price-original"
              aria-label={`Original price: ${naira(item.original_price)}`}
            >
              {naira(item.original_price)}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="sv-meta">
          {(item.location_city || item.location_state) && (
            <span className="sv-meta-item">
              <Icon d={ICONS.pin} size={12} />
              <span>
                {[item.location_city, item.location_state]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </span>
          )}
          {(item.views ?? 0) > 0 && (
            <span className="sv-meta-item">
              <Icon d={ICONS.eye} size={12} />
              <span>{Number(item.views).toLocaleString()}</span>
            </span>
          )}
        </div>

        {/* Saved date */}
        <p className="sv-saved-date">
          Saved {timeAgo(item.saved_at)}
        </p>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SavedItems({ user }) {
  const navigate = useNavigate();

  /* ── State ── */
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,      setError]      = useState(null);
  const [removing,   setRemoving]   = useState(null);   // productId being removed
  const [undoItem,   setUndoItem]   = useState(null);   // item pending undo
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(false);
  const [total,      setTotal]      = useState(0);
  const [query,      setQuery]      = useState("");
  const [sort,       setSort]       = useState("newest"); // newest | price_asc | price_desc
  const [refreshing, setRefreshing] = useState(false);

  /* ── Refs ── */
  const undoTimerRef  = useRef(null);
  const pendingRemove = useRef(null);   // stores { item, timer }
  const pullStartY    = useRef(null);

  /* ═════════════════════════════════════════════════════════
     FETCH
  ═════════════════════════════════════════════════════════ */
  const fetchItems = useCallback(async (pageNum = 1, append = false) => {
    const token = getToken();
    if (!token) { navigate("/auth"); return; }

    try {
      append ? setLoadingMore(true) : setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page  : pageNum,
        limit : PAGE_SIZE,
      });

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

  /* ═════════════════════════════════════════════════════════
     PULL TO REFRESH  (mobile)
  ═════════════════════════════════════════════════════════ */
  const handleTouchStart = useCallback((e) => {
    if (window.scrollY === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (pullStartY.current === null) return;
    const diff = e.changedTouches[0].clientY - pullStartY.current;
    pullStartY.current = null;
    if (diff > 80) {
      setRefreshing(true);
      fetchItems(1);
    }
  }, [fetchItems]);

  /* ═════════════════════════════════════════════════════════
     REMOVE WITH UNDO
  ═════════════════════════════════════════════════════════ */
  const handleRemove = useCallback((item) => {
    /* Optimistic — remove from UI immediately */
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setTotal((t) => Math.max(0, t - 1));

    /* Show undo toast */
    setUndoItem(item);

    /* Sync localStorage immediately */
    removeFavFromStorage(item.id);

    /* Cancel any previous pending remove */
    if (pendingRemove.current) {
      clearTimeout(pendingRemove.current.timer);
    }

    /* Defer actual API call — user can undo within 4s */
    const timer = setTimeout(async () => {
      const token = getToken();
      if (!token) return;
      try {
        setRemoving(item.id);
        await fetch(`${API}/favorites/${item.id}`, {
          method  : "DELETE",
          headers : { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* Rollback on network failure */
        setItems((prev) => {
          /* Re-insert at original position */
          return [...prev, item].sort(
            (a, b) => new Date(b.saved_at) - new Date(a.saved_at)
          );
        });
        setTotal((t) => t + 1);

        /* Restore localStorage */
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

  /* Undo handler */
  const handleUndo = useCallback(() => {
    if (!pendingRemove.current) return;

    clearTimeout(pendingRemove.current.timer);
    const { item } = pendingRemove.current;
    pendingRemove.current = null;

    /* Re-insert item */
    setItems((prev) =>
      [...prev, item].sort(
        (a, b) => new Date(b.saved_at) - new Date(a.saved_at)
      )
    );
    setTotal((t) => t + 1);

    /* Restore localStorage */
    try {
      const favs = JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
      favs[item.id] = true;
      localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    } catch {}

    setUndoItem(null);
  }, []);

  const dismissUndo = useCallback(() => {
    setUndoItem(null);
  }, []);

  /* ═════════════════════════════════════════════════════════
     FILTER + SORT  (client-side on loaded items)
  ═════════════════════════════════════════════════════════ */
  const displayed = useMemo(() => {
    let result = [...items];

    /* Search filter */
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.category_name?.toLowerCase().includes(q) ||
          item.location_city?.toLowerCase().includes(q)
      );
    }

    /* Sort */
    switch (sort) {
      case "price_asc":
        result.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price_desc":
        result.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      default: /* newest — already ordered by saved_at DESC from API */
        result.sort(
          (a, b) => new Date(b.saved_at) - new Date(a.saved_at)
        );
    }

    return result;
  }, [items, query, sort]);

  /* ═════════════════════════════════════════════════════════
     RENDER — LOADING
  ═════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="sv-page">
        <header className="sv-header">
          <button
            className="sv-back-btn"
            onClick={() => navigate(-1)}
            type="button"
            aria-label="Go back"
          >
            <Icon d={ICONS.back} />
          </button>
          <h1 className="sv-header-title">Saved Items</h1>
          <div className="sv-header-spacer" />
        </header>
        <div className="sv-scroll">
          <div className="sv-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════
     RENDER — ERROR
  ═════════════════════════════════════════════════════════ */
  if (error) {
    return (
      <div className="sv-page">
        <header className="sv-header">
          <button
            className="sv-back-btn"
            onClick={() => navigate(-1)}
            type="button"
            aria-label="Go back"
          >
            <Icon d={ICONS.back} />
          </button>
          <h1 className="sv-header-title">Saved Items</h1>
          <div className="sv-header-spacer" />
        </header>
        <div className="sv-error-wrap" role="alert">
          <p className="sv-error-msg">{error}</p>
          <button
            className="sv-retry-btn"
            onClick={() => fetchItems(1)}
            type="button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* ═════════════════════════════════════════════════════════
     RENDER — MAIN
  ═════════════════════════════════════════════════════════ */
  return (
    <div
      className="sv-page"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* ── Undo toast ── */}
      {undoItem && (
        <UndoToast
          item={undoItem}
          onUndo={handleUndo}
          onDismiss={dismissUndo}
        />
      )}

      {/* ── Pull to refresh indicator ── */}
      {refreshing && (
        <div className="sv-refreshing" role="status" aria-live="polite">
          <Icon d={ICONS.refresh} size={18} />
          <span>Refreshing…</span>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sv-header">
        <button
          className="sv-back-btn"
          onClick={() => navigate(-1)}
          type="button"
          aria-label="Go back"
        >
          <Icon d={ICONS.back} />
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

        {/* ── Search + Sort bar ── */}
        {items.length > 0 && (
          <div className="sv-toolbar">
            {/* Search */}
            <div className="sv-search-wrap">
              <Icon d={ICONS.search} size={15} className="sv-search-icon" />
              <input
                className="sv-search"
                type="search"
                placeholder="Search saved items…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search saved items"
              />
              {query && (
                <button
                  className="sv-search-clear"
                  onClick={() => setQuery("")}
                  type="button"
                  aria-label="Clear search"
                >
                  <Icon d={ICONS.x} size={13} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="sv-sort-wrap">
              <Icon d={ICONS.sort} size={15} className="sv-sort-icon" />
              <select
                className="sv-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort saved items"
              >
                <option value="newest">Newest first</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {items.length === 0 ? (
          <div className="sv-empty" role="status">
            <div className="sv-empty-icon" aria-hidden="true">
              <Icon d={ICONS.heart} size={48} />
            </div>
            <h2 className="sv-empty-title">No saved items yet</h2>
            <p className="sv-empty-sub">
              Tap the heart on any listing to save it here
            </p>
            <Link to="/" className="sv-empty-cta">
              Browse Products
            </Link>
          </div>
        ) : displayed.length === 0 ? (
          /* Search returned nothing */
          <div className="sv-empty" role="status">
            <div className="sv-empty-icon" aria-hidden="true">
              <Icon d={ICONS.search} size={40} />
            </div>
            <h2 className="sv-empty-title">No results for "{query}"</h2>
            <button
              className="sv-empty-cta"
              onClick={() => setQuery("")}
              type="button"
            >
              Clear search
            </button>
          </div>
        ) : (

          /* ── Grid ── */
          <>
            <p className="sv-result-count" aria-live="polite">
              {query
                ? `${displayed.length} result${displayed.length !== 1 ? "s" : ""} for "${query}"`
                : `${total} saved item${total !== 1 ? "s" : ""}`}
            </p>

            <div
              className="sv-grid"
              role="list"
              aria-label="Saved products"
            >
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

            {/* ── Load more ── */}
            {hasMore && !query && (
              <div className="sv-load-more-wrap">
                <button
                  className="sv-load-more-btn"
                  onClick={() => fetchItems(page + 1, true)}
                  disabled={loadingMore}
                  type="button"
                >
                  {loadingMore ? (
                    <>
                      <span className="sv-spinner" aria-hidden="true" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        /* Page */
        .sv-page {
          min-height: 100vh;
          background: #faf9f7;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* Header */
        .sv-header {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #fff;
          border-bottom: 1px solid #f0ede8;
        }
        .sv-back-btn {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          background: none; border: none; cursor: pointer;
          color: #374151; border-radius: 50%;
          flex-shrink: 0;
        }
        .sv-back-btn:hover { background: #f3f4f6; }
        .sv-header-title {
          flex: 1;
          font-size: 17px; font-weight: 700;
          color: #111; margin: 0;
          display: flex; align-items: center; gap: 8px;
        }
        .sv-count {
          background: #FF5C00; color: #fff;
          font-size: 11px; font-weight: 700;
          padding: 2px 7px; border-radius: 999px;
          line-height: 1.4;
        }
        .sv-header-spacer { width: 36px; flex-shrink: 0; }

        /* Pull to refresh */
        .sv-refreshing {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 10px;
          background: #fff7f0; color: #FF5C00;
          font-size: 13px; font-weight: 500;
        }

        /* Scroll area */
        .sv-scroll {
          flex: 1;
          padding: 12px 12px 80px;
          overflow-y: auto;
        }

        /* Toolbar */
        .sv-toolbar {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          align-items: center;
        }
        .sv-search-wrap {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }
        .sv-search-icon {
          position: absolute;
          left: 10px;
          color: #9ca3af;
          pointer-events: none;
        }
        .sv-search {
          width: 100%;
          padding: 8px 32px 8px 32px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
          background: #fff;
          color: #111;
          outline: none;
        }
        .sv-search:focus { border-color: #FF5C00; }
        .sv-search-clear {
          position: absolute; right: 8px;
          background: none; border: none;
          cursor: pointer; color: #9ca3af;
          display: flex; align-items: center;
          padding: 2px;
        }
        .sv-sort-wrap {
          position: relative;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .sv-sort-icon {
          position: absolute;
          left: 8px;
          color: #9ca3af;
          pointer-events: none;
        }
        .sv-sort {
          padding: 8px 8px 8px 28px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 12px;
          background: #fff;
          color: #374151;
          appearance: none;
          cursor: pointer;
          outline: none;
        }
        .sv-sort:focus { border-color: #FF5C00; }

        /* Result count */
        .sv-result-count {
          font-size: 12px; color: #6b7280;
          margin: 0 0 10px;
        }

        /* Grid */
        .sv-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        @media (min-width: 640px) {
          .sv-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1024px) {
          .sv-grid { grid-template-columns: repeat(4, 1fr); }
        }

        /* Card */
        .sv-card {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,.07);
          position: relative;
          transition: opacity .25s, transform .25s;
        }
        .sv-card--removing {
          opacity: 0.4;
          pointer-events: none;
          transform: scale(0.97);
        }
        .sv-card--expiring {
          border: 1px solid #fcd34d;
        }

        /* Card image */
        .sv-card-img-link {
          display: block;
          position: relative;
          aspect-ratio: 1;
          overflow: hidden;
          background: #f3f4f6;
        }
        .sv-card-img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
          transition: transform .3s;
        }
        .sv-card-img-link:hover .sv-card-img {
          transform: scale(1.03);
        }

        /* Badges */
        .sv-badge {
          position: absolute;
          font-size: 10px; font-weight: 700;
          padding: 3px 7px; border-radius: 6px;
          line-height: 1.3;
        }
        .sv-badge--promoted {
          top: 8px; left: 8px;
          background: rgba(0,0,0,.55); color: #fff;
        }
        .sv-badge--discount {
          top: 8px; right: 8px;
          background: #dcfce7; color: #16a34a;
        }
        .sv-badge--trial {
          bottom: 8px; left: 8px;
          background: rgba(251,191,36,.85); color: #78350f;
        }
        .sv-badge--urgent {
          background: rgba(239,68,68,.85); color: #fff;
        }
        .sv-badge--expired {
          bottom: 8px; left: 8px;
          background: rgba(107,114,128,.8); color: #fff;
        }

        /* Remove button */
        .sv-remove-btn {
          position: absolute;
          top: 8px; right: 8px;
          width: 30px; height: 30px;
          background: rgba(255,255,255,.92);
          border: none; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #ef4444;
          box-shadow: 0 1px 4px rgba(0,0,0,.12);
          z-index: 2;
          transition: background .15s;
        }
        .sv-remove-btn:hover { background: #fff; }
        .sv-remove-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Card body */
        .sv-card-body { padding: 10px; }
        .sv-category {
          display: flex; align-items: center; gap: 4px;
          font-size: 10px; color: #9ca3af;
          margin-bottom: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sv-cat-sep { color: #d1d5db; }
        .sv-title {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-size: 13px; font-weight: 600;
          color: #111; line-height: 1.35;
          text-decoration: none;
          margin-bottom: 4px;
          display: block;
        }
        .sv-title:hover { color: #FF5C00; }

        /* Tags */
        .sv-tags {
          display: flex; flex-wrap: wrap; gap: 4px;
          margin-bottom: 5px;
        }
        .sv-tag {
          font-size: 10px; padding: 2px 6px;
          border-radius: 4px;
          background: #f3f4f6; color: #374151;
        }
        .sv-tag--negotiate {
          background: #fef9c3; color: #854d0e;
        }

        /* Price */
        .sv-price-row {
          display: flex; align-items: center; gap: 6px;
          flex-wrap: wrap; margin-bottom: 6px;
        }
        .sv-price {
          font-size: 15px; font-weight: 800; color: #111;
        }
        .sv-price-original {
          font-size: 11px; color: #9ca3af;
          text-decoration: line-through;
        }

        /* Meta */
        .sv-meta {
          display: flex; align-items: center;
          flex-wrap: wrap; gap: 8px;
          margin-bottom: 4px;
        }
        .sv-meta-item {
          display: flex; align-items: center; gap: 3px;
          font-size: 11px; color: #6b7280;
        }
        .sv-saved-date {
          font-size: 10px; color: #d1d5db;
          margin: 0;
        }

        /* Empty */
        .sv-empty {
          text-align: center;
          padding: 60px 24px;
          display: flex; flex-direction: column;
          align-items: center; gap: 12px;
        }
        .sv-empty-icon {
          width: 72px; height: 72px;
          background: #fff0eb; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #FF5C00;
        }
        .sv-empty-title {
          font-size: 18px; font-weight: 700; margin: 0; color: #111;
        }
        .sv-empty-sub {
          font-size: 14px; color: #6b7280; margin: 0;
        }
        .sv-empty-cta {
          display: inline-block;
          background: #FF5C00; color: #fff;
          padding: 10px 24px; border-radius: 8px;
          font-size: 14px; font-weight: 600;
          text-decoration: none; border: none; cursor: pointer;
          margin-top: 4px;
        }
        .sv-empty-cta:hover { background: #e05200; }

        /* Error */
        .sv-error-wrap {
          padding: 40px 24px;
          text-align: center;
          display: flex; flex-direction: column;
          align-items: center; gap: 12px;
        }
        .sv-error-msg { font-size: 14px; color: #ef4444; margin: 0; }
        .sv-retry-btn {
          background: #FF5C00; color: #fff;
          border: none; border-radius: 8px;
          padding: 10px 24px; font-size: 14px;
          font-weight: 600; cursor: pointer;
        }

        /* Load more */
        .sv-load-more-wrap {
          display: flex; justify-content: center;
          padding: 20px 0;
        }
        .sv-load-more-btn {
          display: flex; align-items: center; gap: 8px;
          background: #fff; border: 1px solid #e5e7eb;
          border-radius: 8px; padding: 10px 24px;
          font-size: 14px; font-weight: 600;
          color: #374151; cursor: pointer;
        }
        .sv-load-more-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .sv-load-more-btn:hover:not(:disabled) { border-color: #FF5C00; color: #FF5C00; }

        /* Spinner */
        @keyframes sv-spin { to { transform: rotate(360deg); } }
        .sv-spinner {
          width: 14px; height: 14px;
          border: 2px solid #e5e7eb;
          border-top-color: #FF5C00;
          border-radius: 50%;
          animation: sv-spin .7s linear infinite;
          flex-shrink: 0;
        }

        /* Undo toast */
        .sv-undo-toast {
          position: fixed;
          bottom: 80px; left: 50%;
          transform: translateX(-50%);
          background: #1f2937; color: #fff;
          border-radius: 10px;
          padding: 10px 14px;
          display: flex; align-items: center; gap: 10px;
          font-size: 13px;
          box-shadow: 0 4px 20px rgba(0,0,0,.2);
          z-index: 9999;
          max-width: 90vw;
          animation: sv-slide-up .2s ease;
        }
        @keyframes sv-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .sv-undo-text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sv-undo-btn {
          background: #FF5C00; color: #fff;
          border: none; border-radius: 6px;
          padding: 4px 12px; font-size: 12px;
          font-weight: 700; cursor: pointer;
          flex-shrink: 0;
        }
        .sv-undo-close {
          background: none; border: none;
          color: #9ca3af; cursor: pointer;
          display: flex; align-items: center;
          padding: 2px; flex-shrink: 0;
        }

        /* Skeleton */
        @keyframes sv-pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
        .sv-skeleton {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
        }
        .sv-sk-img {
          width: 100%; aspect-ratio: 1;
          background: #e5e7eb;
        }
        .sv-sk-body { padding: 10px; display: flex; flex-direction: column; gap: 6px; }
        .sv-sk {
          background: #e5e7eb;
          border-radius: 4px;
          animation: sv-pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}