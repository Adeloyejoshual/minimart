// src/pages/Marketplace/ProductDetail.jsx
import { useState } from "react";
import { FaArrowLeft, FaStar, FaFire, FaHeart, FaCommentDollar } from "react-icons/fa";

export default function ProductDetail({ product, onBack }) {
  const [mainImage, setMainImage] = useState(product.images?.[0] || "");

  if (!product) return <p>Loading product...</p>;

  return (
    <div style={{ maxWidth: "900px", margin: "40px auto", padding: "0 15px", fontFamily: "Inter, sans-serif" }}>
      
      {/* BACK BUTTON */}
      <button
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "transparent",
          border: "none",
          color: "#007BFF",
          fontWeight: "600",
          cursor: "pointer",
          marginBottom: "20px",
          fontSize: "16px"
        }}
      >
        <FaArrowLeft /> Back
      </button>

      {/* PROMOTED BADGE */}
      {product.promoted && (
        <div style={{
          background: "#FF4500",
          color: "#fff",
          fontWeight: "600",
          padding: "8px 15px",
          borderRadius: "8px",
          display: "inline-block",
          marginBottom: "15px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
        }}>
          <FaFire style={{ marginRight: "6px" }} /> Promoted Listing
        </div>
      )}

      {/* IMAGES / MEDIA */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
        <div style={{ flex: 2, borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <img
            src={mainImage}
            alt="Main"
            style={{ width: "100%", height: "500px", objectFit: "cover" }}
          />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
          {product.video_link && (
            <div style={{ borderRadius: "12px", overflow: "hidden", height: "150px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
              <iframe
                width="100%"
                height="150"
                src={product.video_link}
                title="Video Preview"
                frameBorder="0"
                allowFullScreen
              />
            </div>
          )}
          {product.images?.slice(0, 3).map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`Thumbnail ${i}`}
              style={{
                width: "100%",
                height: "100px",
                objectFit: "cover",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
              }}
              onClick={() => setMainImage(img)}
            />
          ))}
        </div>
      </div>

      {/* PRODUCT INFO */}
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ fontSize: "30px", fontWeight: "700", marginBottom: "10px", color: "#007BFF" }}>{product.title}</h1>
        <p style={{ marginBottom: "5px", fontSize: "16px" }}>Seller: <strong>{product.poster_name}</strong></p>
        <p style={{ marginBottom: "5px", fontSize: "16px" }}>Location: {product.city}, {product.state}</p>
        <p style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "5px", color: "#FFC107" }}>
          <FaStar /> 4.5 (23 Reviews)
        </p>
        <p style={{ fontSize: "16px" }}>{product.description}</p>

        {product.promoted && product.promo_plan && (
          <p style={{ marginTop: "10px", color: "#FF4500", fontWeight: "600" }}>
            <FaFire /> Promotion Plan: {product.promo_plan}
          </p>
        )}
      </div>

      {/* PRICE & OFFERS */}
      <div style={{
        marginBottom: "30px",
        padding: "20px",
        border: "1px solid #007BFF",
        borderRadius: "12px",
        background: "#E6F0FF",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)"
      }}>
        <h3 style={{ marginBottom: "15px", color: "#007BFF" }}>Price & Offers</h3>
        <p style={{ fontSize: "26px", fontWeight: "700", margin: "10px 0" }}>₦{Number(product.price).toLocaleString()}</p>
        {product.negotiable && <p>💬 Negotiable</p>}
        {product.discount_price && <p style={{ color: "#28a745" }}>Discount: ₦{Number(product.discount_price).toLocaleString()}</p>}
        {product.deliveryRegions?.length > 0 && (
          <div>
            <h4 style={{ marginTop: "15px" }}>Delivery Options:</h4>
            {product.deliveryRegions.map((d, i) => (
              <p key={i} style={{ margin: "5px 0" }}>
                {d.state} - {d.city} • {d.method} • {d.from}-{d.to} days
                {d.isFreeDelivery && " • FREE DELIVERY"}
                {d.expressAvailable && " • Express Available"}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* CONTACT / INTERACTION */}
      <div style={{ display: "flex", gap: "15px", marginBottom: "30px", flexWrap: "wrap" }}>
        <button style={{ flex: "1 1 150px", padding: "12px", background: "#007BFF", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer" }}>
          <FaCommentDollar style={{ marginRight: "5px" }} /> Chat with Seller
        </button>
        <button style={{ flex: "1 1 150px", padding: "12px", background: "#28a745", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer" }}>
          Send Offer
        </button>
        <button style={{ flex: "1 1 150px", padding: "12px", background: "#FFC107", color: "#000", borderRadius: "8px", border: "none", cursor: "pointer" }}>
          <FaHeart style={{ marginRight: "5px" }} /> Save / Favorite
        </button>
        {product.promoted && (
          <button style={{ flex: "1 1 150px", padding: "12px", background: "#FF4500", color: "#fff", borderRadius: "8px", border: "none", cursor: "pointer" }}>
            🔥 Promoted
          </button>
        )}
      </div>

      {/* FULL DESCRIPTION / FEATURES */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ color: "#007BFF", marginBottom: "10px" }}>Full Description & Features</h3>
        <p style={{ fontSize: "16px", marginBottom: "10px" }}>{product.description}</p>
        {product.features?.length > 0 && (
          <ul style={{ listStyleType: "disc", paddingLeft: "20px", marginBottom: "10px" }}>
            {product.features.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        )}
        <p style={{ fontSize: "16px" }}>Condition: {product.condition} {product.used_detail && `(${product.used_detail})`}</p>
      </div>

      {/* REVIEWS & RATINGS */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ color: "#007BFF", marginBottom: "10px" }}>Reviews & Ratings</h3>
        <p>No reviews yet. Be the first to review!</p>
      </div>

      {/* RECOMMENDED / SIMILAR PRODUCTS */}
      <div style={{ marginBottom: "50px" }}>
        <h3 style={{ color: "#007BFF", marginBottom: "15px" }}>Recommended / Similar Listings</h3>
        <div style={{ display: "flex", gap: "15px", overflowX: "auto" }}>
          {product.recommended?.map((p, i) => (
            <div key={i} style={{
              minWidth: "150px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "10px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
            }}>
              <img src={p.images?.[0]} alt={p.title} style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "6px" }} />
              <p style={{ fontSize: "14px", fontWeight: "500", margin: "5px 0" }}>{p.title}</p>
              <p style={{ fontSize: "14px", color: "#007BFF" }}>₦{Number(p.price).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}