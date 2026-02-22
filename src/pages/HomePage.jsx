// src/pages/HomePage.jsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";

export default function HomePage() {
  const { isAuthenticated, user, logout, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      {/* HEADER */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        borderBottom: "1px solid #ddd"
      }}>
        <div><strong>MiniMart</strong></div>
        <input type="text" placeholder="Search products..." style={{ flex: 1, margin: "0 1rem", padding: "0.5rem" }} />
        <div>
          <button>🛒</button>
          {isAuthenticated ? (
            <button style={{ marginLeft: 8 }} onClick={() => logout({ returnTo: window.location.origin })}>👤</button>
          ) : (
            <button style={{ marginLeft: 8 }} onClick={() => loginWithRedirect()}>Login</button>
          )}
        </div>
      </header>

      {/* MAIN BANNER */}
      <section style={{
        margin: "1rem 0",
        height: 200,
        backgroundColor: "#eee",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <h2>Hero Banner / Promotions</h2>
      </section>

      {/* FEATURED SECTIONS */}
      <section style={{ display: "flex", gap: "1rem", padding: "0 2rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150, backgroundColor: "#f5f5f5", padding: "1rem" }}>
          <h3>MiniMart Featured</h3>
        </div>
        <div style={{ flex: 1, minWidth: 150, backgroundColor: "#f5f5f5", padding: "1rem" }}>
          <h3>Marketplace Trending</h3>
        </div>
        <div style={{ flex: 1, minWidth: 150, backgroundColor: "#f5f5f5", padding: "1rem" }}>
          <h3>Categories / Quick Links</h3>
        </div>
      </section>

      {/* INFINITE PRODUCT FEED */}
      <section style={{ padding: "2rem" }}>
        <h3>Flash Sales / Deals</h3>
        <div style={{ display: "flex", gap: "1rem", overflowX: "scroll" }}>
          {/* Example products */}
          {[1, 2, 3, 4, 5].map((p) => (
            <div key={p} style={{
              minWidth: 150,
              height: 200,
              backgroundColor: "#ddd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              Product {p}
            </div>
          ))}
        </div>
      </section>

      {/* BOTTOM NAVIGATION */}
      <nav style={{
        position: "fixed",
        bottom: 0,
        width: "100%",
        display: "flex",
        justifyContent: "space-around",
        padding: "1rem 0",
        borderTop: "1px solid #ddd",
        backgroundColor: "#fff"
      }}>
        <Link to="/">🏠 Home</Link>
        <Link to="/mart">🛒 Mart</Link>
        <Link to="/add-product">➕ Sell</Link>
        <Link to="/messages">💬 Message</Link>
        <Link to="/profile">👤 Profile</Link>
      </nav>
    </div>
  );
}