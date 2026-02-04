import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "../../styles/homepage.css";

// Use .env variable
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL;
const socket = io(BACKEND_URL, { transports: ["websocket"] });

function HomePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Electronics", "Fashion", "Home", "Phones", "Beauty"];

  // Fetch initial products
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/marketplace/listings`)
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Failed to fetch listings:", err));
  }, []);

  // Real-time: listen for newly added products
  useEffect(() => {
    socket.on("productAdded", (newProduct) => {
      setProducts(prev => [newProduct, ...prev]);
    });

    return () => socket.off("productAdded");
  }, []);

  return (
    <div className="homepage">
      <div className="section">
        {/* Add Product Button */}
        <button
          className="load-more-btn"
          style={{ marginBottom: 24 }}
          onClick={() => navigate("/marketplace/addproduct")}
        >
          + Add Product
        </button>

        {/* Category Filter */}
        <div className="category-grid">
          {categories.map(cat => (
            <div
              key={cat}
              className={`category-btn ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </div>
          ))}
        </div>

        <h2 className="section-title">Latest Listings</h2>

        {/* Product Grid */}
        <div className="product-grid">
          {products
            .filter(p => selectedCategory === "All" || p.category === selectedCategory)
            .map(product => (
              <div
                key={product._id}
                className="product-card"
                onClick={() => navigate(`/marketplace/listing/${product._id}`)}
              >
                {product.isPromoted && <div className="badge-promo">PROMOTED</div>}
                {product.isProSeller && <div className="badge-pro">PRO SELLER</div>}

                <img
                  src={product.images?.[0] || "https://via.placeholder.com/400x300"}
                  alt={product.title}
                  className="product-img"
                />

                <h3 className="product-title">{product.title}</h3>
                <p className="product-location">{product.location}</p>
                <p className="product-price">₦{product.price?.toLocaleString()}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default HomePage;