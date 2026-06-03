// components/seller/StoreSetup.jsx
import React, { useState, useEffect, useRef } from "react";
import { STORE_CATEGORIES }  from "../../hooks/useSellerFlow";
import axios                 from "axios";

// ─── Nigerian Banks ───────────────────────────────────────────
const NIGERIAN_BANKS = [
  { code: "044",    name: "Access Bank"              },
  { code: "023",    name: "Citibank"                 },
  { code: "050",    name: "EcoBank"                  },
  { code: "070",    name: "Fidelity Bank"            },
  { code: "011",    name: "First Bank of Nigeria"    },
  { code: "214",    name: "First City Monument Bank" },
  { code: "058",    name: "Guaranty Trust Bank"      },
  { code: "030",    name: "Heritage Bank"            },
  { code: "301",    name: "Jaiz Bank"                },
  { code: "082",    name: "Keystone Bank"            },
  { code: "076",    name: "Polaris Bank"             },
  { code: "101",    name: "Providus Bank"            },
  { code: "221",    name: "Stanbic IBTC Bank"        },
  { code: "068",    name: "Standard Chartered"       },
  { code: "232",    name: "Sterling Bank"            },
  { code: "100",    name: "Suntrust Bank"            },
  { code: "032",    name: "Union Bank"               },
  { code: "033",    name: "United Bank for Africa"   },
  { code: "215",    name: "Unity Bank"               },
  { code: "035",    name: "Wema Bank"                },
  { code: "057",    name: "Zenith Bank"              },
  { code: "120001", name: "9PSB"                     },
  { code: "50515",  name: "Moniepoint MFB"           },
  { code: "090405", name: "Opay"                     },
  { code: "999992", name: "Palmpay"                  },
  { code: "50211",  name: "Kuda Bank"                },
];

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
const StoreSetup = ({ flow }) => {
  const {
    storeData,
    errors,
    loading,
    serverMsg,
    previewLogo,
    handleStoreChange,
    submitStore,
  } = flow;

  // ── Bank verification state ───────────────────────────────
  const [selectedBank,  setSelectedBank]  = useState(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName,   setAccountName]   = useState("");
  const [verifying,     setVerifying]     = useState(false);
  const [verifyError,   setVerifyError]   = useState("");
  const [bankSearch,    setBankSearch]     = useState("");
  const [showBankList,  setShowBankList]   = useState(false);

  const bankRef = useRef(null);

  // ── Close dropdown on outside click ───────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (bankRef.current && !bankRef.current.contains(e.target)) {
        setShowBankList(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Auto-verify when 10 digits + bank selected ────────────
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      verifyAccount(accountNumber, selectedBank.code);
    } else if (accountName) {
      // Reset if user changes number
      setAccountName("");
      handleStoreChange({
        target: { name: "account_name", value: "" },
      });
    }
  }, [accountNumber, selectedBank]);

  // ── Verify account via Flutterwave ────────────────────────
  const verifyAccount = async (number, code) => {
    setVerifying(true);
    setVerifyError("");
    setAccountName("");

    try {
      // ✅ FIX: Send Authorization header with token
      const token = localStorage.getItem("token");

      const { data } = await axios.get(
        "/api/seller-onboarding/verify-account",
        {
          params: {
            account_number: number,
            bank_code:      code,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (data.success && data.account_name) {
        const name = data.account_name;
        setAccountName(name);

        // Push bank fields into storeData
        handleStoreChange({
          target: { name: "bank_account", value: number },
        });
        handleStoreChange({
          target: { name: "bank_name", value: selectedBank.name },
        });
        handleStoreChange({
          target: { name: "bank_code", value: code },
        });
        handleStoreChange({
          target: { name: "account_name", value: name },
        });
        handleStoreChange({
          target: { name: "withdrawal_method", value: "bank_transfer" },
        });
      } else {
        setVerifyError("Account not found. Check number and bank.");
      }

    } catch (err) {
      setVerifyError(
        err.response?.data?.message ??
        "Verification failed. Check details and try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  // ── Filtered banks ────────────────────────────────────────
  const filteredBanks = NIGERIAN_BANKS.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <div className="seller-card">
      <div style={s.header}>
        <h2 style={s.title}>🏪 Store Setup</h2>
        <p style={s.subtitle}>
          Tell us about your store — this is what buyers will see.
        </p>
      </div>

      <div style={s.form}>

        {/* ── Store Name ─────────────────────── */}
        <Field
          label="Store Name"
          icon="🏷️"
          required
          error={errors.store_name}
        >
          <input
            name="store_name"
            value={storeData.store_name}
            onChange={handleStoreChange}
            placeholder="e.g. TechHub Electronics"
            className={`seller-input ${errors.store_name ? "error" : ""}`}
          />
          <span style={s.charCount}>
            {storeData.store_name.length}/100
          </span>
        </Field>

        {/* ── Store Category ──────────────────── */}
        <Field
          label="Store Category"
          icon="📂"
          required
          error={errors.store_category}
        >
          <div className="category-grid">
            {STORE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  handleStoreChange({
                    target: { name: "store_category", value: cat },
                  })
                }
                className={`category-pill ${
                  storeData.store_category === cat ? "selected" : ""
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </Field>

        {/* ── Description ────────────────────── */}
        <Field
          label="Store Description"
          icon="📝"
          required
          error={errors.store_description}
        >
          <textarea
            name="store_description"
            value={storeData.store_description}
            onChange={handleStoreChange}
            placeholder="Describe what your store sells, specialties, shipping..."
            className={`seller-textarea ${errors.store_description ? "error" : ""}`}
          />
        </Field>

        {/* ── Store Logo ──────────────────────── */}
        <Field label="Store Logo" icon="🖼️">
          <div style={s.logoRow}>
            {previewLogo ? (
              <img
                src={previewLogo}
                alt="Logo"
                className="logo-preview-circle"
              />
            ) : (
              <div style={s.logoPlaceholder}>
                {storeData.store_name?.[0]?.toUpperCase() ?? "S"}
              </div>
            )}
            <div className="upload-box" style={{ flex: 1 }}>
              <input
                type="file"
                name="store_logo"
                accept="image/*"
                onChange={handleStoreChange}
              />
              <div className="upload-icon">🖼️</div>
              <p className="upload-text">Click to upload logo</p>
              <p className="upload-sub">PNG, JPG up to 5MB</p>
            </div>
          </div>
        </Field>

        {/* ── Store Banner ─────────────────────── */}
        <Field label="Store Banner" icon="🏞️">
          <div className="upload-box">
            <input
              type="file"
              name="store_banner"
              accept="image/*"
              onChange={handleStoreChange}
            />
            <div className="upload-icon">🏞️</div>
            <p className="upload-text">Click to upload banner</p>
            <p className="upload-sub">Recommended: 1200×300px</p>
            {storeData.store_banner && (
              <p style={s.fileOk}>
                ✅ {storeData.store_banner.name}
              </p>
            )}
          </div>
        </Field>

        {/* ══════════════════════════════════════
            BANK DETAILS
        ══════════════════════════════════════ */}
        <div style={s.bankSection}>
          <h3 style={s.bankTitle}>🏦 Bank Details</h3>
          <p style={s.bankSubtitle}>
            Payouts will be sent to this account
          </p>

          {/* ── Bank Selector ────────────────── */}
          <Field
            label="Select Bank"
            icon="🏦"
            required
            error={errors.bank_name}
          >
            <div ref={bankRef} style={{ position: "relative" }}>
              <button
                type="button"
                style={{
                  ...s.bankTrigger,
                  borderColor: showBankList
                    ? "#6366f1"
                    : errors.bank_name
                    ? "#ef4444"
                    : "#e5e7eb",
                }}
                onClick={() => setShowBankList(!showBankList)}
              >
                <span style={{
                  color: selectedBank ? "#1f2937" : "#9ca3af",
                }}>
                  {selectedBank?.name ?? "Choose your bank"}
                </span>
                <span style={s.chevron}>
                  {showBankList ? "▲" : "▼"}
                </span>
              </button>

              {showBankList && (
                <div style={s.bankDropdown}>
                  <div style={s.bankSearchWrap}>
                    <input
                      type="text"
                      placeholder="🔍 Search bank..."
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      style={s.bankSearch}
                      autoFocus
                    />
                  </div>

                  <div style={s.bankList}>
                    {filteredBanks.length === 0 ? (
                      <div style={s.bankNoResult}>No banks found</div>
                    ) : (
                      filteredBanks.map((bank) => (
                        <button
                          key={bank.code}
                          type="button"
                          style={{
                            ...s.bankOption,
                            background:
                              selectedBank?.code === bank.code
                                ? "#eef2ff" : "white",
                            color:
                              selectedBank?.code === bank.code
                                ? "#6366f1" : "#374151",
                            fontWeight:
                              selectedBank?.code === bank.code
                                ? 700 : 400,
                          }}
                          onClick={() => {
                            setSelectedBank(bank);
                            setBankSearch("");
                            setShowBankList(false);
                            setAccountName("");
                            setVerifyError("");
                          }}
                        >
                          {bank.name}
                          {selectedBank?.code === bank.code && (
                            <span style={{ marginLeft: "auto" }}>✓</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </Field>

          {/* ── Account Number ───────────────── */}
          <Field
            label="Account Number"
            icon="🔢"
            required
            error={errors.bank_account}
            hint={
              !selectedBank
                ? "Select a bank first"
                : "10-digit account number"
            }
          >
            <div style={{ position: "relative" }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={accountNumber}
                disabled={!selectedBank}
                onChange={(e) => {
                  const val = e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 10);
                  setAccountNumber(val);
                }}
                placeholder={
                  selectedBank
                    ? "Enter 10-digit account number"
                    : "Select a bank first"
                }
                className={`seller-input ${
                  errors.bank_account || verifyError ? "error" : ""
                }`}
                style={{
                  paddingRight: "3rem",
                  opacity:      selectedBank ? 1 : 0.5,
                }}
              />

              <span style={s.acctStatus}>
                {verifying && <span style={s.spinnerSmall} />}
                {!verifying && accountName && (
                  <span style={{ color: "#10b981", fontSize: "1.2rem" }}>✓</span>
                )}
                {!verifying && verifyError && (
                  <span style={{ color: "#ef4444", fontSize: "1.2rem" }}>✗</span>
                )}
              </span>
            </div>

            {/* Digit progress */}
            <div style={s.digitCounter}>
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...s.digitDot,
                    background:
                      i < accountNumber.length ? "#6366f1" : "#e5e7eb",
                  }}
                />
              ))}
              <span style={s.digitLabel}>
                {accountNumber.length}/10
              </span>
            </div>
          </Field>

          {/* ── Verify Error ─────────────────── */}
          {verifyError && (
            <div style={s.verifyError}>
              <span>⚠️ {verifyError}</span>
              {selectedBank && accountNumber.length === 10 && (
                <button
                  type="button"
                  style={s.retryBtn}
                  onClick={() =>
                    verifyAccount(accountNumber, selectedBank.code)
                  }
                >
                  🔄 Retry
                </button>
              )}
            </div>
          )}

          {/* ── Verifying spinner ────────────── */}
          {verifying && (
            <div style={s.verifyingBox}>
              <span style={s.spinnerSmall} />
              <span>Verifying account with {selectedBank?.name}...</span>
            </div>
          )}

          {/* ── Verified Account Name ────────── */}
          {accountName && !verifying && (
            <div style={s.accountNameBox}>
              <div style={s.accountNameIcon}>✅</div>
              <div>
                <p style={s.accountNameLabel}>Account Name</p>
                <p style={s.accountNameValue}>{accountName}</p>
              </div>
              <div style={s.verifiedBadge}>Verified</div>
            </div>
          )}
        </div>

        {/* ── Server Message ──────────────────── */}
        {serverMsg && (
          <div
            className={`seller-alert ${
              serverMsg.toLowerCase().includes("fail") ||
              serverMsg.toLowerCase().includes("error")
                ? "error"
                : "success"
            }`}
          >
            {serverMsg}
          </div>
        )}

        {/* ── Submit ─────────────────────────── */}
        <button
          onClick={submitStore}
          disabled={loading || !accountName}
          className="btn-seller-primary"
          style={{ opacity: !accountName ? 0.6 : 1 }}
        >
          {loading ? (
            <><span className="spinner" /> Saving Store...</>
          ) : (
            "Continue to Verification →"
          )}
        </button>

        {!accountName && (
          <p style={s.acctHint}>
            ⚠️ Verify your bank account to continue
          </p>
        )}

      </div>
    </div>
  );
};

// ─── Field Wrapper ────────────────────────────────────────────
const Field = ({ label, icon, required, error, hint, children }) => (
  <div className="seller-field">
    <label className="seller-label">
      {icon} {label}
      {required && <span style={{ color: "#ef4444" }}> *</span>}
    </label>
    {children}
    {hint && !error && (
      <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>{hint}</span>
    )}
    {error && <span className="field-error">⚠️ {error}</span>}
  </div>
);

// ─── Styles ───────────────────────────────────────────────────
const s = {
  header:   { marginBottom: "2rem" },
  title:    { fontSize: "1.5rem", fontWeight: 800, color: "#1f2937", margin: 0 },
  subtitle: { color: "#6b7280", marginTop: "0.35rem" },
  form:     { display: "flex", flexDirection: "column", gap: "1.5rem" },
  charCount:{ color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.25rem", display: "block" },
  fileOk:   { color: "#10b981", marginTop: "0.5rem", fontSize: "0.85rem" },

  logoRow: {
    display:    "flex",
    gap:        "1.5rem",
    alignItems: "center",
  },
  logoPlaceholder: {
    width:          "80px",
    height:         "80px",
    borderRadius:   "50%",
    background:     "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color:          "white",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       "2rem",
    fontWeight:     800,
    flexShrink:     0,
  },

  // Bank section
  bankSection: {
    background:    "#f8fafc",
    borderRadius:  "16px",
    padding:       "1.5rem",
    border:        "1px solid #e5e7eb",
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  bankTitle:    { fontSize: "1.1rem", fontWeight: 700, color: "#1f2937", margin: 0 },
  bankSubtitle: { color: "#9ca3af", fontSize: "0.85rem", margin: 0 },

  // Bank selector
  bankTrigger: {
    width:          "100%",
    padding:        "0.875rem 1.125rem",
    border:         "2px solid",
    borderRadius:   "14px",
    background:     "white",
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    cursor:         "pointer",
    fontSize:       "1rem",
    transition:     "border-color 0.2s",
  },
  chevron: { color: "#9ca3af", fontSize: "0.75rem" },

  bankDropdown: {
    position:     "absolute",
    top:          "calc(100% + 4px)",
    left:         0,
    right:        0,
    background:   "white",
    border:       "1px solid #e5e7eb",
    borderRadius: "14px",
    boxShadow:    "0 8px 30px rgba(0,0,0,0.12)",
    zIndex:       100,
    overflow:     "hidden",
  },
  bankSearchWrap: {
    padding:      "0.75rem",
    borderBottom: "1px solid #f3f4f6",
  },
  bankSearch: {
    width:       "100%",
    padding:     "0.6rem 0.875rem",
    border:      "1px solid #e5e7eb",
    borderRadius:"8px",
    fontSize:    "0.9rem",
    outline:     "none",
    boxSizing:   "border-box",
  },
  bankList: {
    maxHeight: "240px",
    overflowY: "auto",
  },
  bankOption: {
    width:      "100%",
    padding:    "0.75rem 1rem",
    border:     "none",
    textAlign:  "left",
    cursor:     "pointer",
    fontSize:   "0.875rem",
    display:    "flex",
    alignItems: "center",
    transition: "background 0.1s",
  },
  bankNoResult: {
    padding:   "1.5rem",
    textAlign: "center",
    color:     "#9ca3af",
    fontSize:  "0.875rem",
  },

  // Account number
  acctStatus: {
    position:  "absolute",
    right:     "1rem",
    top:       "50%",
    transform: "translateY(-50%)",
  },
  digitCounter: {
    display:    "flex",
    gap:        "4px",
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
    fontSize:   "0.75rem",
    color:      "#9ca3af",
    marginLeft: "0.5rem",
    whiteSpace: "nowrap",
  },

  // Verify states
  verifyError: {
    background:   "#fef2f2",
    border:       "1px solid #fecaca",
    borderRadius: "10px",
    padding:      "0.75rem 1rem",
    color:        "#991b1b",
    fontSize:     "0.875rem",
    display:      "flex",
    alignItems:   "center",
    gap:          "0.5rem",
    flexWrap:     "wrap",
  },
  retryBtn: {
    marginLeft:   "auto",
    background:   "#fecaca",
    color:        "#991b1b",
    border:       "none",
    borderRadius: "6px",
    padding:      "0.3rem 0.75rem",
    fontWeight:   600,
    cursor:       "pointer",
    fontSize:     "0.8rem",
  },
  verifyingBox: {
    display:      "flex",
    alignItems:   "center",
    gap:          "0.75rem",
    color:        "#6b7280",
    fontSize:     "0.875rem",
    padding:      "0.75rem 1rem",
    background:   "#f9fafb",
    borderRadius: "10px",
    border:       "1px solid #e5e7eb",
  },

  // Account name result
  accountNameBox: {
    display:      "flex",
    alignItems:   "center",
    gap:          "1rem",
    background:   "#ecfdf5",
    border:       "1px solid #a7f3d0",
    borderRadius: "12px",
    padding:      "1rem 1.25rem",
  },
  accountNameIcon:  { fontSize: "1.5rem" },
  accountNameLabel: {
    color:      "#065f46",
    fontSize:   "0.75rem",
    fontWeight: 600,
    margin:     0,
  },
  accountNameValue: {
    color:      "#064e3b",
    fontSize:   "1.05rem",
    fontWeight: 800,
    margin:     "0.15rem 0 0",
  },
  verifiedBadge: {
    marginLeft:  "auto",
    background:  "#10b981",
    color:       "white",
    fontSize:    "0.7rem",
    fontWeight:  700,
    padding:     "0.25rem 0.65rem",
    borderRadius:"100px",
    letterSpacing:"0.03em",
  },

  spinnerSmall: {
    width:        "16px",
    height:       "16px",
    border:       "2px solid #e5e7eb",
    borderTop:    "2px solid #6366f1",
    borderRadius: "50%",
    display:      "inline-block",
    animation:    "spin 0.7s linear infinite",
  },

  acctHint: {
    textAlign:  "center",
    color:      "#f59e0b",
    fontSize:   "0.85rem",
    margin:     0,
  },
};

export default StoreSetup;