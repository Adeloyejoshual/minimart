// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

// Helper for Cloudinary
const getCloudinaryUrl = (url) => url || null;

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const { loginWithRedirect, logout, isAuthenticated, user } = useAuth0();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const miniRes = await axios.get("/api/minimart");
      setMiniMart(miniRes.data);

      const marketRes = await axios.get("/api/marketplace");
      setMarketplace(marketRes.data);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      {/* ---------------- Header ---------------- */}
      <header className="sticky-header">
        <div className="header-title">MiniMart & Marketplace</div>
        {isAuthenticated ? (
          <>
            <span style={{ marginRight: "10px" }}>Hello, {user.name}</span>
            <button
              onClick={() => logout({ returnTo: window.location.origin })}
              className="chat-btn"
            >
              Logout
            </button>
          </>
        ) : (
          <button onClick={() => loginWithRedirect()} className="chat-btn">
            Login / Register
          </button>
        )}
      </header>

      {/* ---------------- MiniMart ---------------- */}
      <h2 style={{ marginTop: "24px" }}>MiniMart Products</h2>
      {miniMart.length === 0 && <p>No MiniMart products yet.</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        {miniMart.map((p) => (
          <div
            key={p.id}
            className="product-card"
            style={{ width: "150px", textAlign: "center" }}
          >
            {p.image_url && (
              <img
                src={getCloudinaryUrl(p.image_url)}
                alt={p.title}
                style={{ width: "100%", height: "100px", objectFit: "cover" }}
              />
            )}
            <h4 className="product-title">{p.title}</h4>
            <p className="product-price">₦{p.price}</p>
          </div>
        ))}
      </div>
      {isAuthenticated && (
        <Link to="/minimart/add" className="chat-btn" style={{ marginTop: "12px", display: "inline-block" }}>
          Add MiniMart Product
        </Link>
      )}

      {/* ---------------- Marketplace ---------------- */}
      <h2 style={{ marginTop: "24px" }}>Marketplace Products</h2>
      {marketplace.length === 0 && <p>No Marketplace products yet.</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        {marketplace.map((p) => (
          <div
            key={p._id}
            className="product-card"
            style={{ width: "150px", textAlign: "center" }}
          >
            {p.image_url && (
              <img
                src={getCloudinaryUrl(p.image_url)}
                alt={p.title}
                style={{ width: "100%", height: "100px", objectFit: "cover" }}
              />
            )}
            <h4 className="product-title">{p.title}</h4>
            <p className="product-price">₦{p.price}</p>
          </div>
        ))}
      </div>
      {isAuthenticated && (
        <Link to="/marketplace/add" className="chat-btn" style={{ marginTop: "12px", display: "inline-block" }}>
          Add Marketplace Product
        </Link>
      )}
    </div>
  );
}p.