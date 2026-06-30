// src/components/homepage/DealCard.jsx
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

const DealCard = memo(function DealCard({ product, onClick }) {
  if (!product) return null;

  const imgUrl = resolveImage(product);
  const orig   = Number(product.attributes?.original_price || 0);
  const curr   = Number(product.price || 0);
  const disc   = orig > curr && curr > 0
    ? `${Math.round(((orig - curr) / orig) * 100)}% off`
    : null;

  return (
    <article
      className="hm-deal-card"
      role="button"
      tabIndex={0}
      onClick={() => onClick(product)}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      aria-label={product.title}
    >
      <div className="hm-deal-img-wrap">
        <img
          src={imgUrl}
          alt={product.title || "Deal"}
          className="hm-deal-img"
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        {disc && (
          <span className="hm-deal-disc">{disc}</span>
        )}
      </div>
      <div className="hm-deal-body">
        <p className="hm-deal-title">{product.title}</p>
        <span className="hm-deal-price">{naira(curr)}</span>
        {orig > curr && (
          <span className="hm-deal-orig">{naira(orig)}</span>
        )}
      </div>
    </article>
  );
});

export default DealCard;