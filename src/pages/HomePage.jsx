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
      const market = await getMarketplaceProducts();
      setMiniMart(mini);
      setMarketplace(market);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="scrollable-content">
      {/* Header */}
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

      {/* Add Button */}
      {isAuthenticated && (
        <Link to="/minimart/add">
          <button className="chat-btn full-width-btn">
            Add MiniMart Product
          </button>
        </Link>
      )}

      {/* MiniMart */}
      <h3>MiniMart Products</h3>
      {miniMart.length === 0 && <p>No products yet.</p>}
      <div className="products-grid">
        {miniMart.map((p) => (
          <div key={p.id} className="product-card">
            {p.image_url && (
              <img
                src={p.image_url}
                alt={p.title}
                className="grid-product-img"
              />
            )}
            <h3 className="product-title">{p.title}</h3>
            <p className="product-price">₦{p.price}</p>
          </div>
        ))}
      </div>

      {/* Marketplace */}
      <h3 style={{ marginTop: "24px" }}>Marketplace</h3>
      {marketplace.length === 0 && <p>No products yet.</p>}
      <div className="products-grid">
        {marketplace.map((p) => (
          <div key={p._id} className="product-card">
            {p.image_url && (
              <img
                src={p.image_url}
                alt={p.title}
                className="grid-product-img"
              />
            )}
            <h3 className="product-title">{p.title}</h3>
            <p className="product-price">₦{p.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}