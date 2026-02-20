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
  const { isAuthenticated } = useAuth0();

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
      console.error("Failed to fetch products:", err);
    }
  };

  return (
    <div className="home-page" style={{ padding: "16px" }}>
      {/* Sticky Header */}
      <div className="sticky-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="header-title">MiniMart Store</h2>
        {!isAuthenticated && (
          <div style={{ display: "flex", gap: "8px" }}>
            <Link to="/login">
              <button className="chat-btn">Login</button>
            </Link>
            <Link to="/register">
              <button className="chat-btn">Register</button>
            </Link>
          </div>
        )}
        {isAuthenticated && (
          <Link to="/logout">
            <button className="chat-btn">Logout</button>
          </Link>
        )}
      </div>

      {/* Navigation Cards */}
      <div className="home-navigation" style={{ display: "flex", gap: "16px", margin: "16px 0" }}>
        <Link to="/marketplace" className="nav-card">
          <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "#0D6EFD", color: "#fff", flex: 1, textAlign: "center", fontWeight: "600", cursor: "pointer" }}>
            Marketplace
          </div>
        </Link>

        <Link to="/minimart" className="nav-card">
          <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "#198754", color: "#fff", flex: 1, textAlign: "center", fontWeight: "600", cursor: "pointer" }}>
            MiniMart
          </div>
        </Link>

        <Link to="/offers" className="nav-card">
          <div style={{ padding: "20px", borderRadius: "12px", backgroundColor: "#FFC107", color: "#000", flex: 1, textAlign: "center", fontWeight: "600", cursor: "pointer" }}>
            Offers
          </div>
        </Link>
      </div>

      {/* Add Product Buttons */}
      {isAuthenticated && (
        <>
          <Link to="/minimart/add">
            <button className="chat-btn full-width-btn">Add MiniMart Product</button>
          </Link>
          <Link to="/marketplace/add">
            <button className="chat-btn full-width-btn" style={{ marginTop: "16px" }}>Add Marketplace Product</button>
          </Link>
        </>
      )}

      {/* MiniMart Products */}
      <h3 style={{ marginTop: "24px" }}>MiniMart Products</h3>
      {miniMart.length === 0 && <p>No products yet.</p>}
      <div className="products-grid">
        {miniMart.map((p) => (
          <Link key={p.id} to={`/minimart/${p.id}`} className="product-card">
            <img src={p.image_url || "/placeholder.png"} alt={p.title} className="grid-product-img" />
            <h3 className="product-title">{p.title}</h3>
            <p className="product-price">₦{p.price}</p>
          </Link>
        ))}
      </div>

      {/* Marketplace Products */}
      <h3 style={{ marginTop: "24px" }}>Marketplace</h3>
      {marketplace.length === 0 && <p>No products yet.</p>}
      <div className="products-grid">
        {marketplace.map((p) => (
          <Link key={p._id} to={`/marketplace/${p._id}`} className="product-card">
            <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} className="grid-product-img" />
            <h3 className="product-title">{p.title}</h3>
            <p className="product-price">₦{p.price}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}