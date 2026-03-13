import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get("/api/marketplace");
        setProducts(res.data);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  if (loading) return <p>Loading products...</p>;

  return (
    <div style={{ maxWidth: "1000px", margin: "2rem auto" }}>
      <h1>MiniMart Products</h1>

      {user && (
        <div style={{ margin: "1rem 0" }}>
          <Link to="/add-product">
            <button>Add Product</button>
          </Link>
        </div>
      )}

      {products.length === 0 ? (
        <p>No products available</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          {products.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid #ddd",
                padding: "1rem",
                borderRadius: "8px",
              }}
            >
              {p.image && (
                <img
                  src={p.image}
                  alt={p.title}
                  style={{ width: "100%", height: "150px", objectFit: "cover" }}
                />
              )}
              <h3>{p.title}</h3>
              {p.description && <p>{p.description}</p>}
              <p>
                <strong>Price:</strong> ${p.price}
              </p>
              <p>
                <strong>Stock:</strong> {p.stock}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}