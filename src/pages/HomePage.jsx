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
      setMiniMart(mini);
      setMarketplace(market);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  return (
    <div className="home-page">
      {/* Header */}
      <header className="sticky-header">
        <h2 className="header-title">MiniMart Store</h2>
        {isAuthenticated ? (
          <button
            className="auth-btn logout"
            onClick={() => logout({ returnTo: window.location.origin })}
          >
            Logout
          </button>
        ) : (
          <button className="auth-btn login" onClick={() => loginWithRedirect()}>
            Login / Register
          </button>
        )}
      </header>

      {/* Navigation */}
      <div className="home-navigation">
        <Link to="/marketplace" className="nav-card marketplace-card">
          Marketplace
        </Link>
        <Link to="/minimart" className="nav-card minimart-card">
          MiniMart
        </Link>
        <Link to="/offers" className="nav-card offers-card">
          Offers
        </Link>
      </div>

      {/* Add Product Buttons */}
      {isAuthenticated && (
        <>
          <Link to="/minimart/add">
            <button className="auth-btn full-width-btn">Add MiniMart Product</button>
          </Link>
          <Link to="/marketplace/add">
            <button className="auth-btn full-width-btn">Add Marketplace Product</button>
          </Link>
        </>
      )}

      {/* MiniMart Products */}
      <section>
        <h3>MiniMart Products</h3>
        {miniMart.length === 0 ? <p>No products yet.</p> : (
          <div className="products-grid">
            {miniMart.map((p) => (
              <Link key={p.id} to={`/minimart/${p.id}`} className="product-card">
                <img src={p.image_url || "/placeholder.png"} alt={p.title} className="grid-product-img" />
                <h3 className="product-title">{p.title}</h3>
                <p className="product-price">₦{p.price}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Marketplace Products */}
      <section>
        <h3>Marketplace</h3>
        {marketplace.length === 0 ? <p>No products yet.</p> : (
          <div className="products-grid">
            {marketplace.map((p) => (
              <Link key={p._id} to={`/marketplace/${p._id}`} className="product-card">
                <img src={p.images?.[0] || "/placeholder.png"} alt={p.title} className="grid-product-img" />
                <h3 className="product-title">{p.title}</h3>
                <p className="product-price">₦{p.price}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}