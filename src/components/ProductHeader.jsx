// src/components/ProductHeader.jsx
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeftIcon,
  EyeIcon,
  ShareIcon,
  HeartIcon
} from '@heroicons/react/24/outline';

const ProductHeader = ({ 
  product,
  onFavorite,
  isFavorited = false 
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
    <div>
      {/* STICKY HEADER */}
      <header className="sticky-header">
        <div className="nav-container">
          <button
            onClick={() => navigate(-1)}
            className="menu-dots"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>

          <div
            className="nav-brand product-title-nav flex-1 mx-6 truncate"
            title={product?.title}
          >
            {product?.title || 'Product Details'}
          </div>

          {/* Share icon on the right */}
          <button
            onClick={handleShare}
            className="action-btn ml-2 shrink-0"
            title="Share product"
          >
            <ShareIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      {/* PRODUCT INFO BAR */}
      <div className="product-info-section">
        <div className="product-info-wrapper">
          <div className="product-stats-box">
            <div className="stats-grid">
              {/* No views, no “similar”, no stars */}
            </div>

            <div className="actions-grid">
              <button
                onClick={handleFavorite}
                className={`action-btn relative ${
                  isFavorited
                    ? 'text-red-500 hover:text-red-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <HeartIcon className="w-5 h-5" />
                {isFavorited && (
                  <span className="text-xs ml-1">Favorited</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductHeader;