// src/pages/Marketplace/ProductDetail.jsx

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaStar,
  FaFire,
  FaHeart,
  FaCommentDots
} from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL; // For Vite
// const API_URL = process.env.REACT_APP_API_URL; // For CRA

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [mainImage, setMainImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch Product
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_URL}/api/marketplace/${id}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed to load product");

        setProduct(data);
        setMainImage(data.images?.[0] || "");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // Image Helper
  const getImageUrl = (img) => {
    if (!img) return "";
    if (img.startsWith("http")) return img;
    return `${API_URL}/${img}`;
  };

  // Loading State
  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h3 style={{ color: "#007BFF" }}>Loading product...</h3>
      </div>
    );
  }

  // Error State
  if (error || !product) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h3 style={{ color: "red" }}>
          {error || "Product not found"}
        </h3>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "Inter, sans-serif"
      }}
    >
      {/* BACK BUTTON */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "none",
          color: "#007BFF",
          fontWeight: "600",
          cursor: "pointer",
          marginBottom: "25px",
          fontSize: "16px"
        }}
      >
        <FaArrowLeft /> Back
      </button>

      {/* PROMOTION BADGE */}
      {product.promoted && (
        <div
          style={{
            background: "linear-gradient(90deg, #ff4d4f, #ff7a45)",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: "8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontWeight: "600",
            marginBottom: "20px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
          }}
        >
          <FaFire /> Promoted • {product.promo_plan}
        </div>
      )}

      {/* IMAGE SECTION */}
      <div
        style={{
          display: "flex",
          gap: "25px",
          marginBottom: "40px",
          flexWrap: "wrap"
        }}
      >
        <div style={{ flex: 2 }}>
          <img
            src={getImageUrl(mainImage)}
            alt="Product"
            style={{
              width: "100%",
              height: "450px",
              objectFit: "cover",
              borderRadius: "16px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.1)"
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}
        >
          {product.images?.map((img, index) => (
            <img
              key={index}
              src={getImageUrl(img)}
              alt="Thumbnail"
              onClick={() => setMainImage(img)}
              style={{
                height: "100px",
                objectFit: "cover",
                borderRadius: "10px",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}
            />
          ))}
        </div>
      </div>

      {/* PRODUCT INFO */}
      <h1 style={{ fontSize: "28px", color: "#1a1a1a", marginBottom: "10px" }}>
        {product.title}
      </h1>

      <div style={{ marginBottom: "10px", color: "#555" }}>
        Seller: <strong>{product.poster_name}</strong>
      </div>

      <div style={{ marginBottom: "10px", color: "#777" }}>
        {product.city}, {product.state}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          color: "#FFC107",
          marginBottom: "20px"
        }}
      >
        <FaStar /> 4.5 (23 Reviews)
      </div>

      {/* PRICE SECTION */}
      <div
        style={{
          background: "#f5f9ff",
          padding: "20px",
          borderRadius: "14px",
          border: "1px solid #dbe9ff",
          marginBottom: "30px"
        }}
      >
        <h2 style={{ color: "#007BFF", marginBottom: "10px" }}>
          ₦{Number(product.price).toLocaleString()}
        </h2>

        {product.negotiation && (
          <p style={{ color: "#28a745", fontWeight: "500" }}>
            Negotiable
          </p>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div
        style={{
          display: "flex",
          gap: "15px",
          flexWrap: "wrap",
          marginBottom: "40px"
        }}
      >
        <button
          style={{
            flex: 1,
            padding: "14px",
            background: "#007BFF",
            color: "#fff",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          <FaCommentDots /> Chat Seller
        </button>

        <button
          style={{
            flex: 1,
            padding: "14px",
            background: "#28a745",
            color: "#fff",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          Make Offer
        </button>

        <button
          style={{
            padding: "14px 20px",
            background: "#FFC107",
            color: "#000",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          <FaHeart />
        </button>
      </div>

      {/* DESCRIPTION */}
      <div>
        <h3 style={{ marginBottom: "10px" }}>Product Description</h3>
        <p style={{ lineHeight: "1.6", color: "#444" }}>
          {product.description}
        </p>
      </div>
    </div>
  );
}