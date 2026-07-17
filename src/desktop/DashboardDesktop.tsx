// src/desktop/DashboardDesktop.tsx

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  API,
  authH,
  getToken,
} from "../pages/Profile/components/helpers";
import { useToast } from "../pages/Profile/components/useToast";
import { Ic } from "../pages/Profile/components/icons";

import Toast from "../pages/Profile/components/Toast";
import ConfirmDialog from "../pages/Profile/components/ConfirmDialog";
import PromoteModal from "../pages/Profile/components/PromoteModal";

import DeskOverview from "./components/DeskOverview";
import DeskListings from "./components/DeskListings";
import DeskAnalytics from "./components/DeskAnalytics";

import "./DashboardDesktop.css";

/* ═══════════════════════════════════════════════════════
   NAV
═══════════════════════════════════════════════════════ */
const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: <Ic.Chart /> },
  { key: "products", label: "Listings", icon: <Ic.Package /> },
  { key: "analytics", label: "Analytics", icon: <Ic.TrendUp /> },
];

/* ═══════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════ */
interface Props {
  user: any;
}

export default function DashboardDesktop({ user }: Props) {
  const navigate = useNavigate();
  const { toasts, show: showToast } = useToast();

  /* ── state ── */
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [prodLoading, setProdLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [promoting, setPromoting] = useState<any>(null);
  const [section, setSection] = useState("overview");
  const [greeting, setGreeting] = useState("Dashboard");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const pendingDelete = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchTimer = useRef<any>(null);

  /* ── greeting ── */
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
    );
  }, []);

  /* ── auth ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/dashboard");
  }, [navigate]);

  /* ── plans ── */
  useEffect(() => {
    fetch(`${API}/payment/plans`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPlans(d.plans || []);
      })
      .catch(() => {});
  }, []);

  /* ══════════════════════════════════════
     DATA LOADERS
  ══════════════════════════════════════ */
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/seller-dashboard/stats`, {
        headers: authH(),
      });
      const d = await res.json();
      if (res.ok && d.success) setStats(d.stats);
    } catch (e) {
      console.error("[dkd] stats:", e);
    }
  }, []);

  const loadProducts = useCallback(
    async (
      currentTab = "all",
      cursor: string | null = null,
      searchQ = ""
    ) => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      if (cursor) setLoadingMore(true);
      else setProdLoading(true);

      try {
        let url = `${API}/seller-dashboard/products?tab=${currentTab}&limit=20`;
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
        if (searchQ) url += `&search=${encodeURIComponent(searchQ)}`;

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
        if (cursor) setProducts((p) => [...p, ...list]);
        else setProducts(list);

        setHasMore(!!d.has_more);
        setNextCursor(d.next_cursor || null);
      } catch (e: any) {
        if (e.name === "AbortError") return;
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
    } catch (e) {
      console.error("[dkd] analytics:", e);
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

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ══════════════════════════════════════
     TAB / SEARCH
  ══════════════════════════════════════ */
  const handleTabChange = useCallback(
    (newTab: string) => {
      setTab(newTab);
      setSearch("");
      setNextCursor(null);
      loadProducts(newTab);
    },
    [loadProducts]
  );

  const handleSearch = useCallback(
    (value: string) => {
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

  /* ══════════════════════════════════════
     PRODUCT ACTIONS
  ══════════════════════════════════════ */
  const handleDelete = useCallback((product: any) => {
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
    setProducts((p) => p.filter((x) => x.id !== product.id));

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
        setProducts((p) => [product, ...p]);
        showToast(d.message || "Could not delete.", "error");
      }
    } catch {
      setProducts((p) => [product, ...p]);
      showToast("Network error.", "error");
    } finally {
      setDeleting(null);
    }
  }, [loadStats, showToast]);

  const handleToggle = useCallback(
    async (product: any) => {
      try {
        const res = await fetch(
          `${API}/seller-dashboard/products/${product.id}/toggle`,
          { method: "PATCH", headers: authH() }
        );
        const d = await res.json();
        if (res.ok && d.success) {
          setProducts((p) =>
            p.map((x) =>
              x.id === product.id
                ? { ...x, is_active: d.is_active, status: d.status }
                : x
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
    async (product: any) => {
      try {
        const res = await fetch(
          `${API}/seller-dashboard/products/${product.id}/renew`,
          { method: "POST", headers: authH() }
        );
        const d = await res.json();
        if (res.ok && d.success) {
          setProducts((p) =>
            p.map((x) =>
              x.id === product.id
                ? {
                    ...x,
                    active_until: d.active_until,
                    status: d.status,
                    is_active: true,
                  }
                : x
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

  const handleEdit = useCallback(
    (product: any) => navigate(`/minimart/add?edit=${product.id}`),
    [navigate]
  );

  const handlePromote = useCallback(
    (product: any) => setPromoting(product),
    []
  );

  /* ── derived ── */
  const tabCounts = useMemo(
    () => ({
      all: stats?.total_products ?? products.length,
      active: stats?.active ?? 0,
      draft: stats?.draft ?? 0,
      paused: stats?.paused ?? 0,
      pending: stats?.pending_payment ?? 0,
    }),
    [stats, products]
  );

  const userName =
    user?.name || user?.full_name || user?.username || "Seller";

  /* ══════════════════════════════════════
     RENDER
  ══════════════════════════════════════ */
  return (
    <div className="dkd">
      {/* ── SIDEBAR ── */}
      <aside
        className={`dkd-sidebar${
          sidebarCollapsed ? " dkd-sidebar--collapsed" : ""
        }`}
      >
        <div className="dkd-sidebar-header">
          <Link to="/" className="dkd-sidebar-logo">
            {sidebarCollapsed ? <Ic.Store /> : <span className="dkd-logo-text">Seller Hub</span>}
          </Link>
          <button
            className="dkd-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <Ic.ChevronRight /> : <Ic.Back />}
          </button>
        </div>

        <nav className="dkd-sidebar-nav">
          {NAV_ITEMS.map((n) => (
            <button
              key={n.key}
              className={`dkd-sidebar-item${
                section === n.key ? " dkd-sidebar-item--active" : ""
              }`}
              onClick={() => setSection(n.key)}
              title={sidebarCollapsed ? n.label : undefined}
            >
              {n.icon}
              {!sidebarCollapsed && <span>{n.label}</span>}
              {!sidebarCollapsed &&
                n.key === "products" &&
                tabCounts.all > 0 && (
                  <span className="dkd-sidebar-badge">
                    {tabCounts.all}
                  </span>
                )}
            </button>
          ))}
        </nav>

        <div className="dkd-sidebar-footer">
          <button
            className="dkd-sidebar-item"
            onClick={() => navigate("/minimart/add")}
            title={sidebarCollapsed ? "New Listing" : undefined}
          >
            <Ic.Plus />
            {!sidebarCollapsed && <span>New Listing</span>}
          </button>
          <Link
            to={`/seller/${user?.id || ""}`}
            className="dkd-sidebar-item"
            title={sidebarCollapsed ? "My Store" : undefined}
          >
            <Ic.Store />
            {!sidebarCollapsed && <span>My Store</span>}
          </Link>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="dkd-main">
        {/* Topbar */}
        <header className="dkd-topbar">
          <div className="dkd-topbar-left">
            <h1 className="dkd-topbar-title">
              {greeting}, {userName}
            </h1>
          </div>
          <div className="dkd-topbar-right">
            <div className="dkd-topbar-search">
              <Ic.Search />
              <input
                type="search"
                placeholder="Search listings…"
                value={search}
                onChange={(e) => {
                  handleSearch(e.target.value);
                  if (section !== "products") setSection("products");
                }}
              />
              {search && (
                <button onClick={() => handleSearch("")}>
                  <Ic.X />
                </button>
              )}
            </div>
            <button
              className={`dkd-topbar-btn${
                refreshing ? " dkd-spinning" : ""
              }`}
              onClick={() => loadAll(true)}
              title="Refresh"
            >
              <Ic.Refresh />
            </button>
            <button
              className="dkd-topbar-btn"
              onClick={() => navigate("/notifications")}
              title="Notifications"
            >
              <Ic.Bell />
            </button>
            <Link
              to={`/seller/${user?.id || ""}`}
              className="dkd-topbar-avatar"
              title="View Store"
            >
              {userName.charAt(0).toUpperCase()}
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="dkd-content">
          {error && (
            <div className="dkd-error-banner">
              <Ic.AlertTriangle />
              <span>{error}</span>
              <button
                className="dkd-btn dkd-btn--sm"
                onClick={() => loadAll()}
              >
                Retry
              </button>
            </div>
          )}

          {section === "overview" && (
            <div className="dkd-section dkd-fade-in">
              <DeskOverview
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
            <div className="dkd-section dkd-fade-in">
              <DeskListings
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
            <div className="dkd-section dkd-fade-in">
              <DeskAnalytics
                stats={stats}
                analytics={analytics}
                loading={loading}
                onSetSection={setSection}
                onTabChange={handleTabChange}
              />
            </div>
          )}

          <footer className="dkd-footer">
            <p>&copy; {new Date().getFullYear()} Loemart Technologies</p>
          </footer>
        </div>
      </div>

      {/* Modals — reused from mobile */}
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