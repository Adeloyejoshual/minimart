import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ProductDetailHeader.css";

export default function ProductDetailHeader({ title, price }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: title || "Product",
      text: `${title || "Check this product"} - ₦${price || ""}`,
      url: window.location.href,
    };

    try {
      // Native share (best UX on mobile)
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      // Clipboard fallback
      await navigator.clipboard.writeText(shareData.url);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Share failed:", err);

      // final fallback
      prompt("Copy this link:", window.location.href);
    }
  };

  return (
    <div className="product-detail-header">

      <button
        className="back-btn"
        onClick={() => navigate(-1)}
        aria-label="Go back"
      >
        ←
      </button>

      <h2 className="title">
        {title || "Product Detail"}
      </h2>

      <button
        className="share-btn"
        onClick={handleShare}
        aria-label="Share product"
      >
        ⬆️
      </button>

      {copied && (
        <div className="share-toast">
          Link copied ✔
        </div>
      )}
    </div>
  );
}