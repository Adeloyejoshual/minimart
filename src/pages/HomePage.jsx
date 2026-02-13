// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getMiniMartProducts } from "../helpers/minimart";
import { getMarketplaceProducts } from "../helpers/marketplace";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const mini = await getMiniMartProducts();
      setMiniMart(mini);

      const market = await getMarketplaceProducts();
      setMarketplace(market);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  return (
    <div className="scrollable-content">
      {/* ---------------- Header ---------------- */}
      <div className="sticky-header">
        <h2 className="header-title">MiniMart & Marketplace</h2>
        {isAuthenticated ? (
          <button
            className="chat-btn"
            onClick={() => logout({ returnTo: window.location.origin })}
          >
            Logout
          </button>
        ) : (
          <button className="chat-btn" onClick={() => loginWithRedirect()}>
            Login / Register
          </button>
        )}
      </div>

      {/* ---------------- Add Product Button ---------------- */}
      {isAuthenticated && (
        <div style={{ margin: "16px 0" }}>
          <Link to="/minimart/add">
            <button className="chat-btn" style={{ marginRight: "12px" }}>
              Add MiniMart Product
            </button>
          </Link>
          <Link to="/marketplace/add">
            <button className="chat-btn">Add Marketplace Product</button>
          </Link>
        </div>
      )}

      {/* ---------------- MiniMart Products ---------------- */}
      <h3>MiniMart Products</h3>
      {miniMart.length === 0 && <p>No MiniMart products yet.</p>}
      {miniMart.map((p) => (
        <div key={p.id} className="product-card">
          {p.image_url && (
            <img
              src={p.image_url}
              alt={p.title}
              className="product-images"
              style={{ height: "120px" }}
            />
          )}
          <h3 className="product-title">{p.title}</h3>
          <p className="product-price">₦{p.price}</p>
        </div>
      ))}

      {/* ---------------- Marketplace Products ---------------- */}
      <h3>Marketplace Products</h3>
      {marketplace.length === 0 && <p>No Marketplace products yet.</p>}
      {marketplace.map((p) => (
        <div key={p._id} className="product-card">
          {p.image_url && (
            <img
              src={p.image_url}
              alt={p.title}
              className="product-images"
              style={{ height: "120px" }}
            />
          )}
          <h3 className="product-title">{p.title}</h3>
          <p className="product-price">₦{p.price}</p>
        </div>
      ))}
    </div>
  );
}