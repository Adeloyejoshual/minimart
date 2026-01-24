import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SlideMenu.css";

export default function SlideMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [prevCartCount, setPrevCartCount] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [prevUnread, setPrevUnread] = useState(0);

  const [cartAnimate, setCartAnimate] = useState(false);
  const [msgAnimate, setMsgAnimate] = useState(false);

  const loadData = () => {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    if (cart.length > cartCount) setCartAnimate(true);
    setPrevCartCount(cartCount);
    setCartCount(cart.length);

    const stored = localStorage.getItem("selectedLocation");
    if (stored) setSelectedLocation(JSON.parse(stored));

    const messages = JSON.parse(localStorage.getItem("messages")) || [];
    const unread = messages.filter((msg) => !msg.read).length;
    if (unread > unreadMessages) setMsgAnimate(true);
    setPrevUnread(unreadMessages);
    setUnreadMessages(unread);
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (["cart", "messages", "selectedLocation"].includes(e.key)) {
        loadData();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (cartAnimate) {
      const timer = setTimeout(() => setCartAnimate(false), 500);
      return () => clearTimeout(timer);
    }
  }, [cartAnimate]);

  useEffect(() => {
    if (msgAnimate) {
      const timer = setTimeout(() => setMsgAnimate(false), 500);
      return () => clearTimeout(timer);
    }
  }, [msgAnimate]);

  return (
    <div className={`slide-menu ${isOpen ? "open" : ""}`} onClick={onClose}>
      <div className="slide-menu-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>

        <div className="menu-scroll">
          {/* Home */}
          <div className="menu-item" onClick={() => { navigate("/minimart"); onClose(); }}>
            🏠 Home
          </div>

          {/* Region */}
          <div className="menu-item" onClick={() => { navigate("/select-location"); onClose(); }}>
            📍 {selectedLocation ? `${selectedLocation.state}, ${selectedLocation.city}` : "Select Region"}
          </div>

          {/* Price Filters */}
          <div className="menu-item" onClick={() => { navigate("/price-filters"); onClose(); }}>
            💲 Price Filters
          </div>

          {/* Post Product */}
          <div className="menu-item" onClick={() => { navigate("/add-product"); onClose(); }}>
            📝 Post Product
          </div>

          {/* Saved Items */}
          <div className="menu-item" onClick={() => { navigate("/saved-items"); onClose(); }}>
            💾 Saved
          </div>

          {/* Cart */}
          <div className="menu-item" onClick={() => { navigate("/cart"); onClose(); }}>
            🛒 Cart
            {cartCount > 0 && <span className={`badge ${cartAnimate ? "animate-badge" : ""}`}>{cartCount}</span>}
          </div>

          {/* Messages */}
          <div className="menu-item" onClick={() => { navigate("/messages"); onClose(); }}>
            💬 Messages
            {unreadMessages > 0 && <span className={`badge ${msgAnimate ? "animate-badge" : ""}`}>{unreadMessages}</span>}
          </div>

          {/* Account */}
          <div className="menu-item" onClick={() => { navigate("/profile"); onClose(); }}>
            👤 Account
          </div>
        </div>
      </div>
    </div>
  );
}