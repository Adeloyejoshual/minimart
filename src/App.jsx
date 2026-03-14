import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import SellerProfile from "./pages/SellerProfile";

export default function App() {
  return (
    <Router>
      <Routes>

        <Route path="/" element={<Homepage />} />

        <Route path="/product/:id" element={<ProductDetail />} />

        <Route path="/seller/:id" element={<SellerProfile />} />

        <Route path="/minimart/add" element={<AddProduct />} />

      </Routes>
    </Router>
  );
}