import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

import "./ProductHeader.css";

const ProductHeader = ({
  product,
  reviewStats,
  onFavorite,
  isFavorited = false,
  rightSlot,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const handleShare = async () => {
    const url = window.location.href;

    if (!navigator.share) {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
      return;
    }

    try {
      await navigator.share({
        title: product?.title,
        url,
      });
    } catch (err) {
      console.warn("Share failed", err);
    }
  };

  return (
    <>
      {/* MAIN HEADER */}
      <header className="product-header-wrapper">
        <div className="product-header">

          <div className="product-header-container">

            {/* LEFT */}
            <div className="product-header-left">

              <button className="product-btn" onClick={handleBack}>
                <ArrowLeftIcon className="w-5 h-5 text-white" />
              </button>

            </div>

            {/* TITLE */}
            <div className="product-title" title={product?.title}>
              {product?.title || "Product Details"}
            </div>

            {/* RIGHT */}
            <div className="product-header-right">

              {/* FAVORITE */}
              {onFavorite && (
                <button className="product-btn" onClick={onFavorite}>
                  {isFavorited ? "❤️" : "🤍"}
                </button>
              )}

              {/* SHARE */}
              <button className="product-btn" onClick={handleShare}>
                <ShareIcon className="w-5 h-5 text-white" />
              </button>

              {/* SLOT */}
              {rightSlot}

            </div>

          </div>

        </div>
      </header>

      {/* STATS BAR */}
      <div className="product-subnav">

        {reviewStats?.avg_rating && (
          <div className="product-stat">
            <StarIconSolid className="w-4 h-4 text-amber-500" />
            <span className="value">
              {reviewStats.avg_rating.toFixed(1)}
            </span>
          </div>
        )}

      </div>
    </>
  );
};

export default ProductHeader;