// src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const [step, setStep] = useState("login"); // login, register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const API_URL = import.meta.env.VITE_API_URL;

  // Fetch products
  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/marketplace`);
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Register
  const register = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/register`, { name, email, password });
      setUser(res.data);
      alert("Registered successfully!");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Login
  const login = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/login`, { email, password });
      setUser(res.data);
      alert("Logged in successfully!");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // Send verification code (using your OAuth2 sendMail)
  const sendCode = async () => {
    try {
      const res = await axios.post(`${API_URL}/api/send-code`, { email });
      alert("Verification code sent to your Gmail!");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (user) return <h1>Welcome, {user.name}!</h1>;

  return (
    <div style={{ padding: 20 }}>
      <h2>{step === "register" ? "Register" : "Login"}</h2>

      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {step === "register" && (
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <br />
        {step === "register" ? (
          <button onClick={register}>Register</button>
        ) : (
          <button onClick={login}>Login</button>
        )}
        <button onClick={() => setStep(step === "register" ? "login" : "register")}>
          {step === "register" ? "Go to Login" : "Go to Register"}
        </button>
        <button onClick={sendCode}>Send Gmail Code</button>
      </div>

      <h2>MiniMart Products</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #ddd",
              padding: 10,
              width: 200,
              borderRadius: 6,
            }}
          >
            <h3>{p.title}</h3>
            <p>{p.description}</p>
            <strong>₦{p.price}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}