// pages/BecomeSeller.jsx
import React        from "react";
import { Navigate } from "react-router-dom";
import { useSellerFlow, STEPS } from "../hooks/useSellerFlow";
import RegisterStep       from "../components/seller/RegisterStep";
import OtpStep            from "../components/seller/OtpStep";
import ForgotPasswordStep from "../components/seller/ForgotPasswordStep";
import ResetCodeStep      from "../components/seller/ResetCodeStep";
import ResetPasswordStep  from "../components/seller/ResetPasswordStep";
import StoreSetup         from "../components/seller/StoreSetup";
import VerificationStep   from "../components/seller/VerificationStep";
import "../style/Seller.css";

// ─────────────────────────────────────────────────────────────
// Main onboarding progress steps
// ─────────────────────────────────────────────────────────────
const PROGRESS_STEPS = [
  { key: STEPS.REGISTER,     label: "Register",     icon: "👤" },
  { key: STEPS.OTP_VERIFY,   label: "Verify Email", icon: "📬" },
  { key: STEPS.STORE_SETUP,  label: "Store Setup",  icon: "🏪" },
  { key: STEPS.VERIFICATION, label: "Verification", icon: "🔍" },
  { key: STEPS.REVIEW,       label: "Under Review", icon: "⏳" },
  { key: STEPS.APPROVED,     label: "Approved",     icon: "✅" },
];

// ─────────────────────────────────────────────────────────────
// Steps outside the main flow — no progress bar or step badge
// ─────────────────────────────────────────────────────────────
const OUTSIDE_FLOW = new Set([
  STEPS.FORGOT_PASSWORD,
  STEPS.RESET_CODE,
  STEPS.RESET_NEW_PASSWORD,
]);

// ─────────────────────────────────────────────────────────────
// Header label for each password-flow step
// ─────────────────────────────────────────────────────────────
const PASSWORD_FLOW_META = {
  [STEPS.FORGOT_PASSWORD]: {
    title:    "Forgot Password",
    subtitle: "Enter your email to receive a 6-digit reset code",
  },
  [STEPS.RESET_CODE]: {
    title:    "Enter Reset Code",
    subtitle: "Check your email for the 6-digit code we sent you",
  },
  [STEPS.RESET_NEW_PASSWORD]: {
    title:    "Set New Password",
    subtitle: "Your code is verified — create a strong new password",
  },
};

// ═════════════════════════════════════════════════════════════
// PROGRESS BAR
// ═════════════════════════════════════════════════════════════
const ProgressBar = ({ currentStep }) => (
  <div className="seller-progress">
    {PROGRESS_STEPS.map((s, idx) => {
      const isActive    = currentStep === s.key;
      const isCompleted = currentStep  >  s.key;
      return (
        <React.Fragment key={s.key}>
          <div className="progress-step">
            <div className={[
              "step-circle",
              isActive    ? "active"    : "",
              isCompleted ? "completed" : "",
            ].filter(Boolean).join(" ")}>
              {isCompleted ? "✓" : s.icon}
            </div>
            <span className={[
              "step-label",
              isActive    ? "active"    : "",
              isCompleted ? "completed" : "",
            ].filter(Boolean).join(" ")}>
              {s.label}
            </span>
          </div>
          {idx < PROGRESS_STEPS.length - 1 && (
            <div className={[
              "progress-line",
              isCompleted ? "completed" : "",
            ].filter(Boolean).join(" ")} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ═════════════════════════════════════════════════════════════
// MOUNT LOADER
// ═════════════════════════════════════════════════════════════
const MountLoader = () => (
  <div style={st.loaderWrap}>
    <div style={st.spinner} />
    <p style={st.loaderText}>Loading your seller profile…</p>
  </div>
);

// ═════════════════════════════════════════════════════════════
// GMAIL / MARKETPLACE USER SCREEN
// ═════════════════════════════════════════════════════════════
const GmailUserScreen = ({ onSignOut }) => (
  <div className="seller-wrapper">
    <div
      className="seller-card"
      style={{ textAlign: "center", padding: "2.5rem 2rem" }}
    >
      <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>
        🏪
      </div>
      <h2 style={{
        fontWeight:   800,
        color:        "#1f2937",
        marginBottom: "0.75rem",
      }}>
        Seller Account Required
      </h2>
      <p style={{
        color:        "#6b7280",
        lineHeight:   1.7,
        marginBottom: "2rem",
        fontSize:     "0.9rem",
      }}>
        You are logged in with a marketplace account.
        The seller system requires a separate seller account.
      </p>
      <div style={{
        display:       "flex",
        flexDirection: "column",
        gap:           "0.75rem",
        maxWidth:      "320px",
        margin:        "0 auto",
      }}>
        <button
          onClick={onSignOut}
          className="btn-seller-primary"
        >
          📝 Create / Sign In to Seller Account
        </button>
        <a
          href="/"
          style={{
            color:          "#9ca3af",
            textDecoration: "none",
            fontSize:       "0.9rem",
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

  const items = [
    {
      icon: "📋",
      text: "Account created",
      done: true,
    },
    {
      icon: "📬",
      text: "Email verified",
      done: true,
    },
    {
      icon: "🏪",
      text: "Store setup complete",
      done: true,
    },
    {
      icon: "🔍",
      text: "Documents under review",
      done: status !== "pending",
    },
    {
      icon: "✅",
      text: "Store activation",
      done: ["approved", "active"].includes(status),
    },
    {
      icon: "🚀",
      text: "Start selling",
      done: status === "active",
    },
  ];

  return (
    <div className="seller-card review-screen">
      <div className="review-icon">⏳</div>

      <h2 style={st.reviewTitle}>Application Under Review</h2>
      <p style={st.reviewDesc}>
        Our team is reviewing your application.
        This usually takes <strong>1–3 business days</strong>.
      </p>

      <div className="review-steps">
        {items.map((item, i) => (
          <div className="review-step-item" key={i}>
            <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
            <span style={{
              fontWeight: 500,
              flex:       1,
              color:      item.done ? "#10b981" : "#9ca3af",
            }}>
              {item.text}
            </span>
            {item.done && (
              <span style={{ color: "#10b981", fontWeight: 700 }}>
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
        📧 We'll notify you by email once reviewed.
      </p>
      <a href="/" style={st.homeLink}>
        ← Back to Marketplace
      </a>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// PASSWORD FLOW HEADER
// Replaces the main "Become a Seller" header for reset steps
// ═════════════════════════════════════════════════════════════
const PasswordFlowHeader = ({ step }) => {
  const meta = PASSWORD_FLOW_META[step] ?? {
    title:    "Password Reset",
    subtitle: "",
  };

  // Mini step indicator for the 3-step reset flow
  const resetSteps = [
    { key: STEPS.FORGOT_PASSWORD,  label: "Email",    icon: "📧" },
    { key: STEPS.RESET_CODE,       label: "Code",     icon: "🔢" },
    { key: STEPS.RESET_NEW_PASSWORD, label: "Password", icon: "🔑" },
  ];

  return (
    <div style={st.header}>
      <h1 style={st.title}>{meta.title}</h1>
      <p style={st.subtitle}>{meta.subtitle}</p>

      {/* Mini step pills for reset flow */}
      <div style={st.resetStepRow}>
        {resetSteps.map((rs, idx) => {
          const isCurrent   = step === rs.key;
          const isDone      = step > rs.key;
          return (
            <React.Fragment key={rs.key}>
              <div style={{
                ...st.resetStepPill,
                background: isDone
                  ? "#10b981"
                  : isCurrent
                    ? "#6366f1"
                    : "#e5e7eb",
                color: isDone || isCurrent ? "white" : "#9ca3af",
              }}>
                {isDone ? "✓" : rs.icon}
                <span style={st.resetStepLabel}>
                  {rs.label}
                </span>
              </div>
              {idx < resetSteps.length - 1 && (
                <div style={{
                  ...st.resetStepLine,
                  background: step > rs.key ? "#10b981" : "#e5e7eb",
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════
const BecomeSeller = () => {
  const flow = useSellerFlow();

  // ── 1. Still initializing ──────────────────────────────────
  if (flow.initializing || flow.step === null) {
    return <MountLoader />;
  }

  // ── 2. Already approved → go to dashboard ──────────────────
  if (flow.step === STEPS.APPROVED) {
    return <Navigate to="/seller/dashboard" replace />;
  }

  if (
    flow.vendorData &&
    ["active", "approved"].includes(flow.vendorData.status)
  ) {
    return <Navigate to="/seller/dashboard" replace />;
  }

  // ── 3. Marketplace / Gmail user ────────────────────────────
  if (flow.isGmailUser) {
    return <GmailUserScreen onSignOut={flow.signOut} />;
  }

  // ── 4. Normal seller flow ──────────────────────────────────
  const isOutsideFlow = OUTSIDE_FLOW.has(flow.step);

  // Cap to main flow step count for the badge
  const mainFlowStep = Math.min(
    flow.step,
    PROGRESS_STEPS.length - 1
  );

  return (
    <div className="seller-wrapper">

      {/* ── Header ───────────────────────────────────────── */}
      {isOutsideFlow ? (
        <PasswordFlowHeader step={flow.step} />
      ) : (
        <div style={st.header}>
          <h1 style={st.title}>Become a Seller</h1>
          <p style={st.subtitle}>
            Set up your store and start selling
          </p>
          <div style={st.stepBadge}>
            Step {mainFlowStep + 1} of {PROGRESS_STEPS.length}
          </div>
        </div>
      )}

      {/* ── Progress bar (main flow only) ────────────────── */}
      {!isOutsideFlow && (
        <ProgressBar currentStep={flow.step} />
      )}

      {/* ── Global banners ───────────────────────────────── */}
      {flow.serverErr && (
        <div style={st.errBanner}>
          ⚠️ {flow.serverErr}
        </div>
      )}
      {flow.serverMsg && !flow.serverErr && (
        <div style={st.okBanner}>
          ✅ {flow.serverMsg}
        </div>
      )}

      {/* ── Step renders ─────────────────────────────────── */}

      {flow.step === STEPS.REGISTER && (
        <RegisterStep flow={flow} />
      )}

      {flow.step === STEPS.OTP_VERIFY && (
        <OtpStep flow={flow} />
      )}

      {flow.step === STEPS.FORGOT_PASSWORD && (
        <ForgotPasswordStep flow={flow} />
      )}

      {flow.step === STEPS.RESET_CODE && (
        <ResetCodeStep flow={flow} />
      )}

      {flow.step === STEPS.RESET_NEW_PASSWORD && (
        <ResetPasswordStep flow={flow} />
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

    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const st = {
  header: {
    textAlign:    "center",
    marginBottom: "2rem",
  },
  title: {
    fontSize:             "2rem",
    fontWeight:           800,
    background:           "linear-gradient(135deg,#6366f1,#8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor:  "transparent",
    margin:               0,
    lineHeight:           1.2,
  },
  subtitle: {
    color:     "#6b7280",
    marginTop: "0.5rem",
    fontSize:  "0.95rem",
  },
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

  // ── Password reset mini-stepper ─────────────────────────
  resetStepRow: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    marginTop:      "1.25rem",
    gap:            0,
  },
  resetStepPill: {
    display:        "inline-flex",
    alignItems:     "center",
    gap:            "0.35rem",
    padding:        "0.35rem 0.875rem",
    borderRadius:   "100px",
    fontSize:       "0.8rem",
    fontWeight:     700,
    transition:     "all 0.3s ease",
  },
  resetStepLabel: {
    fontSize: "0.78rem",
  },
  resetStepLine: {
    height:     "2px",
    width:      "2rem",
    transition: "background 0.3s ease",
    flexShrink: 0,
  },

  // ── Loader ───────────────────────────────────────────────
  loaderWrap: {
    minHeight:      "100vh",
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "1rem",
    background:     "#f9fafb",
  },
  spinner: {
    width:        "44px",
    height:       "44px",
    border:       "4px solid #e5e7eb",
    borderTop:    "4px solid #6366f1",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
  },
  loaderText: {
    color:      "#9ca3af",
    fontWeight: 500,
    margin:     0,
  },

  // ── Review screen ────────────────────────────────────────
  reviewTitle: {
    fontSize:   "1.75rem",
    fontWeight: 800,
    color:      "#1f2937",
    margin:     "0 0 0.25rem",
  },
  reviewDesc: {
    color:      "#6b7280",
    marginTop:  "0.75rem",
    lineHeight: 1.6,
    fontSize:   "0.9rem",
  },
  emailNote: {
    color:     "#9ca3af",
    fontSize:  "0.875rem",
    marginTop: "1.5rem",
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
    lineHeight:   1.5,
  },
  homeLink: {
    display:        "inline-block",
    marginTop:      "1.5rem",
    color:          "#6b7280",
    fontSize:       "0.9rem",
    textDecoration: "none",
    fontWeight:     500,
  },

  // ── Banners ──────────────────────────────────────────────
  errBanner: {
    background:   "#fef2f2",
    border:       "1px solid #fecaca",
    borderRadius: "12px",
    padding:      "0.875rem 1.25rem",
    color:        "#991b1b",
    fontSize:     "0.875rem",
    marginBottom: "1rem",
    fontWeight:   500,
  },
  okBanner: {
    background:   "#ecfdf5",
    border:       "1px solid #a7f3d0",
    borderRadius: "12px",
    padding:      "0.875rem 1.25rem",
    color:        "#065f46",
    fontSize:     "0.875rem",
    marginBottom: "1rem",
    fontWeight:   500,
  },
};

export default BecomeSeller;