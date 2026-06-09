import React, { memo } from "react";

const SellerCard = memo(function SellerCard({ product }) {
  if (!product.seller_name) return null;

  const initials = product.seller_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="md-section">
      <h3 className="md-section-title">Sold by</h3>

      <div className="md-seller-card">
        <div className="md-seller-avatar-wrap">
          {product.seller_avatar ? (
            <img
              src={product.seller_avatar}
              alt={product.seller_name}
              className="md-seller-img"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <div className="md-seller-fallback">{initials}</div>
          )}
          {product.seller_verified && (
            <span className="md-seller-badge" aria-label="Verified seller">✓</span>
          )}
        </div>

        <div className="md-seller-info">
          <p className="md-seller-name">
            {product.seller_name}
            {product.seller_verified && (
              <span className="md-verified-chip">✓ Verified</span>
            )}
          </p>
          {product.seller_phone && (
            <p className="md-seller-meta">📞 {product.seller_phone}</p>
          )}
          <p className="md-seller-note">
            Fulfilled through Minimart
          </p>
        </div>
      </div>

      <div className="md-seller-trust">
        <span>🛡️</span>
        <p>
          Your payment and delivery are managed by Minimart.
          You never need to contact the seller directly.
        </p>
      </div>
    </div>
  );
});

export default SellerCard;