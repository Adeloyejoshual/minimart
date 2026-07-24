// src/pages/Profile/Dashboard.jsx
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Component,
} from "react";
import { useNavigate, Link } from "react-router-dom";

import { API, authH, getToken } from "./components/helpers";
import { useToast } from "./components/useToast";
import { Ic } from "./components/icons";

import Overview      from "./components/Overview";
import Listings      from "./components/Listings";
import Analytics     from "./components/Analytics";
import ConfirmDialog from "./components/ConfirmDialog";
import PromoteModal  from "./components/PromoteModal";
import Toast         from "./components/Toast";

import "../../styles/Dashboard.css";

/* ─────────────────────────────────────────────
   SectionErrorBoundary
   Catches render crashes inside any section and
   shows the REAL error instead of a blank screen.
───────────────────────────────────────────── */
class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(
      `[Dashboard:${this.props.section}] RENDER CRASH:`,
      error,
      info
    );
    this.setState({ info });
  }

  render() {
    const { error, info } = this.state;

    if (error) {
      return (
        <div
          style={{
            margin       : "24px 16px",
            padding      : "20px",
            border       : "1.5px solid #f87171",
            borderRadius : "12px",
            background   : "#fff1f1",
            fontFamily   : "monospace",
          }}
        >
          {/* Title */}
          <div
            style={{
              display    : "flex",
              alignItems : "center",
              gap        : "8px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: 20 }}>⚠️</span>
            <strong style={{ color: "#991b1b", fontSize: 14 }}>
              Render error in{" "}
              <code
                style={{
                  background   : "#fee2e2",
                  padding      : "2px 6px",
                  borderRadius : 4,
                }}
              >
                {this.props.section ?? "unknown section"}
              </code>
            </strong>
          </div>

          {/* Error message */}
          <div
            style={{
              background   : "#fef2f2",
              border       : "1px solid #fca5a5",
              borderRadius : "8px",
              padding      : "12px",
              marginBottom : "10px",
            }}
          >
            <div
              style={{
                fontSize     : 11,
                color        : "#6b7280",
                marginBottom : 4,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Error Message
            </div>
            <pre
              style={{
                margin    : 0,
                fontSize  : 13,
                color     : "#7f1d1d",
                whiteSpace: "pre-wrap",
                wordBreak : "break-all",
              }}
            >
              {error?.message ?? String(error)}
            </pre>
          </div>

          {/* Stack trace */}
          {error?.stack && (
            <details style={{ marginBottom: "10px" }}>
              <summary
                style={{
                  cursor  : "pointer",
                  fontSize: 12,
                  color   : "#9ca3af",
                  padding : "4px 0",
                }}
              >
                Stack trace
              </summary>
              <pre
                style={{
                  marginTop : "8px",
                  padding   : "10px",
                  background: "#f9fafb",
                  borderRadius: "6px",
                  fontSize  : 10,
                  color     : "#374151",
                  whiteSpace: "pre-wrap",
                  wordBreak : "break-all",
                  maxHeight : "200px",
                  overflowY : "auto",
                }}
              >
                {error.stack}
              </pre>
            </details>
          )}

          {/* Component stack */}
          {info?.componentStack && (
            <details style={{ marginBottom: "14px" }}>
              <summary
                style={{
                  cursor  : "pointer",
                  fontSize: 12,
                  color   : "#9ca3af",
                  padding : "4px 0",
                }}
              >
                Component tree
              </summary>
              <pre
                style={{
                  marginTop : "8px",
                  padding   : "10px",
                  background: "#f9fafb",
                  borderRadius: "6px",
                  fontSize  : 10,
                  color     : "#374151",
                  whiteSpace: "pre-wrap",
                  wordBreak : "break-all",
                  maxHeight : "200px",
                  overflowY : "auto",
                }}
              >
                {info.componentStack}
              </pre>
            </details>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              style={{
                padding      : "8px 16px",
                background   : "#ef4444",
                color        : "#fff",
                border       : "none",
                borderRadius : "8px",
                cursor       : "pointer",
                fontSize     : 13,
                fontWeight   : 600,
              }}
              onClick={() => this.setState({ error: null, info: null })}
            >
              Try Again
            </button>
            <button
              style={{
                padding      : "8px 16px",
                background   : "transparent",
                color        : "#6b7280",
                border       : "1px solid #d1d5db",
                borderRadius : "8px",
                cursor       : "pointer",
                fontSize     : 13,
              }}
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
            <button
              style={{
                padding      : "8px 16px",
                background   : "transparent",
                color        : "#6b7280",
                border       : "1px solid #d1d5db",
                borderRadius : "8px",
                cursor       : "pointer",
                fontSize     : 13,
              }}
              onClick={() => {
                const text =
                  `Section: ${this.props.section}\n` +
                  `Error: ${error?.message}\n\n` +
                  `Stack:\n${error?.stack}\n\n` +
                  `Component tree:\n${info?.componentStack}`;
                navigator.clipboard?.writeText(text);
              }}
            >
              Copy Error
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const NAV_ITEMS = [
  { key: "overview",  label: "Overview",  icon: "Chart"   },
  { key: "products",  label: "Listings",  icon: "Package" },
  { key: "analytics", label: "Analytics", icon: "TrendUp" },
];

const GREETING = (() => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
})();

/* ─────────────────────────────────────────────
   Helper — resolve user email from any storage
───────────────────────────────────────────── */
const resolveEmail = (propEmail) => {
  if (propEmail && propEmail.includes("@")) return propEmail;

  const plainKeys = ["user_email", "userEmail", "email", "marketplace_email"];
  for (const key of plainKeys) {
    const val = localStorage.getItem(key);
    if (val && val.includes("@")) return val;
  }

  const jsonKeys = ["user", "userData", "marketplace_user", "auth_user", "currentUser"];
  for (const key of jsonKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const email  = parsed?.email || parsed?.user?.email;
      if (email && email.includes("@")) return email;
    } catch { /* skip */ }
  }

  return "";
};

/* ─────────────────────────────────────────────
   useDashboard — all data & mutations
───────────────────────────────────────────── */
function useDashboard(showToast, userEmail, navigate) {

  /* ── data ── */
  const [stats,        setStats]        = useState(null);
  const [products,     setProducts]     = useState([]);
  const [analytics,    setAnalytics]    = useState(null);
  const [plans,        setPlans]        = useState([]);
  const [tier,         setTier]         = useState("unverified");
  const [isSubscriber, setIsSubscriber] = useState(false);

  /* ── ui state ── */
  const [loading,     setLoading]     = useState(true);
  const [prodLoading, setProdLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  const [verifying,   setVerifying]   = useState(null);
  const [renewing,    setRenewing]    = useState(null);

  /* ── filters / pagination ── */
  const [tab,        setTab]        = useState("all");
  const [search,     setSearch]     = useState("");
  const [hasMore,    setHasMore]    = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  /* ── refs ── */
  const abortRef       = useRef(null);
  const searchTimer    = useRef(null);
  const pendingDelete  = useRef(null);
  const pendingUpgrade = useRef(null);

  /* ── fetchers ── */
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seller-dashboard/overview`, {
        headers: authH(),
      });
      const d = await res.json();
      if (res.ok && d.success && d.data) {
        setTier(d.data.tier ?? "unverified");
        setIsSubscriber(d.data.is_subscriber ?? false);
        if (d.data.stats) setStats(d.data.stats);
      }
    } catch (err) {
      console.error("[dashboard] fetchOverview:", err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seller-dashboard/stats`, {
        headers: authH(),
      });
      const d = await res.json();
      if (res.ok && d.success) setStats(d.stats);
    } catch (err) {
      console.error("[dashboard] fetchStats:", err);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/seller-dashboard/analytics?days=7`,
        { headers: authH() }
      );
      const d = await res.json();
      if (res.ok && d.success) setAnalytics(d);
    } catch (err) {
      console.error("[dashboard] fetchAnalytics:", err);
    }
  }, []);

  const fetchProducts = useCallback(
    async (currentTab = "all", cursor = null, query = "") => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      cursor ? setLoadingMore(true) : setProdLoading(true);

      try {
        const params = new URLSearchParams({ tab: currentTab, limit: 20 });
        if (cursor) params.set("cursor", cursor);
        if (query)  params.set("search", query);

        const res = await fetch(
          `${API}/seller-dashboard/products?${params}`,
          { headers: authH(), signal: abortRef.current.signal }
        );
        const d = await res.json();

        if (!res.ok) {
          showToast(d.message || `Error ${res.status}`, "error");
          return;
        }

        const list = Array.isArray(d.products) ? d.products : [];
        setProducts((prev) => (cursor ? [...prev, ...list] : list));
        setHasMore(!!d.has_more);
        setNextCursor(d.next_cursor ?? null);
      } catch (err) {
        if (err.name !== "AbortError") {
          showToast("Failed to load listings.", "error");
        }
      } finally {
        setProdLoading(false);
        setLoadingMore(false);
      }
    },
    [showToast]
  );

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API}/payment/plans`);
      const d   = await res.json();
      if (d.success) setPlans(d.plans ?? []);
    } catch { /* non-critical */ }
  }, []);

  const loadAll = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        await Promise.all([
          fetchOverview(),
          fetchStats(),
          fetchProducts("all"),
          fetchAnalytics(),
        ]);
      } catch {
        setError("Failed to load dashboard. Please try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchOverview, fetchStats, fetchProducts, fetchAnalytics]
  );

  useEffect(() => {
    fetchPlans();
    loadAll();
  }, [fetchPlans, loadAll]);

  const handleTabChange = useCallback(
    (newTab) => {
      setTab(newTab);
      setSearch("");
      setNextCursor(null);
      fetchProducts(newTab);
    },
    [fetchProducts]
  );

  const handleSearch = useCallback(
    (value) => {
      setSearch(value);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        setNextCursor(null);
        fetchProducts(tab, null, value);
      }, 400);
    },
    [tab, fetchProducts]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return;
    fetchProducts(tab, nextCursor, search);
  }, [hasMore, loadingMore, nextCursor, tab, search, fetchProducts]);

  const deleteProduct = useCallback(
    async (product) => {
      setDeleting(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      try {
        const res = await fetch(
          `${API}/seller-dashboard/products/${product.id}`,
          { method: "DELETE", headers: authH() }
        );
        const d = await res.json();
        if (res.ok && d.success) {
          fetchStats();
          showToast(`Deleted — recoverable for ${d.hold_days ?? 30} days`, "info", 5000);
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
    },
    [fetchStats, showToast]
  );

  const toggleProduct = useCallback(
    async (product) => {
      if (product.status === "pending_payment") {
        showToast("Complete payment before activating this listing.", "warning");
        return;
      }
      try {
        const res = await fetch(
          `${API}/seller-dashboard/products/${product.id}/toggle`,
          { method: "PATCH", headers: authH() }
        );
        const d = await res.json();
        if (res.ok && d.success) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === product.id
                ? { ...p, is_active: d.is_active, status: d.status }
                : p
            )
          );
          fetchStats();
          showToast(
            d.is_active ? "Listing activated" : "Listing paused",
            d.is_active ? "success" : "info"
          );
        } else {
          showToast(d.message || "Could not update.", "error");
        }
      } catch {
        showToast("Network error.", "error");
      }
    },
    [fetchStats, showToast]
  );

  const renewProduct = useCallback(
    async (product) => {
      setRenewing(product.id);
      try {
        const res = await fetch(
          `${API}/seller-dashboard/products/${product.id}/renew`,
          { method: "POST", headers: authH() }
        );
        const d = await res.json();

        if (res.ok && d.success) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === product.id
                ? {
                    ...p,
                    active_until : d.active_until,
                    status       : d.status,
                    is_active    : true,
                    renewal_count: d.renewal_count ?? (p.renewal_count ?? 0) + 1,
                  }
                : p
            )
          );
          fetchStats();
          if (d.is_subscriber) {
            showToast(`✨ Renewed for ${d.days_added} days (Pro)`, "success");
          } else if (d.renewals_left !== null && d.renewals_left <= 2) {
            const msg = d.renewals_left === 0
              ? `Renewed for ${d.days_added} days — last renewal available`
              : `Renewed for ${d.days_added} days · ${d.renewals_left} renewals left`;
            showToast(msg, d.renewals_left === 0 ? "warning" : "info", 6000);
          } else {
            showToast(`Renewed for ${d.days_added} days`, "success");
          }
          if (d.upgrade_to === "subscriber" && d.limit_reached_notice) {
            setTimeout(() => {
              pendingUpgrade.current = {
                type      : "subscribe",
                message   : d.limit_reached_notice,
                upgradeUrl: d.upgrade_url ?? "/seller/subscription/plans",
              };
              showToast(
                "Tap here to upgrade for unlimited renewals",
                "info",
                8000,
                () => navigate(d.upgrade_url ?? "/seller/subscription/plans")
              );
            }, 1500);
          }
          return;
        }

        if (res.status === 403 && d.reason === "unverified_no_renewal") {
          showToast(
            "Verify your identity to unlock renewals",
            "warning",
            6000,
            () => navigate(d.upgrade_url ?? "/verification")
          );
          return;
        }
        if (d.should_activate) {
          showToast("This is a trial listing — activate it to make it permanent", "info", 6000);
          return;
        }
        if (d.upgrade_to === "subscriber") {
          showToast(
            d.message || "Renewal limit reached — subscribe for unlimited",
            "warning",
            7000,
            () => navigate(d.upgrade_url ?? "/seller/subscription/plans")
          );
          return;
        }
        if (d.days_left !== undefined) {
          showToast(
            d.message || `Available when 7 days or less remain (${d.days_left} left)`,
            "info",
            5000
          );
          return;
        }
        showToast(d.message || "Could not renew.", "error");
      } catch {
        showToast("Network error.", "error");
      } finally {
        setRenewing(null);
      }
    },
    [fetchStats, showToast, navigate]
  );

  const handlePayNow = useCallback(
    async (product) => {
      const email = resolveEmail(userEmail);
      if (!email) {
        showToast("We couldn't find your email. Please log out and log in again.", "error");
        return;
      }
      try {
        const res = await fetch(`${API}/payment/initiate`, {
          method : "POST",
          headers: authH(),
          body   : JSON.stringify({ product_id: product.id, email }),
        });
        const d = await res.json();
        if (res.ok && d.authorization_url) {
          window.location.href = d.authorization_url;
        } else {
          showToast(d.message || "Could not initiate payment.", "error");
        }
      } catch {
        showToast("Network error. Try again.", "error");
      }
    },
    [userEmail, showToast]
  );

  const verifyPayment = useCallback(
    async (product) => {
      setVerifying(product.id);
      try {
        const res = await fetch(
          `${API}/seller-dashboard/products/${product.id}/verify-payment`,
          { method: "POST", headers: authH() }
        );
        const d = await res.json();
        if (res.ok && d.success) {
          if (d.status === "active") {
            setProducts((prev) =>
              prev.map((p) =>
                p.id === product.id
                  ? { ...p, status: "active", is_active: true }
                  : p
              )
            );
            fetchStats();
            showToast("Payment verified! Your listing is now live.", "success");
          } else if (d.status === "pending") {
            showToast("Payment is still processing. Please wait a few minutes.", "info");
          } else {
            showToast(d.message || "Payment not confirmed. Please complete payment.", "warning");
          }
        } else {
          showToast(d.message || "Could not verify payment.", "error");
        }
      } catch {
        showToast("Network error. Try again.", "error");
      } finally {
        setVerifying(null);
      }
    },
    [fetchStats, showToast]
  );

  const tabCounts = useMemo(
    () => ({
      all:            stats?.total_products  ?? products.length,
      active:         stats?.active          ?? 0,
      active_limited: stats?.active_limited  ?? 0,
      draft:          stats?.draft           ?? 0,
      paused:         stats?.paused          ?? 0,
      pending:        stats?.pending_payment ?? 0,
    }),
    [stats, products.length]
  );

  return {
    stats, products, analytics, plans,
    tier, isSubscriber,
    loading, prodLoading, loadingMore, refreshing, error,
    deleting, verifying, renewing,
    tab, search, hasMore,
    pendingDelete,
    loadAll,
    handleTabChange,
    handleSearch,
    handleLoadMore,
    deleteProduct,
    toggleProduct,
    renewProduct,
    handlePayNow,
    verifyPayment,
    tabCounts,
  };
}

/* ─────────────────────────────────────────────
   DashboardHeader
───────────────────────────────────────────── */
function DashboardHeader({
  greeting,
  userName,
  userId,
  section,
  setSection,
  tabCounts,
  refreshing,
  tier,
  isSubscriber,
  onRefresh,
  onNavigate,
}) {
  const tierLabel =
    tier === "subscriber" ? "Pro"
    : tier === "verified"  ? "Verified"
    : "Trial";

  const TierIc =
    tier === "subscriber" ? Ic.Zap
    : tier === "verified"  ? Ic.CheckCircle
    : Ic.Clock;

  return (
    <header className="dashboard__header">
      <div className="dashboard__header-inner">

        <div className="dashboard__header-left">
          <button
            className="dashboard__back-btn"
            onClick={() => onNavigate(-1)}
            aria-label="Go back"
          >
            <Ic.Back />
          </button>
          <div className="dashboard__header-text">
            <span className="dashboard__greeting">{greeting}</span>
            <h1 className="dashboard__title">
              {userName}
              <span className={`dashboard__tier-chip dashboard__tier-chip--${tier}`}>
                <TierIc />
                {tierLabel}
              </span>
            </h1>
          </div>
        </div>

        <div className="dashboard__header-right">
          <button
            className={`dashboard__action-btn${
              refreshing ? " dashboard__action-btn--spinning" : ""
            }`}
            onClick={onRefresh}
            title="Refresh"
            aria-label="Refresh dashboard"
            disabled={refreshing}
          >
            <Ic.Refresh />
          </button>
          <button
            className="dashboard__action-btn"
            onClick={() => onNavigate("/notifications")}
            title="Notifications"
            aria-label="Notifications"
          >
            <Ic.Bell />
          </button>
          <Link
            to={`/seller/${userId ?? ""}`}
            className="dashboard__avatar"
            title="View Store"
            aria-label="View your store"
          >
            {userName.charAt(0).toUpperCase()}
          </Link>
        </div>
      </div>

      <nav className="dashboard__nav" aria-label="Dashboard sections">
        {NAV_ITEMS.map(({ key, label, icon }) => {
          const Icon = Ic[icon] ?? (() => null);
          return (
            <button
              key={key}
              className={`dashboard__nav-item${
                section === key ? " dashboard__nav-item--active" : ""
              }`}
              onClick={() => setSection(key)}
              aria-current={section === key ? "page" : undefined}
            >
              <Icon />
              <span>{label}</span>
              {key === "products" && tabCounts.all > 0 && (
                <span className="dashboard__nav-badge">
                  {tabCounts.all}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

/* ─────────────────────────────────────────────
   ErrorBanner — data fetch errors
───────────────────────────────────────────── */
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="dashboard__error-banner" role="alert">
      <Ic.AlertTriangle />
      <span>{message}</span>
      <button className="btn btn--sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Dashboard
───────────────────────────────────────────── */
export default function Dashboard({ user }) {
  const navigate                    = useNavigate();
  const { toasts, show: showToast } = useToast();

  const [section,   setSection]   = useState("overview");
  const [confirm,   setConfirm]   = useState(null);
  const [promoting, setPromoting] = useState(null);

  /* ── auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/dashboard");
  }, [navigate]);

  const db = useDashboard(showToast, user?.email, navigate);

  /* ── delete flow ── */
  const handleDeleteRequest = useCallback(
    (product) => {
      db.pendingDelete.current = product;
      setConfirm({ message: `Delete "${product.title}"? This cannot be undone.` });
    },
    [db.pendingDelete]
  );

  const handleDeleteConfirm = useCallback(async () => {
    const product = db.pendingDelete.current;
    if (!product) return;
    db.pendingDelete.current = null;
    setConfirm(null);
    await db.deleteProduct(product);
  }, [db]);

  const handleDeleteCancel = useCallback(() => {
    db.pendingDelete.current = null;
    setConfirm(null);
  }, [db]);

  /* ── edit / promote ── */
  const handleEdit    = useCallback(
    (product) => navigate(`/minimart/add?edit=${product.id}`),
    [navigate]
  );
  const handlePromote = useCallback((product) => setPromoting(product), []);

  /* ── shared action props ── */
  const productActions = useMemo(
    () => ({
      onEdit:          handleEdit,
      onDelete:        handleDeleteRequest,
      onToggle:        db.toggleProduct,
      onRenew:         db.renewProduct,
      onPromote:       handlePromote,
      onPayNow:        db.handlePayNow,
      onVerifyPayment: db.verifyPayment,
    }),
    [
      handleEdit,
      handleDeleteRequest,
      db.toggleProduct,
      db.renewProduct,
      handlePromote,
      db.handlePayNow,
      db.verifyPayment,
    ]
  );

  const userName = user?.name || user?.full_name || user?.username || "Seller";

  /* ── sections — each wrapped in its own error boundary ── */
  const sections = useMemo(
    () => ({
      overview: (
        <SectionErrorBoundary section="Overview">
          <Overview
            stats={db.stats}
            analytics={db.analytics}
            products={db.products}
            loading={db.loading}
            userId={user?.id}
            deleting={db.deleting}
            verifying={db.verifying}
            tier={db.tier}
            isSubscriber={db.isSubscriber}
            onNavigate={navigate}
            onSetSection={setSection}
            {...productActions}
          />
        </SectionErrorBoundary>
      ),
      products: (
        <SectionErrorBoundary section="Listings">
          <Listings
            products={db.products}
            prodLoading={db.prodLoading}
            loadingMore={db.loadingMore}
            hasMore={db.hasMore}
            tab={db.tab}
            search={db.search}
            tabCounts={db.tabCounts}
            deleting={db.deleting}
            verifying={db.verifying}
            renewing={db.renewing}
            tier={db.tier}
            isSubscriber={db.isSubscriber}
            onTabChange={db.handleTabChange}
            onSearch={db.handleSearch}
            onLoadMore={db.handleLoadMore}
            onNavigate={navigate}
            {...productActions}
          />
        </SectionErrorBoundary>
      ),
      analytics: (
        <SectionErrorBoundary section="Analytics">
          <Analytics
            stats={db.stats}
            analytics={db.analytics}
            loading={db.loading}
            tier={db.tier}
            isSubscriber={db.isSubscriber}
            onSetSection={setSection}
            onTabChange={db.handleTabChange}
          />
        </SectionErrorBoundary>
      ),
    }),
    [db, user?.id, navigate, productActions]
  );

  return (
    <div className="dashboard">

      <DashboardHeader
        greeting={GREETING}
        userName={userName}
        userId={user?.id}
        section={section}
        setSection={setSection}
        tabCounts={db.tabCounts}
        refreshing={db.refreshing}
        tier={db.tier}
        isSubscriber={db.isSubscriber}
        onRefresh={() => db.loadAll(true)}
        onNavigate={navigate}
      />

      <main className="dashboard__main">

        {db.error && (
          <ErrorBanner
            message={db.error}
            onRetry={() => db.loadAll()}
          />
        )}

        <div
          key={section}
          className="dashboard__section dashboard__fade-in"
        >
          {sections[section]}
        </div>

        <footer className="dashboard__footer">
          <p>© {new Date().getFullYear()} Loemart Technologies</p>
        </footer>
      </main>

      {/* FAB */}
      <button
        className="dashboard__fab"
        onClick={() => navigate("/minimart/add")}
        title="Create Listing"
        aria-label="Create new listing"
      >
        <Ic.Plus />
      </button>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      {promoting && (
        <PromoteModal
          product={promoting}
          plans={db.plans}
          userEmail={user?.email}
          onClose={() => setPromoting(null)}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}