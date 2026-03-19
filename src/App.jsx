// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

// User Pages
import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Profile from "./pages/Profile";
import Coupons from "./pages/Profile/Coupons";
import Dashboard from "./pages/Profile/Dashboard";
import Leaderboard from "./pages/Profile/Leaderboard";
import Verification from "./pages/Profile/Verification";
import Wallet from "./pages/Profile/Wallet";
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

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const API = "https://minimart-ivrm.onrender.com/api/users";

  // Load user from localStorage and server
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios
        .get(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem("token");
          setUser(null);
        })
        .finally(() => setLoadingUser(false));
    } else {
      setLoadingUser(false);
    }
  }, []);

  // Protected route wrapper for users
  const ProtectedRoute = ({ children }) => {
    if (loadingUser) return <div style={{ textAlign: "center", marginTop: "20vh" }}>Loading...</div>;
    if (!user) return <Navigate to="/auth" replace />;
    return children;
  };

  // Admin Protected route wrapper
  const AdminProtectedRoute = ({ children }) => {
    const token = localStorage.getItem("admin_token");
    if (!token) return <Navigate to="/admin/login" replace />;
    return children;
  };

  // Global login/register success handler
  const handleAuthSuccess = (userData, token) => {
    localStorage.setItem("token", token);
    setUser(userData);
    toast.success(`Welcome back, ${userData.name}!`);
  };

  return (
    <Router>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: { padding: "10px 14px", borderRadius: 8, color: "#fff" },
          success: { style: { background: "#28a745" } },
          error: { style: { background: "#dc3545" } },
        }}
      />

      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<Homepage user={user} />} />
        <Route path="/product/:id" element={<ProductDetail user={user} />} />
        <Route path="/seller/:id" element={<SellerProfile user={user} />} />

        {/* Auth Page */}
        <Route path="/auth" element={<AuthPage setUser={handleAuthSuccess} />} />

        {/* Protected Pages for Users */}
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

        {/* Admin Pages */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}