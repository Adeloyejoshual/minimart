/**
 * src/pages/ProductDetail/MoreFromSeller.jsx
 */
import { memo } from "react";
import { useNavigate } from "react-router-dom";

const PH = "https://placehold.co/800x600/f0ede8/b0a89e?text=Loemart";

// ✅ Move to src/utils/product.js and share across components
export const getProductImage = (p) => {
  if (!p) return PH;
  if (p.image)         return p.image;
  if (p.main_image)    return p.main_image;
  if (p.thumbnail_url) return p.thumbnail_url;
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    return typeof first === "string"
      ? first
      : first?.url || first?.thumbnail_url || PH;
  }
  return PH;
};

export const formatNaira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

// ── Seller Product Card ───────────────────────────────────────
const SellerProductCard = memo(function SellerProductCard({ product, onClick }) {
  const location = product.location_city || product.location?.city;

  return (
    <div
      className="pd-more-seller-card"
      onClick={() => onClick(product)}
      role="button"
      tabIndex={0}
      aria-label={`View ${product.title || "product"}`}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
    >
      <div className="pd-more-seller-img-wrap">
        <img
          src={getProductImage(product)}
          alt={product.title || "Product image"}   // ✅ fallback alt
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        {product.is_promoted && (
          <span className="pd-more-seller-badge" aria-label="Featured listing">
            Featured
          </span>
        )}
      </div>

      <div className="pd-more-seller-body">
        <p className="pd-more-seller-title">{product.title}</p>
        <p className="pd-more-seller-price">{formatNaira(product.price)}</p>
        {location && (
          <p className="pd-more-seller-loc" aria-label={`Location: ${location}`}>
            📍 {location}
          </p>
        )}
      </div>
    </div>
  );
});

// ── Main Component ────────────────────────────────────────────
function MoreFromSeller({ products, seller, sellerId, onProductClick }) {
  const navigate = useNavigate();

  if (!products?.length) return null;

  const sellerName = seller?.store_name || seller?.name || "this seller";

  return (
    <div className="pd-section pd-more-seller-section">
      <h3 className="pd-section-h">More from {sellerName}</h3>

      {/*
        ✅ Removed custom touch handlers — CSS handles native scroll:
           .pd-more-seller-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      */}
      <div className="pd-more-seller-scroll">
        {products.map((p) => (
          <SellerProductCard
            key={p.id}
            product={p}
            onClick={onProductClick}
          />
        ))}
      </div>

      <button
        className="pd-see-all-btn"
        onClick={() => navigate(`/seller/${sellerId}`)}
        aria-label={`See all listings from ${sellerName}`}
      >
        See all listings →
      </button>
    </div>
  );
}

export default memo(MoreFromSeller);