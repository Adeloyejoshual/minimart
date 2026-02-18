// src/pages/Marketplace/ProductDetail.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaStar } from "react-icons/fa";

export default function ProductDetail({ product }) {
  const navigate = useNavigate();

  if (!product) return <p>Loading product...</p>;

  const {
    title,
    poster_name,
    state,
    city,
    price,
    discount_price,
    negotiable,
    exchange_possible,
    description,
    images = [],
    deliveryRegions = [],
    rating = 0,
    reviewCount = 0,
  } = product;

  const displayPrice = discount_price || price;

  return (
    <div style={{ maxWidth: "900px", margin: "30px auto", padding: "0 15px", fontFamily: "'Inter', sans-serif" }}>
      {/* BACK BUTTON */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: "#007BFF",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        <FaArrowLeft /> Back
      </button>

      {/* PRODUCT IMAGES / MEDIA */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "300px" }}>
          {images.length > 0 ? (
            <img
              src={images[0]}
              alt="Main product"
              style={{ width: "100%", borderRadius: "12px", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "300px",
                borderRadius: "12px",
                background: "#f0f0f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
              }}
            >
              No Image
            </div>
          )}

          {/* Thumbnail Strip */}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
            {images.slice(1).map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Thumb ${i}`}
                style={{ width: "80px", height: "80px", borderRadius: "8px", objectFit: "cover", cursor: "pointer" }}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* PRODUCT INFO */}
      <div
        style={{
          padding: "20px",
          background: "#f8f9fa",
          borderRadius: "12px",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "10px", color: "#333" }}>
          {title}
        </h1>
        <p style={{ margin: "5px 0", color: "#555" }}>
          Seller: <strong>{poster_name}</strong> • {city}, {state}
        </p>

        {/* Rating */}
        <div style={{ display: "flex", alignItems: "center", margin: "10px 0" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <FaStar
              key={i}
              color={i < rating ? "#FFD700" : "#ddd"}
              style={{ marginRight: "4px" }}
            />
          ))}
          <span style={{ marginLeft: "10px", color: "#555" }}>({reviewCount} reviews)</span>
        </div>

        {/* Price */}
        <p style={{ fontSize: "24px", fontWeight: "700", color: "#007BFF", marginBottom: "10px" }}>
          ₦{Number(displayPrice).toLocaleString()} {negotiable && <span style={{ fontWeight: "500", color: "#28a745" }}>• Negotiable</span>}
        </p>

        {exchange_possible && (
          <p style={{ fontSize: "16px", color: "#17a2b8" }}>🔄 Exchange Possible</p>
        )}

        <p style={{ color: "#555", lineHeight: "1.6" }}>{description}</p>
      </div>

      {/* DELIVERY */}
      {deliveryRegions.length > 0 && (
        <div
          style={{
            padding: "20px",
            background: "#fff3cd",
            borderRadius: "12px",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ marginBottom: "10px", color: "#856404" }}>Delivery Options</h3>
          {deliveryRegions.map((d, i) => (
            <p key={i} style={{ marginBottom: "5px", color: "#856404" }}>
              {d.state} - {d.city} • {d.from}-{d.to} days {d.isFreeDelivery && "• FREE"}{" "}
              {d.expressAvailable && "• Express"}
            </p>
          ))}
        </div>
      )}

      {/* INTERACTION */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          style={{
            flex: 1,
            padding: "12px",
            background: "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Chat with Seller
        </button>
        <button
          style={{
            flex: 1,
            padding: "12px",
            background: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Make Offer
        </button>
        <button
          style={{
            flex: 1,
            padding: "12px",
            background: "#ffc107",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Save / Favorite
        </button>
        <button
          style={{
            flex: 1,
            padding: "12px",
            background: "#6c757d",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Share Listing
        </button>
      </div>
    </div>
  );
}