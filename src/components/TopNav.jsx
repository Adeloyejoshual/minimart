// src/components/TopNav.jsx - MODERN DESIGN MATCHING HOMEPAGE
import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/TopNav.css"; // New CSS file

export default function TopNav({ user, setUser }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/auth");
  };

  return (
    <header className="top-nav">
      {/* Logo & Brand */}
      <div className="nav-brand" onClick={() => navigate("/")}>
        <div className="logo-icon">🛒</div>
        <span className="brand-name">MiniMart</span>
      </div>

      {/* Navigation Menu */}
      <nav className="nav-menu">
        {user ? (
          /* Logged In Menu */
          <div className="user-menu">
            <div className="user-greeting">
              <span className="welcome-text">Welcome back,</span>
              <span className="user-name">{user.name}</span>
            </div>
            
            <div className="nav-actions">
              <button 
                className="nav-btn profile-btn"
                onClick={() => navigate("/profile")}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                Profile
              </button>
              
              <button 
                className="nav-btn add-product-btn"
                onClick={() => navigate("/minimart/add")}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Add Product
              </button>
              
              <button 
                className="nav-btn logout-btn"
                onClick={handleLogout}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                </svg>
                Logout
              </button>
            </div>
          </div>
        ) : (
          /* Guest Menu */
          <div className="guest-menu">
            <button 
              className="nav-btn login-btn"
              onClick={() => navigate("/auth")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Login
            </button>
            
            <button 
              className="nav-btn register-btn"
              onClick={() => navigate("/auth")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Register
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}