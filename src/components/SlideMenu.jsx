import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SlideMenu.css";

export default function SlideMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const lightBlue = "#4da6ff";

  // Helper to load all dynamic data
  const loadData = () => {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    setCartCount(cart.length);

    const stored = localStorage.getItem("selectedLocation");
    if (stored) setSelectedLocation(JSON.parse(stored));

    const messages = JSON.parse(localStorage.getItem("messages")) || [];
    const unread = messages.filter((msg) => !msg.read).length;
    setUnreadMessages(unread);
  };

  // Initial load and whenever menu opens
  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen]);

  // Listen for changes in localStorage (cart/messages updates)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "cart" || e.key === "messages" || e.key === "selectedLocation") {
        loadData();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <div
      className={`slide-menu ${isOpen ? "open" : ""}`}
      onClick={onClose} // click outside closes menu
    >
      <div className="slide-menu-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>

        {/* Logo / Home */}
        <div
          className="menu-item"
          onClick={() => {
            navigate("/minimart");
            onClose();
          }}
        >
          🏠 MiniMart
        </div>

        {/* Region */}
        <div
          className="menu-item"
          onClick={() => {
            navigate("/select-location");
            onClose();
          }}
        >
          📍 {selectedLocation ? `${selectedLocation.state}, ${selectedLocation.city}` : "Select Region"}
        </div>

        {/* Cart */}
        <div
          className="menu-item"
          onClick={() => {
            navigate("/cart");
            onClose();
          }}
        >
          🛒 Cart
          {cartCount > 0 && <span className="badge">{cartCount}</span>}
        </div>

        {/* Messages */}
        <div
          className="menu-item"
          onClick={() => {
            navigate("/messages");
            onClose();
          }}
        >
          💬 Messages
          {unreadMessages > 0 && <span className="badge">{unreadMessages}</span>}
        </div>

        {/* Profile */}
        <div
          className="menu-item"
          onClick={() => {
            navigate("/profile");
            onClose();
          }}
        >
          👤 Account
        </div>
      </div>
    </div>
  );
}