import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await axios.get(`/api/marketplace/${id}`);
      setProduct(res.data);
    } catch (err) {
      console.error("Failed to fetch product:", err);
    }
  };

  if (!product) {
    return <p>Loading product...</p>;
  }

  return (
    <div style={{ padding: "16px", fontFamily: "Arial, sans-serif", background: "#eaf2ff" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0D6EFD", color: "#fff", padding: "12px 16px", borderRadius: "8px" }}>
        <button onClick={() => navigate(-1)} style={{ background: "#0D6EFD", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer" }}>← Back</button>
        <h2 style={{ margin: 0 }}>{product.title}</h2>
      </div>

      {/* Product Image */}
      <div style={{ marginTop: "16px", textAlign: "center" }}>
        <img
          src={product.image_url || "/placeholder.png"}
          alt={product.title}
          style={{ width: "100%", maxWidth: "400px", height: "auto", borderRadius: "16px", objectFit: "cover" }}
        />
      </div>

      {/* Product Info */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", marginTop: "16px", boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}>
        <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#0D6EFD" }}>{product.title}</h3>
        <p style={{ fontSize: "22px", fontWeight: "bold", color: "#198754" }}>₦{product.price}</p>
        {product.description && <p style={{ fontSize: "14px", color: "#444" }}>{product.description}</p>}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
          <button style={{ background: "#0D6EFD", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: 600 }}>
            Contact Seller
          </button>
          <button style={{ background: "#198754", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "10px", cursor: "pointer", fontWeight: 600 }}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}