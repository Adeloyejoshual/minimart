import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SuperAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const SUPERADMIN_EMAIL = process.env.REACT_APP_SUPERADMIN_EMAIL;
    const SUPERADMIN_PASSWORD = process.env.REACT_APP_SUPERADMIN_PASSWORD;

    // Check credentials
    if (email === SUPERADMIN_EMAIL && password === SUPERADMIN_PASSWORD) {
      // ✅ Store a token in localStorage
      localStorage.setItem("superadmin-token", "logged-in");

      // Navigate to dashboard
      navigate("/superadmin/dashboard");
    } else {
      setError("Invalid email or password");
    }
    setLoading(false);
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
        <h2 style={{ textAlign: "center", marginBottom: 20 }}>SuperAdmin Login</h2>

        {error && <p style={{ color: "#dc3545", marginBottom: 10 }}>{error}</p>}

        <label style={{ display: "block", marginBottom: 12 }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 6, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 20 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 6, border: "1px solid #ccc" }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "none",
            background: "#4da6ff",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}