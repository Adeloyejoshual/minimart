import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ProductDetailNav.css";

export default function ProductDetailNav({ title }) {
  const navigate = useNavigate();

  return (
    <div className="product-detail-nav">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h2 className="product-title">{title || "Product Detail"}</h2>
    </div>
  );
}