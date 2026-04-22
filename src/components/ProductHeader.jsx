import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  ShareIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  EyeIcon 
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

const ProductHeader = ({ 
  product, 
  similarProductsCount,
  reviewStats,
  onShare,
  onFavorite,
  isFavorited = false 
}) => {
  const navigate = useNavigate();

  const handleShare = () => {
    if (onShare) onShare();
    else if (navigator.share) {
      navigator.share({
        title: product?.title,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="sticky top-116 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100/50 supports-[backdrop-filter:blur(12px)]:bg-white/80">
      <div className="homepage-container product-detail-container">
        <div className="flex items-center justify-between py-4">
          {/* Left: Back + Title */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="p-3 rounded-2xl bg-gray-100 hover:bg-gray-200 transition-all duration-200 flex items-center justify-center group"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900 truncate leading-tight">
                {product?.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <EyeIcon className="w-4 h-4" />
                  {product?.views?.toLocaleString() || 0} views
                </span>
                {reviewStats && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <StarIcon className="w-4 h-4 text-yellow-400 fill-current" />
                      {reviewStats.avg_rating?.toFixed(1) || 0}
                    </span>
                  </>
                )}
                {similarProductsCount > 0 && (
                  <>
                    <span>•</span>
                    <span>{similarProductsCount} similar</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-3 rounded-2xl bg-gray-100 hover:bg-gray-200 hover:shadow-md transition-all duration-200 flex items-center justify-center group relative"
              aria-label="Share product"
              title="Share"
            >
              <ShareIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>

            <button
              onClick={onFavorite}
              className={`p-3 rounded-2xl hover:shadow-md transition-all duration-200 flex items-center justify-center group relative ${
                isFavorited 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
              title={isFavorited ? "Favorited" : "Favorite"}
            >
              <HeartIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {isFavorited && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  1
                </div>
              )}
            </button>

            <Link
              to={`#contact`}
              className="load-more-btn bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 text-sm flex items-center gap-2"
            >
              <ChatBubbleLeftIcon className="w-5 h-5" />
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductHeader;