import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ProductDetailHeader.css";

export default function ProductDetailHeader({ title, price }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: title || "Product",
      text: `${title || "Check this product"} - ₦${price || ""}`,
      url: window.location.href,
    };

    try {
      setSharing(true);

      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareData.url);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Share failed:", err);

      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        // silent fail (no prompt in modern UX)
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="product-detail-header">

      {/* BACK */}
      <button
        className="icon-btn"
        onClick={() => navigate(-1)}
        aria-label="Go back"
      >
        ←
      </button>

      {/* TITLE */}
      <h2 className="title">
        {title || "Product Detail"}
      </h2>

      {/* SHARE */}
      <button
        className={`icon-btn ${sharing ? "loading" : ""}`}
        onClick={handleShare}
        aria-label="Share product"
        disabled={sharing}
      >
        ⤴
      </button>

      {/* TOAST */}
      {copied && (
        <div className="share-toast">
          Link copied
        </div>
      )}
    </div>
  );
}