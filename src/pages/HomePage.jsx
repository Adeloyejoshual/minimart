// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getMiniMartProducts } from "../helpers/minimart";
import { getMarketplaceProducts } from "../helpers/marketplace";
import "./HomePage.css";

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
      const market = await getMarketplaceProducts();
      console.log("Marketplace products:", market); // check image keys
      setMiniMart(mini);
      setMarketplace(market);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="home-page">
      {/* ================= Sticky Header ================= */}
      <div className="sticky-header">
        <h2 className="header-title">MiniMart Store</h2>
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

      {/* ================= Add MiniMart Product ================= */}
      {isAuthenticated && (
        <Link to="/minimart/add">
          <button className="chat-btn full-width-btn">
            Add MiniMart Product
          </button>
        </Link>
      )}

      {/* ================= MiniMart Products ================= */}
      <h3>MiniMart Products</h3>
      {miniMart.length === 0 && <p>No products yet.</p>}
      <div className="products-grid">
        {miniMart.map((p) => (
          <Link key={p.id} to={`/minimart/${p.id}`} className="product-card">
            <img
              src={p.image_url || "/placeholder.png"}
              alt={p.title}
              className="grid-product-img"
            />
            <h3 className="product-title">{p.title}</h3>
            <p className="product-price">₦{p.price}</p>
          </Link>
        ))}
      </div>

      {/* ================= Add Marketplace Product ================= */}
      {isAuthenticated && (
        <Link to="/marketplace/add">
          <button className="chat-btn full-width-btn" style={{ marginTop: "16px" }}>
            Add Marketplace Product
          </button>
        </Link>
      )}

      {/* ================= Marketplace Products ================= */}
      <h3 style={{ marginTop: "24px" }}>Marketplace</h3>
      {marketplace.length === 0 && <p>No products yet.</p>}
      <div className="products-grid">
        {marketplace.map((p) => (
          <Link key={p._id} to={`/marketplace/${p._id}`} className="product-card">
            <img
              src={p.image || p.image_url || "/placeholder.png"}
              alt={p.title}
              className="grid-product-img"
            />
            <h3 className="product-title">{p.title}</h3>
            <p className="product-price">₦{p.price}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}