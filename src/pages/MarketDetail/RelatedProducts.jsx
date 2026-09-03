import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL, formatPrice, calcDiscount } from "../../config/marketplace";

const RelatedProducts = React.memo(function RelatedProducts({ slug, limit = 6 }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    axios
      .get(`${API_URL}/${slug}/related`, {
        params: { limit },
        timeout: 8000,
      })
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, limit]);

  if (!items.length) return null;

  return (
    <div className="md-related">
      <div className="md-related-header">
        <h3>You might also like</h3>
      </div>

      <div className="md-related-scroll">
        {items.map((p) => (
          <RelatedCard key={p.id} product={p} navigate={navigate} />
        ))}
      </div>
    </div>
  );
});

const RelatedCard = React.memo(function RelatedCard({ product: p, navigate }) {
  const pct = calcDiscount(p.price, p.compare_at_price);

  const handleClick = useCallback(() => {
    navigate(`/shop/${p.slug ?? p.id}`);
  }, [navigate, p.slug, p.id]);

  return (
    <div
      className="md-related-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`${p.name} — ${formatPrice(p.price)}`}
    >
      <div className="md-related-img-wrap">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy" />
        ) : (
          <div className="md-related-placeholder">📦</div>
        )}
        {pct >= 10 && <span className="md-related-disc">-{pct}%</span>}
      </div>
      <div className="md-related-info">
        <p className="md-related-name">{p.name}</p>
        <p className="md-related-price">{formatPrice(p.price)}</p>
      </div>
    </div>
  );
});

export default RelatedProducts;
