// src/components/TopNav.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaShoppingCart, FaUser, FaSearch } from "react-icons/fa";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import SlideMenu from "./SlideMenu";

export default function TopNav({ onSearch }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const lightBlue = "#4da6ff";
  const inactiveColor = "#555";

  // Load saved location
  useEffect(() => {
    const storedLocation = localStorage.getItem("selectedLocation");
    if (storedLocation) setSelectedLocation(JSON.parse(storedLocation));
  }, []);

  // Real-time cart & messages
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const cartRef = collection(db, "carts");
    const cartQuery = query(cartRef, where("userId", "==", uid));
    const unsubscribeCart = onSnapshot(cartQuery, (snapshot) => {
      setCartCount(snapshot.docs.length);
    });

    const messagesRef = collection(db, "messages");
    const messagesQuery = query(
      messagesRef,
      where("toUser", "==", uid),
      where("read", "==", false)
    );
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      setUnreadMessages(snapshot.docs.length);
    });

    return () => {
      unsubscribeCart();
      unsubscribeMessages();
    };
  }, []);

  const locationText = selectedLocation
    ? `${selectedLocation.state}, ${selectedLocation.city}`
    : "Select Region ▼";

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    if (onSearch) onSearch(e.target.value); // optional callback for HomePage
  };

  return (
    <div style={{ fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      {/* ---------- Top Bar ---------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          backgroundColor: "#f8fafd",
          borderBottom: "1px solid #ddd",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        {/* Logo */}
        <Link
          to="/minimart"
          style={{ fontWeight: "bold", fontSize: 18, textDecoration: "none", color: lightBlue }}
        >
          MiniMart
        </Link>

        {/* Location Selector */}
        <div
          onClick={() => navigate("/select-location")}
          style={{
            padding: "6px 12px",
            borderRadius: 20,
            border: "1px solid #ccc",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: 14,
            color: selectedLocation ? "#333" : "#888",
          }}
        >
          {locationText}
        </div>

        {/* Professional Search Bar */}
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search for products, brands..."
            style={{
              width: "100%",
              padding: "8px 36px 8px 12px",
              borderRadius: 20,
              border: "1px solid #ccc",
              fontSize: 14,
              outline: "none",
              boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
            }}
          />
          <FaSearch
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#888",
            }}
          />
        </div>

        {/* Right Icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            onClick={() => setMenuOpen(true)}
            style={{ fontSize: 20, cursor: "pointer", color: "#333" }}
          >
            <FaBars />
          </div>
          <div
            onClick={() => navigate("/cart")}
            style={{ position: "relative", cursor: "pointer", fontSize: 20 }}
          >
            <FaShoppingCart />
            {cartCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -10,
                  background: "red",
                  color: "#fff",
                  fontSize: 10,
                  padding: "2px 5px",
                  borderRadius: "50%",
                  fontWeight: "bold",
                }}
              >
                {cartCount}
              </span>
            )}
          </div>
          <div
            onClick={() => navigate("/profile")}
            style={{ position: "relative", cursor: "pointer", fontSize: 20 }}
          >
            <FaUser />
            {unreadMessages > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -10,
                  background: "red",
                  color: "#fff",
                  fontSize: 10,
                  padding: "2px 5px",
                  borderRadius: "50%",
                  fontWeight: "bold",
                }}
              >
                {unreadMessages}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Children / Page Content ---------- */}
      <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>

      {/* ---------- Slide Menu ---------- */}
      <SlideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        cartCount={cartCount}
        unreadMessages={unreadMessages}
      />
    </div>
  );
}