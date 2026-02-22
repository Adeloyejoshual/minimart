// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage.jsx";
import AddProduct from "./pages/Marketplace/AddProduct.jsx";
import ProfilePage from "./pages/ProfilePage.jsx"; // ← Added ProfilePage

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/add-product" element={<AddProduct />} />
        <Route path="/profile" element={<ProfilePage />} /> {/* ← Added */}
      </Routes>
    </Router>
  );
}

export default App;