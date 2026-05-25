import React from "react";

// ─── Doc Config ──────────────────────────────────────────────
const DOCS = [
  {
    name:     "id_card",
    label:    "Government ID / Passport",
    icon:     "🪪",
    required: true,
    hint:     "Clear photo of front side",
  },
  {
    name:     "selfie",
    label:    "Selfie Holding ID",
    icon:     "🤳",
    required: true,
    hint:     "Face clearly visible next to ID",
  },
  {
    name:     "business_doc",
    label:    "Business Registration",
    icon:     "📄",
    required: false,
    hint:     "Optional — for business vendors",
  },
  {
    name:     "address_proof",
    label:    "Address Proof",
    icon:     "📍",
    required: false,
    hint:     "Utility bill or bank statement",
  },
];

// ─── Component ────────────────────────────────────────────────
const VerificationStep = ({ flow }) => {
  const {
    verifyData,
    errors,
    loading,
    serverMsg,
    handleVerifyChange,
    submitVerification,
    setStep,
  } = flow;

  return (
    <div className="seller-card">
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1f2937" }}>
          🔍 Identity Verification
        </h2>
        <p style={{ color: "#6b7280", marginTop: "0.35rem", lineHeight: 1.6 }}>
          We need to verify your identity to keep our marketplace safe.
          Your documents are encrypted and stored securely.
        </p>
      </div>

      {/* Security badge */}
      <div
        style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          borderRadius: "12px",
          padding: "0.875rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "2rem",
        }}
      >
        <span style={{ fontSize: "1.5rem" }}>🔒</span>
        <p style={{ color: "#065f46", fontSize: "0.875rem", fontWeight: 500 }}>
          All documents are encrypted with AES-256 and only reviewed by verified staff.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {DOCS.map((doc) => (
          <DocUploadField
            key={doc.name}
            doc={doc}
            file={verifyData[doc.name]}
            error={errors[doc.name]}
            onChange={handleVerifyChange}
          />
        ))}

        {/* Server message */}
        {serverMsg && (
          <div
            className={`seller-alert ${
              serverMsg.toLowerCase().includes("fail") ? "error" : "success"
            }`}
          >
            {serverMsg}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={() => setStep(0)}
            className="btn-seller-secondary"
            style={{ width: "100%" }}
          >
            ← Back
          </button>
          <button
            onClick={submitVerification}
            disabled={loading}
            className="btn-seller-primary"
          >
            {loading ? "Uploading..." : "Submit for Review →"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Single Doc Upload Field ──────────────────────────────────
const DocUploadField = ({ doc, file, error, onChange }) => (
  <div className="seller-field">
    <label className="seller-label">
      {doc.icon} {doc.label}
      {doc.required ? (
        <span style={{ color: "#ef4444" }}> *</span>
      ) : (
        <span
          style={{
            color: "#9ca3af",
            fontSize: "0.75rem",
            fontWeight: 400,
          }}
        >
          {" "}(optional)
        </span>
      )}
    </label>

    <div className={`upload-box ${error ? "error" : ""}`}>
      <input
        type="file"
        name={doc.name}
        accept="image/*,application/pdf"
        onChange={onChange}
      />
      {file ? (
        <>
          <div style={{ fontSize: "2.5rem" }}>✅</div>
          <p style={{ color: "#10b981", fontWeight: 600 }}>{file.name}</p>
          <p style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
            Click to replace
          </p>
        </>
      ) : (
        <>
          <div className="upload-icon">{doc.icon}</div>
          <p className="upload-text">Click to upload</p>
          <p className="upload-sub">{doc.hint} — JPG, PNG, PDF</p>
        </>
      )}
    </div>

    {error && <span className="field-error">⚠️ {error}</span>}
  </div>
);

export default VerificationStep;