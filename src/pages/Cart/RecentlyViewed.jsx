import React, { useState, useEffect, memo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

const RECENT_KEY = "mm_recently_viewed";
const MAX_RECENT = 12;
const VISIBLE = 8;

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function trackProductView(product) {
  if (!product?.id) return;
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const filtered = stored.filter((p) => String(p.id) !== String(product.id));
    const entry = {
      id: String(product.id),
      name: product.name ?? product.title ?? "Product",
      price: Number(product.price ?? 0),
      image: Array.isArray(product.images)
        ? (product.images[0] ?? null)
        : (product.image ?? product.imageUrl ?? null),
      slug: product.slug ?? String(product.id),
      viewedAt: Date.now(),
    };
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...filtered].slice(0, MAX_RECENT)));
    window.dispatchEvent(new Event("recently-viewed-updated"));
  } catch {}
}

function loadRecentlyViewed() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
}

const RVCard = memo(function RVCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const image = !imgErr ? (product.image ?? null) : null;

  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (adding || added) return;
    setAdding(true);
    try {
      await onAddToCart(product);
      setAdded(true);
      timer.current = setTimeout(() => setAdded(false), 2200);
    } catch {} finally { setAdding(false); }
  }, [product, onAddToCart, adding, added]);

  return (
    <article
      className="rv-card"
      onClick={() => navigate(`/product/${product.slug ?? product.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/product/${product.slug ?? product.id}`)}
    >
      <div className="rv-card__img-wrap">
        {image ? (
          <img src={image} alt={product.name} className="rv-card__img" loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div className="rv-card__img-placeholder">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>
      <div className="rv-card__info">
        <p className="rv-card__name" title={product.name}>{product.name}</p>
        <p className="rv-card__price">{fmt(product.price)}</p>
      </div>
      <button
        className={"rv-card__add-btn" + (added ? " rv-card__add-btn--added" : "")}
        onClick={handleAdd}
        disabled={adding}
      >
        {adding ? <span className="rv-spinner" /> : added ? "Added" : "+ Cart"}
      </button>
    </article>
  );
});

function RecentlyViewed({ onAddToCart }) {
  const [items, setItems] = useState(loadRecentlyViewed);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const sync = () => setItems(loadRecentlyViewed());
    window.addEventListener("recently-viewed-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("recently-viewed-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleClear = useCallback(() => {
    localStorage.removeItem(RECENT_KEY);
    setItems([]);
    window.dispatchEvent(new Event("recently-viewed-updated"));
  }, []);

  if (!items.length) return null;

  const visible = showAll ? items : items.slice(0, VISIBLE);

  return (
    <section className="ct-section-block">
      <div className="ct-section-header">
        <div className="ct-section-header__left">
          <h3 className="ct-section-title">Recently Viewed</h3>
        </div>
        <div className="ct-section-header__right">
          {items.length > VISIBLE && (
            <button className="ct-section-show-more" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show less" : `+${items.length - VISIBLE} more`}
            </button>
          )}
          <button className="ct-section-clear" onClick={handleClear}>Clear</button>
        </div>
      </div>
      <div className="rv-scroll" role="list">
        <div className="rv-track">
          {visible.map((product) => (
            <div key={product.id} role="listitem">
              <RVCard product={product} onAddToCart={onAddToCart} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RecentlyViewed;
export { RecentlyViewed };