// pages/Profile.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link }                   from "react-router-dom";
import axios                                   from "axios";
import {
  FiUser, FiPlus, FiMessageSquare,
  FiHeadphones, FiGift, FiCreditCard,
  FiFileText, FiMoreVertical, FiLogOut, FiShield,
  FiGrid, FiTrendingUp, FiChevronRight, FiArrowLeft,
  FiX,
} from "react-icons/fi";
import "../style/Profile.css";

// ══════════════════════════════════════════════════════════════
// BECOME SELLER MODAL
// ✅ Uses seller_token (market.users) — separate from
//    marketplace_token (public.users)
// ✅ Never touches marketplace_token
// ══════════════════════════════════════════════════════════════
const BecomeSellerModal = ({ onClose, navigate }) => {
  const [mode,         setMode]         = useState("choice");
  const [formData,     setFormData]     = useState({ email: "", password: "" });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  };

  // ── Login existing seller account (market.users) ───────────
  const handleLogin = async () => {
    if (!formData.email.trim() || !formData.password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const { data } = await axios.post("/api/auth/login", {
        email:    formData.email.trim(),
        password: formData.password,
      });

      if (data.token) {
        // ✅ Save as "seller_token" — market.users
        // Does NOT overwrite "marketplace_token" (public.users)
        localStorage.setItem("seller_token", data.token);

        // ✅ Also set as "token" — this is what seller routes read
        localStorage.setItem("token", data.token);
      }

      onClose();
      navigate("/become-seller");

    } catch (err) {
      setError(err.response?.data?.message ?? "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.modal} onClick={(e) => e.stopPropagation()}>

        {/* Close */}
        <button style={ms.closeBtn} onClick={onClose}>
          <FiX size={18} />
        </button>

        {/* ── CHOICE ───────────────────────────────────── */}
        {mode === "choice" && (
          <div style={ms.section}>
            <div style={ms.icon}>🏪</div>
            <h2 style={ms.title}>Become a Seller</h2>
            <p style={ms.subtitle}>
              Do you already have a seller account?
            </p>

            <div style={ms.btnGroup}>
              <button style={ms.primaryBtn} onClick={() => setMode("login")}>
                🔐 Yes, Sign In to Seller Account
              </button>
              <button
                style={ms.secondaryBtn}
                onClick={() => {
                  // ✅ Clear seller token — will show RegisterStep
                  localStorage.removeItem("seller_token");
                  localStorage.removeItem("token");
                  onClose();
                  navigate("/become-seller");
                }}
              >
                📝 No, Create Seller Account
              </button>
            </div>

            <div style={ms.infoBox}>
              <p style={ms.infoText}>
                💡 Seller accounts are separate from your marketplace account.
                They use a different email and password.
              </p>
            </div>
          </div>
        )}

        {/* ── LOGIN ────────────────────────────────────── */}
        {mode === "login" && (
          <div style={ms.section}>
            <button
              style={ms.backBtn}
              onClick={() => { setMode("choice"); setError(""); }}
            >
              ← Back
            </button>

            <div style={ms.icon}>🔐</div>
            <h2 style={ms.title}>Seller Sign In</h2>
            <p style={ms.subtitle}>
              Sign in with your seller account (market.users)
            </p>

            <input
              name="email"
              type="email"
              placeholder="Seller email address"
              value={formData.email}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              style={ms.input}
              autoFocus
            />

            <div style={{ position: "relative" }}>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                style={{ ...ms.input, paddingRight: "3rem" }}
              />
              <button
                type="button"
                style={ms.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {error && <p style={ms.error}>⚠️ {error}</p>}

            <button
              style={{ ...ms.primaryBtn, opacity: loading ? 0.6 : 1 }}
              disabled={loading}
              onClick={handleLogin}
            >
              {loading ? "Signing In..." : "Sign In & Continue →"}
            </button>

            <p style={ms.switchText}>
              Don't have a seller account?{" "}
              <button
                style={ms.switchLink}
                onClick={() => {
                  localStorage.removeItem("seller_token");
                  localStorage.removeItem("token");
                  onClose();
                  navigate("/become-seller");
                }}
              >
                Create one
              </button>
            </p>

            <div style={ms.noteBox}>
              <p style={ms.noteText}>
                🔒 This is your <strong>seller account</strong> — separate
                from your Google/marketplace login.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Modal styles ──────────────────────────────────────────────
const ms = {
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.55)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         1000,
    padding:        "1rem",
    backdropFilter: "blur(4px)",
  },
  modal: {
    background:    "white",
    borderRadius:  "20px",
    padding:       "2rem",
    width:         "100%",
    maxWidth:      "380px",
    position:      "relative",
    boxShadow:     "0 20px 60px rgba(0,0,0,0.2)",
    maxHeight:     "90vh",
    overflowY:     "auto",
  },
  closeBtn: {
    position:   "absolute",
    top:        "1rem",
    right:      "1rem",
    background: "none",
    border:     "none",
    cursor:     "pointer",
    color:      "#9ca3af",
    padding:    "0.25rem",
    display:    "flex",
    alignItems: "center",
  },
  section: { display: "flex", flexDirection: "column", gap: "1rem" },
  icon:     { fontSize: "2.5rem", textAlign: "center" },
  title:    { fontSize: "1.35rem", fontWeight: 800, color: "#1f2937", margin: 0, textAlign: "center" },
  subtitle: { color: "#6b7280", fontSize: "0.875rem", textAlign: "center", lineHeight: 1.5, margin: 0 },
  input: {
    width:        "100%",
    padding:      "0.875rem 1rem",
    border:       "2px solid #e5e7eb",
    borderRadius: "12px",
    fontSize:     "0.95rem",
    outline:      "none",
    boxSizing:    "border-box",
  },
  eyeBtn: {
    position:   "absolute",
    right:      "0.875rem",
    top:        "50%",
    transform:  "translateY(-50%)",
    background: "none",
    border:     "none",
    cursor:     "pointer",
    fontSize:   "1rem",
    lineHeight: 1,
  },
  error: {
    color:        "#ef4444",
    fontSize:     "0.82rem",
    background:   "#fef2f2",
    border:       "1px solid #fecaca",
    borderRadius: "8px",
    padding:      "0.5rem 0.75rem",
    margin:       0,
  },
  primaryBtn: {
    width:        "100%",
    padding:      "0.95rem",
    background:   "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color:        "white",
    border:       "none",
    borderRadius: "12px",
    fontWeight:   700,
    fontSize:     "0.95rem",
    cursor:       "pointer",
  },
  secondaryBtn: {
    width:        "100%",
    padding:      "0.95rem",
    background:   "white",
    color:        "#6366f1",
    border:       "2px solid #6366f1",
    borderRadius: "12px",
    fontWeight:   700,
    fontSize:     "0.95rem",
    cursor:       "pointer",
  },
  btnGroup:  { display: "flex", flexDirection: "column", gap: "0.75rem" },
  infoBox:   { background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "10px", padding: "0.75rem 1rem" },
  infoText:  { color: "#0369a1", fontSize: "0.8rem", lineHeight: 1.5, margin: 0 },
  noteBox:   { background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "0.75rem 1rem" },
  noteText:  { color: "#92400e", fontSize: "0.8rem", lineHeight: 1.5, margin: 0 },
  switchText:{ textAlign: "center", color: "#6b7280", fontSize: "0.85rem", margin: 0 },
  switchLink:{ background: "none", border: "none", color: "#6366f1", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", padding: 0, textDecoration: "underline" },
  backBtn:   { background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500, padding: 0, textAlign: "left" },
};

// ══════════════════════════════════════════════════════════════
// MENU CONFIG
// ══════════════════════════════════════════════════════════════
const MENU_ITEMS = [
  { to: "/dashboard",    icon: <FiGrid />,          label: "Dashboard"    },
  { to: "/leaderboard",  icon: <FiTrendingUp />,    label: "Leaderboard"  },
  { to: "/wallet",       icon: <FiCreditCard />,    label: "Wallet"       },
  { to: "/coupons",      icon: <FiGift />,          label: "Coupons"      },
  { to: "/minimart/add", icon: <FiPlus />,          label: "Add Product"  },
  { to: "/verification", icon: <FiShield />,        label: "Verification" },
  { to: "/invitation",   icon: <FiGift />,          label: "Invitation"   },
  { to: "/faq",          icon: <FiFileText />,      label: "FAQ"          },
  { to: "/complain",     icon: <FiMessageSquare />, label: "Complain"     },
];

// ══════════════════════════════════════════════════════════════
// PROFILE COMPONENT
// ✅ Uses marketplace_token for /api/users/me
// ✅ Never interferes with seller_token / token
// ══════════════════════════════════════════════════════════════
const Profile = () => {
  const [user,            setUser]            = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [showMenu,        setShowMenu]        = useState(false);
  const [showSellerModal, setShowSellerModal] = useState(false);

  const menuRef  = useRef(null);
  const navigate = useNavigate();

  // ── Fetch marketplace user ────────────────────────────────
  // ✅ Uses marketplace_token — NOT seller token
  useEffect(() => {
    const token = localStorage.getItem("marketplace_token");

    if (!token) {
      navigate("/auth");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(data);
      } catch {
        localStorage.removeItem("marketplace_token");
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Close menu on outside click ───────────────────────────
  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // ── Logout — clear marketplace session ───────────────────
  // ✅ Does NOT clear seller_token — seller stays logged in
  const handleLogout = () => {
    localStorage.removeItem("marketplace_token");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="profile-loading__ring" />
      </div>
    );
  }

  return (
    <div className="profile-page">

      {/* Header */}
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

        {/* Hero card */}
        <div className="profile-card">
          <div className="profile-hero">

            {/* Avatar */}
            <div className="profile-avatar">
              {user?.profile_image ? (
                <img
                  className="profile-avatar__img"
                  src={user.profile_image}
                  alt="Profile"
                />
              ) : (
                <div className="profile-avatar__fallback">
                  <FiUser />
                </div>
              )}
              <span className="profile-avatar__dot" />
            </div>

            {/* Identity */}
            <div className="profile-identity">
              <h1 className="profile-name">{user?.name || "User"}</h1>
              <p className="profile-store">
                <span className="profile-store__dot" />
                {user?.store_name || "Marketplace Member"}
              </p>
              <p className="profile-email">{user?.email}</p>
            </div>

            {/* 3-dot menu */}
            <div className="profile-menu-trigger" ref={menuRef}>
              <button
                className="profile-menu-btn"
                onClick={() => setShowMenu((v) => !v)}
              >
                <FiMoreVertical size={16} />
              </button>
              {showMenu && (
                <div className="profile-dropdown">
                  <button
                    className="profile-dropdown__item"
                    onClick={handleLogout}
                  >
                    <FiLogOut size={14} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="profile-stats">
            <div className="profile-stats__cell">
              <div className="profile-stats__value">
                {user?.products_count ?? 0}
              </div>
              <div className="profile-stats__label">Products</div>
            </div>
            <div className="profile-stats__cell">
              <div className="profile-stats__value">
                {user?.rating ?? "—"}
              </div>
              <div className="profile-stats__label">Rating</div>
            </div>
            <div className="profile-stats__cell">
              <div className="profile-stats__value">
                {user?.total_sales ?? 0}
              </div>
              <div className="profile-stats__label">Sales</div>
            </div>
          </div>
        </div>

        <p className="profile-section-label">Menu</p>

        {/* Menu list */}
        <div className="menu-list">

          {/* Regular items */}
          {MENU_ITEMS.map(({ to, icon, label }) => (
            <Link key={to} to={to} className="menu-item">
              <span className="menu-icon">{icon}</span>
              <span className="menu-label">{label}</span>
              <FiChevronRight className="menu-chevron" />
            </Link>
          ))}

          {/* ✅ Become Seller — opens modal */}
          <button
            className="menu-item"
            onClick={() => setShowSellerModal(true)}
            style={{
              width:        "100%",
              textAlign:    "left",
              background:   "linear-gradient(135deg, #f5f3ff, #eef2ff)",
              border:       "1px solid #e0e7ff",
              cursor:       "pointer",
              marginTop:    "0.5rem",
              borderRadius: "12px",
            }}
          >
            <span className="menu-icon" style={{ color: "#6366f1" }}>
              <FiUser />
            </span>
            <span
              className="menu-label"
              style={{ color: "#6366f1", fontWeight: 700 }}
            >
              Become Seller
            </span>
            <span style={{
              marginLeft:   "auto",
              background:   "#6366f1",
              color:        "white",
              fontSize:     "0.68rem",
              fontWeight:   700,
              padding:      "0.15rem 0.5rem",
              borderRadius: "100px",
              flexShrink:   0,
            }}>
              START
            </span>
            <FiChevronRight
              className="menu-chevron"
              style={{ color: "#6366f1", marginLeft: "0.5rem" }}
            />
          </button>

        </div>
      </div>

      {/* Support */}
      <Link to="/support" className="support-btn" aria-label="Contact support">
        <FiHeadphones size={18} />
      </Link>

      {/* Seller Modal */}
      {showSellerModal && (
        <BecomeSellerModal
          onClose={() => setShowSellerModal(false)}
          navigate={navigate}
        />
      )}

    </div>
  );
};

export default Profile;