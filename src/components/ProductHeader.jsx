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
    <div className="product-header sticky top-116 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-sm">
      <div className="homepage-container product-detail-container">
        <div className="flex items-center justify-between py-4 px-2">
          {/* Left: Back + Product Info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 hover:shadow-md transition-all duration-200 flex-shrink-0 group"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-700 group-hover:text-gray-900 group-hover:-translate-x-0.5 transition-all" />
            </button>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-gray-900 truncate leading-tight line-clamp-1">
                {product?.title}
              </h1>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <EyeIcon className="w-3.5 h-3.5" />
                  {product?.views?.toLocaleString() || 0}
                </span>
                {reviewStats?.avg_rating && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <StarIconSolidFilled className="w-4 h-4 text-yellow-400 fill-current" />
                      {reviewStats.avg_rating.toFixed(1)}
                    </span>
                  </>
                )}
                {similarProductsCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 font-medium">{similarProductsCount} similar</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 hover:shadow-md transition-all duration-200 flex items-center justify-center group"
              title="Share product"
            >
              <ShareIcon className="w-5 h-5 text-gray-600 group-hover:text-gray-900 group-hover:scale-110 transition-all" />
            </button>

            <button
              onClick={onFavorite}
              className={`p-2.5 rounded-xl hover:shadow-md transition-all duration-200 flex items-center justify-center group relative ${
                isFavorited
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
              }`}
              title={isFavorited ? "Remove from favorites" : "Add to favorites"}
            >
              <HeartIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {isFavorited && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg">
                  ★
                </div>
              )}
            </button>

            <Link
              to="#contact"
              className="load-more-btn bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-lg hover:shadow-xl text-sm flex items-center gap-1.5 ml-1 transition-all duration-300"
            >
              <ChatBubbleLeftIcon className="w-4 h-4" />
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductHeader;