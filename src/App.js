// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "./firebase";

/* ================= AUTH PAGES ================= */
import Login from "./pages/Login";
import Register from "./pages/Register";

/* ================= MAIN USER PAGES ================= */
import HomePage from "./pages/HomePage";
import MiniMart from "./pages/MiniMart";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";
import ApplySeller from "./pages/ApplySeller";
import ProductDetail from "./pages/ProductDetail";
import AddProduct from "./pages/AddProduct";
import ChatPage from "./pages/ChatPage";

/* ================= FEATURE PAGES ================= */
import CartPage from "./pages/CartPage";
import MessagesPage from "./pages/MessagesPage";
import SavedItemsPage from "./pages/SavedItemsPage";
import SearchBar from "./pages/SearchBar";
import SelectLocation from "./pages/SelectLocation";
import PriceFiltersPage from "./pages/PriceFiltersPage";

/* ================= ADMIN PAGES ================= */
import AdminPanel from "./pages/AdminPanel";
import AdminManager from "./pages/admin/AdminManager";
import ModeratorPanel from "./pages/admin/ModeratorPanel";
import FinanceAdminPanel from "./pages/admin/FinanceAdminPanel";
import SupportAdminPanel from "./pages/admin/SupportAdminPanel";

/* ================= SUPER ADMIN ================= */
import SuperAdminLogin from "./pages/admin/SuperAdminLogin";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import SuperAdminRoute from "./routes/SuperAdminRoute";

/* ================= PROTECTED WRAPPERS ================= */
function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoleRoute({ user, children }) {
  // TODO: fetch user role from Firestore or context
  if (!user) return <Navigate to="/login" replace />;
  if (!["Admin", "Moderator", "Finance", "Support"].includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

/* ================= ROLE-BASED ADMIN PAGE ================= */
function AdminRolePage() {
  const { role } = useParams();

  switch (role?.toLowerCase()) {
    case "moderator":
      return <ModeratorPanel />;
    case "finance":
      return <FinanceAdminPanel />;
    case "support":
      return <SupportAdminPanel />;
    case "manager":
      return <AdminManager />;
    default:
      return <Navigate to="/admin" replace />;
  }
}

/* ================= APP ================= */
function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      <Routes>

        {/* ================= SUPER ADMIN ================= */}
        <Route path="/superadmin-login" element={<SuperAdminLogin />} />
        <Route
          path="/superadmin/dashboard"
          element={
            <SuperAdminRoute>
              <SuperAdminDashboard />
            </SuperAdminRoute>
          }
        />

        {/* ================= GUEST ROUTES ================= */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />

        {/* ================= NORMAL USER ROUTES ================= */}
        <Route
          path="/"
          element={
            <ProtectedRoute user={user}>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/minimart"
          element={
            <ProtectedRoute user={user}>
              <MiniMart />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketplace"
          element={
            <ProtectedRoute user={user}>
              <Marketplace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute user={user}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Shopping */}
        <Route
          path="/cart"
          element={
            <ProtectedRoute user={user}>
              <CartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saved-items"
          element={
            <ProtectedRoute user={user}>
              <SavedItemsPage />
            </ProtectedRoute>
          }
        />

        {/* Messaging */}
        <Route
          path="/messages"
          element={
            <ProtectedRoute user={user}>
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:sellerId"
          element={
            <ProtectedRoute user={user}>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Search & Filters */}
        <Route
          path="/search"
          element={
            <ProtectedRoute user={user}>
              <SearchBar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/select-location"
          element={
            <ProtectedRoute user={user}>
              <SelectLocation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/price-filters"
          element={
            <ProtectedRoute user={user}>
              <PriceFiltersPage />
            </ProtectedRoute>
          }
        />

        {/* Selling */}
        <Route
          path="/add-product"
          element={
            <ProtectedRoute user={user}>
              <AddProduct />
            </ProtectedRoute>
          }
        />
        <Route
          path="/apply-seller"
          element={
            <ProtectedRoute user={user}>
              <ApplySeller />
            </ProtectedRoute>
          }
        />

        {/* Product */}
        <Route
          path="/product/:productId"
          element={
            <ProtectedRoute user={user}>
              <ProductDetail />
            </ProtectedRoute>
          }
        />

        {/* Admin Panel */}
        <Route
          path="/admin"
          element={
            <AdminRoleRoute user={user}>
              <AdminPanel />
            </AdminRoleRoute>
          }
        />
        <Route
          path="/admin/:role"
          element={
            <AdminRoleRoute user={user}>
              <AdminRolePage />
            </AdminRoleRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />

      </Routes>
    </Router>
  );
}

export default App;