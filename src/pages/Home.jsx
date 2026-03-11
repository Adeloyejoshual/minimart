// src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch products from backend
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace");
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "50px" }}>Loading products...</p>;
  }

  if (!products.length) {
    return <p style={{ textAlign: "center", marginTop: "50px" }}>No products available.</p>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ marginBottom: "20px", textAlign: "center" }}>MiniMart Products</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
        }}
      >
        {products.map((p) => (
          <Link
            key={p.id}
            to={`/minimart/${p.id}`}
            style={{
              textDecoration: "none",
              color: "#000",
              border: "1px solid #ddd",
              borderRadius: "12px",
              overflow: "hidden",
              background: "#fff",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {p.image_url ? (
              <img
                src={p.image_url}
                alt={p.title}
                style={{ width: "100%", height: "180px", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "180px",
                  background: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#888",
                }}
              >
                No Image
              </div>
            )}
            <div style={{ padding: "12px", flexGrow: 1 }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px" }}>
                {p.title}
              </h3>
              <p style={{ fontSize: "14px", color: "#198754", fontWeight: 600 }}>
                ₦{Number(p.price).toLocaleString()}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}