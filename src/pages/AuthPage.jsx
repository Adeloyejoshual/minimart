// src/pages/AuthPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

const API = "https://minimart-ivrm.onrender.com/api/users";

export default function AuthPage({ setUser }) {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // 'login' or 'register'
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone_number: "",
    country: "",
    state: "",
    city: "",
  });
  const [loading, setLoading] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // -------------------
  // Login
  // -------------------
  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/login`, {
        email: form.email,
        password: form.password,
      });
      const { user, token } = res.data;

      setUser(user, token); // Set user in App state + toast
      toast.success("Login successful!");
      navigate("/"); // redirect to homepage
    } catch (err) {
      console.error("Login error:", err);
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // -------------------
  // Register
  // -------------------
  const handleRegister = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/register`, {
        name: form.name,
        email: form.email,
        password: form.password,
        phone_number: form.phone_number,
        country: form.country,
        state: form.state,
        city: form.city,
      });

      const { user } = res.data;

      // Optionally auto-login after register
      const loginRes = await axios.post(`${API}/login`, {
        email: form.email,
        password: form.password,
      });
      const { token } = loginRes.data;

      setUser(user, token);
      toast.success("Registration successful!");
      navigate("/"); // redirect to homepage
    } catch (err) {
      console.error("Register error:", err);
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto", padding: 20 }}>
      <h2>{mode === "login" ? "Login" : "Register"}</h2>

      {mode === "register" && (
        <>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Full Name"
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />
          <input
            name="phone_number"
            value={form.phone_number}
            onChange={handleChange}
            placeholder="Phone Number"
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />
          <input
            name="country"
            value={form.country}
            onChange={handleChange}
            placeholder="Country"
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />
          <input
            name="state"
            value={form.state}
            onChange={handleChange}
            placeholder="State"
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />
          <input
            name="city"
            value={form.city}
            onChange={handleChange}
            placeholder="City"
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />
        </>
      )}

      <input
        name="email"
        value={form.email}
        onChange={handleChange}
        placeholder="Email"
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />
      <input
        type="password"
        name="password"
        value={form.password}
        onChange={handleChange}
        placeholder="Password"
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <button
        onClick={mode === "login" ? handleLogin : handleRegister}
        disabled={loading}
        style={{
          width: "100%",
          padding: 10,
          background: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
      </button>

      <p style={{ textAlign: "center" }}>
        {mode === "login"
          ? "Don't have an account? "
          : "Already have an account? "}
        <span
          style={{ color: "#007bff", cursor: "pointer" }}
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Register" : "Login"}
        </span>
      </p>
    </div>
  );
}