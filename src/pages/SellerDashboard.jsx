// pages/SellerDashboard.jsx
import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

export default function SellerDashboard({ user }) {
  const [vendor,  setVendor]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [debug,   setDebug]   = useState({});

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      setError("NO_TOKEN");
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        // ── Step 1: check seller account ────────────────────
        const statusRes = await axios.get(
          "/api/seller-onboarding/status",
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setDebug((d) => ({ ...d, status: statusRes.data }));
        setVendor(statusRes.data.vendor);

      } catch (err) {
        const code    = err.response?.data?.code;
        const message = err.response?.data?.message;
        const status  = err.response?.status;

        setDebug({
          error_status:  status,
          error_code:    code,
          error_message: message,
          token_preview: token?.slice(0, 20) + "...",
        });

        setError(code ?? message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [token]);

  // ── No token ───────────────────────────────────────────────
  if (!token) {
    return <Navigate to="/become-seller" replace />;
  }

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.center}>
        <div style={s.spinner} />
        <p style={{ color: "#6b7280" }}>Loading dashboard...</p>
      </div>
    );
  }

  // ── Show debug info on any error ──────────────────────────
  if (error) {
    return (
      <div style={s.center}>
        <div style={s.errorBox}>
          <h2 style={{ color: "#ef4444", margin: "0 0 1rem" }}>
            ❌ Error: {error}
          </h2>

          <div style={s.debugBox}>
            <p style={s.debugTitle}>🔍 Debug Info</p>
            <pre style={s.pre}>
              {JSON.stringify(debug, null, 2)}
            </pre>
          </div>

          <div style={s.btnRow}>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                window.location.reload();
              }}
              style={s.retryBtn}
            >
              🔄 Retry
            </button>

            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("seller_token");
                window.location.href = "/become-seller";
              }}
              style={s.clearBtn}
            >
              🗑️ Clear Token & Re-login
            </button>

            <a href="/" style={s.homeLink}>← Home</a>
          </div>

          <div style={s.tokenBox}>
            <p style={s.debugTitle}>🔑 Current Token</p>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all", color: "#374151" }}>
              {token ?? "No token"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── No vendor ──────────────────────────────────────────────
  if (!vendor) {
    return <Navigate to="/become-seller" replace />;
  }

  // ── Vendor not active ──────────────────────────────────────
  if (!["active", "approved"].includes(vendor.status)) {
    return <Navigate to="/become-seller" replace />;
  }

  // ── Success ────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>✅ Dashboard Working!</h1>

        <div style={s.vendorCard}>
          <p style={s.label}>Store Name</p>
          <p style={s.value}>{vendor.store_name}</p>

          <p style={s.label}>Status</p>
          <p style={{ ...s.value, color: "#10b981", fontWeight: 700 }}>
            {vendor.status}
          </p>

          <p style={s.label}>Category</p>
          <p style={s.value}>{vendor.store_category ?? "—"}</p>

          <p style={s.label}>Bank</p>
          <p style={s.value}>{vendor.bank_name ?? "—"}</p>
        </div>

        <div style={s.debugBox}>
          <p style={s.debugTitle}>📦 Vendor Data</p>
          <pre style={s.pre}>
            {JSON.stringify(vendor, null, 2)}
          </pre>
        </div>

        <div style={s.btnRow}>
          <a href="/" style={s.homeLink}>← Marketplace</a>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("seller_token");
              window.location.href = "/become-seller";
            }}
            style={s.clearBtn}
          >
            Sign Out of Seller
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  center: {
    minHeight:      "100vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "1rem",
    background:     "#f9fafb",
  },
  spinner: {
    width:        "40px",
    height:       "40px",
    border:       "4px solid #e5e7eb",
    borderTop:    "4px solid #6366f1",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
    marginBottom: "1rem",
  },
  page: {
    minHeight:  "100vh",
    background: "#f9fafb",
    padding:    "2rem 1rem",
  },
  card: {
    background:    "white",
    borderRadius:  "16px",
    padding:       "2rem",
    maxWidth:      "640px",
    margin:        "0 auto",
    boxShadow:     "0 4px 20px rgba(0,0,0,0.06)",
  },
  title: {
    fontSize:     "1.5rem",
    fontWeight:   800,
    color:        "#1f2937",
    margin:       "0 0 1.5rem",
    textAlign:    "center",
  },
  errorBox: {
    background:    "white",
    borderRadius:  "16px",
    padding:       "2rem",
    maxWidth:      "600px",
    width:         "100%",
    boxShadow:     "0 4px 20px rgba(0,0,0,0.08)",
  },
  vendorCard: {
    background:    "#f8fafc",
    borderRadius:  "12px",
    padding:       "1rem",
    marginBottom:  "1.5rem",
    border:        "1px solid #e5e7eb",
  },
  label: {
    color:        "#9ca3af",
    fontSize:     "0.75rem",
    fontWeight:   600,
    margin:       "0.5rem 0 0.1rem",
    textTransform:"uppercase",
    letterSpacing:"0.05em",
  },
  value: {
    color:      "#1f2937",
    fontWeight: 600,
    fontSize:   "0.9rem",
    margin:     0,
  },
  debugBox: {
    background:    "#f1f5f9",
    borderRadius:  "10px",
    padding:       "1rem",
    marginBottom:  "1.5rem",
    border:        "1px solid #e2e8f0",
  },
  debugTitle: {
    fontWeight:   700,
    color:        "#475569",
    fontSize:     "0.85rem",
    margin:       "0 0 0.5rem",
  },
  pre: {
    margin:     0,
    fontSize:   "0.75rem",
    color:      "#374151",
    overflow:   "auto",
    maxHeight:  "300px",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    wordBreak:  "break-word",
  },
  tokenBox: {
    background:   "#fefce8",
    border:       "1px solid #fde68a",
    borderRadius: "10px",
    padding:      "1rem",
    marginTop:    "1rem",
  },
  btnRow: {
    display:  "flex",
    gap:      "0.75rem",
    flexWrap: "wrap",
    alignItems:"center",
  },
  retryBtn: {
    padding:      "0.7rem 1.25rem",
    background:   "#6366f1",
    color:        "white",
    border:       "none",
    borderRadius: "10px",
    fontWeight:   600,
    cursor:       "pointer",
    fontSize:     "0.875rem",
  },
  clearBtn: {
    padding:      "0.7rem 1.25rem",
    background:   "#fef2f2",
    color:        "#ef4444",
    border:       "1px solid #fecaca",
    borderRadius: "10px",
    fontWeight:   600,
    cursor:       "pointer",
    fontSize:     "0.875rem",
  },
  homeLink: {
    color:          "#6b7280",
    textDecoration: "none",
    fontWeight:     500,
    fontSize:       "0.875rem",
  },
};