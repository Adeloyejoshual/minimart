import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";

import "./ProductHeader.css";

const ProductHeader = ({ product, reviewStats, onFavorite, isFavorited }) => {
  const navigate = useNavigate();

  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  /* ================= SCROLL BEHAVIOR ================= */
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;

      // Always show at top
      if (currentY < 50) {
        setVisible(true);
        setLastScrollY(currentY);
        return;
      }

      // scrolling down → hide
      if (currentY > lastScrollY) {
        setVisible(false);
      } else {
        // scrolling up → show
        setVisible(true);
      }

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

    try {
      await navigator.share({
        title: product?.title,
        url,
      });
    } catch (err) {}
  };

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

            {/* TITLE */}
            <div className="product-title">
              {product?.title || "Product"}
            </div>

            {/* RIGHT */}
            <div className="product-header-right">

              {onFavorite && (
                <button className="product-btn">
                  {isFavorited ? "❤️" : "🤍"}
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
              {reviewStats.avg_rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export default ProductHeader;