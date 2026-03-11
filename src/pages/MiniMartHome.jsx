import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function MiniMartHome() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(
        "https://minimart-ivrm.onrender.com/api/marketplace/products"
      );
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  return (
    <div style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>MiniMart Store</h1>
      <Link to="/minimart/add">
        <button
          style={{
            padding: "10px 16px",
            marginBottom: "16px",
            background: "#0D6EFD",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Add Product
        </button>
      </Link>

      {products.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "16px",
          }}
        >
          {products.map((p) => (
            <Link
              key={p.id}
              to={`/minimart/${p.id}`}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#f8fafd",
                borderRadius: "12px",
                overflow: "hidden",
                textDecoration: "none",
                color: "inherit",
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                transition: "transform 0.2s",
              }}
            >
              <img
                src={p.image || "/placeholder.png"}
                alt={p.title}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
              <h3 style={{ margin: "8px", fontSize: "16px", fontWeight: 600 }}>
                {p.title}
              </h3>
              <p style={{ margin: "0 8px 12px", color: "#0D6EFD", fontWeight: 700 }}>
                ₦{p.price}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}