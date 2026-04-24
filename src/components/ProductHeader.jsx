import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  StarIconSolid,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolidFilled } from '@heroicons/react/24/solid';

// Import the CSS
import './ProductHeader.css';

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
      {/* Primary sticky header */}
      <header className="product-header-primary sticky-header z-[75]">
        <div className="product-nav-wrapper">
          <button
            className="menu-dots"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ←
          </button>

          {/* Title with CSS ellipsis */}
          <div className="nav-brand product-title-nav" title={product?.title}>
            {product?.title || 'Product Details'}
          </div>

          <button
            onClick={handleShare}
            className="action-btn"
            title="Share product"
          >
            <ShareIcon />
          </button>
        </div>
      </header>

      {/* Sticky rating bar */}
      <div className="product-info-section">
        <div className="product-stats-box">
          {reviewStats?.avg_rating && (
            <div className="stat-item">
              <StarIconSolidFilled />
              <span className="stat-value">
                {reviewStats.avg_rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProductHeader;