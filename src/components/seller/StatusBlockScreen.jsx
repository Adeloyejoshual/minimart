// components/seller/StatusBlockScreen.jsx
import React, { useState } from "react";
import { STATUS_UI, STATUS_PERMISSIONS } from "../../config/vendorPolicy";

// ─────────────────────────────────────────────────────────────
// Smart blocked screen — different CTA per status
// Maximises conversion by guiding seller to next action
// ─────────────────────────────────────────────────────────────
const StatusBlockScreen = ({ vendor, ui, onReapply }) => {
  const [reapplying, setReapplying] = useState(false);
  const [reapplied,  setReapplied]  = useState(false);

  if (!ui) return null;

  const handleReapply = async () => {
    setReapplying(true);
    try {
      await onReapply();
      setReapplied(true);
    } finally {
      setReapplying(false);
    }
  };

  return (
    <div style={s.wrapper}>
      <div style={s.card}>

        {/* Status Icon */}
        <div style={s.iconWrap}>
          <span style={s.icon}>{ui.icon}</span>
        </div>

        {/* Badge */}
        <span style={{
          ...s.badge,
          color:      ui.color,
          background: ui.bg,
          border:     `1px solid ${ui.border}`,
        }}>
          {ui.label}
        </span>

        {/* Title & Description */}
        <h2 style={s.title}>{ui.title}</h2>
        <p style={s.desc}>{ui.description}</p>

        {/* Rejection / Suspension reason */}
        <ReasonBox vendor={vendor} />

        {/* Progress steps */}
        {ui.steps?.length > 0 && (
          <ProgressSteps steps={ui.steps} />
        )}

        {/* Permission table */}
        <PermissionMatrix status={vendor.status} />

        {/* CTA */}
        <CTAButton
          ui={ui}
          vendor={vendor}
          reapplying={reapplying}
          reapplied={reapplied}
          onReapply={handleReapply}
        />

      </div>
    </div>
  );
};

// ── Reason Box ─────────────────────────────────────────────────
const ReasonBox = ({ vendor }) => {
  const isRejected  = vendor.status === "rejected"  && vendor.rejection_reason;
  const isSuspended = vendor.status === "suspended" && vendor.suspended_reason;

  if (!isRejected && !isSuspended) return null;

  return (
    <div style={{
      ...s.reasonBox,
      background:   isRejected ? "#fef2f2" : "#f9fafb",
      borderColor:  isRejected ? "#fecaca" : "#e5e7eb",
      color:        isRejected ? "#991b1b" : "#374151",
    }}>
      <strong>Reason: </strong>
      {isRejected ? vendor.rejection_reason : vendor.suspended_reason}

      {vendor.suspension_expires && (
        <p style={{ marginTop: "0.5rem", color: "#6b7280", fontSize: "0.85rem" }}>
          ⏰ Suspension expires:{" "}
          {new Date(vendor.suspension_expires).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

// ── Progress Steps ─────────────────────────────────────────────
const ProgressSteps = ({ steps }) => (
  <div style={s.stepsWrap}>
    {steps.map((step, i) => (
      <div key={i} style={s.stepRow}>
        <span style={{
          ...s.stepDot,
          background: step.done ? "#10b981" : "#e5e7eb",
          color:      step.done ? "white" : "#9ca3af",
        }}>
          {step.done ? "✓" : i + 1}
        </span>
        <span style={{
          ...s.stepLabel,
          color:      step.done ? "#10b981" : "#9ca3af",
          fontWeight: step.done ? 600 : 400,
        }}>
          {step.label}
        </span>
      </div>
    ))}
  </div>
);

// ── Permission Matrix ──────────────────────────────────────────
const MATRIX_ROWS = [
  { action: "login",          label: "Login",           icon: "🔐" },
  { action: "view_dashboard", label: "Dashboard",        icon: "📊" },
  { action: "create_product", label: "Create Products",  icon: "📦" },
  { action: "view_orders",    label: "View Orders",      icon: "📋" },
  { action: "withdraw",       label: "Payouts",          icon: "💳" },
  { action: "store_visible",  label: "Store Visible",    icon: "🌐" },
];

const PermissionMatrix = ({ status }) => {
  const perms = STATUS_PERMISSIONS[status] ?? {};
  return (
    <div style={s.matrix}>
      <p style={s.matrixTitle}>Access Summary</p>
      {MATRIX_ROWS.map(({ action, label, icon }) => (
        <div key={action} style={s.matrixRow}>
          <span style={s.matrixLabel}>{icon} {label}</span>
          <span style={{
            ...s.matrixStatus,
            color:      perms[action] ? "#10b981" : "#ef4444",
            background: perms[action] ? "#ecfdf5" : "#fef2f2",
          }}>
            {perms[action] ? "✅ Allowed" : "❌ Blocked"}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── CTA Button ─────────────────────────────────────────────────
const CTAButton = ({ ui, onReapply, reapplying, reapplied }) => {
  const { cta } = ui;
  if (!cta) return null;

  // Reapply action — no href
  if (cta.action === "reapply") {
    return (
      <button
        onClick={onReapply}
        disabled={reapplying || reapplied}
        style={{
          ...s.btn,
          ...(cta.style === "primary" ? s.btnPrimary : s.btnSecondary),
          opacity: reapplying || reapplied ? 0.7 : 1,
        }}
      >
        {reapplied
          ? "✅ Reapplied — Awaiting Review"
          : reapplying
          ? "Submitting..."
          : cta.label}
      </button>
    );
  }

  // Link-based CTA
  const style = {
    primary:   s.btnPrimary,
    secondary: s.btnSecondary,
    danger:    s.btnDanger,
  }[cta.style] ?? s.btnSecondary;

  return (
    <a href={cta.href} style={{ ...s.btn, ...style, textDecoration: "none" }}>
      {cta.label}
    </a>
  );
};

// ── Styles ─────────────────────────────────────────────────────
const s = {
  wrapper: {
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
    padding:      "2.5rem",
    maxWidth:     "540px",
    width:        "100%",
    textAlign:    "center",
    boxShadow:    "0 20px 60px rgba(0,0,0,0.08)",
    animation:    "slideUp 0.4s ease",
  },
  iconWrap: { marginBottom: "1rem" },
  icon:     { fontSize: "4rem" },
  badge: {
    display:      "inline-block",
    padding:      "0.35rem 1.25rem",
    borderRadius: "100px",
    fontWeight:   700,
    fontSize:     "0.8rem",
    marginBottom: "1rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  title:     { fontSize: "1.5rem", fontWeight: 800, color: "#1f2937", margin: "0.25rem 0" },
  desc:      { color: "#6b7280", lineHeight: 1.7, margin: "0.5rem 0 1.5rem" },
  reasonBox: {
    borderRadius: "12px",
    border:       "1px solid",
    padding:      "1rem 1.25rem",
    textAlign:    "left",
    fontSize:     "0.9rem",
    lineHeight:   1.6,
    marginBottom: "1.5rem",
  },
  stepsWrap: {
    display:       "flex",
    flexDirection: "column",
    gap:           "0.75rem",
    margin:        "1.5rem 0",
    textAlign:     "left",
  },
  stepRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "0.75rem",
  },
  stepDot: {
    width:          "28px",
    height:         "28px",
    borderRadius:   "50%",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontWeight:     700,
    fontSize:       "0.8rem",
    flexShrink:     0,
  },
  stepLabel: { fontSize: "0.9rem" },
  matrix:    { margin: "1.5rem 0", textAlign: "left" },
  matrixTitle: {
    fontWeight:    700,
    color:         "#374151",
    marginBottom:  "0.75rem",
    fontSize:      "0.9rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  matrixRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    padding:        "0.6rem 0.875rem",
    borderRadius:   "10px",
    background:     "#f8fafc",
    marginBottom:   "0.4rem",
  },
  matrixLabel:  { color: "#374151", fontWeight: 500, fontSize: "0.875rem" },
  matrixStatus: {
    padding:      "0.2rem 0.65rem",
    borderRadius: "100px",
    fontSize:     "0.78rem",
    fontWeight:   700,
  },
  btn: {
    display:    "inline-block",
    padding:    "0.95rem 2.5rem",
    borderRadius: "16px",
    fontWeight: 700,
    fontSize:   "1rem",
    cursor:     "pointer",
    border:     "none",
    marginTop:  "1rem",
    width:      "100%",
    textAlign:  "center",
  },
  btnPrimary: {
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color:      "white",
    boxShadow:  "0 4px 15px rgba(99,102,241,0.4)",
  },
  btnSecondary: {
    background: "white",
    color:      "#6b7280",
    border:     "2px solid #e5e7eb",
  },
  btnDanger: {
    background: "linear-gradient(135deg,#ef4444,#dc2626)",
    color:      "white",
  },
};

export default StatusBlockScreen;