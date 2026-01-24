import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SlideMenu.css";

export default function SlideMenu({ isOpen, onClose }) {
  const navigate = useNavigate();

  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [cartAnimate, setCartAnimate] = useState(false);
  const [msgAnimate, setMsgAnimate] = useState(false);

  // Load localStorage data
  const loadData = () => {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const messages = JSON.parse(localStorage.getItem("messages")) || [];
    const unread = messages.filter((msg) => !msg.read).length;
    const storedLocation = localStorage.getItem("selectedLocation");

    // Trigger pulse if count increases
    if (cart.length > cartCount) setCartAnimate(true);
    if (unread > unreadMessages) setMsgAnimate(true);

    setCartCount(cart.length);
    setUnreadMessages(unread);
    if (storedLocation) setSelectedLocation(JSON.parse(storedLocation));
  };

  useEffect(() => {
    if (isOpen) loadData();

    // Live updates every 500ms
    const interval = setInterval(loadData, 500);
    return () => clearInterval(interval);
  }, [isOpen, cartCount, unreadMessages]);

  // Remove pulse animation after complete
  useEffect(() => {
    if (cartAnimate) {
      const timer = setTimeout(() => setCartAnimate(false), 700);
      return () => clearTimeout(timer);
    }
  }, [cartAnimate]);

  useEffect(() => {
    if (msgAnimate) {
      const timer = setTimeout(() => setMsgAnimate(false), 700);
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
            <span className="menu-icon">🏠</span> Home
          </div>

          {/* Region */}
          <div className="menu-item" onClick={() => { navigate("/select-location"); onClose(); }}>
            <span className="menu-icon">📍</span> {selectedLocation ? `${selectedLocation.state}, ${selectedLocation.city}` : "Select Region"}
          </div>

          {/* Price Filters */}
          <div className="menu-item" onClick={() => { navigate("/price-filters"); onClose(); }}>
            <span className="menu-icon">💲</span> Price Filters
          </div>

          {/* Post Product */}
          <div className="menu-item" onClick={() => { navigate("/add-product"); onClose(); }}>
            <span className="menu-icon">📝</span> Post Product
          </div>

          {/* Saved Items */}
          <div className="menu-item" onClick={() => { navigate("/saved-items"); onClose(); }}>
            <span className="menu-icon">💾</span> Saved
          </div>

          {/* Cart */}
          <div className={`menu-item ${cartAnimate ? "pulse" : ""} ${cartCount > 0 ? "continuous-pulse" : ""}`} 
               onClick={() => { navigate("/cart"); onClose(); }}>
            <span className="menu-icon">🛒</span> Cart
            {cartCount > 0 && <span className={`badge ${cartAnimate ? "pulse" : ""}`}>{cartCount}</span>}
          </div>

          {/* Messages */}
          <div className={`menu-item ${msgAnimate ? "pulse" : ""} ${unreadMessages > 0 ? "continuous-pulse" : ""}`} 
               onClick={() => { navigate("/messages"); onClose(); }}>
            <span className="menu-icon">💬</span> Messages
            {unreadMessages > 0 && <span className={`badge ${msgAnimate ? "pulse" : ""}`}>{unreadMessages}</span>}
          </div>

          {/* Account */}
          <div className="menu-item" onClick={() => { navigate("/profile"); onClose(); }}>
            <span className="menu-icon">👤</span> Account
          </div>
        </div>
      </div>
    </div>
  );
}