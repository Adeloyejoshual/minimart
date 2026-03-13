import React, { useState } from "react";
import axios from "axios";

export default function Homepage() {
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");

  const API_BASE = "/api/users"; // make sure server.js uses this route

  // -------------------
  // Handle Registration
  // -------------------
  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await axios.post(`${API_BASE}/register`, registerData);
      setMessage(res.data.message);
      setRegisterData({ name: "", email: "", password: "" });
    } catch (err) {
      setMessage(
        err.response?.data?.message || "Registration failed. Try again."
      );
    }
  };

  // -------------------
  // Handle Login
  // -------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await axios.post(`${API_BASE}/login`, loginData);
      setMessage(res.data.message);
      setLoginData({ email: "", password: "" });
      // You can store user info in localStorage or context here
      localStorage.setItem("user", JSON.stringify(res.data.user));
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed. Try again.");
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "auto", padding: "20px" }}>
      <h1>MiniMart</h1>

      {message && (
        <div
          style={{
            marginBottom: "20px",
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            backgroundColor: "#f8f8f8",
          }}
        >
          {message}
        </div>
      )}

      {/* ---------------- Register ---------------- */}
      <form onSubmit={handleRegister} style={{ marginBottom: "40px" }}>
        <h2>Register</h2>
        <input
          type="text"
          placeholder="Name"
          value={registerData.name}
          onChange={(e) =>
            setRegisterData({ ...registerData, name: e.target.value })
          }
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <input
          type="email"
          placeholder="Email"
          value={registerData.email}
          onChange={(e) =>
            setRegisterData({ ...registerData, email: e.target.value })
          }
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={registerData.password}
          onChange={(e) =>
            setRegisterData({ ...registerData, password: e.target.value })
          }
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <button type="submit" style={{ padding: "10px 20px" }}>
          Register
        </button>
      </form>

      {/* ---------------- Login ---------------- */}
      <form onSubmit={handleLogin}>
        <h2>Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={loginData.email}
          onChange={(e) =>
            setLoginData({ ...loginData, email: e.target.value })
          }
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={loginData.password}
          onChange={(e) =>
            setLoginData({ ...loginData, password: e.target.value })
          }
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <button type="submit" style={{ padding: "10px 20px" }}>
          Login
        </button>
      </form>
    </div>
  );
}