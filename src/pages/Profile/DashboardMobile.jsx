// src/pages/Profile/Dashboard.jsx
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
   Custom hook — all dashboard data & actions
───────────────────────────────────────────── */
function useDashboard(showToast) {
  /* ── data ── */
  const [stats,     setStats]     = useState(null);
  const [products,  setProducts]  = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [plans,     setPlans]     = useState([]);

  /* ── loading / error ── */
  const [loading,     setLoading]     = useState(true);
  const [prodLoading, setProdLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);
  const [deleting,    setDeleting]    = useState(null);

  /* ── pagination / filters ── */
  const [tab,        setTab]        = useState("all");
  const [search,     setSearch]     = useState("");
  const [hasMore,    setHasMore]    = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  /* ── refs ── */
  const abortRef      = useRef(null);
  const searchTimer   = useRef(null);
  const pendingDelete = useRef(null);

  /* ── fetch helpers ── */
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
      /* cancel in-flight request */
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

  /* ── bootstrap ── */
  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API}/payment/plans`);
      const d   = await res.json();
      if (d.success) setPlans(d.plans ?? []);
    } catch {
      /* non-critical */
    }
  }, []);

  const loadAll = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        await Promise.all([
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
    [fetchStats, fetchProducts, fetchAnalytics]
  );

  useEffect(() => {
    fetchPlans();
    loadAll();
  }, [fetchPlans, loadAll]);

  /* ── tab / search handlers ── */
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

  /* ── product mutations ── */
  const deleteProduct = useCallback(
    async (product) => {
      setDeleting(product.id);
      /* optimistic remove */
      setProducts((prev) => prev.filter((p) => p.id !== product.id));

      try {
        const res = await fetch(
          `${API}/seller-dashboard/products/${product.id}`,
          { method: "DELETE", headers: authH() }
        );
        const d = await res.json();

        if (res.ok && d.success) {
          fetchStats();
          showToast(
            `Deleted — recoverable for ${d.hold_days ?? 30} days`,
            "info",
            5000
          );
        } else {
          /* rollback */
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
                    active_until: d.active_until,
                    status:       d.status,
                    is_active:    true,
                  }
                : p
            )
          );
          fetchStats();
          showToast(`Renewed for ${d.days_added} days`, "success");
        } else {
          showToast(d.message || "Could not renew.", "error");
        }
      } catch {
        showToast("Network error.", "error");
      }
    },
    [fetchStats, showToast]
  );

  /* ── derived ── */
  const tabCounts = useMemo(
    () => ({
      all:     stats?.total_products  ?? products.length,
      active:  stats?.active          ?? 0,
      draft:   stats?.draft           ?? 0,
      paused:  stats?.paused          ?? 0,
      pending: stats?.pending_payment ?? 0,
    }),
    [stats, products.length]
  );

  return {
    /* data */
    stats, products, analytics, plans,
    /* loading */
    loading, prodLoading, loadingMore, refreshing, error, deleting,
    /* filters */
    tab, search, hasMore,
    /* refs */
    pendingDelete,
    /* actions */
    loadAll, handleTabChange, handleSearch, handleLoadMore,
    deleteProduct, toggleProduct, renewProduct,
    /* setters needed by UI */
    setProducts,
    /* tab counts */
    tabCounts,
  };
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
function DashboardHeader({
  greeting, userName, userId,
  section, setSection,
  tabCounts, refreshing,
  onRefresh, onNavigate,
}) {
  return (
    <header className="dashboard__header">
      <div className="dashboard__header-inner">

        {/* Left */}
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
            <h1 className="dashboard__title">{userName}</h1>
          </div>
        </div>

        {/* Right */}
        <div className="dashboard__header-right">
          <button
            className={`dashboard__action-btn${
              refreshing ? " dashboard__action-btn--spinning" : ""
            }`}
            onClick={onRefresh}
            title="Refresh"
            aria-label="Refresh dashboard"
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

      {/* Nav */}
      <nav className="dashboard__nav" aria-label="Dashboard sections">
        {NAV_ITEMS.map(({ key, label, icon }) => {
          const Icon = Ic[icon];
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
  const navigate          = useNavigate();
  const { toasts, show: showToast } = useToast();

  /* ── section ── */
  const [section,   setSection]   = useState("overview");
  const [confirm,   setConfirm]   = useState(null);
  const [promoting, setPromoting] = useState(null);

  /* ── all data / logic via hook ── */
  const db = useDashboard(showToast);

  /* ── auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/dashboard");
  }, [navigate]);

  /* ── delete flow ── */
  const handleDeleteRequest = useCallback(
    (product) => {
      db.pendingDelete.current = product;
      setConfirm({
        message: `Delete "${product.title}"? This cannot be undone.`,
      });
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

  /* ── shared product action props ── */
  const productActions = useMemo(
    () => ({
      onEdit:    handleEdit,
      onDelete:  handleDeleteRequest,
      onToggle:  db.toggleProduct,
      onRenew:   db.renewProduct,
      onPromote: handlePromote,
    }),
    [handleEdit, handleDeleteRequest, db.toggleProduct, db.renewProduct, handlePromote]
  );

  /* ── derived ── */
  const userName = user?.name || user?.full_name || user?.username || "Seller";

  /* ── section components map ── */
  const sections = useMemo(
    () => ({
      overview: (
        <Overview
          stats={db.stats}
          analytics={db.analytics}
          products={db.products}
          loading={db.loading}
          userId={user?.id}
          deleting={db.deleting}
          onNavigate={navigate}
          onSetSection={setSection}
          {...productActions}
        />
      ),
      products: (
        <Listings
          products={db.products}
          prodLoading={db.prodLoading}
          loadingMore={db.loadingMore}
          hasMore={db.hasMore}
          tab={db.tab}
          search={db.search}
          tabCounts={db.tabCounts}
          deleting={db.deleting}
          onTabChange={db.handleTabChange}
          onSearch={db.handleSearch}
          onLoadMore={db.handleLoadMore}
          onNavigate={navigate}
          {...productActions}
        />
      ),
      analytics: (
        <Analytics
          stats={db.stats}
          analytics={db.analytics}
          loading={db.loading}
          onSetSection={setSection}
          onTabChange={db.handleTabChange}
        />
      ),
    }),
    [db, user?.id, navigate, productActions, setSection]
  );

  /* ─── render ─── */
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

      {/* Modals */}
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