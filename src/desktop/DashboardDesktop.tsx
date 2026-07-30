// src/desktop/DashboardDesktop.tsx

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Component,
  ReactNode,
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
   SECTION ERROR BOUNDARY
   Same as mobile — shows the real error instead of
   a blank screen when a section component crashes.
═══════════════════════════════════════════════════════ */
interface SectionErrorBoundaryProps {
  section: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  error: Error | null;
  info: { componentStack?: string } | null;
}

class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error(
      `[DashboardDesktop:${this.props.section}] RENDER CRASH:`,
      error,
      info
    );
    this.setState({ info });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          margin: "24px",
          padding: "20px",
          border: "1.5px solid #f87171",
          borderRadius: "12px",
          background: "#fff1f1",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontSize: 20 }}>⚠️</span>
          <strong style={{ color: "#991b1b", fontSize: 14 }}>
            Render error in{" "}
            <code
              style={{
                background: "#fee2e2",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {this.props.section}
            </code>
          </strong>
        </div>

        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Error Message
          </div>
          <pre
            style={{
              margin: 0,
              fontSize: 13,
              color: "#7f1d1d",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {error.message ?? String(error)}
          </pre>
        </div>

        {error.stack && (
          <details style={{ marginBottom: "10px" }}>
            <summary
              style={{
                cursor: "pointer",
                fontSize: 12,
                color: "#9ca3af",
                padding: "4px 0",
              }}
            >
              Stack trace
            </summary>
            <pre
              style={{
                marginTop: "8px",
                padding: "10px",
                background: "#f9fafb",
                borderRadius: "6px",
                fontSize: 10,
                color: "#374151",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {error.stack}
            </pre>
          </details>
        )}

        {info?.componentStack && (
          <details style={{ marginBottom: "14px" }}>
            <summary
              style={{
                cursor: "pointer",
                fontSize: 12,
                color: "#9ca3af",
                padding: "4px 0",
              }}
            >
              Component tree
            </summary>
            <pre
              style={{
                marginTop: "8px",
                padding: "10px",
                background: "#f9fafb",
                borderRadius: "6px",
                fontSize: 10,
                color: "#374151",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {info.componentStack}
            </pre>
          </details>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={{
              padding: "8px 16px",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
            onClick={() => this.setState({ error: null, info: null })}
          >
            Try Again
          </button>
          <button
            style={{
              padding: "8px 16px",
              background: "transparent",
              color: "#6b7280",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: 13,
            }}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
          <button
            style={{
              padding: "8px 16px",
              background: "transparent",
              color: "#6b7280",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: 13,
            }}
            onClick={() => {
              const text =
                `Section: ${this.props.section}\n` +
                `Error: ${error.message}\n\n` +
                `Stack:\n${error.stack}\n\n` +
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
}

/* ═══════════════════════════════════════════════════════
   NAV
═══════════════════════════════════════════════════════ */
const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: <Ic.Chart /> },
  { key: "products", label: "Listings", icon: <Ic.Package /> },
  { key: "analytics", label: "Analytics", icon: <Ic.TrendUp /> },
];

/* ═══════════════════════════════════════════════════════
   HELPER — resolve user email from any storage
═══════════════════════════════════════════════════════ */
const resolveEmail = (propEmail?: string): string => {
  if (propEmail && propEmail.includes("@")) return propEmail;

  const plainKeys = ["user_email", "userEmail", "email", "marketplace_email"];
  for (const key of plainKeys) {
    const val = localStorage.getItem(key);
    if (val && val.includes("@")) return val;
  }

  const jsonKeys = [
    "user",
    "userData",
    "marketplace_user",
    "auth_user",
    "currentUser",
  ];
  for (const key of jsonKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const email = parsed?.email || parsed?.user?.email;
      if (email && email.includes("@")) return email;
    } catch {
      /* skip */
    }
  }

  return "";
};

/* ═══════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════ */
interface Props {
  user: any;
}

export default function DashboardDesktop({ user }: Props) {
  const navigate = useNavigate();
  const { toasts, show: showToast } = useToast();

  /* ── data ── */
  const [stats, setStats] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [tier, setTier] = useState<string>("unverified");
  const [isSubscriber, setIsSubscriber] = useState<boolean>(false);

  /* ── ui ── */
  const [loading, setLoading] = useState(true);
  const [prodLoading, setProdLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<string | null>(null);
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
  const loadOverview = useCallback(async () => {
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
    } catch (e) {
      console.error("[dkd] overview:", e);
    }
  }, []);

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
        await Promise.all([
          loadOverview(),
          loadStats(),
          loadProducts("all"),
          loadAnalytics(),
        ]);
      } catch {
        setError("Failed to load dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadOverview, loadStats, loadProducts, loadAnalytics]
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
     DELETE FLOW
     ✅ v2: Auto-pause active products before delete
            Warns user in confirm dialog if product is live
  ══════════════════════════════════════ */
  const handleDelete = useCallback((product: any) => {
    pendingDelete.current = product;

    const isActive =
      product.is_active === true || product.status === "active";

    const message = isActive
      ? `"${product.title}" is currently live. Deleting will remove it from the marketplace immediately.\n\nThis cannot be undone — but the listing is recoverable for 30 days from your account.`
      : `Delete "${product.title}"?\n\nThis cannot be undone — but the listing is recoverable for 30 days.`;

    setConfirm({ message });
  }, []);

  const confirmDelete = useCallback(async () => {
    const product = pendingDelete.current;
    if (!product) return;
    pendingDelete.current = null;
    setConfirm(null);
    setDeleting(product.id);

    /* Optimistic UI — remove immediately */
    setProducts((p) => p.filter((x) => x.id !== product.id));

    try {
      /* ✅ Step 1: If active, pause it first
         Backend requires pausing before delete for active listings. */
      const isActive =
        product.is_active === true || product.status === "active";

      if (isActive) {
        try {
          await fetch(
            `${API}/seller-dashboard/products/${product.id}/toggle`,
            { method: "PATCH", headers: authH() }
          );
        } catch {
          /* Non-fatal — continue to delete anyway */
          console.warn("[dkd] auto-pause failed, attempting delete anyway");
        }
      }

      /* ✅ Step 2: Delete */
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
        /* Rollback optimistic UI on failure */
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

  const cancelDelete = useCallback(() => {
    pendingDelete.current = null;
    setConfirm(null);
  }, []);

  /* ══════════════════════════════════════
     TOGGLE / RENEW / EDIT / PROMOTE
  ══════════════════════════════════════ */
  const handleToggle = useCallback(
    async (product: any) => {
      if (product.status === "pending_payment") {
        showToast(
          "Complete payment before activating this listing.",
          "warning"
        );
        return;
      }
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
      setRenewing(product.id);
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
                    renewal_count:
                      d.renewal_count ?? (x.renewal_count ?? 0) + 1,
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
      } finally {
        setRenewing(null);
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

  const handlePayNow = useCallback(
    async (product: any) => {
      const email = resolveEmail(user?.email);
      if (!email) {
        showToast(
          "We couldn't find your email. Please log out and log in again.",
          "error"
        );
        return;
      }
      try {
        const res = await fetch(`${API}/payment/initiate`, {
          method: "POST",
          headers: authH(),
          body: JSON.stringify({ product_id: product.id, email }),
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
    [user?.email, showToast]
  );

  const handleVerifyPayment = useCallback(
    async (product: any) => {
      setVerifying(product.id);
      try {
        const res = await fetch(
          `${API}/seller-dashboard/products/${product.id}/verify-payment`,
          { method: "POST", headers: authH() }
        );
        const d = await res.json();
        if (res.ok && d.success) {
          if (d.status === "active") {
            setProducts((p) =>
              p.map((x) =>
                x.id === product.id
                  ? { ...x, status: "active", is_active: true }
                  : x
              )
            );
            loadStats();
            showToast("Payment verified! Your listing is now live.", "success");
          } else if (d.status === "pending") {
            showToast(
              "Payment is still processing. Please wait a few minutes.",
              "info"
            );
          } else {
            showToast(
              d.message || "Payment not confirmed. Please complete payment.",
              "warning"
            );
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
    [loadStats, showToast]
  );

  /* ── derived ── */
  const tabCounts = useMemo(
    () => ({
      all: stats?.total_products ?? products.length,
      active: stats?.active ?? 0,
      active_limited: stats?.active_limited ?? 0,
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
            {sidebarCollapsed ? (
              <Ic.Store />
            ) : (
              <span className="dkd-logo-text">Seller Hub</span>
            )}
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
                  <span className="dkd-sidebar-badge">{tabCounts.all}</span>
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
              disabled={refreshing}
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
              <SectionErrorBoundary section="DeskOverview">
                <DeskOverview
                  stats={stats}
                  analytics={analytics}
                  products={products}
                  loading={loading}
                  userId={user?.id}
                  deleting={deleting}
                  verifying={verifying}
                  tier={tier}
                  isSubscriber={isSubscriber}
                  onNavigate={navigate}
                  onSetSection={setSection}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  onRenew={handleRenew}
                  onPromote={handlePromote}
                  onPayNow={handlePayNow}
                  onVerifyPayment={handleVerifyPayment}
                />
              </SectionErrorBoundary>
            </div>
          )}

          {section === "products" && (
            <div className="dkd-section dkd-fade-in">
              <SectionErrorBoundary section="DeskListings">
                <DeskListings
                  products={products}
                  prodLoading={prodLoading}
                  loadingMore={loadingMore}
                  hasMore={hasMore}
                  tab={tab}
                  search={search}
                  tabCounts={tabCounts}
                  deleting={deleting}
                  verifying={verifying}
                  renewing={renewing}
                  tier={tier}
                  isSubscriber={isSubscriber}
                  onTabChange={handleTabChange}
                  onSearch={handleSearch}
                  onLoadMore={handleLoadMore}
                  onNavigate={navigate}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  onRenew={handleRenew}
                  onPromote={handlePromote}
                  onPayNow={handlePayNow}
                  onVerifyPayment={handleVerifyPayment}
                />
              </SectionErrorBoundary>
            </div>
          )}

          {section === "analytics" && (
            <div className="dkd-section dkd-fade-in">
              <SectionErrorBoundary section="DeskAnalytics">
                <DeskAnalytics
                  stats={stats}
                  analytics={analytics}
                  loading={loading}
                  tier={tier}
                  isSubscriber={isSubscriber}
                  onSetSection={setSection}
                  onTabChange={handleTabChange}
                />
              </SectionErrorBoundary>
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
          onCancel={cancelDelete}
        />
      )}

      {promoting && (
        <PromoteModal
          product={promoting}
          plans={plans}
          userEmail={user?.email}
          onClose={() => setPromoting(null)}
        />
      )}

      <Toast toasts={toasts} />
    </div>
  );
}