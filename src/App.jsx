// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Profile from "./pages/Profile";
import Conversations from "./pages/Conversations";
import Chat from "./pages/Chat";
import SellerProfile from "./pages/SellerProfile";
import AuthPage from "./pages/AuthPage";
import axios from "axios";

export default function App() {
  const [user, setUser] = useState(null);
  const API = "https://minimart-ivrm.onrender.com/api/users";

  // Load logged-in user from localStorage
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Fetch actual user profile
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

  // Protected route wrapper
  const ProtectedRoute = ({ children }) => {
    if (!user) return <Navigate to="/auth" replace />;
    return children;
  };

  return (
    <Router>
      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<Homepage user={user} />} />
        <Route path="/auth" element={<AuthPage setUser={setUser} />} />
        <Route path="/product/:id" element={<ProductDetail user={user} />} />
        <Route path="/seller/:id" element={<SellerProfile user={user} />} />

        {/* Logged-in User Pages */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile user={user} />
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

        {/* Messaging Pages */}
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