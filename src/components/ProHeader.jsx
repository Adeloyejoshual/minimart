import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolidFilled } from "@heroicons/react/24/solid";

// 1432 → "1.4k"  |  1000000 → "1m"
const fmtViews = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (v >= 1_000)     return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return v.toLocaleString();
};

const ProductHeader = ({
  product,
  seller,        // ← pass seller object from ProductDetail
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
      alert("🔗 Link copied!");
      return;
    }
    try {
      await navigator.share({ title: product?.title, url });
    } catch (err) {
      console.warn("Share failed", err);
    }
  };

  // Seller display name — store name takes priority
  const sellerName = seller?.store_name || seller?.name || null;

  return (
    <>
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 shadow-lg">
        <div className="flex items-center justify-between px-4 h-16 md:h-20">

          {/* LEFT */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBack}
              aria-label="Go back"
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
            >
              <ArrowLeftIcon className="h-5 w-5 text-white" />
            </button>

            <div className="min-w-0">
              {/* Product title — always shown */}
              <h1
                className="text-sm md:text-base font-bold text-white truncate max-w-[180px] md:max-w-xs leading-tight"
                title={product?.title}
              >
                {product?.title || "Product Details"}
              </h1>

              {/* Seller name — shown below title when available */}
              {sellerName && (
                <p className="text-xs text-white/60 truncate max-w-[180px] md:max-w-xs leading-tight mt-0.5">
                  {sellerName}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-2">
            {onFavorite && (
              <button
                onClick={onFavorite}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
              >
                <span className="text-lg">{isFavorited ? "❤️" : "🤍"}</span>
              </button>
            )}

            <button
              onClick={handleShare}
              title="Share product"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
            >
              <ShareIcon className="h-5 w-5 text-white" />
            </button>

            {rightSlot}
          </div>
        </div>
      </header>

      {/* STATS BAR */}
      <div className="sticky top-[64px] md:top-[80px] z-40 bg-white border-b px-4 py-2 flex items-center gap-4">

        {/* Star rating */}
        {reviewStats?.avg_rating > 0 && (
          <div className="flex items-center gap-1">
            <StarIconSolidFilled className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">
              {Number(reviewStats.avg_rating).toFixed(1)}
            </span>
            {reviewStats?.total > 0 && (
              <span className="text-xs text-gray-400">
                ({reviewStats.total})
              </span>
            )}
          </div>
        )}

        {/* Views */}
        {product?.views > 0 && (
          <div className="flex items-center gap-1 text-gray-400">
            <span className="text-xs">{fmtViews(product.views)} views</span>
          </div>
        )}

        {/* Seller name in stats bar (visible when header is not scrolled) */}
        {sellerName && (
          <div className="ml-auto text-xs text-gray-500 truncate max-w-[120px]">
            {sellerName}
          </div>
        )}

      </div>
    </>
  );
};

export default ProductHeader;
