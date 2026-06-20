/**
 * src/pages/Profile/Dashboard.jsx
 * Route: /dashboard
 *
 * Seller dashboard with:
 * - Stats (products, views, clicks, revenue)
 * - Sales chart (pure CSS bars)
 * - All products: active / draft / paused tabs
 * - Add, edit, toggle, delete products
 * - Performance score
 * - Top products
 * - Growth tips
 */

import { useState, useEffect, useCallback, memo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

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

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)     return "just now";
  if (s < 3_600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

const PH = "https://placehold.co/56x56/f0ede8/b0a89e?text=?";

const getImg = (p) => {
  if (!p) return PH;
  return p.image || p.main_image || p.thumbnail_url ||
    (Array.isArray(p.images) && p.images[0]
      ? (typeof p.images[0] === "string" ? p.images[0] : p.images[0]?.url)
      : null) || PH;
};

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Ic = {
  Back    : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  Plus    : () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit    : () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash   : () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Pause   : () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Play    : () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Eye     : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Chart   : () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Package : () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8l-9-4-9 4v8l9 4 9-4z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Naira   : () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="15" x2="18" y2="15"/><line x1="6" y1="9" x2="18" y2="9"/><path d="M6 4l12 16M18 4L6 20"/></svg>,
  Star    : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Bell    : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Heart   : () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  Refresh : () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 12a9 9 0 009-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 006.74-2.74L21 16"/><path d="M21 21v-5h-5"/></svg>,
  Store   : () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Search  : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Check   : () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   STAT CARD
═══════════════════════════════════════════════════════════════ */
const StatCard = memo(({ icon, label, value, sub, color }) => (
  <div className="db-stat" style={{ "--c": color }}>
    <div className="db-stat-icon">{icon}</div>
    <div className="db-stat-info">
      <p className="db-stat-val">{value}</p>
      <p className="db-stat-label">{label}</p>
      {sub && <p className="db-stat-sub">{sub}</p>}
    </div>
  </div>
));

/* ═══════════════════════════════════════════════════════════════
   BAR CHART (pure CSS)
═══════════════════════════════════════════════════════════════ */
const BarChart = memo(({ data = [], color = "#e8630a" }) => {
  if (!data.length) return (
    <div className="db-chart-empty">No chart data for this period</div>
  );

  const max = Math.max(...data.map((d) => d.views || 0), 1);

  return (
    <div className="db-chart">
      <div className="db-chart-bars">
        {data.map((d, i) => {
          const pct = Math.max(3, ((d.views || 0) / max) * 100);
          return (
            <div key={i} className="db-bar-wrap"
              title={`${d.label}\nViews: ${fmtNum(d.views)}\nClicks: ${fmtNum(d.clicks)}`}>
              <div className="db-bar" style={{ height: `${pct}%`, background: color }} />
              <span className="db-bar-label">{d.label?.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
      <div className="db-chart-legend">
        <span style={{ color }}>■ Views</span>
        <span style={{ color: "#888" }}>Total: {fmtNum(data.reduce((s, d) => s + (d.views || 0), 0))}</span>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SCORE RING
═══════════════════════════════════════════════════════════════ */
const ScoreRing = memo(({ score = 0 }) => {
  const r   = 40;
  const c   = 2 * Math.PI * r;
  const cfg = score >= 80 ? { color: "#16a34a", label: "Excellent" } :
              score >= 60 ? { color: "#e8630a", label: "Good"      } :
              score >= 40 ? { color: "#f59e0b", label: "Fair"      } :
                            { color: "#dc2626", label: "Low"       };

  return (
    <div className="db-score-wrap">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f0ede8" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          stroke={cfg.color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 1s ease" }}
        />
        <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="900" fill={cfg.color}>{score}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="9" fill="#aaa">/100</text>
      </svg>
      <p className="db-score-label" style={{ color: cfg.color }}>{cfg.label}</p>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT ROW
═══════════════════════════════════════════════════════════════ */
const ProductRow = memo(function ProductRow({
  product, onEdit, onDelete, onToggle, isDeleting,
}) {
  const img    = getImg(product);
  const active = product.status === "active" && product.is_active !== false;

  return (
    <div className={`db-prod-row${isDeleting ? " db-prod-row--del" : ""}`}>
      {/* Image */}
      <div className="db-prod-img">
        <img src={img} alt={product.title}
          onError={(e) => { e.currentTarget.src = PH; }} />
        {product.is_promoted && <span className="db-prod-promo">⭐</span>}
      </div>

      {/* Info */}
      <div className="db-prod-info">
        <p className="db-prod-title">{product.title}</p>
        <div className="db-prod-meta">
          <span className="db-prod-price">{naira(product.price)}</span>
          <span className={`db-status db-status--${product.status}`}>
            {active ? "Active" : product.status}
          </span>
          {product.category_name && (
            <span className="db-prod-cat">{product.category_name}</span>
          )}
        </div>
        <div className="db-prod-stats">
          <span title="Views"><Ic.Eye /> {fmtNum(product.views)}</span>
          <span title="Saves"><Ic.Heart /> {fmtNum(product.favorites_count)}</span>
          <span>{timeAgo(product.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="db-prod-actions">
        <button className="db-act db-act--edit"
          onClick={() => onEdit(product)} title="Edit">
          <Ic.Edit />
        </button>
        <button
          className={`db-act ${active ? "db-act--pause" : "db-act--play"}`}
          onClick={() => onToggle(product)}
          title={active ? "Pause" : "Activate"}
        >
          {active ? <Ic.Pause /> : <Ic.Play />}
        </button>
        <button className="db-act db-act--delete"
          onClick={() => onDelete(product)} title="Delete">
          <Ic.Trash />
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   CONFIRM DIALOG
═══════════════════════════════════════════════════════════════ */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="db-confirm-overlay" onClick={onCancel}>
      <div className="db-confirm" onClick={(e) => e.stopPropagation()}>
        <p className="db-confirm-msg">{message}</p>
        <div className="db-confirm-actions">
          <button className="db-confirm-cancel" onClick={onCancel}>Cancel</button>
          <button className="db-confirm-ok"     onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════ */
export default function Dashboard({ user }) {
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────
  const [stats,      setStats]      = useState(null);
  const [products,   setProducts]   = useState([]);
  const [analytics,  setAnalytics]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [prodLoading,setProdLoading]= useState(false);
  const [error,      setError]      = useState(null);
  const [tab,        setTab]        = useState("all");
  const [search,     setSearch]     = useState("");
  const [deleting,   setDeleting]   = useState(null);
  const [confirm,    setConfirm]    = useState(null);
  const [section,    setSection]    = useState("overview"); // overview | products | analytics
  const [greeting,   setGreeting]   = useState("Dashboard");
  const searchRef = useRef(null);

  // ── Greeting ──────────────────────────────────────────────
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  // ── Auth ──────────────────────────────────────────────────
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/dashboard");
  }, [navigate]);

  // ── Load stats ────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seller-dashboard/stats`, { headers: authH() });
      if (res.ok) {
        const d = await res.json();
        setStats(d.stats || d);
      }
    } catch {}
  }, []);

  // ── Load products ─────────────────────────────────────────
  const loadProducts = useCallback(async (currentTab = "all") => {
    setProdLoading(true);
    try {
      const res = await fetch(
        `${API}/seller-dashboard/products?tab=${currentTab}&limit=50`,
        { headers: authH() }
      );
      if (res.ok) {
        const d = await res.json();
        setProducts(
          Array.isArray(d.products) ? d.products :
          Array.isArray(d)          ? d : []
        );
      }
    } catch {}
    finally { setProdLoading(false); }
  }, []);

  // ── Load analytics ────────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/seller-dashboard/analytics?days=7`,
        { headers: authH() }
      );
      if (res.ok) {
        const d = await res.json();
        setAnalytics(d);
      }
    } catch {}
  }, []);

  // ── Bootstrap ─────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStats(), loadProducts("all"), loadAnalytics()]);
    } catch (err) {
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [loadStats, loadProducts, loadAnalytics]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Tab change ────────────────────────────────────────────
  const handleTabChange = useCallback((newTab) => {
    setTab(newTab);
    setSearch("");
    loadProducts(newTab);
  }, [loadProducts]);

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = useCallback((product) => {
    setConfirm({
      message : `Delete "${product.title}"? This cannot be undone.`,
      product,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    const product = confirm?.product;
    if (!product) return;
    setConfirm(null);
    setDeleting(product.id);

    try {
      const res = await fetch(
        `${API}/seller-dashboard/products/${product.id}`,
        { method: "DELETE", headers: authH() }
      );
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        loadStats(); // refresh counts
      } else {
        alert("Could not delete. Please try again.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setDeleting(null);
    }
  }, [confirm, loadStats]);

  // ── Toggle ────────────────────────────────────────────────
  const handleToggle = useCallback(async (product) => {
    try {
      const res = await fetch(
        `${API}/seller-dashboard/products/${product.id}/toggle`,
        { method: "PATCH", headers: authH() }
      );
      if (res.ok) {
        const data = await res.json();
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id
              ? { ...p, is_active: data.is_active, status: data.status }
              : p
          )
        );
        loadStats();
      }
    } catch {}
  }, [loadStats]);

  // ── Edit ──────────────────────────────────────────────────
  const handleEdit = useCallback((product) => {
    navigate(`/minimart/add?edit=${product.id}`);
  }, [navigate]);

  // ── Filtered products ─────────────────────────────────────
  const filtered = products.filter((p) =>
    !search || (p.title || "").toLowerCase().includes(search.toLowerCase())
  );

  // ── Tab counts ────────────────────────────────────────────
  const tabCounts = {
    all    : stats?.total_products || products.length,
    active : stats?.active         || 0,
    draft  : stats?.draft          || 0,
    paused : stats?.paused         || 0,
  };

  // ── Insights ──────────────────────────────────────────────
  const insights = [];
  if (stats) {
    if (tabCounts.active === 0) {
      insights.push({ icon: "⚠️", msg: "You have no active listings — activate or create one to get buyers.", type: "warn" });
    }
    if (tabCounts.draft > 0) {
      insights.push({ icon: "📝", msg: `You have ${tabCounts.draft} draft listing${tabCounts.draft > 1 ? "s" : ""} — publish them to get sales.`, type: "info" });
    }
    if (tabCounts.active >= 5) {
      insights.push({ icon: "🎉", msg: `${tabCounts.active} active listings — great job! Keep adding more.`, type: "good" });
    }
    if ((stats.total_views || 0) > 100) {
      insights.push({ icon: "📈", msg: `${fmtNum(stats.total_views)} total views — promote your top listings for more sales.`, type: "good" });
    }
  }

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="db-page">

      {/* ══════════════════════════════════════════════
          TOPBAR
      ══════════════════════════════════════════════ */}
      <div className="db-topbar">
        <button className="db-topbar-back" onClick={() => navigate(-1)} aria-label="Back">
          <Ic.Back />
        </button>
        <div className="db-topbar-mid">
          <p className="db-topbar-greet">{greeting} 👋</p>
          <h1 className="db-topbar-title">Seller Dashboard</h1>
        </div>
        <div className="db-topbar-right">
          <button className="db-topbar-btn" onClick={loadAll} title="Refresh">
            <Ic.Refresh />
          </button>
          <button className="db-topbar-btn" onClick={() => navigate("/notifications")} title="Notifications">
            <Ic.Bell />
          </button>
        </div>
      </div>

      {/* ── Nav tabs ── */}
      <div className="db-nav">
        {[
          { key: "overview",  label: "Overview"  },
          { key: "products",  label: "Listings"  },
          { key: "analytics", label: "Analytics" },
        ].map((n) => (
          <button
            key={n.key}
            className={`db-nav-btn${section === n.key ? " db-nav-btn--active" : ""}`}
            onClick={() => setSection(n.key)}
          >
            {n.label}
            {n.key === "products" && tabCounts.all > 0 && (
              <span className="db-nav-count">{tabCounts.all}</span>
            )}
          </button>
        ))}
      </div>

      <div className="db-scroll">

        {/* ── Error ── */}
        {error && (
          <div className="db-error">
            <span>⚠️ {error}</span>
            <button onClick={loadAll}>Retry</button>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            OVERVIEW SECTION
        ══════════════════════════════════════════════ */}
        {section === "overview" && (
          <>
            {/* Quick actions */}
            <div className="db-quick">
              <button className="db-qa db-qa--primary" onClick={() => navigate("/minimart/add")}>
                <Ic.Plus /> Add Listing
              </button>
              <button className="db-qa" onClick={() => setSection("products")}>
                <Ic.Package /> My Listings
              </button>
              <button className="db-qa" onClick={() => setSection("analytics")}>
                <Ic.Chart /> Analytics
              </button>
              <Link className="db-qa" to={`/seller/${user?.id || ""}`}>
                <Ic.Store /> My Store
              </Link>
            </div>

            {/* Stat cards */}
            {loading ? (
              <div className="db-stats-grid">
                {[1,2,3,4].map((i) => <div key={i} className="db-stat db-sk" />)}
              </div>
            ) : stats ? (
              <div className="db-stats-grid">
                <StatCard
                  icon={<Ic.Package />}
                  label="Total Listings"
                  value={fmtNum(stats.total_products)}
                  sub={`${stats.active} active · ${stats.draft} draft`}
                  color="#6366f1"
                />
                <StatCard
                  icon={<Ic.Eye />}
                  label="Total Views"
                  value={fmtNum(stats.total_views)}
                  sub={`${fmtNum(stats.total_clicks)} clicks`}
                  color="#0891b2"
                />
                <StatCard
                  icon={<Ic.Heart />}
                  label="Saved"
                  value={fmtNum(stats.total_favorites)}
                  sub="by buyers"
                  color="#ec4899"
                />
                <StatCard
                  icon={<Ic.Naira />}
                  label="Total Revenue"
                  value={naira(stats.total_revenue)}
                  sub={stats.rating > 0 ? `⭐ ${Number(stats.rating).toFixed(1)} rating` : "No sales yet"}
                  color="#e8630a"
                />
              </div>
            ) : null}

            {/* Score + insights */}
            <div className="db-card db-score-card">
              <div className="db-card-head">
                <h2 className="db-card-title">Performance Score</h2>
              </div>
              <div className="db-score-row">
                <ScoreRing score={analytics?.seller_score || 0} />
                <div className="db-score-info">
                  <p className="db-score-desc">
                    Your score is based on engagement, response time, reviews and CTR.
                  </p>
                  <div className="db-score-bars">
                    {[
                      { label: "Response",   val: 60  },
                      { label: "Engagement", val: Math.min(100, (stats?.total_views || 0) / 10) },
                      { label: "Rating",     val: ((stats?.rating || 0) / 5) * 100 },
                    ].map((b) => (
                      <div key={b.label} className="db-score-bar-row">
                        <span>{b.label}</span>
                        <div className="db-score-bar-track">
                          <div className="db-score-bar-fill" style={{ width: `${b.val}%` }} />
                        </div>
                        <span>{Math.round(b.val)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Insights */}
            {insights.length > 0 && (
              <div className="db-card">
                <h2 className="db-card-title" style={{ marginBottom: 12 }}>💡 Insights</h2>
                <div className="db-insights">
                  {insights.map((ins, i) => (
                    <div key={i} className={`db-insight db-insight--${ins.type}`}>
                      <span>{ins.icon}</span>
                      <p>{ins.msg}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent products preview */}
            {!loading && products.length > 0 && (
              <div className="db-card">
                <div className="db-card-head">
                  <h2 className="db-card-title">Recent Listings</h2>
                  <button className="db-card-link" onClick={() => setSection("products")}>
                    See all →
                  </button>
                </div>
                {products.slice(0, 3).map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    isDeleting={deleting === p.id}
                  />
                ))}
              </div>
            )}

            {/* Tips */}
            <div className="db-card db-tips-card">
              <h2 className="db-card-title">🚀 Grow Your Sales</h2>
              <div className="db-tips">
                {[
                  { i: "📸", t: "Add 3–6 high quality photos per listing" },
                  { i: "✍️", t: "Write detailed descriptions with keywords" },
                  { i: "💰", t: "Price competitively — check similar items" },
                  { i: "⭐", t: "Enable promotions for instant visibility" },
                  { i: "💬", t: "Reply to buyer messages within 1 hour" },
                  { i: "📍", t: "Add your exact city for nearby buyers" },
                ].map((t, i) => (
                  <div key={i} className="db-tip">
                    <span className="db-tip-ic">{t.i}</span>
                    <span>{t.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════
            PRODUCTS SECTION
        ══════════════════════════════════════════════ */}
        {section === "products" && (
          <div className="db-card">
            <div className="db-card-head">
              <h2 className="db-card-title">My Listings</h2>
              <button className="db-card-action" onClick={() => navigate("/minimart/add")}>
                <Ic.Plus /> Add
              </button>
            </div>

            {/* Status tabs */}
            <div className="db-tabs">
              {[
                { key: "all",    label: "All"     },
                { key: "active", label: "Active"  },
                { key: "draft",  label: "Drafts"  },
                { key: "paused", label: "Paused"  },
              ].map((t) => (
                <button
                  key={t.key}
                  className={`db-tab${tab === t.key ? " db-tab--active" : ""}`}
                  onClick={() => handleTabChange(t.key)}
                >
                  {t.label}
                  <span className={`db-tab-count${tab === t.key ? " db-tab-count--active" : ""}`}>
                    {tabCounts[t.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="db-search-wrap">
              <span className="db-search-ic"><Ic.Search /></span>
              <input
                ref={searchRef}
                className="db-search"
                type="search"
                placeholder="Search your listings…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="db-search-clr" onClick={() => setSearch("")}>✕</button>
              )}
            </div>

            {/* Loading */}
            {prodLoading && (
              <div className="db-sk-list">
                {[1,2,3].map((i) => <div key={i} className="db-sk-row" />)}
              </div>
            )}

            {/* Empty */}
            {!prodLoading && filtered.length === 0 && (
              <div className="db-empty">
                <span>📭</span>
                <p>
                  {search
                    ? `No results for "${search}"`
                    : `No ${tab === "all" ? "" : tab} listings`}
                </p>
                {tab === "all" && !search && (
                  <button onClick={() => navigate("/minimart/add")}>
                    Post your first listing →
                  </button>
                )}
              </div>
            )}

            {/* Product rows */}
            {!prodLoading && filtered.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
                isDeleting={deleting === p.id}
              />
            ))}

            {!prodLoading && filtered.length > 0 && (
              <p className="db-showing">
                Showing {filtered.length} listing{filtered.length !== 1 ? "s" : ""}
                {search ? ` matching "${search}"` : ""}
              </p>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            ANALYTICS SECTION
        ══════════════════════════════════════════════ */}
        {section === "analytics" && (
          <>
            {/* Performance score */}
            <div className="db-card db-score-card">
              <div className="db-card-head">
                <h2 className="db-card-title">📊 Performance Score</h2>
                <span className="db-card-sub">Based on 4 metrics</span>
              </div>
              <div className="db-score-row">
                <ScoreRing score={analytics?.seller_score || 0} />
                <div className="db-score-info">
                  <div className="db-score-bars">
                    {[
                      { label: "CTR",        val: Math.min(100, (stats?.total_clicks || 0) / Math.max(1, stats?.total_views || 1) * 500) },
                      { label: "Engagement", val: Math.min(100, (stats?.total_views || 0) / 10) },
                      { label: "Rating",     val: ((stats?.rating || 0) / 5) * 100 },
                      { label: "Response",   val: 60 },
                    ].map((b) => (
                      <div key={b.label} className="db-score-bar-row">
                        <span>{b.label}</span>
                        <div className="db-score-bar-track">
                          <div className="db-score-bar-fill" style={{ width: `${Math.round(b.val)}%` }} />
                        </div>
                        <span>{Math.round(b.val)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats summary */}
            {stats && (
              <div className="db-stats-grid">
                <StatCard icon={<Ic.Eye />}     label="Total Views"     value={fmtNum(stats.total_views)}     color="#0891b2" />
                <StatCard icon={<Ic.Chart />}   label="Total Clicks"    value={fmtNum(stats.total_clicks)}    color="#6366f1" />
                <StatCard icon={<Ic.Heart />}   label="Total Saves"     value={fmtNum(stats.total_favorites)} color="#ec4899" />
                <StatCard icon={<Ic.Package />} label="Active Listings" value={fmtNum(stats.active)}          color="#16a34a" />
              </div>
            )}

            {/* Views chart (last 7 days) */}
            <div className="db-card">
              <div className="db-card-head">
                <h2 className="db-card-title">📈 Views — Last 7 Days</h2>
              </div>
              {loading ? (
                <div className="db-chart-empty">Loading…</div>
              ) : (
                <BarChart data={analytics?.daily || []} />
              )}
            </div>

            {/* Top products */}
            {analytics?.top_products?.length > 0 && (
              <div className="db-card">
                <div className="db-card-head">
                  <h2 className="db-card-title">🏆 Top Performing Listings</h2>
                </div>
                <div className="db-top-products">
                  {analytics.top_products.map((p, i) => (
                    <div key={p.id} className="db-top-prod"
                      onClick={() => navigate(`/product/${p.slug || p.id}`)}>
                      <span className="db-top-rank">#{i + 1}</span>
                      <img
                        src={p.image || PH}
                        alt={p.title}
                        className="db-top-img"
                        onError={(e) => { e.currentTarget.src = PH; }}
                      />
                      <div className="db-top-info">
                        <p className="db-top-title">{p.title}</p>
                        <div className="db-top-stats">
                          <span><Ic.Eye /> {fmtNum(p.views)}</span>
                          <span><Ic.Heart /> {fmtNum(p.favorites_count)}</span>
                          {p.ctr > 0 && <span>{p.ctr}% CTR</span>}
                        </div>
                      </div>
                      <span className="db-top-price">{naira(p.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Listing breakdown */}
            {stats && (
              <div className="db-card">
                <h2 className="db-card-title" style={{ marginBottom: 14 }}>
                  📦 Listing Breakdown
                </h2>
                <div className="db-breakdown">
                  {[
                    { label: "Active",   count: stats.active,   color: "#16a34a", bg: "#dcfce7" },
                    { label: "Drafts",   count: stats.draft,    color: "#a16207", bg: "#fef9c3" },
                    { label: "Paused",   count: stats.paused,   color: "#6b7280", bg: "#f3f4f6" },
                    { label: "Promoted", count: stats.promoted,  color: "#e8630a", bg: "#fff0e6" },
                  ].map((b) => (
                    <div key={b.label} className="db-breakdown-item"
                      style={{ background: b.bg }}
                      onClick={() => { setSection("products"); handleTabChange(b.label.toLowerCase()); }}>
                      <p className="db-breakdown-val" style={{ color: b.color }}>
                        {b.count}
                      </p>
                      <p className="db-breakdown-label">{b.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <p className="db-footer">© {new Date().getFullYear()} Loemart Technologies</p>
      </div>

      {/* ── Confirm dialog ── */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirmDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── FAB ── */}
      <button className="db-fab" onClick={() => navigate("/minimart/add")} aria-label="Add listing">
        <Ic.Plus />
      </button>

      {/* ── Styles ── */}
      <style>{DB_STYLES}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const DB_STYLES = `

/* ── Page ── */
.db-page {
  max-width: 680px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f7f4ef;
  font-family: 'DM Sans', system-ui, sans-serif;
  padding-bottom: 80px;
}

/* ── Topbar ── */
.db-topbar {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px;
  background: rgba(247,244,239,.96);
  border-bottom: 1px solid #ede9e3;
  backdrop-filter: blur(12px);
}
.db-topbar-back {
  width: 36px; height: 36px;
  border-radius: 50%; border: 1.5px solid #e0d8cc;
  background: #fff; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #333; flex-shrink: 0; transition: all .15s;
}
.db-topbar-back:hover { border-color: #e8630a; color: #e8630a; }
.db-topbar-mid  { flex: 1; }
.db-topbar-greet{ font-size: 11px; color: #aaa; margin: 0; }
.db-topbar-title{ font-size: 17px; font-weight: 800; color: #111; margin: 0; }
.db-topbar-right{ display: flex; gap: 6px; }
.db-topbar-btn {
  width: 34px; height: 34px;
  border-radius: 50%; border: 1.5px solid #e0d8cc;
  background: #fff; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #555; transition: all .15s;
}
.db-topbar-btn:hover { border-color: #e8630a; color: #e8630a; }

/* ── Nav tabs ── */
.db-nav {
  display: flex; gap: 0;
  background: #fff;
  border-bottom: 1px solid #ede9e3;
  padding: 0 16px;
  overflow-x: auto; scrollbar-width: none;
}
.db-nav::-webkit-scrollbar { display: none; }
.db-nav-btn {
  padding: 12px 16px;
  border: none; background: none;
  font-size: 13px; font-weight: 600; color: #aaa;
  cursor: pointer; white-space: nowrap;
  border-bottom: 2.5px solid transparent;
  display: flex; align-items: center; gap: 5px;
  transition: color .15s;
}
.db-nav-btn--active { color: #111; border-bottom-color: #e8630a; }
.db-nav-count {
  background: #f5f3ef; color: #888;
  font-size: 10px; font-weight: 700;
  padding: 1px 6px; border-radius: 20px;
}

/* ── Scroll area ── */
.db-scroll { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }

/* ── Error ── */
.db-error {
  padding: 12px 14px;
  background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; color: #dc2626;
}
.db-error button {
  padding: 5px 12px; background: #dc2626; color: #fff;
  border: none; border-radius: 6px; font-size: 12px; cursor: pointer;
}

/* ── Quick actions ── */
.db-quick {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
.db-qa {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 5px; padding: 12px 6px;
  background: #fff; border: 1.5px solid #ede9e3; border-radius: 12px;
  font-size: 11px; font-weight: 600; color: #555;
  cursor: pointer; transition: all .15s; text-decoration: none;
}
.db-qa:hover { border-color: #e8630a; color: #e8630a; transform: translateY(-1px); }
.db-qa--primary { background: #e8630a; color: #fff; border-color: #e8630a; }
.db-qa--primary:hover { background: #d55a08; color: #fff; }

/* ── Stats grid ── */
.db-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }

.db-stat {
  background: #fff; border: 1px solid #ede9e3;
  border-radius: 14px; padding: 14px 12px;
  display: flex; align-items: flex-start; gap: 10px;
  position: relative; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}
.db-stat::after {
  content: ''; position: absolute;
  top: 0; left: 0; width: 3px; height: 100%;
  background: var(--c, #e8630a); border-radius: 0 2px 2px 0;
}
.db-stat-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: color-mix(in srgb, var(--c, #e8630a) 12%, white);
  color: var(--c, #e8630a);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.db-stat-info  { flex: 1; min-width: 0; }
.db-stat-val   { font-size: 19px; font-weight: 900; color: #111; line-height: 1; margin-bottom: 2px; }
.db-stat-label { font-size: 11px; color: #aaa; font-weight: 500; }
.db-stat-sub   { font-size: 10px; color: var(--c, #e8630a); margin-top: 3px; font-weight: 600; }

/* ── Card ── */
.db-card {
  background: #fff; border: 1px solid #ede9e3;
  border-radius: 16px; padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}
.db-card-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.db-card-title { font-size: 15px; font-weight: 800; color: #111; margin: 0; }
.db-card-sub   { font-size: 11px; color: #aaa; }
.db-card-link  { font-size: 13px; font-weight: 600; color: #e8630a; background: none; border: none; cursor: pointer; }
.db-card-action {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 14px; background: #e8630a; color: #fff;
  border-radius: 20px; font-size: 12px; font-weight: 700;
  border: none; cursor: pointer; text-decoration: none;
  transition: opacity .15s;
}
.db-card-action:hover { opacity: .88; }

/* ── Score card ── */
.db-score-card {}
.db-score-row {
  display: flex; align-items: flex-start; gap: 16px;
}
.db-score-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
.db-score-label{ font-size: 11px; font-weight: 700; }
.db-score-info { flex: 1; }
.db-score-desc { font-size: 12px; color: #888; line-height: 1.4; margin-bottom: 10px; }
.db-score-bars { display: flex; flex-direction: column; gap: 6px; }
.db-score-bar-row {
  display: flex; align-items: center; gap: 8px; font-size: 11px; color: #888;
}
.db-score-bar-row span:first-child { width: 80px; flex-shrink: 0; }
.db-score-bar-row span:last-child  { width: 32px; text-align: right; flex-shrink: 0; }
.db-score-bar-track { flex: 1; height: 6px; background: #f0ede8; border-radius: 99px; overflow: hidden; }
.db-score-bar-fill  { height: 100%; background: #e8630a; border-radius: 99px; }

/* ── Insights ── */
.db-insights { display: flex; flex-direction: column; gap: 8px; }
.db-insight {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  font-size: 13px; line-height: 1.4;
}
.db-insight--good { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.db-insight--warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.db-insight--info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }

/* ── Tabs ── */
.db-tabs {
  display: flex; gap: 0;
  border-bottom: 1px solid #ede9e3; margin-bottom: 10px;
  overflow-x: auto; scrollbar-width: none;
}
.db-tabs::-webkit-scrollbar { display: none; }
.db-tab {
  padding: 10px 12px; border: none; background: none;
  font-size: 13px; font-weight: 600; color: #aaa; cursor: pointer;
  border-bottom: 2.5px solid transparent; white-space: nowrap;
  display: flex; align-items: center; gap: 5px; transition: color .15s;
}
.db-tab--active { color: #111; border-bottom-color: #e8630a; }
.db-tab-count {
  background: #f5f3ef; color: #888;
  font-size: 10px; font-weight: 700;
  padding: 1px 6px; border-radius: 20px;
}
.db-tab-count--active { background: #fff0e6; color: #e8630a; }

/* ── Search ── */
.db-search-wrap { position: relative; margin-bottom: 10px; }
.db-search-ic {
  position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
  pointer-events: none; color: #aaa;
}
.db-search {
  width: 100%; padding: 10px 32px 10px 32px;
  border: 1.5px solid #ede9e3; border-radius: 10px;
  font-size: 13px; background: #faf8f4;
  box-sizing: border-box; outline: none; font-family: inherit;
  transition: border-color .15s;
}
.db-search:focus { border-color: #e8630a; background: #fff; }
.db-search-clr {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: #aaa; font-size: 12px;
}

/* ── Product row ── */
.db-prod-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 0; border-bottom: 1px solid #f5f3ef;
  transition: opacity .3s;
}
.db-prod-row:last-child    { border-bottom: none; }
.db-prod-row--del          { opacity: .3; pointer-events: none; }

.db-prod-img {
  position: relative;
  width: 56px; height: 56px; border-radius: 10px;
  overflow: hidden; flex-shrink: 0;
  background: #f5f3ef; border: 1px solid #ede9e3;
}
.db-prod-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.db-prod-promo {
  position: absolute; top: 2px; right: 2px;
  font-size: 10px;
}

.db-prod-info { flex: 1; min-width: 0; }
.db-prod-title {
  font-size: 13px; font-weight: 600; color: #222;
  margin-bottom: 4px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.db-prod-meta {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;
}
.db-prod-price { font-size: 13px; font-weight: 800; color: #e8630a; }
.db-prod-cat   { font-size: 10px; color: #888; background: #f5f3ef; padding: 1px 6px; border-radius: 10px; }

.db-status { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; text-transform: capitalize; }
.db-status--active  { background: #dcfce7; color: #16a34a; }
.db-status--draft   { background: #f5f5f5; color: #888; }
.db-status--paused  { background: #fef9c3; color: #a16207; }
.db-status--pending { background: #eff6ff; color: #2563eb; }
.db-status--deleted { background: #fef2f2; color: #dc2626; }

.db-prod-stats {
  display: flex; gap: 10px; font-size: 11px; color: #bbb;
  align-items: center;
}
.db-prod-stats span { display: flex; align-items: center; gap: 3px; }

.db-prod-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
.db-act {
  width: 28px; height: 28px; border-radius: 7px; border: none;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.db-act:hover  { transform: scale(1.1); }
.db-act:active { transform: scale(.92); }
.db-act--edit   { background: #eff6ff; color: #2563eb; }
.db-act--pause  { background: #fef9c3; color: #a16207; }
.db-act--play   { background: #dcfce7; color: #16a34a; }
.db-act--delete { background: #fef2f2; color: #dc2626; }

/* ── Empty ── */
.db-empty {
  text-align: center; padding: 40px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.db-empty span { font-size: 36px; }
.db-empty p    { font-size: 14px; font-weight: 600; color: #888; }
.db-empty button {
  padding: 10px 20px; background: #e8630a; color: #fff;
  border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
}

/* ── Showing ── */
.db-showing { font-size: 12px; color: #bbb; text-align: center; padding-top: 8px; }

/* ── Chart ── */
.db-chart { padding: 8px 0 0; }
.db-chart-bars {
  display: flex; align-items: flex-end; gap: 6px; height: 100px; margin-bottom: 8px;
}
.db-bar-wrap {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  gap: 4px; height: 100%; justify-content: flex-end;
  cursor: default;
}
.db-bar { width: 100%; min-height: 4px; border-radius: 5px 5px 0 0; transition: height .5s ease; }
.db-bar-label { font-size: 9px; color: #aaa; font-weight: 600; }
.db-chart-legend {
  display: flex; justify-content: space-between;
  font-size: 11px; color: #aaa; padding-top: 4px;
}
.db-chart-empty {
  text-align: center; padding: 40px 20px; color: #bbb; font-size: 13px;
}

/* ── Top products ── */
.db-top-products { display: flex; flex-direction: column; gap: 0; }
.db-top-prod {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid #f5f3ef;
  cursor: pointer; transition: background .15s;
}
.db-top-prod:last-child { border-bottom: none; }
.db-top-prod:hover { background: #faf8f4; border-radius: 8px; padding-left: 8px; }
.db-top-rank  { font-size: 13px; font-weight: 900; color: #e8630a; width: 24px; text-align: center; flex-shrink: 0; }
.db-top-img   { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; background: #f5f3ef; flex-shrink: 0; }
.db-top-info  { flex: 1; min-width: 0; }
.db-top-title { font-size: 13px; font-weight: 600; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }
.db-top-stats { display: flex; gap: 10px; font-size: 11px; color: #aaa; align-items: center; }
.db-top-stats span { display: flex; align-items: center; gap: 3px; }
.db-top-price { font-size: 13px; font-weight: 800; color: #e8630a; flex-shrink: 0; }

/* ── Breakdown ── */
.db-breakdown { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.db-breakdown-item {
  border-radius: 12px; padding: 14px 8px; text-align: center;
  cursor: pointer; transition: transform .15s;
}
.db-breakdown-item:hover { transform: translateY(-2px); }
.db-breakdown-val   { font-size: 22px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
.db-breakdown-label { font-size: 11px; color: #888; font-weight: 600; }

/* ── Tips ── */
.db-tips-card { background: linear-gradient(135deg, #fff8f0, #fff); }
.db-tips { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.db-tip  { display: flex; align-items: flex-start; gap: 10px; }
.db-tip-ic { font-size: 17px; flex-shrink: 0; }
.db-tip span:last-child { font-size: 13px; color: #555; line-height: 1.4; }

/* ── Confirm dialog ── */
.db-confirm-overlay {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.db-confirm {
  background: #fff; border-radius: 16px;
  padding: 24px; max-width: 340px; width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
}
.db-confirm-msg     { font-size: 15px; font-weight: 600; color: #111; line-height: 1.5; margin-bottom: 20px; }
.db-confirm-actions { display: flex; gap: 10px; }
.db-confirm-cancel  {
  flex: 1; padding: 12px; background: #f5f3ef; border: none;
  border-radius: 10px; font-size: 14px; font-weight: 600; color: #555; cursor: pointer;
}
.db-confirm-ok      {
  flex: 1; padding: 12px; background: #dc2626; border: none;
  border-radius: 10px; font-size: 14px; font-weight: 700; color: #fff; cursor: pointer;
}

/* ── FAB ── */
.db-fab {
  position: fixed; bottom: 80px; right: 20px; z-index: 100;
  width: 52px; height: 52px; border-radius: 50%;
  background: #e8630a; color: #fff; border: none;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 20px rgba(232,99,10,.4); cursor: pointer;
  transition: transform .15s;
}
.db-fab:hover { transform: scale(1.08); }

/* ── Skeleton ── */
@keyframes db-shimmer {
  from { background-position: -400px 0; }
  to   { background-position:  400px 0; }
}
.db-sk {
  background: linear-gradient(90deg, #ede9e3 25%, #f5f3ef 50%, #ede9e3 75%);
  background-size: 400px 100%;
  animation: db-shimmer 1.4s infinite linear;
}
.db-sk.db-stat   { height: 80px; border-radius: 14px; }
.db-sk-list      { display: flex; flex-direction: column; gap: 8px; }
.db-sk-row       { height: 68px; border-radius: 10px; }
.db-sk-row       {
  background: linear-gradient(90deg, #ede9e3 25%, #f5f3ef 50%, #ede9e3 75%);
  background-size: 400px 100%;
  animation: db-shimmer 1.4s infinite linear;
}

/* ── Footer ── */
.db-footer { text-align: center; font-size: 11px; color: #ccc; padding: 8px 0; }

/* ── Responsive ── */
@media (max-width: 360px) {
  .db-stats-grid  { grid-template-columns: 1fr; }
  .db-quick       { grid-template-columns: repeat(2, 1fr); }
  .db-breakdown   { grid-template-columns: repeat(2, 1fr); }
  .db-score-row   { flex-direction: column; }
}
`;