import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ProductDetailHeader.css";

export default function ProductDetailHeader({ title }) {
  const navigate = useNavigate();

  const handleShare = async () => {
    const shareData = {
      title: title || "Product",
      text: `Check out this product: ${title}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareData.url);
        alert("Product link copied to clipboard!");
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  return (
    <div className="product-detail-header">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ←
      </button>

      <h2 className="title">{title || "Product Detail"}</h2>

      <button className="share-btn" onClick={handleShare}>
        ⬆️
      </button>
    </div>
  );
}