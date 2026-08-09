/**
 * src/loemart/mobile/MasonryCard.jsx
 * Modern masonry-friendly product card
 */

import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ShoppingBag, Star, Zap } from "lucide-react";

function MasonryCard({ product, isWished, onWishlist, onAddToCart }) {
  const navigate = useNavigate();

  const {
    id,
    title,
    name,
    price,
    originalPrice,
    old_price,
    image,
    thumbnail,
    images,
    discount,
    rating,
    sold,
    sold_count,
    location,
    isFlashDeal,
    badge,
  } = product;

  const displayTitle = title || name || "Untitled Product";
  const displayImage =
    thumbnail ||
    image ||
    (Array.isArray(images) && images[0]) ||
    "/placeholder.png";
  const displayOldPrice = originalPrice || old_price;
  const displaySold = sold ?? sold_count ?? 0;

  const discountPct =
    discount ||
    (displayOldPrice && price
      ? Math.round(((displayOldPrice - price) / displayOldPrice) * 100)
      : null);

  const formatPrice = (val) =>
    val ? `₦${Number(val).toLocaleString()}` : "₦0";

  const handleWish = (e) => {
    e.stopPropagation();
    onWishlist();
  };

  const handleCart = (e) => {
    e.stopPropagation();
    onAddToCart();
  };

  const handleOpen = () => navigate(`/product/${id}`);

  return (
    <article className="mcard" onClick={handleOpen}>
      {/* Media */}
      <div className="mcard__media">
        <img
          src={displayImage}
          alt={displayTitle}
          className="mcard__img"
          loading="lazy"
          onError={(e) => (e.currentTarget.src = "/placeholder.png")}
        />

        {/* Top-left badges */}
        <div className="mcard__badges">
          {isFlashDeal && (
            <span className="mcard__badge mcard__badge--flash">
              <Zap size={10} strokeWidth={2.5} fill="currentColor" />
              Flash
            </span>
          )}
          {discountPct > 0 && (
            <span className="mcard__badge mcard__badge--discount">
              -{discountPct}%
            </span>
          )}
          {badge && !isFlashDeal && !discountPct && (
            <span className="mcard__badge mcard__badge--new">{badge}</span>
          )}
        </div>

        {/* Wishlist */}
        <button
          className={`mcard__wish ${isWished ? "mcard__wish--active" : ""}`}
          onClick={handleWish}
          aria-label="Add to wishlist"
        >
          <Heart
            size={16}
            strokeWidth={2.2}
            fill={isWished ? "currentColor" : "none"}
          />
        </button>
      </div>

      {/* Body */}
      <div className="mcard__body">
        <h3 className="mcard__title">{displayTitle}</h3>

        <div className="mcard__price-row">
          <span className="mcard__price">{formatPrice(price)}</span>
          {displayOldPrice > price && (
            <span className="mcard__price-old">
              {formatPrice(displayOldPrice)}
            </span>
          )}
        </div>

        {/* Meta info */}
        <div className="mcard__meta">
          {rating > 0 && (
            <span className="mcard__rating">
              <Star size={11} fill="currentColor" strokeWidth={0} />
              {Number(rating).toFixed(1)}
            </span>
          )}
          {displaySold > 0 && (
            <span className="mcard__sold">
              {displaySold >= 1000
                ? `${(displaySold / 1000).toFixed(1)}k sold`
                : `${displaySold} sold`}
            </span>
          )}
        </div>

        {location && (
          <p className="mcard__location">📍 {location}</p>
        )}

        {/* CTA */}
        <button className="mcard__cta" onClick={handleCart}>
          <ShoppingBag size={13} strokeWidth={2.2} />
          Add to Cart
        </button>
      </div>
    </article>
  );
}

export default memo(MasonryCard);