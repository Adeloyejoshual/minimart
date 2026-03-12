// src/pages/Homepage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const Homepage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get("/api/marketplace");
        setProducts(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div className="container" style={{ padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>MiniMart Marketplace</h2>
        <nav>
          <Link to="/login" style={{ marginRight: "10px" }}>Login</Link>
          <Link to="/add-product">Add Product</Link>
        </nav>
      </header>

      <section style={{ marginTop: "20px" }}>
        {loading ? (
          <p>Loading products...</p>
        ) : products.length > 0 ? (
          <div
            className="products"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "20px",
            }}
          >
            {products.map((p) => (
              <div
                key={p.id}
                className="product-card"
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "10px",
                  position: "relative",
                }}
              >
                {p.promoted && (
                  <span
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      backgroundColor: "#FFD700",
                      color: "#000",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    PROMOTED
                  </span>
                )}
                <img
                  src={p.image_url || "/placeholder.png"}
                  alt={p.title}
                  style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "4px" }}
                />
                <h3>{p.title}</h3>
                <p>₦{p.price.toLocaleString()}</p>
                <p>Stock: {p.stock}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>No products available.</p>
        )}
      </section>
    </div>
  );
};

export default Homepage;