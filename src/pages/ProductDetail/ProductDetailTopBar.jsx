import { useState, useCallback, memo } from "react";
import "./ProductDetailTopBar.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;

function ProductDetailTopBar({
  product,
  fav = false,
  onBack,
  onToggleFav,
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (!product) return;

    const shareData = {
      title: product.title || "Product",
      text: `Check out ${product.title || "this product"} on Loemart`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        fetch(`${API}/product/products/${product.id}/share`, {
          method: "POST",
        }).catch(() => {});
      } catch {
        /* user cancelled */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      fetch(`${API}/product/products/${product.id}/share`, {
        method: "POST",
      }).catch(() => {});
    } catch {}
  }, [product]);

  return (
    <div className="pdth-topbar">
      <button
        type="button"
        className="pdth-back"
        onClick={onBack}
        aria-label="Go back"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>Back</span>
      </button>

      <div className="pdth-actions">
        <button
          type="button"
          className={`pdth-icon-btn${fav ? " pdth-icon-btn--active" : ""}`}
          onClick={onToggleFav}
          aria-label={fav ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={fav}
          title={fav ? "Saved" : "Save"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        <button
          type="button"
          className={`pdth-share${copied ? " pdth-share--copied" : ""}`}
          onClick={handleShare}
          aria-label="Share this listing"
        >
          {copied ? "Copied!" : "Share"}
        </button>
      </div>
    </div>
  );
}

export default memo(ProductDetailTopBar);