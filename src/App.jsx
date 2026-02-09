import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// -------------------- Core Pages --------------------
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

// -------------------- Marketplace Pages --------------------
import AddProduct from "./pages/Marketplace/AddProduct.jsx";
import ListingDetails from "./pages/Marketplace/ListingDetails.jsx";
import Chat from "./pages/Marketplace/Chat.jsx";

// -------------------- MiniMart Pages --------------------
import AddMiniMartProduct from "./pages/MiniMart/AddProduct.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Core pages */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Marketplace pages */}
        <Route path="/marketplace/add-product" element={<AddProduct />} />
        <Route path="/marketplace/listing/:id" element={<ListingDetails />} />
        <Route path="/marketplace/chat" element={<Chat />} />

        {/* MiniMart pages */}
        <Route path="/minimart/add-product" element={<AddMiniMartProduct />} />
      </Routes>
    </BrowserRouter>
  );
}