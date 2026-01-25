// src/components/TopNav.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaHome, FaStore, FaShoppingCart, FaUser } from "react-icons/fa";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import SlideMenu from "./SlideMenu";

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const lightBlue = "#4da6ff";
  const inactiveColor = "#555";

  // Load selected location from localStorage
  useEffect(() => {
    const storedLocation = localStorage.getItem("selectedLocation");
    if (storedLocation) setSelectedLocation(JSON.parse(storedLocation));
  }, []);

  // Real-time updates from Firebase: cart & unread messages
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const cartRef = collection(db, "carts");
    const cartQuery = query(cartRef, where("userId", "==", uid));
    const unsubscribeCart = onSnapshot(cartQuery, (snapshot) => {
      setCartCount(snapshot.docs.length);
    });

    const messagesRef = collection(db, "messages");
    const messagesQuery = query(messagesRef, where("toUser", "==", uid), where("read", "==", false));
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
    : "Region ▼";

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaHome />, badge: 0 },
    { path: "/minimart", label: "MiniMart", icon: <FaStore />, badge: 0 },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, badge: cartCount },
    { path: "/profile", label: "Account", icon: <FaUser />, badge: unreadMessages },
  ];

  return (
    <>
      {/* ---------- Top Bar ---------- */}
      <div style={{ fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
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
              <div
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  textAlign: "center",
                  color: isActive ? lightBlue : inactiveColor,
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 12,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 2 }}>
                  {React.cloneElement(link.icon, { color: isActive ? lightBlue : inactiveColor })}
                </div>
                <div>{link.label}</div>
                {link.badge > 0 && (
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
                    {link.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Slide Menu ---------- */}
      <SlideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        cartCount={cartCount}
        unreadMessages={unreadMessages}
      />
    </>
  );
}