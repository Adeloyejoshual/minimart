// src/pages/AdminLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1️⃣ Sign in with Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 2️⃣ Check if the user exists in "admins" collection
      const adminSnap = await getDoc(doc(db, "admins", cred.user.uid));

      if (!adminSnap.exists()) {
        setError("You are not an admin");
        setLoading(false);
        return;
      }

      const adminData = adminSnap.data();

      // 3️⃣ Redirect based on role
      switch (adminData.role) {
        case "Admin":
          navigate("/admin");
          break;
        case "Moderator":
          navigate("/admin/moderator");
          break;
        case "Finance":
          navigate("/admin/finance");
          break;
        case "Support":
          navigate("/admin/support");
          break;
        default:
          navigate("/admin");
      }
    } catch (err) {
      console.error(err);
      setError("Invalid email or password");
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
          textAlign: "center"
        }}
      >
        <h2 style={{ marginBottom: 20 }}>Admin Login</h2>
        {error && <p style={{ color: "#dc3545", marginBottom: 10 }}>{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        <button type="submit" disabled={loading} style={buttonStyle}>
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