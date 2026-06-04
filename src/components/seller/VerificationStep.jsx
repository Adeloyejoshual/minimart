// components/seller/VerificationStep.jsx
import React, { useState } from "react";

// ─── Doc Config ───────────────────────────────────────────────
const DOCS = [
  {
    name:     "id_card",
    label:    "Government ID / Passport — Front",
    icon:     "🪪",
    required: true,
    hint:     "Clear photo of FRONT side",
    side:     "front",
  },
  {
    name:     "id_card_back",
    label:    "Government ID / Passport — Back",
    icon:     "🪪",
    required: true,
    hint:     "Clear photo of BACK side",
    side:     "back",
  },
  {
    name:     "selfie",
    label:    "Selfie Holding ID",
    icon:     "🤳",
    required: true,
    hint:     "Face clearly visible next to your ID",
    side:     null,
  },
  {
    name:     "business_doc",
    label:    "Business Registration",
    icon:     "📄",
    required: false,
    hint:     "Optional — CAC certificate or business doc",
    side:     null,
  },
  {
    name:     "address_proof",
    label:    "Address Proof",
    icon:     "📍",
    required: false,
    hint:     "Utility bill or bank statement",
    side:     null,
  },
];

// ─── ID Types ─────────────────────────────────────────────────
const ID_TYPES = [
  { value: "nin",        label: "NIN (National Identity Number)",  digits: 11 },
  { value: "bvn",        label: "BVN (Bank Verification Number)",   digits: 11 },
  { value: "passport",   label: "International Passport",           digits: 9  },
  { value: "drivers",    label: "Driver's Licence",                 digits: 12 },
  { value: "voters",     label: "Voter's Card",                     digits: 19 },
];

// ═════════════════════════════════════════════════════════════
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

  // ── ID number state ──────────────────────────────────────
  const [idType,   setIdType]   = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idError,  setIdError]  = useState("");

  const selectedIdType = ID_TYPES.find((t) => t.value === idType);

  // ── Validate ID number ───────────────────────────────────
  const validateIdNumber = () => {
    if (!idType) {
      setIdError("Please select an ID type");
      return false;
    }
    if (!idNumber.trim()) {
      setIdError("ID number is required");
      return false;
    }
    const digits = idNumber.replace(/\D/g, "").length;
    if (selectedIdType && digits !== selectedIdType.digits) {
      setIdError(
        `${selectedIdType.label} must be ${selectedIdType.digits} digits`
      );
      return false;
    }
    setIdError("");
    return true;
  };

  // ── Custom submit — validates ID first ───────────────────
  const handleSubmit = () => {
    if (!validateIdNumber()) return;

    // Push id_type + id_number into verifyData via synthetic events
    handleVerifyChange({
      target: {
        name:   "id_type",
        value:  idType,
        files:  null,
      },
    });
    handleVerifyChange({
      target: {
        name:   "id_number",
        value:  idNumber.trim(),
        files:  null,
      },
    });

    submitVerification();
  };

  return (
    <div className="seller-card">

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={s.header}>
        <h2 style={s.title}>🔍 Identity Verification</h2>
        <p style={s.subtitle}>
          We need to verify your identity to keep our marketplace safe.
          Your documents are encrypted and stored securely.
        </p>
      </div>

      {/* ── Security badge ───────────────────────────────────── */}
      <div style={s.securityBadge}>
        <span style={{ fontSize: "1.5rem" }}>🔒</span>
        <p style={s.securityText}>
          All documents are encrypted with AES-256 and only reviewed
          by verified staff.
        </p>
      </div>

      <div style={s.form}>

        {/* ══════════════════════════════════════════════════
            ID NUMBER SECTION
        ══════════════════════════════════════════════════ */}
        <div style={s.idSection}>
          <h3 style={s.sectionTitle}>📋 ID Information</h3>
          <p style={s.sectionSubtitle}>
            Enter your government-issued ID number
          </p>

          {/* ── ID Type selector ─────────────────────────── */}
          <div className="seller-field">
            <label className="seller-label">
              🪪 ID Type <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={s.idTypeGrid}>
              {ID_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  style={{
                    ...s.idTypeBtn,
                    background:  idType === type.value ? "#eef2ff" : "white",
                    borderColor: idType === type.value ? "#6366f1" : "#e5e7eb",
                    color:       idType === type.value ? "#6366f1" : "#374151",
                    fontWeight:  idType === type.value ? 700 : 400,
                  }}
                  onClick={() => {
                    setIdType(type.value);
                    setIdNumber("");
                    setIdError("");
                  }}
                >
                  {type.label}
                  {idType === type.value && (
                    <span style={s.idTypeCheck}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── ID Number input ───────────────────────────── */}
          {idType && (
            <div className="seller-field">
              <label className="seller-label">
                🔢 {selectedIdType?.label} Number{" "}
                <span style={{ color: "#ef4444" }}>*</span>
              </label>

              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={idNumber}
                  maxLength={selectedIdType?.digits ?? 20}
                  onChange={(e) => {
                    const val = e.target.value
                      .replace(/\s/g, "")
                      .toUpperCase();
                    setIdNumber(val);
                    setIdError("");
                  }}
                  placeholder={`Enter ${selectedIdType?.digits}-digit ${
                    selectedIdType?.label
                  } number`}
                  className={`seller-input ${idError ? "error" : idNumber.length === selectedIdType?.digits ? "success" : ""}`}
                  style={{
                    letterSpacing: "0.1em",
                    fontFamily:    "monospace",
                    fontSize:      "1.1rem",
                    borderColor:   idNumber.length === selectedIdType?.digits
                      ? "#10b981"
                      : idError
                      ? "#ef4444"
                      : undefined,
                  }}
                />

                {/* Status icon */}
                {idNumber.length === selectedIdType?.digits && (
                  <span style={s.idVerifiedIcon}>✓</span>
                )}
              </div>

              {/* Digit progress */}
              <div style={s.digitRow}>
                {[...Array(selectedIdType?.digits ?? 0)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...s.digitDot,
                      background:
                        i < idNumber.length ? "#6366f1" : "#e5e7eb",
                    }}
                  />
                ))}
                <span style={s.digitLabel}>
                  {idNumber.length}/{selectedIdType?.digits}
                </span>
              </div>

              {/* ID number error */}
              {idError && (
                <span className="field-error">⚠️ {idError}</span>
              )}

              {/* Success message */}
              {idNumber.length === selectedIdType?.digits && !idError && (
                <span style={s.idSuccess}>
                  ✅ {selectedIdType?.label} number entered
                </span>
              )}

              {/* NIN hint */}
              {idType === "nin" && (
                <div style={s.idHint}>
                  💡 Find your NIN by dialing <strong>*346#</strong> on
                  your registered phone number
                </div>
              )}

              {/* BVN hint */}
              {idType === "bvn" && (
                <div style={s.idHint}>
                  💡 Find your BVN by dialing <strong>*565*0#</strong> on
                  your registered phone number
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            DOCUMENT UPLOADS
        ══════════════════════════════════════════════════ */}
        <div style={s.docsSection}>
          <h3 style={s.sectionTitle}>📸 Document Photos</h3>
          <p style={s.sectionSubtitle}>
            Upload clear photos of your ID — both front and back
          </p>

          {/* ID front + back side by side */}
          <div style={s.idPairGrid}>
            {DOCS.filter((d) =>
              d.name === "id_card" || d.name === "id_card_back"
            ).map((doc) => (
              <DocUploadField
                key={doc.name}
                doc={doc}
                file={verifyData[doc.name]}
                error={errors[doc.name]}
                onChange={handleVerifyChange}
              />
            ))}
          </div>

          {/* Selfie + optional docs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            {DOCS.filter((d) =>
              d.name !== "id_card" && d.name !== "id_card_back"
            ).map((doc) => (
              <DocUploadField
                key={doc.name}
                doc={doc}
                file={verifyData[doc.name]}
                error={errors[doc.name]}
                onChange={handleVerifyChange}
              />
            ))}
          </div>
        </div>

        {/* ── Tips ─────────────────────────────────────────── */}
        <div style={s.tipsBox}>
          <p style={s.tipsTitle}>📸 Photo Tips</p>
          <div style={s.tipsList}>
            {[
              "Place ID on a flat, well-lit surface",
              "All corners of the ID must be visible",
              "No glare or reflections on the ID",
              "Text must be clearly readable",
              "Front and back photos are both required",
            ].map((tip, i) => (
              <div key={i} style={s.tipRow}>
                <span style={{ color: "#10b981", flexShrink: 0 }}>✓</span>
                <span style={s.tipText}>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Server message ───────────────────────────────── */}
        {serverMsg && (
          <div
            className={`seller-alert ${
              serverMsg.toLowerCase().includes("fail") ||
              serverMsg.toLowerCase().includes("error")
                ? "error" : "success"
            }`}
          >
            {serverMsg}
          </div>
        )}

        {/* ── Buttons ──────────────────────────────────────── */}
        <div style={s.btnRow}>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="btn-seller-secondary"
            style={{ flex: 1 }}
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="btn-seller-primary"
            style={{ flex: 2 }}
          >
            {loading
              ? <><Spinner /> Uploading...</>
              : "Submit for Review →"}
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
        <span style={{ color: "#9ca3af", fontSize: "0.75rem", fontWeight: 400 }}>
          {" "}(optional)
        </span>
      )}
      {/* Front/Back badge */}
      {doc.side && (
        <span style={{
          marginLeft:    "0.5rem",
          background:    doc.side === "front" ? "#eef2ff" : "#f0fdf4",
          color:         doc.side === "front" ? "#6366f1" : "#16a34a",
          fontSize:      "0.68rem",
          fontWeight:    700,
          padding:       "0.1rem 0.5rem",
          borderRadius:  "100px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          {doc.side}
        </span>
      )}
    </label>

    <div
      className={`upload-box ${error ? "error" : file ? "uploaded" : ""}`}
      style={{
        borderColor: file
          ? "#10b981"
          : error
          ? "#ef4444"
          : "#c7d2fe",
        background: file
          ? "#f0fdf4"
          : "#f8f7ff",
      }}
    >
      <input
        type="file"
        name={doc.name}
        accept="image/*,application/pdf"
        onChange={onChange}
      />
      {file ? (
        <div style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          gap:            "0.5rem",
        }}>
          {/* Image preview if it's an image */}
          {file.type?.startsWith("image/") ? (
            <img
              src={URL.createObjectURL(file)}
              alt={doc.label}
              style={{
                width:        "100%",
                maxHeight:    "140px",
                objectFit:    "cover",
                borderRadius: "8px",
                border:       "1px solid #a7f3d0",
              }}
            />
          ) : (
            <div style={{ fontSize: "2.5rem" }}>📄</div>
          )}
          <p style={{ color: "#10b981", fontWeight: 600, fontSize: "0.85rem" }}>
            ✅ {file.name}
          </p>
          <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
            Tap to replace
          </p>
        </div>
      ) : (
        <>
          <div className="upload-icon">{doc.icon}</div>
          <p className="upload-text">Tap to upload</p>
          <p className="upload-sub">{doc.hint}</p>
          <p style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.25rem" }}>
            JPG, PNG or PDF
          </p>
        </>
      )}
    </div>

    {error && <span className="field-error">⚠️ {error}</span>}
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────
const Spinner = () => (
  <span style={{
    width:        "16px",
    height:       "16px",
    border:       "2px solid rgba(255,255,255,0.3)",
    borderTop:    "2px solid white",
    borderRadius: "50%",
    display:      "inline-block",
    animation:    "spin 0.7s linear infinite",
    marginRight:  "0.4rem",
  }} />
);

// ─── Styles ───────────────────────────────────────────────────
const s = {
  header:   { marginBottom: "1.5rem" },
  title:    { fontSize: "1.5rem", fontWeight: 800, color: "#1f2937", margin: 0 },
  subtitle: { color: "#6b7280", marginTop: "0.35rem", lineHeight: 1.6 },

  securityBadge: {
    background:   "#ecfdf5",
    border:       "1px solid #a7f3d0",
    borderRadius: "12px",
    padding:      "0.875rem 1.25rem",
    display:      "flex",
    alignItems:   "center",
    gap:          "0.75rem",
    marginBottom: "1.5rem",
  },
  securityText: {
    color:      "#065f46",
    fontSize:   "0.875rem",
    fontWeight: 500,
    margin:     0,
  },

  form: { display: "flex", flexDirection: "column", gap: "1.5rem" },

  // ID Section
  idSection: {
    background:    "#f8fafc",
    borderRadius:  "16px",
    padding:       "1.5rem",
    border:        "1px solid #e5e7eb",
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  sectionTitle:   { fontSize: "1rem", fontWeight: 700, color: "#1f2937", margin: 0 },
  sectionSubtitle:{ color: "#9ca3af", fontSize: "0.85rem", margin: "0.25rem 0 0" },

  idTypeGrid: {
    display:               "grid",
    gridTemplateColumns:   "repeat(auto-fill, minmax(180px, 1fr))",
    gap:                   "0.5rem",
    marginTop:             "0.5rem",
  },
  idTypeBtn: {
    padding:       "0.65rem 0.875rem",
    border:        "2px solid",
    borderRadius:  "10px",
    cursor:        "pointer",
    fontSize:      "0.8rem",
    textAlign:     "left",
    transition:    "all 0.15s ease",
    display:       "flex",
    justifyContent:"space-between",
    alignItems:    "center",
  },
  idTypeCheck: {
    color:      "#6366f1",
    fontWeight: 700,
    fontSize:   "0.9rem",
  },

  // ID input
  idVerifiedIcon: {
    position:  "absolute",
    right:     "1rem",
    top:       "50%",
    transform: "translateY(-50%)",
    color:     "#10b981",
    fontSize:  "1.2rem",
    fontWeight:700,
  },
  digitRow: {
    display:    "flex",
    gap:        "3px",
    marginTop:  "0.5rem",
    alignItems: "center",
  },
  digitDot: {
    height:       "4px",
    borderRadius: "100px",
    transition:   "background 0.2s",
    flex:         1,
  },
  digitLabel: {
    fontSize:   "0.72rem",
    color:      "#9ca3af",
    marginLeft: "0.5rem",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  idSuccess: {
    color:      "#10b981",
    fontSize:   "0.8rem",
    fontWeight: 600,
    marginTop:  "0.25rem",
  },
  idHint: {
    background:   "#fffbeb",
    border:       "1px solid #fde68a",
    borderRadius: "8px",
    padding:      "0.5rem 0.75rem",
    color:        "#92400e",
    fontSize:     "0.8rem",
    marginTop:    "0.5rem",
  },

  // Docs section
  docsSection: {
    display:       "flex",
    flexDirection: "column",
    gap:           "0.75rem",
  },
  idPairGrid: {
    display:               "grid",
    gridTemplateColumns:   "1fr 1fr",
    gap:                   "1rem",
  },

  // Tips
  tipsBox: {
    background:   "#f0fdf4",
    border:       "1px solid #bbf7d0",
    borderRadius: "12px",
    padding:      "1rem 1.25rem",
  },
  tipsTitle: {
    fontWeight:   700,
    color:        "#166534",
    fontSize:     "0.875rem",
    margin:       "0 0 0.75rem",
  },
  tipsList:  { display: "flex", flexDirection: "column", gap: "0.4rem" },
  tipRow:    { display: "flex", gap: "0.5rem", alignItems: "flex-start" },
  tipText:   { color: "#166534", fontSize: "0.82rem", lineHeight: 1.4 },

  // Buttons
  btnRow: { display: "flex", gap: "1rem" },
};

export default VerificationStep;