/**
 * src/pages/Profile/Dashboard.jsx
 * Route: /dashboard
 */

import {
  useState,
  useEffect,
  useCallback,
  memo,
  useRef,
  useMemo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import "../../styles/Dashboard.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = () => ({
  Authorization: `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "m";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "k";
  return v.toLocaleString();
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60) return "just now";
  if (s < 3_600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
};

const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const PH = "https://placehold.co/56x56/f0ede8/b0a89e?text=?";

const getImg = (p) => {
  if (!p) return PH;
  return p.image || p.main_image || p.thumbnail_url ||
    (Array.isArray(p.images) && p.images[0]
      ? typeof p.images[0] === "string" ? p.images[0] : p.images[0]?.url
      : null) || PH;
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Ic = {
  Back: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Pause: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Play: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Chart: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Package: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8l-9-4-9 4v8l9 4 9-4z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Naira: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="15" x2="18" y2="15"/><line x1="6" y1="9" x2="18" y2="9"/><path d="M6 4l12 16M18 4L6 20"/></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Heart: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  Refresh: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M3 3v5h5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/><path d="M21 21v-5h-5"/></svg>,
  Store: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Search: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Clock: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Star: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="db-toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`db-toast db-toast--${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "info", ms = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), ms);
  }, []);
  return { toasts, show };
}

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
   BAR CHART
═══════════════════════════════════════════════════════════════ */
const BarChart = memo(({ data = [], color = "#e8630a" }) => {
  if (!data.length) return <div className="db-chart-empty">No chart data</div>;
  const max = Math.max(...data.map((d) => d.views || 0), 1);
  return (
    <div className="db-chart">
      <div className="db-chart-bars">
        {data.map((d, i) => (
          <div key={i} className="db-bar-wrap" title={`${d.label}\n${fmtNum(d.views)} views`}>
            <div className="db-bar" style={{ height: `${Math.max(3, ((d.views || 0) / max) * 100)}%`, background: color }} />
            <span className="db-bar-label">{d.label?.slice(0, 3)}</span>
          </div>
        ))}
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
  const r = 40, c = 2 * Math.PI * r;
  const cfg = score >= 80 ? { color: "#16a34a", label: "Excellent" }
            : score >= 60 ? { color: "#e8630a", label: "Good" }
            : score >= 40 ? { color: "#f59e0b", label: "Fair" }
            :               { color: "#dc2626", label: "Low" };
  return (
    <div className="db-score-wrap">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f0ede8" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={cfg.color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} className="db-score-circle" />
        <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="900" fill={cfg.color}>{score}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="9" fill="#aaa">/100</text>
      </svg>
      <p className="db-score-label" style={{ color: cfg.color }}>{cfg.label}</p>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   EXPIRY BADGE
═══════════════════════════════════════════════════════════════ */
const ExpiryBadge = memo(({ activeUntil, isPromoted }) => {
  const days = daysLeft(activeUntil);
  if (days === null) return null;
  if (days <= 0) return <span className="db-expiry db-expiry--expired">Expired</span>;
  if (days <= 3) return <span className="db-expiry db-expiry--critical">Expires in {days}d</span>;
  if (days <= 7) return <span className="db-expiry db-expiry--warn">Expires in {days}d</span>;
  if (isPromoted) return <span className="db-expiry db-expiry--promoted">⭐ {days}d left</span>;
  return <span className="db-expiry db-expiry--ok">{days}d left</span>;
});

/* ═══════════════════════════════════════════════════════════════
   STATUS BADGE
═══════════════════════════════════════════════════════════════ */
const StatusBadge = memo(({ status, isActive }) => {
  const label =
    isActive && (status === "active" || status === "active_limited") ? "Active"
    : status === "draft" ? "Draft"
    : status === "paused" ? "Paused"
    : status === "pending_payment" ? "Pending"
    : status || "Unknown";
  const cls = `db-status--${label.toLowerCase()}`;
  return <span className={`db-status ${cls}`}>{label}</span>;
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT ROW
═══════════════════════════════════════════════════════════════ */
const ProductRow = memo(function ProductRow({ product, onEdit, onDelete, onToggle, onRenew, onPromote, isDeleting }) {
  const img = getImg(product);
  const active = (product.status === "active" || product.status === "active_limited") && product.is_active !== false;
  const days = daysLeft(product.active_until);
  const expired = days !== null && days <= 0;

  return (
    <div className={`db-prod-row${isDeleting ? " db-prod-row--del" : ""}${expired ? " db-prod-row--expired" : ""}`}>
      <div className="db-prod-img">
        <img src={img} alt={product.title} onError={(e) => { e.currentTarget.src = PH; }} />
        {product.is_promoted && <span className="db-prod-promo">⭐</span>}
      </div>
      <div className="db-prod-info">
        <p className="db-prod-title">{product.title}</p>
        <div className="db-prod-meta">
          <span className="db-prod-price">{naira(product.price)}</span>
          <StatusBadge status={product.status} isActive={product.is_active} />
          {product.category_name && <span className="db-prod-cat">{product.category_name}</span>}
        </div>
        <div className="db-prod-expiry-row">
          <ExpiryBadge activeUntil={product.active_until} isPromoted={product.is_promoted} />
          {days !== null && days <= 7 && (
            <button className="db-renew-btn" onClick={() => onRenew(product)}>🔄 Renew Free</button>
          )}
        </div>
        <div className="db-prod-stats">
          <span title="Views"><Ic.Eye /> {fmtNum(product.views)}</span>
          <span title="Saves"><Ic.Heart /> {fmtNum(product.favorites_count)}</span>
          <span><Ic.Clock /> {timeAgo(product.created_at)}</span>
        </div>
      </div>
      <div className="db-prod-actions">
        <button className="db-act db-act--promote" onClick={() => onPromote(product)} title="Promote">⭐</button>
        <button className="db-act db-act--edit" onClick={() => onEdit(product)} title="Edit"><Ic.Edit /></button>
        <button className={`db-act ${active ? "db-act--pause" : "db-act--play"}`} onClick={() => onToggle(product)} title={active ? "Pause" : "Activate"}>
          {active ? <Ic.Pause /> : <Ic.Play />}
        </button>
        <button className="db-act db-act--delete" onClick={() => onDelete(product)} title="Delete"><Ic.Trash /></button>
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
          <button className="db-confirm-ok" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROMOTE MODAL
═══════════════════════════════════════════════════════════════ */
function PromoteModal({ product, plans, onClose }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePromote = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/payment/initiate`, {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({
          product_id: product.id,
          plan_id: selected.id,
          email: localStorage.getItem("user_email") || "",
        }),
      });
      const d = await res.json();
      if (res.ok && d.authorization_url) {
        window.location.href = d.authorization_url;
      } else {
        setError(d.message || "Could not initiate payment");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="db-confirm-overlay" onClick={onClose}>
      <div className="db-promote-modal" onClick={(e) => e.stopPropagation()}>
        <div className="db-promote-header">
          <h2>Promote Listing</h2>
          <button className="db-promote-close" onClick={onClose}>✕</button>
        </div>
        <p className="db-promote-product-name">"{product.title}"</p>
        <div className="db-promote-plans">
          {plans.map((plan) => {
            const price = Number(plan.effective_price || plan.price || 0);
            const isFree = price === 0;
            return (
              <div
                key={plan.id}
                className={`db-plan${selected?.id === plan.id ? " db-plan--selected" : ""}${isFree ? " db-plan--free" : ""}`}
                onClick={() => setSelected(plan)}
              >
                <div className="db-plan-header">
                  <span className="db-plan-name">{plan.name}</span>
                  <span className="db-plan-price">{isFree ? "FREE" : `₦${price.toLocaleString("en-NG")}`}</span>
                </div>
                <p className="db-plan-duration">{plan.duration}</p>
                <p className="db-plan-desc">{plan.description}</p>
                {plan.discount_percent > 0 && <span className="db-plan-discount">{plan.discount_percent}% OFF</span>}
                {Array.isArray(plan.features) && (
                  <ul className="db-plan-features">
                    {plan.features.map((f, i) => <li key={i}>✓ {f}</li>)}
                  </ul>
                )}
                {selected?.id === plan.id && <span className="db-plan-check">✓</span>}
              </div>
            );
          })}
        </div>
        {error && <p className="db-promote-error">⚠️ {error}</p>}
        <div className="db-promote-actions">
          <button className="db-confirm-cancel" onClick={onClose}>Cancel</button>
          <button className="db-promote-pay" onClick={handlePromote} disabled={!selected || loading}>
            {loading ? "Processing…" : selected
              ? Number(selected.effective_price || selected.price || 0) === 0
                ? "Activate Free Boost"
                : `Pay ₦${Number(selected.effective_price || selected.price || 0).toLocaleString("en-NG")}`
              : "Select a Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SKELETONS
═══════════════════════════════════════════════════════════════ */
function StatsSkeleton() {
  return (
    <div className="db-stats-grid">
      {[1, 2, 3, 4].map((i) => <div key={i} className="db-stat db-sk" />)}
    </div>
  );
}

function ProdSkeleton() {
  return (
    <div className="db-sk-list">
      {[1, 2, 3].map((i) => <div key={i} className="db-sk-row" />)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════ */
export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const { toasts, show: showToast } = useToast();

  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prodLoading, setProdLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [promoting, setPromoting] = useState(null);
  const [section, setSection] = useState("overview");
  const [greeting, setGreeting] = useState("Dashboard");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  const pendingDelete = useRef(null);
  const abortRef = useRef(null);
  const searchTimer = useRef(null);

  /* ── Greeting ── */
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/dashboard");
  }, [navigate]);

  /* ── Load plans ── */
  useEffect(() => {
    fetch(`${API}/payment/plans`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setPlans(d.plans || []); })
      .catch(() => {});
  }, []);

  /* ── Load stats ── */
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seller-dashboard/stats`, { headers: authH() });
      const d = await res.json();
      if (res.ok && d.success) setStats(d.stats);
    } catch (err) {
      console.error("[dashboard] loadStats:", err);
    }
  }, []);

  /* ── Load products (cursor-based) ── */
  const loadProducts = useCallback(async (currentTab = "all", cursor = null, searchQuery = "") => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (cursor) setLoadingMore(true);
    else setProdLoading(true);

    try {
      let url = `${API}/seller-dashboard/products?tab=${currentTab}&limit=20`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url, { headers: authH(), signal: abortRef.current.signal });
      const d = await res.json();

      if (!res.ok) {
        showToast(d.message || `Error ${res.status}`, "error");
        return;
      }

      const list = Array.isArray(d.products) ? d.products : [];

      if (cursor) {
        setProducts((prev) => [...prev, ...list]);
      } else {
        setProducts(list);
      }

      setHasMore(!!d.has_more);
      setNextCursor(d.next_cursor || null);
    } catch (err) {
      if (err.name === "AbortError") return;
      showToast("Failed to load listings.", "error");
    } finally {
      setProdLoading(false);
      setLoadingMore(false);
    }
  }, [showToast]);

  /* ── Load analytics ── */
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seller-dashboard/analytics?days=7`, { headers: authH() });
      const d = await res.json();
      if (res.ok && d.success) setAnalytics(d);
    } catch (err) {
      console.error("[dashboard] loadAnalytics:", err);
    }
  }, []);

  /* ── Bootstrap ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStats(), loadProducts("all"), loadAnalytics()]);
    } catch {
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [loadStats, loadProducts, loadAnalytics]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── Tab change ── */
  const handleTabChange = useCallback((newTab) => {
    setTab(newTab);
    setSearch("");
    setNextCursor(null);
    loadProducts(newTab);
  }, [loadProducts]);

  /* ── Search with debounce ── */
  const handleSearch = useCallback((value) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setNextCursor(null);
      loadProducts(tab, null, value);
    }, 400);
  }, [tab, loadProducts]);

  /* ── Load more (infinite scroll) ── */
  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return;
    loadProducts(tab, nextCursor, search);
  }, [hasMore, loadingMore, nextCursor, tab, search, loadProducts]);

  /* ── Delete ── */
  const handleDelete = useCallback((product) => {
    pendingDelete.current = product;
    setConfirm({ message: `Delete "${product.title}"? This cannot be undone.` });
  }, []);

  const confirmDelete = useCallback(async () => {
    const product = pendingDelete.current;
    if (!product) return;
    pendingDelete.current = null;
    setConfirm(null);
    setDeleting(product.id);

    setProducts((prev) => prev.filter((p) => p.id !== product.id));

    try {
      const res = await fetch(`${API}/seller-dashboard/products/${product.id}`, { method: "DELETE", headers: authH() });
      const d = await res.json();
      if (res.ok && d.success) {
        loadStats();
        showToast(`Deleted — recoverable for ${d.hold_days || 30} days`, "info", 5000);
      } else {
        setProducts((prev) => [product, ...prev]);
        showToast(d.message || "Could not delete.", "error");
      }
    } catch {
      setProducts((prev) => [product, ...prev]);
      showToast("Network error.", "error");
    } finally {
      setDeleting(null);
    }
  }, [loadStats, showToast]);

  /* ── Toggle ── */
  const handleToggle = useCallback(async (product) => {
    try {
      const res = await fetch(`${API}/seller-dashboard/products/${product.id}/toggle`, { method: "PATCH", headers: authH() });
      const d = await res.json();
      if (res.ok && d.success) {
        setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_active: d.is_active, status: d.status } : p));
        loadStats();
        showToast(d.is_active ? "Activated ✓" : "Paused", d.is_active ? "success" : "info");
      } else {
        showToast(d.message || "Could not update.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  }, [loadStats, showToast]);

  /* ── Renew ── */
  const handleRenew = useCallback(async (product) => {
    try {
      const res = await fetch(`${API}/seller-dashboard/products/${product.id}/renew`, { method: "POST", headers: authH() });
      const d = await res.json();
      if (res.ok && d.success) {
        setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, active_until: d.active_until, status: d.status, is_active: true } : p));
        loadStats();
        showToast(`Renewed for ${d.days_added} days ✓`, "success");
      } else {
        showToast(d.message || "Could not renew.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  }, [loadStats, showToast]);

  /* ── Edit ── */
  const handleEdit = useCallback((product) => {
    navigate(`/minimart/add?edit=${product.id}`);
  }, [navigate]);

  /* ── Promote ── */
  const handlePromote = useCallback((product) => {
    setPromoting(product);
  }, []);

  /* ── Tab counts ── */
  const tabCounts = useMemo(() => ({
    all: stats?.total_products ?? products.length,
    active: stats?.active ?? 0,
    draft: stats?.draft ?? 0,
    paused: stats?.paused ?? 0,
    pending: stats?.pending_payment ?? 0,
  }), [stats, products]);

  const BREAKDOWN_TAB = { Active: "active", Drafts: "draft", Paused: "paused", Pending: "pending" };

  const insights = useMemo(() => {
    if (!stats) return [];
    const list = [];
    if (tabCounts.active === 0) list.push({ icon: "⚠️", msg: "No active listings — create or activate one.", type: "warn" });
    if (tabCounts.draft > 0) list.push({ icon: "📝", msg: `${tabCounts.draft} draft${tabCounts.draft > 1 ? "s" : ""} — publish them.`, type: "info" });
    if (tabCounts.active >= 5) list.push({ icon: "🎉", msg: `${tabCounts.active} active listings — great!`, type: "good" });
    if ((stats.total_views || 0) > 100) list.push({ icon: "📈", msg: `${fmtNum(stats.total_views)} views — promote top listings!`, type: "good" });
    return list;
  }, [stats, tabCounts]);

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="db-page">

      {/* TOPBAR */}
      <div className="db-topbar">
        <button className="db-topbar-back" onClick={() => navigate(-1)}><Ic.Back /></button>
        <div className="db-topbar-mid">
          <p className="db-topbar-greet">{greeting} 👋</p>
          <h1 className="db-topbar-title">Seller Dashboard</h1>
        </div>
        <div className="db-topbar-right">
          <button className="db-topbar-btn" onClick={loadAll} title="Refresh"><Ic.Refresh /></button>
          <button className="db-topbar-btn" onClick={() => navigate("/notifications")}><Ic.Bell /></button>
        </div>
      </div>

      {/* NAV */}
      <div className="db-nav">
        {[
          { key: "overview", label: "Overview" },
          { key: "products", label: "Listings" },
          { key: "analytics", label: "Analytics" },
        ].map((n) => (
          <button key={n.key} className={`db-nav-btn${section === n.key ? " db-nav-btn--active" : ""}`} onClick={() => setSection(n.key)}>
            {n.label}
            {n.key === "products" && tabCounts.all > 0 && <span className="db-nav-count">{tabCounts.all}</span>}
          </button>
        ))}
      </div>

      <div className="db-scroll">
        {error && (
          <div className="db-error">
            <span>⚠️ {error}</span>
            <button onClick={loadAll}>Retry</button>
          </div>
        )}

        {/* ══ OVERVIEW ══ */}
        {section === "overview" && (
          <>
            <div className="db-quick">
              <button className="db-qa db-qa--primary" onClick={() => navigate("/minimart/add")}><Ic.Plus /> Add Listing</button>
              <button className="db-qa" onClick={() => setSection("products")}><Ic.Package /> Listings</button>
              <button className="db-qa" onClick={() => setSection("analytics")}><Ic.Chart /> Analytics</button>
              <Link className="db-qa" to={`/seller/${user?.id || ""}`}><Ic.Store /> Store</Link>
            </div>

            {loading ? <StatsSkeleton /> : stats ? (
              <div className="db-stats-grid">
                <StatCard icon={<Ic.Package />} label="Total Listings" value={fmtNum(stats.total_products)} sub={`${stats.active} active · ${stats.draft} draft`} color="#6366f1" />
                <StatCard icon={<Ic.Eye />} label="Total Views" value={fmtNum(stats.total_views)} sub={`${fmtNum(stats.total_clicks)} clicks`} color="#0891b2" />
                <StatCard icon={<Ic.Heart />} label="Saved" value={fmtNum(stats.total_favorites)} sub="by buyers" color="#ec4899" />
                <StatCard icon={<Ic.Naira />} label="Revenue" value={naira(stats.total_revenue)} sub={stats.rating > 0 ? `⭐ ${Number(stats.rating).toFixed(1)}` : "No sales"} color="#e8630a" />
              </div>
            ) : null}

            <div className="db-card">
              <div className="db-card-head"><h2 className="db-card-title">Performance Score</h2></div>
              <div className="db-score-row">
                <ScoreRing score={analytics?.seller_score || 0} />
                <div className="db-score-info">
                  <p className="db-score-desc">Based on engagement, response time, reviews and CTR.</p>
                  <div className="db-score-bars">
                    {[
                      { label: "Response", val: 60 },
                      { label: "Engagement", val: Math.min(100, (stats?.total_views || 0) / 10) },
                      { label: "Rating", val: ((stats?.rating || 0) / 5) * 100 },
                    ].map((b) => (
                      <div key={b.label} className="db-score-bar-row">
                        <span>{b.label}</span>
                        <div className="db-score-bar-track"><div className="db-score-bar-fill" style={{ width: `${Math.round(b.val)}%` }} /></div>
                        <span>{Math.round(b.val)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {insights.length > 0 && (
              <div className="db-card">
                <h2 className="db-card-title" style={{ marginBottom: 12 }}>💡 Insights</h2>
                <div className="db-insights">
                  {insights.map((ins, i) => (
                    <div key={i} className={`db-insight db-insight--${ins.type}`}><span>{ins.icon}</span><p>{ins.msg}</p></div>
                  ))}
                </div>
              </div>
            )}

            {!loading && products.length > 0 && (
              <div className="db-card">
                <div className="db-card-head">
                  <h2 className="db-card-title">Recent Listings</h2>
                  <button className="db-card-link" onClick={() => setSection("products")}>See all →</button>
                </div>
                {products.slice(0, 3).map((p) => (
                  <ProductRow key={p.id} product={p} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggle} onRenew={handleRenew} onPromote={handlePromote} isDeleting={deleting === p.id} />
                ))}
              </div>
            )}

            {!loading && products.length === 0 && (
              <div className="db-card">
                <div className="db-empty"><span>🛍️</span><p>No listings yet</p><button onClick={() => navigate("/minimart/add")}>Post your first listing →</button></div>
              </div>
            )}

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
                  <div key={i} className="db-tip"><span className="db-tip-ic">{t.i}</span><span>{t.t}</span></div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══ PRODUCTS ══ */}
        {section === "products" && (
          <div className="db-card">
            <div className="db-card-head">
              <h2 className="db-card-title">My Listings</h2>
              <button className="db-card-action" onClick={() => navigate("/minimart/add")}><Ic.Plus /> Add</button>
            </div>

            <div className="db-tabs">
              {[
                { key: "all", label: "All" },
                { key: "active", label: "Active" },
                { key: "draft", label: "Drafts" },
                { key: "paused", label: "Paused" },
                { key: "pending", label: "Pending" },
              ].map((t) => (
                <button key={t.key} className={`db-tab${tab === t.key ? " db-tab--active" : ""}`} onClick={() => handleTabChange(t.key)}>
                  {t.label}
                  <span className={`db-tab-count${tab === t.key ? " db-tab-count--active" : ""}`}>{tabCounts[t.key] ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="db-search-wrap">
              <span className="db-search-ic"><Ic.Search /></span>
              <input className="db-search" type="search" placeholder="Search listings…" value={search} onChange={(e) => handleSearch(e.target.value)} />
              {search && <button className="db-search-clr" onClick={() => handleSearch("")}>✕</button>}
            </div>

            {prodLoading && <ProdSkeleton />}

            {!prodLoading && products.length === 0 && (
              <div className="db-empty">
                <span>📭</span>
                <p>{search ? `No results for "${search}"` : `No ${tab === "all" ? "" : tab} listings`}</p>
                {tab === "all" && !search && <button onClick={() => navigate("/minimart/add")}>Post your first listing →</button>}
              </div>
            )}

            {!prodLoading && products.map((p) => (
              <ProductRow key={p.id} product={p} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggle} onRenew={handleRenew} onPromote={handlePromote} isDeleting={deleting === p.id} />
            ))}

            {/* Load more */}
            {!prodLoading && hasMore && (
              <div className="db-load-more">
                <button className="db-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              </div>
            )}

            {!prodLoading && products.length > 0 && (
              <p className="db-showing">Showing {products.length} listing{products.length !== 1 ? "s" : ""}{search ? ` matching "${search}"` : ""}</p>
            )}
          </div>
        )}

        {/* ══ ANALYTICS ══ */}
        {section === "analytics" && (
          <>
            <div className="db-card">
              <div className="db-card-head">
                <h2 className="db-card-title">📊 Performance Score</h2>
                <span className="db-card-sub">4 metrics</span>
              </div>
              <div className="db-score-row">
                <ScoreRing score={analytics?.seller_score || 0} />
                <div className="db-score-info">
                  <div className="db-score-bars">
                    {[
                      { label: "CTR", val: Math.min(100, ((stats?.total_clicks || 0) / Math.max(1, stats?.total_views || 1)) * 500) },
                      { label: "Engagement", val: Math.min(100, (stats?.total_views || 0) / 10) },
                      { label: "Rating", val: ((stats?.rating || 0) / 5) * 100 },
                      { label: "Response", val: 60 },
                    ].map((b) => (
                      <div key={b.label} className="db-score-bar-row">
                        <span>{b.label}</span>
                        <div className="db-score-bar-track"><div className="db-score-bar-fill" style={{ width: `${Math.round(b.val)}%` }} /></div>
                        <span>{Math.round(b.val)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {stats && (
              <div className="db-stats-grid">
                <StatCard icon={<Ic.Eye />} label="Views" value={fmtNum(stats.total_views)} color="#0891b2" />
                <StatCard icon={<Ic.Chart />} label="Clicks" value={fmtNum(stats.total_clicks)} color="#6366f1" />
                <StatCard icon={<Ic.Heart />} label="Saves" value={fmtNum(stats.total_favorites)} color="#ec4899" />
                <StatCard icon={<Ic.Package />} label="Active" value={fmtNum(stats.active)} color="#16a34a" />
              </div>
            )}

            <div className="db-card">
              <div className="db-card-head"><h2 className="db-card-title">📈 Views — Last 7 Days</h2></div>
              {loading ? <div className="db-chart-empty">Loading…</div> : <BarChart data={analytics?.daily || []} />}
            </div>

            {analytics?.top_products?.length > 0 && (
              <div className="db-card">
                <div className="db-card-head"><h2 className="db-card-title">🏆 Top Listings</h2></div>
                <div className="db-top-products">
                  {analytics.top_products.map((p, i) => (
                    <div key={p.id} className="db-top-prod" onClick={() => navigate(`/product/${p.slug || p.id}`)}>
                      <span className="db-top-rank">#{i + 1}</span>
                      <img src={p.image || PH} alt={p.title} className="db-top-img" onError={(e) => { e.currentTarget.src = PH; }} />
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

            {stats && (
              <div className="db-card">
                <h2 className="db-card-title" style={{ marginBottom: 14 }}>📦 Breakdown</h2>
                <div className="db-breakdown">
                  {[
                    { label: "Active", count: stats.active, color: "#16a34a", bg: "#dcfce7" },
                    { label: "Drafts", count: stats.draft, color: "#a16207", bg: "#fef9c3" },
                    { label: "Paused", count: stats.paused, color: "#6b7280", bg: "#f3f4f6" },
                    { label: "Pending", count: stats.pending_payment, color: "#2563eb", bg: "#eff6ff" },
                  ].map((b) => (
                    <div key={b.label} className="db-breakdown-item" style={{ background: b.bg }}
                      onClick={() => { setSection("products"); handleTabChange(BREAKDOWN_TAB[b.label] || "all"); }}>
                      <p className="db-breakdown-val" style={{ color: b.color }}>{b.count ?? 0}</p>
                      <p className="db-breakdown-label">{b.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!analytics && !loading && (
              <div className="db-card"><div className="db-empty"><span>📊</span><p>No analytics yet</p></div></div>
            )}
          </>
        )}

        <p className="db-footer">© {new Date().getFullYear()} Loemart Technologies</p>
      </div>

      {/* MODALS */}
      {confirm && (
        <ConfirmDialog message={confirm.message} onConfirm={confirmDelete}
          onCancel={() => { pendingDelete.current = null; setConfirm(null); }} />
      )}

      {promoting && (
        <PromoteModal product={promoting} plans={plans}
          onClose={() => setPromoting(null)} />
      )}

      <Toast toasts={toasts} />

      <button className="db-fab" onClick={() => navigate("/minimart/add")}><Ic.Plus /></button>
    </div>
  );
}