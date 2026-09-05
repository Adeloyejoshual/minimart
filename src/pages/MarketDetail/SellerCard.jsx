/**
 * src/pages/MarketDetail/SellerCard.jsx
 */

import { memo } from "react";

function SellerCard({ product }) {
  if (!product) return null;

  const sellerName =
    product.seller?.name ||
    product.seller_name ||
    product.shop_name ||
    "Verified Seller";

  const isVerified =
    product.seller?.is_verified ??
    product.seller_verified ??
    true;

  return (
    <div className="md-seller-card" style={{ padding: '12px', borderRadius: 'var(--r1)' }}>
      <div className="md-seller-avatar-wrap">
        {product.seller?.logo || product.seller?.avatar ? (
          <img
            src={product.seller?.logo || product.seller?.avatar}
            alt=""
            className="md-seller-img"
          />
        ) : (
          <div className="md-seller-fallback">
            {sellerName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="md-seller-info">
        <p className="md-seller-name" style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
          {sellerName}
          {isVerified && <span className="md-verified-chip" style={{ fontSize: 10 }}>Verified</span>}
        </p>
        <p className="md-seller-note" style={{ fontSize: 11, color: 'var(--ink2)', margin: '2px 0 0' }}>
          Fulfilled through Minimart
        </p>
      </div>
    </div>
  );
}

export default memo(SellerCard);