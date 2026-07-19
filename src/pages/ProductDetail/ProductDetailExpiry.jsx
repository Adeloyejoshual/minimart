/**
 * ProductDetailExpiry — Trial listing expiry banner (own listings only)
 */
import { memo } from "react";
import "./ProductDetailExpiry.css";

function ProductDetailExpiry({ product, isOwn }) {
  if (!isOwn) return null;
  if (!product?.active_until) return null;
  if (!product?.is_trial) return null;

  const days = product.days_remaining ?? 0;

  return (
    <div
      className={`pde-banner${days <= 3 ? " pde-banner--urgent" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="pde-icon" aria-hidden="true">⏳</span>
      <div className="pde-text">
        <strong>
          {days > 0
            ? `Trial listing — ${days} day${days !== 1 ? "s" : ""} remaining`
            : "Trial listing has expired"}
        </strong>
        <span>
          {days > 0
            ? "Verify your identity to keep this listing live."
            : "Verify your identity to restore this listing."}
        </span>
      </div>
    </div>
  );
}

export default memo(ProductDetailExpiry);