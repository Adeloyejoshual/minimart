// src/desktop/components/DesktopSellerCard.tsx

import { memo } from "react";
import { useNavigate } from "react-router-dom";
import type { Seller } from "../../hooks/useProductDetail";

interface DesktopSellerCardProps {
  seller:   Seller | null;
  sellerId: string | number;
}

export const DesktopSellerCard = memo(function DesktopSellerCard({
  seller,
  sellerId,
}: DesktopSellerCardProps) {
  const navigate = useNavigate();
  if (!seller && !sellerId) return null;

  const name = seller?.store_name || seller?.name || "Seller";

  return (
    <section className="pdd-seller-full" aria-label="Seller profile">
      <h3 className="pdd-seller-full-title">About the Seller</h3>

      <div
        className="pdd-seller-full-card"
        onClick={() => navigate(`/seller/${sellerId}`)}
        role="button"
        tabIndex={0}
        aria-label={`View full profile for ${name}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") navigate(`/seller/${sellerId}`);
        }}
      >
        {/* Avatar */}
        <div className="pdd-seller-full-avatar">
          {seller?.profile_image || seller?.store_logo ? (
            <img
              src={seller.profile_image || seller.store_logo}
              alt={name}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          )}
          {seller?.is_online && (
            <span className="pdd-seller-online" aria-label="Online now" />
          )}
        </div>

        {/* Info */}
        <div className="pdd-seller-full-info">
          <div className="pdd-seller-full-name-row">
            <span className="pdd-seller-full-name">{name}</span>
            {seller?.verified && (
              <span className="pdd-seller-full-badge" aria-label="Verified seller">
                ✔ Verified
              </span>
            )}
          </div>

          <div className="pdd-seller-full-stats">
            {(seller?.products_count ?? 0) > 0 && (
              <div className="pdd-stat">
                <span className="pdd-stat-val">{seller!.products_count}</span>
                <span className="pdd-stat-label">Listings</span>
              </div>
            )}
            {(seller?.total_sales ?? 0) > 0 && (
              <div className="pdd-stat">
                <span className="pdd-stat-val">
                  {Number(seller!.total_sales).toLocaleString()}
                </span>
                <span className="pdd-stat-label">Sales</span>
              </div>
            )}
            {(seller?.rating ?? 0) > 0 && (
              <div className="pdd-stat">
                <span className="pdd-stat-val">
                  {Number(seller!.rating).toFixed(1)}★
                </span>
                <span className="pdd-stat-label">Rating</span>
              </div>
            )}
          </div>

          {seller?.trust_score != null && (
            <div
              className="pdd-seller-trust"
              aria-label={`Trust score: ${seller.trust_score}%`}
            >
              <span className="pdd-seller-trust-label">
                Trust score
              </span>
              <div className="pdd-trust-bar" role="presentation">
                <div
                  className="pdd-trust-fill"
                  style={{ width: `${Math.min(100, seller.trust_score)}%` }}
                />
              </div>
              <span className="pdd-trust-pct">{seller.trust_score}%</span>
            </div>
          )}
        </div>

        {/* View profile CTA */}
        <div className="pdd-seller-full-cta">
          View Profile
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </section>
  );
});