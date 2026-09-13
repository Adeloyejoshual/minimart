/**
 * src/pages/MarketDetail/SellerCard.jsx
 * Sold by · Fulfilled by Loemart · opens /seller/store/:id
 */

import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

function getInitials(name) {
  if (!name) return "S";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function sellerSlugFromProduct(product) {
  const s = product?.seller || product?.vendor || product?.store || {};
  return (
    s.slug ||
    s.id ||
    product?.seller_id ||
    product?.store_id ||
    product?.vendor_id ||
    product?.seller_slug ||
    null
  );
}

function SellerCard({ product }) {
  const navigate = useNavigate();
  if (!product) return null;

  const seller = product.seller || product.vendor || product.store || {};

  const sellerName =
    seller.name ||
    seller.store_name ||
    product.seller_name ||
    product.shop_name ||
    product.store_name ||
    "Verified Seller";

  const isVerified =
    seller.is_verified ??
    product.seller_verified ??
    true;

  const logo =
    seller.logo ||
    seller.avatar ||
    product.seller_logo ||
    null;

  const slug =
    sellerSlugFromProduct(product) ||
    encodeURIComponent(
      String(sellerName).toLowerCase().trim().replace(/\s+/g, "-")
    );

  const goToSeller = useCallback(
    (e) => {
      e?.stopPropagation?.();
      if (!slug) return;
      navigate(`/seller/store/${slug}`);
    },
    [navigate, slug]
  );

  return (
    <div
      className="md-seller-card mdp-seller-card"
      role="button"
      tabIndex={0}
      onClick={goToSeller}
      onKeyDown={(e) => e.key === "Enter" && goToSeller(e)}
      aria-label={`View ${sellerName} store`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: "var(--r1, 8px)",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div className="md-seller-avatar-wrap" style={{ flexShrink: 0 }}>
        {logo ? (
          <img
            src={logo}
            alt=""
            className="md-seller-img"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            className="md-seller-fallback mdp-seller-initials"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--ink, #111)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            {getInitials(sellerName)}
          </div>
        )}
      </div>

      <div className="md-seller-info" style={{ flex: 1, minWidth: 0 }}>
        <p
          className="md-seller-name"
          style={{
            fontSize: 14,
            fontWeight: 700,
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sellerName}
          </span>
          {isVerified && (
            <span
              className="md-verified-chip"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#10b981",
                background: "rgba(16,185,129,0.12)",
                padding: "1px 6px",
                borderRadius: 999,
              }}
            >
              Verified
            </span>
          )}
        </p>

        <p
          className="md-seller-note"
          style={{
            fontSize: 11,
            color: "var(--o, #ff6b00)",
            fontWeight: 600,
            margin: "4px 0 0",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span aria-hidden="true">🛡️</span>
          Fulfilled by Loemart
        </p>
      </div>

      <span
        aria-hidden="true"
        style={{
          color: "var(--ink3, #9ca3af)",
          fontWeight: 700,
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        &gt;
      </span>
    </div>
  );
}

export default memo(SellerCard);