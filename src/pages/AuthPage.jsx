// src/pages/Auth.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "https://minimart-ivrm.onrender.com/api/users";

export default function Auth({ setUser }) {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone_number: "",
    country: "",
    state: "",
    city: "",
  });
  const [message, setMessage] = useState("");

  // Auto-login if token exists
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Optional: fetch user info from API here
      navigate("/"); // redirect to homepage
    }
  }, [navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const endpoint = isRegister ? "/register" : "/login";
      const { data } = await axios.post(API + endpoint, form);

      // Save token and set user
      localStorage.setItem("token", data.token);
      setUser(data.user);
      navigate("/"); // redirect to homepage
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "auto", padding: 20 }}>
      <h1>{isRegister ? "Register" : "Login"}</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {isRegister && (
          <>
            <input type="text" name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required />
            <input type="text" name="phone_number" placeholder="Phone Number" value={form.phone_number} onChange={handleChange} required />
            <input type="text" name="country" placeholder="Country" value={form.country} onChange={handleChange} required />
            <input type="text" name="state" placeholder="State" value={form.state} onChange={handleChange} required />
            <input type="text" name="city" placeholder="City" value={form.city} onChange={handleChange} required />
          </>
        )}
        <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} required />
        <button type="submit">{isRegister ? "Register" : "Login"}</button>
      </form>

      {message && <p style={{ marginTop: 10, color: "red" }}>{message}</p>}

      <p style={{ marginTop: 20 }}>
        {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
        <span
          style={{ color: "blue", cursor: "pointer" }}
          onClick={() => {
            setIsRegister(!isRegister);
            setMessage("");
          }}
        >
          {isRegister ? "Login here" : "Register here"}
        </span>
      </p>
    </div>
  );
}