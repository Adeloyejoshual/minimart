import React, { memo } from "react";
import { useNavigate } from "react-router-dom";
import { formatPrice, calcDiscount, getProductImage } from "../../config/marketplace";
import { StarIcon, TagIcon } from "./icons";

const FeaturedStrip = memo(function FeaturedStrip({ products }) {
  const navigate = useNavigate();
  if (!products.length) return null;

  return (
    <div className="mp-featured-section">
      <div className="mp-section-header">
        <span className="mp-section-title"><StarIcon size={16} /> Featured</span>
        <span className="mp-section-count">{products.length} items</span>
      </div>
      <div className="mp-featured-scroll">
        {products.map((p) => {
          const img = getProductImage(p);
          const pct = calcDiscount(p.price, p.original_price);
          return (
            <div
              key={p.id}
              className="mp-featured-card"
              onClick={() => navigate(`/shop/${p.slug ?? p.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/shop/${p.slug ?? p.id}`)}
            >
              <div className="mp-featured-img-wrap">
                {img ? (
                  <img src={img} alt={p.name} loading="lazy" />
                ) : (
                  <div className="mp-featured-placeholder"><TagIcon size={32} /></div>
                )}
                <div className="mp-featured-overlay" />
                <div className="mp-featured-info">
                  <p className="mp-featured-name">{p.name}</p>
                  <p className="mp-featured-price">{formatPrice(p.price)}</p>
                </div>
                {pct >= 10 && <span className="mp-featured-badge">-{pct}%</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default FeaturedStrip;