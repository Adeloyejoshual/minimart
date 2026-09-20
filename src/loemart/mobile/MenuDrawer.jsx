/**
 * src/loemart/mobile/MenuDrawer.jsx
 * 
 * Hamburger Menu Drawer (Slides in from the left)
 */
import { memo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiHome, FiGrid, FiUser, FiHeart, 
  FiSettings, FiHelpCircle, FiChevronRight, FiX 
} from "react-icons/fi";

// Import styles
import "./styles/MenuDrawer.css";

const MenuDrawer = memo(function MenuDrawer({ open, onClose, user }) {
  const navigate = useNavigate();

  // Lock body scrolling when the menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  // Helper for generating menu items
  const navItem = (icon, label, path) => (
    <button 
      type="button"
      className="lmm-menu-item" 
      onClick={() => { 
        onClose(); 
        navigate(path); 
      }}
    >
      <span className="lmm-menu-item__icon">{icon}</span>
      <span className="lmm-menu-item__label">{label}</span>
      <FiChevronRight size={16} color="#aaa" />
    </button>
  );

  return (
    <>
      {/* Dark overlay behind the menu */}
      <div 
        className="lmm-sheet-overlay" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      
      {/* Actual sliding menu */}
      <div className="lmm-menu-drawer" role="dialog" aria-modal="true" aria-label="Main Menu">
        
        {/* Header / User Profile Area */}
        <div className="lmm-menu-header">
          {user ? (
            <div 
              className="lmm-menu-user" 
              onClick={() => { 
                onClose(); 
                navigate("/account/profile"); 
              }}
            >
              <div className="lmm-menu-avatar">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <h4>{user.name}</h4>
                <p>View Profile</p>
              </div>
            </div>
          ) : (
            <div 
              className="lmm-menu-user" 
              onClick={() => { 
                onClose(); 
                navigate("/auth"); 
              }}
            >
              <div className="lmm-menu-avatar" style={{ background: "#e4e4e7", color: "#71717a" }}>
                <FiUser />
              </div>
              <div>
                <h4>Sign In</h4>
                <p>To access your account</p>
              </div>
            </div>
          )}
          
          <button 
            type="button" 
            className="lmm-menu-close" 
            onClick={onClose} 
            aria-label="Close menu"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="lmm-menu-body">
          {navItem(<FiHome size={18} />, "Home", "/loemart")}
          {navItem(<FiGrid size={18} />, "Categories", "/catalog")}
          {navItem(<FiHeart size={18} />, "Saved Items", "/saved")}
          
          <div className="lmm-menu-divider" aria-hidden="true" />
          
          {navItem(<FiUser size={18} />, "My Account", "/account/profile")}
          {navItem(<FiSettings size={18} />, "Settings", "/account/settings")}
          {navItem(<FiHelpCircle size={18} />, "Help & Support", "/help")}
        </div>

      </div>
    </>
  );
});

export default MenuDrawer;