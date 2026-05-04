import React, { useEffect, useState, useCallback } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation,
} from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

/* ================= HOMEPAGE SUB-PAGES ================= */
import Homepage from "./pages/Homepage";
import TrendingPage from "./pages/Homepage/TrendingPage";
import DealsPage from "./pages/Homepage/DealsPage";
import NewArrivalsPage from "./pages/Homepage/NewArrivalsPage";
import NearbyPage from "./pages/Homepage/NearbyPage";

/* ================= OTHER PAGES ================= */
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

// ================= ROUTE GUARD COMPONENTS =================
const ProtectedRoute = ({ children, user, isAuthReady }) => {
  if (!isAuthReady) {
    return <div className="global-loader">Loading auth...</div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

const AdminProtectedRoute = ({ children, admin, isAuthReady }) => {
  if (!isAuthReady) {
    return <div className="global-loader">Loading auth...</div>;
  }
  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
};

function AppContent({ user, admin, isAuthReady, handleAuthSuccess }) {
  return (
    <RouterProvider 
      router={createRouter({ user, admin, isAuthReady, handleAuthSuccess })}
    />
  );
}

function AppLayout() {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [timeoutReached, setTimeoutReached] = useState(false);

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

  const handleAuthSuccess = useCallback((userData, token) => {
    localStorage.setItem("token", token);
    setUser(userData);
    toast.success(`Welcome back, ${userData.name}`);
  }, []);

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

  return (
    <>
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
      <AppContent 
        user={user} 
        admin={admin} 
        isAuthReady={isAuthReady} 
        handleAuthSuccess={handleAuthSuccess}
      />
    </>
  );
}

/* ================= ROUTER CONFIG - NO JSX IN OBJECT LITERALS ================= */
const createRouter = ({ user, admin, isAuthReady, handleAuthSuccess }) =>
  createBrowserRouter([
    // HOMEPAGE SUB-PAGES (Your exact example)
    { path: "/", element: <Homepage user={user} /> },
    { path: "/trending", element: <TrendingPage user={user} /> },
    { path: "/deals", element: <DealsPage user={user} /> },
    { path: "/latest", element: <NewArrivalsPage user={user} /> },
    { path: "/nearby", element: <NearbyPage user={user} /> },

    // PUBLIC ROUTES
    { path: "/search", element: <SearchPage user={user} /> },
    { path: "/product/:slug", element: <ProductDetail user={user} /> },
    { path: "/seller/:id", element: <SellerProfile user={user} /> },
    { path: "/auth", element: <AuthPage setUser={handleAuthSuccess} /> },
    { path: "/terms", element: <TermsAndConditions /> },
    { path: "/menu", element: <MenuPage /> },

    // PROTECTED ROUTES - Using loader pattern for guards
    {
      path: "/profile",
      element: <Profile user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/dashboard",
      element: <Dashboard user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/coupons",
      element: <Coupons user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/leaderboard",
      element: <Leaderboard user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/verification",
      element: <Verification user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/wallet",
      element: <Wallet user={user} />,
      loader: () => ({ user, isAuthReady }),
    },

    // OTHER PROTECTED
    {
      path: "/settings",
      element: <SettingsPage user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/minimart/add",
      element: <AddProduct user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/conversations",
      element: <Conversations user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/chat/:productId",
      element: <Chat user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/become-seller",
      element: <BecomeSeller user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/faq",
      element: <FAQ user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/complain",
      element: <Complain user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/support",
      element: <Support user={user} />,
      loader: () => ({ user, isAuthReady }),
    },
    {
      path: "/invitation",
      element: <Invitation user={user} />,
      loader: () => ({ user, isAuthReady }),
    },

    // ADMIN ROUTES
    {
      path: "/admin",
      loader: () => ({ admin }),
      element: admin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />,
    },
    { path: "/admin/login", element: <AdminLogin /> },
    {
      path: "/admin/dashboard",
      element: <AdminDashboard />,
      loader: () => ({ admin, isAuthReady }),
    },

    // FALLBACK
    { path: "*", element: <Navigate to="/" replace /> },
  ]);

export default AppLayout;