import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import "./SlideMenu.css";

export default function SlideMenu({ isOpen, onClose }) {
  const navigate = useNavigate();

  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [cartAnimate, setCartAnimate] = useState(false);
  const [msgAnimate, setMsgAnimate] = useState(false);

  // Load location from localStorage
  useEffect(() => {
    const storedLocation = localStorage.getItem("selectedLocation");
    if (storedLocation) setSelectedLocation(JSON.parse(storedLocation));
  }, []);

  // Firebase real-time updates for cart & messages
  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // Cart
    const cartRef = collection(db, "carts");
    const cartQuery = query(cartRef, where("userId", "==", uid));
    const unsubscribeCart = onSnapshot(cartQuery, (snapshot) => {
      const newCount = snapshot.docs.length;
      if (newCount > cartCount) setCartAnimate(true); // pulse when increased
      setCartCount(newCount);
    });

    // Messages
    const messagesRef = collection(db, "messages");
    const messagesQuery = query(messagesRef, where("toUser", "==", uid), where("read", "==", false));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const newUnread = snapshot.docs.length;
      if (newUnread > unreadMessages) setMsgAnimate(true); // pulse when new
      setUnreadMessages(newUnread);
    });

    return () => {
      unsubscribeCart();
      unsubscribeMessages();
    };
  }, [cartCount, unreadMessages]);

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

  const menuItems = [
    { label: "Home", path: "/minimart", icon: "🏠", badge: 0 },
    { label: "Region", path: "/select-location", icon: "📍", badge: 0, text: selectedLocation ? `${selectedLocation.state}, ${selectedLocation.city}` : "Select Region" },
    { label: "Price Filters", path: "/price-filters", icon: "💲", badge: 0 },
    { label: "Post Product", path: "/add-product", icon: "📝", badge: 0 },
    { label: "Saved", path: "/saved-items", icon: "💾", badge: 0 },
    { label: "Cart", path: "/cart", icon: "🛒", badge: cartCount, animate: cartAnimate },
    { label: "Messages", path: "/messages", icon: "💬", badge: unreadMessages, animate: msgAnimate },
    { label: "Account", path: "/profile", icon: "👤", badge: 0 },
  ];

  return (
    <div className={`slide-menu ${isOpen ? "open" : ""}`} onClick={onClose}>
      <div className="slide-menu-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>

        <div className="menu-scroll">
          {menuItems.map((item) => (
            <div
              key={item.label}
              className={`menu-item ${item.animate ? "pulse" : ""} ${item.badge > 0 ? "continuous-pulse" : ""}`}
              onClick={() => { navigate(item.path); onClose(); }}
            >
              <span className="menu-icon">{item.icon}</span>
              {item.text || item.label}
              {item.badge > 0 && <span className={`badge ${item.animate ? "pulse" : ""}`}>{item.badge}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}