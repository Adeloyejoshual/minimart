// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Profile from "./pages/Profile";          // General profile page
import Conversations from "./pages/Conversations";
import Chat from "./pages/Chat";               // Chat page
import SellerProfile from "./pages/SellerProfile";

export default function App() {
  const [user, setUser] = useState(null);

  // Load logged-in user from localStorage
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Optional: fetch full user profile from API
      setUser({ id: "user-id", name: "User" }); // Placeholder
    }
  }, []);

  // Protected route wrapper
  const ProtectedRoute = ({ children }) => {
    if (!user) return <Navigate to="/" replace />;
    return children;
  };

  return (
    <Router>
      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<Homepage user={user} />} />
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

        {/* Fallback for undefined routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}