// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AddMiniMartProduct from "./pages/MiniMart/AddProduct";
import AddMarketplaceProduct from "./pages/Marketplace/AddProduct";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/minimart/add-product" element={<AddMiniMartProduct />} />
        <Route path="/marketplace/add-product" element={<AddMarketplaceProduct />} />
      </Routes>
    </Router>
  );
}