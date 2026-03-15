// src/App.jsx - Updated with SettingsPage
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/SettingsPage";  // 👈 NEW
import Conversations from "./pages/Conversations";
import Chat from "./pages/Chat";
import SellerProfile from "./pages/SellerProfile";
import AuthPage from "./pages/AuthPage";

export default function App() {
  const [user, setUser] = useState(null);
  const API = "https://minimart-ivrm.onrender.com/api/users";

  // -------------------
  // Load logged-in user from localStorage
  // -------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const fetchUser = async () => {
        try {
          const { data } = await axios.get(`${API}/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(data);
        } catch (err) {
          console.error("Failed to fetch user:", err);
          localStorage.removeItem("token");
          setUser(null);
        }
      };
      fetchUser();
    }
  }, []);

  // -------------------
  // Protected route wrapper
  // -------------------
  const ProtectedRoute = ({ children }) => {
    if (!user) return <Navigate to="/auth" replace />;
    return children;
  };

  // -------------------
  // Handle login/register success globally
  // -------------------
  const handleAuthSuccess = (userData, token) => {
    localStorage.setItem("token", token);
    setUser(userData);
    toast.success(`Welcome back, ${userData.name}!`);
  };

  return (
    <Router>
      {/* Global Toaster */}
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

        {/* Protected Pages */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile user={user} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"  // 👈 NEW SETTINGS ROUTE
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
          path="/chat/:productId"
          element={
            <ProtectedRoute>
              <Chat user={user} />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}