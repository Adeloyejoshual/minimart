// src/components/Cart/StockBadge.jsx
import React from "react";
import { getStockStatus } from "../../features/cart/utils/cartHelpers";
import "../../styles/cart/stockBadge.css";

export default function StockBadge({ stock }) {
  const { text, type } = getStockStatus(stock);

  return (
    <span
      className={`stock-badge stock-badge--${type}`}
      role="status"
      aria-label={`Stock: ${text}`}
    >
      <span className="stock-badge__dot" aria-hidden="true" />
      {text}
    </span>
  );
}