import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/homepage.css";

function HomePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Electronics", "Fashion", "Home", "Phones", "Beauty"];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/marketplace/listings`
      );
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch listings", err);
    }
  };

  return (
    <div className="homepage">
      <div className="section">

        <div className="search-area">
          <input type="text" placeholder="Search for products..." className="search-input" />
        </div>

        <div className="category-grid">
          {categories.map((cat) => (
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

        <div className="product-grid">
          {products.map((product) => (
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

        <button className="load-more-btn">Load More Products</button>
      </div>
    </div>
  );
}

export default HomePage;