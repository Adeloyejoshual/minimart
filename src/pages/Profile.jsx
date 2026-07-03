// src/pages/Profile.jsx

import {
  useState, useEffect, useRef, useCallback, memo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

import ProfileHeader from "../components/ProfileHeader.jsx";
import "../styles/Profile.css";

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
  if (!p)               return PH;
  if (p.image)          return p.image;
  if (p.main_image)     return p.main_image;
  if (p.thumbnail_url)  return p.thumbnail_url;
  if (Array.isArray(p.images) && p.images[0]) {
    const f = p.images[0];
    return typeof f === "string" ? f : f?.url || PH;
  }
  return PH;
};

const fmtJoined = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  } catch { return null; }
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
   AUTH TOKEN
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE USER
   /api/users/me returns phone_number (old shape)
   We normalize to phone so the rest of the component
   never has to worry about which key is used.
═══════════════════════════════════════════════════════════════ */
function normalizeUser(raw) {
  if (!raw) return null;
  return {
    ...raw,
    // Normalize phone
    phone: raw.phone || raw.phone_number || "",
    // Normalize location — users/me returns flat state/city columns
    location_state: raw.location?.state || raw.location_state || raw.state || "",
    location_city:  raw.location?.city  || raw.location_city  || raw.city  || "",
  };
}

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  plus:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  logout:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevron:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  dashboard: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  wallet:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/></svg>,
  orders:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  saved:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  messages:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  trending:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  gift:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  shield:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  help:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  zap:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  seller:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  notify:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  support:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16l.19.92z"/></svg>,
  eye:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  star:      () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  copy:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   MENU CONFIG
═══════════════════════════════════════════════════════════════ */
const MENU_SECTIONS = [
  {
    title: "Selling",
    items: [
      { to: "/dashboard",    Ic: Icon.dashboard, label: "Seller Dashboard"                },
      { to: "/minimart/add", Ic: Icon.plus,      label: "Post a Listing",  badge: "NEW"  },
      { to: "/leaderboard",  Ic: Icon.trending,  label: "Leaderboard"                    },
    ],
  },
  {
    title: "Buying",
    items: [
      { to: "/shop/orders",   Ic: Icon.orders,   label: "My Orders"   },
      { to: "/saved",         Ic: Icon.saved,    label: "Saved Items" },
      { to: "/conversations", Ic: Icon.messages, label: "Messages"    },
    ],
  },
  {
    title: "Rewards",
    items: [
      { to: "/wallet",     Ic: Icon.wallet, label: "Wallet"                       },
      { to: "/spin",       Ic: Icon.zap,    label: "Spin & Win",   badge: "WIN"   },
      { to: "/coupons",    Ic: Icon.gift,   label: "Coupons & Promos"             },
      { to: "/invitation", Ic: Icon.gift,   label: "Refer & Earn", badge: "₦500" },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/verification",  Ic: Icon.shield,  label: "Verification"  },
      { to: "/notifications", Ic: Icon.notify,  label: "Notifications" },
      { to: "/support",       Ic: Icon.support, label: "Help & Support"},
      { to: "/faq",           Ic: Icon.help,    label: "FAQ"           },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   BECOME SELLER MODAL
═══════════════════════════════════════════════════════════════ */
const BecomeSellerModal = memo(function BecomeSellerModal({ onClose, navigate }) {
  const [step,    setStep]    = useState("choice");
  const [form,    setForm]    = useState({ email: "", password: "" });
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const modalRef = useRef(null);

  const onChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setErr("");
  };

  const loginAndContinue = async () => {
    if (!form.email.trim() || !form.password) { setErr("Both fields are required."); return; }
    setBusy(true); setErr("");
    try {
      const { data } = await axios.post(`${API}/auth/login`, {
        email: form.email.trim(), password: form.password,
      });
      if (data.token) {
        localStorage.setItem("seller_token", data.token);
        localStorage.setItem("token",        data.token);
      }
      onClose();
      navigate("/become-seller");
    } catch (e) {
      setErr(e.response?.data?.message ?? "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const createNew = () => {
    localStorage.removeItem("seller_token");
    onClose();
    navigate("/become-seller");
  };

  useEffect(() => {
    modalRef.current?.querySelector("button,input")?.focus();
  }, [step]);

  return (
    <div className="bsm-overlay" role="dialog" aria-modal="true" aria-label="Become a seller"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bsm-sheet" ref={modalRef}>
        <div className="bsm-handle"/>
        <button className="bsm-close" onClick={onClose} aria-label="Close" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {step === "choice" && (
          <>
            <div className="bsm-icon">🏪</div>
            <h2 className="bsm-title">Become a Seller</h2>
            <p className="bsm-sub">Start earning by listing your products on Loemart. Do you already have a seller account?</p>
            <div className="bsm-info">💡 Seller accounts are separate from your marketplace account.</div>
            <button className="bsm-btn bsm-btn--primary" onClick={() => setStep("login")}>🔐 I have a seller account</button>
            <button className="bsm-btn bsm-btn--outline" onClick={createNew}>✨ Create a seller account</button>
          </>
        )}

        {step === "login" && (
          <>
            <button className="bsm-back" onClick={() => { setStep("choice"); setErr(""); }} type="button">← Back</button>
            <div className="bsm-icon">🔐</div>
            <h2 className="bsm-title">Seller Sign In</h2>
            <p className="bsm-sub">Sign in with your seller account credentials.</p>
            <input className="bsm-input" name="email" type="email" placeholder="Seller email"
              value={form.email} onChange={onChange} autoComplete="email" autoFocus
              onKeyDown={(e) => e.key === "Enter" && loginAndContinue()}/>
            <div className="bsm-pwd-wrap">
              <input className="bsm-input" name="password" type={showPwd ? "text" : "password"}
                placeholder="Password" value={form.password} onChange={onChange}
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && loginAndContinue()}/>
              <button className="bsm-eye" type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Hide password" : "Show password"}>
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>
            {err && <p className="bsm-error">⚠️ {err}</p>}
            <button className="bsm-btn bsm-btn--primary" disabled={busy} onClick={loginAndContinue}>
              {busy ? "Signing in…" : "Sign In & Continue →"}
            </button>
            <p className="bsm-switch">
              No seller account?{" "}
              <button className="bsm-switch-link" onClick={createNew} type="button">Create one</button>
            </p>
            <div className="bsm-note">🔒 This is your <strong>seller account</strong> — separate from your marketplace login.</div>
          </>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MINI PRODUCT CARD
═══════════════════════════════════════════════════════════════ */
const MiniProductCard = memo(function MiniProductCard({ product, onClick }) {
  const img = getProductImg(product);
  return (
    <button className="pf-mini-card" onClick={() => onClick(product)}
      aria-label={`${product.title} — ${naira(product.price)}`} type="button">
      <div className="pf-mini-img">
        <img src={img} alt={product.title} loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}/>
        <span className={`pf-mini-badge pf-mini-badge--${product.status || "active"}`}>
          {product.status || "active"}
        </span>
      </div>
      <p className="pf-mini-title">{product.title}</p>
      <p className="pf-mini-price">{naira(product.price)}</p>
      <div className="pf-mini-meta">
        <span className="pf-mini-views">
          <span className="pf-mini-views-icon">👁</span>
          {fmtNum(product.views || 0)}
        </span>
        <span className="pf-mini-ago">{timeAgo(product.created_at)}</span>
      </div>
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
const SkeletonCard = () => (
  <div className="pf-skeleton-card">
    <div className="pf-sk pf-sk-img"/>
    <div style={{ padding: "8px" }}>
      <div className="pf-sk pf-sk-title"/>
      <div className="pf-sk pf-sk-price"/>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   REFERRAL BANNER
═══════════════════════════════════════════════════════════════ */
const ReferralBanner = ({ code }) => {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="pf-referral">
      <div className="pf-referral-text">
        <p className="pf-referral-head">🎁 Refer & Earn ₦500</p>
        <p className="pf-referral-sub">Share your code and earn when a friend signs up.</p>
      </div>
      <button className="pf-referral-code" onClick={copy} aria-label="Copy referral code" type="button">
        <span>{code}</span>
        <span className="pf-referral-copy-icon">
          {copied ? "✔" : <Icon.copy/>}
        </span>
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   COMPLETENESS BAR
   Uses normalized field names (location_state, phone)
═══════════════════════════════════════════════════════════════ */
const CompletenessBar = ({ user, navigate }) => {
  const checks = [
    { done: !!user?.name,           label: "Display name",   action: "/profile/edit" },
    { done: !!user?.profile_image,  label: "Profile photo",  action: "/profile/edit" },
    { done: !!user?.email_verified, label: "Email verified", action: "/verification" },
    { done: !!user?.phone,          label: "Phone number",   action: "/profile/edit" },
    { done: !!user?.location_state, label: "Your location",  action: "/profile/edit" },
  ];

  const done = checks.filter((c) => c.done).length;
  const pct  = Math.round((done / checks.length) * 100);
  const next = checks.find((c) => !c.done);

  if (pct === 100) return null;

  return (
    <div className="pf-complete">
      <div className="pf-complete-head">
        <span className="pf-complete-title">Complete your profile</span>
        <span className="pf-complete-pct">{pct}%</span>
      </div>
      <div className="pf-complete-bar">
        <div className="pf-complete-fill" style={{ width: `${pct}%` }}/>
      </div>
      {next && (
        <button className="pf-complete-action" onClick={() => navigate(next.action)} type="button">
          Add {next.label} →
        </button>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Profile({ onLogout }) {
  const navigate = useNavigate();

  const [user,         setUser]         = useState(null);
  const [products,     setProducts]     = useState([]);
  const [pStats,       setPStats]       = useState({ total: 0, active: 0, draft: 0, views: 0, favorites: 0 });
  const [loading,      setLoading]      = useState(true);
  const [prodsLoading, setProdsLoading] = useState(true);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [showSeller,   setShowSeller]   = useState(false);

  const menuRef = useRef(null);

  /* ── Fetch user ── */
  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/auth"); return; }

    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // Normalize field names so Profile never has to care about
        // which shape users/me returns
        setUser(normalizeUser(data));
      } catch {
        localStorage.removeItem("marketplace_token");
        localStorage.removeItem("token");
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ── Fetch listings ── */
  const fetchProducts = useCallback(async () => {
    const token = getToken();
    if (!token || !user?.id) return;
    setProdsLoading(true);
    try {
      const res = await fetch(
        `${API}/seller/${user.id}/products?limit=6&page=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const prods = Array.isArray(data.products) ? data.products
                  : Array.isArray(data)           ? data : [];
      setProducts(prods.slice(0, 6));
      setPStats({
        total:     data.total ?? prods.length,
        active:    prods.filter((p) => p.status === "active").length,
        draft:     prods.filter((p) => p.status === "draft").length,
        views:     prods.reduce((s, p) => s + Number(p.views              || 0), 0),
        favorites: prods.reduce((s, p) => s + Number(p.favorites_count    || 0), 0),
      });
    } catch (e) {
      console.error("[Profile] fetchProducts:", e);
    } finally {
      setProdsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { if (user?.id) fetchProducts(); }, [user?.id, fetchProducts]);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Logout ── */
  const logout = useCallback(() => {
    ["marketplace_token", "token", "seller_token"].forEach((k) => localStorage.removeItem(k));
    onLogout?.();
    navigate("/auth");
  }, [navigate, onLogout]);

  /* ── Navigate to edit ── */
  const goEdit = useCallback(() => navigate("/profile/edit"), [navigate]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="pf-full-loader">
        <div className="pf-ring"/>
      </div>
    );
  }

  const joinedLabel = fmtJoined(user?.created_at || user?.joined_at);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="pf-page">

        {/* ── Header — uses shared ProfileHeader component ── */}
        <ProfileHeader
          title="My Profile"
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onMenuClose={() => setMenuOpen(false)}
          menuRef={menuRef}
          onEdit={goEdit}
          onNotif={() => navigate("/notifications")}
          onLogout={logout}
        />

        <div className="pf-scroll">

          {/* ════════════════════════════════════════
              IDENTITY CARD
          ════════════════════════════════════════ */}
          <div className="pf-identity-card">
            <div className="pf-avatar-row">
              <div className="pf-avatar">
                {user?.profile_image ? (
                  <img src={user.profile_image} alt={user.name}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}/>
                ) : (
                  <span className="pf-avatar-letter">
                    {(user?.name || "U").charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="pf-avatar-online" title="You are online"/>
              </div>

              <div className="pf-identity">
                <h1 className="pf-name">{user?.name || "User"}</h1>
                <p className="pf-store">{user?.store_name || "Loemart Member"}</p>

                <div className="pf-meta">
                  {joinedLabel && (
                    <span className="pf-meta-item">📅 Joined {joinedLabel}</span>
                  )}
                  {user?.location_state && (
                    <span className="pf-meta-item">📍 {user.location_state}</span>
                  )}
                </div>

                <div className="pf-badges">
                  {user?.verified && (
                    <span className="pf-badge pf-badge--verified">✔ Verified</span>
                  )}
                  {user?.is_seller && (
                    <span className="pf-badge pf-badge--seller">🏪 Seller</span>
                  )}
                  {user?.is_top_seller && (
                    <span className="pf-badge pf-badge--top">⭐ Top Seller</span>
                  )}
                </div>
              </div>
            </div>

            {/* Edit profile button — clear CTA below identity */}
            <button className="pf-edit-btn" onClick={goEdit} type="button">
              ✏️ Edit Profile
            </button>

            {/* Completeness nudge */}
            <CompletenessBar user={user} navigate={navigate}/>

            {/* Key stats */}
            <div className="pf-key-stats">
              <div className="pf-kstat">
                <span className="pf-kstat-val pf-kstat-val--orange">
                  {prodsLoading ? "—" : fmtNum(pStats.total)}
                </span>
                <span className="pf-kstat-label">Listings</span>
              </div>
              <div className="pf-kstat-divider"/>
              <div className="pf-kstat">
                <span className="pf-kstat-val">{fmtNum(user?.total_sales || 0)}</span>
                <span className="pf-kstat-label">Sales</span>
              </div>
              <div className="pf-kstat-divider"/>
              <div className="pf-kstat">
                <span className="pf-kstat-val">
                  {user?.rating ? (
                    <span style={{ display:"flex", alignItems:"center", gap:3 }}>
                      <span style={{ color:"#f59e0b", fontSize:14 }}>★</span>
                      {Number(user.rating).toFixed(1)}
                    </span>
                  ) : "—"}
                </span>
                <span className="pf-kstat-label">Rating</span>
              </div>
              <div className="pf-kstat-divider"/>
              <div className="pf-kstat">
                <span className="pf-kstat-val">
                  {user?.wallet_balance != null ? naira(user.wallet_balance) : "—"}
                </span>
                <span className="pf-kstat-label">Wallet</span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="pf-quick-actions">
              <button className="pf-qa-btn pf-qa-btn--primary"
                onClick={() => navigate("/minimart/add")} type="button">
                <Icon.plus/> Post Listing
              </button>
              <button className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/dashboard")} type="button">
                <Icon.dashboard/> Dashboard
              </button>
              <button className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/conversations")} type="button">
                <Icon.messages/> Messages
              </button>
            </div>
          </div>

          {/* ════════════════════════════════════════
              REFERRAL BANNER
          ════════════════════════════════════════ */}
          <ReferralBanner code={user?.referral_code}/>

          {/* ════════════════════════════════════════
              MY LISTINGS
          ════════════════════════════════════════ */}
          <section className="pf-section">
            <div className="pf-section-head">
              <div>
                <h2 className="pf-section-title">My Listings</h2>
                <p className="pf-section-sub">
                  {prodsLoading ? "Loading…" : `${pStats.active} active · ${pStats.draft} draft`}
                </p>
              </div>
              <Link to="/minimart/add" className="pf-section-action">
                <Icon.plus/> Add
              </Link>
            </div>

            {!prodsLoading && (
              <div className="pf-activity-pills">
                <span className="pf-pill pf-pill--green"><span>📦</span>{pStats.active} Active</span>
                <span className="pf-pill pf-pill--yellow"><span>📝</span>{pStats.draft} Draft</span>
                <span className="pf-pill pf-pill--blue"><span>👁</span>{fmtNum(pStats.views)} Views</span>
                <span className="pf-pill pf-pill--red"><span>❤️</span>{fmtNum(pStats.favorites)} Saved</span>
              </div>
            )}

            {prodsLoading ? (
              <div className="pf-mini-grid">
                {[0,1,2].map((i) => <SkeletonCard key={i}/>)}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="pf-mini-grid">
                  {products.map((p) => (
                    <MiniProductCard key={p.id} product={p}
                      onClick={(prod) => navigate(`/product/${prod.slug || prod.id}`)}/>
                  ))}
                </div>
                {pStats.total > 6 && (
                  <Link to="/dashboard" className="pf-see-all">
                    See all {fmtNum(pStats.total)} listings →
                  </Link>
                )}
              </>
            ) : (
              <div className="pf-no-products">
                <span className="pf-no-products-emoji">🛍️</span>
                <p className="pf-no-products-text">No listings yet</p>
                <small className="pf-no-products-sub">Post your first product and start selling.</small>
                <Link to="/minimart/add" className="pf-no-products-cta">Post a Listing</Link>
              </div>
            )}
          </section>

          {/* ════════════════════════════════════════
              MENU SECTIONS
          ════════════════════════════════════════ */}
          {MENU_SECTIONS.map((section) => (
            <section key={section.title} className="pf-menu-section">
              <p className="pf-menu-label">{section.title}</p>
              <div className="pf-menu-list">
                {section.items.map(({ to, Ic, label, badge }) => (
                  <Link key={to} to={to} className="pf-menu-item">
                    <span className="pf-menu-icon"><Ic/></span>
                    <span className="pf-menu-label-text">{label}</span>
                    {badge && (
                      <span className={`pf-badge-pill${
                        badge === "WIN"       ? " pf-badge-pill--win"   :
                        badge === "NEW"       ? " pf-badge-pill--new"   :
                        badge.startsWith("₦") ? " pf-badge-pill--money" : ""
                      }`}>{badge}</span>
                    )}
                    <span className="pf-menu-chevron"><Icon.chevron/></span>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {/* ── Become Seller ── */}
          <section className="pf-menu-section">
            <p className="pf-menu-label">Grow</p>
            <div className="pf-menu-list">
              <button className="pf-menu-item pf-menu-item--seller"
                onClick={() => setShowSeller(true)} type="button">
                <span className="pf-menu-icon pf-menu-icon--seller"><Icon.seller/></span>
                <span className="pf-menu-label-text pf-menu-label-seller">Become a Seller</span>
                <span className="pf-badge-pill pf-badge-pill--seller">START</span>
                <span className="pf-menu-chevron pf-menu-chevron--seller"><Icon.chevron/></span>
              </button>
            </div>
          </section>

          {/* ════════════════════════════════════════
              ACCOUNT DETAILS
          ════════════════════════════════════════ */}
          <section className="pf-account-card">
            <p className="pf-account-heading">Account Details</p>
            {[
              {
                key: "Email",
                val: user?.email,
                extra: user?.email_verified
                  ? <span className="pf-tag pf-tag--green">Verified</span>
                  : <span className="pf-tag pf-tag--red">Unverified</span>,
              },
              {
                key:   "Phone",
                val:   user?.phone || "—",
                extra: null,
              },
              {
                key:   "Member since",
                val:   joinedLabel || "—",
                extra: null,
              },
              {
                key: "Account status",
                val: null,
                extra: (
                  <span className={`pf-status-badge pf-status-badge--${user?.status || "active"}`}>
                    {user?.status || "active"}
                  </span>
                ),
              },
            ].map(({ key, val, extra }) => (
              <div className="pf-account-row" key={key}>
                <span className="pf-account-key">{key}</span>
                <span className="pf-account-val">
                  {val && <span>{val}</span>}
                  {extra}
                </span>
              </div>
            ))}
          </section>

          {/* ── Log Out ── */}
          <button className="pf-logout" onClick={logout} type="button">
            <Icon.logout/> Log Out
          </button>

          <p className="pf-footer">Loemart Technologies Ltd · © {new Date().getFullYear()}</p>

        </div>
      </div>

      {showSeller && (
        <BecomeSellerModal onClose={() => setShowSeller(false)} navigate={navigate}/>
      )}
    </>
  );
}