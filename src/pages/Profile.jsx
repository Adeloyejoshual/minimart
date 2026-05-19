// src/pages/Profile.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  FiUser, FiPlus, FiMessageSquare, FiStar,
  FiHeadphones, FiGift, FiCreditCard,
  FiFileText, FiMoreVertical, FiLogOut, FiShield,
  FiGrid, FiTrendingUp, FiChevronRight, FiArrowLeft,
} from "react-icons/fi";
import "../style/Profile.css";

/* ── Menu config ─────────────────────────────────────────── */
const MENU_ITEMS = [
  { to: "/dashboard",     icon: <FiGrid />,          label: "Dashboard"     },
  { to: "/leaderboard",   icon: <FiTrendingUp />,    label: "Leaderboard"   },
  { to: "/wallet",        icon: <FiCreditCard />,    label: "Wallet"        },
  { to: "/coupons",       icon: <FiGift />,          label: "Coupons"       },
  { to: "/minimart/add",  icon: <FiPlus />,          label: "Add Product"   },
  { to: "/verification",  icon: <FiShield />,        label: "Verification"  },
  { to: "/become-seller", icon: <FiUser />,          label: "Become Seller" },
  { to: "/invitation",    icon: <FiGift />,          label: "Invitation"    },
  { to: "/faq",           icon: <FiFileText />,      label: "FAQ"           },
  { to: "/complain",      icon: <FiMessageSquare />, label: "Complain"      },
];

/* ── Component ───────────────────────────────────────────── */
const Profile = () => {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef                 = useRef(null);
  const navigate                = useNavigate();
  const token                   = localStorage.getItem("token");

  /* Fetch authenticated user */
  useEffect(() => {
    if (!token) return navigate("/auth");
    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(data);
      } catch {
        localStorage.removeItem("token");
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="profile-loading">
        <div className="profile-loading__ring" />
      </div>
    );
  }

  /* ── Page ── */
  return (
    <div className="profile-page">

      {/* ── Header ── */}
      <header className="profile-header">
        <button
          className="profile-header__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <FiArrowLeft size={16} />
          Back
        </button>
        <span className="profile-header__title">Profile</span>
        <div className="profile-header__spacer" />
      </header>

      <div className="profile-scroll">

        {/* ── Hero card ── */}
        <div className="profile-card">

          <div className="profile-hero">

            {/* Avatar */}
            <div className="profile-avatar">
              {user?.profile_image
                ? <img className="profile-avatar__img" src={user.profile_image} alt="Profile" />
                : <div className="profile-avatar__fallback"><FiUser /></div>
              }
              <span className="profile-avatar__dot" />
            </div>

            {/* Identity */}
            <div className="profile-identity">
              <h1 className="profile-name">{user?.name || "User"}</h1>
              <p className="profile-store">
                <span className="profile-store__dot" />
                {user?.store_name || "Marketplace Seller"}
              </p>
              <p className="profile-email">{user?.email}</p>
            </div>

            {/* 3-dot menu */}
            <div className="profile-menu-trigger" ref={menuRef}>
              <button
                className="profile-menu-btn"
                onClick={() => setShowMenu((v) => !v)}
                aria-label="Account options"
              >
                <FiMoreVertical size={16} />
              </button>

              {showMenu && (
                <div className="profile-dropdown">
                  <button className="profile-dropdown__item" onClick={handleLogout}>
                    <FiLogOut size={14} />
                    Log Out
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Stats bar */}
          <div className="profile-stats">
            <div className="profile-stats__cell">
              <div className="profile-stats__value">128</div>
              <div className="profile-stats__label">Products</div>
            </div>
            <div className="profile-stats__cell">
              <div className="profile-stats__value">4.9</div>
              <div className="profile-stats__label">Rating</div>
            </div>
            <div className="profile-stats__cell">
              <div className="profile-stats__value">2.4k</div>
              <div className="profile-stats__label">Sales</div>
            </div>
          </div>
        </div>

        {/* ── Section label ── */}
        <p className="profile-section-label">Menu</p>

        {/* ── Menu list ── */}
        <div className="menu-list">
          {MENU_ITEMS.map(({ to, icon, label }) => (
            <Link key={to} to={to} className="menu-item">
              <span className="menu-icon">{icon}</span>
              <span className="menu-label">{label}</span>
              <FiChevronRight className="menu-chevron" />
            </Link>
          ))}
        </div>

      </div>

      {/* ── Floating support button ── */}
      <Link to="/support" className="support-btn" aria-label="Contact support">
        <FiHeadphones size={18} />
      </Link>

    </div>
  );
};

export default Profile;
