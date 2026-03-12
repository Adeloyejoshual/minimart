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
    <div className="container">
      <h2>Marketplace</h2>
      <Link to="/add-product" style={{ display: "inline-block", margin: "10px 0" }}>
        Add New Product
      </Link>

      {loading ? (
        <p>Loading products...</p>
      ) : products.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <div className="products" style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
          {products.map((p) => (
            <div
              key={p.id}
              className="product-card"
              style={{ border: "1px solid #ddd", padding: "10px", width: "200px" }}
            >
              <img
                src={p.image_url || "/placeholder.png"}
                alt={p.title}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
              <h3>{p.title}</h3>
              <p>₦{p.price}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Homepage;