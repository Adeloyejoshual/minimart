import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useProductCache } from "./context/ProductCacheContext";

/* ================= PAGES ================= */
// User
import Homepage from "./pages/Homepage";
import SearchPage from "./pages/SearchPage";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/SettingsPage";
import Conversations from "./pages/Conversations";
import Chat from "./pages/Chat";
import SellerProfile from "./pages/SellerProfile";
import AuthPage from "./pages/AuthPage";
import BecomeSeller from "./pages/BecomeSeller";
import FAQ from "./pages/FAQ";
import Complain from "./pages/Complain";
import Support from "./pages/Support";
import Invitation from "./pages/Invitation";
import TermsAndConditions from "./pages/TermsAndConditions";
import MinimartPage from "./pages/MinimartPage";
import PostAds from "./pages/PostAds";
/* ================= HOMEPAGE SUB-PAGES ================= */
import NearbyPage from "./pages/Homepage/NearbyPage";
import DealsPage from "./pages/Homepage/DealsPage";
import NewArrivalsPage from "./pages/Homepage/NewArrivalsPage";
import TrendingPage from "./pages/Homepage/TrendingPage";
import NotificationsPage from "./pages/NotificationsPage";

/* ================= MENU PAGE (ADDED) ================= */
import MenuPage from "./pages/MenuPage";

/* ================= PROFILE SUB-PAGES ================= */
import Coupons from "./pages/Profile/Coupons";
import Dashboard from "./pages/Profile/Dashboard";
import Leaderboard from "./pages/Profile/Leaderboard";
import Verification from "./pages/Profile/Verification";
import Wallet from "./pages/Profile/Wallet";

/* ================= ADMIN ================= */
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";

/* ================= APP ================= */
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
  const isAuthReady = !isAppLoading;

  if (isAppLoading) {
    return (
      <div className="global-loader">
        <div className="logo">Minimart</div>
        <div className="spinner"></div>
        <p>
          {timeoutReached
            ? "Waking up server... please wait"
            : "Loading Minimart..."}
        </p>
      </div>
    );
  }

  /* ================= ROUTE GUARDS ================= */
  const ProtectedRoute = ({ children }) => {
    if (!isAuthReady) {
      return <div className="global-loader">Loading auth...</div>;
    }

    if (!user) {
      return <Navigate to="/auth" replace />;
    }

    return children;
  };

  const AdminProtectedRoute = ({ children }) => {
    if (!isAuthReady) {
      return <div className="global-loader">Loading auth...</div>;
    }

    if (!admin) {
      return <Navigate to="/admin/login" replace />;
    }

    return children;
  };

  const handleAuthSuccess = (userData, token) => {
    localStorage.setItem("token", token);

    // Wipe stale cache + location from previous user
    resetCache();
    localStorage.removeItem("lastLocation");
    localStorage.removeItem("active_location");
    localStorage.removeItem("cacheTime");

    setUser(userData);
    toast.success(`Welcome back, ${userData.name}`);

    // Hard reload — forces fresh GPS + clean homepage boot
    window.location.href = "/";
  };

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            padding: "10px 14px",
            borderRadius: 8,
            color: "#fff",
          },
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
        <Route path="/auth" element={<AuthPage setUser={handleAuthSuccess} />} />
        <Route path="/terms" element={<TermsAndConditions />} />
<Route path="/minimart" element={<MinimartPage user={user} />} />
<Route path="/p2p" element={<P2P user={user} />} />

        {/* ================= HOMEPAGE SUB-PAGES ================= */}
        <Route path="/nearby" element={<NearbyPage user={user} />} />
        <Route path="/deals" element={<DealsPage user={user} />} />
        <Route path="/latest" element={<NewArrivalsPage user={user} />} />
        <Route path="/trending" element={<TrendingPage user={user} />} />

        {/* ================= MENU (NEW PAGE) ================= */}
        <Route path="/menu" element={<MenuPage />} />

        {/* ================= USER PROTECTED ================= */}
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
          path="/become-seller"
          element={
            <ProtectedRoute>
              <BecomeSeller user={user} />
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

        {/* ================= ADMIN ================= */}
        <Route
          path="/admin"
          element={
            admin ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <Navigate to="/admin/login" replace />
            )
          }
        />

        <Route path="/admin/login" element={<AdminLogin setAdmin={setAdmin} />} />

        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />

        {/* ================= FALLBACK ================= */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
