// src/components/TopNav.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaHome, FaStore, FaShoppingCart, FaUser } from "react-icons/fa";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import SlideMenu from "./SlideMenu";

export default function TopNav({ searchQuery, setSearchQuery }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const lightBlue = "#4da6ff";
  const inactiveColor = "#555";

  // Load location
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
    const unsubscribeCart = onSnapshot(cartQuery, snapshot => setCartCount(snapshot.docs.length));

    const messagesRef = collection(db, "messages");
    const messagesQuery = query(messagesRef, where("toUser", "==", uid), where("read", "==", false));
    const unsubscribeMessages = onSnapshot(messagesQuery, snapshot => setUnreadMessages(snapshot.docs.length));

    return () => {
      unsubscribeCart();
      unsubscribeMessages();
    };
  }, []);

  const locationText = selectedLocation
    ? `${selectedLocation.state}, ${selectedLocation.city}`
    : "Region ▼";

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaHome />, badge: 0 },
    { path: "/minimart", label: "MiniMart", icon: <FaStore />, badge: 0 },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, badge: cartCount },
    { path: "/profile", label: "Account", icon: <FaUser />, badge: unreadMessages },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      {/* Top Bar */}
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
          zIndex: 1000
        }}
      >
        <Link to="/minimart" style={{ fontWeight: "bold", fontSize: 18, textDecoration: "none", color: lightBlue }}>
          MiniMart
        </Link>

        {/* Location */}
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

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Search products..."
          style={{
            marginLeft: 12,
            flex: 2,
            padding: "6px 12px",
            borderRadius: 20,
            border: "1px solid #ccc",
            backgroundColor: "#fff",
            fontSize: 14,
            outline: "none",
          }}
        />

        {/* Menu */}
        <FaBars size={20} style={{ marginLeft: 12, cursor: "pointer", color: "#333" }} onClick={() => setMenuOpen(true)} />
      </div>

      {/* Slide Menu */}
      <SlideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        cartCount={cartCount}
        unreadMessages={unreadMessages}
      />
    </div>
  );
}