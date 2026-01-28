// src/pages/Login.jsx
import { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { getAdminRole } from "../utils/getAdminRole"; // Firestore lookup

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
      // ---------------- Firebase Login ----------------
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ---------------- Admin Role Check ----------------
      const role = await getAdminRole(user.email); // e.g., "AdminManager", "Moderator", etc.

      if (role) {
        // ---------------- Admin Redirect ----------------
        navigate(`/admin/${role}`);
      } else {
        // ---------------- Normal User Redirect ----------------
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
    <div style={containerStyle}>
      <form onSubmit={handleLogin} style={formStyle}>
        <h2 style={{ textAlign: "center", marginBottom: 20 }}>Login</h2>

        {error && <p style={{ color: "#dc3545", marginBottom: 10 }}>{error}</p>}

        <label style={labelStyle}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <p style={{ marginTop: 15, fontSize: 14 }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: "#4da6ff", textDecoration: "underline" }}>
            Create Account
          </Link>
        </p>
      </form>
    </div>
  );
}

/* ---------------- Styles ---------------- */
const containerStyle = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#f4f6f8",
  fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif"
};

const formStyle = {
  background: "#fff",
  padding: 30,
  borderRadius: 12,
  boxShadow: "0 6px 25px rgba(0,0,0,0.1)",
  width: 360,
};

const labelStyle = { display: "block", marginBottom: 20 };

const inputStyle = {
  width: "100%",
  padding: 10,
  marginTop: 4,
  borderRadius: 6,
  border: "1px solid #ccc"
};

const buttonStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 8,
  border: "none",
  background: "#4da6ff",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer"
};