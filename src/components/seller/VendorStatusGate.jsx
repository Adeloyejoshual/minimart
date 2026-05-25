// components/seller/VendorStatusGate.jsx
import React from "react";
import { useVendorStatus }  from "../../hooks/useVendorStatus";
import StatusBlockScreen    from "./StatusBlockScreen";

// ─────────────────────────────────────────────────────────────
// Wraps any seller page.
// If vendor cannot perform `action` → shows StatusBlockScreen
// ─────────────────────────────────────────────────────────────
const VendorStatusGate = ({ action, children }) => {
  const { can, vendor, ui, loading, error, reapply } = useVendorStatus();

  if (loading) return <GateLoader />;

  if (error || !vendor) return <NoVendorScreen error={error} />;

  if (!can(action)) {
    return (
      <StatusBlockScreen
        vendor={vendor}
        ui={ui}
        onReapply={reapply}
      />
    );
  }

  return children;
};

// ── Loader ─────────────────────────────────────────────────────
const GateLoader = () => (
  <div style={s.center}>
    <div style={s.spinnerWrap}>
      <div style={s.spinner} />
      <p style={s.loadText}>Checking store status...</p>
    </div>
  </div>
);

// ── No Vendor Found ────────────────────────────────────────────
const NoVendorScreen = ({ error }) => (
  <div style={s.center}>
    <div style={s.card}>
      <div style={s.bigIcon}>🏪</div>
      <h2 style={s.title}>No Seller Account</h2>
      <p style={s.desc}>
        {error ?? "You don't have a seller account yet."}
      </p>
      <a href="/become-seller" style={s.btnPrimary}>
        Become a Seller →
      </a>
    </div>
  </div>
);

const s = {
  center: {
    minHeight:      "70vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "2rem",
    background:     "linear-gradient(135deg,#f0f4ff,#faf5ff)",
  },
  card: {
    background:   "white",
    borderRadius: "24px",
    padding:      "3rem",
    textAlign:    "center",
    maxWidth:     "440px",
    width:        "100%",
    boxShadow:    "0 20px 60px rgba(0,0,0,0.08)",
  },
  spinnerWrap: { textAlign: "center" },
  spinner: {
    width:        "48px",
    height:       "48px",
    border:       "4px solid #e5e7eb",
    borderTop:    "4px solid #6366f1",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
    margin:       "0 auto 1rem",
  },
  loadText: { color: "#9ca3af", fontWeight: 500 },
  bigIcon:  { fontSize: "3.5rem", marginBottom: "1rem" },
  title:    { fontSize: "1.5rem", fontWeight: 800, color: "#1f2937", margin: "0 0 0.5rem" },
  desc:     { color: "#6b7280", lineHeight: 1.6, margin: "0 0 1.5rem" },
  btnPrimary: {
    display:        "inline-block",
    padding:        "0.875rem 2rem",
    borderRadius:   "14px",
    background:     "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color:          "white",
    fontWeight:     700,
    textDecoration: "none",
  },
};

export default VendorStatusGate;