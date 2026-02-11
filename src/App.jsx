import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Pages
import HomePage from "./pages/HomePage.jsx";
import AddProduct from "./pages/Home/AddProduct.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home/add-product" element={<AddProduct />} />
      </Routes>
    </BrowserRouter>
  );
}