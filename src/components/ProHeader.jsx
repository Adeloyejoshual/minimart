import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ShareIcon,
  HeartIcon,
} from "@heroicons/react/24/outline";
import {
  HeartIcon as HeartIconSolid,
  StarIcon as StarIconSolid,
} from "@heroicons/react/24/solid";
import "./ProductHeader.css";

// 1432 → "1.4k" | 1000000 → "1m"
const fmtViews = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (v >= 1_000)     return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return v.toLocaleString();
};

const ProductHeader = ({
  product,
  seller,
  reviewStats,
  onFavorite,
  isFavorited = false,
}) => {
  const navigate      = useNavigate();
  const [visible,     setVisible]     = useState(true);
  const lastScrollY   = useRef(0);
  const ticking       = useRef(false);

  /* ── SCROLL: hide on down, show on up ── */
  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY < 50) {
          setVisible(true);
        } else if (currentY > lastScrollY.current + 4) {
          setVisible(false);          // scrolling down
        } else if (currentY < lastScrollY.current - 4) {
          setVisible(true);           // scrolling up
        }
        lastScrollY.current = currentY;
        ticking.current     = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const sellerName = seller?.store_name || seller?.name || null;

  return (
    <>
      {/* ── MAIN HEADER ── */}
      <div className={`product-header-wrapper ${visible ? "show" : "hide"}`}>
        <header className="product-header">
          <div className="product-header-container">

            {/* LEFT — back button */}
            <div className="product-header-left">
              <button
                className="product-btn"
                onClick={handleBack}
                aria-label="Go back"
              >
                <ArrowLeftIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* CENTER — product title only (seller name goes in subnav) */}
            <div className="product-title" title={product?.title}>
              {product?.title || "Product"}
            </div>

            {/* RIGHT — favorite + share */}
            <div className="product-header-right">
              {onFavorite && (
                <button
                  className="product-btn"
                  onClick={onFavorite}
                  aria-label={isFavorited ? "Remove from favorites" : "Save"}
                >
                  {isFavorited
                    ? <HeartIconSolid style={{ width: 20, height: 20, color: "#e53935" }} />
                    : <HeartIcon      style={{ width: 20, height: 20 }} />
                  }
                </button>
              )}

              <button
                className="product-btn"
                onClick={handleShare}
                aria-label="Share"
              >
                <ShareIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>

          </div>
        </header>

        {/* ── STATS BAR ── */}
        <div className="product-subnav">

          {/* Star rating */}
          {reviewStats?.avg_rating > 0 && (
            <div className="product-stat">
              <StarIconSolid style={{ width: 15, height: 15, color: "#f59e0b" }} />
              <span className="value">
                {Number(reviewStats.avg_rating).toFixed(1)}
              </span>
              {reviewStats?.total > 0 && (
                <span className="product-stat-count">
                  ({reviewStats.total})
                </span>
              )}
            </div>
          )}

          {/* Views */}
          {product?.views > 0 && (
            <div className="product-stat">
              <span className="value">{fmtViews(product.views)}</span>
              <span className="product-stat-count">views</span>
            </div>
          )}

          {/* Seller name — right side of subnav */}
          {sellerName && (
            <div className="product-stat" style={{ marginLeft: "auto" }}>
              <span className="product-stat-count">{sellerName}</span>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default ProductHeader;
