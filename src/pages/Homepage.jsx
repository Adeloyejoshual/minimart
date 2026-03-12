// src/pages/Homepage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

const Homepage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true); // show loading
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get("/api/marketplace");
        if (res.data && res.data.data) {
          setProducts(res.data.data);
        } else {
          setError("No products found");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch products");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) return <p style={{ padding: "20px" }}>Loading products...</p>;
  if (error) return <p style={{ padding: "20px", color: "red" }}>{error}</p>;

  return (
    <div className="container" style={{ padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>MiniMart Marketplace</h1>
      </header>

      <section style={{ marginTop: "20px" }}>
        {products.length === 0 ? (
          <p>No products available.</p>
        ) : (
          <div className="products" style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
            {products.map((product) => (
              <div
                key={product.id}
                className="product-card"
                style={{ border: "1px solid #ccc", padding: "10px", width: "200px" }}
              >
                <img
                  src={product.image_url || "/placeholder.png"}
                  alt={product.title}
                  style={{ width: "100%", height: "150px", objectFit: "cover" }}
                />
                <h3>{product.title}</h3>
                <p>₦{product.price}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Homepage;