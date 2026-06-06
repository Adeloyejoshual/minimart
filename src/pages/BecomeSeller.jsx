// pages/BecomeSeller.jsx
import React          from "react";
import { Navigate }   from "react-router-dom";
import { useSellerFlow, STEPS } from "../hooks/useSellerFlow";
import { formatNGN }  from "../components/seller/DashboardComponents";
import RegisterStep   from "../components/seller/RegisterStep";
import StoreSetup     from "../components/seller/StoreSetup";
import VerificationStep from "../components/seller/VerificationStep";
import "../style/Seller.css";

// ─── Progress steps ───────────────────────────────────────────
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
  <div style={s.loaderWrap}>
    <div style={s.spinner} />
    <p style={s.loaderText}>Loading your seller profile...</p>
  </div>
);

// ═════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════
const BecomeSeller = ({ user }) => {
  const flow = useSellerFlow(user);

  // ── Loading ────────────────────────────────────────────────
  if (flow.initializing) return <MountLoader />;

  // ── Already active/approved → go to dashboard ─────────────
  if (
    flow.vendorData &&
    ["active", "approved"].includes(flow.vendorData.status)
  ) {
    return <Navigate to="/seller/dashboard" replace />;
  }

  // ── Gmail/public.users user → show info screen ────────────
  if (flow.isGmailUser) {
    return <GmailUserScreen />;
  }

  return (
    <div className="seller-wrapper">

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={s.header}>
        <h1 style={s.title}>Become a Seller</h1>
        <p style={s.subtitle}>
          Set up your store and start selling to millions of users
        </p>
        <div style={s.stepBadge}>
          Step {flow.step + 1} of {PROGRESS_STEPS.length}
        </div>
      </div>

      {/* ── Progress Bar ─────────────────────────────────────── */}
      <ProgressBar currentStep={flow.step} />

      {/* ── Step Screens ─────────────────────────────────────── */}

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
// GMAIL USER SCREEN
// Shown when user logged in via Google/public.users
// and tries to access seller system
// ═════════════════════════════════════════════════════════════
const GmailUserScreen = () => (
  <div className="seller-wrapper">
    <div className="seller-card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
      <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🏪</div>

      <h2 style={{ fontWeight: 800, color: "#1f2937", marginBottom: "0.75rem", fontSize: "1.5rem" }}>
        Seller Account Required
      </h2>

      <p style={{ color: "#6b7280", lineHeight: 1.7, marginBottom: "0.5rem", fontSize: "0.95rem" }}>
        You are currently logged in as a <strong>marketplace buyer</strong>.
      </p>

      <p style={{ color: "#6b7280", lineHeight: 1.7, marginBottom: "2rem", fontSize: "0.95rem" }}>
        The seller system requires a separate <strong>seller account</strong>{" "}
        registered with an email and password.
        <br />
        Google / Gmail login accounts cannot be used for selling.
      </p>

      {/* What's different */}
      <div style={{
        background:    "#f8fafc",
        borderRadius:  "14px",
        padding:       "1.25rem",
        border:        "1px solid #e5e7eb",
        textAlign:     "left",
        marginBottom:  "2rem",
      }}>
        <p style={{ fontWeight: 700, color: "#374151", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
          Why do I need a separate seller account?
        </p>
        {[
          { icon: "🔒", text: "Seller accounts store sensitive financial data (bank details, ID)" },
          { icon: "🏦", text: "Separate wallet and virtual account system for payouts" },
          { icon: "✅", text: "Identity verification required for seller onboarding" },
          { icon: "🛡️", text: "Fraud prevention and compliance requirements" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.6rem" }}>
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>{item.icon}</span>
            <span style={{ color: "#6b7280", fontSize: "0.85rem", lineHeight: 1.5 }}>{item.text}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "320px", margin: "0 auto" }}>

        {/* Create seller account */}
        <button
          onClick={() => {
            // Token already removed in useSellerFlow when isGmailUser detected
            // Just reload to show register step
            window.location.reload();
          }}
          className="btn-seller-primary"
          style={{ textDecoration: "none" }}
        >
          📝 Create Seller Account
        </button>

        {/* Already have seller account → sign in */}
        <button
          onClick={() => {
            localStorage.removeItem("token");
            window.location.reload();
          }}
          style={{
            padding:      "0.875rem",
            borderRadius: "14px",
            border:       "2px solid #e5e7eb",
            background:   "white",
            color:        "#6366f1",
            fontWeight:   600,
            fontSize:     "0.95rem",
            cursor:       "pointer",
          }}
        >
          🔐 Sign In to Seller Account
        </button>

        {/* Back to marketplace */}
        <a
          href="/"
          style={{
            display:        "block",
            padding:        "0.75rem",
            color:          "#9ca3af",
            textDecoration: "none",
            fontWeight:     500,
            fontSize:       "0.875rem",
          }}
        >
          ← Back to Marketplace
        </a>
      </div>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════
// REVIEW SCREEN
// ═════════════════════════════════════════════════════════════
const ReviewScreen = ({ vendor }) => {
  const status = vendor?.status ?? "pending";

  const steps = [
    { icon: "📋", text: "Account created",        done: true                                   },
    { icon: "🏪", text: "Store setup complete",   done: true                                   },
    { icon: "🔍", text: "Documents under review", done: status !== "pending"                   },
    { icon: "✅", text: "Store activation",        done: ["approved","active"].includes(status) },
    { icon: "🚀", text: "Start selling",           done: status === "active"                    },
  ];

  return (
    <div className="seller-card review-screen">
      <div className="review-icon">⏳</div>

      <h2 style={s.reviewTitle}>Application Under Review</h2>

      <p style={s.reviewDesc}>
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
              <span style={{ marginLeft: "auto", color: "#10b981" }}>✓</span>
            )}
          </div>
        ))}
      </div>

      {status === "rejected" && vendor?.rejection_reason && (
        <div style={s.rejectionBox}>
          <strong>Rejection reason: </strong>
          {vendor.rejection_reason}
        </div>
      )}

      <p style={s.emailNote}>
        📧 We'll notify you by email once your store is reviewed.
      </p>

      <a href="/" style={s.homeLink}>← Back to Marketplace</a>
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
      <div style={s.statsRow}>
        <StatPill icon="📦" label="Products"
          value={vendor.products_count ?? 0}
        />
        <StatPill icon="💰" label="Revenue"
          value={formatNGN(vendor.total_revenue)}
        />
        <StatPill icon="⭐" label="Rating"
          value={vendor.rating ?? "—"}
        />
      </div>
    )}

    <a
      href="/seller/dashboard"
      className="btn-seller-primary"
      style={s.dashLink}
    >
      🚀 Go to Seller Dashboard
    </a>
  </div>
);

// ── Stat Pill ─────────────────────────────────────────────────
const StatPill = ({ icon, label, value }) => (
  <div style={s.statPill}>
    <span style={{ fontSize: "1.5rem" }}>{icon}</span>
    <span style={s.statValue}>{value}</span>
    <span style={s.statLabel}>{label}</span>
  </div>
);

// ═════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════
const s = {
  header:   { textAlign: "center", marginBottom: "2rem" },
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

  reviewTitle: { fontSize: "1.75rem", fontWeight: 800, color: "#1f2937" },
  reviewDesc:  { color: "#6b7280", marginTop: "0.75rem", lineHeight: 1.6 },
  emailNote:   { color: "#9ca3af", fontSize: "0.875rem", marginTop: "1.5rem" },
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

  statsRow: {
    display:        "flex",
    gap:            "1rem",
    justifyContent: "center",
    margin:         "1.5rem 0",
    flexWrap:       "wrap",
  },
  statPill: {
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           "0.25rem",
    padding:       "1rem 1.5rem",
    background:    "#f8fafc",
    borderRadius:  "16px",
    border:        "1px solid #e5e7eb",
    minWidth:      "90px",
  },
  statValue: { fontSize: "1.25rem", fontWeight: 800, color: "#1f2937"  },
  statLabel: { fontSize: "0.75rem", color: "#9ca3af", fontWeight: 500   },
  dashLink:  {
    marginTop:      "2rem",
    textDecoration: "none",
    display:        "inline-flex",
    alignItems:     "center",
    gap:            "0.5rem",
  },
};

export default BecomeSeller;