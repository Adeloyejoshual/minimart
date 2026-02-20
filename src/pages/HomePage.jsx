import React from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import "./HomePage.css";

export default function HomePage() {
  const { isAuthenticated, loginWithRedirect, logout, user, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="container">
      <header>
        <h1>MiniMart Marketplace</h1>
        {isAuthenticated ? (
          <div>
            <span style={{ marginRight: "12px" }}>
              Welcome, {user.name || user.email}
            </span>
            <button
              className="btn-primary"
              onClick={() => logout({ returnTo: window.location.origin })}
            >
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn-primary" onClick={() => loginWithRedirect()}>
              Sign In
            </button>
            <Link to="/register">
              <button className="btn-success">Sign Up</button>
            </Link>
          </div>
        )}
      </header>

      <div style={{ display: "flex", gap: "16px", margin: "16px 0" }}>
        <Link to="/marketplace" className="nav-card nav-marketplace">Marketplace</Link>
        <Link to="/minimart" className="nav-card nav-minimart">MiniMart</Link>
        <Link to="/offers" className="nav-card nav-offers">Offers</Link>
      </div>

      {isAuthenticated && (
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
          <Link to="/marketplace/add">
            <button className="btn-primary">Add Marketplace Product</button>
          </Link>
          <Link to="/minimart/add">
            <button className="btn-success">Add MiniMart Product</button>
          </Link>
        </div>
      )}
    </div>
  );
}