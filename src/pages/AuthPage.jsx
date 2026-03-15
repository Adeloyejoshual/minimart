// src/pages/AuthPage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "https://minimart-ivrm.onrender.com/api/users";

export default function AuthPage({ setUser }) {
  const navigate = useNavigate();

  // Toggle between login and register
  const [isLogin, setIsLogin] = useState(true);

  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone_number: "",
    country: "",
    state: "",
    city: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // -------------------
  // Login
  // -------------------
  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API}/login`, {
        email: form.email,
        password: form.password,
      });
      const { token, user } = res.data;

      // Store token in localStorage (keeps user logged in)
      localStorage.setItem("token", token);

      // Update parent App state
      setUser(user);

      // Redirect to homepage
      navigate("/");
    } catch (err) {
      console.error("Login failed:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Login failed");
    }
  };

  // -------------------
  // Register
  // -------------------
  const handleRegister = async () => {
    const { name, email, password, phone_number, country, state, city } = form;
    if (!name || !email || !password || !phone_number || !country || !state || !city) {
      alert("All fields are required");
      return;
    }

    try {
      const res = await axios.post(`${API}/register`, {
        name, email, password, phone_number, country, state, city
      });

      const user = res.data.user;

      // Optionally auto-login after register
      const loginRes = await axios.post(`${API}/login`, {
        email,
        password,
      });
      const { token } = loginRes.data;
      localStorage.setItem("token", token);
      setUser(user);

      // Redirect to homepage
      navigate("/");

    } catch (err) {
      console.error("Register failed:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto", padding: 20 }}>
      <h1>{isLogin ? "Login" : "Register"}</h1>

      {!isLogin && (
        <input
          type="text"
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />
      )}

      <input
        type="email"
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <input
        type="password"
        name="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      {!isLogin && (
        <>
          <input
            type="text"
            name="phone_number"
            placeholder="Phone Number"
            value={form.phone_number}
            onChange={handleChange}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />
          <input
            type="text"
            name="country"
            placeholder="Country"
            value={form.country}
            onChange={handleChange}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />
          <input
            type="text"
            name="state"
            placeholder="State"
            value={form.state}
            onChange={handleChange}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />
          <input
            type="text"
            name="city"
            placeholder="City"
            value={form.city}
            onChange={handleChange}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />
        </>
      )}

      <button
        onClick={isLogin ? handleLogin : handleRegister}
        style={{
          width: "100%",
          padding: 10,
          background: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: 5,
          marginBottom: 10,
          cursor: "pointer",
        }}
      >
        {isLogin ? "Login" : "Register"}
      </button>

      <p style={{ textAlign: "center", cursor: "pointer" }} onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
      </p>
    </div>
  );
}