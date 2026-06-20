/**
 * src/pages/seller/SellerDashboard.jsx
 * Route: /seller/dashboard
 *
 * Professional seller dashboard with:
 * - Revenue + stats cards
 * - Sales chart (pure CSS bars)
 * - Product management table
 * - Recent orders
 * - Quick actions
 * - Performance insights
 */

import { useState, useEffect, useCallback, memo } from "react";
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

const PH = "https://placehold.co/48x48/f0ede8/b0a89e?text=?";

const getImg = (p) => {
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

/* ═══════════════════════════════════════════════════════════════
   ICONS (SVG — no external deps)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  Package  : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8l-9-4-9 4v8l9 4 9-4z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Eye      : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  TrendUp  : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Naira    : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="15" x2="18" y2="15"/><line x1="6" y1="9" x2="18" y2="9"/><path d="M6 4l12 16M18 4L6 20"/></svg>,
  Plus     : () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit     : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash    : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Pause    : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Play     : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Chart    : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Bell     : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Settings : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Back     : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  Store    : () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Heart    : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  Check    : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X        : () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   STAT CARD
═══════════════════════════════════════════════════════════════ */
const StatCard = memo(({ icon, label, value, sub, color, trend }) => (
  <div className="sd2-stat" style={{ "--accent": color }}>
    <div className="sd2-stat-icon">{icon}</div>
    <div className="sd2-stat-body">
      <p className="sd2-stat-val">{value}</p>
      <p className="sd2-stat-label">{label}</p>
      {sub && <p className="sd2-stat-sub">{sub}</p>}
    </div>
    {trend != null && (
      <div className={`sd2-trend${trend >= 0 ? " sd2-trend--up" : " sd2-trend--down"}`}>
        {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
      </div>
    )}
  </div>
));

/* ═══════════════════════════════════════════════════════════════
   MINI BAR CHART
═══════════════════════════════════════════════════════════════ */
const BarChart = memo(({ data = [] }) => {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="sd2-chart">
      <div className="sd2-chart-bars">
        {data.slice(-7).map((d, i) => {
          const pct = Math.max(4, (d.value / max) * 100);
          return (
            <div key={i} className="sd2-chart-bar-wrap" title={`${d.label || DAYS[i]}: ${naira(d.value)}`}>
              <div className="sd2-chart-bar" style={{ height: `${pct}%` }} />
              <span className="sd2-chart-day">{d.label || DAYS[i % 7]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT ROW
═══════════════════════════════════════════════════════════════ */
const ProductRow = memo(function ProductRow({ product, onEdit, onDelete, onToggle, deleting }) {
  const img    = getImg(product);
  const active = product.status === "active" && product.is_active !== false;

  return (
    <div className={`sd2-prod-row${deleting ? " sd2-prod-row--deleting" : ""}`}>
      <div className="sd2-prod-img-wrap">
        <img src={img} alt={product.title}
          onError={(e) => { e.currentTarget.src = PH; }} />
      </div>

      <div className="sd2-prod-info">
        <p className="sd2-prod-title">{product.title}</p>
        <div className="sd2-prod-meta">
          <span className="sd2-prod-price">{naira(product.price)}</span>
          <span className={`sd2-status sd2-status--${product.status}`}>
            {active ? "Active" : product.status}
          </span>
        </div>
        <div className="sd2-prod-nums">
          <span title="Views">👁 {fmtNum(product.views || 0)}</span>
          <span title="Clicks">🖱 {fmtNum(product.clicks_count || 0)}</span>
          <span title="Saves">♥ {fmtNum(product.favorites_count || 0)}</span>
          <span>{timeAgo(product.created_at)}</span>
        </div>
      </div>

      <div className="sd2-prod-actions">
        <button
          className="sd2-act sd2-act--edit"
          onClick={() => onEdit(product)}
          title="Edit"
        >
          <Icon.Edit />
        </button>
        <button
          className={`sd2-act ${active ? "sd2-act--pause" : "sd2-act--play"}`}
          onClick={() => onToggle(product)}
          title={active ? "Pause" : "Activate"}
        >
          {active ? <Icon.Pause /> : <Icon.Play />}
        </button>
        <button
          className="sd2-act sd2-act--delete"
          onClick={() => onDelete(product)}
          title="Delete"
        >
          <Icon.Trash />
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PERFORMANCE INSIGHT
═══════════════════════════════════════════════════════════════ */
const Insight = memo(({ icon, title, desc, type }) => (
  <div className={`sd2-insight sd2-insight--${type}`}>
    <span className="sd2-insight-icon">{icon}</span>
    <div>
      <p className="sd2-insight-title">{title}</p>
      <p className="sd2-insight-desc">{desc}</p>
    </div>
  </div>
));

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SellerDashboard({ user }) {
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────
  const [stats,    setStats]    = useState(null);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [tab,      setTab]      = useState("all");
  const [deleting, setDeleting] = useState(null);
  const [search,   setSearch]   = useState("");
  const [greeting, setGreeting] = useState("Dashboard");

  // ── Greeting ──────────────────────────────────────────────
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  // ── Auth check ────────────────────────────────────────────
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/seller/dashboard");
  }, [navigate]);

  // ── Load data ─────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, prodsRes] = await Promise.all([
        fetch(`${API}/seller-dashboard/stats`,    { headers: authH() }),
        fetch(`${API}/seller-dashboard/products`, { headers: authH() }),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.stats || d);
      }

      if (prodsRes.ok) {
        const d = await prodsRes.json();
        const prods = Array.isArray(d)           ? d :
                      Array.isArray(d.products)  ? d.products : [];
        setProducts(prods);
      }
    } catch (err) {
      setError("Failed to load dashboard.");
      console.error("[SellerDashboard]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = useCallback(async (product) => {
    if (!window.confirm(`Delete "${product.title}"? This cannot be undone.`)) return;
    setDeleting(product.id);
    try {
      const res = await fetch(
        `${API}/seller-dashboard/products/${product.id}`,
        { method: "DELETE", headers: authH() }
      );
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
      } else {
        alert("Could not delete. Please try again.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setDeleting(null);
    }
  }, []);

  // ── Toggle active ─────────────────────────────────────────
  const handleToggle = useCallback(async (product) => {
    try {
      const res = await fetch(
        `${API}/seller-dashboard/products/${product.id}/toggle`,
        { method: "PATCH", headers: authH() }
      );
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id
              ? {
                  ...p,
                  is_active : !p.is_active,
                  status    : (!p.is_active) ? "active" : "paused",
                }
              : p
          )
        );
      }
    } catch {}
  }, []);

  // ── Edit ──────────────────────────────────────────────────
  const handleEdit = useCallback((product) => {
    navigate(`/minimart/add?edit=${product.id}`);
  }, [navigate]);

  // ── Filtered + searched products ─────────────────────────
  const filtered = products.filter((p) => {
    const matchTab =
      tab === "all"    ? true :
      tab === "active" ? (p.status === "active" && p.is_active !== false) :
      tab === "draft"  ? p.status === "draft" :
      tab === "paused" ? (!p.is_active && p.status !== "draft") :
      true;

    const matchSearch = !search ||
      (p.title || "").toLowerCase().includes(search.toLowerCase());

    return matchTab && matchSearch;
  });

  // ── Tab counts ────────────────────────────────────────────
  const tabCounts = {
    all    : products.length,
    active : products.filter((p) => p.status === "active" && p.is_active !== false).length,
    draft  : products.filter((p) => p.status === "draft").length,
    paused : products.filter((p) => !p.is_active && p.status !== "draft").length,
  };

  // ── Generate insights ─────────────────────────────────────
  const insights = [];
  if (stats) {
    const active = tabCounts.active;
    const total  = products.length;
    if (total > 0 && active === 0) {
      insights.push({ icon: "⚠️", title: "No active listings", desc: "Activate at least one listing to get sales.", type: "warn" });
    }
    if (active > 0 && (stats.total_views || 0) === 0) {
      insights.push({ icon: "📣", title: "Boost your listings", desc: "Add featured promotion to increase visibility.", type: "info" });
    }
    if (active >= 5) {
      insights.push({ icon: "🎉", title: "Great momentum!", desc: `You have ${active} active listings — keep it up!`, type: "good" });
    }
    if (tabCounts.draft > 0) {
      insights.push({ icon: "📝", title: `${tabCounts.draft} draft${tabCounts.draft > 1 ? "s" : ""}`, desc: "Complete and publish your drafts to get more sales.", type: "warn" });
    }
  }

  // ── Build chart data from stats ───────────────────────────
  const chartData = (stats?.dailySales || stats?.daily_sales || []).map((d) => ({
    label : d.date ? new Date(d.date).toLocaleDateString("en-NG", { weekday: "short" }) : "",
    value : Number(d.amount || d.total || 0),
  }));

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="sd2-page">

      {/* ── Topbar ── */}
      <div className="sd2-topbar">
        <button className="sd2-topbar-back" onClick={() => navigate(-1)} aria-label="Back">
          <Icon.Back />
        </button>
        <div className="sd2-topbar-center">
          <p className="sd2-topbar-greeting">{greeting}</p>
          <h1 className="sd2-topbar-title">Seller Dashboard</h1>
        </div>
        <div className="sd2-topbar-actions">
          <button
            className="sd2-topbar-btn"
            onClick={() => navigate("/notifications")}
            aria-label="Notifications"
          >
            <Icon.Bell />
          </button>
          <button
            className="sd2-topbar-btn"
            onClick={() => navigate("/seller/settings")}
            aria-label="Settings"
          >
            <Icon.Settings />
          </button>
        </div>
      </div>

      <div className="sd2-scroll">

        {/* ── Error ── */}
        {error && (
          <div className="sd2-error">
            <p>⚠️ {error}</p>
            <button onClick={loadDashboard}>Retry</button>
          </div>
        )}

        {/* ── Quick actions ── */}
        <div className="sd2-quick-actions">
          <button className="sd2-qa sd2-qa--primary" onClick={() => navigate("/minimart/add")}>
            <Icon.Plus />
            <span>Add Listing</span>
          </button>
          <button className="sd2-qa" onClick={() => navigate("/seller/dashboard")}>
            <Icon.Chart />
            <span>Analytics</span>
          </button>
          <button className="sd2-qa" onClick={() => navigate("/conversations")}>
            <span style={{ fontSize: 16 }}>💬</span>
            <span>Messages</span>
          </button>
          <Link className="sd2-qa" to={`/seller/${user?.id || ""}`}>
            <Icon.Store />
            <span>My Store</span>
          </Link>
        </div>

        {/* ══════════════════════════════════════════════
            STATS CARDS
        ══════════════════════════════════════════════ */}
        {loading ? (
          <div className="sd2-stats-grid">
            {[1,2,3,4].map((i) => (
              <div key={i} className="sd2-stat sd2-sk" />
            ))}
          </div>
        ) : stats ? (
          <div className="sd2-stats-grid">
            <StatCard
              icon={<Icon.Naira />}
              label="Total Revenue"
              value={naira(stats.total_revenue ?? stats.totalRevenue ?? 0)}
              sub={stats.revenue_today ? `+${naira(stats.revenue_today)} today` : null}
              color="#e8630a"
              trend={stats.revenue_trend ?? null}
            />
            <StatCard
              icon={<Icon.Package />}
              label="Total Listings"
              value={fmtNum(stats.total_products ?? stats.totalProducts ?? products.length)}
              sub={`${tabCounts.active} active`}
              color="#6366f1"
            />
            <StatCard
              icon={<Icon.Eye />}
              label="Total Views"
              value={fmtNum(stats.total_views ?? stats.totalViews ?? 0)}
              sub={stats.views_today ? `+${fmtNum(stats.views_today)} today` : null}
              color="#0891b2"
              trend={stats.views_trend ?? null}
            />
            <StatCard
              icon={<Icon.TrendUp />}
              label="Total Clicks"
              value={fmtNum(stats.total_clicks ?? stats.totalClicks ?? 0)}
              sub={stats.ctr ? `${(stats.ctr * 100).toFixed(1)}% CTR` : null}
              color="#16a34a"
              trend={stats.clicks_trend ?? null}
            />
          </div>
        ) : null}

        {/* ══════════════════════════════════════════════
            SALES CHART
        ══════════════════════════════════════════════ */}
        {!loading && chartData.length > 0 && (
          <div className="sd2-card">
            <div className="sd2-card-head">
              <h2 className="sd2-card-title">📈 Sales (Last 7 days)</h2>
              <span className="sd2-card-sub">
                Total: {naira(chartData.reduce((s, d) => s + d.value, 0))}
              </span>
            </div>
            <BarChart data={chartData} />
          </div>
        )}

        {/* ══════════════════════════════════════════════
            PERFORMANCE INSIGHTS
        ══════════════════════════════════════════════ */}
        {!loading && insights.length > 0 && (
          <div className="sd2-card">
            <h2 className="sd2-card-title" style={{ marginBottom: 12 }}>
              💡 Insights
            </h2>
            <div className="sd2-insights-list">
              {insights.map((ins, i) => (
                <Insight key={i} {...ins} />
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            PRODUCTS TABLE
        ══════════════════════════════════════════════ */}
        <div className="sd2-card">

          {/* Card header */}
          <div className="sd2-card-head">
            <h2 className="sd2-card-title">📦 My Listings</h2>
            <Link to="/minimart/add" className="sd2-card-action">
              <Icon.Plus /> Add
            </Link>
          </div>

          {/* Tabs */}
          <div className="sd2-tabs">
            {[
              { key: "all",    label: "All"    },
              { key: "active", label: "Active" },
              { key: "draft",  label: "Drafts" },
              { key: "paused", label: "Paused" },
            ].map((t) => (
              <button
                key={t.key}
                className={`sd2-tab${tab === t.key ? " sd2-tab--active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <span className="sd2-tab-count">{tabCounts[t.key]}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="sd2-search-wrap">
            <span className="sd2-search-icon">🔍</span>
            <input
              className="sd2-search"
              type="search"
              placeholder="Search listings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="sd2-search-clear" onClick={() => setSearch("")}>✕</button>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="sd2-sk-list">
              {[1,2,3].map((i) => <div key={i} className="sd2-sk-row" />)}
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <div className="sd2-empty">
              <span>📭</span>
              <p>{search ? `No results for "${search}"` : `No ${tab === "all" ? "" : tab} listings`}</p>
              {tab === "all" && !search && (
                <button onClick={() => navigate("/minimart/add")}>
                  Post your first listing →
                </button>
              )}
            </div>
          )}

          {/* Product list */}
          {!loading && filtered.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
              deleting={deleting === p.id}
            />
          ))}

          {/* Load more */}
          {!loading && filtered.length > 0 && (
            <div className="sd2-load-more-wrap">
              <p className="sd2-showing">
                Showing {filtered.length} of {tabCounts[tab]} listings
              </p>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            TIPS CARD
        ══════════════════════════════════════════════ */}
        <div className="sd2-card sd2-tips-card">
          <h2 className="sd2-card-title">🚀 Grow Your Sales</h2>
          <div className="sd2-tips">
            {[
              { icon: "📸", tip: "Add 3–6 high-quality photos per listing" },
              { icon: "✍️", tip: "Write detailed, keyword-rich descriptions" },
              { icon: "💰", tip: "Price competitively — check similar listings" },
              { icon: "⭐", tip: "Enable promotions for more visibility" },
              { icon: "💬", tip: "Reply to messages within 1 hour" },
              { icon: "📍", tip: "Add your exact location for nearby buyers" },
            ].map((t, i) => (
              <div key={i} className="sd2-tip">
                <span className="sd2-tip-icon">{t.icon}</span>
                <span className="sd2-tip-text">{t.tip}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="sd2-footer">© {new Date().getFullYear()} Loemart Technologies</p>

      </div>

      {/* ── Styles ── */}
      <style>{SD2_STYLES}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const SD2_STYLES = `

/* ── Page ── */
.sd2-page {
  max-width: 680px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f7f4ef;
  font-family: 'DM Sans', system-ui, sans-serif;
}

/* ── Topbar ── */
.sd2-topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(247,244,239,.96);
  border-bottom: 1px solid #ede9e3;
  backdrop-filter: blur(12px);
}
.sd2-topbar-back {
  width: 38px; height: 38px;
  border-radius: 50%;
  border: 1.5px solid #e0d8cc;
  background: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #333; flex-shrink: 0;
  transition: border-color .15s;
}
.sd2-topbar-back:hover { border-color: #e8630a; color: #e8630a; }
.sd2-topbar-center { flex: 1; }
.sd2-topbar-greeting { font-size: 11px; color: #aaa; margin: 0; }
.sd2-topbar-title   { font-size: 17px; font-weight: 800; color: #111; margin: 0; }
.sd2-topbar-actions { display: flex; gap: 8px; }
.sd2-topbar-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 1.5px solid #e0d8cc;
  background: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #555;
  transition: all .15s;
}
.sd2-topbar-btn:hover { border-color: #e8630a; color: #e8630a; }

/* ── Scroll area ── */
.sd2-scroll { padding: 16px 16px 80px; display: flex; flex-direction: column; gap: 14px; }

/* ── Error ── */
.sd2-error {
  padding: 14px 16px;
  background: #fef2f2; border: 1px solid #fecaca;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; color: #dc2626;
}
.sd2-error button {
  padding: 6px 14px; background: #dc2626; color: #fff;
  border: none; border-radius: 6px; font-size: 12px; cursor: pointer;
}

/* ── Quick actions ── */
.sd2-quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.sd2-qa {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 6px;
  padding: 14px 8px;
  background: #fff;
  border: 1.5px solid #ede9e3;
  border-radius: 14px;
  font-size: 12px; font-weight: 600; color: #555;
  cursor: pointer;
  transition: all .15s;
  text-decoration: none;
}
.sd2-qa:hover { border-color: #e8630a; color: #e8630a; transform: translateY(-2px); }
.sd2-qa--primary { background: #e8630a; color: #fff; border-color: #e8630a; }
.sd2-qa--primary:hover { background: #d55a08; color: #fff; }

/* ── Stats grid ── */
.sd2-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.sd2-stat {
  background: #fff;
  border: 1px solid #ede9e3;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
}
.sd2-stat::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 4px; height: 100%;
  background: var(--accent, #e8630a);
  border-radius: 0 2px 2px 0;
}
.sd2-stat-icon {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent, #e8630a) 12%, white);
  color: var(--accent, #e8630a);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.sd2-stat-body { flex: 1; min-width: 0; }
.sd2-stat-val  { font-size: 20px; font-weight: 900; color: #111; line-height: 1; margin-bottom: 3px; }
.sd2-stat-label{ font-size: 11px; color: #aaa; font-weight: 500; }
.sd2-stat-sub  { font-size: 10px; color: var(--accent, #e8630a); margin-top: 3px; font-weight: 600; }

.sd2-trend {
  position: absolute;
  top: 12px; right: 12px;
  font-size: 10px; font-weight: 800;
  padding: 2px 6px; border-radius: 20px;
}
.sd2-trend--up   { background: #dcfce7; color: #16a34a; }
.sd2-trend--down { background: #fee2e2; color: #dc2626; }

/* ── Card ── */
.sd2-card {
  background: #fff;
  border: 1px solid #ede9e3;
  border-radius: 16px;
  padding: 18px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
}
.sd2-card-head {
  display: flex; align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.sd2-card-title {
  font-size: 15px; font-weight: 800; color: #111; margin: 0;
}
.sd2-card-sub { font-size: 12px; color: #aaa; }
.sd2-card-action {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 14px;
  background: #e8630a; color: #fff;
  border-radius: 20px; font-size: 12px; font-weight: 700;
  text-decoration: none; border: none; cursor: pointer;
  transition: opacity .15s;
}
.sd2-card-action:hover { opacity: .88; }

/* ── Bar chart ── */
.sd2-chart { padding: 8px 0; }
.sd2-chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 100px;
}
.sd2-chart-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
  justify-content: flex-end;
}
.sd2-chart-bar {
  width: 100%;
  background: linear-gradient(180deg, #e8630a, #ff8a4a);
  border-radius: 6px 6px 0 0;
  min-height: 4px;
  transition: height .4s ease;
}
.sd2-chart-day { font-size: 9px; color: #aaa; font-weight: 600; }

/* ── Insights ── */
.sd2-insights-list { display: flex; flex-direction: column; gap: 8px; }
.sd2-insight {
  display: flex; align-items: flex-start;
  gap: 10px; padding: 12px 14px;
  border-radius: 12px;
}
.sd2-insight--good { background: #f0fdf4; border: 1px solid #bbf7d0; }
.sd2-insight--warn { background: #fffbeb; border: 1px solid #fde68a; }
.sd2-insight--info { background: #eff6ff; border: 1px solid #bfdbfe; }
.sd2-insight-icon  { font-size: 18px; flex-shrink: 0; }
.sd2-insight-title { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 2px; }
.sd2-insight-desc  { font-size: 12px; color: #666; line-height: 1.4; }

/* ── Tabs ── */
.sd2-tabs {
  display: flex; gap: 4px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ede9e3;
  margin-bottom: 10px;
  overflow-x: auto; scrollbar-width: none;
}
.sd2-tabs::-webkit-scrollbar { display: none; }
.sd2-tab {
  padding: 7px 12px;
  border: none; background: none;
  font-size: 13px; font-weight: 600; color: #aaa;
  cursor: pointer;
  border-bottom: 2.5px solid transparent;
  white-space: nowrap;
  display: flex; align-items: center; gap: 5px;
  transition: color .15s;
}
.sd2-tab--active { color: #111; border-bottom-color: #e8630a; }
.sd2-tab-count {
  background: #f5f3ef; color: #888;
  font-size: 10px; font-weight: 700;
  padding: 1px 6px; border-radius: 20px;
}
.sd2-tab--active .sd2-tab-count { background: #fff0e6; color: #e8630a; }

/* ── Search ── */
.sd2-search-wrap {
  position: relative;
  margin-bottom: 10px;
}
.sd2-search-icon {
  position: absolute; left: 12px; top: 50%;
  transform: translateY(-50%);
  font-size: 13px; pointer-events: none;
}
.sd2-search {
  width: 100%; padding: 10px 36px 10px 34px;
  border: 1.5px solid #ede9e3; border-radius: 10px;
  font-size: 13px; background: #faf8f4;
  box-sizing: border-box; outline: none;
  font-family: inherit;
  transition: border-color .15s;
}
.sd2-search:focus { border-color: #e8630a; background: #fff; }
.sd2-search-clear {
  position: absolute; right: 10px; top: 50%;
  transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: #aaa; font-size: 12px;
}

/* ── Product row ── */
.sd2-prod-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f3ef;
  transition: opacity .3s;
}
.sd2-prod-row:last-of-type { border-bottom: none; }
.sd2-prod-row--deleting    { opacity: .4; pointer-events: none; }

.sd2-prod-img-wrap {
  width: 56px; height: 56px;
  border-radius: 10px;
  overflow: hidden; flex-shrink: 0;
  background: #f5f3ef;
  border: 1px solid #ede9e3;
}
.sd2-prod-img-wrap img {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}

.sd2-prod-info { flex: 1; min-width: 0; }
.sd2-prod-title {
  font-size: 13px; font-weight: 600; color: #222;
  line-height: 1.3; margin-bottom: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sd2-prod-meta {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
}
.sd2-prod-price { font-size: 14px; font-weight: 800; color: #e8630a; }

.sd2-status {
  font-size: 10px; font-weight: 700;
  padding: 2px 7px; border-radius: 20px;
  text-transform: capitalize;
}
.sd2-status--active  { background: #dcfce7; color: #16a34a; }
.sd2-status--draft   { background: #f5f5f5; color: #888; }
.sd2-status--paused  { background: #fef9c3; color: #a16207; }
.sd2-status--pending { background: #eff6ff; color: #2563eb; }

.sd2-prod-nums {
  display: flex; gap: 8px;
  font-size: 11px; color: #bbb;
}

.sd2-prod-actions {
  display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
}
.sd2-act {
  width: 30px; height: 30px;
  border-radius: 8px; border: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.sd2-act:hover    { transform: scale(1.1); }
.sd2-act:active   { transform: scale(.92); }
.sd2-act--edit    { background: #eff6ff; color: #2563eb; }
.sd2-act--pause   { background: #fef9c3; color: #a16207; }
.sd2-act--play    { background: #dcfce7; color: #16a34a; }
.sd2-act--delete  { background: #fef2f2; color: #dc2626; }

/* ── Empty ── */
.sd2-empty {
  text-align: center; padding: 40px 20px;
  display: flex; flex-direction: column;
  align-items: center; gap: 10px;
}
.sd2-empty span { font-size: 40px; }
.sd2-empty p    { font-size: 14px; font-weight: 600; color: #888; }
.sd2-empty button {
  padding: 10px 20px; background: #e8630a; color: #fff;
  border: none; border-radius: 8px; font-size: 13px;
  font-weight: 600; cursor: pointer;
}

/* ── Showing ── */
.sd2-load-more-wrap { padding-top: 10px; border-top: 1px solid #f5f3ef; }
.sd2-showing { font-size: 12px; color: #bbb; text-align: center; }

/* ── Tips card ── */
.sd2-tips-card { background: linear-gradient(135deg, #fff8f0, #fff); }
.sd2-tips { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.sd2-tip  { display: flex; align-items: center; gap: 10px; }
.sd2-tip-icon { font-size: 18px; flex-shrink: 0; }
.sd2-tip-text { font-size: 13px; color: #555; line-height: 1.4; }

/* ── Skeleton ── */
@keyframes sd2-shimmer {
  from { background-position: -400px 0; }
  to   { background-position:  400px 0; }
}
.sd2-sk {
  background: linear-gradient(90deg, #ede9e3 25%, #f5f3ef 50%, #ede9e3 75%);
  background-size: 400px 100%;
  animation: sd2-shimmer 1.4s infinite linear;
  border-radius: 16px;
}
.sd2-sk.sd2-stat { height: 90px; }
.sd2-sk-list { display: flex; flex-direction: column; gap: 10px; padding: 10px 0; }
.sd2-sk-row  {
  height: 68px; border-radius: 10px;
  background: linear-gradient(90deg, #ede9e3 25%, #f5f3ef 50%, #ede9e3 75%);
  background-size: 400px 100%;
  animation: sd2-shimmer 1.4s infinite linear;
}

/* ── Footer ── */
.sd2-footer {
  text-align: center; font-size: 11px; color: #ccc; padding: 8px 0;
}

/* Responsive */
@media (max-width: 360px) {
  .sd2-stats-grid    { grid-template-columns: 1fr; }
  .sd2-quick-actions { grid-template-columns: repeat(2, 1fr); }
  .sd2-stat-val      { font-size: 17px; }
}
`;