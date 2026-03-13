// src/pages/Homepage.jsx
import React, { useState } from "react";
import axios from "axios";

export default function Homepage() {
  const [form, setForm] = useState("login"); // "login", "register", "verify"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [userEmailForVerify, setUserEmailForVerify] = useState("");

  const API = process.env.REACT_APP_API_URL || "/api/users";

  // ----------------
  // Register
  // ----------------
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API}/register`, { name, email, password });
      setMessage(data.message);
      setUserEmailForVerify(email);
      setForm("verify"); // Switch to verification form
    } catch (err) {
      setMessage(err.response?.data?.message || "Registration failed");
    }
  };

  // ----------------
  // Verify Email
  // ----------------
  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API}/verify`, { email: userEmailForVerify, code });
      setMessage(data.message);
      setForm("login");
    } catch (err) {
      setMessage(err.response?.data?.message || "Verification failed");
    }
  };

  // ----------------
  // Login
  // ----------------
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API}/login`, { email, password });
      setMessage(data.message + ` Welcome, ${data.user.name}!`);
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "50px auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2 style={{ textAlign: "center" }}>
        {form === "login" && "Login"}
        {form === "register" && "Register"}
        {form === "verify" && "Verify Email"}
      </h2>

      {message && <p style={{ color: "green", textAlign: "center" }}>{message}</p>}

      {form === "register" && (
        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: "100%", margin: "8px 0", padding: 8 }}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", margin: "8px 0", padding: 8 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", margin: "8px 0", padding: 8 }}
          />
          <button type="submit" style={{ width: "100%", padding: 10, marginTop: 10 }}>Register</button>
          <p style={{ textAlign: "center", marginTop: 8 }}>
            Already have an account?{" "}
            <span style={{ color: "blue", cursor: "pointer" }} onClick={() => setForm("login")}>Login</span>
          </p>
        </form>
      )}

      {form === "verify" && (
        <form onSubmit={handleVerify}>
          <p>We sent a 6-digit code to {userEmailForVerify}</p>
          <input
            type="text"
            placeholder="Enter verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            style={{ width: "100%", margin: "8px 0", padding: 8 }}
          />
          <button type="submit" style={{ width: "100%", padding: 10, marginTop: 10 }}>Verify Email</button>
        </form>
      )}

      {form === "login" && (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", margin: "8px 0", padding: 8 }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", margin: "8px 0", padding: 8 }}
          />
          <button type="submit" style={{ width: "100%", padding: 10, marginTop: 10 }}>Login</button>
          <p style={{ textAlign: "center", marginTop: 8 }}>
            Don't have an account?{" "}
            <span style={{ color: "blue", cursor: "pointer" }} onClick={() => setForm("register")}>Register</span>
          </p>
        </form>
      )}
    </div>
  );
}