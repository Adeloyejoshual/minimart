import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";

export default function App() {
  return (
    <Router>
      <Routes>

        <Route path="/" element={<Homepage />} />

        <Route path="/product/:id" element={<ProductDetail />} />

        <Route path="/minimart/add" element={<AddProduct />} />

      </Routes>
    </Router>
  );
}