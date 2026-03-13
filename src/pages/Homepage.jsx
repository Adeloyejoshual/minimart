import React, { useState } from "react";
import axios from "axios";

export default function Homepage() {
  const [mode, setMode] = useState("login"); // "login" | "register" | "verify"
  const [form, setForm] = useState({ name: "", email: "", password: "", code: "" });
  const [message, setMessage] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // -------------------
  // Register
  // -------------------
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("/api/users/register", {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      setMessage(res.data.message);
      setMode("verify");
    } catch (err) {
      setMessage(err.response?.data?.message || "Registration failed");
    }
  };

  // -------------------
  // Verify email
  // -------------------
  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("/api/users/verify", {
        email: form.email,
        code: form.code,
      });
      setMessage(res.data.message);
      setMode("login");
      setForm({ ...form, code: "" });
    } catch (err) {
      setMessage(err.response?.data?.message || "Verification failed");
    }
  };

  // -------------------
  // Login
  // -------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("/api/users/login", {
        email: form.email,
        password: form.password,
      });
      setMessage(res.data.message + " Welcome " + res.data.user.name);
      setForm({ name: "", email: "", password: "", code: "" });
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "50px auto", padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ textAlign: "center" }}>
        {mode === "login" && "Login"}
        {mode === "register" && "Register"}
        {mode === "verify" && "Verify Email"}
      </h2>

      {message && <p style={{ color: "green", textAlign: "center" }}>{message}</p>}

      {mode === "register" && (
        <form onSubmit={handleRegister}>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: 8, margin: "8px 0" }}
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: 8, margin: "8px 0" }}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: 8, margin: "8px 0" }}
          />
          <button type="submit" style={{ width: "100%", padding: 10, marginTop: 10 }}>Register</button>
          <p style={{ textAlign: "center", marginTop: 10 }}>
            Already have an account? <span style={{ color: "blue", cursor: "pointer" }} onClick={() => setMode("login")}>Login</span>
          </p>
        </form>
      )}

      {mode === "verify" && (
        <form onSubmit={handleVerify}>
          <input
            type="text"
            name="code"
            placeholder="Enter verification code"
            value={form.code}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: 8, margin: "8px 0" }}
          />
          <button type="submit" style={{ width: "100%", padding: 10, marginTop: 10 }}>Verify</button>
          <p style={{ textAlign: "center", marginTop: 10 }}>
            Didn't receive code? <span style={{ color: "blue", cursor: "pointer" }} onClick={() => setMode("register")}>Resend</span>
          </p>
        </form>
      )}

      {mode === "login" && (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: 8, margin: "8px 0" }}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: 8, margin: "8px 0" }}
          />
          <button type="submit" style={{ width: "100%", padding: 10, marginTop: 10 }}>Login</button>
          <p style={{ textAlign: "center", marginTop: 10 }}>
            Don't have an account? <span style={{ color: "blue", cursor: "pointer" }} onClick={() => setMode("register")}>Register</span>
          </p>
        </form>
      )}
    </div>
  );
}