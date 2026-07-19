/* ═══════════════════════════════════════════════════════════════
   DESKTOP HEADER — Transparent professional site-wide header
   Logo · Search · Notifications · Messages · Wishlist · Account · Sell
═══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import "./DesktopHeader.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Icons = {
  search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  message: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  heart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  user: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  chevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  crown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M3 20h18" />
    </svg>
  ),
  shield: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  help: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  logout: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   DROPDOWN ANIMATION
═══════════════════════════════════════════════════════════════ */
const dropdownVariants = {
  hidden: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: { duration: 0.15 },
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 360, damping: 28 },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.96,
    transition: { duration: 0.12 },
  },
};

/* ═══════════════════════════════════════════════════════════════
   LOGO
═══════════════════════════════════════════════════════════════ */
const Logo = memo(function Logo() {
  return (
    <Link to="/" className="dh-logo" aria-label="Loemart Home">
      <span className="dh-logo__mark">L</span>
      <span className="dh-logo__text">Loemart</span>
    </Link>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SEARCH BAR
═══════════════════════════════════════════════════════════════ */
const SearchBar = memo(function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length >= 2) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setQuery("");
    }
  };

  return (
    <form
      className={`dh-search${focused ? " dh-search--focused" : ""}`}
      onSubmit={handleSubmit}
      role="search"
    >
      <span className="dh-search__icon">
        <Icons.search />
      </span>
      <input
        type="text"
        className="dh-search__input"
        placeholder="Search products, brands, categories..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="Search"
      />
      {query.length > 0 && (
        <button
          type="button"
          className="dh-search__clear"
          onClick={() => setQuery("")}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </form>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ICON BUTTON WITH BADGE
═══════════════════════════════════════════════════════════════ */
const IconBtn = memo(function IconBtn({ icon, label, count, onClick, to, active }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) onClick();
    else if (to) navigate(to);
  };

  return (
    <motion.button
      className={`dh-icon-btn${active ? " dh-icon-btn--active" : ""}`}
      onClick={handleClick}
      aria-label={label}
      title={label}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
    >
      <span className="dh-icon-btn__svg">{icon}</span>
      {count > 0 && (
        <motion.span
          className="dh-icon-btn__badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      )}
    </motion.button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   USER DROPDOWN — wallet and orders removed
═══════════════════════════════════════════════════════════════ */
const UserDropdown = memo(function UserDropdown({ user, onClose, onLogout }) {
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const go = (path) => {
    navigate(path);
    onClose();
  };

  /* ✅ Wallet and My Orders removed */
  const menuItems = [
    { icon: <Icons.user />,      label: "My Profile",       path: "/profile"             },
    { icon: <Icons.edit />,      label: "Edit Profile",     path: "/profile/edit"        },
    { icon: <Icons.dashboard />, label: "Seller Dashboard", path: "/dashboard"           },
    { icon: <Icons.crown />,     label: "Subscription",     path: "/seller/subscription" },
    { divider: true },
    { icon: <Icons.shield />,    label: "Verification",     path: "/verification"        },
    { icon: <Icons.settings />,  label: "Settings",         path: "/settings"            },
    { icon: <Icons.help />,      label: "Help & Support",   path: "/support"             },
  ];

  return (
    <motion.div
      className="dh-dropdown"
      ref={ref}
      variants={dropdownVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* User identity header */}
      <div className="dh-dropdown__header" onClick={() => go("/profile")}>
        <div className="dh-dropdown__avatar">
          {user.profile_image ? (
            <img src={user.profile_image} alt={user.name} />
          ) : (
            <span>{(user.name || "U").charAt(0).toUpperCase()}</span>
          )}
          <span className="dh-dropdown__online" />
        </div>
        <div className="dh-dropdown__info">
          <p className="dh-dropdown__name">{user.name}</p>
          <p className="dh-dropdown__email">
            {user.email || user.store_name || "View Profile"}
          </p>
        </div>
      </div>

      {/* Menu items */}
      <div className="dh-dropdown__body">
        {menuItems.map((item, i) =>
          item.divider ? (
            <div key={`div-${i}`} className="dh-dropdown__divider" />
          ) : (
            <button
              key={item.path}
              className="dh-dropdown__item"
              onClick={() => go(item.path)}
            >
              <span className="dh-dropdown__item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        )}
      </div>

      {/* Logout */}
      <div className="dh-dropdown__footer">
        <button
          className="dh-dropdown__logout"
          onClick={() => { onLogout(); onClose(); }}
        >
          <Icons.logout />
          <span>Sign Out</span>
        </button>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN HEADER COMPONENT
═══════════════════════════════════════════════════════════════ */
function DesktopHeader({ user, onLogout }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [unreadNotifs,  setUnreadNotifs]  = useState(0);
  const [unreadMsgs,    setUnreadMsgs]    = useState(0);
  const [savedCount,    setSavedCount]    = useState(0);

  /* Scroll detection */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  /* Fetch counts */
  useEffect(() => {
    const token = getToken();
    if (!token || !user) return;

    const headers = { Authorization: `Bearer ${token}` };

    axios.get(`${API}/notifications/unread-count`, { headers })
      .then((r) => setUnreadNotifs(Number(r.data?.count ?? r.data?.unread ?? 0)))
      .catch(() => {});

    axios.get(`${API}/conversations/unread-count`, { headers })
      .then((r) => setUnreadMsgs(Number(r.data?.count ?? r.data?.unread ?? 0)))
      .catch(() => {});

    axios.get(`${API}/saved/count`, { headers })
      .then((r) => setSavedCount(Number(r.data?.count ?? 0)))
      .catch(() => {});
  }, [user]);

  /* Close dropdown on route change */
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  const toggleDropdown = useCallback(() => {
    setDropdownOpen((prev) => !prev);
  }, []);

  const handleLogout = useCallback(() => {
    ["marketplace_token", "token", "seller_token"].forEach((k) =>
      localStorage.removeItem(k)
    );
    onLogout?.();
    navigate("/auth");
  }, [navigate, onLogout]);

  return (
    <header className={`dh${scrolled ? " dh--scrolled" : ""}`}>
      <div className="dh__inner">

        {/* ── Logo ── */}
        <Logo />

        {/* ── Search ── */}
        <SearchBar />

        {/* ── Actions ── */}
        <div className="dh__actions">
          {user ? (
            <>
              {/* Notifications */}
              <IconBtn
                icon={<Icons.bell />}
                label="Notifications"
                count={unreadNotifs}
                to="/notifications"
                active={location.pathname === "/notifications"}
              />

              {/* Messages */}
              <IconBtn
                icon={<Icons.message />}
                label="Messages"
                count={unreadMsgs}
                to="/conversations"
                active={
                  location.pathname.startsWith("/conversations") ||
                  location.pathname.startsWith("/messages")
                }
              />

              {/* Wishlist */}
              <IconBtn
                icon={<Icons.heart />}
                label="Saved Items"
                count={savedCount}
                to="/saved"
                active={location.pathname === "/saved"}
              />

              {/* Separator */}
              <div className="dh__separator" aria-hidden="true" />

              {/* Account */}
              <div className="dh__account-wrap">
                <motion.button
                  className={`dh-account${dropdownOpen ? " dh-account--open" : ""}`}
                  onClick={toggleDropdown}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                  aria-label="Account menu"
                  whileTap={{ scale: 0.96 }}
                >
                  <div className="dh-account__avatar">
                    {user.profile_image ? (
                      <img src={user.profile_image} alt={user.name} />
                    ) : (
                      <span>{(user.name || "U").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span className="dh-account__name">
                    {user.name?.split(" ")[0] || "Account"}
                  </span>
                  <span className="dh-account__caret">
                    <Icons.chevronDown />
                  </span>
                </motion.button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <UserDropdown
                      user={user}
                      onClose={() => setDropdownOpen(false)}
                      onLogout={handleLogout}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Sell */}
              <motion.button
                className="dh-sell"
                onClick={() => navigate("/minimart/add")}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Post a listing"
              >
                <Icons.plus />
                <span>Sell</span>
              </motion.button>
            </>
          ) : (
            <>
              {/* Guest: Sign In */}
              <motion.button
                className="dh-signin"
                onClick={() => navigate("/auth")}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icons.user />
                <span>Sign In</span>
              </motion.button>

              {/* Guest: Sell */}
              <motion.button
                className="dh-sell"
                onClick={() => navigate("/auth?redirect=/minimart/add")}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icons.plus />
                <span>Sell</span>
              </motion.button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default memo(DesktopHeader);