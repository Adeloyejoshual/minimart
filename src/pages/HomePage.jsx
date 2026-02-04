import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import AddProduct from "./marketplace/AddProduct.jsx";
import "../styles/homepage.css";

function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, loginWithRedirect, logout, user, isLoading } = useAuth0();

  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Electronics", "Fashion", "Home", "Phones", "Beauty"];

  useEffect(() => {
    if (isAuthenticated) fetchProducts();
  }, [isAuthenticated]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/marketplace/listings`);
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch listings", err);
    }
  };

  if (isLoading) {
    return (
      <div className="homepage" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Filter products by category
  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  return (
    <div className="homepage">
      <div className="section">
        {/* ================= AUTH SECTION ================= */}
        {!isAuthenticated && (
          <div className="auth-section" style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1>Welcome to MiniMart Marketplace</h1>
            <p>Sign up or log in to start buying and selling products.</p>
            <div style={{ marginTop: "20px" }}>
              <button
                onClick={() => loginWithRedirect({ screen_hint: "signup" })}
                className="load-more-btn"
                style={{ marginRight: "12px" }}
              >
                Sign Up
              </button>
              <button
                onClick={() => loginWithRedirect()}
                className="load-more-btn"
                style={{ background: "#3b82f6", color: "#fff", borderColor: "#3b82f6" }}
              >
                Log In
              </button>
            </div>
          </div>
        )}

        {/* ================= MARKETPLACE CONTENT ================= */}
        {isAuthenticated && (
          <>
            {/* Welcome + Logout */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2>Welcome, {user.name || user.email}!</h2>
              <button
                onClick={() => logout({ returnTo: window.location.origin })}
                className="load-more-btn"
                style={{ background: "#ef4444", color: "#fff", borderColor: "#ef4444", width: "auto", padding: "10px 20px" }}
              >
                Logout
              </button>
            </div>

            {/* SEARCH */}
            <div className="search-area">
              <input
                type="text"
                placeholder="Search for products..."
                className="search-input"
              />
            </div>

            {/* CATEGORY FILTER */}
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

            {/* ADD PRODUCT FORM */}
            <h2 className="section-title">Add New Product</h2>
            <AddProduct refreshProducts={fetchProducts} />

            {/* PRODUCT GRID */}
            <h2 className="section-title">Latest Listings</h2>
            <div className="product-grid">
              {filteredProducts.map((product) => (
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
          </>
        )}
      </div>
    </div>
  );
}

export default HomePage;