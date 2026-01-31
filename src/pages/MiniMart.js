import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function MiniMart() {
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

      const mine = products.filter(p => p.userId === user.uid);
      setMyProducts(mine);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadProducts();
  }, [user]);

  // ✅ Refresh after adding a product
  useEffect(() => {
    if (location.state?.refresh) {
      loadProducts();
      window.history.replaceState({}, document.title); // clear refresh flag
    }
  }, [location.state]);

  if (!authChecked) return <p>Checking authentication...</p>; // wait for auth check

  const displayedProducts = showMyProducts ? myProducts : allProducts;

  return (
    <div style={{ padding: 20, fontFamily: "Segoe UI, sans-serif" }}>
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

      {loading ? (
        <p>Loading products...</p>
      ) : displayedProducts.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {displayedProducts.map(p => (
            <li key={p._id} style={productCardStyle}>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <p><b>₦{p.price}</b></p>
              <small>Seller: {p.userEmail || "Unknown"}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const buttonStyle = {
  padding: "10px 15px",
  background: "#4da6ff",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600
};

const productCardStyle = {
  padding: 15,
  marginBottom: 12,
  background: "#f9f9f9",
  borderRadius: 8,
  boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
};