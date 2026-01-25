import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaMapMarkerAlt, FaSearch, FaShoppingCart, FaUser } from "react-icons/fa";
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

  const primary = "#0d6efd";

  // Load saved location
  useEffect(() => {
    const stored = localStorage.getItem("selectedLocation");
    if (stored) setSelectedLocation(JSON.parse(stored));
  }, []);

  // Live cart + messages
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const unsubCart = onSnapshot(
      query(collection(db, "carts"), where("userId", "==", uid)),
      snap => setCartCount(snap.docs.length)
    );

    const unsubMsg = onSnapshot(
      query(collection(db, "messages"), where("toUser", "==", uid), where("read", "==", false)),
      snap => setUnreadMessages(snap.docs.length)
    );

    return () => {
      unsubCart();
      unsubMsg();
    };
  }, []);

  const locationText = selectedLocation
    ? `${selectedLocation.city}, ${selectedLocation.state}`
    : "Select location";

  return (
    <>
      {/* 🔵 TOP HEADER */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2000,
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
      >
        {/* Row 1 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{ fontWeight: "bold", fontSize: 20, color: primary, cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            MiniMart
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/cart")}>
              <FaShoppingCart size={18} />
              {cartCount > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -8,
                  background: "red",
                  color: "#fff",
                  fontSize: 10,
                  padding: "2px 5px",
                  borderRadius: "50%"
                }}>{cartCount}</span>
              )}
            </div>

            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => navigate("/profile")}>
              <FaUser size={18} />
              {unreadMessages > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -8,
                  background: "red",
                  color: "#fff",
                  fontSize: 10,
                  padding: "2px 5px",
                  borderRadius: "50%"
                }}>{unreadMessages}</span>
              )}
            </div>

            <FaBars size={20} style={{ cursor: "pointer" }} onClick={() => setMenuOpen(true)} />
          </div>
        </div>

        {/* Row 2 — Location + Search */}
        <div style={{ display: "flex", gap: 8 }}>
          <div
            onClick={() => navigate("/select-location")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "#f1f5f9",
              padding: "8px 10px",
              borderRadius: 10,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            <FaMapMarkerAlt color={primary} />
            {locationText}
          </div>

          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            background: "#f1f5f9",
            borderRadius: 10,
            padding: "8px 10px"
          }}>
            <FaSearch color="#6b7280" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                marginLeft: 8,
                flex: 1,
                fontSize: 14
              }}
            />
          </div>
        </div>
      </div>

      {/* Slide Menu */}
      <SlideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        cartCount={cartCount}
        unreadMessages={unreadMessages}
      />
    </>
  );
}