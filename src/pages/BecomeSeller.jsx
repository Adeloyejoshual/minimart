// pages/BecomeSeller.jsx
// ─────────────────────────────────────────────────────────────
// Seller onboarding shell.
//
// Architecture decisions:
//
// 1. NO global error/success banners here.
//    Every child step component manages its own feedback via
//    flow.serverMsg / flow.serverErr rendered inside its own
//    card. Rendering banners here AND inside the card caused
//    every message to appear twice.
//
// 2. The progress bar is shown only for main-flow steps
//    (REGISTER → APPROVED). Password-reset steps get their
//    own mini 3-step indicator inside PasswordFlowHeader.
//
// 3. The step badge ("Step N of 6") is hidden during sign-in
//    mode because the user is not progressing through steps.
//
// 4. A sign-out affordance is always available on main-flow
//    steps so sellers can switch accounts.
// ─────────────────────────────────────────────────────────────
import React         from "react";
import { Navigate }  from "react-router-dom";
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
// PROGRESS CONFIG
// Only the 6 main-flow steps get a progress bar entry.
// ─────────────────────────────────────────────────────────────
const PROGRESS_STEPS = [
  { key: STEPS.REGISTER,     label: "Register",     icon: "👤" },
  { key: STEPS.OTP_VERIFY,   label: "Verify Email", icon: "📬" },
  { key: STEPS.STORE_SETUP,  label: "Store Setup",  icon: "🏪" },
  { key: STEPS.VERIFICATION, label: "Verification", icon: "🔍" },
  { key: STEPS.REVIEW,       label: "Under Review", icon: "⏳" },
  { key: STEPS.APPROVED,     label: "Approved",     icon: "✅" },
];

// Steps that live outside the main onboarding flow.
// These replace the header + progress bar with their own UI.
const PASSWORD_RESET_STEPS = new Set([
  STEPS.FORGOT_PASSWORD,
  STEPS.RESET_CODE,
  STEPS.RESET_NEW_PASSWORD,
]);

// Metadata for each password-reset step
const RESET_META = {
  [STEPS.FORGOT_PASSWORD]:    {
    title:    "Forgot Password",
    subtitle: "Enter your email to receive a 6-digit reset code",
  },
  [STEPS.RESET_CODE]:         {
    title:    "Enter Reset Code",
    subtitle: "Check your email for the 6-digit code we sent you",
  },
  [STEPS.RESET_NEW_PASSWORD]: {
    title:    "Set New Password",
    subtitle: "Your code is verified — create a strong new password",
  },
};

// Mini-steps shown inside the password-reset header
const RESET_MINI_STEPS = [
  { key: STEPS.FORGOT_PASSWORD,    label: "Email",    icon: "📧" },
  { key: STEPS.RESET_CODE,         label: "Code",     icon: "🔢" },
  { key: STEPS.RESET_NEW_PASSWORD, label: "Password", icon: "🔑" },
];

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
            <div
              className={[
                "step-circle",
                isActive    ? "active"    : "",
                isCompleted ? "completed" : "",
              ].filter(Boolean).join(" ")}
            >
              {isCompleted ? "✓" : s.icon}
            </div>
            <span
              className={[
                "step-label",
                isActive    ? "active"    : "",
                isCompleted ? "completed" : "",
              ].filter(Boolean).join(" ")}
            >
              {s.label}
            </span>
          </div>

          {idx < PROGRESS_STEPS.length - 1 && (
            <div
              className={[
                "progress-line",
                isCompleted ? "completed" : "",
              ].filter(Boolean).join(" ")}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ═════════════════════════════════════════════════════════════
// PASSWORD RESET HEADER
// Replaces the main header for FORGOT_PASSWORD → RESET_NEW_PASSWORD
// ═════════════════════════════════════════════════════════════
const PasswordFlowHeader = ({ step }) => {
  const meta = RESET_META[step] ?? {
    title: "Password Reset", subtitle: "",
  };

  return (
    <div style={st.header}>
      <h1 style={st.title}>{meta.title}</h1>
      <p style={st.subtitle}>{meta.subtitle}</p>

      {/* Mini 3-step pills */}
      <div style={st.resetStepRow}>
        {RESET_MINI_STEPS.map((rs, idx) => {
          // Use explicit set membership to avoid fragile numeric comparisons
          const stepOrder = RESET_MINI_STEPS.map((x) => x.key);
          const currentIdx = stepOrder.indexOf(step);
          const thisIdx    = stepOrder.indexOf(rs.key);

          const isCurrent = step === rs.key;
          const isDone    = currentIdx > thisIdx;

          return (
            <React.Fragment key={rs.key}>
              <div
                style={{
                  ...st.resetPill,
                  background: isDone
                    ? "#10b981"
                    : isCurrent
                    ? "#6366f1"
                    : "#e5e7eb",
                  color: isDone || isCurrent ? "#fff" : "#9ca3af",
                }}
              >
                <span>{isDone ? "✓" : rs.icon}</span>
                <span style={st.resetPillLabel}>{rs.label}</span>
              </div>

              {idx < RESET_MINI_STEPS.length - 1 && (
                <div
                  style={{
                    ...st.resetLine,
                    background: isDone ? "#10b981" : "#e5e7eb",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// MAIN FLOW HEADER
// Shown for REGISTER → APPROVED (excl. password reset)
// ═════════════════════════════════════════════════════════════
const MainHeader = ({ step, totalSteps, onSignOut }) => {
  // Clamp to the 0-based progress index
  const progressIdx = Math.min(
    PROGRESS_STEPS.findIndex((s) => s.key === step),
    totalSteps - 1,
  );
  // findIndex returns -1 if step isn't in PROGRESS_STEPS (shouldn't happen)
  const displayIdx = progressIdx >= 0 ? progressIdx : 0;

  return (
    <div style={st.header}>
      <h1 style={st.title}>Become a Seller</h1>
      <p style={st.subtitle}>Set up your store and start selling</p>

      <div style={st.headerMeta}>
        <div style={st.stepBadge}>
          Step {displayIdx + 1} of {totalSteps}
        </div>

        {/* Sign-out affordance — only show after registration */}
        {step > STEPS.REGISTER && (
          <button
            type="button"
            style={st.signOutBtn}
            onClick={onSignOut}
            title="Sign out of seller account"
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );
};

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
// Shown when a marketplace (public.users) token is detected
// on the seller onboarding route.
// ═════════════════════════════════════════════════════════════
const MarketplaceUserScreen = ({ onSignOut }) => (
  <div className="seller-wrapper">
    <div
      className="seller-card"
      style={{ textAlign: "center", padding: "2.5rem 2rem" }}
    >
      <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🏪</div>

      <h2 style={st.gmailTitle}>Seller Account Required</h2>
      <p style={st.gmailBody}>
        You are signed in with a <strong>marketplace account</strong>.
        The seller system requires a separate seller account with its
        own email and password.
      </p>

      <div style={st.gmailActions}>
        <button onClick={onSignOut} className="btn-seller-primary">
          📝 Create / Sign In to Seller Account
        </button>
        <a href="/" style={st.backLink}>
          ← Back to Marketplace
        </a>
      </div>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════
// REVIEW SCREEN
// Rendered at STEPS.REVIEW — shows checklist + status.
// ═════════════════════════════════════════════════════════════
const ReviewScreen = ({ vendor }) => {
  const status = vendor?.status ?? "pending";

  const checklist = [
    { icon: "📋", label: "Account created",          done: true },
    { icon: "📬", label: "Email verified",           done: true },
    { icon: "🏪", label: "Store setup complete",     done: true },
    {
      icon:  "🔍",
      label: "Documents under review",
      done:  status !== "pending",
    },
    {
      icon:  "✅",
      label: "Store activation",
      done:  ["approved", "active"].includes(status),
    },
    {
      icon:  "🚀",
      label: "Start selling",
      done:  status === "active",
    },
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
        {checklist.map((item, i) => (
          <div className="review-step-item" key={i}>
            <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
            <span style={{
              fontWeight: 500,
              flex:       1,
              color:      item.done ? "#10b981" : "#9ca3af",
            }}>
              {item.label}
            </span>
            {item.done && (
              <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
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
      <a href="/" style={st.homeLink}>← Back to Marketplace</a>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════
const BecomeSeller = () => {
  const flow = useSellerFlow();

  // ── 1. Initializing ───────────────────────────────────────
  if (flow.initializing || flow.step === null) {
    return <MountLoader />;
  }

  // ── 2. Already fully approved → dashboard ─────────────────
  // Check both the step enum and vendorData.status to be safe.
  if (
    flow.step === STEPS.APPROVED ||
    ["active", "approved"].includes(flow.vendorData?.status)
  ) {
    return <Navigate to="/seller/dashboard" replace />;
  }

  // ── 3. Marketplace / non-seller token detected ─────────────
  if (flow.isGmailUser) {
    return <MarketplaceUserScreen onSignOut={flow.signOut} />;
  }

  // ── 4. Determine layout mode ───────────────────────────────
  const isPasswordReset = PASSWORD_RESET_STEPS.has(flow.step);

  return (
    <div className="seller-wrapper">

      {/* ── Header ─────────────────────────────────────────── */}
      {isPasswordReset ? (
        <PasswordFlowHeader step={flow.step} />
      ) : (
        <MainHeader
          step={flow.step}
          totalSteps={PROGRESS_STEPS.length}
          onSignOut={flow.signOut}
        />
      )}

      {/* ── Progress bar (main flow only) ──────────────────── */}
      {!isPasswordReset && (
        <ProgressBar currentStep={flow.step} />
      )}

      {/*
        ── NO global banners here ──────────────────────────────
        FIX: Previously BecomeSeller rendered its own errBanner
        and okBanner here, PLUS each child card rendered its own
        ServerAlert from flow.serverErr / flow.serverMsg.
        That caused every message to appear TWICE on screen.

        Solution: banners live ONLY inside each child component's
        card, never at the page level. Each step component is
        responsible for displaying flow.serverErr / flow.serverMsg
        in the right place relative to its action button.
      */}

      {/* ── Step renders ───────────────────────────────────── */}

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
  // ── Page header ─────────────────────────────────────────
  header: {
    textAlign:    "center",
    marginBottom: "2rem",
  },
  title: {
    fontSize:             "2rem",
    fontWeight:           800,
    background:           "linear-gradient(135deg, #6366f1, #8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor:  "transparent",
    margin:               0,
    lineHeight:           1.2,
  },
  subtitle: {
    color:     "#6b7280",
    marginTop: "0.5rem",
    fontSize:  "0.95rem",
    margin:    "0.5rem 0 0",
  },

  // ── Step badge + sign-out row ────────────────────────────
  headerMeta: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "1rem",
    marginTop:      "0.75rem",
    flexWrap:       "wrap",
  },
  stepBadge: {
    display:      "inline-block",
    padding:      "0.35rem 1rem",
    background:   "#eef2ff",
    color:        "#6366f1",
    borderRadius: "100px",
    fontWeight:   600,
    fontSize:     "0.85rem",
  },
  signOutBtn: {
    background:     "none",
    border:         "1px solid #e5e7eb",
    borderRadius:   "100px",
    color:          "#9ca3af",
    fontSize:       "0.8rem",
    fontWeight:     500,
    padding:        "0.3rem 0.875rem",
    cursor:         "pointer",
    fontFamily:     "inherit",
    transition:     "all 0.2s ease",
  },

  // ── Password reset mini-stepper ──────────────────────────
  resetStepRow: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    marginTop:      "1.25rem",
    gap:            0,
  },
  resetPill: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          "0.35rem",
    padding:      "0.35rem 0.875rem",
    borderRadius: "100px",
    fontSize:     "0.8rem",
    fontWeight:   700,
    transition:   "all 0.3s ease",
  },
  resetPillLabel: {
    fontSize: "0.78rem",
  },
  resetLine: {
    height:     "2px",
    width:      "2rem",
    flexShrink: 0,
    transition: "background 0.3s ease",
  },

  // ── Mount loader ─────────────────────────────────────────
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

  // ── Marketplace user screen ──────────────────────────────
  gmailTitle: {
    fontWeight:   800,
    color:        "#1f2937",
    marginBottom: "0.75rem",
    fontSize:     "1.4rem",
  },
  gmailBody: {
    color:        "#6b7280",
    lineHeight:   1.7,
    marginBottom: "2rem",
    fontSize:     "0.9rem",
  },
  gmailActions: {
    display:       "flex",
    flexDirection: "column",
    gap:           "0.75rem",
    maxWidth:      "320px",
    margin:        "0 auto",
  },
  backLink: {
    color:          "#9ca3af",
    textDecoration: "none",
    fontSize:       "0.9rem",
    textAlign:      "center",
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
  emailNote: {
    color:     "#9ca3af",
    fontSize:  "0.875rem",
    marginTop: "1.5rem",
  },
  homeLink: {
    display:        "inline-block",
    marginTop:      "1.5rem",
    color:          "#6b7280",
    fontSize:       "0.9rem",
    textDecoration: "none",
    fontWeight:     500,
  },
};

export default BecomeSeller;