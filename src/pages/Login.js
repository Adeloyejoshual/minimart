// src/pages/Login.jsx
import { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { getAdminRole } from "../utils/getAdminRole"; // Admin role lookup

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // --- Firebase login ---
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // --- Get Firebase ID token ---
      const token = await user.getIdToken();
      localStorage.setItem("userToken", token);

      // --- Log login to backend (IP tracking, user agent) ---
      try {
        await axios.post(`${process.env.REACT_APP_API_URL}/api/login-logger`, {
          userId: user.uid,
          email: user.email,
        });
      } catch (err) {
        console.warn("Failed to log user login:", err.message);
      }

      // --- Check if admin ---
      const role = await getAdminRole(user.email);

      if (role) {
        // Redirect admin automatically based on role
        navigate(`/admin/${role}`);
      } else {
        // Normal users go to MiniMart
        navigate("/minimart");
      }

    } catch (err) {
      console.error(err);
      setError("Login failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "50px auto",
        padding: 20,
        borderRadius: 10,
        boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
        background: "#fff",
        textAlign: "center",
        fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <h2 style={{ marginBottom: 20 }}>Login</h2>

      {error && (
        <p style={{ color: "#dc3545", marginBottom: 10 }}>{error}</p>
      )}

      <form
        onSubmit={handleLogin}
        style={{ display: "flex", flexDirection: "column", gap: 15 }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />

        <input
          type="password"
          placeholder="••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 16,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 8,
            border: "none",
            background: "#4da6ff",
            color: "#fff",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 16,
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p style={{ marginTop: 15, fontSize: 14 }}>
        Don't have an account?{" "}
        <Link
          to="/register"
          style={{ color: "#4da6ff", textDecoration: "underline" }}
        >
          Create Account
        </Link>
      </p>
    </div>
  );
}