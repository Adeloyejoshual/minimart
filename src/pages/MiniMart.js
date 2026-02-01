// src/pages/MiniMart.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function MiniMartPage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [showMyProducts, setShowMyProducts] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Check logged-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
      if (!currentUser) navigate("/login");
    });
    return () => unsubscribe();
  }, [navigate]);

  // ✅ Load products from backend
  const loadProducts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/mart-products`);
      const products = res.data || [];
      setAllProducts(products);

      const mine = products.filter(p => p.sellerId === user.uid);
      setMyProducts(mine);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load products on mount and after login
  useEffect(() => {
    if (user) loadProducts();
  }, [user]);

  // Refresh after adding a product
  useEffect(() => {
    if (location.state?.refresh) {
      loadProducts();
      window.history.replaceState({}, document.title); // clear refresh flag
    }
  }, [location.state]);

  if (!authChecked) return <p>Checking authentication...</p>; // wait for auth check

  const displayedProducts = showMyProducts ? myProducts : allProducts;

  return (
    <div style={{ padding: 20, fontFamily: "Segoe UI, sans-serif", maxWidth: 1000, margin: "0 auto" }}>
      <h1>MiniMart</h1>

      {/* Buttons */}
      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <button
          style={buttonStyle}
          onClick={() => navigate("/mart-product")}
        >
          + Add Product
        </button>
        <button
          style={{ ...buttonStyle, background: showMyProducts ? "#198754" : "#4da6ff" }}
          onClick={() => setShowMyProducts(prev => !prev)}
        >
          {showMyProducts ? "Show All Products" : "Show My Products"}
        </button>
      </div>

      {/* Products */}
      {loading ? (
        <p>Loading products...</p>
      ) : displayedProducts.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div style={gridStyle}>
          {displayedProducts.map(p => (
            <div key={p._id} style={productCardStyle} onClick={() => navigate(`/product/${p._id}`)}>
              <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} style={productImageStyle} />
              <h3 style={{ margin: "10px 0 5px" }}>{p.title}</h3>
              <p style={{ fontSize: 14, color: "#555" }}>{p.description}</p>
              <p style={{ fontWeight: "bold", color: "#198754", marginTop: 5 }}>₦{Number(p.price).toLocaleString()}</p>
              <small>Seller: {p.sellerName || "Unknown"}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== Styles ======
const buttonStyle = {
  padding: "10px 15px",
  background: "#4da6ff",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 15
};

const productCardStyle = {
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  padding: 10,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column"
};

const productImageStyle = {
  width: "100%",
  height: 160,
  objectFit: "cover",
  borderRadius: 6
};