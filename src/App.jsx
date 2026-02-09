import React from "react";
import { Routes, Route } from "react-router-dom";

// Pages
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

// MiniMart
import AddMiniMartProduct from "./pages/MiniMart/AddProduct.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* MiniMart */}
      <Route path="/minimart/add-product" element={<AddMiniMartProduct />} />
    </Routes>
  );
}

export default App;