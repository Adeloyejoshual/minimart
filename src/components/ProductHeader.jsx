import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  StarIconSolid,
  ShareIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolidFilled } from '@heroicons/react/24/solid';

import './ProductHeader.css';

const ProductHeader = ({
  product,
  reviewStats,
  onFavorite,
  isFavorited = false,
}) => {
  const navigate = useNavigate();

  const handleShare = async () => {
    const imgSrc = product?.image;

    if (!navigator.share) {
      await navigator.clipboard.writeText(window.location.href);
      alert('🔗 Link copied to clipboard!');
      return;
    }

    if (imgSrc) {
      try {
        const response = await fetch(imgSrc);
        const blob = await response.blob();

        const file = new File(
          [blob],
          product.title ? `${product.title}.jpg` : 'product.jpg',
          { type: blob.type }
        );

        const data = {
          title: product?.title,
          url: window.location.href,
          files: [file],
        };

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share(data);
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Image share failed, falling back to URL only', err);
        }
      }
    }

    await navigator.share({
      title: product?.title,
      url: window.location.href,
    });
  };

  return (
    <>
      {/* Sticky header */}
      <header className="product-header-primary sticky-header z-[75]">
        <div className="product-nav-wrapper flex items-center justify-between w-full px-4 py-2">
          <button
            className="menu-dots transition hover:opacity-70"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>

          <div
            className="nav-brand product-title-nav flex-1 mx-4 text-center truncate"
            title={product?.title}
          >
            {product?.title || 'Product Details'}
          </div>

          <button
            onClick={handleShare}
            className="action-btn transition hover:opacity-70"
            title="Share product"
          >
            <ShareIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Sticky rating bar */}
      <div className="product-info-section">
        <div className="product-stats-box">
          {reviewStats?.avg_rating && (
            <div className="stat-item flex items-center gap-1">
              <StarIconSolidFilled className="h-4 w-4 text-amber-500" />
              <span className="stat-value text-sm font-medium">
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