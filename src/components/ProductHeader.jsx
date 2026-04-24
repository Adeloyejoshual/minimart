import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  StarIconSolid,
  ShareIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolidFilled } from '@heroicons/react/24/solid';

const ProductHeader = ({
  product,
  reviewStats,
  onFavorite,
  isFavorited = false,
}) => {
  const navigate = useNavigate();

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: product?.title,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('🔗 Link copied to clipboard!');
    }
  };

  return (
    <>
      {/* 📌 PRIMARY STICKY HEADER - Matches TopNav */}
      <header className="product-header-primary sticky-header z-[75]">
        <div className="nav-container">
          <button
            className="menu-dots"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>

          <div className="nav-brand product-title-nav" title={product?.title}>
            {product?.title || 'Product Details'}
          </div>
        </div>
      </header>

      {/* 🔍 STICKY PRODUCT INFO BAR */}
      <div className="product-info-section sticky-search z-[70]">
        <div className="search-wrapper product-info-wrapper">
          <div className="product-stats-box">
            {/* Rating only */}
            <div className="stats-grid">
              {reviewStats?.avg_rating && (
                <div className="stat-item">
                  <StarIconSolidFilled className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="stat-value">
                    {reviewStats.avg_rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Actions (no Contact button) */}
            <div className="actions-grid">
              <button
                onClick={handleShare}
                className="action-btn"
                title="Share product"
              >
                <Share建成Icon className="w-5 h-5 text-gray-600 hover:text-gray-900 transition-colors" />
              </button>

              <button
                onClick={onFavorite}
                className={`action-btn ${
                  isFavorited
                    ? 'text-red-500 hover:text-red-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={isFavorited ? "Remove from favorites" : "Add to favorites"}
              >
                <HeartIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductHeader;