import React from "react";
import { useSellerFlow, STEPS } from "../hooks/useSellerFlow";
import StoreSetup      from "../components/seller/StoreSetup";
import VerificationStep from "../components/seller/VerificationStep";
import StorePreview    from "../components/seller/StorePreview";
import "../style/Seller.css";

// ─── Progress Configuration ──────────────────────────────────
const PROGRESS_STEPS = [
  { key: STEPS.STORE_SETUP,  label: "Store Setup",   icon: "🏪" },
  { key: STEPS.VERIFICATION, label: "Verification",  icon: "🔍" },
  { key: STEPS.REVIEW,       label: "Under Review",  icon: "⏳" },
  { key: STEPS.APPROVED,     label: "Approved",      icon: "✅" },
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
                isActive ? "active" : isCompleted ? "completed" : ""
              }`}
            >
              {isCompleted ? "✓" : s.icon}
            </div>
            <span
              className={`step-label ${
                isActive ? "active" : isCompleted ? "completed" : ""
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

// ─── Main Page ────────────────────────────────────────────────
const BecomeSeller = () => {
  const flow = useSellerFlow();

  return (
    <div className="seller-wrapper">
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Become a Seller
        </h1>
        <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>
          Set up your store and start selling to millions of users
        </p>
      </div>

      {/* Progress */}
      <ProgressBar currentStep={flow.step} />

      {/* Step Screens */}
      {flow.step === STEPS.STORE_SETUP && (
        <StoreSetup flow={flow} />
      )}

      {flow.step === STEPS.VERIFICATION && (
        <VerificationStep flow={flow} />
      )}

      {flow.step === STEPS.REVIEW && (
        <ReviewScreen />
      )}

      {flow.step === STEPS.APPROVED && (
        <ApprovedScreen />
      )}
    </div>
  );
};

// ─── Review Pending Screen ────────────────────────────────────
const ReviewScreen = () => (
  <div className="seller-card review-screen">
    <div className="review-icon">⏳</div>
    <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1f2937" }}>
      Application Under Review
    </h2>
    <p style={{ color: "#6b7280", marginTop: "0.75rem", lineHeight: 1.6 }}>
      Our team is reviewing your application. This usually takes{" "}
      <strong>1–3 business days</strong>.
    </p>

    <div className="review-steps">
      {[
        { icon: "📋", text: "Application received",        done: true  },
        { icon: "🔍", text: "Documents under review",      done: true  },
        { icon: "✅", text: "Store activation",            done: false },
        { icon: "🚀", text: "Start selling",               done: false },
      ].map((item, i) => (
        <div className="review-step-item" key={i}>
          <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
          <span
            style={{
              fontWeight: 500,
              color: item.done ? "#10b981" : "#9ca3af",
            }}
          >
            {item.text}
          </span>
          {item.done && (
            <span style={{ marginLeft: "auto", color: "#10b981" }}>✓</span>
          )}
        </div>
      ))}
    </div>

    <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginTop: "1.5rem" }}>
      📧 We'll email you once your store is approved.
    </p>
  </div>
);

// ─── Approved Screen ──────────────────────────────────────────
const ApprovedScreen = () => (
  <div className="seller-card review-screen">
    <div className="review-icon">🎉</div>
    <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981" }}>
      You're Approved!
    </h2>
    <p style={{ color: "#6b7280", marginTop: "0.75rem" }}>
      Your store is live. Start adding products and make your first sale!
    </p>
    <a
      href="/seller/dashboard"
      className="btn-seller-primary"
      style={{ marginTop: "2rem", textDecoration: "none", display: "inline-flex" }}
    >
      🚀 Go to Seller Dashboard
    </a>
  </div>
);

export default BecomeSeller;