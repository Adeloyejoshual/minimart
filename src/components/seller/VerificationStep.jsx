// components/seller/VerificationStep.jsx
import React, {
  useState, useCallback, useMemo, useEffect,
} from "react";
import { locationsByState } from "../../config/locationsByState";
import { SELLER_TOKEN_KEY } from "../../hooks/useSellerFlow";

const getToken = () => localStorage.getItem(SELLER_TOKEN_KEY);

// ─────────────────────────────────────────────────────────────
// NIN ONLY — single ID type
// ─────────────────────────────────────────────────────────────
const NIN_CONFIG = {
  value:   "nin",
  label:   "National Identity Number (NIN)",
  digits:  11,
  numeric: true,
  hint:    "Dial *346# on your registered phone to retrieve your NIN",
};

// ─────────────────────────────────────────────────────────────
// DOCUMENT UPLOADS
// ─────────────────────────────────────────────────────────────
const DOCS = [
  {
    name:     "id_card",
    label:    "NIN Slip / ID Card — Front",
    icon:     "🪪",
    required: true,
    hint:     "Clear photo of the FRONT of your NIN slip or ID card",
    side:     "front",
  },
  {
    name:     "id_card_back",
    label:    "NIN Slip / ID Card — Back",
    icon:     "🪪",
    required: true,
    hint:     "Clear photo of the BACK of your NIN slip or ID card",
    side:     "back",
  },
  {
    name:     "selfie",
    label:    "Selfie Holding NIN Slip",
    icon:     "🤳",
    required: true,
    hint:     "Hold your NIN slip next to your face — both clearly visible",
    side:     null,
  },
  {
    name:     "business_doc",
    label:    "Business Registration (CAC)",
    icon:     "📄",
    required: false,
    hint:     "Optional — CAC certificate or business registration document",
    side:     null,
  },
  {
    name:     "address_proof",
    label:    "Proof of Address",
    icon:     "📍",
    required: false,
    hint:     "Optional — utility bill or bank statement (not older than 3 months)",
    side:     null,
  },
];

const REQUIRED_DOCS  = ["id_card", "id_card_back", "selfie"];
const MAX_FILE_SIZE  = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES  = [
  "image/jpeg", "image/png", "image/webp", "application/pdf",
];

const STATE_LIST = Object.keys(locationsByState).sort((a, b) =>
  a.localeCompare(b)
);

// ═════════════════════════════════════════════════════════════
export default function VerificationStep({ flow }) {
  const {
    verifyData,
    errors,
    loading,
    serverMsg,
    serverErr,
    handleVerifyChange,
    submitVerification,
    setStep,
  } = flow;

  // NIN is fixed — no selection needed
  const [ninNumber,    setNinNumber]    = useState("");
  const [ninError,     setNinError]     = useState("");

  const [address, setAddress] = useState({
    street:  "",
    state:   "",
    city:    "",
  });
  const [addressErrors, setAddressErrors] = useState({});

  const availableLgas = address.state
    ? (locationsByState[address.state] ?? []).sort((a, b) =>
        a.localeCompare(b)
      )
    : [];

  // ── NIN progress / completion ───────────────────────────
  const ninProgress = Math.min(
    ninNumber.replace(/\D/g, "").length,
    NIN_CONFIG.digits
  );
  const ninComplete = ninNumber.replace(/\D/g, "").length
    === NIN_CONFIG.digits;

  // ── File validation ──────────────────────────────────────
  const validateFile = useCallback((file, fieldName) => {
    if (!file) return true;
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert(
        `${fieldName}: Only JPG, PNG, WEBP or PDF files are allowed.\n`
        + `You selected: ${file.type || "unknown type"}`
      );
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert(
        `${fieldName} must be under 2MB.\n`
        + `Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`
      );
      return false;
    }
    return true;
  }, []);

  const handleFileChange = useCallback((e) => {
    const { name, files } = e.target;
    const file = files?.[0];
    if (!file) return;
    const label = DOCS.find((d) => d.name === name)?.label ?? name;
    if (!validateFile(file, label)) {
      e.target.value = "";
      return;
    }
    handleVerifyChange(e);
  }, [validateFile, handleVerifyChange]);

  // ── NIN validation ───────────────────────────────────────
  const validateNin = useCallback(() => {
    const digits = ninNumber.replace(/\D/g, "");
    if (!digits) {
      setNinError("NIN is required");
      return false;
    }
    if (digits.length !== 11) {
      setNinError("NIN must be exactly 11 digits");
      return false;
    }
    setNinError("");
    return true;
  }, [ninNumber]);

  // ── Address validation ───────────────────────────────────
  const validateAddress = useCallback(() => {
    const errs = {};
    if (!address.street.trim()) errs.street = "Street address is required";
    if (!address.state.trim())  errs.state  = "State is required";
    if (!address.city.trim())   errs.city   = "LGA / City is required";
    setAddressErrors(errs);
    return Object.keys(errs).length === 0;
  }, [address]);

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    // 1. NIN
    if (!validateNin()) return;

    // 2. Address
    if (!validateAddress()) return;

    // 3. Required documents
    const missing = REQUIRED_DOCS.filter((f) => !verifyData[f]);
    if (missing.length > 0) {
      const labels = missing
        .map((f) => DOCS.find((d) => d.name === f)?.label ?? f)
        .join("\n• ");
      alert(`Please upload the following required documents:\n\n• ${labels}`);
      return;
    }

    // 4. Push values into flow state then submit
    const fullAddress =
      `${address.street.trim()}, ${address.city.trim()}, `
      + `${address.state.trim()}, Nigeria`;

    handleVerifyChange({
      target: { name: "id_type",   value: "nin",                              files: null },
    });
    handleVerifyChange({
      target: { name: "id_number", value: ninNumber.replace(/\D/g, ""),       files: null },
    });
    handleVerifyChange({
      target: { name: "address",   value: fullAddress,                        files: null },
    });

    submitVerification();
  }, [
    validateNin, validateAddress, verifyData,
    handleVerifyChange, submitVerification,
    ninNumber, address,
  ]);

  return (
    <div className="seller-card">

      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>🔍 Identity Verification</h2>
        <p style={s.subtitle}>
          Verify your identity using your NIN to activate your
          seller account. All data is encrypted and secure.
        </p>
      </div>

      {/* Security badge */}
      <div style={s.securityBadge}>
        <span style={{ fontSize: "1.3rem" }}>🔒</span>
        <p style={s.securityText}>
          AES-256 encrypted · Reviewed only by verified staff ·
          Never shared with third parties
        </p>
      </div>

      <div style={s.form}>

        {/* ══════════════════════════════════════════════════
            SECTION 1 — NIN
        ══════════════════════════════════════════════════ */}
        <Section
          title="📋 National Identity Number (NIN)"
          subtitle="Enter your 11-digit NIN exactly as it appears on your slip"
        >
          {/* NIN info banner */}
          <div style={s.ninBanner}>
            <div style={s.ninBannerIcon}>🪪</div>
            <div>
              <p style={s.ninBannerTitle}>
                Why we need your NIN
              </p>
              <p style={s.ninBannerText}>
                Your NIN is used to verify your identity with NIMC.
                It is encrypted and never shared with buyers or
                third parties.
              </p>
            </div>
          </div>

          {/* NIN input */}
          <div className="seller-field">
            <label className="seller-label">
              NIN (11 digits)
              <span style={{ color: "#ef4444" }}> *</span>
            </label>

            <div style={{ position: "relative" }}>
              <input
                type="text"
                inputMode="numeric"
                value={ninNumber}
                maxLength={11}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                  setNinNumber(val);
                  setNinError("");
                }}
                placeholder="e.g. 12345678901"
                className={`seller-input ${
                  ninError    ? "error"   :
                  ninComplete ? "success" : ""
                }`}
                style={{
                  letterSpacing: "0.12em",
                  fontFamily:    "monospace",
                  fontSize:      "1.2rem",
                  paddingRight:  "3rem",
                  borderColor:   ninComplete
                    ? "#10b981"
                    : ninError
                      ? "#ef4444"
                      : undefined,
                }}
              />
              {ninComplete && !ninError && (
                <span style={s.inputCheck}>✓</span>
              )}
            </div>

            {/* 11-dot progress */}
            <div style={s.digitRow}>
              {[...Array(11)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...s.digitDot,
                    background:
                      i < ninProgress
                        ? ninComplete ? "#10b981" : "#6366f1"
                        : "#e5e7eb",
                  }}
                />
              ))}
              <span style={s.digitLabel}>
                {ninProgress}/11
              </span>
            </div>

            {ninError && (
              <span className="field-error">⚠️ {ninError}</span>
            )}

            {ninComplete && !ninError && (
              <span style={s.fieldSuccess}>
                ✅ NIN entered — {NIN_CONFIG.digits} digits confirmed
              </span>
            )}

            {/* How to find NIN */}
            <div style={s.ninHintBox}>
              <p style={s.ninHintTitle}>💡 How to find your NIN</p>
              <div style={s.ninHintList}>
                {[
                  "Dial *346# on your registered phone",
                  "Check your NIN slip from any NIMC office",
                  "Check the NIN Mobile App",
                  "It's printed on your National ID card",
                ].map((tip, i) => (
                  <div key={i} style={s.ninHintRow}>
                    <span style={{ color: "#6366f1", flexShrink: 0 }}>
                      {i + 1}.
                    </span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════
            SECTION 2 — HOME ADDRESS
        ══════════════════════════════════════════════════ */}
        <Section
          title="📍 Home Address"
          subtitle="Your current residential address in Nigeria"
        >
          {/* Street */}
          <div className="seller-field">
            <label className="seller-label">
              Street Address
              <span style={{ color: "#ef4444" }}> *</span>
            </label>
            <input
              type="text"
              value={address.street}
              onChange={(e) => {
                setAddress((p) => ({ ...p, street: e.target.value }));
                setAddressErrors((p) => ({ ...p, street: "" }));
              }}
              placeholder="e.g. 15 Bode Thomas Street, Surulere"
              className={`seller-input ${
                addressErrors.street ? "error" : ""
              }`}
            />
            {addressErrors.street && (
              <span className="field-error">
                ⚠️ {addressErrors.street}
              </span>
            )}
          </div>

          {/* State + LGA */}
          <div className="verification-grid">
            <div className="seller-field">
              <label className="seller-label">
                State <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={address.state}
                onChange={(e) => {
                  setAddress((p) => ({
                    ...p, state: e.target.value, city: "",
                  }));
                  setAddressErrors((p) => ({
                    ...p, state: "", city: "",
                  }));
                }}
                className={`seller-input ${
                  addressErrors.state ? "error" : ""
                }`}
                style={{ cursor: "pointer" }}
              >
                <option value="">Select state</option>
                {STATE_LIST.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              {addressErrors.state && (
                <span className="field-error">
                  ⚠️ {addressErrors.state}
                </span>
              )}
            </div>

            <div className="seller-field">
              <label className="seller-label">
                LGA / City <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={address.city}
                disabled={!address.state}
                onChange={(e) => {
                  setAddress((p) => ({ ...p, city: e.target.value }));
                  setAddressErrors((p) => ({ ...p, city: "" }));
                }}
                className={`seller-input ${
                  addressErrors.city ? "error" : ""
                }`}
                style={{
                  cursor:  address.state ? "pointer" : "not-allowed",
                  opacity: address.state ? 1 : 0.5,
                }}
              >
                <option value="">
                  {address.state ? "Select LGA" : "Select state first"}
                </option>
                {availableLgas.map((lga) => (
                  <option key={lga} value={lga}>{lga}</option>
                ))}
              </select>
              {addressErrors.city && (
                <span className="field-error">
                  ⚠️ {addressErrors.city}
                </span>
              )}
            </div>
          </div>

          {/* Country — read only */}
          <div className="seller-field">
            <label className="seller-label">Country</label>
            <input
              type="text"
              value="Nigeria"
              readOnly
              className="seller-input"
              style={{
                background: "#f8fafc",
                color:      "#6b7280",
                cursor:     "not-allowed",
              }}
            />
          </div>

          {/* Address preview */}
          {address.street && address.city && address.state && (
            <div style={s.addressPreview}>
              <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>
                📍
              </span>
              <div>
                <p style={s.addressPreviewLabel}>Your Address</p>
                <p style={s.addressPreviewValue}>
                  {address.street}, {address.city},{" "}
                  {address.state}, Nigeria
                </p>
              </div>
            </div>
          )}
        </Section>

        {/* ══════════════════════════════════════════════════
            SECTION 3 — DOCUMENT PHOTOS
        ══════════════════════════════════════════════════ */}
        <Section
          title="📸 Document Photos"
          subtitle="Upload clear photos of your NIN slip and selfie"
        >
          {/* Front + Back in grid */}
          <div className="verification-grid">
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
          <div style={{
            display:       "flex",
            flexDirection: "column",
            gap:           "1rem",
          }}>
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

          {/* Required docs checklist */}
          <div style={s.docChecklist}>
            <p style={s.docChecklistTitle}>
              Required documents
            </p>
            {REQUIRED_DOCS.map((field) => {
              const doc  = DOCS.find((d) => d.name === field);
              const done = !!verifyData[field];
              return (
                <div key={field} style={s.docCheckRow}>
                  <span style={{
                    color:      done ? "#10b981" : "#d1d5db",
                    fontWeight: 700,
                    fontSize:   "1rem",
                    flexShrink: 0,
                  }}>
                    {done ? "✓" : "○"}
                  </span>
                  <span style={{
                    fontSize:   "0.82rem",
                    color:      done ? "#10b981" : "#6b7280",
                    fontWeight: done ? 600 : 400,
                  }}>
                    {doc?.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Photo tips ───────────────────────────────────── */}
        <div style={s.tipsBox}>
          <p style={s.tipsTitle}>📸 Tips for Faster Approval</p>
          <div style={s.tipsList}>
            {[
              "Place your NIN slip on a flat, well-lit surface",
              "All four corners of the document must be visible",
              "No glare, blur, or reflections on the document",
              "All text must be clearly readable",
              "Both front and back photos are required",
              "In your selfie, hold the NIN slip next to your face",
            ].map((tip, i) => (
              <div key={i} style={s.tipRow}>
                <span style={{ color: "#10b981", flexShrink: 0 }}>✓</span>
                <span style={s.tipText}>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Server messages ──────────────────────────────── */}
        {serverErr && (
          <div className="seller-alert error">⚠️ {serverErr}</div>
        )}
        {serverMsg && !serverErr && (
          <div className="seller-alert success">✅ {serverMsg}</div>
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
              ? <><Spinner /> Uploading…</>
              : "Submit for Review →"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION WRAPPER
// ─────────────────────────────────────────────────────────────
function Section({ title, subtitle, children }) {
  return (
    <div style={s.section}>
      <div>
        <h3 style={s.sectionTitle}>{title}</h3>
        {subtitle && (
          <p style={s.sectionSubtitle}>{subtitle}</p>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column",
        gap: "1rem" }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DOC UPLOAD FIELD
// ─────────────────────────────────────────────────────────────
function DocUploadField({ doc, file, error, onChange }) {
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
          <span style={{
            color:     "#9ca3af",
            fontSize:  "0.72rem",
            fontWeight:400,
          }}>
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
        className={`upload-box ${
          error ? "error" : file ? "uploaded" : ""
        }`}
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
          accept="image/jpeg,image/png,image/webp,application/pdf"
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
            <p style={{
              color:    "#9ca3af",
              fontSize: "0.72rem",
              margin:   0,
            }}>
              JPG, PNG, WEBP or PDF · Max 2MB
            </p>
          </>
        )}
      </div>

      {error && (
        <span className="field-error">⚠️ {error}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────
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
      verticalAlign:"middle",
    }} />
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const s = {
  header:   { marginBottom: "1.25rem" },
  title:    {
    fontSize:  "1.5rem",
    fontWeight:800,
    color:     "#1f2937",
    margin:    0,
  },
  subtitle: {
    color:     "#6b7280",
    marginTop: "0.35rem",
    lineHeight:1.6,
    fontSize:  "0.9rem",
  },
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
    color:     "#065f46",
    fontSize:  "0.8rem",
    fontWeight:500,
    margin:    0,
    lineHeight:1.4,
  },
  form: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  section: {
    background:    "#f8fafc",
    borderRadius:  "16px",
    padding:       "1.25rem 1.5rem",
    border:        "1px solid #e5e7eb",
    display:       "flex",
    flexDirection: "column",
    gap:           "1rem",
  },
  sectionTitle: {
    fontSize:  "1rem",
    fontWeight:700,
    color:     "#1f2937",
    margin:    0,
  },
  sectionSubtitle: {
    color:    "#9ca3af",
    fontSize: "0.82rem",
    margin:   "0.2rem 0 0",
  },

  // NIN section
  ninBanner: {
    display:      "flex",
    gap:          "0.875rem",
    alignItems:   "flex-start",
    background:   "#eef2ff",
    border:       "1px solid #c7d2fe",
    borderRadius: "12px",
    padding:      "0.875rem 1rem",
  },
  ninBannerIcon: {
    fontSize:  "1.75rem",
    flexShrink:0,
  },
  ninBannerTitle: {
    fontWeight: 700,
    color:      "#4338ca",
    margin:     "0 0 0.2rem",
    fontSize:   "0.875rem",
  },
  ninBannerText: {
    color:     "#4f46e5",
    fontSize:  "0.8rem",
    margin:    0,
    lineHeight:1.5,
  },
  ninHintBox: {
    background:   "#fffbeb",
    border:       "1px solid #fde68a",
    borderRadius: "10px",
    padding:      "0.875rem 1rem",
    marginTop:    "0.75rem",
  },
  ninHintTitle: {
    fontWeight: 700,
    color:      "#92400e",
    fontSize:   "0.82rem",
    margin:     "0 0 0.5rem",
  },
  ninHintList: {
    display:       "flex",
    flexDirection: "column",
    gap:           "0.3rem",
  },
  ninHintRow: {
    display:    "flex",
    gap:        "0.5rem",
    alignItems: "flex-start",
    color:      "#92400e",
    fontSize:   "0.8rem",
    lineHeight: 1.4,
  },

  inputCheck: {
    position:   "absolute",
    right:      "1rem",
    top:        "50%",
    transform:  "translateY(-50%)",
    color:      "#10b981",
    fontSize:   "1.2rem",
    fontWeight: 700,
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

  // Address
  addressPreview: {
    display:      "flex",
    alignItems:   "flex-start",
    gap:          "0.75rem",
    background:   "#ecfdf5",
    border:       "1px solid #a7f3d0",
    borderRadius: "10px",
    padding:      "0.875rem 1rem",
  },
  addressPreviewLabel: {
    color:         "#065f46",
    fontSize:      "0.72rem",
    fontWeight:    700,
    margin:        0,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  addressPreviewValue: {
    color:     "#064e3b",
    fontSize:  "0.875rem",
    fontWeight:600,
    margin:    "0.2rem 0 0",
    lineHeight:1.5,
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

  // Doc upload
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
  fileName: {
    color:     "#10b981",
    fontWeight:600,
    fontSize:  "0.82rem",
    margin:    0,
  },
  fileSize: {
    color:   "#9ca3af",
    fontSize:"0.72rem",
    margin:  0,
  },

  // Checklist
  docChecklist: {
    padding:       "0.875rem 1rem",
    background:    "#f8fafc",
    borderRadius:  "10px",
    border:        "1px solid #e5e7eb",
    display:       "flex",
    flexDirection: "column",
    gap:           "0.4rem",
  },
  docChecklistTitle: {
    fontWeight:    700,
    color:         "#374151",
    fontSize:      "0.78rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin:        "0 0 0.4rem",
  },
  docCheckRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "0.5rem",
  },

  // Tips
  tipsBox: {
    background:   "#f0fdf4",
    border:       "1px solid #bbf7d0",
    borderRadius: "12px",
    padding:      "1rem 1.25rem",
  },
  tipsTitle: {
    fontWeight: 700,
    color:      "#166534",
    fontSize:   "0.875rem",
    margin:     "0 0 0.75rem",
  },
  tipsList:  { display: "flex", flexDirection: "column", gap: "0.4rem" },
  tipRow:    { display: "flex", gap: "0.5rem", alignItems: "flex-start" },
  tipText:   { color: "#166534", fontSize: "0.8rem", lineHeight: 1.4 },

  btnRow: { display: "flex", gap: "1rem" },
};