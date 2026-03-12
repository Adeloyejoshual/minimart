// src/pages/Homepage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const Homepage = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    axios.get("/api/marketplace")
      .then((res) => setProducts(res.data.data))
      .catch((err) => console.error("Failed to fetch products:", err));
  }, []);

  return (
    <div className="container">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>MiniMart Marketplace</h2>
        <nav>
          <Link to="/login" style={{ marginRight: "10px" }}>Login</Link>
          <Link to="/register">Register</Link>
        </nav>
      </header>

      <section style={{ marginTop: "20px" }}>
        <Link to="/add-product" style={{ display: "inline-block", marginBottom: "20px" }}>
          Add New Product
        </Link>

        <div className="products" style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
          {products.length > 0 ? (
            products.map((p) => (
              <div key={p.id} className="product-card" style={{ border: "1px solid #ccc", padding: "10px", width: "200px" }}>
                <img
                  src={p.image_url || "/placeholder.png"}
                  alt={p.title}
                  style={{ width: "100%", height: "150px", objectFit: "cover" }}
                />
                <h3>{p.title}</h3>
                <p>₦{p.price}</p>
              </div>
            ))
          ) : (
            <p>No products available.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Homepage;