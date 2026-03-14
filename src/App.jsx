// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Conversations from "./pages/Conversations";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";           // General logged-in user profile
import SellerProfile from "./pages/SellerProfile"; // Other sellers

export default function App() {
  const [user, setUser] = useState(null);

  // Load logged-in user from localStorage
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Optionally fetch user profile from API
      // For now, placeholder user
      setUser({ id: "user-id", name: "User" });
    }
  }, []);

  // Protected route wrapper
  const ProtectedRoute = ({ children }) => {
    if (!user) return <Navigate to="/" />;
    return children;
  };

  return (
    <Router>
      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<Homepage user={user} />} />
        <Route path="/product/:id" element={<ProductDetail user={user} />} />
        <Route path="/seller/:id" element={<SellerProfile user={user} />} />

        {/* General Profile (logged-in user) */}
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile user={user} />
          </ProtectedRoute>
        } />

        {/* Seller Pages */}
        <Route path="/minimart/add" element={
          <ProtectedRoute>
            <AddProduct user={user} />
          </ProtectedRoute>
        } />

        {/* Messaging Pages */}
        <Route path="/conversations" element={
          <ProtectedRoute>
            <Conversations user={user} />
          </ProtectedRoute>
        } />
        <Route path="/chat/:productId" element={
          <ProtectedRoute>
            <Chat user={user} />
          </ProtectedRoute>
        } />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}