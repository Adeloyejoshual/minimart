// pages/Cart/YouMayAlsoLike.jsx
import React, { useState, useEffect, memo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com/api";
const fmt = (n) => `₦${Number(n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const ENDPOINTS = [
  (exclude) => ({ url: `${API_BASE}/products/suggestions`, params: { exclude, limit: 16 } }),
  () => ({ url: `${API_BASE}/products/trending`, params: { limit: 16 } }),
  () => ({ url: `${API_BASE}/products`, params: { limit: 16, sort: "newest", status: "active" } }),
];

function extractProducts(data) {
  return data?.data?.products ?? data?.data?.items ?? data?.data ?? data?.products ?? data?.items ?? (Array.isArray(data) ? data : []);
}

const SuggCard = memo(function SuggCard({ product, onAddAndCheckout }) {
  const navigate = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  const [adding, setAdding] = useState(false);
  
  const image = !imgErr ? (Array.isArray(product.images) ? (product.images[0] ?? null) : (product.image ?? null)) : null;

  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (adding) return;
    setAdding(true);
    try { await onAddAndCheckout(product); } 
    catch { setAdding(false); }
  }, [product, onAddAndCheckout, adding]);

  return (
    <article className="sugg-card" onClick={() => navigate(`/product/${product.slug ?? product.id}`)} role="button" tabIndex={0}>
      <div className="sugg-card__img-wrap">
        {image ? (
          <img src={image} alt={product.name ?? product.title} className="sugg-card__img" loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div className="sugg-card__img-placeholder">📦</div>
        )}
      </div>
      <div className="sugg-card__info">
        <p className="sugg-card__name" title={product.name ?? product.title}>{product.name ?? product.title}</p>
        <div className="sugg-card__price-row">
          <span className="sugg-card__price">{fmt(product.price)}</span>
        </div>
      </div>
      <button className={`sugg-card__add-btn ${adding ? "sugg-card__add-btn--loading" : ""}`} onClick={handleAdd} disabled={adding}>
        {adding ? <span className="sugg-spinner" /> : "Add & Checkout"}
      </button>
    </article>
  );
});

function SuggSkeleton({ count = 5 }) {
  return (
    <div className="sugg-scroll">
      <div className="sugg-track">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="sugg-skeleton" aria-hidden="true">
            <div className="sugg-skeleton__img sugg-shimmer" />
            <div className="sugg-skeleton__line sugg-shimmer" />
            <div className="sugg-skeleton__line sugg-skeleton__line--sm sugg-shimmer" />
            <div className="sugg-skeleton__btn sugg-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

const YouMayAlsoLike = memo(function YouMayAlsoLike({ cartItems = [], onAddAndCheckout }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const excludeIds = cartItems.map((i) => i.productId ?? i.id).filter(Boolean).slice(0, 10).join(",");
      for (const buildEndpoint of ENDPOINTS) {
        if (cancelled) return;
        const { url, params } = buildEndpoint(excludeIds);
        try {
          const { data } = await axios.get(url, { params, timeout: 9000 });
          const found = extractProducts(data);
          if (!cancelled && found.length > 0) { setProducts(found); setLoading(false); return; }
        } catch {}
      }
      if (!cancelled) setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="ct-section-block" aria-label="You may also like">
      <div className="ct-section-header">
        <div className="ct-section-header__left">
          <h3 className="ct-section-title">You May Also Like</h3>
        </div>
        <a href="/minimart" className="ct-section-see-all">See all →</a>
      </div>
      {loading ? (
        <SuggSkeleton count={5} />
      ) : (
        <div className="sugg-scroll" role="list">
          <div className="sugg-track">
            {products.map((product) => (
              <div key={product.id} role="listitem">
                <SuggCard product={product} onAddAndCheckout={onAddAndCheckout} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

export default YouMayAlsoLike;