import React from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

// -------------------- Marketplace Pages --------------------
import MarketplaceListingDetailsPage from "./pages/marketplace/MarketplaceListingDetailsPage.jsx";
import MarketplaceAddProductPage from "./pages/marketplace/MarketplaceAddProductPage.jsx";
import MarketplaceChatPage from "./pages/marketplace/MarketplaceChatPage.jsx";

export default function App() {
  return (
    <Routes>
      {/* Core pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Marketplace pages */}
      <Route path="/marketplace/listing/:id" element={<MarketplaceListingDetailsPage />} />
      <Route path="/marketplace/add-product" element={<MarketplaceAddProductPage />} />
      <Route path="/marketplace/chat" element={<MarketplaceChatPage />} />
    </Routes>
  );
}