// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Core Pages
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

// Marketplace Pages
import AddMarketplaceProduct from "./pages/Marketplace/AddProduct.jsx";

// MiniMart Pages
import AddMiniMartProduct from "./pages/MiniMart/AddProduct.jsx";
import MiniMartProductDetail from "./pages/MiniMart/ProductDetail.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ================= Core Pages ================= */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* ================= Marketplace ================= */}
        <Route path="/marketplace/add" element={<AddMarketplaceProduct />} />

        {/* ================= MiniMart ================= */}
        <Route path="/minimart/add" element={<AddMiniMartProduct />} />
        <Route
          path="/minimart/product/:id"
          element={<MiniMartProductDetail />}
        />
      </Routes>
    </BrowserRouter>
  );
}