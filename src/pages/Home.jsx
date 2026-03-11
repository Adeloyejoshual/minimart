import React, { useState } from "react";
import axios from "axios";

export default function Home() {
  const [user, setUser] = useState(null);
  const [isRegister, setIsRegister] = useState(false); // toggle form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    try {
      const { data } = await axios.post("/api/auth/login", { email, password });
      setUser(data.user);
      setError("");
      setName(""); setEmail(""); setPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  const register = async () => {
    try {
      const { data } = await axios.post("/api/auth/signup", { name, email, password });
      setUser(data.user);
      setError("");
      setName(""); setEmail(""); setPassword("");
      setIsRegister(false);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  const logout = () => setUser(null);

  return (
    <div style={{ maxWidth: 400, margin: "auto", padding: 20 }}>
      <h1>MiniMart</h1>

      {!user ? (
        <div>
          {isRegister && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button onClick={isRegister ? register : login}>
            {isRegister ? "Register" : "Login"}
          </button>

          <p style={{ color: "blue", cursor: "pointer" }} onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? "Already have an account? Login" : "Don't have an account? Register"}
          </p>

          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      ) : (
        <div>
          <p>Welcome, {user.name}!</p>
          <button onClick={logout}>Logout</button>
        </div>
      )}
    </div>
  );
}