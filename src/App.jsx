import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,  // ← ADD THIS
} from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useProductCache } from "./context/ProductCacheContext";

// ... all your page imports stay exactly the same ...

export default function App() {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [timeoutReached, setTimeoutReached] = useState(false);

  const { resetCache } = useProductCache();
  const API = "https://minimart-ivrm.onrender.com/api/users";

  /* ================= USER AUTH ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadingUser(false);
      return;
    }
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

  /* ================= ADMIN AUTH ================= */
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
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

  /* ================= TIMEOUT ================= */
  useEffect(() => {
    const timer = setTimeout(() => setTimeoutReached(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const isAppLoading = loadingUser || loadingAdmin;

  if (isAppLoading) {
    return (
      <div className="global-loader">
        <div className="logo">Minimart</div>
        <div className="spinner"></div>
        <p>{timeoutReached ? "Waking up server... please wait" : "Loading Minimart..."}</p>
      </div>
    );
  }

  /* ================= ROUTE GUARDS ================= */

  // ✅ FIX: ProtectedRoute now passes current location as "from" state
  const ProtectedRoute = ({ children }) => {
    const location = useLocation();

    if (!user) {
      return (
        <Navigate
          to="/auth"
          state={{ from: location }}  // ← THIS tells AuthPage where to go back
          replace
        />
      );
    }

    return children;
  };

  const AdminProtectedRoute = ({ children }) => {
    if (!admin) {
      return <Navigate to="/admin/login" replace />;
    }
    return children;
  };

  // ✅ FIX: Store redirect path BEFORE resetting, use navigate instead of window.location
  // We pass this as a callback — actual navigation happens inside AuthPage
  const handleAuthSuccess = (userData, token, navigateFn, from) => {
    localStorage.setItem("token", token);

    // Wipe stale cache + location from previous user
    resetCache();
    localStorage.removeItem("lastLocation");
    localStorage.removeItem("active_location");
    localStorage.removeItem("cacheTime");

    setUser(userData);
    toast.success(`Welcome back, ${userData.name}`);

    // ✅ Navigate to where they came from (or "/" as fallback)
    // Using replace:true so back button doesn't go to /auth
    navigateFn(from || "/", { replace: true });
  };

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { padding: "10px 14px", borderRadius: 8, color: "#fff" },
          success: { style: { background: "#16a34a" } },
          error: { style: { background: "#dc2626" } },
        }}
      />

      <Routes>
        {/* ================= PUBLIC ================= */}
        <Route path="/" element={<Homepage key={user?.id || "guest"} user={user} />} />
        <Route path="/search" element={<SearchPage user={user} />} />
        <Route path="/product/:slug" element={<ProductDetail user={user} />} />
        <Route path="/seller/:id" element={<SellerProfile user={user} />} />

        {/* ✅ FIX: Pass handleAuthSuccess — AuthPage will call it with navigate + from */}
        <Route
          path="/auth"
          element={
            // ✅ If already logged in, don't show auth page
            user
              ? <Navigate to="/" replace />
              : <AuthPage setUser={handleAuthSuccess} />
          }
        />

        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/minimart" element={<MinimartPage user={user} />} />
        <Route path="/p2p" element={<P2P user={user} />} />

        {/* ================= HOMEPAGE SUB-PAGES ================= */}
        <Route path="/nearby" element={<NearbyPage user={user} />} />
        <Route path="/deals" element={<DealsPage user={user} />} />
        <Route path="/latest" element={<NewArrivalsPage user={user} />} />
        <Route path="/trending" element={<TrendingPage user={user} />} />

        {/* ================= MENU ================= */}
        <Route path="/menu" element={<MenuPage />} />

        {/* ================= USER PROTECTED ================= */}
        <Route path="/profile" element={<ProtectedRoute><Profile user={user} /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage user={user} /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage user={user} /></ProtectedRoute>} />
        <Route path="/minimart/add" element={<ProtectedRoute><AddProduct user={user} /></ProtectedRoute>} />
        <Route path="/conversations" element={<ProtectedRoute><Conversations user={user} /></ProtectedRoute>} />
        <Route path="/chat/:threadId" element={<ProtectedRoute><Chat user={user} /></ProtectedRoute>} />
        <Route path="/coupons" element={<ProtectedRoute><Coupons user={user} /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard user={user} /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard user={user} /></ProtectedRoute>} />
        <Route path="/verification" element={<ProtectedRoute><Verification user={user} /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet user={user} /></ProtectedRoute>} />
        <Route path="/become-seller" element={<ProtectedRoute><BecomeSeller user={user} /></ProtectedRoute>} />
        <Route path="/faq" element={<ProtectedRoute><FAQ user={user} /></ProtectedRoute>} />
        <Route path="/complain" element={<ProtectedRoute><Complain user={user} /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><Support user={user} /></ProtectedRoute>} />
        <Route path="/invitation" element={<ProtectedRoute><Invitation user={user} /></ProtectedRoute>} />
        <Route path="/minimart/post-ad" element={<ProtectedRoute><PostAds user={user} /></ProtectedRoute>} />
        <Route path="/payment/success" element={<PaymentSuccess />} />

        {/* ================= ADMIN ================= */}
        <Route
          path="/admin"
          element={admin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />}
        />
        <Route path="/admin/login" element={<AdminLogin setAdmin={setAdmin} />} />
        <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />

        {/* ================= FALLBACK ================= */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}