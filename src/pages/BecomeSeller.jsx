// pages/BecomeSeller.jsx
import React from "react";
import { Navigate }              from "react-router-dom";
import { useSellerFlow, STEPS }  from "../hooks/useSellerFlow";
import { formatNGN }             from "../components/seller/DashboardComponents";
import RegisterStep              from "../components/seller/RegisterStep";
import StoreSetup                from "../components/seller/StoreSetup";
import VerificationStep          from "../components/seller/VerificationStep";
import "../style/Seller.css";

// ─── Progress config ──────────────────────────────────────────
const PROGRESS_STEPS = [
  { key: STEPS.REGISTER,     label: "Register",     icon: "👤" },
  { key: STEPS.STORE_SETUP,  label: "Store Setup",  icon: "🏪" },
  { key: STEPS.VERIFICATION, label: "Verification", icon: "🔍" },
  { key: STEPS.REVIEW,       label: "Under Review", icon: "⏳" },
  { key: STEPS.APPROVED,     label: "Approved",     icon: "✅" },
];

// ─── Progress Bar ─────────────────────────────────────────────
const ProgressBar = ({ currentStep }) => (
  <div className="seller-progress">
    {PROGRESS_STEPS.map((s, idx) => {
      const isActive    = currentStep === s.key;
      const isCompleted = currentStep > s.key;

      return (
        <React.Fragment key={s.key}>
          <div className="progress-step">
            <div
              className={`step-circle ${
                isActive    ? "active"    :
                isCompleted ? "completed" : ""
              }`}
            >
              {isCompleted ? "✓" : s.icon}
            </div>
            <span
              className={`step-label ${
                isActive    ? "active"    :
                isCompleted ? "completed" : ""
              }`}
            >
              {s.label}
            </span>
          </div>

          {idx < PROGRESS_STEPS.length - 1 && (
            <div
              className={`progress-line ${isCompleted ? "completed" : ""}`}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Mount Loader ─────────────────────────────────────────────
const MountLoader = () => (
  <div style={st.loaderWrap}>
    <div style={st.spinner} />
    <p style={st.loaderText}>Loading your seller profile...</p>
  </div>
);

// ═════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════
const BecomeSeller = ({ user }) => {
  const flow = useSellerFlow(user);

  // ── Show loader while checking status ───────────────────
  if (flow.initializing) return <MountLoader />;

  // ── If vendor is already active/approved → go to dashboard
  if (
    flow.vendorData &&
    ["active", "approved"].includes(flow.vendorData.status)
  ) {
    return <Navigate to="/seller/dashboard" replace />;
  }

  // ── If not logged in (no token) → show register step ────
  // useSellerFlow already sets step = REGISTER if no token

  return (
    <div className="seller-wrapper">

      {/* ── Header ───────────────────────────────────────── */}
      <div style={st.header}>
        <h1 style={st.title}>Become a Seller</h1>
        <p style={st.subtitle}>
          Set up your store and start selling to millions of users
        </p>
        <div style={st.stepBadge}>
          Step {flow.step + 1} of {PROGRESS_STEPS.length}
        </div>
      </div>

      {/* ── Progress Bar ─────────────────────────────────── */}
      <ProgressBar currentStep={flow.step} />

      {/* ── Step Screens ─────────────────────────────────── */}

      {flow.step === STEPS.REGISTER && (
        <RegisterStep flow={flow} />
      )}

      {flow.step === STEPS.STORE_SETUP && (
        <StoreSetup flow={flow} />
      )}

      {flow.step === STEPS.VERIFICATION && (
        <VerificationStep flow={flow} />
      )}

      {flow.step === STEPS.REVIEW && (
        <ReviewScreen vendor={flow.vendorData} />
      )}

      {flow.step === STEPS.APPROVED && (
        <ApprovedScreen vendor={flow.vendorData} />
      )}

    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// REVIEW SCREEN
// ═════════════════════════════════════════════════════════════
const ReviewScreen = ({ vendor }) => {
  const status = vendor?.status ?? "pending";

  const steps = [
    { icon: "📋", text: "Account created",        done: true },
    { icon: "🏪", text: "Store setup complete",   done: true },
    { icon: "🔍", text: "Documents under review", done: status !== "pending" },
    { icon: "✅", text: "Store activation",        done: ["approved","active"].includes(status) },
    { icon: "🚀", text: "Start selling",           done: status === "active" },
  ];

  return (
    <div className="seller-card review-screen">
      <div className="review-icon">⏳</div>

      <h2 style={st.reviewTitle}>Application Under Review</h2>

      <p style={st.reviewDesc}>
        Our team is reviewing your application. This usually takes{" "}
        <strong>1–3 business days</strong>.
      </p>

      <div className="review-steps">
        {steps.map((item, i) => (
          <div className="review-step-item" key={i}>
            <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
            <span style={{
              fontWeight: 500,
              color: item.done ? "#10b981" : "#9ca3af",
            }}>
              {item.text}
            </span>
            {item.done && (
              <span style={{ marginLeft: "auto", color: "#10b981" }}>
                ✓
              </span>
            )}
          </div>
        ))}
      </div>

      {status === "rejected" && vendor?.rejection_reason && (
        <div style={st.rejectionBox}>
          <strong>Rejection reason: </strong>
          {vendor.rejection_reason}
        </div>
      )}

      <p style={st.emailNote}>
        📧 We'll notify you by email once your store is reviewed.
      </p>

      {/* Back to home */}
      <a
        href="/"
        style={st.homeLink}
      >
        ← Back to Marketplace
      </a>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// APPROVED SCREEN
// ═════════════════════════════════════════════════════════════
const ApprovedScreen = ({ vendor }) => (
  <div className="seller-card review-screen">
    <div className="review-icon">🎉</div>

    <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981" }}>
      {vendor?.store_name
        ? `${vendor.store_name} is Live!`
        : "You're Approved!"}
    </h2>

    <p style={{ color: "#6b7280", marginTop: "0.75rem", lineHeight: 1.6 }}>
      Your store is fully active. Start adding products and make your
      first sale!
    </p>

    {vendor && (
      <div style={st.statsRow}>
        <StatPill
          icon="📦"
          label="Products"
          value={vendor.products_count ?? 0}
        />
        <StatPill
          icon="💰"
          label="Revenue"
          value={formatNGN(vendor.total_revenue)}
        />
        <StatPill
          icon="⭐"
          label="Rating"
          value={vendor.rating ?? "—"}
        />
      </div>
    )}

    <a
      href="/seller/dashboard"
      className="btn-seller-primary"
      style={st.dashLink}
    >
      🚀 Go to Seller Dashboard
    </a>
  </div>
);

// ── Stat Pill ─────────────────────────────────────────────────
const StatPill = ({ icon, label, value }) => (
  <div style={st.statPill}>
    <span style={{ fontSize: "1.5rem" }}>{icon}</span>
    <span style={st.statValue}>{value}</span>
    <span style={st.statLabel}>{label}</span>
  </div>
);

// ═════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════
const st = {
  // Header
  header: { textAlign: "center", marginBottom: "2rem" },
  title: {
    fontSize:             "2rem",
    fontWeight:           800,
    background:           "linear-gradient(135deg, #6366f1, #8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor:  "transparent",
    margin:               0,
  },
  subtitle:  { color: "#6b7280", marginTop: "0.5rem" },
  stepBadge: {
    display:      "inline-block",
    marginTop:    "0.75rem",
    padding:      "0.35rem 1rem",
    background:   "#eef2ff",
    color:        "#6366f1",
    borderRadius: "100px",
    fontWeight:   600,
    fontSize:     "0.85rem",
  },

  // Loader
  loaderWrap: {
    minHeight:      "60vh",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "1rem",
  },
  spinner: {
    width:        "44px",
    height:       "44px",
    border:       "4px solid #e5e7eb",
    borderTop:    "4px solid #6366f1",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
  },
  loaderText: { color: "#9ca3af", fontWeight: 500 },

  // Review screen
  reviewTitle: {
    fontSize:   "1.75rem",
    fontWeight: 800,
    color:      "#1f2937",
  },
  reviewDesc: {
    color:      "#6b7280",
    marginTop:  "0.75rem",
    lineHeight: 1.6,
  },
  emailNote: {
    color:      "#9ca3af",
    fontSize:   "0.875rem",
    marginTop:  "1.5rem",
  },
  rejectionBox: {
    background:   "#fef2f2",
    border:       "1px solid #fecaca",
    borderRadius: "12px",
    padding:      "1rem",
    color:        "#991b1b",
    fontSize:     "0.875rem",
    margin:       "1rem 0",
    textAlign:    "left",
  },
  homeLink: {
    display:        "inline-block",
    marginTop:      "1.5rem",
    color:          "#6b7280",
    fontSize:       "0.9rem",
    textDecoration: "none",
    fontWeight:     500,
  },

  // Approved screen
  statsRow: {
    display:        "flex",
    gap:            "1rem",
    justifyContent: "center",
    margin:         "1.5rem 0",
    flexWrap:       "wrap",
  },
  statPill: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    gap:            "0.25rem",
    padding:        "1rem 1.5rem",
    background:     "#f8fafc",
    borderRadius:   "16px",
    border:         "1px solid #e5e7eb",
    minWidth:       "90px",
  },
  statValue: {
    fontSize:   "1.25rem",
    fontWeight: 800,
    color:      "#1f2937",
  },
  statLabel: {
    fontSize:   "0.75rem",
    color:      "#9ca3af",
    fontWeight: 500,
  },
  dashLink: {
    marginTop:      "2rem",
    textDecoration: "none",
    display:        "inline-flex",
    alignItems:     "center",
    gap:            "0.5rem",
  },
};

export default BecomeSeller;