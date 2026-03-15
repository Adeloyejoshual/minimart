// src/pages/AuthPage.jsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "https://minimart-ivrm.onrender.com/api/users";

export default function AuthPage({ setUser }) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
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
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const res = await axios.post(`${API}/login`, {
          email: form.email,
          password: form.password,
        });
        const { token, user } = res.data;
        localStorage.setItem("token", token);
        setUser(user);
        navigate("/");
      } else {
        // Register
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
        // Auto-login after register
        const loginRes = await axios.post(`${API}/login`, {
          email: form.email,
          password: form.password,
        });
        const { token } = loginRes.data;
        localStorage.setItem("token", token);
        setUser(user);
        navigate("/");
      }
    } catch (err) {
      console.error(err);
      if (err.response?.data?.message) setError(err.response.data.message);
      else setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 500,
        margin: "50px auto",
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: 6,
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>
        {isLogin ? "Login" : "Register"}
      </h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {!isLogin && (
          <>
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={form.name}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="phone_number"
              placeholder="Phone Number"
              value={form.phone_number}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="country"
              placeholder="Country"
              value={form.country}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="state"
              placeholder="State"
              value={form.state}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="city"
              placeholder="City"
              value={form.city}
              onChange={handleChange}
              required
            />
          </>
        )}

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 15px",
            background: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 15 }}>
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <span
          onClick={() => setIsLogin(!isLogin)}
          style={{ color: "#007bff", cursor: "pointer" }}
        >
          {isLogin ? "Register" : "Login"}
        </span>
      </p>
    </div>
  );
}