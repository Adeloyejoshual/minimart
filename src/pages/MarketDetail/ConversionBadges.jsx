/**
 * src/pages/MarketDetail/ConversionBadges.jsx
 * Conversion Boosters: Sales Velocity, Low-Stock Progress Bar, & Flash Sale Timer
 */

import { useState, useEffect, useMemo, memo } from "react";

function ConversionBadges({ stockLeft, discount, product }) {
  // Live Countdown Timer for Flash Sale / Discount
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 28, seconds: 45 });

  useEffect(() => {
    if (discount <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 5, minutes: 59, seconds: 59 }; // Reset loop
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [discount]);

  // Derived / fallback sales velocity
  const salesCount = useMemo(() => {
    if (product?.sales_count && Number(product.sales_count) > 0) return Number(product.sales_count);
    if (product?.orders_count && Number(product.orders_count) > 0) return Number(product.orders_count);
    // Dynamic deterministic fallback based on product ID
    const charCodeSum = String(product?.id || "product")
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (charCodeSum % 180) + 24; 
  }, [product]);

  const showLowStock = typeof stockLeft === "number" && stockLeft > 0 && stockLeft <= 10;
  const stockPercentage = useMemo(() => {
    if (!showLowStock) return 100;
    return Math.max(15, Math.min(100, (stockLeft / 10) * 100));
  }, [stockLeft, showLowStock]);

  return (
    <div className="mdp-conversion-box">
      {/* 1. Flash Sale Timer (Only when item is discounted) */}
      {discount > 0 && (
        <div className="mdp-fomo-timer">
          <div className="mdp-fomo-timer__left">
            <span className="mdp-fomo-timer__icon">⚡</span>
            <span className="mdp-fomo-timer__label">Limited-time Deal</span>
          </div>
          <div className="mdp-fomo-timer__clock">
            <span className="mdp-fomo-unit">{String(timeLeft.hours).padStart(2, "0")}h</span>
            <span className="mdp-fomo-sep">:</span>
            <span className="mdp-fomo-unit">{String(timeLeft.minutes).padStart(2, "0")}m</span>
            <span className="mdp-fomo-sep">:</span>
            <span className="mdp-fomo-unit">{String(timeLeft.seconds).padStart(2, "0")}s</span>
          </div>
        </div>
      )}

      {/* 2. Social Proof / Sales Velocity Badge */}
      <div className="mdp-social-proof">
        <span className="mdp-social-proof__fire">🔥</span>
        <span className="mdp-social-proof__text">
          <strong>{salesCount.toLocaleString()} sold</strong> · Popular item
        </span>
      </div>

      {/* 3. Low-Stock Progress Bar (Only when stock <= 10) */}
      {showLowStock && (
        <div className="mdp-scarcity">
          <div className="mdp-scarcity__header">
            <span className="mdp-scarcity__title">
              ⚡ Only <strong>{stockLeft}</strong> left in stock - order soon!
            </span>
          </div>
          <div className="mdp-scarcity__bar-bg">
            <div
              className="mdp-scarcity__bar-fill"
              style={{ width: `${stockPercentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ConversionBadges);