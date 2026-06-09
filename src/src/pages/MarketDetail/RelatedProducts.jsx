import React, { useState, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  API_URL,
  formatPrice,
  getProductImage,
  calcDiscount,
} from "../../config/marketplace";

const RelatedProducts = memo(function RelatedProducts({ category, excludeId }) {
  const navigate    = useNavigate();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!category) return;
    axios
      .get(API_URL, {
        params: { category, limit: 8, sort: "newest" },
        timeout: 8000,
      })
      .then(({ data }) => {
        const all = data?.data?.products ?? data?.products ?? [];
        setItems(all.filter((p) => p.id !== excludeId).slice(0, 6));
      })
      .catch(() => {});
  }, [category, excludeId]);

  if (!items.length) return null;

  return (
    <div className="md-related">
      <div className="md-related-header">
        <h3>You might also like</h3>
        <button
          className="md-related-all"
          onClick={() => navigate(`/minimart?cat=${category}`)}
        >
          See all →
        </button>
      </div>

      <div className="md-related-scroll">
        {items.map((p) => {
          const img = getProductImage(p);
          const pct = calcDiscount(p.price, p.original_price);

          return (
            <div
              key={p.id}
              className="md-related-card"
              onClick={() => navigate(`/product/${p.slug ?? p.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/product/${p.slug ?? p.id}`)}
              aria-label={`${p.name} — ${formatPrice(p.price)}`}
            >
              <div className="md-related-img-wrap">
                {img ? (
                  <img src={img} alt={p.name} loading="lazy" />
                ) : (
                  <div className="md-related-placeholder">📦</div>
                )}
                {pct >= 10 && (
                  <span className="md-related-disc">-{pct}%</span>
                )}
              </div>
              <div className="md-related-info">
                <p className="md-related-name">{p.name}</p>
                <p className="md-related-price">{formatPrice(p.price)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default RelatedProducts;