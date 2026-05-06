import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ShareIcon,
  HeartIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid, StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

import "./ProductHeader.css";

const ProductHeader = ({ product, seller, reviewStats, onFavorite, isFavorited }) => {
  const navigate = useNavigate();

  const [visible,     setVisible]     = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  /* ── SCROLL BEHAVIOR ── */
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 50) { setVisible(true); setLastScrollY(currentY); return; }
      setVisible(currentY <= lastScrollY);
      setLastScrollY(currentY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

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
    try { await navigator.share({ title: product?.title, url }); } catch {}
  };

  // Seller display name — store name takes priority over personal name
  const sellerName = seller?.store_name || seller?.name || null;

  return (
    <>
      {/* SMART HEADER */}
      <header className={`product-header-wrapper ${visible ? "show" : "hide"}`}>
        <div className="product-header">
          <div className="product-header-container">

            {/* LEFT */}
            <button className="product-btn" onClick={handleBack}>
              <ArrowLeftIcon className="w-5 h-5 text-white" />
            </button>

            {/* TITLE — seller name when available, product title as fallback */}
            <div className="product-title">
              {sellerName || product?.title || "Product"}
            </div>

            {/* RIGHT */}
            <div className="product-header-right">
              {onFavorite && (
                <button className="product-btn" onClick={onFavorite}>
                  {isFavorited
                    ? <HeartIconSolid className="w-5 h-5 text-red-500" />
                    : <HeartIcon      className="w-5 h-5 text-white"   />
                  }
                </button>
              )}
              <button className="product-btn" onClick={handleShare}>
                <ShareIcon className="w-5 h-5 text-white" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* SUB HEADER */}
      <div className="product-subnav">
        {reviewStats?.avg_rating && (
          <div className="product-stat">
            <StarIconSolid className="w-4 h-4 text-amber-500" />
            <span className="value">
              {Number(reviewStats.avg_rating).toFixed(1)}
            </span>
            {reviewStats.total > 0 && (
              <span className="product-stat-count">({reviewStats.total})</span>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ProductHeader;
