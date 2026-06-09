import React, { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { formatPrice, calcDiscount, getProductImage } from "../../config/marketplace";
import { HeartIcon, EyeIcon, TagIcon, VerifiedIcon } from "./icons";

const ProductCard = memo(function ProductCard({
  product, wishlisted, onWishlist, viewMode,
}) {
  const navigate  = useNavigate();
  const [imgErr,  setImgErr]  = useState(false);
  const [hovered, setHovered] = useState(false);

  const imgUrl = !imgErr ? getProductImage(product) : null;
  const pct    = calcDiscount(product.price, product.original_price);
  const isList = viewMode === "list";

  const handleClick = useCallback(() => {
    navigate(`/product/${product.slug ?? product.id}`);
  }, [navigate, product.slug, product.id]);

  const handleWishlist = useCallback((e) => {
    e.stopPropagation();
    onWishlist(product.id);
  }, [onWishlist, product.id]);

  return (
    <article
      className={`mp-card ${isList ? "mp-card--list" : ""}`}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`${product.name} — ${formatPrice(product.price)}`}
    >
      <div className="mp-card-img-wrap">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={product.name}
            className="mp-card-img"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="mp-card-placeholder">
            <span className="mp-placeholder-icon"><TagIcon size={36} /></span>
          </div>
        )}

        <div className="mp-card-badges">
          {product.is_featured && <span className="mp-badge mp-badge--featured">⭐ Featured</span>}
          {product.is_trending && <span className="mp-badge mp-badge--trending">🔥 Hot</span>}
          {pct >= 10 && <span className="mp-badge mp-badge--sale">-{pct}%</span>}
        </div>

        <button
          className={`mp-wishlist ${wishlisted ? "mp-wishlist--active" : ""}`}
          onClick={handleWishlist}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <span className="mp-wishlist-icon">
            <HeartIcon filled={wishlisted} size={15} />
          </span>
        </button>

        {hovered && !isList && (
          <div className="mp-quick-view-overlay">
            <span><EyeIcon size={13} /> Quick View</span>
          </div>
        )}
      </div>

      <div className="mp-card-body">
        {product.seller_name && (
          <div className="mp-card-seller">
            {product.seller_avatar ? (
              <img
                src={product.seller_avatar}
                alt=""
                className="mp-seller-avatar"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            ) : (
              <div className="mp-seller-avatar mp-seller-avatar--fallback">
                {product.seller_name[0]?.toUpperCase()}
              </div>
            )}
            <span className="mp-seller-name">{product.seller_name}</span>
            {product.seller_verified && (
              <span className="mp-verified" aria-label="Verified seller">
                <VerifiedIcon size={13} />
              </span>
            )}
          </div>
        )}

        <h3 className="mp-card-name">{product.name}</h3>

        {isList && product.description && (
          <p className="mp-card-desc">{product.description}</p>
        )}

        <div className="mp-price-row">
          <span className="mp-price">{formatPrice(product.price)}</span>
          {pct > 0 && <span className="mp-original">{formatPrice(product.original_price)}</span>}
        </div>

        <div className="mp-card-meta">
          {product.brand && <span className="mp-meta-pill">{product.brand}</span>}
          {product.view_count > 0 && (
            <span className="mp-meta-views">
              <EyeIcon size={11} />
              {product.view_count > 999
                ? `${(product.view_count / 1000).toFixed(1)}k`
                : product.view_count}
            </span>
          )}
          {product.variants?.length > 1 && (
            <span className="mp-meta-pill mp-meta-pill--variants">
              {product.variants.length} variants
            </span>
          )}
        </div>

        {product.tags?.length > 0 && (
          <div className="mp-card-tags">
            {product.tags.slice(0, 3).map((t) => (
              <span key={t} className="mp-tag">#{t}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
});

export default ProductCard;