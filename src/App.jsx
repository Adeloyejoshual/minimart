// src/App.jsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

// -------- Lazy-loaded Pages --------
// Core Pages
const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));

// Marketplace Pages
const MarketplaceHome = lazy(() => import("./pages/Marketplace/Home.jsx"));
const AddMarketplaceProduct = lazy(() => import("./pages/Marketplace/AddProduct.jsx"));
const MarketplaceProductDetail = lazy(() => import("./pages/Marketplace/ProductDetail.jsx"));
const MarketplaceChatPage = lazy(() => import("./pages/Marketplace/ChatPage.jsx"));

// MiniMart Pages
const MiniMartHome = lazy(() => import("./pages/MiniMart/Home.jsx"));
const AddMiniMartProduct = lazy(() => import("./pages/MiniMart/AddProduct.jsx"));
const MiniMartProductDetail = lazy(() => import("./pages/MiniMart/ProductDetail.jsx"));

// -------- PrivateRoute Component --------
function PrivateRoute({ children }) {
  const { isAuthenticated, loginWithRedirect, isLoading } = useAuth0();

  if (isLoading) return <p>Loading...</p>;

  if (!isAuthenticated) {
    loginWithRedirect({ redirect_uri: window.location.origin });
    return <p>Redirecting to login...</p>;
  }

  return children;
}

// -------- App Component --------
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p>Loading...</p>}>
        <Routes>
          {/* Core Pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Marketplace */}
          <Route path="/marketplace" element={<MarketplaceHome />} />
          <Route
            path="/marketplace/add"
            element={
              <PrivateRoute>
                <AddMarketplaceProduct />
              </PrivateRoute>
            }
          />
          <Route path="/marketplace/:id" element={<MarketplaceProductDetail />} />
          <Route
            path="/marketplace/chat/:id"
            element={
              <PrivateRoute>
                <MarketplaceChatPage />
              </PrivateRoute>
            }
          />

          {/* MiniMart */}
          <Route path="/minimart" element={<MiniMartHome />} />
          <Route
            path="/minimart/add"
            element={
              <PrivateRoute>
                <AddMiniMartProduct />
              </PrivateRoute>
            }
          />
          <Route path="/minimart/:id" element={<MiniMartProductDetail />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}