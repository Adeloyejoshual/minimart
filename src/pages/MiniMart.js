import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

export default function MiniMartPage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [showMyProducts, setShowMyProducts] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("token");

  // ✅ Check logged-in user
  useEffect(() => {
    const checkUser = async () => {
      if (!token) return navigate("/login");

      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(res);
      } catch {
        navigate("/login");
      } finally {
        setAuthChecked(true);
      }
    };
    checkUser();
  }, [navigate, token]);

  // ✅ Load products
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/mart-products`);
      setAllProducts(res.data);
      const mine = res.data.filter(p => p.sellerId === user?.id);
      setMyProducts(mine);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) loadProducts(); }, [user]);
  useEffect(() => {
    if (location.state?.refresh) {
      loadProducts();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  if (!authChecked) return <p>Checking authentication...</p>;

  const displayedProducts = showMyProducts ? myProducts : allProducts;

  return (
    <div style={{ padding: 20, maxWidth: 1000, margin: "0 auto" }}>
      <h1>MiniMart</h1>
      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <button style={buttonStyle} onClick={() => navigate("/mart-product")}>+ Add Product</button>
        <button style={{ ...buttonStyle, background: showMyProducts ? "#198754" : "#4da6ff" }}
          onClick={() => setShowMyProducts(prev => !prev)}>
          {showMyProducts ? "Show All Products" : "Show My Products"}
        </button>
      </div>

      {loading ? <p>Loading...</p> :
        displayedProducts.length === 0 ? <p>No products found.</p> :
        <div style={gridStyle}>
          {displayedProducts.map(p => (
            <div key={p._id} style={productCardStyle} onClick={() => navigate(`/product/${p._id}`)}>
              <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} style={productImageStyle} />
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <p>₦{Number(p.price).toLocaleString()}</p>
              <small>Seller: {p.sellerName || "Unknown"}</small>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

const buttonStyle = { padding: "10px 15px", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 15 };
const productCardStyle = { background: "#fff", borderRadius: 8, padding: 10, cursor: "pointer", display: "flex", flexDirection: "column" };
const productImageStyle = { width: "100%", height: 160, objectFit: "cover", borderRadius: 6 };