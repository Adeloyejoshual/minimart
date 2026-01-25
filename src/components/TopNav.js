import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaHome, FaStore, FaShoppingCart, FaUser, FaEnvelope } from "react-icons/fa";
import SlideMenu from "./SlideMenu"; // import the SlideMenu component

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const lightBlue = "#4da6ff"; // active color
  const inactiveColor = "#555";

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaHome /> },
    { path: "/minimart", label: "MiniMart", icon: <FaStore /> },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, hasBadge: true },
    { path: "/profile", label: "Account", icon: <FaUser /> },
  ];

  useEffect(() => {
    const stored = localStorage.getItem("selectedLocation");
    if (stored) setSelectedLocation(JSON.parse(stored));

    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    setCartCount(cart.length);
  }, [location]);

  const locationText = selectedLocation
    ? `${selectedLocation.state}, ${selectedLocation.city}`
    : "Region ▼";

  return (
    <div style={{ fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      {/* ---------- Top Bar ---------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid #ddd",
          backgroundColor: "#f8fafd",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        {/* MiniMart Logo */}
        <Link
          to="/minimart"
          style={{ fontWeight: "bold", fontSize: 18, textDecoration: "none", color: lightBlue }}
        >
          MiniMart
        </Link>

        {/* Region Selector */}
        <div
          onClick={() => navigate("/select-location")}
          style={{
            flex: 1,
            marginLeft: 12,
            padding: "6px 12px",
            borderRadius: 20,
            border: "1px solid #ccc",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: 14,
            color: selectedLocation ? "#333" : "#888",
            textAlign: "center",
          }}
        >
          {locationText}
        </div>

        {/* Slide Menu */}
        <FaBars
          size={20}
          style={{ marginLeft: 12, cursor: "pointer", color: "#333" }}
          onClick={() => setMenuOpen(true)}
        />

        {/* Search Bar */}
        <div
          onClick={() => navigate("/search")}
          style={{
            marginLeft: 12,
            flex: 2,
            padding: "6px 12px",
            borderRadius: 20,
            border: "1px solid #ccc",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: 14,
            color: "#888",
            textAlign: "center",
          }}
        >
          🔍 Search products...
        </div>
      </div>

      {/* ---------- Bottom Navigation ---------- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 0",
          borderTop: "1px solid #ddd",
          borderBottom: "1px solid #ddd",
          backgroundColor: "#f8fafd",
          position: "sticky",
          bottom: 0,
          zIndex: 1000,
        }}
      >
        {bottomLinks.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              style={{
                textAlign: "center",
                color: isActive ? lightBlue : inactiveColor,
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
                fontSize: 12,
                position: "relative",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 2 }}>
                {React.cloneElement(link.icon, { color: isActive ? lightBlue : inactiveColor })}
              </div>
              <div>{link.label}</div>

              {/* Cart Badge */}
              {link.hasBadge && cartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: "25%",
                    backgroundColor: "red",
                    color: "#fff",
                    borderRadius: "50%",
                    padding: "2px 6px",
                    fontSize: 10,
                    fontWeight: "bold",
                  }}
                >
                  {cartCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Slide Menu Component */}
      <SlideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}