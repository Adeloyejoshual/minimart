// src/App.jsx
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";
import MiniMartBottomNav from "./components/MiniMartBottomNav";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    // Your login logic, e.g., show login form
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    // Clear token & logout
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Homepage isAuthenticated={isAuthenticated} />} />
        <Route path="/minimart/add" element={<AddProduct isAuthenticated={isAuthenticated} />} />
      </Routes>

      <MiniMartBottomNav
        isAuthenticated={isAuthenticated}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    </Router>
  );
}