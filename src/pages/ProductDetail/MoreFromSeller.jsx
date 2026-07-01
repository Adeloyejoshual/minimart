/**
 * src/pages/ProductDetail/MoreFromSeller.jsx
 *
 * Horizontal scroll on mobile, responsive grid on desktop.
 * Full uncropped images.
 */

import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const PH =
  "https://placehold.co/800x600/f0ede8/b0a89e?text=Loemart";

const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const getImg = (p) => {
  if (!p) return PH;
  if (p.image) return p.image;
  if (p.main_image) return p.main_image;
  if (p.thumbnail_url) return p.thumbnail_url;
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0];
    return typeof first === "string"
      ? first
      : first?.url || first?.thumbnail_url || PH;
  }
  return PH;
};

export default function MoreFromSeller({
  products,
  seller,
  sellerId,
  onProductClick,
}) {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [scrollStartLeft, setScrollStartLeft] = useState(0);

  /* ── swipe / drag to scroll ─────────────────── */
  const handleTouchStart = useCallback((e) => {
    const container = scrollRef.current;
    if (!container) return;
    setTouchStartX(e.touches[0].clientX);
    setScrollStartLeft(container.scrollLeft);
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      if (touchStartX === null) return;
      const container = scrollRef.current;
      if (!container) return;
      const diff = touchStartX - e.touches[0].clientX;
      container.scrollLeft = scrollStartLeft + diff;
    },
    [touchStartX, scrollStartLeft]
  );

  const handleTouchEnd = useCallback(() => {
    setTouchStartX(null);
  }, []);

  if (!products || products.length === 0) return null;

  return (
    <div className="pd-section pd-more-seller-section">
      <h3 className="pd-section-h">
        More from{" "}
        {seller?.store_name || seller?.name || "this seller"}
      </h3>

      <div
        className="pd-more-seller-scroll"
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {products.map((p) => (
          <div
            key={p.id}
            className="pd-more-seller-card"
            onClick={() => onProductClick(p)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === "Enter" && onProductClick(p)
            }
          >
            <div className="pd-more-seller-img-wrap">
              <img
                src={getImg(p)}
                alt={p.title}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = PH;
                }}
              />
              {p.is_promoted && (
                <span className="pd-more-seller-badge">
                  Featured
                </span>
              )}
            </div>
            <div className="pd-more-seller-body">
              <p className="pd-more-seller-title">{p.title}</p>
              <p className="pd-more-seller-price">
                {naira(p.price)}
              </p>
              {(p.location_city || p.location?.city) && (
                <p className="pd-more-seller-loc">
                  📍 {p.location_city || p.location?.city}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        className="pd-see-all-btn"
        onClick={() => navigate(`/seller/${sellerId}`)}
      >
        See all listings →
      </button>
    </div>
  );
}