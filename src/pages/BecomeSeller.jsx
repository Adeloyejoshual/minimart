// pages/BecomeSeller.jsx
import React, { useState } from "react";
import { Navigate }        from "react-router-dom";
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
// CONFIG
// ─────────────────────────────────────────────────────────────
const PROGRESS_STEPS = [
  { key: STEPS.REGISTER,     label: "Register",     icon: "👤" },
  { key: STEPS.OTP_VERIFY,   label: "Verify Email", icon: "📬" },
  { key: STEPS.STORE_SETUP,  label: "Store Setup",  icon: "🏪" },
  { key: STEPS.VERIFICATION, label: "Verification", icon: "🔍" },
  { key: STEPS.REVIEW,       label: "Under Review", icon: "⏳" },
  { key: STEPS.APPROVED,     label: "Approved",     icon: "✅" },
];

const PASSWORD_RESET_STEPS = new Set([
  STEPS.FORGOT_PASSWORD,
  STEPS.RESET_CODE,
  STEPS.RESET_NEW_PASSWORD,
]);

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

const RESET_MINI_STEPS = [
  { key: STEPS.FORGOT_PASSWORD,    label: "Email",    icon: "📧" },
  { key: STEPS.RESET_CODE,         label: "Code",     icon: "🔢" },
  { key: STEPS.RESET_NEW_PASSWORD, label: "Password", icon: "🔑" },
];

// ─────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// PASSWORD RESET HEADER
// ─────────────────────────────────────────────────────────────
const PasswordFlowHeader = ({ step }) => {
  const meta       = RESET_META[step] ?? { title: "Password Reset", subtitle: "" };
  const stepOrder  = RESET_MINI_STEPS.map((x) => x.key);
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div style={st.header}>
      <h1 style={st.title}>{meta.title}</h1>
      <p style={st.subtitle}>{meta.subtitle}</p>

      <div style={st.resetStepRow}>
        {RESET_MINI_STEPS.map((rs, idx) => {
          const thisIdx   = stepOrder.indexOf(rs.key);
          const isCurrent = step === rs.key;
          const isDone    = currentIdx > thisIdx;

          return (
            <React.Fragment key={rs.key}>
              <div style={{
                ...st.resetPill,
                background: isDone ? "#10b981" : isCurrent ? "#6366f1" : "#e5e7eb",
                color:      isDone || isCurrent ? "#fff" : "#9ca3af",
              }}>
                <span>{isDone ? "✓" : rs.icon}</span>
                <span style={st.resetPillLabel}>{rs.label}</span>
              </div>
              {idx < RESET_MINI_STEPS.length - 1 && (
                <div style={{
                  ...st.resetLine,
                  background: isDone ? "#10b981" : "#e5e7eb",
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN FLOW HEADER
// ─────────────────────────────────────────────────────────────
const MainHeader = ({ step, totalSteps, onSignOut }) => {
  const progressIdx = PROGRESS_STEPS.findIndex((s) => s.key === step);
  const displayIdx  = progressIdx >= 0 ? progressIdx : 0;

  return (
    <div style={st.header}>
      <h1 style={st.title}>Become a Seller</h1>
      <p style={st.subtitle}>Set up your store and start selling</p>
      <div style={st.headerMeta}>
        <div style={st.stepBadge}>
          Step {displayIdx + 1} of {totalSteps}
        </div>
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

// ─────────────────────────────────────────────────────────────
// MOUNT LOADER
// ─────────────────────────────────────────────────────────────
const MountLoader = () => (
  <div style={st.loaderWrap}>
    <div style={st.spinner} />
    <p style={st.loaderText}>Loading your seller profile…</p>
  </div>
);

// ─────────────────────────────────────────────────────────────
// MARKETPLACE USER SCREEN
// ─────────────────────────────────────────────────────────────
const MarketplaceUserScreen = ({ onSignOut }) => (
  <div className="seller-wrapper">
    <div className="seller-card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
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
        <a href="/" style={st.backLink}>← Back to Marketplace</a>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// REVIEW SCREEN
// ─────────────────────────────────────────────────────────────
const ReviewScreen = ({ vendor }) => {
  const status    = vendor?.status ?? "pending";
  const checklist = [
    { icon: "📋", label: "Account created",      done: true },
    { icon: "📬", label: "Email verified",        done: true },
    { icon: "🏪", label: "Store setup complete",  done: true },
    { icon: "🔍", label: "Documents under review",done: status !== "pending" },
    { icon: "✅", label: "Store activation",      done: ["approved","active"].includes(status) },
    { icon: "🚀", label: "Start selling",         done: status === "active" },
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
            <span style={{ fontWeight: 500, flex: 1, color: item.done ? "#10b981" : "#9ca3af" }}>
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
          <strong>Rejection reason: </strong>{vendor.rejection_reason}
        </div>
      )}
      <p style={st.emailNote}>📧 We'll notify you by email once reviewed.</p>
      <a href="/" style={st.homeLink}>← Back to Marketplace</a>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// DEBUG PANEL — visible only in development
// Helps diagnose "Incorrect password after reset" by running
// the exact bcrypt.compare the server would run, live.
// ─────────────────────────────────────────────────────────────
const DebugPanel = () => {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [dbResult,    setDbResult]    = useState(null);
  const [loginResult, setLoginResult] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [open,        setOpen]        = useState(true);

  const checkDb = async () => {
    if (!email.trim()) return;
    setLoading(true); setError(""); setDbResult(null);
    try {
      const res  = await fetch(
        `/api/seller-auth/debug/${encodeURIComponent(email.trim())}`
      );
      const data = await res.json();
      setDbResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const testLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true); setError(""); setLoginResult(null);
    try {
      const res  = await fetch("/api/seller-auth/debug/test-login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      setLoginResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pass     = loginResult?.conclusion ?? "";
  const passedAll = pass.includes("✅");

  return (
    <div style={db.wrap}>
      {/* Header */}
      <div style={db.topRow}>
        <div>
          <span style={db.badge}>🛠 DEBUG</span>
          <span style={db.heading}> Seller Auth Health Check</span>
        </div>
        <button style={db.toggleBtn} onClick={() => setOpen((v) => !v)}>
          {open ? "Collapse ▲" : "Expand ▼"}
        </button>
      </div>

      {!open && (
        <p style={{ color: "#818cf8", margin: "0.5rem 0 0", fontSize: "0.75rem" }}>
          Panel collapsed — expand to run diagnostics
        </p>
      )}

      {open && (
        <>
          <p style={db.note}>
            ⚠️ Remove this panel before going to production.
            It exposes internal auth state.
          </p>

          {/* Inputs */}
          <div style={db.row}>
            <input
              style={db.input}
              type="email"
              placeholder="seller email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              style={db.input}
              // type="text" so we can see exactly what is typed
              type="text"
              placeholder="password (visible for debug)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Character inspector — highlights spaces */}
          {password && (
            <div style={db.charRow}>
              <strong style={{ color: "#a5b4fc" }}>Chars: </strong>
              {password.split("").map((ch, i) => (
                <span
                  key={i}
                  title={ch === " " ? "⚠️ SPACE" : `char: ${ch}`}
                  style={{
                    ...db.char,
                    background: ch === " " ? "#fca5a5" : "#dbeafe",
                  }}
                >
                  {ch === " " ? "·" : ch}
                </span>
              ))}
              <span style={{ color: "#818cf8", fontSize: "0.73rem", marginLeft: "0.4rem" }}>
                len={password.length}
                {password.startsWith(" ") && " ⚠️ leading space"}
                {password.endsWith(" ")   && " ⚠️ trailing space"}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div style={db.row}>
            <button
              style={db.btn}
              onClick={checkDb}
              disabled={loading || !email.trim()}
            >
              {loading ? "…" : "1️⃣  Check DB State"}
            </button>
            <button
              style={{ ...db.btn, background: "#7c3aed" }}
              onClick={testLogin}
              disabled={loading || !email.trim() || !password}
            >
              {loading ? "…" : "2️⃣  Test bcrypt Login"}
            </button>
          </div>

          {error && <div style={db.errBox}>⚠️ {error}</div>}

          {/* DB result */}
          {dbResult && (
            <div style={db.resultBox}>
              <div style={db.resultHdr}>
                {dbResult.found ? "✅ Account found in market.users" : "❌ Account NOT found"}
              </div>
              {dbResult.found && (
                <table style={db.table}>
                  <tbody>
                    <DR label="Email in DB"      value={dbResult.email} />
                    <DR label="Status"           value={dbResult.status}
                        ok={dbResult.status === "active"} />
                    <DR label="is_verified"      value={String(dbResult.is_verified)}
                        ok={dbResult.is_verified} />
                    <DR label="Hash prefix"      value={dbResult.password?.hash_prefix}
                        ok={dbResult.password?.hash_prefix?.startsWith("$2b$")}
                        hint="Should be $2b$12" />
                    <DR label="Hash length"      value={String(dbResult.password?.hash_length)}
                        ok={dbResult.password?.hash_length === 60}
                        hint="Should be 60" />
                    <DR label="Hash looks valid" value={String(dbResult.password?.looks_valid)}
                        ok={dbResult.password?.looks_valid} />
                    <DR label="Has reset_code"   value={String(dbResult.reset?.has_reset_code)}
                        ok={!dbResult.reset?.has_reset_code}
                        hint="Should be false after completed reset" />
                    <DR label="Reset code valid" value={String(dbResult.reset?.reset_code_still_valid)} />
                    <DR label="Updated at"
                        value={dbResult.timestamps?.updated_at
                          ? new Date(dbResult.timestamps.updated_at).toLocaleString()
                          : "— no updated_at column"} />
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Login test result */}
          {loginResult && (
            <div style={db.resultBox}>
              <div style={{
                ...db.resultHdr,
                background: passedAll ? "#d1fae5" : "#fef2f2",
                color:      passedAll ? "#065f46" : "#991b1b",
              }}>
                {loginResult.conclusion}
              </div>
              <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <DS label="1. Input"         data={loginResult.step_1_input} />
                <DS label="2. DB Lookup"     data={loginResult.step_2_db_lookup} />
                <DS label="3. Status Check"  data={loginResult.step_3_status_check} />
                <DS label="4. Verified"      data={loginResult.step_4_verified_check} />
                <DS label="5. bcrypt"        data={loginResult.step_5_bcrypt} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Debug sub-components
const DR = ({ label, value, ok, hint }) => (
  <tr>
    <td style={db.tdL}>{label}</td>
    <td style={{
      ...db.tdV,
      color:      ok === true ? "#065f46" : ok === false ? "#991b1b" : "#e0e7ff",
      fontWeight: ok !== undefined ? 700 : 400,
    }}>
      {ok === true && "✅ "}{ok === false && "❌ "}{value ?? "—"}
      {hint && <span style={{ color: "#818cf8", fontWeight: 400, fontSize: "0.73rem" }}> ({hint})</span>}
    </td>
  </tr>
);

const DS = ({ label, data }) => {
  if (!data) return null;
  return (
    <div style={{ background: "#312e81", borderRadius: "8px", padding: "0.5rem 0.75rem" }}>
      <strong style={{ color: "#a5b4fc", fontSize: "0.73rem", display: "block", marginBottom: "0.25rem" }}>
        {label}
      </strong>
      <pre style={{ margin: 0, color: "#e0e7ff", fontSize: "0.73rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
const BecomeSeller = () => {
  const flow = useSellerFlow();

  // 1. Still initializing
  if (flow.initializing || flow.step === null) {
    return <MountLoader />;
  }

  // 2. Already approved → dashboard
  if (
    flow.step === STEPS.APPROVED ||
    ["active", "approved"].includes(flow.vendorData?.status)
  ) {
    return <Navigate to="/seller/dashboard" replace />;
  }

  // 3. Marketplace token detected
  if (flow.isGmailUser) {
    return <MarketplaceUserScreen onSignOut={flow.signOut} />;
  }

  const isPasswordReset = PASSWORD_RESET_STEPS.has(flow.step);

  return (
    <div className="seller-wrapper">

      {/* Header */}
      {isPasswordReset ? (
        <PasswordFlowHeader step={flow.step} />
      ) : (
        <MainHeader
          step={flow.step}
          totalSteps={PROGRESS_STEPS.length}
          onSignOut={flow.signOut}
        />
      )}

      {/* Progress bar — main flow only */}
      {!isPasswordReset && (
        <ProgressBar currentStep={flow.step} />
      )}

      {/*
        NO global banners — each child card owns its own
        ServerAlert rendered from flow.serverMsg / flow.serverErr.
        Rendering here too caused every message to appear twice.
      */}

      {/* Step renders */}
      {flow.step === STEPS.REGISTER         && <RegisterStep       flow={flow} />}
      {flow.step === STEPS.OTP_VERIFY        && <OtpStep            flow={flow} />}
      {flow.step === STEPS.FORGOT_PASSWORD   && <ForgotPasswordStep flow={flow} />}
      {flow.step === STEPS.RESET_CODE        && <ResetCodeStep      flow={flow} />}
      {flow.step === STEPS.RESET_NEW_PASSWORD && <ResetPasswordStep  flow={flow} />}
      {flow.step === STEPS.STORE_SETUP       && <StoreSetup         flow={flow} />}
      {flow.step === STEPS.VERIFICATION      && <VerificationStep   flow={flow} />}
      {flow.step === STEPS.REVIEW            && <ReviewScreen vendor={flow.vendorData} />}

      {/* Debug panel — development only */}
      {import.meta.env.DEV && <DebugPanel />}

    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// STYLES — page
// ─────────────────────────────────────────────────────────────
const st = {
  header:     { textAlign: "center", marginBottom: "2rem" },
  title: {
    fontSize:             "2rem",
    fontWeight:           800,
    background:           "linear-gradient(135deg,#6366f1,#8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor:  "transparent",
    margin:               0,
    lineHeight:           1.2,
  },
  subtitle:   { color: "#6b7280", marginTop: "0.5rem", fontSize: "0.95rem", margin: "0.5rem 0 0" },
  headerMeta: { display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" },
  stepBadge:  { display: "inline-block", padding: "0.35rem 1rem", background: "#eef2ff", color: "#6366f1", borderRadius: "100px", fontWeight: 600, fontSize: "0.85rem" },
  signOutBtn: { background: "none", border: "1px solid #e5e7eb", borderRadius: "100px", color: "#9ca3af", fontSize: "0.8rem", fontWeight: 500, padding: "0.3rem 0.875rem", cursor: "pointer", fontFamily: "inherit" },
  resetStepRow: { display: "flex", alignItems: "center", justifyContent: "center", marginTop: "1.25rem", gap: 0 },
  resetPill:    { display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.35rem 0.875rem", borderRadius: "100px", fontSize: "0.8rem", fontWeight: 700, transition: "all 0.3s ease" },
  resetPillLabel: { fontSize: "0.78rem" },
  resetLine:    { height: "2px", width: "2rem", flexShrink: 0, transition: "background 0.3s ease" },
  loaderWrap:   { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", background: "#f9fafb" },
  spinner:      { width: "44px", height: "44px", border: "4px solid #e5e7eb", borderTop: "4px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loaderText:   { color: "#9ca3af", fontWeight: 500, margin: 0 },
  gmailTitle:   { fontWeight: 800, color: "#1f2937", marginBottom: "0.75rem", fontSize: "1.4rem" },
  gmailBody:    { color: "#6b7280", lineHeight: 1.7, marginBottom: "2rem", fontSize: "0.9rem" },
  gmailActions: { display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "320px", margin: "0 auto" },
  backLink:     { color: "#9ca3af", textDecoration: "none", fontSize: "0.9rem", textAlign: "center" },
  reviewTitle:  { fontSize: "1.75rem", fontWeight: 800, color: "#1f2937", margin: "0 0 0.25rem" },
  reviewDesc:   { color: "#6b7280", marginTop: "0.75rem", lineHeight: 1.6, fontSize: "0.9rem" },
  rejectionBox: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "1rem", color: "#991b1b", fontSize: "0.875rem", margin: "1rem 0", textAlign: "left", lineHeight: 1.5 },
  emailNote:    { color: "#9ca3af", fontSize: "0.875rem", marginTop: "1.5rem" },
  homeLink:     { display: "inline-block", marginTop: "1.5rem", color: "#6b7280", fontSize: "0.9rem", textDecoration: "none", fontWeight: 500 },
};

// ─────────────────────────────────────────────────────────────
// STYLES — debug panel
// ─────────────────────────────────────────────────────────────
const db = {
  wrap:      { marginTop: "2rem", padding: "1.5rem", background: "#1e1b4b", borderRadius: "16px", color: "#e0e7ff", fontFamily: "monospace", fontSize: "0.82rem" },
  topRow:    { display: "flex", justifyContent: "space-between", alignItems: "center" },
  badge:     { background: "#4f46e5", color: "white", padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em" },
  heading:   { color: "#c7d2fe", fontWeight: 700, fontSize: "0.95rem" },
  toggleBtn: { background: "#312e81", border: "none", color: "#a5b4fc", borderRadius: "6px", padding: "0.3rem 0.75rem", cursor: "pointer", fontFamily: "monospace", fontSize: "0.78rem" },
  note:      { color: "#f87171", fontSize: "0.75rem", margin: "0.75rem 0 1rem", background: "#450a0a", padding: "0.5rem 0.75rem", borderRadius: "6px" },
  row:       { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" },
  input:     { flex: 1, minWidth: "180px", padding: "0.6rem 0.875rem", borderRadius: "8px", border: "1px solid #4338ca", background: "#312e81", color: "#e0e7ff", fontSize: "0.85rem", fontFamily: "monospace", outline: "none" },
  btn:       { padding: "0.6rem 1.25rem", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem", fontFamily: "monospace" },
  charRow:   { marginBottom: "0.75rem", lineHeight: 2 },
  char:      { display: "inline-block", padding: "0.1rem 0.25rem", borderRadius: "4px", marginRight: "2px", fontWeight: 700, fontSize: "0.82rem", color: "#1e1b4b" },
  errBox:    { background: "#450a0a", border: "1px solid #991b1b", borderRadius: "8px", padding: "0.75rem", color: "#fca5a5", marginBottom: "0.75rem" },
  resultBox: { background: "#1e1b4b", border: "1px solid #3730a3", borderRadius: "10px", overflow: "hidden", marginBottom: "0.75rem" },
  resultHdr: { padding: "0.75rem 1rem", background: "#312e81", fontWeight: 700, fontSize: "0.85rem", color: "#e0e7ff" },
  table:     { width: "100%", borderCollapse: "collapse", padding: "0.5rem" },
  tdL:       { padding: "0.35rem 0.75rem", color: "#818cf8", width: "45%", fontWeight: 600 },
  tdV:       { padding: "0.35rem 0.75rem", wordBreak: "break-all" },
};

export default BecomeSeller;