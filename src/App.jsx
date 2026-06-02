// App.js
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useProductCache } from "./context/ProductCacheContext";

// ── Pages — Public ────────────────────────────────────────────
import Homepage        from "./pages/Homepage";
import SearchPage      from "./pages/SearchPage";
import ProductDetail   from "./pages/ProductDetail";
import SellerProfile   from "./pages/SellerProfile";
import TermsAndConditions from "./pages/TermsAndConditions";
import MinimartPage    from "./pages/MinimartPage";
import P2P             from "./pages/P2P";
import MenuPage        from "./pages/MenuPage";

// ── Pages — Homepage Sub-pages ────────────────────────────────
import NearbyPage      from "./Homepage/pages/NearbyPage";
import DealsPage       from "./Homepage/pages/DealsPage";
import NewArrivalsPage from "./Homepage/pages/NewArrivalsPage";
import TrendingPage    from "./Homepage/TrendingPage";

// ── Pages — Auth ──────────────────────────────────────────────
import AuthPage        from "./pages/AuthPage";

// ── Pages — Seller ────────────────────────────────────────────
import BecomeSeller    from "./pages/BecomeSeller";
import SellerDashboard from "./pages/SellerDashboard";

// ── Pages — User Protected ────────────────────────────────────
import Profile         from "./pages/Profile";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage    from "./pages/SettingsPage";
import AddProduct      from "./pages/AddProduct";
import Conversations   from "./pages/Conversations";
import Chat            from "./pages/Chat";
import Coupons         from "./pages/Coupons";
import Dashboard       from "./pages/Dashboard";
import Leaderboard     from "./pages/Leaderboard";
import Verification    from "./pages/Verification";
import Wallet          from "./pages/Wallet";
import FAQ             from "./pages/FAQ";
import Complain        from "./pages/Complain";
import Support         from "./pages/Support";
import Invitation      from "./pages/Invitation";
import PostAds         from "./pages/PostAds";
import PaymentSuccess  from "./pages/PaymentSuccess";

// ── Pages — Admin ─────────────────────────────────────────────
import AdminLogin      from "./pages/admin/AdminLogin";
import AdminDashboard  from "./pages/admin/AdminDashboard";

// ─────────────────────────────────────────────────────────────

export default function App() {
  const [user,           setUser]           = useState(null);
  const [admin,          setAdmin]          = useState(null);
  const [loadingUser,    setLoadingUser]    = useState(true);
  const [loadingAdmin,   setLoadingAdmin]   = useState(true);
  const [timeoutReached, setTimeoutReached] = useState(false);

  const { resetCache } = useProductCache();

  // ── API base URLs ───────────────────────────────────────────
  const USERS_API = "https://minimart-ivrm.onrender.com/api/users";
  const AUTH_API  = "https://minimart-ivrm.onrender.com/api/auth";

  /* ═══════════════════════════════════════════════════════════
     USER AUTH
     Tries /api/users/me first  (existing marketplace users)
     Falls back to /api/auth/me (seller-registered users)
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoadingUser(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    axios
      .get(`${USERS_API}/me`, { headers, timeout: 8000 })
      .then((res) => {
        setUser(res.data);
        setLoadingUser(false);
      })
      .catch((err) => {
        // Existing route failed — try seller auth route
        if (
          err.response?.status === 401 ||
          err.response?.status === 404  ||
          !err.response                 // network / timeout
        ) {
          axios
            .get(`${AUTH_API}/me`, { headers, timeout: 8000 })
            .then((res) => {
              // Normalise to match what your app expects
              setUser(res.data.user ?? res.data);
            })
            .catch(() => {
              localStorage.removeItem("token");
              setUser(null);
            })
            .finally(() => setLoadingUser(false));
        } else {
          localStorage.removeItem("token");
          setUser(null);
          setLoadingUser(false);
        }
      });
  }, []);

  /* ═══════════════════════════════════════════════════════════
     ADMIN AUTH
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const token       = localStorage.getItem("admin_token");
    const storedAdmin = localStorage.getItem("admin");

    if (!token || !storedAdmin) {
      setLoadingAdmin(false);
      return;
    }

    try {
      setAdmin(JSON.parse(storedAdmin));
    } catch {
      localStorage.removeItem("admin");
      localStorage.removeItem("admin_token");
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  /* ═══════════════════════════════════════════════════════════
     SLOW SERVER TIMEOUT MESSAGE
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const timer = setTimeout(() => setTimeoutReached(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  /* ═══════════════════════════════════════════════════════════
     LOADING SCREEN
  ═══════════════════════════════════════════════════════════ */
  const isAppLoading = loadingUser || loadingAdmin;

  if (isAppLoading) {
    return (
      <div className="global-loader">
        <div className="logo">Minimart</div>
        <div className="spinner" />
        <p>
          {timeoutReached
            ? "Waking up server... please wait"
            : "Loading Minimart..."}
        </p>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     ROUTE GUARDS
  ═══════════════════════════════════════════════════════════ */
  const ProtectedRoute = ({ children }) => {
    const location = useLocation();
    if (!user) {
      return (
        <Navigate
          to="/auth"
          state={{ from: location }}
          replace
        />
      );
    }
    return children;
  };

  const AdminProtectedRoute = ({ children }) => {
    if (!admin) return <Navigate to="/admin/login" replace />;
    return children;
  };

  /* ═══════════════════════════════════════════════════════════
     AUTH SUCCESS HANDLER
     Called by AuthPage after successful login
  ═══════════════════════════════════════════════════════════ */
  const handleAuthSuccess = (userData, token, navigateFn, from) => {
    localStorage.setItem("token", token);

    // Wipe stale cache from previous session
    resetCache();
    localStorage.removeItem("lastLocation");
    localStorage.removeItem("active_location");
    localStorage.removeItem("cacheTime");

    setUser(userData);
    toast.success(`Welcome back, ${userData.name}`);

    // Navigate to where they came from, or home
    navigateFn(from || "/", { replace: true });
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style:   { padding: "10px 14px", borderRadius: 8, color: "#fff" },
          success: { style: { background: "#16a34a" } },
          error:   { style: { background: "#dc2626" } },
        }}
      />

      <Routes>

        {/* ══════════════════════════════════════════════════
            PUBLIC ROUTES
        ══════════════════════════════════════════════════ */}
        <Route
          path="/"
          element={<Homepage key={user?.id || "guest"} user={user} />}
        />
        <Route path="/search"         element={<SearchPage user={user} />} />
        <Route path="/product/:slug"  element={<ProductDetail user={user} />} />
        <Route path="/seller/:id"     element={<SellerProfile user={user} />} />
        <Route path="/terms"          element={<TermsAndConditions />} />
        <Route path="/minimart"       element={<MinimartPage user={user} />} />
        <Route path="/p2p"            element={<P2P user={user} />} />
        <Route path="/menu"           element={<MenuPage />} />

        {/* ── Homepage sub-pages ──────────────────────────── */}
        <Route path="/nearby"   element={<NearbyPage      user={user} />} />
        <Route path="/deals"    element={<DealsPage       user={user} />} />
        <Route path="/latest"   element={<NewArrivalsPage user={user} />} />
        <Route path="/trending" element={<TrendingPage    user={user} />} />

        {/* ══════════════════════════════════════════════════
            AUTH
        ══════════════════════════════════════════════════ */}
        <Route
          path="/auth"
          element={
            user
              ? <Navigate to="/" replace />
              : <AuthPage setUser={handleAuthSuccess} />
          }
        />

        {/* ══════════════════════════════════════════════════
            SELLER ONBOARDING
            ✅ NOT inside ProtectedRoute —
               step 0 IS the register/login screen
               user prop lets hook skip to store setup
               if already logged in
        ══════════════════════════════════════════════════ */}
        <Route
          path="/become-seller"
          element={<BecomeSeller user={user} />}
        />

        {/* ── Seller dashboard — requires auth ────────────── */}
        <Route
          path="/seller/dashboard"
          element={
            <ProtectedRoute>
              <SellerDashboard user={user} />
            </ProtectedRoute>
          }
        />

        {/* ══════════════════════════════════════════════════
            USER PROTECTED ROUTES
        ══════════════════════════════════════════════════ */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/minimart/add"
          element={
            <ProtectedRoute>
              <AddProduct user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/conversations"
          element={
            <ProtectedRoute>
              <Conversations user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:threadId"
          element={
            <ProtectedRoute>
              <Chat user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coupons"
          element={
            <ProtectedRoute>
              <Coupons user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Leaderboard user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification"
          element={
            <ProtectedRoute>
              <Verification user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet"
          element={
            <ProtectedRoute>
              <Wallet user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faq"
          element={
            <ProtectedRoute>
              <FAQ user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/complain"
          element={
            <ProtectedRoute>
              <Complain user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <Support user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invitation"
          element={
            <ProtectedRoute>
              <Invitation user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/minimart/post-ad"
          element={
            <ProtectedRoute>
              <PostAds user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment/success"
          element={<PaymentSuccess />}
        />

        {/* ══════════════════════════════════════════════════
            ADMIN ROUTES
        ══════════════════════════════════════════════════ */}
        <Route
          path="/admin"
          element={
            admin
              ? <Navigate to="/admin/dashboard" replace />
              : <Navigate to="/admin/login"     replace />
          }
        />
        <Route
          path="/admin/login"
          element={<AdminLogin setAdmin={setAdmin} />}
        />
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />

        {/* ══════════════════════════════════════════════════
            FALLBACK
        ══════════════════════════════════════════════════ */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}