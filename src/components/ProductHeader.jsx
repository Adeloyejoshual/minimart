import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  StarIconSolid,
  EyeIcon,
  ShareIcon,
  HeartIcon,
  ChatBubbleLeftIcon 
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolidFilled } from '@heroicons/react/24/solid';

const ProductHeader = ({ 
  product, 
  similarProductsCount = 0,
  reviewStats,
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

      {/* 🔍 STICKY PRODUCT INFO BAR - Matches search-section */}
      <div className="product-info-section sticky-search z-[70]">
        <div className="search-wrapper product-info-wrapper">
          <div className="product-stats-box">
            {/* Views & Rating */}
            <div className="stats-grid">
              <div className="stat-item">
                <EyeIcon className="w-4 h-4 text-gray-600" />
                <span className="stat-value">
                  {product?.views?.toLocaleString() || 0} views
                </span>
              </div>
              
              {reviewStats?.avg_rating && (
                <div className="stat-item">
                  <StarIconSolidFilled className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="stat-value">
                    {reviewStats.avg_rating.toFixed(1)}
                  </span>
                </div>
              )}
              
              {similarProductsCount > 0 && (
                <div className="stat-item">
                  <span className="stat-badge bg-blue-500/10 text-blue-600 border border-blue-200 px-2 py-1 rounded-full text-xs font-semibold">
                    {similarProductsCount} similar
                  </span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="actions-grid">
              <button
                onClick={handleShare}
                className="action-btn"
                title="Share product"
              >
                <ShareIcon className="w-5 h-5 text-gray-600 hover:text-gray-900 transition-colors" />
              </button>

              <button
                onClick={onFavorite}
                className={`action-btn relative ${
                  isFavorited
                    ? 'text-red-500 hover:text-red-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={isFavorited ? "Remove from favorites" : "Add to favorites"}
              >
                <HeartIcon className="w-5 h-5" />
                {isFavorited && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    ★
                  </div>
                )}
              </button>

              <Link
                to="#contact"
                className="contact-quick-btn bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-1 px-4 rounded-lg shadow-lg hover:shadow-xl text-sm flex items-center gap-1.5 transition-all duration-300 whitespace-nowrap"
              >
                <ChatBubbleLeftIcon className="w-4 h-4" />
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductHeader;