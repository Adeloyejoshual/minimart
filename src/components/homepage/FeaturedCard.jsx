// src/components/homepage/FeaturedCard.jsx
import { memo } from "react";

const PH = "https://placehold.co/600x500/f0ede8/b0a89e?text=Loemart";

const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const resolveImage = (p) => {
  if (!p) return PH;
  if (p.image) return p.image;
  if (Array.isArray(p.images) && p.images.length > 0) {
    const f = p.images[0];
    return typeof f === "string" ? f : f?.url || PH;
  }
  return p.main_image || p.thumbnail_url || PH;
};

const FeaturedCard = memo(function FeaturedCard({ product, onClick }) {
  if (!product) return null;

  const imgUrl = resolveImage(product);
  const city   = product.location_city  || product.location?.city;
  const state  = product.location_state || product.location?.state;
  const loc    = [city, state].filter(Boolean).join(", ") || "Nationwide";

  const orig = Number(product.attributes?.original_price || 0);
  const curr = Number(product.price || 0);
  const disc = orig > curr && curr > 0
    ? `${Math.round(((orig - curr) / orig) * 100)}% off`
    : null;

  return (
    <article
      className="hm-feat-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      aria-label={`Sponsored: ${product.title}`}
    >
      <div className="hm-feat-img-wrap">
        <img
          className="hm-feat-img"
          src={imgUrl}
          alt={product.title || "Featured product"}
          loading="eager"
          decoding="async"
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        <div className="hm-feat-overlay" aria-hidden="true" />
      </div>

      <div className="hm-feat-body">
        <div className="hm-feat-top">
          <span className="hm-feat-tag">
            {product.promotion_type === "flash"
              ? "⚡ Flash"
              : "💎 Sponsored"}
          </span>
          {disc && (
            <span className="hm-feat-disc">{disc}</span>
          )}
        </div>
        <p className="hm-feat-title">{product.title}</p>
        <div className="hm-feat-bottom">
          <span className="hm-feat-price">
            {naira(product.price)}
          </span>
          <span className="hm-feat-loc">
            <span className="hm-loc-pip" aria-hidden="true" />
            {loc}
          </span>
        </div>
      </div>
    </article>
  );
});

export default FeaturedCard;