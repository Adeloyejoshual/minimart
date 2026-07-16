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

import Overview   from "./components/Overview";
import Listings   from "./components/Listings";
import Analytics  from "./components/Analytics";
import ConfirmDialog  from "./components/ConfirmDialog";
import PromoteModal   from "./components/PromoteModal";
import Toast          from "./components/Toast";

import "./Dashboard.css";

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const { toasts, show: showToast } = useToast();

  /* ── state ── */
  const [stats,       setStats]       = useState(null);
  const [products,    setProducts]    = useState([]);
  const [analytics,   setAnalytics]   = useState(null);
  const [plans,       setPlans]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [prodLoading, setProdLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [tab,         setTab]         = useState("all");
  const [search,      setSearch]      = useState("");
  const [deleting,    setDeleting]    = useState(null);
  const [confirm,     setConfirm]     = useState(null);
  const [promoting,   setPromoting]   = useState(null);
  const [section,     setSection]     = useState("overview");
  const [greeting,    setGreeting]    = useState("Dashboard");
  const [hasMore,     setHasMore]     = useState(false);
  const [nextCursor,  setNextCursor]  = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const pendingDelete = useRef(null);
  const abortRef      = useRef(null);
  const searchTimer   = useRef(null);

  /* ── greeting ── */
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
    );
  }, []);

  /* ── auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/dashboard");
  }, [navigate]);

  /* ── plans ── */
  useEffect(() => {
    fetch(`${API}/payment/plans`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setPlans(d.plans || []); })
      .catch(() => {});
  }, []);

  /* ── data loaders ── */
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seller-dashboard/stats`, {
        headers: authH(),
      });
      const d = await res.json();
      if (res.ok && d.success) setStats(d.stats);
    } catch (err) {
      console.error("[dashboard] loadStats:", err);
    }
  }, []);

  const loadProducts = useCallback(
    async (currentTab = "all", cursor = null, searchQuery = "") => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      if (cursor) setLoadingMore(true);
      else setProdLoading(true);

      try {
        let url = `${API}/seller-dashboard/products?tab=${currentTab}&limit=20`;
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
        if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

        const res = await fetch(url, {
          headers: authH(),
          signal: abortRef.current.signal,
        });
        const d = await res.json();

        if (!res.ok) {
          showToast(d.message || `Error ${res.status}`, "error");
          return;
        }

        const list = Array.isArray(d.products) ? d.products : [];
        if (cursor) setProducts((prev) => [...prev, ...list]);
        else setProducts(list);

        setHasMore(!!d.has_more);
        setNextCursor(d.next_cursor || null);
      } catch (err) {
        if (err.name === "AbortError") return;
        showToast("Failed to load listings.", "error");
      } finally {
        setProdLoading(false);
        setLoadingMore(false);
      }
    },
    [showToast]
  );

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seller-dashboard/analytics?days=7`, {
        headers: authH(),
      });
      const d = await res.json();
      if (res.ok && d.success) setAnalytics(d);
    } catch (err) {
      console.error("[dashboard] loadAnalytics:", err);
    }
  }, []);

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        await Promise.all([loadStats(), loadProducts("all"), loadAnalytics()]);
      } catch {
        setError("Failed to load dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadStats, loadProducts, loadAnalytics]
  );

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── tab / search ── */
  const handleTabChange = useCallback(
    (newTab) => {
      setTab(newTab);
      setSearch("");
      setNextCursor(null);
      loadProducts(newTab);
    },
    [loadProducts]
  );

  const handleSearch = useCallback(
    (value) => {
      setSearch(value);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        setNextCursor(null);
        loadProducts(tab, null, value);
      }, 400);
    },
    [tab, loadProducts]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || !nextCursor) return;
    loadProducts(tab, nextCursor, search);
  }, [hasMore, loadingMore, nextCursor, tab, search, loadProducts]);

  /* ── product actions ── */
  const handleDelete = useCallback((product) => {
    pendingDelete.current = product;
    setConfirm({
      message: `Delete "${product.title}"? This action cannot be undone.`,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    const product = pendingDelete.current;
    if (!product) return;
    pendingDelete.current = null;
    setConfirm(null);
    setDeleting(product.id);
    setProducts((prev) => prev.filter((p) => p.id !== product.id));

    try {
      const res = await fetch(
        `${API}/seller-dashboard/products/${product.id}`,
        { method: "DELETE", headers: authH() }
      );
      const d = await res.json();
      if (res.ok && d.success) {
        loadStats();
        showToast(
          `Deleted — recoverable for ${d.hold_days || 30} days`,
          "info",
          5000
        );
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

  const handleToggle = useCallback(
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
          loadStats();
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
    [loadStats, showToast]
  );

  const handleRenew = useCallback(
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
                    status: d.status,
                    is_active: true,
                  }
                : p
            )
          );
          loadStats();
          showToast(`Renewed for ${d.days_added} days`, "success");
        } else {
          showToast(d.message || "Could not renew.", "error");
        }
      } catch {
        showToast("Network error.", "error");
      }
    },
    [loadStats, showToast]
  );

  const handleEdit    = useCallback(
    (product) => navigate(`/minimart/add?edit=${product.id}`),
    [navigate]
  );
  const handlePromote = useCallback(
    (product) => setPromoting(product),
    []
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
    [stats, products]
  );

  const userName =
    user?.name || user?.full_name || user?.username || "Seller";

  /* ── render ── */
  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard__header">
        <div className="dashboard__header-inner">
          <div className="dashboard__header-left">
            <button
              className="dashboard__back-btn"
              onClick={() => navigate(-1)}
            >
              <Ic.Back />
            </button>
            <div className="dashboard__header-text">
              <span className="dashboard__greeting">{greeting}</span>
              <h1 className="dashboard__title">{userName}</h1>
            </div>
          </div>

          <div className="dashboard__header-right">
            <button
              className={`dashboard__action-btn${
                refreshing ? " dashboard__action-btn--spinning" : ""
              }`}
              onClick={() => loadAll(true)}
              title="Refresh"
            >
              <Ic.Refresh />
            </button>
            <button
              className="dashboard__action-btn"
              onClick={() => navigate("/notifications")}
              title="Notifications"
            >
              <Ic.Bell />
            </button>
            <Link
              to={`/seller/${user?.id || ""}`}
              className="dashboard__avatar"
              title="View Store"
            >
              {userName.charAt(0).toUpperCase()}
            </Link>
          </div>
        </div>

        {/* Nav */}
        <nav className="dashboard__nav">
          {[
            { key: "overview",  label: "Overview",  icon: <Ic.Chart /> },
            { key: "products",  label: "Listings",  icon: <Ic.Package /> },
            { key: "analytics", label: "Analytics", icon: <Ic.TrendUp /> },
          ].map((n) => (
            <button
              key={n.key}
              className={`dashboard__nav-item${
                section === n.key ? " dashboard__nav-item--active" : ""
              }`}
              onClick={() => setSection(n.key)}
            >
              {n.icon}
              <span>{n.label}</span>
              {n.key === "products" && tabCounts.all > 0 && (
                <span className="dashboard__nav-badge">
                  {tabCounts.all}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main className="dashboard__main">
        {error && (
          <div className="dashboard__error-banner">
            <Ic.AlertTriangle />
            <span>{error}</span>
            <button
              className="btn btn--sm"
              onClick={() => loadAll()}
            >
              Retry
            </button>
          </div>
        )}

        {section === "overview" && (
          <div className="dashboard__section dashboard__fade-in">
            <Overview
              stats={stats}
              analytics={analytics}
              products={products}
              loading={loading}
              userId={user?.id}
              deleting={deleting}
              onNavigate={navigate}
              onSetSection={setSection}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onRenew={handleRenew}
              onPromote={handlePromote}
            />
          </div>
        )}

        {section === "products" && (
          <div className="dashboard__section dashboard__fade-in">
            <Listings
              products={products}
              prodLoading={prodLoading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              tab={tab}
              search={search}
              tabCounts={tabCounts}
              deleting={deleting}
              onTabChange={handleTabChange}
              onSearch={handleSearch}
              onLoadMore={handleLoadMore}
              onNavigate={navigate}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onRenew={handleRenew}
              onPromote={handlePromote}
            />
          </div>
        )}

        {section === "analytics" && (
          <div className="dashboard__section dashboard__fade-in">
            <Analytics
              stats={stats}
              analytics={analytics}
              loading={loading}
              onSetSection={setSection}
              onTabChange={handleTabChange}
            />
          </div>
        )}

        <footer className="dashboard__footer">
          <p>© {new Date().getFullYear()} Loemart Technologies</p>
        </footer>
      </main>

      {/* FAB */}
      <button
        className="dashboard__fab"
        onClick={() => navigate("/minimart/add")}
        title="Create Listing"
      >
        <Ic.Plus />
      </button>

      {/* Modals */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirmDelete}
          onCancel={() => {
            pendingDelete.current = null;
            setConfirm(null);
          }}
        />
      )}

      {promoting && (
        <PromoteModal
          product={promoting}
          plans={plans}
          onClose={() => setPromoting(null)}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}