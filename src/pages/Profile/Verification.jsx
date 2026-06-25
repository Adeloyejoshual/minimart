// ════════════════════════════════════════════════════════════
// FILE: src/pages/Profile/Verification.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
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
  Authorization : `Bearer ${getToken()}`,
});

const DOC_TYPES = [
  { value: "nin",             label: "National ID (NIN)" },
  { value: "passport",        label: "International Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "voters_card",     label: "Voter's Card" },
];

/* ══════════════════════════════════════════════════════════════
   EMAIL STEP
══════════════════════════════════════════════════════════════ */
function EmailStep({ email, onDone }) {
  const [phase, setPhase] = useState("idle");
  const [otp, setOtp]     = useState("");
  const [msg, setMsg]     = useState("");
  const [dev, setDev]     = useState("");

  const send = async () => {
    setPhase("sending"); setMsg(""); setDev("");
    try {
      const r = await fetch(`${API}/verification/send-email-otp`, {
        method: "POST", headers: hdrs(),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setPhase("otp");
        if (d.dev_otp) setDev(d.dev_otp);
      } else {
        setPhase("idle");
        setMsg(d.message || "Failed to send code.");
      }
    } catch (e) {
      setPhase("idle");
      setMsg(e.message);
    }
  };

  const verify = async () => {
    if (otp.length !== OTP_LEN) return;
    setPhase("verifying"); setMsg("");
    try {
      const r = await fetch(`${API}/verification/verify-email-otp`, {
        method: "POST", headers: hdrs(),
        body: JSON.stringify({ otp }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setPhase("done");
        onDone();
      } else {
        setPhase("otp");
        setMsg(d.message || "Wrong code.");
        setOtp("");
      }
    } catch (e) {
      setPhase("otp");
      setMsg(e.message);
    }
  };

  useEffect(() => {
    if (otp.length === OTP_LEN && phase === "otp") {
      verify();
    }
  }, [otp]); // eslint-disable-line

  return (
    <div>
      <h3 style={titleStyle}>Verify Email</h3>
      <p style={subStyle}>
        {email ? `We'll send a code to ${email}` : "Confirm your email address"}
      </p>

      {phase === "idle" && (
        <button onClick={send} style={btnPrimary}>Send Code</button>
      )}

      {phase === "sending" && (
        <p style={subStyle}>Sending code…</p>
      )}

      {(phase === "otp" || phase === "verifying") && (
        <div>
          {dev && (
            <p style={devStyle}>Dev code: <strong>{dev}</strong></p>
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
          {phase === "verifying" && (
            <p style={{ ...subStyle, marginTop: 8 }}>Verifying…</p>
          )}
          <button onClick={send} style={{ ...btnGhost, marginTop: 10 }}>
            Resend code
          </button>
        </div>
      )}

      {phase === "done" && (
        <p style={{ fontSize: 14, color: "#15803d", fontWeight: 600 }}>
          ✓ Email verified
        </p>
      )}

      {msg && <p style={errStyle}>{msg}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUBMIT FORM
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
  const [done, setDone]           = useState(false);

  const handleFile = (setter) => (e) => {
    const file = e.target.files && e.target.files[0];
    setter(file || null);
  };

  const ready =
    docType.length > 0 &&
    docNumber.trim().length >= 4 &&
    docFront !== null &&
    docBack !== null &&
    selfie !== null &&
    storeName.trim().length >= 2;

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
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setDone(true);
        onDone();
      } else {
        setMsg(d.message || "Submission failed.");
      }
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: 20 }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#2563eb" }}>
          Under Review
        </p>
        <p style={{ ...subStyle, marginTop: 8 }}>
          We'll review within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={titleStyle}>Submit Documents</h3>

      {/* Document type */}
      <label style={labelStyle}>Document Type *</label>
      <select
        value={docType}
        onChange={(e) => setDocType(e.target.value)}
        style={inputStyle}
      >
        <option value="">Select…</option>
        {DOC_TYPES.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>

      {/* Document number */}
      <label style={labelStyle}>Document Number *</label>
      <input
        type="text"
        value={docNumber}
        onChange={(e) => setDocNumber(e.target.value)}
        placeholder="Enter document number"
        style={inputStyle}
        maxLength={20}
      />

      {/* Front */}
      <label style={labelStyle}>Document Front *</label>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={handleFile(setDocFront)}
        style={fileInputStyle}
      />
      {docFront && <p style={fileName}>{docFront.name}</p>}

      {/* Back */}
      <label style={labelStyle}>Document Back *</label>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={handleFile(setDocBack)}
        style={fileInputStyle}
      />
      {docBack && <p style={fileName}>{docBack.name}</p>}

      {/* Selfie */}
      <label style={labelStyle}>Selfie Photo *</label>
      <input
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFile(setSelfie)}
        style={fileInputStyle}
      />
      {selfie && <p style={fileName}>{selfie.name}</p>}

      <div style={divider} />

      {/* Store name */}
      <label style={labelStyle}>Store Name *</label>
      <input
        type="text"
        value={storeName}
        onChange={(e) => setStoreName(e.target.value)}
        placeholder="e.g. Lagos Gadget Hub"
        style={inputStyle}
        maxLength={60}
      />

      {/* Store desc */}
      <label style={labelStyle}>Description (optional)</label>
      <textarea
        value={storeDesc}
        onChange={(e) => setStoreDesc(e.target.value)}
        placeholder="What do you sell?"
        style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
        maxLength={300}
      />

      {/* Store logo */}
      <label style={labelStyle}>Store Logo (optional)</label>
      <input
        type="file"
        accept="image/*"
        onChange={handleFile(setStoreLogo)}
        style={fileInputStyle}
      />

      {/* Debug info */}
      <div style={debugStyle}>
        <p>Type: {docType || "❌"}</p>
        <p>Number: {docNumber.length >= 4 ? "✓" : "❌"} ({docNumber.length} chars)</p>
        <p>Front: {docFront ? "✓" : "❌"}</p>
        <p>Back: {docBack ? "✓" : "❌"}</p>
        <p>Selfie: {selfie ? "✓" : "❌"}</p>
        <p>Store: {storeName.length >= 2 ? "✓" : "❌"} ({storeName.length} chars)</p>
        <p style={{ fontWeight: 700, color: ready ? "#15803d" : "#dc2626" }}>
          Ready: {ready ? "YES" : "NO"}
        </p>
      </div>

      {msg && <p style={errStyle}>{msg}</p>}

      <button
        onClick={submit}
        disabled={!ready || busy}
        style={{
          ...btnPrimary,
          marginTop: 16,
          opacity: ready && !busy ? 1 : 0.5,
          cursor: ready && !busy ? "pointer" : "not-allowed",
        }}
      >
        {busy ? "Submitting…" : "Submit for Verification"}
      </button>
    </div>
  );
}

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

  if (err) {
    return (
      <div style={page}>
        <div style={container}>
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={errStyle}>{err}</p>
            <button onClick={load} style={{ ...btnPrimary, marginTop: 16 }}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const emailOk    = status.email_verified    ?? false;
  const identityOk = status.identity_verified ?? false;
  const idReview   = status.identity_review   ?? null;

  const revStatus =
    identityOk                       ? "approved"  :
    idReview?.status === "pending"   ? "pending"   :
    idReview?.status === "rejected"  ? "rejected"  :
    null;

  return (
    <div style={page}>
      <div style={container}>

        {/* Header */}
        <div style={header}>
          <button onClick={() => nav(-1)} style={backBtn}>
            ← Back
          </button>
          <h2 style={headerTitle}>Account Verification</h2>
        </div>

        {/* Email step */}
        {!emailOk && (
          <div style={card}>
            <EmailStep email={status.email} onDone={load} />
          </div>
        )}

        {/* Pending */}
        {emailOk && revStatus === "pending" && (
          <div style={card}>
            <h3 style={{ ...titleStyle, color: "#2563eb" }}>Under Review</h3>
            <p style={subStyle}>
              We've received your documents. Review usually takes within 24 hours.
            </p>
          </div>
        )}

        {/* Approved */}
        {emailOk && revStatus === "approved" && (
          <div style={card}>
            <h3 style={{ ...titleStyle, color: "#15803d" }}>✓ Verified</h3>
            <p style={subStyle}>
              Full access — 100 listings/day, 500 active, no expiry.
            </p>
          </div>
        )}

        {/* Rejected */}
        {emailOk && revStatus === "rejected" && (
          <div style={card}>
            <h3 style={{ ...titleStyle, color: "#dc2626" }}>Rejected</h3>
            {idReview?.rejection_reason && (
              <p style={rejectStyle}>
                Reason: {idReview.rejection_reason}
              </p>
            )}
            <SubmitForm onDone={load} />
          </div>
        )}

        {/* No review yet — show form */}
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
   STYLES
══════════════════════════════════════════════════════════════ */
const page = {
  minHeight: "100vh",
  background: "#F7F4EF",
  padding: "20px 14px 80px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const container = {
  maxWidth: 520,
  margin: "0 auto",
};

const header = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 20,
};

const headerTitle = {
  fontSize: 18,
  fontWeight: 700,
  color: "#1c1714",
  margin: 0,
};

const card = {
  background: "#fff",
  border: "1px solid #eae6e0",
  borderRadius: 16,
  padding: "20px 18px",
  marginBottom: 14,
};

const titleStyle = {
  fontSize: 16,
  fontWeight: 700,
  color: "#1c1714",
  marginBottom: 8,
  marginTop: 0,
};

const subStyle = {
  fontSize: 13,
  color: "#6b6560",
  marginBottom: 12,
  marginTop: 0,
  lineHeight: 1.5,
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#1c1714",
  marginBottom: 6,
  marginTop: 0,
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
  marginBottom: 14,
  boxSizing: "border-box",
  WebkitAppearance: "none",
  appearance: "none",
};

const fileInputStyle = {
  display: "block",
  width: "100%",
  padding: "10px 0",
  fontSize: 13,
  color: "#6b6560",
  marginBottom: 4,
};

const fileName = {
  fontSize: 12,
  color: "#FF5C00",
  fontWeight: 600,
  marginBottom: 14,
  marginTop: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const btnPrimary = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  padding: "13px 24px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #FF5C00, #FF8040)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  boxSizing: "border-box",
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

const backBtn = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1.5px solid #ddd9d3",
  background: "#fff",
  color: "#6b6560",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const errStyle = {
  fontSize: 13,
  color: "#dc2626",
  marginTop: 8,
  marginBottom: 0,
};

const devStyle = {
  fontSize: 12,
  color: "#d97706",
  background: "#fef3c7",
  padding: "6px 10px",
  borderRadius: 6,
  marginBottom: 8,
};

const rejectStyle = {
  fontSize: 13,
  color: "#991b1b",
  background: "#fee2e2",
  padding: "8px 12px",
  borderRadius: 8,
  marginBottom: 12,
};

const divider = {
  border: "none",
  borderTop: "1px solid #eae6e0",
  margin: "20px 0",
};

const debugStyle = {
  fontSize: 11,
  color: "#999",
  padding: 10,
  background: "#f9f9f9",
  borderRadius: 8,
  marginTop: 14,
  lineHeight: 1.8,
  border: "1px solid #eee",
};