// src/pages/ProductDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadProduct = async () => {
      const docRef = doc(db, "products", productId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct({ id: docSnap.id, ...docSnap.data() });
      } else {
        alert("Product not found");
        navigate("/minimart");
      }
    };
    loadProduct();
  }, [productId, navigate]);

  if (!product) return <p style={{ textAlign: "center" }}>Loading product...</p>;

  const handleStartChat = () => {
    if (currentUser.uid === product.ownerId) return;
    navigate(
      `/chat/${product.ownerId}?product=${productId}&productName=${encodeURIComponent(
        product.name
      )}`
    );
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.seconds) return "N/A";
    return new Date(timestamp.seconds * 1000).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={{ maxWidth: 600, margin: "20px auto", padding: 16 }}>
      {/* Product Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          padding: 16,
          marginBottom: 16,
        }}
      >
        <img
          src={product.imageUrl}
          alt={product.name}
          style={{
            width: "100%",
            height: 300,
            objectFit: "cover",
            borderRadius: 10,
            marginBottom: 12,
          }}
        />

        <h2 style={{ margin: "4px 0" }}>
          {product.name}{" "}
          {product.sold && (
            <span style={{ color: "#dc3545", fontSize: 14 }}>(SOLD)</span>
          )}
        </h2>

        <p style={{ fontSize: 20, fontWeight: "bold", color: "#0D6EFD" }}>
          ₦{product.price}
        </p>

        <p style={{ marginTop: 8 }}>{product.description}</p>

        <p style={{ fontSize: 14, color: "#555", marginTop: 8 }}>
          Category: <b>{product.category}</b> | Market:{" "}
          <b>{product.marketType}</b>
        </p>

        <p style={{ fontSize: 12, color: "#777", marginTop: 6 }}>
          Posted: {formatDate(product.postedAt)}
        </p>
      </div>

      {/* Start Chat */}
      {currentUser.uid !== product.ownerId && (
        <button
          onClick={handleStartChat}
          style={{
            width: "100%",
            padding: "14px",
            background: "#0D6EFD",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 16,
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          💬 Start Chat
        </button>
      )}

      {/* Seller Info */}
      <div
        style={{
          background: "#f8f9fa",
          borderRadius: 10,
          padding: 14,
          fontSize: 14,
        }}
      >
        <strong>Seller</strong>
        <p style={{ margin: "6px 0" }}>{product.ownerName}</p>

        {product.sold && (
          <p style={{ color: "#dc3545", fontSize: 13 }}>
            This product has been sold.
          </p>
        )}
      </div>
    </div>
  );
}