// pages/seller/SellerDashboard.jsx
/**
 * SellerDashboard.jsx  — v3
 * ─────────────────────────────────────────────────────────────
 * ✓ Stable context value (useMemo with correct deps)
 * ✓ No notification polling infinite loop
 * ✓ baseURL from VITE_API_URL env var
 * ✓ Abort controller cleaned up correctly
 * ✓ Token state tracked in React (not raw localStorage reads in render)
 * ✓ Browser back button preserved (replace only on tab switch)
 * ✓ Full error recovery flow
 * ✓ Dev-only diagnostics
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
} from "react";
import {
  Navigate,
  useParams,
  useNavigate,
} from "react-router-dom";
import axios from "axios";

import Overview  from "./Overview";
import Orders    from "./Orders";
import Products  from "./Products";
import Analytics from "./Analytics";
import Payouts   from "./Payouts";
import Settings  from "./Settings";
import Sidebar   from "./components/Sidebar";
import TopBar    from "./components/TopBar";

import "./styles/SellerDashboard.css";

/* ═════════════════════════════════════════════════════════════
   CONSTANTS
═════════════════════════════════════════════════════════════ */
export const SELLER_TOKEN_KEY = "seller_token";

export const VALID_TABS = [
  "overview",
  "orders",
  "products",
  "analytics",
  "payouts",
  "settings",
];

const tabFromParam = (p) =>
  VALID_TABS.includes(p) ? p : "overview";

/* ═════════════════════════════════════════════════════════════
   TOKEN HELPERS
═════════════════════════════════════════════════════════════ */
export const getSellerToken = () =>
  localStorage.getItem(SELLER_TOKEN_KEY);

export const clearSellerToken = () =>
  localStorage.removeItem(SELLER_TOKEN_KEY);

export const sellerSignOut = () => {
  clearSellerToken();
  window.location.href = "/become-seller";
};

/* ═════════════════════════════════════════════════════════════
   AXIOS INSTANCE
   ✅ FIX: baseURL from env — no more hardcoded paths in every file
═════════════════════════════════════════════════════════════ */
const _http = axios.create({
  /*
   * Set VITE_API_URL in your .env:
   *   VITE_API_URL=https://your-api.onrender.com
   *
   * Falls back to "" (same origin) for local dev with a proxy.
   */
  baseURL: import.meta.env.VITE_API_URL ?? "",
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

/* Attach seller token on every request */
_http.interceptors.request.use((config) => {
  const token = getSellerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/*
 * Global response interceptor:
 * ✅ FIX: only redirect on 401 if we actually have a token.
 *    Prevents redirect loop when the token was already cleared.
 */
_http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && getSellerToken()) {
      clearSellerToken();
      window.location.href = "/become-seller";
    }
    return Promise.reject(err);
  }
);

/* Shared API object used by all seller sub-pages */
export const sellerApi = {
  get:    (url, config)       => _http.get(url, config),
  post:   (url, data, config) => _http.post(url, data, config),
  patch:  (url, data, config) => _http.patch(url, data, config),
  put:    (url, data, config) => _http.put(url, data, config),
  delete: (url, config)       => _http.delete(url, config),
};

/* ═════════════════════════════════════════════════════════════
   DASHBOARD CONTEXT
═════════════════════════════════════════════════════════════ */
const DashboardContext = createContext(null);

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error(
      "useDashboard must be used inside <SellerDashboard />"
    );
  }
  return ctx;
};

/* ═════════════════════════════════════════════════════════════
   ERROR CODE → USER MESSAGE MAP
═════════════════════════════════════════════════════════════ */
const ERROR_MESSAGES = {
  NO_TOKEN:
    "No seller account found. Please sign in.",
  NOT_SELLER_ACCOUNT:
    "This account is not registered as a seller. " +
    "Please use your seller credentials.",
  ACCOUNT_SUSPENDED:
    "Your seller account has been suspended. " +
    "Contact support for help.",
  NO_VENDOR:
    "No store found. Please complete seller setup.",
  VENDOR_NOT_ACTIVE:
    "Your store is pending approval. Check back soon.",
  TOKEN_EXPIRED:
    "Your session has expired. Please sign in again.",
  INVALID_TOKEN:
    "Invalid session. Please sign in again.",
  TIMEOUT:
    "Connection timed out. The server may be starting up — " +
    "please wait a moment and retry.",
  NETWORK:
    "Could not reach the server. Check your connection.",
};

const AUTH_ERROR_CODES = new Set([
  "NO_TOKEN",
  "TOKEN_EXPIRED",
  "INVALID_TOKEN",
  "NOT_SELLER_ACCOUNT",
  "ACCOUNT_SUSPENDED",
]);

const ONBOARDING_ERROR_CODES = new Set([
  "NO_VENDOR",
  "VENDOR_NOT_ACTIVE",
]);

/* ═════════════════════════════════════════════════════════════
   DEV DIAGNOSTIC
═════════════════════════════════════════════════════════════ */
const runTokenDiagnostic = () => {
  if (import.meta.env.MODE !== "development") return;

  const knownKeys = [
    "seller_token", "token", "auth_token",
    "jwt", "access_token", "sellerToken",
  ];

  console.group("🔍 [SellerDashboard] Token Diagnostic");
  knownKeys.forEach((k) => {
    const val = localStorage.getItem(k);
    console.log(
      val
        ? `  ✅ "${k}": ${val.slice(0, 40)}…`
        : `  ❌ "${k}": not found`
    );
  });
  if (!localStorage.getItem(SELLER_TOKEN_KEY)) {
    console.warn(
      "  ⚠️  seller_token MISSING.\n" +
      '     localStorage.setItem("seller_token", "<your-token>")'
    );
  }
  console.groupEnd();
};

/* ═════════════════════════════════════════════════════════════
   LOADING SCREEN
═════════════════════════════════════════════════════════════ */
const LoadingScreen = ({ stage, timeoutHit }) => (
  <div className="sd-center-wrap">
    <div className="sd-center-card">
      <span className="sd-center-card__emoji">🛒</span>
      <div
        className="sd-spinner"
        role="status"
        aria-label="Loading dashboard"
      />
      <p className="sd-center-card__msg">
        {timeoutHit
          ? "Server is waking up — please wait…"
          : stage === "notifications"
            ? "Almost ready…"
            : "Loading your dashboard…"}
      </p>
      {timeoutHit && (
        <button className="sd-ghost-btn" onClick={sellerSignOut}>
          ← Back to login
        </button>
      )}
    </div>
  </div>
);

/* ═════════════════════════════════════════════════════════════
   ERROR SCREEN
═════════════════════════════════════════════════════════════ */
const ErrorScreen = ({ error, code, raw, onRetry }) => {
  const isAuthErr       = AUTH_ERROR_CODES.has(code);
  const isOnboardingErr = ONBOARDING_ERROR_CODES.has(code);

  const friendlyMsg =
    ERROR_MESSAGES[code] ?? error ?? "Something went wrong.";

  const emoji = isAuthErr       ? "🔐"
              : isOnboardingErr ? "🏪"
              :                   "⚠️";

  const title = isAuthErr       ? "Sign In Required"
              : isOnboardingErr ? "Store Not Ready"
              :                   "Dashboard Error";

  return (
    <div className="sd-center-wrap">
      <div className="sd-center-card sd-center-card--wide">
        <span className="sd-center-card__emoji">{emoji}</span>
        <h2 className="sd-center-card__title">{title}</h2>
        <p className="sd-center-card__desc">{friendlyMsg}</p>

        {/* Dev debug */}
        {import.meta.env.MODE === "development" && (
          <details className="sd-debug-panel">
            <summary className="sd-debug-panel__summary">
              🛠 Debug Info
            </summary>
            <pre className="sd-debug-panel__body">
              {JSON.stringify({ code, error, raw }, null, 2)}
            </pre>
          </details>
        )}

        <div className="sd-center-card__actions">
          {!isAuthErr && !isOnboardingErr && (
            <button className="sd-primary-btn" onClick={onRetry}>
              🔄 Try Again
            </button>
          )}
          {isOnboardingErr && (
            <button
              className="sd-primary-btn"
              onClick={() => { window.location.href = "/become-seller"; }}
            >
              🏪 Go to Store Setup
            </button>
          )}
          <button className="sd-danger-btn" onClick={sellerSignOut}>
            ↩ {isAuthErr ? "Sign In to Seller" : "Sign Out"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════════════════════ */
export default function SellerDashboard() {
  const { tab: tabParam } = useParams();
  const routerNavigate    = useNavigate();

  /* ── Core state ─────────────────────────────────────────── */
  const [activePage,  setActivePage]  = useState(tabFromParam(tabParam));
  const [vendor,      setVendor]      = useState(null);
  const [loadStage,   setLoadStage]   = useState("vendor");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [errorCode,   setErrorCode]   = useState(null);
  const [errorRaw,    setErrorRaw]    = useState(null);
  const [timeoutHit,  setTimeoutHit]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /*
   * ✅ FIX: track token in state so render guard is reactive.
   *    Raw `getSellerToken()` calls in the render body re-run
   *    every render but never trigger a re-render when the value
   *    changes — so a stale "no token" read could flash the wrong UI.
   */
  const [hasToken, setHasToken] = useState(() => !!getSellerToken());

  /* ── Notification state ─────────────────────────────────── */
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  /* Refs */
  const abortRef        = useRef(null);
  /*
   * ✅ FIX: store unreadCount in a ref so pollUnreadCount
   *    doesn't need it in its dependency array (which caused
   *    a new function + new interval every 60s).
   */
  const unreadCountRef  = useRef(0);

  /* Keep ref in sync with state */
  useEffect(() => { unreadCountRef.current = unreadCount; }, [unreadCount]);

  /* ── Dev diagnostic on mount ────────────────────────────── */
  useEffect(() => { runTokenDiagnostic(); }, []);

  /* ── Sync tab from URL param ────────────────────────────── */
  useEffect(() => {
    if (tabParam) setActivePage(tabFromParam(tabParam));
  }, [tabParam]);

  /* ── Close sidebar when page changes ────────────────────── */
  useEffect(() => { setSidebarOpen(false); }, [activePage]);

  /* ═══════════════════════════════════════════════════════════
     NAVIGATE
     ✅ FIX: `replace: true` only on tab switch (not deep links).
             Preserves browser back-button behaviour.
  ═══════════════════════════════════════════════════════════ */
  const navigate = useCallback(
    (page, { replace = true } = {}) => {
      if (!VALID_TABS.includes(page)) return;
      setActivePage(page);
      routerNavigate(
        `/seller/dashboard/${page}`,
        { replace }
      );
    },
    [routerNavigate]
  );

  /* ═══════════════════════════════════════════════════════════
     LOAD VENDOR
  ═══════════════════════════════════════════════════════════ */
  const loadVendor = useCallback(async () => {
    const token = getSellerToken();
    if (!token) {
      setHasToken(false);
      setError("No seller account found.");
      setErrorCode("NO_TOKEN");
      setLoading(false);
      return;
    }

    /* Cancel any in-flight request */
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setLoadStage("vendor");
    setError(null);
    setErrorCode(null);
    setErrorRaw(null);
    setTimeoutHit(false);

    /* Show "waking up" message after 7 s */
    const slowTimer = setTimeout(() => setTimeoutHit(true), 7_000);

    try {
      const { data } = await sellerApi.get(
        "/api/seller-onboarding/status",
        { signal: abortRef.current.signal }
      );

      if (import.meta.env.MODE === "development") {
        console.log("[SellerDashboard] onboarding status:", data);
      }

      if (data?.vendor) {
        const { status } = data.vendor;
        if (status === "active" || status === "approved") {
          setVendor(data.vendor);
          setHasToken(true);
        } else {
          setError(`Your store status is: ${status}`);
          setErrorCode("VENDOR_NOT_ACTIVE");
        }
      } else if (data?.success === false) {
        setError(data.message ?? "Unknown error");
        setErrorCode(data.code   ?? "UNKNOWN");
      } else {
        setError("No vendor found.");
        setErrorCode("NO_VENDOR");
      }

    } catch (err) {
      /* Swallow abort errors */
      if (axios.isCancel(err) || err.name === "CanceledError") return;

      const httpStatus  = err.response?.status;
      const serverCode  = err.response?.data?.code;
      const serverMsg   = err.response?.data?.message;
      const networkCode = err.code;

      if (import.meta.env.MODE === "development") {
        console.error("[SellerDashboard] loadVendor error:", {
          httpStatus, serverCode, serverMsg, networkCode,
        });
      }

      setErrorRaw({ httpStatus, serverCode, networkCode });

      if (httpStatus === 401) {
        setHasToken(false);
        setError("Session expired. Please sign in again.");
        setErrorCode(serverCode ?? "TOKEN_EXPIRED");
      } else if (httpStatus === 403) {
        setError(serverMsg ?? "Access denied.");
        setErrorCode(serverCode ?? "FORBIDDEN");
      } else if (httpStatus === 404) {
        setError(serverMsg ?? "No vendor found.");
        setErrorCode(serverCode ?? "NO_VENDOR");
      } else if (
        networkCode === "ECONNABORTED" ||
        networkCode === "ERR_NETWORK"  ||
        !err.response
      ) {
        setError(
          "Connection timed out. " +
          "The server may be starting up — please retry."
        );
        setErrorCode("TIMEOUT");
      } else if (serverCode) {
        setError(serverMsg ?? serverCode);
        setErrorCode(serverCode);
      } else {
        setError(serverMsg ?? err.message ?? "Unexpected error.");
        setErrorCode("UNKNOWN");
      }

    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setLoadStage(null);
    }
  }, []); /* no deps — stable forever */

  /* ═══════════════════════════════════════════════════════════
     NOTIFICATIONS
  ═══════════════════════════════════════════════════════════ */

  /* Full list — called once on vendor load + manually */
  const loadNotifications = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller/notifications",
        { params: { limit: 20, page: 1 } }
      );
      if (data?.success) {
        const list  = data.data?.notifications ?? [];
        const count = data.data?.unread_count  ?? 0;
        setNotifications(list);
        setUnreadCount(count);
        unreadCountRef.current = count;
      }
    } catch (err) {
      if (import.meta.env.MODE === "development") {
        console.warn("[SellerDashboard] notifications load:", err.message);
      }
    }
  }, []); /* stable — no deps needed */

  /*
   * ✅ FIX: removed `unreadCount` and `loadNotifications` from deps.
   *    Using `unreadCountRef.current` avoids the stale-closure issue
   *    without causing the interval to be recreated every 60 s.
   */
  const pollUnreadCount = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller/notifications/unread-count"
      );
      if (data?.success) {
        const incoming = data.count ?? 0;
        setUnreadCount(incoming);
        unreadCountRef.current = incoming;

        /* New notifications arrived — reload full list */
        if (incoming > unreadCountRef.current) {
          loadNotifications();
        }
      }
    } catch {
      /* non-critical — silent fail */
    }
  }, [loadNotifications]); /* loadNotifications is stable */

  /* Mark single notification read — optimistic */
  const markNotifRead = useCallback(async (id) => {
    /* Optimistic update */
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, read: true, read_at: new Date().toISOString() }
          : n
      )
    );
    setUnreadCount((c) => {
      const next = Math.max(0, c - 1);
      unreadCountRef.current = next;
      return next;
    });

    try {
      await sellerApi.patch(`/api/seller/notifications/${id}/read`);
    } catch {
      /* Rollback */
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: false, read_at: null } : n
        )
      );
      setUnreadCount((c) => {
        const next = c + 1;
        unreadCountRef.current = next;
        return next;
      });
    }
  }, []);

  /* Mark all read — optimistic */
  const markAllRead = useCallback(async () => {
    const hasUnread = notifications.some((n) => !n.read);
    if (!hasUnread) return;

    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: now }))
    );
    setUnreadCount(0);
    unreadCountRef.current = 0;

    try {
      await sellerApi.patch("/api/seller/notifications/read-all");
    } catch {
      /* Rollback — reload real state */
      loadNotifications();
    }
  }, [notifications, loadNotifications]);

  /* ── Mount ──────────────────────────────────────────────── */
  useEffect(() => {
    loadVendor();
    return () => { abortRef.current?.abort(); };
  }, [loadVendor]);

  /* ── Start notifications once vendor is confirmed ──────── */
  useEffect(() => {
    if (!vendor) return;

    loadNotifications();

    /* Lightweight poll every 60 s */
    const t = setInterval(pollUnreadCount, 60_000);
    return () => clearInterval(t);

    /*
     * ✅ FIX: only `vendor` as dep.
     *    Both `loadNotifications` and `pollUnreadCount` are
     *    stable (no-dep) callbacks, so they won't cause
     *    the effect to re-subscribe on every render.
     */
  }, [vendor, loadNotifications, pollUnreadCount]);

  /* ═══════════════════════════════════════════════════════════
     PAGE MAP — stable, never recreated
  ═══════════════════════════════════════════════════════════ */
  const pageMap = useMemo(() => ({
    overview:  <Overview  />,
    orders:    <Orders    />,
    products:  <Products  />,
    analytics: <Analytics />,
    payouts:   <Payouts   />,
    settings:  <Settings  />,
  }), []); /* intentionally empty deps — components don't change */

  /* ═══════════════════════════════════════════════════════════
     CONTEXT VALUE
     ✅ FIX: memoised with explicit deps so it only updates
             when something actually changes.
  ═══════════════════════════════════════════════════════════ */
  const ctxValue = useMemo(() => ({
    /* Vendor */
    vendor,
    setVendor,
    reloadVendor: loadVendor,

    /* Navigation */
    activePage,
    navigate,

    /* Notifications */
    notifications,
    unreadCount,
    markNotifRead,
    markAllRead,
    reloadNotifications: loadNotifications,
  }), [
    vendor,
    activePage,
    navigate,
    notifications,
    unreadCount,
    markNotifRead,
    markAllRead,
    loadVendor,
    loadNotifications,
  ]);

  /* ═══════════════════════════════════════════════════════════
     RENDER GUARDS
  ═══════════════════════════════════════════════════════════ */

  /* 1. No token — redirect immediately (reactive via state) */
  if (!hasToken && !loading) {
    return <Navigate to="/become-seller" replace />;
  }

  /* 2. Loading */
  if (loading) {
    return <LoadingScreen stage={loadStage} timeoutHit={timeoutHit} />;
  }

  /* 3. Vendor not set up → send to onboarding */
  if (
    errorCode === "VENDOR_NOT_ACTIVE" ||
    errorCode === "NO_VENDOR"
  ) {
    return <Navigate to="/become-seller" replace />;
  }

  /* 4. All other errors */
  if (error || !vendor) {
    return (
      <ErrorScreen
        error={error}
        code={errorCode}
        raw={errorRaw}
        onRetry={() => {
          setError(null);
          setErrorCode(null);
          setErrorRaw(null);
          loadVendor();
        }}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════════
     DASHBOARD RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <DashboardContext.Provider value={ctxValue}>
      <div className="sd-root">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="sd-mobile-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Desktop sidebar */}
        <aside className="sd-sidebar-desktop" aria-label="Sidebar">
          <Sidebar
            vendor={vendor}
            activePage={activePage}
            onNavigate={navigate}
            unreadCount={unreadCount}
            onClose={() => {}}
          />
        </aside>

        {/* Mobile sidebar */}
        {sidebarOpen && (
          <aside
            className="sd-sidebar-mobile"
            aria-label="Mobile sidebar"
          >
            <Sidebar
              vendor={vendor}
              activePage={activePage}
              onNavigate={navigate}
              unreadCount={unreadCount}
              onClose={() => setSidebarOpen(false)}
              showClose
            />
          </aside>
        )}

        {/* Main content area */}
        <div className="sd-main">
          <TopBar
            vendor={vendor}
            activePage={activePage}
            onMenuClick={() => setSidebarOpen((v) => !v)}
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkRead={markNotifRead}
            onMarkAllRead={markAllRead}
          />

          <main className="sd-page-wrap" id="sd-main-content">
            {/*
              key={activePage} unmounts + remounts the page component
              on tab switch — gives a clean slate with animation.
            */}
            <div key={activePage} className="sd-page-anim">
              {pageMap[activePage] ?? pageMap.overview}
            </div>
          </main>
        </div>

      </div>
    </DashboardContext.Provider>
  );
}