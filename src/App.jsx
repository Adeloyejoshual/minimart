// src/App.jsx
import React, { useState } from "react";
import axios from "axios";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [user, setUser] = useState(null);
  const [code, setCode] = useState("");
  const [step, setStep] = useState("login"); // login/register/verify

  const register = async () => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/register`, {
        name, email, password
      });
      setUser(res.data);
      alert("Registered successfully");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const login = async () => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/login`, { email, password });
      setUser(res.data);
      alert("Logged in successfully");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const sendCode = async () => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/send-code`, { email });
      alert("Code sent to email");
      setStep("verify");
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  if (user) return <h1>Welcome, {user.name}!</h1>;

  return (
    <div style={{ padding: 20 }}>
      <h2>{step === "verify" ? "Verify Code" : "Login / Register"}</h2>

      {step !== "verify" && (
        <>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          {step === "register" && <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />}
          <br />
          <button onClick={login}>Login</button>
          <button onClick={() => setStep("register")}>Go to Register</button>
          <button onClick={register}>Register</button>
          <button onClick={sendCode}>Send Verification Code</button>
        </>
      )}

      {step === "verify" && (
        <>
          <input placeholder="Enter Code" value={code} onChange={e => setCode(e.target.value)} />
          <button onClick={() => alert("Verify code logic to implement")}>Verify</button>
        </>
      )}
    </div>
  );
}