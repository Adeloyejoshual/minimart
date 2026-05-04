import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

/* ================= HOMEPAGE SUB-PAGES ================= */
import Homepage        from "./pages/Homepage";
import TrendingPage    from "./pages/Homepage/TrendingPage";
import DealsPage       from "./pages/Homepage/DealsPage";
import NewArrivalsPage from "./pages/Homepage/NewArrivalsPage";
import NearbyPage      from "./pages/Homepage/NearbyPage";

/* ================= OTHER PAGES ================= */
import SearchPage         from "./pages/SearchPage";
import AddProduct         from "./pages/AddProduct";
import ProductDetail      from "./pages/ProductDetail";
import Profile            from "./pages/Profile";
import SettingsPage       from "./pages/SettingsPage";
import Conversations      from "./pages/Conversations";
import Chat               from "./pages/Chat";
import SellerProfile      from "./pages/SellerProfile";
import AuthPage           from "./pages/AuthPage";
import BecomeSeller       from "./pages/BecomeSeller";
import FAQ                from "./pages/FAQ";
import Complain           from "./pages/Complain";
import Support            from "./pages/Support";
import Invitation         from "./pages/Invitation";
import TermsAndConditions from "./pages/TermsAndConditions";
import MenuPage           from "./pages/MenuPage";

/* ================= PROFILE SUB-PAGES ================= */
import Coupons      from "./pages/Profile/Coupons";
import Dashboard    from "./pages/Profile/Dashboard";
import Leaderboard  from "./pages/Profile/Leaderboard";
import Verification from "./pages/Profile/Verification";
import Wallet       from "./pages/Profile/Wallet";

/* ================= ADMIN ================= */
import AdminLogin     from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";

// ─── Route Guards ─────────────────────────────────────────────────────────────

/**
 * ProtectedRoute — redirects to /auth when the user is not logged in.
 * Shows a minimal spinner while the auth check is still in flight.
 */
const ProtectedRoute = ({ children, user, isAuthReady }) => {
  if (!isAuthReady) return <div className="global-loader"><div className="spinner" /></div>;
  if (!user)        return <Navigate to="/auth" replace />;
  return children;
};

/**
 * AdminProtectedRoute — redirects to /admin/login when there is no admin session.
 */
const AdminProtectedRoute = ({ children, admin, isAuthReady }) => {
  if (!isAuthReady) return <div className="global-loader"><div className="spinner" /></div>;
  if (!admin)       return <Navigate to="/admin/login" replace />;
  return children;
};

// ─── Router factory ───────────────────────────────────────────────────────────

const buildRouter = ({ user, admin, isAuthReady, handleAuthSuccess }) => {
  // Shorthand wrappers keep route definitions readable
  const guarded = (element) => (
    <ProtectedRoute user={user} isAuthReady={isAuthReady}>
      {element}
    </ProtectedRoute>
  );

  const adminGuarded = (element) => (
    <AdminProtectedRoute admin={admin} isAuthReady={isAuthReady}>
      {element}
    </AdminProtectedRoute>
  );

  return createBrowserRouter([
    // ── Public ───────────────────────────────────────────────────────────────
    { path: "/",               element: <Homepage        user={user} /> },
    { path: "/trending",       element: <TrendingPage    user={user} /> },
    { path: "/deals",          element: <DealsPage       user={user} /> },
    { path: "/latest",         element: <NewArrivalsPage user={user} /> },
    { path: "/nearby",         element: <NearbyPage      user={user} /> },
    { path: "/search",         element: <SearchPage      user={user} /> },
    { path: "/product/:slug",  element: <ProductDetail   user={user} /> },
    { path: "/seller/:id",     element: <SellerProfile   user={user} /> },
    { path: "/terms",          element: <TermsAndConditions /> },
    { path: "/menu",           element: <MenuPage /> },
    {
      path: "/auth",
      // Already logged in → send home instead of showing the auth page
      element: user
        ? <Navigate to="/" replace />
        : <AuthPage setUser={handleAuthSuccess} />,
    },

    // ── Protected (must be logged in) ────────────────────────────────────────
    { path: "/profile",         element: guarded(<Profile       user={user} />) },
    { path: "/dashboard",       element: guarded(<Dashboard     user={user} />) },
    { path: "/coupons",         element: guarded(<Coupons       user={user} />) },
    { path: "/leaderboard",     element: guarded(<Leaderboard   user={user} />) },
    { path: "/verification",    element: guarded(<Verification  user={user} />) },
    { path: "/wallet",          element: guarded(<Wallet        user={user} />) },
    { path: "/settings",        element: guarded(<SettingsPage  user={user} />) },
    { path: "/minimart/add",    element: guarded(<AddProduct    user={user} />) },
    { path: "/conversations",   element: guarded(<Conversations user={user} />) },
    { path: "/chat/:productId", element: guarded(<Chat          user={user} />) },
    { path: "/become-seller",   element: guarded(<BecomeSeller  user={user} />) },
    { path: "/faq",             element: guarded(<FAQ           user={user} />) },
    { path: "/complain",        element: guarded(<Complain      user={user} />) },
    { path: "/support",         element: guarded(<Support       user={user} />) },
    { path: "/invitation",      element: guarded(<Invitation    user={user} />) },

    // ── Admin ────────────────────────────────────────────────────────────────
    {
      path: "/admin",
      element: admin
        ? <Navigate to="/admin/dashboard" replace />
        : <Navigate to="/admin/login"     replace />,
    },
    { path: "/admin/login",     element: <AdminLogin /> },
    { path: "/admin/dashboard", element: adminGuarded(<AdminDashboard />) },

    // ── Fallback ─────────────────────────────────────────────────────────────
    { path: "*", element: <Navigate to="/" replace /> },
  ]);
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const [user,           setUser]           = useState(null);
  const [admin,          setAdmin]          = useState(null);
  const [loadingUser,    setLoadingUser]    = useState(true);
  const [loadingAdmin,   setLoadingAdmin]   = useState(true);
  const [timeoutReached, setTimeoutReached] = useState(false);

  const API = "https://minimart-ivrm.onrender.com/api/users";

  // ── User auth check ────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setLoadingUser(false); return; }

    axios
      .get(`${API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      })
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setLoadingUser(false));
  }, []);

  // ── Admin auth check ───────────────────────────────────────────────────────
  useEffect(() => {
    const token       = localStorage.getItem("admin_token");
    const storedAdmin = localStorage.getItem("admin");
    if (!token || !storedAdmin) { setLoadingAdmin(false); return; }

    try {
      setAdmin(JSON.parse(storedAdmin));
    } catch {
      localStorage.removeItem("admin");
      localStorage.removeItem("admin_token");
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  // ── Slow-server timeout message ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setTimeoutReached(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const isAuthReady = !loadingUser && !loadingAdmin;

  const handleAuthSuccess = useCallback((userData, token) => {
    localStorage.setItem("token", token);
    setUser(userData);
    toast.success(`Welcome back, ${userData.name}`);
  }, []);

  // ── Global loading screen (shown until both auth checks complete) ──────────
  if (!isAuthReady) {
    return (
      <div className="global-loader">
        <div className="logo">Minimart</div>
        <div className="spinner" />
        <p>{timeoutReached ? "Waking up server… please wait" : "Loading Minimart…"}</p>
      </div>
    );
  }

  // ── Router — rebuilt only when auth state actually changes ─────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const router = useMemo(
    () => buildRouter({ user, admin, isAuthReady, handleAuthSuccess }),
    [user, admin, isAuthReady, handleAuthSuccess]
  );

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { padding: "10px 14px", borderRadius: 8, color: "#fff" },
          success: { style: { background: "#16a34a" } },
          error:   { style: { background: "#dc2626" } },
        }}
      />
      <RouterProvider router={router} />
    </>
  );
}
