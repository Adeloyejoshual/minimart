import React, { useState } from "react";
import axios from "axios";

export default function Home() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    try {
      const { data } = await axios.post("/api/auth/login", { email, password });
      setUser(data.user);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  const logout = () => setUser(null);

  return (
    <div>
      <h1>MiniMart</h1>

      {!user ? (
        <div>
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
          <button onClick={login}>Login</button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      ) : (
        <div>
          <p>Welcome, {user.name}!</p>
          <button onClick={logout}>Logout</button>
        </div>
      )}

      {/* Display products here */}
    </div>
  );
}