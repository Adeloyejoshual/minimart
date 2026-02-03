import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

// -------------------- Pages --------------------
import HomePage from "./pages/HomePage.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

// MiniMart
import MiniMartCartPage from "./pages/minimart/MiniMartCartPage.jsx";

// Marketplace (simple placeholders for now)
import MarketplaceChatPage from "./pages/marketplace/MarketplaceChatPage.jsx";

// -------------------- Protected Route --------------------
function PrivateRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>; // show loading while checking auth
  if (!isAuthenticated) return <Navigate to="/login" />; // redirect if not logged in

  return children;
}

// -------------------- App --------------------
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected MiniMart Routes */}
        <Route
          path="/minimart/cart"
          element={
            <PrivateRoute>
              <MiniMartCartPage />
            </PrivateRoute>
          }
        />

        {/* Marketplace Routes (for testing, public for now) */}
        <Route path="/marketplace/chat" element={<MarketplaceChatPage />} />

        {/* Catch-all route */}
        <Route path="*" element={<p>Page Not Found</p>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;