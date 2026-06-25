// ════════════════════════════════════════════════════════════
// FILE: src/pages/Profile/Verification.jsx
// Simple verification page — no image analysis, no face match,
// no liveness, no exifr, no image compression.
// Just: email OTP → upload docs + selfie + store → submit.
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../../style/Verification.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API      = `${API_BASE}/api`;
const OTP_LEN  = 6;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || "";

const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

const authMp = () => ({ Authorization: `Bearer ${getToken()}` });

const DOC_TYPES = [
  { value: "nin",             label: "National ID (NIN)" },
  { value: "passport",        label: "International Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "voters_card",     label: "Voter's Card" },
];

/* ══════════════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════════════ */
export default function Verification() {
  const nav = useNavigate();
  const [status, setStatus] = useState(null);
  const [err, setErr]       = useState("");

  const load = useCallback(async () => {
    const tk = getToken();
    if (!tk) { nav("/auth"); return; }
    try {
      const r = await fetch(`${API}/verification/status`, { headers: hdrs() });
      if (r.status === 401) { nav("/auth"); return; }
      const d = await r.json();
      if (r.ok && d.success) { setStatus(d); setErr(""); }
      else setErr(d.message || "Failed to load.");
    } catch (e) { setErr(e.message); }
  }, [nav]);

  useEffect(() => { load(); }, [load]);

  /* Error */
  if (err) return (
    <div className="v-page">
      <div className="v-container">
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ color: "#dc2626", marginBottom: 16 }}>{err}</p>
          <button onClick={load} style={btnStyle}>Retry</button>
        </div>
      </div>
    </div>
  );

  /* Waiting for data */
  if (!status) return null;

  const emailOk    = status.email_verified    ?? false;
  const identityOk = status.identity_verified ?? false;
  const idReview   = status.identity_review   ?? null;
  const revStatus  = identityOk ? "approved"
    : idReview?.status === "pending"  ? "pending"
    : idReview?.status === "rejected" ? "rejected"
    : null;

  return (
    <div className="v-page">
      <div className="v-container">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button onClick={() => nav(-1)} style={{ ...btnGhost, padding: "6px 10px" }}>← Back</button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1c1714", margin: 0 }}>Account Verification</h2>
        </div>

        {/* Step 1: Email */}
        {!emailOk && (
          <div style={card}>
            <EmailStep email={status.email} onDone={load} />
          </div>
        )}

        {/* Status: pending */}
        {emailOk && revStatus === "pending" && (
          <div style={card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#2563eb", marginBottom: 8 }}>Under Review</h3>
            <p style={{ fontSize: 14, color: "#6b6560" }}>
              We've received your documents. Review usually takes within 24 hours.
            </p>
          </div>
        )}

        {/* Status: approved */}
        {emailOk && revStatus === "approved" && (
          <div style={card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#15803d", marginBottom: 8 }}>✓ Verified</h3>
            <p style={{ fontSize: 14, color: "#6b6560" }}>
              Full access — 100 listings/day, 500 active, no expiry.
            </p>
          </div>
        )}

        {/* Status: rejected */}
        {emailOk && revStatus === "rejected" && (
          <div style={card}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Rejected</h3>
            {idReview?.rejection_reason && (
              <p style={{ fontSize: 13, color: "#991b1b", background: "#fee2e2", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
                Reason: {idReview.rejection_reason}
              </p>
            )}
            <SubmitForm onDone={load} />
          </div>
        )}

        {/* Step 2: Submit form (no review yet) */}
        {emailOk && revStatus === null && (
          <div style={card}>
            <SubmitForm onDone={load} />
          </div>
        )}

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EMAIL OTP STEP
══════════════════════════════════════════════════════════════ */
function EmailStep({ email, onDone }) {
  const [phase, setPhase] = useState("idle");
  const [otp, setOtp]     = useState("");
  const [msg, setMsg]     = useState("");
  const [dev, setDev]     = useState("");

  const send = async () => {
    setPhase("sending"); setMsg("");
    try {
      const r = await fetch(`${API}/verification/send-email-otp`, { method: "POST", headers: hdrs() });
      const d = await r.json();
      if (r.ok && d.success) { setPhase("otp"); if (d.dev_otp) setDev(d.dev_otp); }
      else { setPhase("idle"); setMsg(d.message || "Failed."); }
    } catch (e) { setPhase("idle"); setMsg(e.message); }
  };

  const verify = async () => {
    if (otp.length !== OTP_LEN) return;
    setPhase("verifying"); setMsg("");
    try {
      const r = await fetch(`${API}/verification/verify-email-otp`, {
        method: "POST", headers: hdrs(), body: JSON.stringify({ otp }),
      });
      const d = await r.json();
      if (r.ok && d.success) { setPhase("done"); onDone(); }
      else { setPhase("otp"); setMsg(d.message || "Wrong code."); setOtp(""); }
    } catch (e) { setPhase("otp"); setMsg(e.message); }
  };

  useEffect(() => {
    if (otp.length === OTP_LEN && phase === "otp") verify();
  }, [otp]); // eslint-disable-line

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Verify Email</h3>
      <p style={{ fontSize: 13, color: "#6b6560", marginBottom: 12 }}>
        {email ? `We'll send a code to ${email}` : "Confirm your email address"}
      </p>

      {phase === "idle" && (
        <button onClick={send} style={btnStyle}>Send Code</button>
      )}

      {phase === "sending" && <p style={{ fontSize: 13, color: "#6b6560" }}>Sending…</p>}

      {(phase === "otp" || phase === "verifying") && (
        <div>
          {dev && (
            <p style={{ fontSize: 12, color: "#d97706", background: "#fef3c7", padding: "6px 10px", borderRadius: 6, marginBottom: 8 }}>
              Dev code: <strong>{dev}</strong>
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            maxLength={OTP_LEN}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LEN))}
            placeholder="Enter 6-digit code"
            style={inputStyle}
            autoFocus
          />
          {phase === "verifying" && <p style={{ fontSize: 13, color: "#6b6560", marginTop: 8 }}>Verifying…</p>}
          <button onClick={send} style={{ ...btnGhost, marginTop: 8, fontSize: 12 }}>Resend code</button>
        </div>
      )}

      {phase === "done" && <p style={{ fontSize: 14, color: "#15803d", fontWeight: 600 }}>✓ Email verified</p>}

      {msg && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUBMIT FORM — identity + store in one go
══════════════════════════════════════════════════════════════ */
function SubmitForm({ onDone }) {
  const [docType, setDocType]     = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docFront, setDocFront]   = useState(null);
  const [docBack, setDocBack]     = useState(null);
  const [selfie, setSelfie]       = useState(null);
  const [storeName, setStoreName] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [storeLogo, setStoreLogo] = useState(null);
  const [busy, setBusy]           = useState(false);
  const [msg, setMsg]             = useState("");
  const [ok, setOk]               = useState(false);

  const ready = docType && docNumber.length >= 4 && docFront && docBack && selfie && storeName.length >= 2;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("document_type", docType);
      fd.append("document_number", docNumber.trim());
      fd.append("doc_front", docFront);
      fd.append("doc_back", docBack);
      fd.append("selfie", selfie);
      fd.append("store_name", storeName.trim());
      fd.append("store_description", storeDesc.trim());
      fd.append("liveness_passed", "false");
      if (storeLogo) fd.append("store_logo", storeLogo);

      const r = await fetch(`${API}/verification/submit`, {
        method: "POST", headers: authMp(), body: fd,
      });
      const d = await r.json();
      if (r.ok && d.success) { setOk(true); onDone(); }
      else setMsg(d.message || "Submission failed.");
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  if (ok) return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <p style={{ fontSize: 16, fontWeight: 700, color: "#2563eb" }}>Under Review</p>
      <p style={{ fontSize: 13, color: "#6b6560", marginTop: 8 }}>We'll review within 24 hours.</p>
    </div>
  );

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Submit Documents</h3>

      {/* Doc type */}
      <label style={labelStyle}>Document Type *</label>
      <select value={docType} onChange={(e) => setDocType(e.target.value)} style={inputStyle}>
        <option value="">Select…</option>
        {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>

      {/* Doc number */}
      <label style={labelStyle}>Document Number *</label>
      <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)}
             placeholder="Enter document number" style={inputStyle} maxLength={20} />

      {/* Front */}
      <label style={labelStyle}>Document Front *</label>
      <input type="file" accept="image/*,.pdf" onChange={(e) => setDocFront(e.target.files?.[0] ?? null)} style={fileStyle} />
      {docFront && <p style={fileNameStyle}>{docFront.name}</p>}

      {/* Back */}
      <label style={labelStyle}>Document Back *</label>
      <input type="file" accept="image/*,.pdf" onChange={(e) => setDocBack(e.target.files?.[0] ?? null)} style={fileStyle} />
      {docBack && <p style={fileNameStyle}>{docBack.name}</p>}

      {/* Selfie */}
      <label style={labelStyle}>Selfie Photo *</label>
      <input type="file" accept="image/*" capture="user" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} style={fileStyle} />
      {selfie && <p style={fileNameStyle}>{selfie.name}</p>}

      <hr style={{ border: "none", borderTop: "1px solid #eae6e0", margin: "20px 0" }} />

      {/* Store name */}
      <label style={labelStyle}>Store Name *</label>
      <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)}
             placeholder="e.g. Lagos Gadget Hub" style={inputStyle} maxLength={60} />

      {/* Store desc */}
      <label style={labelStyle}>Description (optional)</label>
      <textarea value={storeDesc} onChange={(e) => setStoreDesc(e.target.value)}
                placeholder="What do you sell?" style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} maxLength={300} />

      {/* Store logo */}
      <label style={labelStyle}>Store Logo (optional)</label>
      <input type="file" accept="image/*" onChange={(e) => setStoreLogo(e.target.files?.[0] ?? null)} style={fileStyle} />

      {msg && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 12 }}>{msg}</p>}

      <button onClick={submit} disabled={!ready || busy}
              style={{ ...btnStyle, marginTop: 16, opacity: ready && !busy ? 1 : 0.5 }}>
        {busy ? "Submitting…" : "Submit for Verification"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   INLINE STYLES (no external CSS dependency beyond v-page/v-container)
══════════════════════════════════════════════════════════════ */
const card = {
  background: "#fff",
  border: "1px solid #eae6e0",
  borderRadius: 16,
  padding: "20px 18px",
  marginBottom: 14,
};

const btnStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "12px 24px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #FF5C00, #FF8040)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
  fontFamily: "inherit",
};

const btnGhost = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "8px 14px",
  borderRadius: 8,
  border: "1.5px solid #ddd9d3",
  background: "#fff",
  color: "#6b6560",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  border: "1.5px solid #ddd9d3",
  borderRadius: 10,
  background: "#fafafa",
  color: "#1c1714",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  marginBottom: 12,
  boxSizing: "border-box",
};

const fileStyle = {
  display: "block",
  width: "100%",
  padding: "10px 0",
  fontSize: 13,
  color: "#6b6560",
  marginBottom: 4,
};

const fileNameStyle = {
  fontSize: 12,
  color: "#FF5C00",
  fontWeight: 600,
  marginBottom: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#1c1714",
  marginBottom: 6,
};