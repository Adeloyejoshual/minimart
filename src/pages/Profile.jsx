/**
 * src/pages/Profile.jsx
 * Route: /profile
 *
 * Private user profile — the logged-in user's personal hub.
 * Focuses on: identity, activity summary, quick actions, settings.
 *
 * Design principles:
 * - Show the user THEIR data (not public-facing seller analytics)
 * - Every stat must be actionable or meaningful to the user
 * - Clear visual hierarchy: who you are → what you're doing → where to go
 */

import {
  useState, useEffect, useRef, useCallback, memo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import axios                 from "axios";

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
    return new Date(d).toLocaleDateString("en-NG", {
      month: "long",
      year : "numeric",
    });
  } catch { return null; }
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)      return "just now";
  if (s < 3_600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400)  return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

/* ═══════════════════════════════════════════════════════════════
   AUTH TOKEN
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ═══════════════════════════════════════════════════════════════
   ICONS  (inline SVG — no icon-library dependency)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  back       : () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>,
  dots       : () => <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5"  r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>,
  edit       : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  plus       : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  logout     : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevron    : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  dashboard  : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  wallet     : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 13a1 1 0 1 0 2 0 1 1 0 0 0-2 0z"/></svg>,
  orders     : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  saved      : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  messages   : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  trending   : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  gift       : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  shield     : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  help       : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  zap        : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  seller     : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  notify     : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  support    : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16l.19.92z"/></svg>,
  eye        : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  package    : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  heart      : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  star       : () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  copy       : () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   MENU CONFIG
═══════════════════════════════════════════════════════════════ */
const MENU_SECTIONS = [
  {
    title: "Selling",
    items: [
      { to: "/dashboard",    Icon: Icon.dashboard, label: "Seller Dashboard" },
      { to: "/minimart/add", Icon: Icon.plus,      label: "Post a Listing",  badge: "NEW" },
      { to: "/leaderboard",  Icon: Icon.trending,  label: "Leaderboard"                   },
    ],
  },
  {
    title: "Buying",
    items: [
      { to: "/orders",  Icon: Icon.orders,    label: "My Orders"    },
      { to: "/saved",   Icon: Icon.saved,     label: "Saved Items"  },
      { to: "/chat",    Icon: Icon.messages,  label: "Messages"     },
    ],
  },
  {
    title: "Rewards",
    items: [
      { to: "/wallet",    Icon: Icon.wallet, label: "Wallet"                          },
      { to: "/spin",      Icon: Icon.zap,    label: "Spin & Win",  badge: "WIN"       },
      { to: "/coupons",   Icon: Icon.gift,   label: "Coupons & Promos"                },
      { to: "/invitation",Icon: Icon.gift,   label: "Refer & Earn", badge: "₦500"     },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/verification", Icon: Icon.shield, label: "Verification"  },
      { to: "/notifications",Icon: Icon.notify, label: "Notifications" },
      { to: "/support",      Icon: Icon.support,label: "Help & Support" },
      { to: "/faq",          Icon: Icon.help,   label: "FAQ"           },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   BECOME SELLER MODAL
═══════════════════════════════════════════════════════════════ */
const BecomeSellerModal = memo(function BecomeSellerModal({ onClose, navigate }) {
  const [step,         setStep]         = useState("choice"); // "choice" | "login"
  const [form,         setForm]         = useState({ email: "", password: "" });
  const [busy,         setBusy]         = useState(false);
  const [err,          setErr]          = useState("");
  const [showPwd,      setShowPwd]      = useState(false);

  const onChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setErr("");
  };

  const loginAndContinue = async () => {
    if (!form.email.trim() || !form.password) {
      setErr("Both fields are required.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { data } = await axios.post(`${API}/auth/login`, {
        email   : form.email.trim(),
        password: form.password,
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

  /* trap focus inside modal */
  const modalRef = useRef(null);
  useEffect(() => {
    modalRef.current?.querySelector("button,input")?.focus();
  }, [step]);

  return (
    <div className="bsm-overlay" role="dialog" aria-modal="true"
      aria-label="Become a seller"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="bsm-sheet" ref={modalRef}>

        {/* handle bar */}
        <div className="bsm-handle" />

        <button className="bsm-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* ── CHOICE ── */}
        {step === "choice" && (
          <>
            <div className="bsm-icon">🏪</div>
            <h2 className="bsm-title">Become a Seller</h2>
            <p className="bsm-sub">
              Start earning by listing your products on Loemart.
              Do you already have a seller account?
            </p>

            <div className="bsm-info">
              💡 Seller accounts are separate from your marketplace account.
            </div>

            <button className="bsm-btn bsm-btn--primary" onClick={() => setStep("login")}>
              🔐 I have a seller account
            </button>
            <button className="bsm-btn bsm-btn--outline" onClick={createNew}>
              ✨ Create a seller account
            </button>
          </>
        )}

        {/* ── LOGIN ── */}
        {step === "login" && (
          <>
            <button className="bsm-back" onClick={() => { setStep("choice"); setErr(""); }}>
              ← Back
            </button>
            <div className="bsm-icon">🔐</div>
            <h2 className="bsm-title">Seller Sign In</h2>
            <p className="bsm-sub">Sign in with your seller account credentials.</p>

            <input
              className="bsm-input"
              name="email"
              type="email"
              placeholder="Seller email"
              value={form.email}
              onChange={onChange}
              onKeyDown={(e) => e.key === "Enter" && loginAndContinue()}
              autoComplete="email"
              autoFocus
            />

            <div className="bsm-pwd-wrap">
              <input
                className="bsm-input"
                name="password"
                type={showPwd ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={onChange}
                onKeyDown={(e) => e.key === "Enter" && loginAndContinue()}
                autoComplete="current-password"
              />
              <button
                className="bsm-eye"
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "🙈" : "👁️"}
              </button>
            </div>

            {err && <p className="bsm-error">⚠️ {err}</p>}

            <button
              className="bsm-btn bsm-btn--primary"
              disabled={busy}
              onClick={loginAndContinue}
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Signing in…" : "Sign In & Continue →"}
            </button>

            <p className="bsm-switch">
              No seller account?{" "}
              <button className="bsm-switch-link" onClick={createNew}>
                Create one
              </button>
            </p>

            <div className="bsm-note">
              🔒 This is your <strong>seller account</strong> — separate from
              your marketplace login.
            </div>
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
      aria-label={`${product.title} — ${naira(product.price)}`}>
      <div className="pf-mini-img">
        <img src={img} alt={product.title} loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }} />
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
    <div className="pf-sk pf-sk-img" />
    <div style={{ padding: "8px" }}>
      <div className="pf-sk pf-sk-title" />
      <div className="pf-sk pf-sk-price" />
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
        <p className="pf-referral-sub">
          Share your code and earn when a friend signs up.
        </p>
      </div>
      <button className="pf-referral-code" onClick={copy} aria-label="Copy referral code">
        <span>{code}</span>
        <span className="pf-referral-copy-icon">
          {copied ? "✔" : <Icon.copy />}
        </span>
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   COMPLETENESS PROMPT
   Nudges the user to fill in missing profile info.
═══════════════════════════════════════════════════════════════ */
const CompletenessBar = ({ user, navigate }) => {
  const checks = [
    { done: !!user?.name,          label: "Display name",      action: "/settings" },
    { done: !!user?.profile_image, label: "Profile photo",     action: "/settings" },
    { done: !!user?.email_verified,label: "Email verified",    action: "/verification" },
    { done: !!user?.phone,         label: "Phone number",      action: "/settings" },
    { done: !!user?.location,      label: "Your location",     action: "/settings" },
  ];

  const done  = checks.filter((c) => c.done).length;
  const pct   = Math.round((done / checks.length) * 100);
  const next  = checks.find((c) => !c.done);

  if (pct === 100) return null; // nothing to prompt

  return (
    <div className="pf-complete">
      <div className="pf-complete-head">
        <span className="pf-complete-title">Complete your profile</span>
        <span className="pf-complete-pct">{pct}%</span>
      </div>
      <div className="pf-complete-bar">
        <div className="pf-complete-fill" style={{ width: `${pct}%` }} />
      </div>
      {next && (
        <button
          className="pf-complete-action"
          onClick={() => navigate(next.action)}
        >
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

  /* ── state ── */
  const [user,          setUser]          = useState(null);
  const [products,      setProducts]      = useState([]);
  const [pStats,        setPStats]        = useState({
    total: 0, active: 0, draft: 0, views: 0, favorites: 0,
  });
  const [loading,       setLoading]       = useState(true);
  const [prodsLoading,  setProdsLoading]  = useState(true);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [showSeller,    setShowSeller]    = useState(false);

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
        setUser(data);
      } catch {
        localStorage.removeItem("marketplace_token");
        localStorage.removeItem("token");
        navigate("/auth");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ── Fetch user's listings ── */
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
        total    : data.total ?? prods.length,
        active   : prods.filter((p) => p.status === "active").length,
        draft    : prods.filter((p) => p.status === "draft").length,
        views    : prods.reduce((s, p) => s + Number(p.views     || 0), 0),
        favorites: prods.reduce((s, p) => s + Number(p.favorites_count || 0), 0),
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
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Logout ── */
  const logout = useCallback(() => {
    ["marketplace_token", "token", "seller_token"].forEach(
      (k) => localStorage.removeItem(k)
    );
    onLogout?.();
    navigate("/auth");
  }, [navigate, onLogout]);

  /* ── Full-page loading ── */
  if (loading) {
    return (
      <div className="pf-full-loader">
        <div className="pf-ring" />
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

        {/* ════════════════════════════════════════
            STICKY HEADER
        ════════════════════════════════════════ */}
        <header className="pf-header">
          <button className="pf-hdr-btn" onClick={() => navigate(-1)}
            aria-label="Go back">
            <Icon.back />
          </button>
          <span className="pf-hdr-title">My Profile</span>
          <div className="pf-hdr-right">
            {/* Edit profile */}
            <button className="pf-hdr-btn" onClick={() => navigate("/settings")}
              aria-label="Edit profile">
              <Icon.edit />
            </button>
            {/* 3-dot menu */}
            <div className="pf-dots-wrap" ref={menuRef}>
              <button className="pf-hdr-btn" onClick={() => setMenuOpen((v) => !v)}
                aria-label="More options" aria-expanded={menuOpen}>
                <Icon.dots />
              </button>
              {menuOpen && (
                <div className="pf-dropdown" role="menu">
                  <button className="pf-dropdown-item"
                    onClick={() => { setMenuOpen(false); navigate("/settings"); }}>
                    <Icon.edit /> Edit Profile
                  </button>
                  <button className="pf-dropdown-item"
                    onClick={() => { setMenuOpen(false); navigate("/notifications"); }}>
                    <Icon.notify /> Notifications
                  </button>
                  <div className="pf-dropdown-divider" />
                  <button className="pf-dropdown-item pf-dropdown-item--danger"
                    onClick={logout}>
                    <Icon.logout /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="pf-scroll">

          {/* ════════════════════════════════════════
              IDENTITY CARD
          ════════════════════════════════════════ */}
          <div className="pf-identity-card">

            {/* Avatar row */}
            <div className="pf-avatar-row">
              <div className="pf-avatar">
                {user?.profile_image ? (
                  <img src={user.profile_image}
                    alt={user.name}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <span className="pf-avatar-letter">
                    {(user?.name || "U").charAt(0).toUpperCase()}
                  </span>
                )}
                {/* Online dot */}
                <span className="pf-avatar-online" title="You are online" />
              </div>

              <div className="pf-identity">
                <h1 className="pf-name">{user?.name || "User"}</h1>

                {/* Store name OR buyer tag */}
                <p className="pf-store">
                  {user?.store_name || "Loemart Member"}
                </p>

                {/* Joined + location */}
                <div className="pf-meta">
                  {joinedLabel && (
                    <span className="pf-meta-item">📅 Joined {joinedLabel}</span>
                  )}
                  {(user?.location?.state || user?.location_state) && (
                    <span className="pf-meta-item">
                      📍 {user.location?.state || user.location_state}
                    </span>
                  )}
                </div>

                {/* Badges */}
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

            {/* ── Profile completeness nudge ── */}
            <CompletenessBar user={user} navigate={navigate} />

            {/* ── Key numbers (meaningful to the user) ── */}
            <div className="pf-key-stats">
              <div className="pf-kstat">
                <span className="pf-kstat-val pf-kstat-val--orange">
                  {prodsLoading ? "—" : fmtNum(pStats.total)}
                </span>
                <span className="pf-kstat-label">Listings</span>
              </div>
              <div className="pf-kstat-divider" />
              <div className="pf-kstat">
                <span className="pf-kstat-val">
                  {user?.total_sales ? fmtNum(user.total_sales) : "0"}
                </span>
                <span className="pf-kstat-label">Sales</span>
              </div>
              <div className="pf-kstat-divider" />
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
              <div className="pf-kstat-divider" />
              <div className="pf-kstat">
                <span className="pf-kstat-val">
                  {user?.wallet_balance != null
                    ? naira(user.wallet_balance)
                    : "—"}
                </span>
                <span className="pf-kstat-label">Wallet</span>
              </div>
            </div>

            {/* ── Quick actions ── */}
            <div className="pf-quick-actions">
              <button className="pf-qa-btn pf-qa-btn--primary"
                onClick={() => navigate("/minimart/add")}>
                <Icon.plus /> Post Listing
              </button>
              <button className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/dashboard")}>
                <Icon.dashboard /> Dashboard
              </button>
              <button className="pf-qa-btn pf-qa-btn--outline"
                onClick={() => navigate("/chat")}>
                <Icon.messages /> Messages
              </button>
            </div>
          </div>

          {/* ════════════════════════════════════════
              REFERRAL BANNER
          ════════════════════════════════════════ */}
          <ReferralBanner code={user?.referral_code} />

          {/* ════════════════════════════════════════
              MY LISTINGS SECTION
          ════════════════════════════════════════ */}
          <section className="pf-section">
            <div className="pf-section-head">
              <div>
                <h2 className="pf-section-title">My Listings</h2>
                <p className="pf-section-sub">
                  {prodsLoading
                    ? "Loading…"
                    : `${pStats.active} active · ${pStats.draft} draft`}
                </p>
              </div>
              <Link to="/minimart/add" className="pf-section-action">
                <Icon.plus /> Add
              </Link>
            </div>

            {/* ── Activity pills ── */}
            {!prodsLoading && (
              <div className="pf-activity-pills">
                <span className="pf-pill pf-pill--green">
                  <span>📦</span>
                  {pStats.active} Active
                </span>
                <span className="pf-pill pf-pill--yellow">
                  <span>📝</span>
                  {pStats.draft} Draft
                </span>
                <span className="pf-pill pf-pill--blue">
                  <span>👁</span>
                  {fmtNum(pStats.views)} Views
                </span>
                <span className="pf-pill pf-pill--red">
                  <span>❤️</span>
                  {fmtNum(pStats.favorites)} Saved
                </span>
              </div>
            )}

            {/* ── Product grid ── */}
            {prodsLoading ? (
              <div className="pf-mini-grid">
                {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="pf-mini-grid">
                  {products.map((p) => (
                    <MiniProductCard
                      key={p.id}
                      product={p}
                      onClick={(prod) =>
                        navigate(`/product/${prod.slug || prod.id}`)
                      }
                    />
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
                <small className="pf-no-products-sub">
                  Post your first product and start selling.
                </small>
                <Link to="/minimart/add" className="pf-no-products-cta">
                  Post a Listing
                </Link>
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
                {section.items.map(({ to, Icon: Ic, label, badge }) => (
                  <Link key={to} to={to} className="pf-menu-item">
                    <span className="pf-menu-icon"><Ic /></span>
                    <span className="pf-menu-label-text">{label}</span>
                    {badge && (
                      <span className={`pf-badge-pill${
                        badge === "WIN"  ? " pf-badge-pill--win"  :
                        badge === "NEW"  ? " pf-badge-pill--new"  :
                        badge.startsWith("₦") ? " pf-badge-pill--money" : ""
                      }`}>
                        {badge}
                      </span>
                    )}
                    <span className="pf-menu-chevron"><Icon.chevron /></span>
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
                onClick={() => setShowSeller(true)}>
                <span className="pf-menu-icon pf-menu-icon--seller">
                  <Icon.seller />
                </span>
                <span className="pf-menu-label-text pf-menu-label-seller">
                  Become a Seller
                </span>
                <span className="pf-badge-pill pf-badge-pill--seller">START</span>
                <span className="pf-menu-chevron pf-menu-chevron--seller">
                  <Icon.chevron />
                </span>
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
                key : "Email",
                val : user?.email,
                extra: user?.email_verified
                  ? <span className="pf-tag pf-tag--green">Verified</span>
                  : <span className="pf-tag pf-tag--red">Unverified</span>,
              },
              {
                key : "Phone",
                val : user?.phone || "—",
                extra: null,
              },
              {
                key : "Member since",
                val : joinedLabel || "—",
                extra: null,
              },
              {
                key : "Account status",
                val : null,
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
          <button className="pf-logout" onClick={logout}>
            <Icon.logout /> Log Out
          </button>

          <p className="pf-footer">
            Loemart Technologies Ltd · © {new Date().getFullYear()}
          </p>

        </div>{/* end pf-scroll */}
      </div>

      {/* ════════════════════════════════════════
          SELLER MODAL
      ════════════════════════════════════════ */}
      {showSeller && (
        <BecomeSellerModal
          onClose={() => setShowSeller(false)}
          navigate={navigate}
        />
      )}

      {/* ════════════════════════════════════════
          STYLES
      ════════════════════════════════════════ */}
      <style>{STYLES}</style>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ALL STYLES
═══════════════════════════════════════════════════════════════ */
const STYLES = `
/* ── Font smoothing ── */
.pf-page * { -webkit-font-smoothing: antialiased; box-sizing: border-box; }

/* ════════════════════════════════════════
   PAGE SHELL
════════════════════════════════════════ */
.pf-page {
  max-width: 680px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f7f4ef;
  display: flex;
  flex-direction: column;
}
.pf-scroll {
  flex: 1;
  overflow-y: auto;
  padding-bottom: calc(var(--bottom-nav-h, 72px) + 32px);
}

/* ── Full-page loader ── */
.pf-full-loader {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
@keyframes pf-spin { to { transform: rotate(360deg); } }
.pf-ring {
  width: 40px;
  height: 40px;
  border: 3px solid #ede9e3;
  border-top-color: #e8630a;
  border-radius: 50%;
  animation: pf-spin .8s linear infinite;
}

/* ════════════════════════════════════════
   STICKY HEADER
════════════════════════════════════════ */
.pf-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(247,244,239,.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #ede9e3;
}
.pf-hdr-title {
  flex: 1;
  font-size: 16px;
  font-weight: 800;
  color: #111;
  text-align: center;
}
.pf-hdr-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.pf-hdr-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid #e8e4de;
  background: #fff;
  color: #222;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color .15s;
  flex-shrink: 0;
}
.pf-hdr-btn svg { width: 18px; height: 18px; }
.pf-hdr-btn:hover { border-color: #e8630a; }

/* ── Dropdown ── */
.pf-dots-wrap   { position: relative; }
.pf-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #fff;
  border: 1px solid #ede9e3;
  border-radius: 14px;
  box-shadow: 0 8px 30px rgba(0,0,0,.12);
  min-width: 180px;
  overflow: hidden;
  z-index: 200;
  animation: pf-fade-in .15s ease;
}
@keyframes pf-fade-in {
  from { opacity:0; transform: translateY(-6px); }
  to   { opacity:1; transform: translateY(0); }
}
.pf-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 13px 16px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #222;
  cursor: pointer;
  text-align: left;
  transition: background .12s;
}
.pf-dropdown-item svg { width: 16px; height: 16px; flex-shrink: 0; }
.pf-dropdown-item:hover  { background: #f7f4ef; }
.pf-dropdown-item--danger { color: #dc2626; }
.pf-dropdown-item--danger:hover { background: #fef2f2; }
.pf-dropdown-divider {
  height: 1px;
  background: #f0ede8;
  margin: 2px 0;
}

/* ════════════════════════════════════════
   IDENTITY CARD
════════════════════════════════════════ */
.pf-identity-card {
  background: #fff;
  padding: 20px 16px 16px;
  border-bottom: 1px solid #ede9e3;
  margin-bottom: 8px;
}

/* Avatar row */
.pf-avatar-row {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 16px;
}
.pf-avatar {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #fff3e8;
  border: 3px solid #ffd4a8;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.pf-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.pf-avatar-letter {
  font-size: 30px;
  font-weight: 900;
  color: #e8630a;
  line-height: 1;
}
.pf-avatar-online {
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 14px;
  height: 14px;
  background: #22c55e;
  border-radius: 50%;
  border: 2.5px solid #fff;
}

/* Identity text */
.pf-identity { flex: 1; min-width: 0; }
.pf-name {
  font-size: 20px;
  font-weight: 900;
  color: #111;
  margin: 0 0 3px;
  line-height: 1.1;
}
.pf-store {
  font-size: 13px;
  color: #888;
  margin: 0 0 6px;
  font-weight: 500;
}

.pf-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.pf-meta-item {
  font-size: 12px;
  color: #888;
  font-weight: 500;
}

/* Badges */
.pf-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.pf-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.pf-badge--verified { background: #e8f5e9; color: #2d7a2d; border: 1px solid #c8e6c9; }
.pf-badge--seller   { background: #f3e8ff; color: #7c3aed; border: 1px solid #e9d5ff; }
.pf-badge--top      { background: #fff8e1; color: #b45309; border: 1px solid #fde68a; }

/* ── Profile completeness ── */
.pf-complete {
  background: #fff8f0;
  border: 1px solid #ffd4a8;
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 14px;
}
.pf-complete-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.pf-complete-title { font-size: 13px; font-weight: 700; color: #333; }
.pf-complete-pct   { font-size: 13px; font-weight: 800; color: #e8630a; }
.pf-complete-bar {
  height: 5px;
  background: #ede9e3;
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 10px;
}
.pf-complete-fill {
  height: 100%;
  background: #e8630a;
  border-radius: 99px;
  transition: width .6s ease;
}
.pf-complete-action {
  font-size: 12px;
  font-weight: 700;
  color: #e8630a;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

/* ── Key stats ── */
.pf-key-stats {
  display: flex;
  align-items: center;
  background: #f9f7f3;
  border: 1px solid #ede9e3;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 14px;
}
.pf-kstat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 4px;
  gap: 3px;
}
.pf-kstat-divider {
  width: 1px;
  height: 40px;
  background: #ede9e3;
  flex-shrink: 0;
}
.pf-kstat-val {
  font-size: 16px;
  font-weight: 900;
  color: #111;
  line-height: 1;
  display: flex;
  align-items: center;
}
.pf-kstat-val--orange { color: #e8630a; }
.pf-kstat-label {
  font-size: 10px;
  color: #aaa;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .4px;
}

/* ── Quick actions ── */
.pf-quick-actions {
  display: flex;
  gap: 8px;
}
.pf-qa-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: opacity .15s, transform .1s;
  white-space: nowrap;
}
.pf-qa-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
.pf-qa-btn:active { transform: scale(.96); }
.pf-qa-btn--primary { background: #e8630a; color: #fff; }
.pf-qa-btn--outline {
  background: #fff;
  color: #333;
  border: 1.5px solid #e0d8cc;
}
.pf-qa-btn:hover { opacity: .88; }

/* ════════════════════════════════════════
   REFERRAL BANNER
════════════════════════════════════════ */
.pf-referral {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: linear-gradient(135deg, #fff8f0, #fff3e0);
  border: 1px solid #ffd4a8;
  border-radius: 14px;
  padding: 14px 16px;
  margin: 0 16px 8px;
}
.pf-referral-head {
  font-size: 14px;
  font-weight: 800;
  color: #111;
  margin: 0 0 3px;
}
.pf-referral-sub {
  font-size: 12px;
  color: #888;
  margin: 0;
  line-height: 1.4;
}
.pf-referral-code {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  background: #fff;
  border: 1.5px dashed #e8630a;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 800;
  color: #e8630a;
  cursor: pointer;
  letter-spacing: .04em;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background .15s;
}
.pf-referral-code:hover { background: #fff5ee; }
.pf-referral-copy-icon { display: flex; align-items: center; }
.pf-referral-copy-icon svg { width: 14px; height: 14px; }

/* ════════════════════════════════════════
   LISTINGS SECTION
════════════════════════════════════════ */
.pf-section {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #ede9e3;
  padding: 16px;
  margin: 0 16px 8px;
}
.pf-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}
.pf-section-title {
  font-size: 16px;
  font-weight: 800;
  color: #111;
  margin: 0 0 2px;
}
.pf-section-sub {
  font-size: 12px;
  color: #aaa;
  margin: 0;
}
.pf-section-action {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  background: #e8630a;
  color: #fff;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity .15s;
}
.pf-section-action svg { width: 13px; height: 13px; }
.pf-section-action:hover { opacity: .88; }

/* ── Activity pills ── */
.pf-activity-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 14px;
}
.pf-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid transparent;
}
.pf-pill--green  { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.pf-pill--yellow { background: #fefce8; color: #a16207; border-color: #fde68a; }
.pf-pill--blue   { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
.pf-pill--red    { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

/* ── Mini product grid ── */
.pf-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

/* Mini product card */
.pf-mini-card {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  transition: transform .15s;
}
.pf-mini-card:hover  { transform: translateY(-2px); }
.pf-mini-card:active { transform: scale(.96); }

.pf-mini-img {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  background: #f5f3ef;
  border: 1px solid #ede9e3;
  margin-bottom: 6px;
}
.pf-mini-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.pf-mini-badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  font-size: 8px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 5px;
  text-transform: capitalize;
}
.pf-mini-badge--active  { background: #dcfce7; color: #16a34a; }
.pf-mini-badge--draft   { background: #f3f4f6; color: #6b7280; }
.pf-mini-badge--paused  { background: #fef9c3; color: #a16207; }
.pf-mini-badge--pending { background: #eff6ff; color: #2563eb; }

.pf-mini-title {
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
.pf-mini-price {
  font-size: 12px;
  font-weight: 800;
  color: #e8630a;
  margin: 0 0 4px;
}
.pf-mini-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9px;
  color: #bbb;
}
.pf-mini-views {
  display: flex;
  align-items: center;
  gap: 2px;
}
.pf-mini-views-icon { font-size: 9px; }

/* ── See all ── */
.pf-see-all {
  display: block;
  text-align: center;
  padding: 11px;
  font-size: 13px;
  font-weight: 700;
  color: #e8630a;
  text-decoration: none;
  border: 1.5px solid #ffd4a8;
  border-radius: 10px;
  background: #fff8f0;
  transition: background .15s;
}
.pf-see-all:hover { background: #fff0e0; }

/* ── No products ── */
.pf-no-products {
  text-align: center;
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.pf-no-products-emoji { font-size: 42px; }
.pf-no-products-text  { font-size: 15px; font-weight: 700; color: #333; margin: 0; }
.pf-no-products-sub   { font-size: 13px; color: #aaa; margin: 0; }
.pf-no-products-cta {
  display: inline-block;
  margin-top: 4px;
  padding: 10px 24px;
  background: #e8630a;
  color: #fff;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: opacity .15s;
}
.pf-no-products-cta:hover { opacity: .88; }

/* ── Skeleton ── */
.pf-skeleton-card {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #ede9e3;
}
@keyframes pf-shimmer {
  from { background-position: -300px 0; }
  to   { background-position:  300px 0; }
}
.pf-sk {
  background: linear-gradient(90deg, #ede9e3 25%, #f5f3ef 50%, #ede9e3 75%);
  background-size: 300px 100%;
  animation: pf-shimmer 1.4s infinite linear;
  border-radius: 6px;
}
.pf-sk-img   { height: 90px; border-radius: 0; }
.pf-sk-title { height: 11px; width: 80%; margin-bottom: 6px; }
.pf-sk-price { height: 13px; width: 45%; }

/* ════════════════════════════════════════
   MENU SECTIONS
════════════════════════════════════════ */
.pf-menu-section { margin: 0 16px 8px; }
.pf-menu-label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: #aaa;
  padding: 12px 4px 6px;
  margin: 0;
}
.pf-menu-list {
  background: #fff;
  border-radius: 14px;
  border: 1px solid #ede9e3;
  overflow: hidden;
}
.pf-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  text-decoration: none;
  color: #222;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid #f5f3ef;
  transition: background .12s;
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
}
.pf-menu-item:last-child { border-bottom: none; }
.pf-menu-item:hover      { background: #faf8f4; }
.pf-menu-item:active     { background: #f5f2ed; }
.pf-menu-item--seller {
  background: linear-gradient(135deg, #f5f3ff, #eef2ff);
  border-bottom: none !important;
}
.pf-menu-item--seller:hover { background: linear-gradient(135deg, #ede9ff, #e8eeff); }

.pf-menu-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #f5f3ef;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #555;
}
.pf-menu-icon svg { width: 17px; height: 17px; }
.pf-menu-icon--seller { background: #ede9ff; color: #6366f1; }

.pf-menu-label-text { flex: 1; }
.pf-menu-label-seller { color: #6366f1; font-weight: 700; }

.pf-menu-chevron { color: #ccc; flex-shrink: 0; }
.pf-menu-chevron svg { width: 16px; height: 16px; }
.pf-menu-chevron--seller { color: #6366f1; }

/* Badge pills */
.pf-badge-pill {
  font-size: 9px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 20px;
  background: #e8630a;
  color: #fff;
  letter-spacing: .03em;
}
.pf-badge-pill--win    { background: linear-gradient(135deg, #f59e0b, #ef4444); }
.pf-badge-pill--new    { background: #16a34a; }
.pf-badge-pill--money  { background: #059669; }
.pf-badge-pill--seller { background: #6366f1; }

/* ════════════════════════════════════════
   ACCOUNT DETAILS CARD
════════════════════════════════════════ */
.pf-account-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #ede9e3;
  padding: 16px;
  margin: 0 16px 8px;
}
.pf-account-heading {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: #aaa;
  margin: 0 0 10px;
}
.pf-account-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f3ef;
  font-size: 13px;
}
.pf-account-row:last-child { border-bottom: none; }
.pf-account-key { color: #888; font-weight: 500; }
.pf-account-val {
  font-weight: 600;
  color: #222;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pf-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
}
.pf-tag--green { background: #e8f5e9; color: #2d7a2d; }
.pf-tag--red   { background: #fef2f2; color: #dc2626; }

.pf-status-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  text-transform: capitalize;
}
.pf-status-badge--active    { background: #dcfce7; color: #16a34a; }
.pf-status-badge--banned    { background: #fef2f2; color: #dc2626; }
.pf-status-badge--suspended { background: #fef9c3; color: #a16207; }

/* ════════════════════════════════════════
   LOG OUT BUTTON
════════════════════════════════════════ */
.pf-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: calc(100% - 32px);
  margin: 8px 16px;
  padding: 14px;
  background: none;
  border: 1.5px solid #fecaca;
  border-radius: 12px;
  color: #dc2626;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background .15s;
}
.pf-logout svg { width: 16px; height: 16px; }
.pf-logout:hover { background: #fef2f2; }

/* ── Footer ── */
.pf-footer {
  text-align: center;
  font-size: 11px;
  color: #ccc;
  padding: 8px 16px 32px;
}

/* ════════════════════════════════════════
   BECOME SELLER MODAL (bottom sheet)
════════════════════════════════════════ */
.bsm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 0;
  backdrop-filter: blur(4px);
  animation: bsm-overlay-in .2s ease;
}
@keyframes bsm-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.bsm-sheet {
  background: #fff;
  width: 100%;
  max-width: 680px;
  border-radius: 24px 24px 0 0;
  padding: 8px 24px 48px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 90vh;
  overflow-y: auto;
  animation: bsm-sheet-in .25s cubic-bezier(.32,1,.23,1);
}
@keyframes bsm-sheet-in {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.bsm-handle {
  width: 40px;
  height: 4px;
  background: #e0dbd2;
  border-radius: 99px;
  margin: 6px auto 4px;
}
.bsm-close {
  position: absolute;
  top: 18px;
  right: 20px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid #e8e4de;
  background: #fff;
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color .15s;
}
.bsm-close:hover { border-color: #e55; color: #e55; }

.bsm-icon     { font-size: 40px; text-align: center; }
.bsm-title    { font-size: 22px; font-weight: 900; color: #111; text-align: center; margin: 0; }
.bsm-sub      { font-size: 14px; color: #777; text-align: center; line-height: 1.6; margin: 0; }

.bsm-info {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #0369a1;
  line-height: 1.5;
}
.bsm-note {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #92400e;
  line-height: 1.5;
}

.bsm-input {
  width: 100%;
  padding: 13px 16px;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  font-size: 14px;
  outline: none;
  background: #faf9f7;
  transition: border-color .15s;
}
.bsm-input:focus { border-color: #e8630a; background: #fff; }

.bsm-pwd-wrap { position: relative; }
.bsm-eye {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 4px;
}

.bsm-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #dc2626;
  margin: 0;
}

.bsm-btn {
  width: 100%;
  padding: 15px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: opacity .15s, transform .1s;
}
.bsm-btn:active { transform: scale(.98); }
.bsm-btn--primary {
  background: linear-gradient(135deg, #e8630a, #f07c2a);
  color: #fff;
}
.bsm-btn--outline {
  background: #fff;
  color: #333;
  border: 1.5px solid #e0d8cc;
}
.bsm-btn:disabled { opacity: .6; cursor: not-allowed; }

.bsm-back {
  background: none;
  border: none;
  color: #888;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
.bsm-switch {
  text-align: center;
  font-size: 13px;
  color: #888;
  margin: 0;
}
.bsm-switch-link {
  background: none;
  border: none;
  color: #e8630a;
  font-weight: 700;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  text-decoration: underline;
}

/* ════════════════════════════════════════
   RESPONSIVE
════════════════════════════════════════ */
@media (max-width: 380px) {
  .pf-quick-actions { flex-wrap: wrap; }
  .pf-qa-btn        { flex: none; width: calc(50% - 4px); }
  .pf-qa-btn:first-child { width: 100%; }
  .pf-mini-grid     { grid-template-columns: repeat(2, 1fr); }
  .pf-key-stats     { flex-wrap: wrap; }
  .pf-kstat         { flex: 0 0 50%; }
  .pf-kstat-divider { display: none; }
}
@media (min-width: 520px) {
  .pf-mini-grid { grid-template-columns: repeat(4, 1fr); }
  .pf-quick-actions .pf-qa-btn { font-size: 13px; }
}
`;