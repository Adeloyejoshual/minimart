// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import axios from "axios";
import { Toaster } from "react-hot-toast";

import Homepage from "./pages/Homepage";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Profile from "./pages/Profile";
import Conversations from "./pages/Conversations";
import Chat from "./pages/Chat";
import SellerProfile from "./pages/SellerProfile";
import AuthPage from "./pages/AuthPage";

const API = "https://minimart-ivrm.onrender.com/api/users";

export default function App() {
  const [user, setUser] = useState(null);

  // load logged in user
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    axios
      .get(`${API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null);
      });
  }, []);

  return (
    <Router>
      <Toaster position="top-right" />

      <Routes>
        <Route path="/" element={<Homepage user={user} />} />

        <Route path="/auth" element={<AuthPage setUser={setUser} />} />

        <Route path="/profile" element={<Profile user={user} />} />

        <Route path="/product/:id" element={<ProductDetail user={user} />} />

        <Route path="/seller/:id" element={<SellerProfile user={user} />} />

        <Route path="/minimart/add" element={<AddProduct user={user} />} />

        <Route path="/conversations" element={<Conversations user={user} />} />

        <Route path="/chat/:productId" element={<Chat user={user} />} />
      </Routes>
    </Router>
  );
}