import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolidFilled } from "@heroicons/react/24/solid";

const ProductHeader = ({
  product,
  reviewStats,
  onFavorite,
  isFavorited = false,
  rightSlot, // 🔥 extensibility
}) => {
  const navigate = useNavigate();

  /* ---------------- BACK ---------------- */
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  /* ---------------- SHARE ---------------- */
  const handleShare = async () => {
    const url = window.location.href;

    if (!navigator.share) {
      await navigator.clipboard.writeText(url);
      alert("🔗 Link copied!");
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
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 shadow-lg">

        <div className="flex items-center justify-between px-4 h-16 md:h-20">

          {/* LEFT */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBack}
              aria-label="Go back"
              title="Go back"
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
            >
              <ArrowLeftIcon className="h-5 w-5 text-white" />
            </button>

            <h1
              className="text-sm md:text-xl font-bold text-white truncate max-w-[180px] md:max-w-xs"
              title={product?.title}
            >
              {product?.title || "Product Details"}
            </h1>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-2">

            {/* FAVORITE */}
            {onFavorite && (
              <button
                onClick={onFavorite}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
              >
                <span className="text-lg">
                  {isFavorited ? "❤️" : "🤍"}
                </span>
              </button>
            )}

            {/* SHARE */}
            <button
              onClick={handleShare}
              title="Share product"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
            >
              <ShareIcon className="h-5 w-5 text-white" />
            </button>

            {/* SLOT (extra actions) */}
            {rightSlot}

          </div>
        </div>
      </header>

      {/* STATS BAR */}
      <div className="sticky top-[64px] md:top-[80px] z-40 bg-white border-b px-4 py-2 flex items-center gap-4">

        {reviewStats?.avg_rating && (
          <div className="flex items-center gap-1">
            <StarIconSolidFilled className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">
              {reviewStats.avg_rating.toFixed(1)}
            </span>
          </div>
        )}

      </div>
    </>
  );
};

export default ProductHeader;