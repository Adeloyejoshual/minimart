// pages/seller/SellerDashboard.jsx
// ═════════════════════════════════════════════════════════════
// Seller Dashboard shell.
//
// v5 — Uses /api/seller-auth/me for auth (no more 401 loop)
// ─────────────────────────────────────────────────────────────
// Auth flow:
//   1. Read "sellerToken" from localStorage
//   2. Verify with GET /api/seller-auth/me  ← same secret as /login
//   3. Optionally load vendor from /api/seller-onboarding/status
//      (missing vendor is OK — user just hasn't set up store yet)
//
// If /me returns 401 → token really is invalid → clear + redirect.
// If /status returns 404 or fails → keep user logged in, show empty state.
// ═════════════════════════════════════════════════════════════

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
export const SELLER_TOKEN_KEY = "sellerToken";

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

/* One-time migration from old token keys */
(function migrateLegacyToken() {
  if (typeof window === "undefined") return;

  const NEW_KEY  = SELLER_TOKEN_KEY;
  const OLD_KEYS = ["seller_token", "token", "auth_token", "sellerAuthToken"];

  if (localStorage.getItem(NEW_KEY)) return;

  for (const oldKey of OLD_KEYS) {
    const oldVal = localStorage.getItem(oldKey);
    if (oldVal && oldVal.split(".").length === 3) {
      localStorage.setItem(NEW_KEY, oldVal);
      localStorage.removeItem(oldKey);
      console.log(
        `[SellerDashboard] 🔄 Migrated token: "${oldKey}" → "${NEW_KEY}"`
      );
      return;
    }
  }
})();

/* ═════════════════════════════════════════════════════════════
   AXIOS INSTANCE
   ─────────────────────────────────────────────────────
   ✅ FIX: No global 401 interceptor that redirects.
   The redirect loop was caused by that interceptor firing
   on /api/seller-onboarding/status which validates tokens
   differently than /api/seller-auth/login signs them.
   We now handle 401 explicitly in loadSession() only.
═════════════════════════════════════════════════════════════ */
const _http = axios.create({
  baseURL : import.meta.env.VITE_API_URL ?? "",
  timeout : 20_000,
  headers : { "Content-Type": "application/json" },
});

_http.interceptors.request.use((config) => {
  const token = getSellerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/*
 * ✅ NO global 401 redirect interceptor.
 * We handle auth failures explicitly in loadSession() so we
 * can distinguish between:
 *   - Genuine expired token   → clear + redirect
 *   - Onboarding endpoint 401 → different problem, don't clear
 */

export const sellerApi = {
  get    : (url, config)       => _http.get(url, config),
  post   : (url, data, config) => _http.post(url, data, config),
  patch  : (url, data, config) => _http.patch(url, data, config),
  put    : (url, data, config) => _http.put(url, data, config),
  delete : (url, config)       => _http.delete(url, config),
};

/* ═════════════════════════════════════════════════════════════
   DASHBOARD CONTEXT
═════════════════════════════════════════════════════════════ */
const DashboardContext = createContext(null);

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used inside <SellerDashboard />");
  }
  return ctx;
};

/* ═════════════════════════════════════════════════════════════
   ERROR MESSAGES
═════════════════════════════════════════════════════════════ */
const ERROR_MESSAGES = {
  NO_TOKEN           : "No seller account found. Please sign in.",
  TOKEN_EXPIRED      : "Your session has expired. Please sign in again.",
  INVALID_TOKEN      : "Invalid session. Please sign in again.",
  NOT_SELLER_ACCOUNT : "This account is not registered as a seller.",
  ACCOUNT_SUSPENDED  : "Your seller account has been suspended.",
  TIMEOUT            : "Connection timed out. The server may be starting up — please retry.",
  NETWORK            : "Could not reach the server. Check your connection.",
};

/* ═════════════════════════════════════════════════════════════
   DEV DIAGNOSTIC
═════════════════════════════════════════════════════════════ */
const runTokenDiagnostic = () => {
  if (import.meta.env.MODE !== "development") return;

  console.group("🔍 [SellerDashboard] Token Diagnostic");
  const val = localStorage.getItem(SELLER_TOKEN_KEY);
  console.log(
    val
      ? `  ✅ "${SELLER_TOKEN_KEY}": ${val.slice(0, 40)}…`
      : `  ❌ "${SELLER_TOKEN_KEY}": NOT FOUND`
  );
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
          : stage === "vendor"
            ? "Loading your store…"
            : "Verifying session…"}
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
  const isAuthErr = ["NO_TOKEN", "TOKEN_EXPIRED", "INVALID_TOKEN",
                     "NOT_SELLER_ACCOUNT", "ACCOUNT_SUSPENDED"].includes(code);

  const friendlyMsg = ERROR_MESSAGES[code] ?? error ?? "Something went wrong.";
  const emoji       = isAuthErr ? "🔐" : "⚠️";
  const title       = isAuthErr ? "Sign In Required" : "Dashboard Error";

  return (
    <div className="sd-center-wrap">
      <div className="sd-center-card sd-center-card--wide">
        <span className="sd-center-card__emoji">{emoji}</span>
        <h2 className="sd-center-card__title">{title}</h2>
        <p className="sd-center-card__desc">{friendlyMsg}</p>

        {import.meta.env.MODE === "development" && (
          <details className="sd-debug-panel">
            <summary className="sd-debug-panel__summary">🛠 Debug Info</summary>
            <pre className="sd-debug-panel__body">
              {JSON.stringify({
                code, error, raw,
                tokenFound : !!getSellerToken(),
                tokenKey   : SELLER_TOKEN_KEY,
              }, null, 2)}
            </pre>
          </details>
        )}

        <div className="sd-center-card__actions">
          {!isAuthErr && (
            <button className="sd-primary-btn" onClick={onRetry}>
              🔄 Try Again
            </button>
          )}
          <button className="sd-danger-btn" onClick={sellerSignOut}>
            ↩ {isAuthErr ? "Sign In" : "Sign Out"}
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

  const [activePage,  setActivePage]  = useState(tabFromParam(tabParam));
  const [user,        setUser]        = useState(null);   /* from /me */
  const [vendor,      setVendor]      = useState(null);   /* from /status */
  const [loadStage,   setLoadStage]   = useState("session");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [errorCode,   setErrorCode]   = useState(null);
  const [errorRaw,    setErrorRaw]    = useState(null);
  const [timeoutHit,  setTimeoutHit]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasToken,    setHasToken]    = useState(() => !!getSellerToken());

  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const abortRef       = useRef(null);
  const unreadCountRef = useRef(0);

  useEffect(() => { unreadCountRef.current = unreadCount; }, [unreadCount]);
  useEffect(() => { runTokenDiagnostic(); }, []);
  useEffect(() => {
    if (tabParam) setActivePage(tabFromParam(tabParam));
  }, [tabParam]);
  useEffect(() => { setSidebarOpen(false); }, [activePage]);

  const navigate = useCallback(
    (page, { replace = true } = {}) => {
      if (!VALID_TABS.includes(page)) return;
      setActivePage(page);
      routerNavigate(`/seller/dashboard/${page}`, { replace });
    },
    [routerNavigate]
  );

  /* ═══════════════════════════════════════════════════════════
     LOAD SESSION
     ─────────────────────────────────────────────────────
     ✅ FIX: Two-step auth check to prevent redirect loop.
     Step 1: /api/seller-auth/me (authoritative — same secret as /login)
     Step 2: /api/seller-onboarding/status (optional — vendor may not exist)

     If step 1 fails with 401 → real auth problem → clear + redirect.
     If step 2 fails → keep user logged in, show empty vendor state.
  ═══════════════════════════════════════════════════════════ */
  const loadSession = useCallback(async () => {
    const token = getSellerToken();

    if (!token) {
      console.log("[SellerDashboard] No token — redirecting to sign in");
      setHasToken(false);
      setError("No seller account found.");
      setErrorCode("NO_TOKEN");
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setLoadStage("session");
    setError(null);
    setErrorCode(null);
    setErrorRaw(null);
    setTimeoutHit(false);

    const slowTimer = setTimeout(() => setTimeoutHit(true), 7_000);

    try {
      /* ════════════════════════════════════════════════
         STEP 1 — Verify session with /api/seller-auth/me
         Uses same JWT_SECRET as /api/seller-auth/login
      ════════════════════════════════════════════════ */
      console.log("[SellerDashboard] Step 1: Verifying token with /me…");

      let userRow = null;
      try {
        const { data } = await sellerApi.get("/api/seller-auth/me", {
          signal: abortRef.current.signal,
        });

        if (!data?.success || !data?.user) {
          throw new Error("Invalid /me response");
        }

        userRow = data.user;
        setUser(userRow);
        setHasToken(true);
        console.log("[SellerDashboard] ✅ Session valid — user:", userRow.email);

      } catch (meErr) {
        if (axios.isCancel(meErr) || meErr.name === "CanceledError") return;

        const status = meErr.response?.status;
        const msg    = meErr.response?.data?.message ?? meErr.message;

        console.log("[SellerDashboard] /me failed:", { status, msg });

        setErrorRaw({
          endpoint : "/api/seller-auth/me",
          status,
          message  : msg,
        });

        if (status === 401) {
          /* Token really is invalid — clear it */
          clearSellerToken();
          setHasToken(false);
          setError("Your session has expired. Please sign in again.");
          setErrorCode("TOKEN_EXPIRED");

        } else if (status === 404) {
          /* User doesn't exist in market.users anymore */
          clearSellerToken();
          setHasToken(false);
          setError("Seller account not found. Please sign in.");
          setErrorCode("NOT_SELLER_ACCOUNT");

        } else if (status === 0 || !meErr.response) {
          /* Network error — DON'T clear token */
          console.warn("[SellerDashboard] Network error — keeping token");
          setError("Could not reach server. Please check your connection.");
          setErrorCode("NETWORK");

        } else {
          setError(msg ?? "Session check failed.");
          setErrorCode("SERVER_ERROR");
        }

        setLoading(false);
        clearTimeout(slowTimer);
        return;
      }

      /* Check status */
      if (userRow.status && userRow.status !== "active") {
        clearSellerToken();
        setHasToken(false);
        setError("Your account has been suspended.");
        setErrorCode("ACCOUNT_SUSPENDED");
        setLoading(false);
        clearTimeout(slowTimer);
        return;
      }

      /* ════════════════════════════════════════════════
         STEP 2 — Load vendor profile (optional)
         Failure here does NOT log user out.
      ════════════════════════════════════════════════ */
      setLoadStage("vendor");
      console.log("[SellerDashboard] Step 2: Loading vendor profile…");

      try {
        const { data } = await sellerApi.get(
          "/api/seller-onboarding/status",
          { signal: abortRef.current.signal }
        );

        console.log("[SellerDashboard] vendor status:", data);

        if (data?.vendor) {
          setVendor(data.vendor);
        } else {
          /*
           * ✅ FIX: no vendor is OK — user just hasn't set up store.
           * Show a placeholder vendor so dashboard renders.
           * They can click "Complete Store Setup" to go to onboarding.
           */
          console.log("[SellerDashboard] No vendor profile — using placeholder");
          setVendor({
            id         : null,
            user_id    : userRow.id,
            store_name : userRow.name ?? "Your Store",
            status     : "pending_setup",
            _placeholder: true,
          });
        }

      } catch (vErr) {
        if (axios.isCancel(vErr) || vErr.name === "CanceledError") return;

        const vStatus = vErr.response?.status;
        console.warn("[SellerDashboard] vendor fetch failed:", vStatus, vErr.message);

        /*
         * ✅ IMPORTANT: Do NOT clear token or redirect on vendor error.
         * Show placeholder vendor so dashboard is usable.
         */
        setVendor({
          id         : null,
          user_id    : userRow.id,
          store_name : userRow.name ?? "Your Store",
          status     : "pending_setup",
          _placeholder : true,
          _error     : vErr.response?.data?.message ?? vErr.message,
        });
      }

    } catch (fatalErr) {
      console.error("[SellerDashboard] Fatal error:", fatalErr);
      setError("Unexpected error. Please refresh the page.");
      setErrorCode("FATAL");
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setLoadStage(null);
    }
  }, []);

  /* ═══════════════════════════════════════════════════════════
     NOTIFICATIONS (unchanged)
  ═══════════════════════════════════════════════════════════ */
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
        console.warn("[SellerDashboard] notifications:", err.message);
      }
    }
  }, []);

  const pollUnreadCount = useCallback(async () => {
    if (!getSellerToken()) return;
    try {
      const { data } = await sellerApi.get(
        "/api/seller/notifications/unread-count"
      );
      if (data?.success) {
        const incoming = data.count ?? 0;
        const prev     = unreadCountRef.current;
        setUnreadCount(incoming);
        unreadCountRef.current = incoming;
        if (incoming > prev) loadNotifications();
      }
    } catch { /* silent */ }
  }, [loadNotifications]);

  const markNotifRead = useCallback(async (id) => {
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
      loadNotifications();
    }
  }, [notifications, loadNotifications]);

  /* Mount */
  useEffect(() => {
    loadSession();
    return () => { abortRef.current?.abort(); };
  }, [loadSession]);

  /* Notifications polling — only when vendor confirmed */
  useEffect(() => {
    if (!vendor || vendor._placeholder) return;
    loadNotifications();
    const t = setInterval(pollUnreadCount, 60_000);
    return () => clearInterval(t);
  }, [vendor, loadNotifications, pollUnreadCount]);

  const pageMap = useMemo(() => ({
    overview  : <Overview  />,
    orders    : <Orders    />,
    products  : <Products  />,
    analytics : <Analytics />,
    payouts   : <Payouts   />,
    settings  : <Settings  />,
  }), []);

  const ctxValue = useMemo(() => ({
    user,
    vendor,
    setVendor,
    reloadVendor: loadSession,
    activePage,
    navigate,
    notifications,
    unreadCount,
    markNotifRead,
    markAllRead,
    reloadNotifications: loadNotifications,
  }), [
    user, vendor, activePage, navigate,
    notifications, unreadCount,
    markNotifRead, markAllRead,
    loadSession, loadNotifications,
  ]);

  /* ═══════════════════════════════════════════════════════════
     RENDER GUARDS
  ═══════════════════════════════════════════════════════════ */

  /* 1. No token → login */
  if (!hasToken && !loading) {
    return <Navigate to="/become-seller" replace />;
  }

  /* 2. Loading */
  if (loading) {
    return <LoadingScreen stage={loadStage} timeoutHit={timeoutHit} />;
  }

  /* 3. Auth error → login */
  if (["TOKEN_EXPIRED", "INVALID_TOKEN", "NOT_SELLER_ACCOUNT",
       "ACCOUNT_SUSPENDED", "NO_TOKEN"].includes(errorCode)) {
    return <Navigate to="/become-seller" replace />;
  }

  /* 4. Other error → show retry */
  if (error && !user) {
    return (
      <ErrorScreen
        error={error}
        code={errorCode}
        raw={errorRaw}
        onRetry={() => {
          setError(null);
          setErrorCode(null);
          setErrorRaw(null);
          loadSession();
        }}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <DashboardContext.Provider value={ctxValue}>
      <div className="sd-root">

        {sidebarOpen && (
          <div
            className="sd-mobile-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside className="sd-sidebar-desktop" aria-label="Sidebar">
          <Sidebar
            vendor={vendor}
            activePage={activePage}
            onNavigate={navigate}
            unreadCount={unreadCount}
            onClose={() => {}}
          />
        </aside>

        {sidebarOpen && (
          <aside className="sd-sidebar-mobile" aria-label="Mobile sidebar">
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

          {/* Setup banner if vendor is a placeholder */}
          {vendor?._placeholder && (
            <div style={{
              margin:       "16px 20px 0",
              padding:      "12px 16px",
              background:   "#fef3c7",
              border:       "1px solid #fde68a",
              borderRadius: 12,
              display:      "flex",
              justifyContent: "space-between",
              alignItems:   "center",
              flexWrap:     "wrap",
              gap:          10,
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "#92400e" }}>
                  🏪 Complete your store setup
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#78350f" }}>
                  Your account is verified but your store isn't set up yet.
                </p>
              </div>
              <button
                onClick={() => { window.location.href = "/become-seller"; }}
                style={{
                  padding:      "8px 16px",
                  background:   "#f59e0b",
                  color:        "white",
                  border:       "none",
                  borderRadius: 8,
                  cursor:       "pointer",
                  fontWeight:   700,
                  fontSize:     13,
                }}
              >
                Set Up Store →
              </button>
            </div>
          )}

          <main className="sd-page-wrap" id="sd-main-content">
            <div key={activePage} className="sd-page-anim">
              {pageMap[activePage] ?? pageMap.overview}
            </div>
          </main>
        </div>

      </div>
    </DashboardContext.Provider>
  );
}