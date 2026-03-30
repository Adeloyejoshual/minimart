// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

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

// Profile sub-pages
import Coupons from "./pages/Profile/Coupons";
import Dashboard from "./pages/Profile/Dashboard";
import Leaderboard from "./pages/Profile/Leaderboard";
import Verification from "./pages/Profile/Verification";
import Wallet from "./pages/Profile/Wallet";

// Admin
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";

/* ================= APP ================= */
export default function App() {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const API = "https://minimart-ivrm.onrender.com/api/users";

  /* ================= LOAD USER ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoadingUser(false);
      return;
    }

    axios
      .get(`${API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setLoadingUser(false));
  }, []);

  /* ================= LOAD ADMIN ================= */
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

  /* ================= GLOBAL LOADING ================= */
  const isAppLoading = loadingUser || loadingAdmin;

  if (isAppLoading) {
    return (
      <div className="global-loader">
        <div className="spinner"></div>
        <p>Loading Minimart...</p>
      </div>
    );
  }

  /* ================= ROUTE GUARDS ================= */
  const ProtectedRoute = ({ children }) => {
    return user ? children : <Navigate to="/auth" replace />;
  };

  const AdminProtectedRoute = ({ children }) => {
    return admin ? children : <Navigate to="/admin/login" replace />;
  };

  /* ================= AUTH HANDLER ================= */
  const handleAuthSuccess = (userData, token) => {
    localStorage.setItem("token", token);
    setUser(userData);
    toast.success(`Welcome back, ${userData.name}`);
  };

  /* ================= APP ================= */
  return (
    <Router>
      {/* Toast */}
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
        <Route path="/" element={<Homepage user={user} />} />
        <Route path="/search" element={<SearchPage user={user} />} />
        <Route path="/product/:id" element={<ProductDetail user={user} />} />
        <Route path="/seller/:id" element={<SellerProfile user={user} />} />
        <Route path="/auth" element={<AuthPage setUser={handleAuthSuccess} />} />
        <Route path="/terms" element={<TermsAndConditions />} />

        {/* ================= USER PROTECTED ================= */}
        <Route path="/profile" element={<ProtectedRoute><Profile user={user} /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage user={user} /></ProtectedRoute>} />
        <Route path="/minimart/add" element={<ProtectedRoute><AddProduct user={user} /></ProtectedRoute>} />
        <Route path="/conversations" element={<ProtectedRoute><Conversations user={user} /></ProtectedRoute>} />
        <Route path="/chat/:productId" element={<ProtectedRoute><Chat user={user} /></ProtectedRoute>} />
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