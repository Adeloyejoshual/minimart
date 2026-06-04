// components/seller/VerificationStep.jsx
import React, { useState, useCallback, useMemo, useEffect } from "react";

// ─── ID Types — BVN removed ───────────────────────────────────
const ID_TYPES = [
  {
    value:   "nin",
    label:   "NIN",
    full:    "National Identity Number",
    digits:  11,
    numeric: true,
    hint:    "Dial *346# to get your NIN",
  },
  {
    value:   "passport",
    label:   "Passport",
    full:    "International Passport",
    digits:  9,
    numeric: false,               // alphanumeric e.g. A12345678
    pattern: /^[A-Z0-9]{9}$/,
    hint:    "9 characters — letter + 8 digits e.g. A12345678",
  },
  {
    value:   "drivers",
    label:   "Driver's Licence",
    full:    "Driver's Licence",
    digits:  12,
    numeric: true,
    hint:    "12-digit licence number",
  },
  {
    value:   "voters",
    label:   "Voter's Card",
    full:    "Permanent Voter's Card",
    digits:  19,
    numeric: true,
    hint:    "19-digit VIN number",
  },
];

// ─── Doc Config ───────────────────────────────────────────────
const DOCS = [
  {
    name:     "id_card",
    label:    "ID / Passport — Front",
    icon:     "🪪",
    required: true,
    hint:     "Clear photo of FRONT side",
    side:     "front",
  },
  {
    name:     "id_card_back",
    label:    "ID / Passport — Back",
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
    label:    "Business Registration (CAC)",
    icon:     "📄",
    required: false,
    hint:     "Optional — CAC certificate",
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

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// ═════════════════════════════════════════════════════════════
export default function VerificationStep({ flow }) {
  const {
    verifyData,
    errors,
    loading,
    serverMsg,
    handleVerifyChange,
    submitVerification,
    setStep,
  } = flow;

  // ── Local ID state ────────────────────────────────────────
  const [idType,   setIdType]   = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idError,  setIdError]  = useState("");

  // ── Address state ─────────────────────────────────────────
  const [address, setAddress] = useState({
    street:  "",
    city:    "",
    state:   "",
    country: "Nigeria",
  });
  const [addressErrors, setAddressErrors] = useState({});

  const selectedType = ID_TYPES.find((t) => t.value === idType);

  // ── File validation ───────────────────────────────────────
  const validateFile = useCallback((file, fieldName) => {
    if (!file) return true;
    if (file.size > MAX_FILE_SIZE) {
      alert(`${fieldName} must be under 2MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      return false;
    }
    return true;
  }, []);

  // ── Handle file change with size check ────────────────────
  const handleFileChange = useCallback((e) => {
    const { name, files } = e.target;
    const file = files?.[0];
    if (!file) return;
    if (!validateFile(file, name.replace(/_/g, " "))) {
      e.target.value = "";
      return;
    }
    handleVerifyChange(e);
  }, [validateFile, handleVerifyChange]);

  // ── Validate ID number ────────────────────────────────────
  const validateIdNumber = useCallback(() => {
    if (!idType) {
      setIdError("Please select an ID type");
      return false;
    }

    const cleaned = idNumber.replace(/\s/g, "").toUpperCase();

    if (!cleaned) {
      setIdError("ID number is required");
      return false;
    }

    if (idType === "passport") {
      // Alphanumeric — e.g. A12345678
      if (!/^[A-Z0-9]{9}$/.test(cleaned)) {
        setIdError("Passport must be 9 characters (e.g. A12345678)");
        return false;
      }
    } else {
      // Numeric only
      const digits = cleaned.replace(/\D/g, "");
      if (digits.length !== selectedType?.digits) {
        setIdError(
          `${selectedType?.full} must be ${selectedType?.digits} digits`
        );
        return false;
      }
    }

    setIdError("");
    return true;
  }, [idType, idNumber, selectedType]);

  // ── Validate address ──────────────────────────────────────
  const validateAddress = useCallback(() => {
    const errs = {};
    if (!address.street.trim())
      errs.street = "Street address is required";
    if (!address.city.trim())
      errs.city   = "City is required";
    if (!address.state.trim())
      errs.state  = "State is required";
    setAddressErrors(errs);
    return Object.keys(errs).length === 0;
  }, [address]);

  // ── Handle submit ─────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const idOk      = validateIdNumber();
    const addressOk = validateAddress();
    if (!idOk || !addressOk) return;

    // Push id fields into verifyData via synthetic events
    handleVerifyChange({
      target: { name: "id_type",   value: idType,                              files: null },
    });
    handleVerifyChange({
      target: { name: "id_number", value: idNumber.replace(/\s/g, "").toUpperCase(), files: null },
    });
    handleVerifyChange({
      target: {
        name:  "address",
        value: `${address.street.trim()}, ${address.city.trim()}, ${address.state.trim()}, ${address.country}`,
        files: null,
      },
    });

    submitVerification();
  }, [
    validateIdNumber, validateAddress,
    handleVerifyChange, submitVerification,
    idType, idNumber, address,
  ]);

  // ── Nigerian states ───────────────────────────────────────
  const NG_STATES = [
    "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa",
    "Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti",
    "Enugu","FCT - Abuja","Gombe","Imo","Jigawa","Kaduna","Kano",
    "Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger",
    "Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto",
    "Taraba","Yobe","Zamfara",
  ];

  const idProgress = useMemo(() => {
    if (!selectedType) return 0;
    if (idType === "passport") {
      return Math.min(idNumber.replace(/\s/g, "").length, 9);
    }
    return Math.min(idNumber.replace(/\D/g, "").length, selectedType.digits);
  }, [idNumber, idType, selectedType]);

  const idComplete = useMemo(() => {
    if (!selectedType || !idNumber) return false;
    const cleaned = idNumber.replace(/\s/g, "").toUpperCase();
    if (idType === "passport") return /^[A-Z0-9]{9}$/.test(cleaned);
    return cleaned.replace(/\D/g, "").length === selectedType.digits;
  }, [idNumber, idType, selectedType]);

  return (
    <div className="seller-card">

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={s.header}>
        <h2 style={s.title}>🔍 Identity Verification</h2>
        <p style={s.subtitle}>
          Verify your identity to activate your seller account.
          All data is encrypted and secure.
        </p>
      </div>

      {/* ── Security badge ───────────────────────────────────── */}
      <div style={s.securityBadge}>
        <span style={{ fontSize: "1.4rem" }}>🔒</span>
        <p style={s.securityText}>
          AES-256 encrypted · Only reviewed by verified staff ·
          Never shared with third parties
        </p>
      </div>

      <div style={s.form}>

        {/* ══════════════════════════════════════════════════
            1. ID INFORMATION
        ══════════════════════════════════════════════════ */}
        <Section title="📋 ID Information" subtitle="Select your government-issued ID">

          {/* ID Type */}
          <div className="seller-field">
            <label className="seller-label">
              ID Type <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={s.idTypeGrid}>
              {ID_TYPES.map((type) => {
                const selected = idType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    style={{
                      ...s.idTypeBtn,
                      background:  selected ? "#eef2ff" : "white",
                      borderColor: selected ? "#6366f1" : "#e5e7eb",
                      color:       selected ? "#6366f1" : "#374151",
                      fontWeight:  selected ? 700 : 400,
                    }}
                    onClick={() => {
                      setIdType(type.value);
                      setIdNumber("");
                      setIdError("");
                    }}
                  >
                    <span>{type.label}</span>
                    {selected && <span style={{ color: "#6366f1" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ID Number */}
          {idType && (
            <div className="seller-field">
              <label className="seller-label">
                {selectedType?.full} Number{" "}
                <span style={{ color: "#ef4444" }}>*</span>
              </label>

              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode={selectedType?.numeric ? "numeric" : "text"}
                  value={idNumber}
                  maxLength={(selectedType?.digits ?? 11) + 3}
                  onChange={(e) => {
                    let val = e.target.value.toUpperCase();
                    if (selectedType?.numeric) {
                      val = val.replace(/\D/g, "");
                    }
                    setIdNumber(val);
                    setIdError("");
                  }}
                  placeholder={
                    idType === "passport"
                      ? "e.g. A12345678"
                      : `Enter ${selectedType?.digits}-digit number`
                  }
                  className={`seller-input ${
                    idError      ? "error"   :
                    idComplete   ? "success" : ""
                  }`}
                  style={{
                    letterSpacing: "0.08em",
                    fontFamily:    "monospace",
                    fontSize:      "1rem",
                    paddingRight:  "3rem",
                    borderColor:   idComplete
                      ? "#10b981"
                      : idError
                      ? "#ef4444"
                      : undefined,
                  }}
                />
                {idComplete && (
                  <span style={s.inputCheck}>✓</span>
                )}
              </div>

              {/* Progress bar */}
              <div style={s.digitRow}>
                {[...Array(selectedType?.digits ?? 0)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      ...s.digitDot,
                      background:
                        i < idProgress
                          ? idComplete ? "#10b981" : "#6366f1"
                          : "#e5e7eb",
                    }}
                  />
                ))}
                <span style={s.digitLabel}>
                  {idProgress}/{selectedType?.digits}
                </span>
              </div>

              {/* Error */}
              {idError && (
                <span className="field-error">⚠️ {idError}</span>
              )}

              {/* Success */}
              {idComplete && !idError && (
                <span style={s.fieldSuccess}>
                  ✅ {selectedType?.full} number confirmed
                </span>
              )}

              {/* Hint */}
              {selectedType?.hint && !idError && (
                <div style={s.idHintBox}>
                  💡 {selectedType.hint}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ══════════════════════════════════════════════════
            2. HOME ADDRESS
        ══════════════════════════════════════════════════ */}
        <Section title="📍 Home Address" subtitle="Enter your current residential address">

          {/* Street */}
          <div className="seller-field">
            <label className="seller-label">
              Street Address <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              value={address.street}
              onChange={(e) => {
                setAddress((p) => ({ ...p, street: e.target.value }));
                setAddressErrors((p) => ({ ...p, street: "" }));
              }}
              placeholder="e.g. 15 Bode Thomas Street"
              className={`seller-input ${addressErrors.street ? "error" : ""}`}
            />
            {addressErrors.street && (
              <span className="field-error">⚠️ {addressErrors.street}</span>
            )}
          </div>

          {/* City + State side by side */}
          <div style={s.twoCol}>
            <div className="seller-field">
              <label className="seller-label">
                City <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                value={address.city}
                onChange={(e) => {
                  setAddress((p) => ({ ...p, city: e.target.value }));
                  setAddressErrors((p) => ({ ...p, city: "" }));
                }}
                placeholder="e.g. Lagos"
                className={`seller-input ${addressErrors.city ? "error" : ""}`}
              />
              {addressErrors.city && (
                <span className="field-error">⚠️ {addressErrors.city}</span>
              )}
            </div>

            <div className="seller-field">
              <label className="seller-label">
                State <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={address.state}
                onChange={(e) => {
                  setAddress((p) => ({ ...p, state: e.target.value }));
                  setAddressErrors((p) => ({ ...p, state: "" }));
                }}
                className={`seller-input ${addressErrors.state ? "error" : ""}`}
                style={{ cursor: "pointer" }}
              >
                <option value="">Select state</option>
                {NG_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              {addressErrors.state && (
                <span className="field-error">⚠️ {addressErrors.state}</span>
              )}
            </div>
          </div>

          {/* Country — fixed to Nigeria */}
          <div className="seller-field">
            <label className="seller-label">Country</label>
            <input
              type="text"
              value="Nigeria"
              readOnly
              className="seller-input"
              style={{ background: "#f8fafc", color: "#6b7280", cursor: "not-allowed" }}
            />
          </div>

          {/* Address preview */}
          {address.street && address.city && address.state && (
            <div style={s.addressPreview}>
              <span style={{ fontSize: "1.1rem" }}>📍</span>
              <div>
                <p style={s.addressPreviewLabel}>Your Address</p>
                <p style={s.addressPreviewValue}>
                  {address.street}, {address.city},{" "}
                  {address.state}, {address.country}
                </p>
              </div>
            </div>
          )}
        </Section>

        {/* ══════════════════════════════════════════════════
            3. DOCUMENT PHOTOS
        ══════════════════════════════════════════════════ */}
        <Section
          title="📸 Document Photos"
          subtitle="Upload clear photos — both front and back required"
        >
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
                onChange={handleFileChange}
              />
            ))}
          </div>

          {/* Selfie + optional docs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {DOCS.filter((d) =>
              d.name !== "id_card" && d.name !== "id_card_back"
            ).map((doc) => (
              <DocUploadField
                key={doc.name}
                doc={doc}
                file={verifyData[doc.name]}
                error={errors[doc.name]}
                onChange={handleFileChange}
              />
            ))}
          </div>
        </Section>

        {/* ── Photo tips ───────────────────────────────────── */}
        <div style={s.tipsBox}>
          <p style={s.tipsTitle}>📸 Photo Tips for Faster Approval</p>
          <div style={s.tipsList}>
            {[
              "Place ID on a flat, well-lit surface",
              "All four corners must be clearly visible",
              "No glare, reflections or blur",
              "Text must be readable",
              "Photo must not be cropped or edited",
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
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, subtitle, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHead}>
        <h3 style={s.sectionTitle}>{title}</h3>
        {subtitle && <p style={s.sectionSubtitle}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {children}
      </div>
    </div>
  );
}

// ── Doc Upload Field — with preview + memory leak fix ─────────
function DocUploadField({ doc, file, error, onChange }) {
  // ✅ Fix memory leak — revoke URL on unmount / file change
  const previewUrl = useMemo(() => {
    if (file && file.type?.startsWith("image/")) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
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
        {doc.side && (
          <span style={{
            ...s.sideBadge,
            background: doc.side === "front" ? "#eef2ff" : "#f0fdf4",
            color:      doc.side === "front" ? "#6366f1" : "#16a34a",
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
          background: file ? "#f0fdf4" : "#f8f7ff",
        }}
      >
        <input
          type="file"
          name={doc.name}
          accept="image/*,application/pdf"
          onChange={onChange}
        />

        {file ? (
          <div style={s.filePreview}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={doc.label}
                style={s.previewImg}
              />
            ) : (
              <div style={{ fontSize: "2rem" }}>📄</div>
            )}
            <p style={s.fileName}>✅ {file.name}</p>
            <p style={s.fileSize}>
              {(file.size / 1024).toFixed(0)}KB · Tap to replace
            </p>
          </div>
        ) : (
          <>
            <div className="upload-icon">{doc.icon}</div>
            <p className="upload-text">Tap to upload</p>
            <p className="upload-sub">{doc.hint}</p>
            <p style={{ color: "#9ca3af", fontSize: "0.72rem", marginTop: "0.2rem" }}>
              JPG, PNG or PDF · Max 2MB
            </p>
          </>
        )}
      </div>

      {error && <span className="field-error">⚠️ {error}</span>}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
function Spinner() {
  return (
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
}

// ─── Styles ───────────────────────────────────────────────────
const s = {
  header:   { marginBottom: "1.25rem" },
  title:    { fontSize: "1.5rem", fontWeight: 800, color: "#1f2937", margin: 0 },
  subtitle: { color: "#6b7280", marginTop: "0.35rem", lineHeight: 1.6 },

  securityBadge: {
    background:   "#ecfdf5",
    border:       "1px solid #a7f3d0",
    borderRadius: "12px",
    padding:      "0.75rem 1.25rem",
    display:      "flex",
    alignItems:   "center",
    gap:          "0.75rem",
    marginBottom: "1.25rem",
  },
  securityText: {
    color:      "#065f46",
    fontSize:   "0.82rem",
    fontWeight: 500,
    margin:     0,
  },

  form: { display: "flex", flexDirection: "column", gap: "1.25rem" },

  // Section
  section: {
    background:    "#f8fafc",
    borderRadius:  "16px",
    padding:       "1.25rem 1.5rem",
    border:        "1px solid #e5e7eb",
    display:       "flex",
    flexDirection: "column",
    gap:           "1rem",
  },
  sectionHead:    { marginBottom: "0.25rem" },
  sectionTitle:   { fontSize: "1rem", fontWeight: 700, color: "#1f2937", margin: 0 },
  sectionSubtitle:{ color: "#9ca3af", fontSize: "0.82rem", margin: "0.2rem 0 0" },

  // ID type
  idTypeGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap:                 "0.5rem",
    marginTop:           "0.5rem",
  },
  idTypeBtn: {
    padding:        "0.65rem 0.875rem",
    border:         "2px solid",
    borderRadius:   "10px",
    cursor:         "pointer",
    fontSize:       "0.85rem",
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    transition:     "all 0.15s ease",
    gap:            "0.5rem",
  },

  // ID input
  inputCheck: {
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
  fieldSuccess: {
    color:      "#10b981",
    fontSize:   "0.8rem",
    fontWeight: 600,
    marginTop:  "0.25rem",
    display:    "block",
  },
  idHintBox: {
    background:   "#fffbeb",
    border:       "1px solid #fde68a",
    borderRadius: "8px",
    padding:      "0.5rem 0.75rem",
    color:        "#92400e",
    fontSize:     "0.8rem",
    marginTop:    "0.5rem",
  },

  // Address
  twoCol: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "1rem",
  },
  addressPreview: {
    display:      "flex",
    alignItems:   "flex-start",
    gap:          "0.75rem",
    background:   "#ecfdf5",
    border:       "1px solid #a7f3d0",
    borderRadius: "10px",
    padding:      "0.875rem 1rem",
    marginTop:    "0.25rem",
  },
  addressPreviewLabel: {
    color:      "#065f46",
    fontSize:   "0.72rem",
    fontWeight: 700,
    margin:     0,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  addressPreviewValue: {
    color:      "#064e3b",
    fontSize:   "0.875rem",
    fontWeight: 600,
    margin:     "0.2rem 0 0",
    lineHeight: 1.5,
  },

  // Docs
  idPairGrid: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "1rem",
  },
  sideBadge: {
    marginLeft:    "0.5rem",
    fontSize:      "0.68rem",
    fontWeight:    700,
    padding:       "0.1rem 0.5rem",
    borderRadius:  "100px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  // File preview
  filePreview: {
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           "0.4rem",
    width:         "100%",
  },
  previewImg: {
    width:        "100%",
    maxHeight:    "140px",
    objectFit:    "cover",
    borderRadius: "8px",
    border:       "1px solid #a7f3d0",
  },
  fileName: { color: "#10b981", fontWeight: 600, fontSize: "0.82rem", margin: 0 },
  fileSize: { color: "#9ca3af", fontSize: "0.72rem", margin: 0 },

  // Tips
  tipsBox: {
    background:   "#f0fdf4",
    border:       "1px solid #bbf7d0",
    borderRadius: "12px",
    padding:      "1rem 1.25rem",
  },
  tipsTitle: { fontWeight: 700, color: "#166534", fontSize: "0.875rem", margin: "0 0 0.75rem" },
  tipsList:  { display: "flex", flexDirection: "column", gap: "0.4rem" },
  tipRow:    { display: "flex", gap: "0.5rem", alignItems: "flex-start" },
  tipText:   { color: "#166534", fontSize: "0.8rem", lineHeight: 1.4 },

  // Buttons
  btnRow: { display: "flex", gap: "1rem" },
};