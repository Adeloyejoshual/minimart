// src/pages/AdminLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1️⃣ Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2️⃣ Check if user is in "admins" collection
      const adminDoc = await getDoc(doc(db, "admins", user.uid));
      if (!adminDoc.exists()) {
        throw new Error("Not authorized as admin");
      }

      // 3️⃣ Redirect to admin panel
      navigate("/admin");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#f4f6f8",
      fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <form
        onSubmit={handleLogin}
        style={{
          background: "#fff",
          padding: 30,
          borderRadius: 12,
          boxShadow: "0 6px 25px rgba(0,0,0,0.1)",
          width: 360,
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: 20 }}>Admin Login</h2>

        {error && <p style={{ color: "#dc3545", marginBottom: 10 }}>{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={buttonStyle}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 6,
  border: "1px solid #ccc"
};

const buttonStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 6,
  border: "none",
  background: "#4da6ff",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer"
};