// components/seller/StoreSetup.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { STORE_CATEGORIES, SELLER_TOKEN_KEY } from "../../hooks/useSellerFlow";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// TOKEN HELPER — must match useSellerFlow + SellerDashboard
// ─────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem(SELLER_TOKEN_KEY);

// ─────────────────────────────────────────────────────────────
// NIGERIAN COMMERCIAL BANKS — fallback if API fails
// ─────────────────────────────────────────────────────────────
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

const MFB_KEYWORDS = [
  "microfinance", "mfb", "mfbank",
  "opay", "palmpay", "kuda", "moniepoint",
  "9psb", "rubies", "fairmoney", "carbon",
  "piggyvest", "eyowo", "sparkle",
];

// ═════════════════════════════════════════════════════════════
export default function StoreSetup({ flow }) {
  const {
    storeData,
    errors,
    loading,
    serverMsg,
    serverErr,
    previewLogo,
    handleStoreChange,
    submitStore,
  } = flow;

  const [banks,         setBanks]         = useState(FALLBACK_BANKS);
  const [banksLoading,  setBanksLoading]  = useState(true);
  const [selectedBank,  setSelectedBank]  = useState(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName,   setAccountName]   = useState("");
  const [verifying,     setVerifying]     = useState(false);
  const [verifyError,   setVerifyError]   = useState("");
  const [bankSearch,    setBankSearch]    = useState("");
  const [showBankList,  setShowBankList]  = useState(false);

  const bankRef    = useRef(null);
  const activeRef  = useRef(true); // prevent state update on unmounted

  // ── Restore existing bank data on mount (e.g. after refresh)
  useEffect(() => {
    if (storeData.bank_name && storeData.bank_account) {
      const found = FALLBACK_BANKS.find(
        (b) => b.name === storeData.bank_name
          || b.code === storeData.bank_code
      );
      if (found) setSelectedBank(found);
      setAccountNumber(storeData.bank_account);
      if (storeData.account_name) setAccountName(storeData.account_name);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ──────────────────────────────────
  useEffect(() => {
    return () => { activeRef.current = false; };
  }, []);

  // ── Load banks from API ─────────────────────────────────
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const { data } = await axios.get(
          "/api/seller-onboarding/banks",
          { headers: { Authorization: `Bearer ${getToken()}` } }
        );

        if (data.success && data.banks?.length) {
          const filtered = data.banks.filter((b) => {
            const n = b.name.toLowerCase();
            return !MFB_KEYWORDS.some((kw) => n.includes(kw));
          });
          setBanks(filtered.length > 0 ? filtered : FALLBACK_BANKS);
        }
      } catch {
        // Keep fallback — silently ignore
      } finally {
        setBanksLoading(false);
      }
    };
    fetchBanks();
  }, []);

  // ── Close bank dropdown on outside click ────────────────
  useEffect(() => {
    const handler = (e) => {
      if (bankRef.current && !bankRef.current.contains(e.target)) {
        setShowBankList(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Auto-verify when 10 digits + bank selected ──────────
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      verifyAccount(accountNumber, selectedBank.code);
    }
    if (accountNumber.length < 10) {
      setAccountName("");
      setVerifyError("");
      // Clear from flow state too
      handleStoreChange({
        target: { name: "account_name", value: "" }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNumber, selectedBank]);

  // ── Verify account number ───────────────────────────────
  const verifyAccount = useCallback(async (number, code) => {
    setVerifying(true);
    setVerifyError("");
    setAccountName("");

    try {
      // ✅ FIXED: use getToken() → "seller_token"
      const { data } = await axios.get(
        "/api/seller-onboarding/verify-account",
        {
          params:  { account_number: number, bank_code: code },
          headers: { Authorization: `Bearer ${getToken()}` },
          timeout: 12_000,
        }
      );

      if (!activeRef.current) return;

      if (data.success && data.account_name) {
        const name = data.account_name;
        setAccountName(name);

        // Push all bank data into flow state
        handleStoreChange({ target: { name: "bank_account",      value: number                        } });
        handleStoreChange({ target: { name: "bank_name",         value: selectedBank?.name ?? ""      } });
        handleStoreChange({ target: { name: "bank_code",         value: selectedBank?.code ?? code    } });
        handleStoreChange({ target: { name: "account_name",      value: name                          } });
        handleStoreChange({ target: { name: "withdrawal_method", value: "bank_transfer"               } });
      } else {
        setVerifyError("Account not found. Check number and bank.");
      }
    } catch (err) {
      if (!activeRef.current) return;
      const msg = err.response?.data?.message;
      setVerifyError(msg ?? "Verification failed. Try again.");
    } finally {
      if (activeRef.current) setVerifying(false);
    }
  }, [selectedBank, handleStoreChange]);

  // ── Select bank ─────────────────────────────────────────
  const handleBankSelect = useCallback((bank) => {
    setSelectedBank(bank);
    setBankSearch("");
    setShowBankList(false);
    // Reset verification
    setAccountName("");
    setVerifyError("");
    handleStoreChange({ target: { name: "bank_name",    value: bank.name } });
    handleStoreChange({ target: { name: "bank_code",    value: bank.code } });
    handleStoreChange({ target: { name: "account_name", value: ""        } });
    // Re-verify immediately if number already entered
    if (accountNumber.length === 10) {
      verifyAccount(accountNumber, bank.code);
    }
  }, [accountNumber, handleStoreChange, verifyAccount]);

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const canSubmit = !!accountName && !loading && !verifying;

  return (
    <div className="seller-card">

      {/* Header */}
      <div style={s.cardHeader}>
        <h2 style={s.cardTitle}>🏪 Store Setup</h2>
        <p style={s.cardSubtitle}>
          Tell us about your store — this is what buyers will see.
        </p>
      </div>

      <div style={s.form}>

        {/* ── Store Name ─────────────────────────────────── */}
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
            maxLength={100}
            className={`seller-input ${errors.store_name ? "error" : ""}`}
          />
          <span style={s.charCount}>
            {storeData.store_name.length}/100
          </span>
        </Field>

        {/* ── Category ───────────────────────────────────── */}
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

        {/* ── Description ────────────────────────────────── */}
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
            placeholder="Describe your store, what you sell, and what makes you unique..."
            rows={4}
            className={`seller-textarea ${
              errors.store_description ? "error" : ""
            }`}
          />
        </Field>

        {/* ── Store Logo ─────────────────────────────────── */}
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

        {/* ── Store Banner ───────────────────────────────── */}
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
              All payouts will be sent to this account
            </p>
            <span style={s.bankNote}>
              ℹ️ CBN-licensed commercial banks only
            </span>
          </div>

          {/* Bank selector */}
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
                    ? "Loading banks…"
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
                        const isSel = selectedBank?.code === bank.code;
                        return (
                          <button
                            key={`${bank.code}-${bank.name}`}
                            type="button"
                            style={{
                              ...s.bankOption,
                              background: isSel ? "#eef2ff" : "white",
                              color:      isSel ? "#6366f1" : "#374151",
                              fontWeight: isSel ? 700 : 400,
                            }}
                            onClick={() => handleBankSelect(bank)}
                          >
                            <span>{bank.name}</span>
                            {isSel && (
                              <span style={{ marginLeft: "auto" }}>
                                ✓
                              </span>
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

          {/* Account number */}
          <Field
            label="Account Number"
            icon="🔢"
            required
            error={errors.bank_account}
            hint={
              !selectedBank
                ? "Select a bank first"
                : accountNumber.length < 10
                  ? `${accountNumber.length}/10 digits entered`
                  : undefined
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
                  // Clear verified state when user types new number
                  if (val !== accountNumber) {
                    setAccountName("");
                    setVerifyError("");
                    handleStoreChange({
                      target: { name: "account_name", value: "" }
                    });
                  }
                }}
                placeholder={
                  selectedBank ? "e.g. 0123456789" : "Select a bank first"
                }
                className={`seller-input ${
                  verifyError
                    ? "error"
                    : accountName
                      ? "success"
                      : ""
                }`}
                style={{
                  paddingRight: "3.5rem",
                  opacity:      selectedBank ? 1 : 0.5,
                  borderColor:  accountName
                    ? "#10b981"
                    : verifyError
                      ? "#ef4444"
                      : undefined,
                  fontFamily:   "monospace",
                  fontSize:     "1rem",
                  letterSpacing:"0.08em",
                }}
              />

              {/* Status icon */}
              <span style={s.acctIcon}>
                {verifying && <Spinner size={16} />}
                {!verifying && accountName && (
                  <span style={{
                    color: "#10b981", fontSize: "1.2rem",
                  }}>
                    ✓
                  </span>
                )}
                {!verifying && verifyError && (
                  <span style={{
                    color: "#ef4444", fontSize: "1.2rem",
                  }}>
                    ✗
                  </span>
                )}
              </span>
            </div>

            {/* Digit progress dots */}
            <div style={s.digitRow}>
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...s.digitDot,
                    background:
                      i < accountNumber.length
                        ? accountName
                          ? "#10b981"
                          : verifyError
                            ? "#ef4444"
                            : "#6366f1"
                        : "#e5e7eb",
                  }}
                />
              ))}
              <span style={s.digitLabel}>
                {accountNumber.length}/10
              </span>
            </div>
          </Field>

          {/* Verifying spinner */}
          {verifying && (
            <div style={s.verifyingBox}>
              <Spinner size={16} />
              <span>
                Verifying with {selectedBank?.name}…
              </span>
            </div>
          )}

          {/* Verify error */}
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

          {/* Verified account name */}
          {accountName && !verifying && (
            <div style={s.accountNameBox}>
              <span style={{ fontSize: "1.75rem" }}>✅</span>
              <div style={{ flex: 1 }}>
                <p style={s.accountNameLabel}>Verified Account</p>
                <p style={s.accountNameValue}>{accountName}</p>
                <p style={s.accountNameBank}>
                  {selectedBank?.name}
                </p>
              </div>
              <span style={s.verifiedBadge}>Verified</span>
            </div>
          )}
        </div>

        {/* Server messages */}
        {serverErr && (
          <div className="seller-alert error">
            ⚠️ {serverErr}
          </div>
        )}
        {serverMsg && !serverErr && (
          <div className="seller-alert success">
            ✅ {serverMsg}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={submitStore}
          disabled={!canSubmit}
          className="btn-seller-primary"
          style={{ opacity: canSubmit ? 1 : 0.6 }}
        >
          {loading ? (
            <><Spinner size={18} white /> Saving Store…</>
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

// ─────────────────────────────────────────────────────────────
// FIELD WRAPPER
// ─────────────────────────────────────────────────────────────
function Field({ label, icon, required, error, hint, children }) {
  return (
    <div className="seller-field">
      <label className="seller-label">
        {icon && `${icon} `}{label}
        {required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>
      {children}
      {hint && !error && (
        <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error">⚠️ {error}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SPINNER
// ─────────────────────────────────────────────────────────────
function Spinner({ size = 20, white = false }) {
  return (
    <span style={{
      width:         size,
      height:        size,
      border:        `2px solid ${
        white ? "rgba(255,255,255,0.3)" : "#e5e7eb"
      }`,
      borderTop:     `2px solid ${white ? "white" : "#6366f1"}`,
      borderRadius:  "50%",
      display:       "inline-block",
      animation:     "spin 0.7s linear infinite",
      verticalAlign: "middle",
      flexShrink:    0,
    }} />
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const s = {
  cardHeader: { marginBottom: "2rem" },
  cardTitle: {
    fontSize:  "1.5rem",
    fontWeight:800,
    color:     "#1f2937",
    margin:    0,
  },
  cardSubtitle: {
    color:    "#6b7280",
    fontSize: "0.95rem",
    margin:   "0.35rem 0 0",
  },
  form: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1.5rem",
  },
  charCount: {
    color:      "#9ca3af",
    fontSize:   "0.8rem",
    marginTop:  "0.25rem",
    display:    "block",
    textAlign:  "right",
  },
  fileOk: {
    color:     "#10b981",
    marginTop: "0.5rem",
    fontSize:  "0.85rem",
  },
  logoRow: {
    display:    "flex",
    gap:        "1.5rem",
    alignItems: "center",
  },
  logoPlaceholder: {
    width:          "80px",
    height:         "80px",
    borderRadius:   "50%",
    background:     "linear-gradient(135deg,#6366f1,#8b5cf6)",
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
  bankTitle: {
    fontSize:  "1.05rem",
    fontWeight:700,
    color:     "#1f2937",
    margin:    0,
  },
  bankSubtitle: {
    color:    "#9ca3af",
    fontSize: "0.85rem",
    margin:   "0.25rem 0 0",
  },
  bankNote: {
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
    fontFamily:     "inherit",
  },
  chevron: {
    color:     "#9ca3af",
    fontSize:  "0.75rem",
    flexShrink:0,
  },
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
  bankSearchInput: {
    width:        "100%",
    padding:      "0.6rem 0.875rem",
    border:       "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize:     "0.9rem",
    outline:      "none",
    boxSizing:    "border-box",
    fontFamily:   "inherit",
  },
  bankList: { maxHeight: "240px", overflowY: "auto" },
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
    fontFamily: "inherit",
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
    transition:   "background 0.2s ease",
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
    fontFamily:   "inherit",
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