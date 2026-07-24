// src/pages/admin/AdminLogin.jsx

import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const API = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;

/* ── Map every admin role to its dashboard URL ── */
const ADMIN_ROUTES = {
  super_admin        : "/admin/dashboard",
  admin              : "/admin/manager",
  finance_admin      : "/admin/finance",
  content_moderator  : "/admin/moderator",
  support_admin      : "/admin/support",
};

/* ── Friendly labels for role welcome message ── */
const ROLE_LABELS = {
  super_admin        : "Super Admin",
  admin              : "Manager",
  finance_admin      : "Finance Admin",
  content_moderator  : "Content Moderator",
  support_admin      : "Support Admin",
};

export default function AdminLogin({ setAdmin }) {
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const navigate = useNavigate();

  /* ── SUBMIT ── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      return toast.error("Please enter both email and password");
    }

    setLoading(true);

    try {
      const res = await axios.post(`${API}/login`, {
        email    : email.trim().toLowerCase(),
        password,
      });

      const { admin, token } = res.data;

      // ── Save auth ────────────────────────────
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin", JSON.stringify(admin));
      setAdmin(admin);

      // ── Welcome toast with role ──────────────
      const roleLabel = ROLE_LABELS[admin.role] || "Admin";
      toast.success(`Welcome back, ${admin.name}! (${roleLabel})`);

      // ── Route to correct dashboard ───────────
      const destination = ADMIN_ROUTES[admin.role] || "/admin/dashboard";
      navigate(destination, { replace: true });

    } catch (err) {
      const msg = err.response?.data?.error ||
                  err.response?.data?.message ||
                  "Login failed. Please check your credentials.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── RENDER ── */
  return (
    <div style={{
      minHeight       : "100vh",
      display         : "flex",
      alignItems      : "center",
      justifyContent  : "center",
      background      : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
      padding         : "20px",
    }}>
      <div style={{
        maxWidth        : 420,
        width           : "100%",
        padding         : 32,
        borderRadius    : 16,
        boxShadow       : "0 20px 60px rgba(0,0,0,0.3)",
        backgroundColor : "#fff",
      }}>

        {/* ── Logo / Header ── */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width          : 60,
            height         : 60,
            borderRadius   : 12,
            background     : "linear-gradient(135deg, #2c3e50 0%, #1e293b 100%)",
            margin         : "0 auto 12px",
            display        : "flex",
            alignItems     : "center",
            justifyContent : "center",
            fontSize       : 28,
            color          : "#fff",
          }}>
            🔐
          </div>
          <h2 style={{
            margin     : 0,
            fontSize   : "1.5rem",
            fontWeight : 800,
            color      : "#1e293b",
          }}>
            Admin Portal
          </h2>
          <p style={{
            margin    : "6px 0 0",
            fontSize  : ".85rem",
            color     : "#64748b",
          }}>
            Sign in to your admin account
          </p>
        </div>

        {/* ── Form ── */}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >

          {/* Email */}
          <div>
            <label style={{
              display    : "block",
              fontSize   : ".78rem",
              fontWeight : 700,
              color      : "#475569",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: ".5px",
            }}>
              Email
            </label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoFocus
              autoComplete="email"
              style={{
                width           : "100%",
                padding         : "12px 14px",
                borderRadius    : 8,
                border          : "1.5px solid #e2e8f0",
                fontSize        : 14,
                boxSizing       : "border-box",
                transition      : "all .2s",
                outline         : "none",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; }}
              onBlur={(e)  => { e.target.style.borderColor = "#e2e8f0"; }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{
              display    : "block",
              fontSize   : ".78rem",
              fontWeight : 700,
              color      : "#475569",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: ".5px",
            }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                style={{
                  width         : "100%",
                  padding       : "12px 45px 12px 14px",
                  borderRadius  : 8,
                  border        : "1.5px solid #e2e8f0",
                  fontSize      : 14,
                  boxSizing     : "border-box",
                  transition    : "all .2s",
                  outline       : "none",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; }}
                onBlur={(e)  => { e.target.style.borderColor = "#e2e8f0"; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                disabled={loading}
                style={{
                  position    : "absolute",
                  right       : 8,
                  top         : "50%",
                  transform   : "translateY(-50%)",
                  background  : "transparent",
                  border      : "none",
                  color       : "#64748b",
                  cursor      : loading ? "not-allowed" : "pointer",
                  fontSize    : ".72rem",
                  fontWeight  : 700,
                  padding     : "6px 10px",
                }}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding         : "13px 16px",
              background      : loading
                ? "#94a3b8"
                : "linear-gradient(135deg, #2c3e50 0%, #1e293b 100%)",
              color           : "white",
              border          : "none",
              borderRadius    : 8,
              fontSize        : 15,
              fontWeight      : 700,
              cursor          : loading ? "not-allowed" : "pointer",
              transition      : "all 0.2s",
              marginTop       : 8,
              boxShadow       : loading ? "none" : "0 4px 12px rgba(30, 41, 59, 0.3)",
            }}
          >
            {loading ? (
              <>
                <span style={{
                  display        : "inline-block",
                  width          : 14,
                  height         : 14,
                  border         : "2px solid rgba(255,255,255,.3)",
                  borderTop      : "2px solid #fff",
                  borderRadius   : "50%",
                  animation      : "spin .7s linear infinite",
                  verticalAlign  : "middle",
                  marginRight    : 8,
                }} />
                Signing in…
              </>
            ) : "Sign In"}
          </button>

        </form>

        {/* ── Footer ── */}
        <div style={{
          marginTop  : 20,
          padding    : "12px 14px",
          background : "#f1f5f9",
          borderRadius: 8,
          fontSize   : ".72rem",
          color      : "#64748b",
          textAlign  : "center",
          lineHeight : 1.5,
        }}>
          🔒 Secure admin access. All login attempts are logged.
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}