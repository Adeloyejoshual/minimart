import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await axios.get(`/api/marketplace/${id}`);
      setProduct(res.data);
      setLoading(false);
    } catch (err) {
      setError("Failed to fetch product.");
      setLoading(false);
    }
  };

  if (loading) return <h2 style={{ textAlign: "center" }}>Loading product...</h2>;
  if (error) return <h2 style={{ textAlign: "center" }}>{error}</h2>;

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          marginBottom: "20px",
          padding: "8px 12px",
          background: "#0D6EFD",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer"
        }}
      >
        ← Back
      </button>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 6px 12px rgba(0,0,0,0.1)"
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            style={{ width: "100%", maxHeight: "400px", objectFit: "cover", borderRadius: "12px" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "400px",
              background: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "12px"
            }}
          >
            No Image
          </div>
        )}

        <h2 style={{ fontSize: "24px", color: "#0D6EFD", marginBottom: "10px" }}>
          {product.title}
        </h2>

        <p style={{ fontSize: "22px", fontWeight: "bold", color: "#198754", marginBottom: "10px" }}>
          ₦{product.price}
        </p>

        {product.description && (
          <p style={{ fontSize: "16px", color: "#444", marginBottom: "20px" }}>
            {product.description}
          </p>
        )}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            style={{
              flex: 1,
              padding: "12px 16px",
              background: "#198754",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            Add to Cart
          </button>

          <button
            style={{
              flex: 1,
              padding: "12px 16px",
              background: "#0D6EFD",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 600
            }}
            onClick={() => alert("Messaging seller feature coming soon")}
          >
            Contact Seller
          </button>
        </div>
      </div>
    </div>
  );
}