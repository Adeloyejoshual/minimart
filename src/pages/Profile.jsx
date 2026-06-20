/**
 * src/pages/Profile.jsx
 * Route: /profile
 *
 * Marketplace user profile with:
 * - Live product count from API
 * - Recent products preview
 * - Stats (products, rating, sales, views)
 * - Become Seller modal
 * - Full menu
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link }                        from "react-router-dom";
import axios                                        from "axios";
import {
  FiUser, FiPlus, FiMessageSquare,
  FiHeadphones, FiGift, FiCreditCard,
  FiFileText, FiMoreVertical, FiLogOut, FiShield,
  FiGrid, FiTrendingUp, FiChevronRight, FiArrowLeft,
  FiX, FiPackage, FiEye, FiHeart, FiShoppingBag,
} from "react-icons/fi";
import "../style/Profile.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "m";
  if (v >= 1_000)     return (v / 1_000).toFixed(1)     + "k";
  return v.toLocaleString();
};

const PH = "https://placehold.co/80x80/f0ede8/b0a89e?text=?";

const getProductImg = (p) => {
  if (!p) return PH;
  if (p.image)         return p.image;
  if (p.main_image)    return p.main_image;
  if (p.thumbnail_url) return p.thumbnail_url;
  if (Array.isArray(p.images) && p.images[0]) {
    const f = p.images[0];
    return typeof f === "string" ? f : f?.url || PH;
  }
  return PH;
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

/* ═══════════════════════════════════════════════════════════════
   MENU ITEMS
═══════════════════════════════════════════════════════════════ */
const MENU_ITEMS = [
  { to: "/dashboard",    icon: <FiGrid />,          label: "Dashboard",    badge: null  },
  { to: "/leaderboard",  icon: <FiTrendingUp />,    label: "Leaderboard",  badge: null  },
  { to: "/wallet",       icon: <FiCreditCard />,    label: "Wallet",       badge: null  },
  { to: "/coupons",      icon: <FiGift />,          label: "Coupons",      badge: null  },
  { to: "/minimart/add", icon: <FiPlus />,          label: "Add Product",  badge: "NEW" },
  { to: "/verification", icon: <FiShield />,        label: "Verification", badge: null  },
  { to: "/invitation",   icon: <FiGift />,          label: "Invitation",   badge: null  },
  { to: "/faq",          icon: <FiFileText />,      label: "FAQ",          badge: null  },
  { to: "/complain",     icon: <FiMessageSquare />, label: "Complain",     badge: null  },
];

/* ═══════════════════════════════════════════════════════════════
   BECOME SELLER MODAL
═══════════════════════════════════════════════════════════════ */
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

  const handleLogin = async () => {
    if (!formData.email.trim() || !formData.password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/auth/login`, {
        email    : formData.email.trim(),
        password : formData.password,
      });
      if (data.token) {
        localStorage.setItem("seller_token", data.token);
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

  const goCreate = () => {
    localStorage.removeItem("seller_token");
    localStorage.removeItem("token");
    onClose();
    navigate("/become-seller");
  };

  return (
    <div style={MS.overlay} onClick={onClose}>
      <div style={MS.modal} onClick={(e) => e.stopPropagation()}>
        <button style={MS.closeBtn} onClick={onClose} aria-label="Close">
          <FiX size={18} />
        </button>

        {/* ── Choice ── */}
        {mode === "choice" && (
          <div style={MS.section}>
            <div style={MS.icon}>🏪</div>
            <h2 style={MS.title}>Become a Seller</h2>
            <p style={MS.subtitle}>Do you already have a seller account?</p>
            <div style={MS.btnGroup}>
              <button style={MS.primaryBtn} onClick={() => setMode("login")}>
                🔐 Yes, Sign In to Seller Account
              </button>
              <button style={MS.secondaryBtn} onClick={goCreate}>
                📝 No, Create Seller Account
              </button>
            </div>
            <div style={MS.infoBox}>
              <p style={MS.infoText}>
                💡 Seller accounts are separate from your marketplace account.
              </p>
            </div>
          </div>
        )}

        {/* ── Login ── */}
        {mode === "login" && (
          <div style={MS.section}>
            <button style={MS.backBtn} onClick={() => { setMode("choice"); setError(""); }}>
              ← Back
            </button>
            <div style={MS.icon}>🔐</div>
            <h2 style={MS.title}>Seller Sign In</h2>
            <p style={MS.subtitle}>Sign in with your seller account</p>

            <input
              name="email"
              type="email"
              placeholder="Seller email address"
              value={formData.email}
              onChange={handleChange}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={MS.input}
              autoFocus
            />

            <div style={{ position: "relative" }}>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={{ ...MS.input, paddingRight: "3rem" }}
              />
              <button
                type="button"
                style={MS.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {error && <p style={MS.error}>⚠️ {error}</p>}

            <button
              style={{ ...MS.primaryBtn, opacity: loading ? 0.6 : 1 }}
              disabled={loading}
              onClick={handleLogin}
            >
              {loading ? "Signing In..." : "Sign In & Continue →"}
            </button>

            <p style={MS.switchText}>
              No seller account?{" "}
              <button style={MS.switchLink} onClick={goCreate}>
                Create one
              </button>
            </p>

            <div style={MS.noteBox}>
              <p style={MS.noteText}>
                🔒 This is your <strong>seller account</strong> — separate from
                your marketplace login.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MS = {
  overlay     : { position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"1rem", backdropFilter:"blur(4px)" },
  modal       : { background:"white", borderRadius:"20px", padding:"2rem", width:"100%", maxWidth:"380px", position:"relative", boxShadow:"0 20px 60px rgba(0,0,0,.2)", maxHeight:"90vh", overflowY:"auto" },
  closeBtn    : { position:"absolute", top:"1rem", right:"1rem", background:"none", border:"none", cursor:"pointer", color:"#9ca3af", padding:"0.25rem", display:"flex", alignItems:"center" },
  section     : { display:"flex", flexDirection:"column", gap:"1rem" },
  icon        : { fontSize:"2.5rem", textAlign:"center" },
  title       : { fontSize:"1.35rem", fontWeight:800, color:"#1f2937", margin:0, textAlign:"center" },
  subtitle    : { color:"#6b7280", fontSize:"0.875rem", textAlign:"center", lineHeight:1.5, margin:0 },
  input       : { width:"100%", padding:"0.875rem 1rem", border:"2px solid #e5e7eb", borderRadius:"12px", fontSize:"0.95rem", outline:"none", boxSizing:"border-box" },
  eyeBtn      : { position:"absolute", right:"0.875rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:"1rem", lineHeight:1 },
  error       : { color:"#ef4444", fontSize:"0.82rem", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"8px", padding:"0.5rem 0.75rem", margin:0 },
  primaryBtn  : { width:"100%", padding:"0.95rem", background:"linear-gradient(135deg, #6366f1, #8b5cf6)", color:"white", border:"none", borderRadius:"12px", fontWeight:700, fontSize:"0.95rem", cursor:"pointer" },
  secondaryBtn: { width:"100%", padding:"0.95rem", background:"white", color:"#6366f1", border:"2px solid #6366f1", borderRadius:"12px", fontWeight:700, fontSize:"0.95rem", cursor:"pointer" },
  btnGroup    : { display:"flex", flexDirection:"column", gap:"0.75rem" },
  infoBox     : { background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:"10px", padding:"0.75rem 1rem" },
  infoText    : { color:"#0369a1", fontSize:"0.8rem", lineHeight:1.5, margin:0 },
  noteBox     : { background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"10px", padding:"0.75rem 1rem" },
  noteText    : { color:"#92400e", fontSize:"0.8rem", lineHeight:1.5, margin:0 },
  switchText  : { textAlign:"center", color:"#6b7280", fontSize:"0.85rem", margin:0 },
  switchLink  : { background:"none", border:"none", color:"#6366f1", fontWeight:700, cursor:"pointer", fontSize:"0.85rem", padding:0, textDecoration:"underline" },
  backBtn     : { background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:"0.85rem", fontWeight:500, padding:0, textAlign:"left" },
};

/* ═══════════════════════════════════════════════════════════════
   PRODUCT CARD (mini)
═══════════════════════════════════════════════════════════════ */
function MiniProductCard({ product, onClick }) {
  const img = getProductImg(product);
  return (
    <div className="prof-mini-card" onClick={() => onClick(product)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}>
      <div className="prof-mini-img">
        <img src={img} alt={product.title} loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }} />
        <span className={`prof-mini-status prof-mini-status--${product.status}`}>
          {product.status}
        </span>
      </div>
      <p className="prof-mini-title">{product.title}</p>
      <p className="prof-mini-price">{naira(product.price)}</p>
      <div className="prof-mini-stats">
        <span><FiEye size={10} /> {fmtNum(product.views)}</span>
        <span>{timeAgo(product.created_at)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROFILE PAGE
═══════════════════════════════════════════════════════════════ */
export default function Profile({ onLogout }) {
  const navigate = useNavigate();

  const [user,            setUser]            = useState(null);
  const [products,        setProducts]        = useState([]);
  const [productStats,    setProductStats]    = useState({
    total    : 0,
    active   : 0,
    draft    : 0,
    views    : 0,
    favorites: 0,
  });
  const [loading,         setLoading]         = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [showMenu,        setShowMenu]        = useState(false);
  const [showSellerModal, setShowSellerModal] = useState(false);

  const menuRef = useRef(null);

  /* ── Fetch user ──────────────────────────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem("marketplace_token");
    if (!token) { navigate("/auth"); return; }

    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API}/users/me`, {
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
  }, [navigate]);

  /* ── Fetch user's products ───────────────────────────────── */
  const fetchProducts = useCallback(async () => {
    const token = localStorage.getItem("marketplace_token");
    if (!token || !user?.id) return;

    try {
      setProductsLoading(true);

      // Try seller dashboard products first
      const res = await fetch(
        `${API}/seller/${user.id}/products?limit=20&page=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        const prods = Array.isArray(data.products) ? data.products :
                      Array.isArray(data)           ? data : [];

        setProducts(prods.slice(0, 6)); // show max 6 in preview

        // Calculate stats
        const total     = data.total ?? prods.length;
        const active    = prods.filter((p) => p.status === "active" && p.is_active).length;
        const draft     = prods.filter((p) => p.status === "draft").length;
        const views     = prods.reduce((s, p) => s + Number(p.views || 0), 0);
        const favorites = prods.reduce((s, p) => s + Number(p.favorites_count || 0), 0);

        setProductStats({ total, active, draft, views, favorites });
      }
    } catch (err) {
      console.error("[Profile] fetchProducts:", err);
    } finally {
      setProductsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchProducts();
  }, [user?.id, fetchProducts]);

  /* ── Close menu on outside click ────────────────────────── */
  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ── Logout ──────────────────────────────────────────────── */
  const handleLogout = useCallback(() => {
    localStorage.removeItem("marketplace_token");
    onLogout?.();
    navigate("/auth");
  }, [navigate, onLogout]);

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="profile-loading">
        <div className="profile-loading__ring" />
      </div>
    );
  }

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="profile-page">

      {/* ── Header ── */}
      <header className="profile-header">
        <button
          className="profile-header__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <FiArrowLeft size={16} /> Back
        </button>
        <span className="profile-header__title">Profile</span>
        <div className="profile-header__spacer" />
      </header>

      <div className="profile-scroll">

        {/* ══════════════════════════════════════════════
            HERO CARD
        ══════════════════════════════════════════════ */}
        <div className="profile-card">
          <div className="profile-hero">

            {/* Avatar */}
            <div className="profile-avatar">
              {user?.profile_image ? (
                <img className="profile-avatar__img" src={user.profile_image} alt="Profile" />
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
              {user?.verified && (
                <span className="profile-verified">✔ Verified</span>
              )}
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
                    <FiLogOut size={14} /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="profile-stats">
            <div className="profile-stats__cell">
              <div className="profile-stats__value prof-stat--orange">
                {productsLoading ? "—" : fmtNum(productStats.total)}
              </div>
              <div className="profile-stats__label">Products</div>
            </div>
            <div className="profile-stats__cell">
              <div className="profile-stats__value">
                {user?.rating ? Number(user.rating).toFixed(1) : "—"}
              </div>
              <div className="profile-stats__label">Rating</div>
            </div>
            <div className="profile-stats__cell">
              <div className="profile-stats__value">
                {productsLoading ? "—" : fmtNum(productStats.views)}
              </div>
              <div className="profile-stats__label">Views</div>
            </div>
            <div className="profile-stats__cell">
              <div className="profile-stats__value">
                {user?.total_sales ? fmtNum(user.total_sales) : "0"}
              </div>
              <div className="profile-stats__label">Sales</div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            PRODUCT OVERVIEW CARD
        ══════════════════════════════════════════════ */}
        <div className="prof-product-card">
          <div className="prof-product-head">
            <div>
              <h2 className="prof-product-title">My Listings</h2>
              <p className="prof-product-sub">
                {productsLoading
                  ? "Loading…"
                  : `${productStats.total} total · ${productStats.active} active`}
              </p>
            </div>
            <Link to="/minimart/add" className="prof-add-btn">
              <FiPlus size={14} /> Add
            </Link>
          </div>

          {/* ── Mini stats row ── */}
          <div className="prof-mini-stats-row">
            <div className="prof-mini-stat">
              <div className="prof-mini-stat-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
                <FiPackage size={14} />
              </div>
              <div>
                <p className="prof-mini-stat-val">
                  {productsLoading ? "—" : productStats.active}
                </p>
                <p className="prof-mini-stat-label">Active</p>
              </div>
            </div>
            <div className="prof-mini-stat">
              <div className="prof-mini-stat-icon" style={{ background: "#fef9c3", color: "#a16207" }}>
                <FiFileText size={14} />
              </div>
              <div>
                <p className="prof-mini-stat-val">
                  {productsLoading ? "—" : productStats.draft}
                </p>
                <p className="prof-mini-stat-label">Drafts</p>
              </div>
            </div>
            <div className="prof-mini-stat">
              <div className="prof-mini-stat-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                <FiEye size={14} />
              </div>
              <div>
                <p className="prof-mini-stat-val">
                  {productsLoading ? "—" : fmtNum(productStats.views)}
                </p>
                <p className="prof-mini-stat-label">Views</p>
              </div>
            </div>
            <div className="prof-mini-stat">
              <div className="prof-mini-stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
                <FiHeart size={14} />
              </div>
              <div>
                <p className="prof-mini-stat-val">
                  {productsLoading ? "—" : fmtNum(productStats.favorites)}
                </p>
                <p className="prof-mini-stat-label">Saved</p>
              </div>
            </div>
          </div>

          {/* ── Recent products grid ── */}
          {productsLoading ? (
            <div className="prof-products-loading">
              <div className="prof-products-skeleton" />
              <div className="prof-products-skeleton" />
              <div className="prof-products-skeleton" />
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="prof-mini-grid">
                {products.map((p) => (
                  <MiniProductCard
                    key={p.id}
                    product={p}
                    onClick={(prod) => navigate(`/product/${prod.slug || prod.id}`)}
                  />
                ))}
              </div>
              {productStats.total > 6 && (
                <Link to="/dashboard" className="prof-see-all">
                  See all {productStats.total} listings →
                </Link>
              )}
            </>
          ) : (
            <div className="prof-no-products">
              <FiShoppingBag size={32} className="prof-no-products-icon" />
              <p>No listings yet</p>
              <Link to="/minimart/add" className="prof-no-products-btn">
                Post your first listing
              </Link>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            MENU
        ══════════════════════════════════════════════ */}
        <p className="profile-section-label">Menu</p>

        <div className="menu-list">
          {MENU_ITEMS.map(({ to, icon, label, badge }) => (
            <Link key={to} to={to} className="menu-item">
              <span className="menu-icon">{icon}</span>
              <span className="menu-label">{label}</span>
              {badge && (
                <span className="menu-badge">{badge}</span>
              )}
              <FiChevronRight className="menu-chevron" />
            </Link>
          ))}

          {/* Become Seller */}
          <button
            className="menu-item menu-item--seller"
            onClick={() => setShowSellerModal(true)}
          >
            <span className="menu-icon" style={{ color: "#6366f1" }}>
              <FiUser />
            </span>
            <span className="menu-label" style={{ color: "#6366f1", fontWeight: 700 }}>
              Become Seller
            </span>
            <span className="menu-badge menu-badge--seller">START</span>
            <FiChevronRight className="menu-chevron" style={{ color: "#6366f1" }} />
          </button>
        </div>

        {/* ══════════════════════════════════════════════
            ACCOUNT INFO
        ══════════════════════════════════════════════ */}
        <div className="prof-account-card">
          <p className="prof-account-label">Account Info</p>
          <div className="prof-account-row">
            <span className="prof-account-key">Member since</span>
            <span className="prof-account-val">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString("en-NG", {
                    month: "short",
                    year : "numeric",
                  })
                : "—"}
            </span>
          </div>
          <div className="prof-account-row">
            <span className="prof-account-key">Trust score</span>
            <span className="prof-account-val">
              {user?.trust_score != null ? (
                <span style={{ color: "#e8630a", fontWeight: 700 }}>
                  {user.trust_score}%
                </span>
              ) : "—"}
            </span>
          </div>
          <div className="prof-account-row">
            <span className="prof-account-key">Email verified</span>
            <span className="prof-account-val">
              {user?.email_verified
                ? <span style={{ color: "#16a34a" }}>✔ Yes</span>
                : <span style={{ color: "#dc2626" }}>✗ No</span>}
            </span>
          </div>
          <div className="prof-account-row">
            <span className="prof-account-key">Account status</span>
            <span className="prof-account-val">
              <span className={`prof-status prof-status--${user?.status || "active"}`}>
                {user?.status || "active"}
              </span>
            </span>
          </div>
        </div>

        {/* ── Logout ── */}
        <button className="prof-logout-btn" onClick={handleLogout}>
          <FiLogOut size={16} />
          Log Out
        </button>

        <p className="prof-footer">
          © {new Date().getFullYear()} Loemart Technologies Ltd
        </p>

      </div>

      {/* ── Support FAB ── */}
      <Link to="/support" className="support-btn" aria-label="Contact support">
        <FiHeadphones size={18} />
      </Link>

      {/* ── Seller Modal ── */}
      {showSellerModal && (
        <BecomeSellerModal
          onClose={() => setShowSellerModal(false)}
          navigate={navigate}
        />
      )}

      {/* ── Inline styles ── */}
      <style>{PROFILE_STYLES}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const PROFILE_STYLES = `
/* ── Product overview card ── */
.prof-product-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #ede9e3;
  padding: 18px 16px;
  margin: 12px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
}

.prof-product-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}
.prof-product-title {
  font-size: 16px;
  font-weight: 800;
  color: #111;
  margin: 0 0 3px;
}
.prof-product-sub {
  font-size: 12px;
  color: #999;
  margin: 0;
}

.prof-add-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  background: #e8630a;
  color: #fff;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity .15s;
}
.prof-add-btn:hover { opacity: .88; }

/* ── Mini stats row ── */
.prof-mini-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.prof-mini-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  background: #faf8f4;
  border-radius: 10px;
  border: 1px solid #ede9e3;
}
.prof-mini-stat-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.prof-mini-stat-val   { font-size: 15px; font-weight: 800; color: #111; line-height: 1; }
.prof-mini-stat-label { font-size: 10px; color: #aaa; font-weight: 500; margin-top: 2px; }

/* ── Mini product grid ── */
.prof-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.prof-mini-card {
  cursor: pointer;
  transition: transform .15s;
}
.prof-mini-card:hover { transform: translateY(-2px); }
.prof-mini-card:active { transform: scale(.96); }

.prof-mini-img {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  background: #f5f3ef;
  margin-bottom: 6px;
}
.prof-mini-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.prof-mini-status {
  position: absolute;
  bottom: 4px;
  left: 4px;
  font-size: 8px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 4px;
  text-transform: capitalize;
}
.prof-mini-status--active  { background: #dcfce7; color: #16a34a; }
.prof-mini-status--draft   { background: #f5f5f5; color: #888; }
.prof-mini-status--paused  { background: #fef9c3; color: #a16207; }
.prof-mini-status--pending { background: #eff6ff; color: #2563eb; }

.prof-mini-title {
  font-size: 11px;
  font-weight: 600;
  color: #222;
  line-height: 1.3;
  margin: 0 0 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.prof-mini-price {
  font-size: 12px;
  font-weight: 800;
  color: #e8630a;
  margin: 0 0 4px;
}
.prof-mini-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9px;
  color: #aaa;
  gap: 4px;
}

/* ── See all ── */
.prof-see-all {
  display: block;
  text-align: center;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #e8630a;
  text-decoration: none;
  border: 1px solid #ffd4a8;
  border-radius: 10px;
  background: #fff8f0;
  transition: background .15s;
}
.prof-see-all:hover { background: #fff0e0; }

/* ── Loading skeleton ── */
.prof-products-loading {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.prof-products-skeleton {
  aspect-ratio: 1;
  border-radius: 10px;
  background: linear-gradient(90deg, #ede9e3 25%, #f5f3ef 50%, #ede9e3 75%);
  background-size: 200% 100%;
  animation: prof-shimmer 1.4s infinite;
}
@keyframes prof-shimmer {
  from { background-position: -200px 0; }
  to   { background-position:  200px 0; }
}

/* ── No products ── */
.prof-no-products {
  text-align: center;
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.prof-no-products-icon { color: #ddd; }
.prof-no-products p    { font-size: 14px; color: #aaa; margin: 0; }
.prof-no-products-btn {
  padding: 9px 20px;
  background: #e8630a;
  color: #fff;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

/* ── Orange stat value ── */
.prof-stat--orange { color: #e8630a; }

/* ── Verified badge ── */
.profile-verified {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  background: #e8f5e9;
  color: #2d7a2d;
  padding: 2px 8px;
  border-radius: 20px;
  margin-top: 4px;
}

/* ── Menu badge ── */
.menu-badge {
  font-size: 9px;
  font-weight: 800;
  background: #e8630a;
  color: #fff;
  padding: 2px 6px;
  border-radius: 20px;
  margin-left: auto;
  white-space: nowrap;
}
.menu-badge--seller { background: #6366f1; }

/* ── Seller menu item ── */
.menu-item--seller {
  width: 100%;
  text-align: left;
  background: linear-gradient(135deg, #f5f3ff, #eef2ff);
  border: 1px solid #e0e7ff;
  cursor: pointer;
  margin-top: 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  transition: opacity .15s;
}
.menu-item--seller:hover { opacity: .88; }

/* ── Account card ── */
.prof-account-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #ede9e3;
  padding: 16px;
  margin: 12px 16px;
}
.prof-account-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #aaa;
  margin: 0 0 10px;
}
.prof-account-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f3ef;
  font-size: 13px;
}
.prof-account-row:last-child { border-bottom: none; }
.prof-account-key { color: #888; }
.prof-account-val { font-weight: 600; color: #222; }

.prof-status {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  text-transform: capitalize;
}
.prof-status--active    { background: #dcfce7; color: #16a34a; }
.prof-status--banned    { background: #fef2f2; color: #dc2626; }
.prof-status--suspended { background: #fef9c3; color: #a16207; }

/* ── Logout btn ── */
.prof-logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: calc(100% - 32px);
  margin: 8px 16px;
  padding: 13px;
  background: none;
  border: 1.5px solid #fecaca;
  border-radius: 12px;
  color: #dc2626;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background .15s;
}
.prof-logout-btn:hover { background: #fef2f2; }

/* ── Footer text ── */
.prof-footer {
  text-align: center;
  font-size: 11px;
  color: #ccc;
  padding: 8px 16px 24px;
}

/* Responsive */
@media (max-width: 360px) {
  .prof-mini-stats-row { grid-template-columns: repeat(2, 1fr); }
  .prof-mini-grid      { grid-template-columns: repeat(2, 1fr); }
  .prof-mini-stat      { padding: 8px 6px; }
}
`;