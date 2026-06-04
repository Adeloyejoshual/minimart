// components/seller/StoreSetup.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { STORE_CATEGORIES } from "../../hooks/useSellerFlow";
import axios                from "axios";

// ─── Nigerian Commercial Banks Only ───────────────────────────
// Removed: Opay, Palmpay, Kuda, Moniepoint, 9PSB, Rubies MFB
const FALLBACK_BANKS = [
  { code: "044", name: "Access Bank"              },
  { code: "023", name: "Citibank"                 },
  { code: "050", name: "EcoBank"                  },
  { code: "070", name: "Fidelity Bank"            },
  { code: "011", name: "First Bank of Nigeria"    },
  { code: "214", name: "First City Monument Bank" },
  { code: "058", name: "Guaranty Trust Bank"      },
  { code: "030", name: "Heritage Bank"            },
  { code: "301", name: "Jaiz Bank"                },
  { code: "082", name: "Keystone Bank"            },
  { code: "076", name: "Polaris Bank"             },
  { code: "101", name: "Providus Bank"            },
  { code: "221", name: "Stanbic IBTC Bank"        },
  { code: "068", name: "Standard Chartered"       },
  { code: "232", name: "Sterling Bank"            },
  { code: "100", name: "Suntrust Bank"            },
  { code: "032", name: "Union Bank"               },
  { code: "033", name: "United Bank for Africa"   },
  { code: "215", name: "Unity Bank"               },
  { code: "035", name: "Wema Bank"                },
  { code: "057", name: "Zenith Bank"              },
];

// ═════════════════════════════════════════════════════════════
export default function StoreSetup({ flow }) {
  const {
    storeData,
    errors,
    loading,
    serverMsg,
    previewLogo,
    handleStoreChange,
    submitStore,
  } = flow;

  const [banks,        setBanks]        = useState(FALLBACK_BANKS);
  const [banksLoading, setBanksLoading] = useState(true);
  const [selectedBank,  setSelectedBank]  = useState(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName,   setAccountName]   = useState("");
  const [verifying,     setVerifying]     = useState(false);
  const [verifyError,   setVerifyError]   = useState("");
  const [bankSearch,    setBankSearch]    = useState("");
  const [showBankList,  setShowBankList]  = useState(false);

  const bankRef   = useRef(null);
  const verifyRef = useRef(null);

  // ── Load banks from API — filter out MFBs ─────────────────
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const token    = localStorage.getItem("token");
        const { data } = await axios.get(
          "/api/seller-onboarding/banks",
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (data.success && data.banks?.length) {
          // ── Filter: keep only commercial banks (nuban type)
          // Remove MFBs, mobile money, fintech wallets
          const MFB_KEYWORDS = [
            "microfinance", "mfb", "mfBank",
            "opay", "palmpay", "kuda", "moniepoint",
            "9psb", "rubies", "fairmoney", "carbon",
            "piggyvest", "eyowo", "sparkle",
          ];

          const commercialOnly = data.banks.filter((b) => {
            const nameLower = b.name.toLowerCase();
            return !MFB_KEYWORDS.some((keyword) =>
              nameLower.includes(keyword)
            );
          });

          setBanks(
            commercialOnly.length > 0
              ? commercialOnly
              : FALLBACK_BANKS
          );
        }
      } catch {
        // Keep fallback list
      } finally {
        setBanksLoading(false);
      }
    };
    fetchBanks();
  }, []);

  // ── Close dropdown on outside click ──────────────────────
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
    }
    if (accountNumber.length < 10 && accountName) {
      setAccountName("");
      setVerifyError("");
      handleStoreChange({ target: { name: "account_name", value: "" } });
    }
  }, [accountNumber, selectedBank]);

  // ── Verify account ────────────────────────────────────────
  const verifyAccount = useCallback(async (number, code) => {
    if (verifyRef.current) verifyRef.current = false;
    verifyRef.current = true;

    setVerifying(true);
    setVerifyError("");
    setAccountName("");

    try {
      const token    = localStorage.getItem("token");
      const { data } = await axios.get(
        "/api/seller-onboarding/verify-account",
        {
          params:  { account_number: number, bank_code: code },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!verifyRef.current) return;

      if (data.success && data.account_name) {
        const name = data.account_name;
        setAccountName(name);
        handleStoreChange({ target: { name: "bank_account",      value: number             } });
        handleStoreChange({ target: { name: "bank_name",         value: selectedBank?.name } });
        handleStoreChange({ target: { name: "bank_code",         value: code               } });
        handleStoreChange({ target: { name: "account_name",      value: name               } });
        handleStoreChange({ target: { name: "withdrawal_method", value: "bank_transfer"    } });
      } else {
        setVerifyError("Account not found. Check number and bank.");
      }
    } catch (err) {
      if (!verifyRef.current) return;
      setVerifyError(
        err.response?.data?.message ?? "Verification failed. Try again."
      );
    } finally {
      if (verifyRef.current) setVerifying(false);
    }
  }, [selectedBank, handleStoreChange]);

  // ── Select bank ───────────────────────────────────────────
  const handleBankSelect = useCallback((bank) => {
    setSelectedBank(bank);
    setBankSearch("");
    setShowBankList(false);
    setAccountName("");
    setVerifyError("");
    handleStoreChange({ target: { name: "account_name", value: ""        } });
    handleStoreChange({ target: { name: "bank_name",    value: bank.name } });
    handleStoreChange({ target: { name: "bank_code",    value: bank.code } });
  }, [handleStoreChange]);

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const canSubmit = !!accountName && !loading;

  return (
    <div className="seller-card">

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={s.cardHeader}>
        <h2 style={s.cardTitle}>🏪 Store Setup</h2>
        <p style={s.cardSubtitle}>
          Tell us about your store — this is what buyers will see.
        </p>
      </div>

      <div style={s.form}>

        {/* ── Store Name ───────────────────────────────────── */}
        <Field label="Store Name" icon="🏷️" required error={errors.store_name}>
          <input
            name="store_name"
            value={storeData.store_name}
            onChange={handleStoreChange}
            placeholder="e.g. TechHub Electronics"
            maxLength={100}
            className={`seller-input ${errors.store_name ? "error" : ""}`}
          />
          <span style={s.charCount}>
            {storeData.store_name.length}/100
          </span>
        </Field>

        {/* ── Store Category ───────────────────────────────── */}
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

        {/* ── Description ──────────────────────────────────── */}
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
            placeholder="Describe your store, specialties, shipping policy..."
            rows={4}
            className={`seller-textarea ${
              errors.store_description ? "error" : ""
            }`}
          />
        </Field>

        {/* ── Store Logo ───────────────────────────────────── */}
        <Field label="Store Logo" icon="🖼️">
          <div style={s.logoRow}>
            {previewLogo ? (
              <img
                src={previewLogo}
                alt="Logo preview"
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

        {/* ── Store Banner ─────────────────────────────────── */}
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
              <p style={s.fileOk}>✅ {storeData.store_banner.name}</p>
            )}
          </div>
        </Field>

        {/* ══════════════════════════════════════════════════
            BANK DETAILS
        ══════════════════════════════════════════════════ */}
        <div style={s.bankSection}>
          <div style={s.bankSectionHeader}>
            <h3 style={s.bankTitle}>🏦 Bank Details</h3>
            <p style={s.bankSubtitle}>
              Payouts will be sent to this account
            </p>
            <p style={s.bankNote}>
              ℹ️ Only CBN-licensed commercial banks accepted
            </p>
          </div>

          {/* ── Bank Selector ─────────────────────────── */}
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
                onClick={() => setShowBankList((v) => !v)}
              >
                <span style={{
                  color: selectedBank ? "#1f2937" : "#9ca3af",
                }}>
                  {banksLoading
                    ? "Loading banks..."
                    : selectedBank?.name ?? "Choose your bank"}
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
                      style={s.bankSearchInput}
                      autoFocus
                    />
                  </div>
                  <div style={s.bankList}>
                    {filteredBanks.length === 0 ? (
                      <div style={s.bankNoResult}>No banks found</div>
                    ) : (
                      filteredBanks.map((bank) => {
                        const isSelected = selectedBank?.code === bank.code;
                        return (
                          <button
                            key={`${bank.code}-${bank.name}`}
                            type="button"
                            style={{
                              ...s.bankOption,
                              background: isSelected ? "#eef2ff" : "white",
                              color:      isSelected ? "#6366f1" : "#374151",
                              fontWeight: isSelected ? 700 : 400,
                            }}
                            onClick={() => handleBankSelect(bank)}
                          >
                            <span>{bank.name}</span>
                            {isSelected && (
                              <span style={{ marginLeft: "auto" }}>✓</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </Field>

          {/* ── Account Number ────────────────────────── */}
          <Field
            label="Account Number"
            icon="🔢"
            required
            error={errors.bank_account}
            hint={
              !selectedBank
                ? "Select a bank first"
                : "Enter your 10-digit account number"
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
                  selectedBank ? "e.g. 0123456789" : "Select a bank first"
                }
                className={`seller-input ${
                  verifyError ? "error" : accountName ? "success" : ""
                }`}
                style={{
                  paddingRight: "3.5rem",
                  opacity:      selectedBank ? 1 : 0.55,
                  borderColor:  accountName
                    ? "#10b981"
                    : verifyError
                    ? "#ef4444"
                    : undefined,
                }}
              />

              <span style={s.acctIcon}>
                {verifying && <Spinner size={16} />}
                {!verifying && accountName && (
                  <span style={{ color: "#10b981", fontSize: "1.2rem" }}>✓</span>
                )}
                {!verifying && verifyError && (
                  <span style={{ color: "#ef4444", fontSize: "1.2rem" }}>✗</span>
                )}
              </span>
            </div>

            {/* Digit progress */}
            <div style={s.digitRow}>
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...s.digitDot,
                    background:
                      i < accountNumber.length
                        ? accountName ? "#10b981" : "#6366f1"
                        : "#e5e7eb",
                  }}
                />
              ))}
              <span style={s.digitLabel}>
                {accountNumber.length}/10
              </span>
            </div>
          </Field>

          {/* ── Verifying state ───────────────────────── */}
          {verifying && (
            <div style={s.verifyingBox}>
              <Spinner size={16} />
              <span>Verifying with {selectedBank?.name}...</span>
            </div>
          )}

          {/* ── Verify error ──────────────────────────── */}
          {verifyError && !verifying && (
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

          {/* ── Verified account name ─────────────────── */}
          {accountName && !verifying && (
            <div style={s.accountNameBox}>
              <span style={{ fontSize: "1.75rem" }}>✅</span>
              <div style={{ flex: 1 }}>
                <p style={s.accountNameLabel}>Verified Account Name</p>
                <p style={s.accountNameValue}>{accountName}</p>
                <p style={s.accountNameBank}>{selectedBank?.name}</p>
              </div>
              <span style={s.verifiedBadge}>Verified</span>
            </div>
          )}
        </div>

        {/* ── Server message ───────────────────────────── */}
        {serverMsg && (
          <div
            className={`seller-alert ${
              serverMsg.toLowerCase().includes("fail") ||
              serverMsg.toLowerCase().includes("error") ||
              serverMsg.toLowerCase().includes("already")
                ? "error" : "success"
            }`}
          >
            {serverMsg}
          </div>
        )}

        {/* ── Submit ───────────────────────────────────── */}
        <button
          type="button"
          onClick={submitStore}
          disabled={!canSubmit}
          className="btn-seller-primary"
          style={{ opacity: canSubmit ? 1 : 0.6 }}
        >
          {loading ? (
            <><Spinner size={18} white /> Saving Store...</>
          ) : (
            "Continue to Verification →"
          )}
        </button>

        {!accountName && !loading && (
          <p style={s.submitHint}>
            ⚠️ Please verify your bank account above to continue
          </p>
        )}

      </div>
    </div>
  );
}

// ─── Field Wrapper ────────────────────────────────────────────
function Field({ label, icon, required, error, hint, children }) {
  return (
    <div className="seller-field">
      <label className="seller-label">
        {icon} {label}
        {required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
      {hint && !error && (
        <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>{hint}</span>
      )}
      {error && (
        <span className="field-error">⚠️ {error}</span>
      )}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────
function Spinner({ size = 20, white = false }) {
  return (
    <span style={{
      width:         size,
      height:        size,
      border:        `2px solid ${white ? "rgba(255,255,255,0.3)" : "#e5e7eb"}`,
      borderTop:     `2px solid ${white ? "white" : "#6366f1"}`,
      borderRadius:  "50%",
      display:       "inline-block",
      animation:     "spin 0.7s linear infinite",
      verticalAlign: "middle",
      flexShrink:    0,
    }} />
  );
}

// ─── Styles ───────────────────────────────────────────────────
const s = {
  cardHeader:   { marginBottom: "2rem" },
  cardTitle:    { fontSize: "1.5rem", fontWeight: 800, color: "#1f2937", margin: 0 },
  cardSubtitle: { color: "#6b7280", marginTop: "0.35rem", margin: "0.35rem 0 0" },

  form:      { display: "flex", flexDirection: "column", gap: "1.5rem" },
  charCount: { color: "#9ca3af", fontSize: "0.8rem", marginTop: "0.25rem", display: "block" },
  fileOk:    { color: "#10b981", marginTop: "0.5rem", fontSize: "0.85rem" },

  logoRow: { display: "flex", gap: "1.5rem", alignItems: "center" },
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

  bankSection: {
    background:    "#f8fafc",
    borderRadius:  "16px",
    padding:       "1.5rem",
    border:        "1px solid #e5e7eb",
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  bankSectionHeader: { marginBottom: "0.25rem" },
  bankTitle:   { fontSize: "1.05rem", fontWeight: 700, color: "#1f2937", margin: 0 },
  bankSubtitle:{ color: "#9ca3af", fontSize: "0.85rem", margin: "0.25rem 0 0" },
  bankNote:    {
    color:        "#6366f1",
    fontSize:     "0.78rem",
    margin:       "0.35rem 0 0",
    background:   "#eef2ff",
    padding:      "0.3rem 0.6rem",
    borderRadius: "6px",
    display:      "inline-block",
  },

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
    textAlign:      "left",
  },
  chevron: { color: "#9ca3af", fontSize: "0.75rem", flexShrink: 0 },

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
  bankSearchWrap:  { padding: "0.75rem", borderBottom: "1px solid #f3f4f6" },
  bankSearchInput: {
    width:        "100%",
    padding:      "0.6rem 0.875rem",
    border:       "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize:     "0.9rem",
    outline:      "none",
    boxSizing:    "border-box",
  },
  bankList:   { maxHeight: "240px", overflowY: "auto" },
  bankOption: {
    width:      "100%",
    padding:    "0.75rem 1rem",
    border:     "none",
    textAlign:  "left",
    cursor:     "pointer",
    fontSize:   "0.875rem",
    display:    "flex",
    alignItems: "center",
    gap:        "0.5rem",
    transition: "background 0.1s",
  },
  bankNoResult: {
    padding:   "1.5rem",
    textAlign: "center",
    color:     "#9ca3af",
    fontSize:  "0.875rem",
  },

  acctIcon: {
    position:  "absolute",
    right:     "1rem",
    top:       "50%",
    transform: "translateY(-50%)",
    display:   "flex",
    alignItems:"center",
  },
  digitRow: {
    display:    "flex",
    gap:        "4px",
    marginTop:  "0.5rem",
    alignItems: "center",
  },
  digitDot: {
    height:       "4px",
    borderRadius: "100px",
    transition:   "background 0.25s ease",
    flex:         1,
  },
  digitLabel: {
    fontSize:   "0.72rem",
    color:      "#9ca3af",
    marginLeft: "0.5rem",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  verifyingBox: {
    display:      "flex",
    alignItems:   "center",
    gap:          "0.75rem",
    color:        "#6b7280",
    fontSize:     "0.875rem",
    padding:      "0.875rem 1rem",
    background:   "#f9fafb",
    borderRadius: "10px",
    border:       "1px solid #e5e7eb",
  },
  verifyError: {
    background:   "#fef2f2",
    border:       "1px solid #fecaca",
    borderRadius: "10px",
    padding:      "0.875rem 1rem",
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
    flexShrink:   0,
  },

  accountNameBox: {
    display:      "flex",
    alignItems:   "center",
    gap:          "1rem",
    background:   "#ecfdf5",
    border:       "1px solid #a7f3d0",
    borderRadius: "12px",
    padding:      "1rem 1.25rem",
  },
  accountNameLabel: {
    color:         "#065f46",
    fontSize:      "0.72rem",
    fontWeight:    600,
    margin:        0,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  accountNameValue: {
    color:      "#064e3b",
    fontSize:   "1.05rem",
    fontWeight: 800,
    margin:     "0.2rem 0 0",
  },
  accountNameBank: {
    color:    "#047857",
    fontSize: "0.8rem",
    margin:   "0.15rem 0 0",
  },
  verifiedBadge: {
    marginLeft:    "auto",
    background:    "#10b981",
    color:         "white",
    fontSize:      "0.7rem",
    fontWeight:    700,
    padding:       "0.25rem 0.65rem",
    borderRadius:  "100px",
    letterSpacing: "0.04em",
    flexShrink:    0,
  },

  submitHint: {
    textAlign:  "center",
    color:      "#f59e0b",
    fontSize:   "0.85rem",
    margin:     0,
    fontWeight: 500,
  },
};