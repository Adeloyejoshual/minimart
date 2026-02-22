// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage.jsx";
import AddProduct from "./pages/Marketplace/AddProduct.jsx";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/add-product"
          element={<AddProduct />}
        />
      </Routes>
    </Router>
  );
}

export default App;