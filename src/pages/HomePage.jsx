// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getMiniMartProducts } from "../helpers/minimart";

export default function HomePage() {
  const [miniMart, setMiniMart] = useState([]);
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const products = await getMiniMartProducts();
      setMiniMart(products);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="scrollable-content">
      {/* ---------------- Header ---------------- */}
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

      {/* ---------------- Add Product Button ---------------- */}
      {isAuthenticated && (
        <Link to="/minimart/add">
          <button className="chat-btn" style={{ margin: "16px 0" }}>
            Add MiniMart Product
          </button>
        </Link>
      )}

      {/* ---------------- Products ---------------- */}
      {miniMart.length === 0 && <p>No products yet.</p>}
      {miniMart.map((p) => (
        <div key={p.id} className="product-card">
          {p.image_url && (
            <img
              src={p.image_url}
              alt={p.title}
              className="product-images"
              style={{ height: "120px" }} // smaller image
            />
          )}
          <h3 className="product-title">{p.title}</h3>
          <p className="product-price">₦{p.price}</p>
        </div>
      ))}
    </div>
  );
}