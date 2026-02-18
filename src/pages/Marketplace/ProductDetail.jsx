// src/pages/Marketplace/ProductDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/marketplace/${id}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching product:", err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "80px" }}>
        <h3>Loading product...</h3>
      </div>
    );
  }

  if (!product || product.message === "Product not found") {
    return (
      <div style={{ textAlign: "center", marginTop: "80px" }}>
        <h3>Product not found</h3>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "40px auto", padding: "0 15px" }}>
      
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "none",
          color: "#007BFF",
          fontWeight: "600",
          cursor: "pointer",
          marginBottom: "20px"
        }}
      >
        <FaArrowLeft /> Back
      </button>

      <h1>{product.title}</h1>
      <p>₦{Number(product.price).toLocaleString()}</p>
      <p>{product.description}</p>

    </div>
  );
}