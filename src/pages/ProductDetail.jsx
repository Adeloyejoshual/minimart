import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/api/product/${id}`
        );
        setProduct(res.data.product);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load product"
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProduct();
  }, [id]);

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  if (!product) return null;

  const images = product.media?.images || [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      
      {/* 🔷 HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          borderBottom: "1px solid #eee",
          paddingBottom: 10,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{product.title}</h2>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            {product.category_name} • {product.subcategory_name}
          </p>
        </div>

        {/* ACTIONS */}
        <div style={{ display: "flex", gap: 10 }}>
          {/* VIEW SELLER */}
          <button
            onClick={() => navigate(`/seller/${product.seller_id}`)}
            style={btnStyle}
          >
            View Seller
          </button>

          {/* CHAT SELLER */}
          <button
            onClick={() =>
              navigate(`/conversations?userId=${product.seller_id}`)
            }
            style={{ ...btnStyle, background: "#2563eb", color: "#fff" }}
          >
            Chat Seller
          </button>
        </div>
      </div>

      {/* PRICE */}
      <h2 style={{ color: "green" }}>
        ₦{Number(product.price).toLocaleString()}
      </h2>

      {/* IMAGES */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
        {images.length > 0 ? (
          images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt=""
              style={{
                width: 250,
                height: 250,
                objectFit: "cover",
                borderRadius: 8,
              }}
            />
          ))
        ) : (
          <p>No images</p>
        )}
      </div>

      {/* DESCRIPTION */}
      <div style={{ marginTop: 20 }}>
        <h3>Description</h3>
        <p>{product.description || "No description"}</p>
      </div>

      {/* SELLER QUICK INFO */}
      <div style={{ marginTop: 20 }}>
        <h3>Seller</h3>
        <p>{product.seller_name}</p>
        <p style={{ fontSize: 12, color: "#666" }}>
          Click "View Seller" to see profile
        </p>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #ddd",
  cursor: "pointer",
  background: "#f9f9f9",
};