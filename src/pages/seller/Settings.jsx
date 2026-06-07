// pages/seller/Settings.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { sellerApi, SELLER_TOKEN_KEY } from "./SellerDashboard";
import { useDashboard } from "./SellerDashboard";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const Field = ({ label, hint, error, required, children }) => (
  <div>
    <label style={fm.label}>
      {label}
      {required && <span style={{ color: "#ef4444" }}> *</span>}
    </label>
    {children}
    {hint && <p style={fm.hint}>{hint}</p>}
    {error && <p style={fm.error}>⚠️ {error}</p>}
  </div>
);

const Alert = ({ msg }) => {
  if (!msg?.text) return null;
  const ok = msg.type === "success";
  return (
    <div style={{
      padding:      "0.8rem 1rem",
      borderRadius: "12px",
      background:   ok ? "#ecfdf5" : "#fef2f2",
      color:        ok ? "#065f46" : "#991b1b",
      border:       `1px solid ${ok ? "#a7f3d0" : "#fecaca"}`,
      fontSize:     "0.85rem",
      fontWeight:   500,
      display:      "flex",
      alignItems:   "flex-start",
      gap:          "0.5rem",
      lineHeight:   1.5,
      animation:    "sdFadeIn 0.15s ease",
    }}>
      <span style={{ flexShrink: 0 }}>{ok ? "✅" : "⚠️"}</span>
      <span>{msg.text}</span>
    </div>
  );
};

const Spin = ({ size = 18, color = "white" }) => (
  <span style={{
    width:        size,
    height:       size,
    border:       `2px solid ${color}44`,
    borderTop:    `2px solid ${color}`,
    borderRadius: "50%",
    display:      "inline-block",
    animation:    "spin 0.7s linear infinite",
    flexShrink:   0,
  }} />
);

const SaveBtn = ({
  saving, label, onClick, disabled,
  icon = "💾", danger = false, fullWidth = false,
}) => (
  <button
    onClick={onClick}
    disabled={saving || disabled}
    style={{
      padding:      "0.875rem 1.75rem",
      background:   danger
        ? "#ef4444"
        : disabled
          ? "#9ca3af"
          : "linear-gradient(135deg,#6366f1,#8b5cf6)",
      color:        "white",
      border:       "none",
      borderRadius: "12px",
      fontWeight:   700,
      cursor:       saving || disabled ? "not-allowed" : "pointer",
      fontSize:     "0.9rem",
      opacity:      saving || disabled ? 0.6 : 1,
      transition:   "all 0.2s",
      fontFamily:   "inherit",
      display:      "flex",
      alignItems:   "center",
      justifyContent: "center",
      gap:          "0.5rem",
      width:        fullWidth ? "100%" : "auto",
      maxWidth:     fullWidth ? "100%" : "340px",
    }}
  >
    {saving ? <><Spin size={16} /> Saving…</> : `${icon} ${label}`}
  </button>
);

// ─────────────────────────────────────────────────────────────
// UNSAVED CHANGES HOOK
// ─────────────────────────────────────────────────────────────
const useUnsavedWarning = (isDirty) => {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
};

// Deep compare two objects (shallow level)
const hasChanged = (original, current) => {
  for (const key of Object.keys(current)) {
    if (String(original[key] ?? "") !== String(current[key] ?? "")) {
      return true;
    }
  }
  return false;
};

// ─────────────────────────────────────────────────────────────
// NIGERIAN COMMERCIAL BANKS (no MFBs)
// ─────────────────────────────────────────────────────────────
const BANKS = [
  { name: "Access Bank",                code: "044" },
  { name: "Citibank Nigeria",           code: "023" },
  { name: "Ecobank Nigeria",            code: "050" },
  { name: "Fidelity Bank",              code: "070" },
  { name: "First Bank of Nigeria",      code: "011" },
  { name: "First City Monument Bank",   code: "214" },
  { name: "Globus Bank",                code: "00103" },
  { name: "Guaranty Trust Bank",        code: "058" },
  { name: "Heritage Bank",              code: "030" },
  { name: "Keystone Bank",              code: "082" },
  { name: "Polaris Bank",               code: "076" },
  { name: "Providus Bank",              code: "101" },
  { name: "Stanbic IBTC Bank",          code: "221" },
  { name: "Standard Chartered",         code: "068" },
  { name: "Sterling Bank",              code: "232" },
  { name: "SunTrust Bank",              code: "100" },
  { name: "Titan Trust Bank",           code: "102" },
  { name: "Union Bank of Nigeria",      code: "032" },
  { name: "United Bank for Africa",     code: "033" },
  { name: "Unity Bank",                 code: "215" },
  { name: "Wema Bank",                  code: "035" },
  { name: "Zenith Bank",                code: "057" },
];

// ─────────────────────────────────────────────────────────────
// PASSWORD VALIDATION UTIL
// ─────────────────────────────────────────────────────────────
const validatePassword = (pw) => {
  const checks = {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number:    /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "#ef4444", "#f59e0b", "#3b82f6", "#10b981"];
  const strong = score === 4;
  return { checks, score, label: labels[score], color: colors[score], strong };
};

// ═════════════════════════════════════════════════════════════
// TAB: Store Information
// PUT /api/seller/settings/store
// ═════════════════════════════════════════════════════════════
const StoreInfoTab = () => {
  const { vendor, setVendor } = useDashboard();

  const original = useRef({
    store_name:        vendor?.store_name        ?? "",
    store_description: vendor?.store_description ?? "",
    store_category:    vendor?.store_category    ?? "",
    phone:             vendor?.phone             ?? "",
    store_address:     vendor?.store_address     ?? "",
  });

  const [form, setForm] = useState({ ...original.current });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState(null);
  const [errors, setErrors] = useState({});

  const isDirty = hasChanged(original.current, form);
  useUnsavedWarning(isDirty);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: "" }));
    setMsg(null);
  };

  const validate = () => {
    const e = {};
    if (!form.store_name.trim()) e.store_name = "Store name is required";
    if (form.store_name.length > 60) e.store_name = "Max 60 characters";
    if (form.store_description.length > 500)
      e.store_description = "Max 500 characters";
    if (form.phone && !/^[+\d\s\-]{7,15}$/.test(form.phone))
      e.phone = "Enter a valid phone number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) return;

    setSaving(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.put(
        "/api/seller/settings/store", form
      );
      if (data.success) {
        setMsg({ type: "success", text: "Store info saved!" });
        if (data.vendor) setVendor(data.vendor);
        original.current = { ...form };
      } else {
        setMsg({ type: "error", text: data.message });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Save failed. Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const CATS = [
    "Fashion & Clothing", "Electronics & Gadgets",
    "Food & Beverages",   "Health & Beauty",
    "Home & Living",      "Sports & Fitness",
    "Books & Stationery", "Agriculture & Farming",
    "Baby & Kids",        "Automotive",
    "Phones & Tablets",   "Computing",
    "Gaming",             "Other",
  ];

  return (
    <div style={tb.body}>
      <div style={tb.sectionHeader}>
        <h3 style={tb.sectionTitle}>🏪 Store Information</h3>
        <p style={tb.sectionSub}>
          Visible on your public store page
        </p>
      </div>

      <Field label="Store Name" required error={errors.store_name}>
        <input
          value={form.store_name}
          onChange={set("store_name")}
          placeholder="Your store name"
          maxLength={60}
          style={{
            ...fm.input,
            borderColor: errors.store_name ? "#ef4444" : "#e5e7eb",
          }}
        />
        <p style={{
          textAlign: "right", fontSize: "0.68rem",
          color: form.store_name.length > 50 ? "#f59e0b" : "#d1d5db",
          margin: "0.2rem 0 0",
        }}>
          {form.store_name.length}/60
        </p>
      </Field>

      <Field label="Category">
        <select
          value={form.store_category}
          onChange={set("store_category")}
          style={fm.select}
        >
          <option value="">Select your store category</option>
          {CATS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      <Field
        label="Store Description"
        hint="What do you sell? Why should customers buy from you?"
        error={errors.store_description}
      >
        <textarea
          value={form.store_description}
          onChange={set("store_description")}
          rows={4}
          placeholder="We sell premium quality products at affordable prices..."
          maxLength={500}
          style={{
            ...fm.textarea,
            borderColor: errors.store_description ? "#ef4444" : "#e5e7eb",
          }}
        />
        <p style={{
          textAlign: "right", fontSize: "0.68rem",
          color: form.store_description.length > 450 ? "#f59e0b" : "#d1d5db",
          margin: "0.2rem 0 0",
        }}>
          {form.store_description.length}/500
        </p>
      </Field>

      <div style={tb.responsiveGrid}>
        <Field label="Phone Number" hint="For inquiries"
          error={errors.phone}>
          <input
            value={form.phone}
            onChange={(e) => {
              const v = e.target.value
                .replace(/[^0-9+\-\s]/g, "")
                .slice(0, 15);
              setForm((f) => ({ ...f, phone: v }));
              setErrors((er) => ({ ...er, phone: "" }));
              setMsg(null);
            }}
            placeholder="+234 800 000 0000"
            type="tel"
            inputMode="tel"
            style={{
              ...fm.input,
              borderColor: errors.phone ? "#ef4444" : "#e5e7eb",
            }}
          />
        </Field>
        <Field label="Store Location" hint="City / area you operate in">
          <input
            value={form.store_address}
            onChange={set("store_address")}
            placeholder="e.g. Lagos, Ikeja"
            maxLength={100}
            style={fm.input}
          />
        </Field>
      </div>

      <Alert msg={msg} />

      <div style={{ display: "flex", alignItems: "center",
        gap: "0.75rem", flexWrap: "wrap" }}>
        <SaveBtn
          saving={saving}
          disabled={!isDirty}
          label="Save Store Info"
          onClick={handleSave}
        />
        {isDirty && (
          <span style={{ fontSize: "0.78rem", color: "#f59e0b",
            fontWeight: 500 }}>
            ● Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// TAB: Bank Details
// POST /api/seller/payout/resolve-account → verify
// POST /api/seller/settings/bank          → save (with pw)
// ═════════════════════════════════════════════════════════════
const BankTab = () => {
  const { vendor } = useDashboard();

  // Pre-fill from vendor if available
  const [form, setForm] = useState({
    bank_name:      vendor?.bank_name      ?? "",
    bank_code:      vendor?.bank_code      ?? "",
    account_number: vendor?.bank_account
                    ?? vendor?.account_number ?? "",
    account_name:   vendor?.account_name   ?? "",
  });
  const [password,   setPassword]   = useState("");
  const [verifying,  setVerifying]  = useState(false);
  const [verified,   setVerified]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState(null);
  const [showPw,     setShowPw]     = useState(false);
  const [step,       setStep]       = useState(
    vendor?.bank_name ? "view" : "edit"
  );
  // "view"   → show current bank, "Change" button
  // "edit"   → form to change bank

  const resetForm = () => {
    setForm({
      bank_name: "", bank_code: "",
      account_number: "", account_name: "",
    });
    setPassword("");
    setVerified(false);
    setMsg(null);
    setShowPw(false);
  };

  const handleBankChange = (e) => {
    const selected = BANKS.find((b) => b.code === e.target.value);
    setForm((f) => ({
      ...f,
      bank_name:    selected?.name ?? "",
      bank_code:    selected?.code ?? "",
      account_name: "",
    }));
    setVerified(false);
    setPassword("");
    setMsg(null);
  };

  const handleAcctChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm((f) => ({
      ...f,
      account_number: v,
      account_name:   "",
    }));
    setVerified(false);
    setPassword("");
    setMsg(null);
  };

  // POST /api/seller/payout/resolve-account
  const handleVerify = async () => {
    if (verifying) return;
    if (form.account_number.length !== 10) {
      setMsg({ type: "error",
        text: "Account number must be exactly 10 digits" });
      return;
    }
    if (!form.bank_name) {
      setMsg({ type: "error", text: "Please select a bank first" });
      return;
    }

    setVerifying(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.post(
        "/api/seller/payout/resolve-account",
        {
          account_number: form.account_number,
          bank_name:      form.bank_name,
        }
      );
      if (data.success && data.account_name) {
        setForm((f) => ({
          ...f,
          account_name: data.account_name,
          bank_code:    data.bank_code ?? f.bank_code,
        }));
        setVerified(true);
        setMsg({ type: "success",
          text: `Account verified: ${data.account_name}` });
      } else {
        setMsg({ type: "error",
          text: data.message ?? "Could not verify this account" });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message
          ?? "Verification failed. Please try again.",
      });
    } finally {
      setVerifying(false);
    }
  };

  // POST /api/seller/settings/bank
  const handleSave = async () => {
    if (saving) return;
    if (!verified) {
      setMsg({ type: "error",
        text: "Please verify your account first" });
      return;
    }
    if (!password.trim()) {
      setMsg({ type: "error",
        text: "Enter your password to confirm this change" });
      return;
    }

    // Confirm dialog
    const ok = window.confirm(
      `Save this as your withdrawal account?\n\n`
      + `${form.account_name}\n`
      + `${form.account_number} — ${form.bank_name}\n\n`
      + `All future payouts will go to this account.`
    );
    if (!ok) return;

    setSaving(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.post(
        "/api/seller/settings/bank",
        {
          bank_name:      form.bank_name,
          bank_code:      form.bank_code,
          account_number: form.account_number,
          account_name:   form.account_name,
          password,
        }
      );
      if (data.success) {
        setMsg({ type: "success", text: "Bank details updated!" });
        setPassword("");
        setStep("view");
        // Vendor data will refresh on next dashboard load
      } else {
        setMsg({ type: "error", text: data.message });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Save failed",
      });
    } finally {
      setSaving(false);
    }
  };

  const canVerify = form.account_number.length === 10
    && form.bank_code
    && !verifying;

  // ── VIEW MODE ─────────────────────────────────────────
  if (step === "view" && vendor?.bank_name) {
    return (
      <div style={tb.body}>
        <div style={tb.sectionHeader}>
          <h3 style={tb.sectionTitle}>🏦 Bank Details</h3>
          <p style={tb.sectionSub}>
            Your withdrawal payout account
          </p>
        </div>

        <div style={tb.currentBank}>
          <div style={tb.bankIconWrap}>
            <span style={{ fontSize: "1.5rem" }}>🏦</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={tb.currentBankName}>
              {vendor.account_name}
            </p>
            <p style={tb.currentBankAcct}>
              {(vendor.bank_account ?? vendor.account_number ?? "")
                .replace(/(.{4})/g, "$1 ").trim()}
            </p>
            <p style={tb.currentBankSub}>
              {vendor.bank_name}
            </p>
          </div>
          <span style={{
            background:   "#ecfdf5",
            color:        "#065f46",
            padding:      "0.2rem 0.6rem",
            borderRadius: "100px",
            fontSize:     "0.72rem",
            fontWeight:   700,
            flexShrink:   0,
          }}>
            ✓ Active
          </span>
        </div>

        <Alert msg={msg} />

        <button
          onClick={() => { resetForm(); setStep("edit"); }}
          style={tb.changeBtn}
        >
          🔄 Change Bank Details
        </button>

        <p style={{
          color: "#9ca3af", fontSize: "0.75rem",
          margin: 0, lineHeight: 1.5,
        }}>
          🔒 For security, you'll need to enter your password
          when changing bank details.
        </p>
      </div>
    );
  }

  // ── EDIT MODE ─────────────────────────────────────────
  return (
    <div style={tb.body}>
      <div style={tb.sectionHeader}>
        <h3 style={tb.sectionTitle}>🏦 Bank Details</h3>
        <p style={tb.sectionSub}>
          {vendor?.bank_name
            ? "Update your withdrawal account"
            : "Set up your payout bank account"}
        </p>
      </div>

      {/* Security notice */}
      <div style={tb.securityNotice}>
        <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>🔒</span>
        <p style={{ margin: 0, fontSize: "0.82rem",
          color: "#92400e", lineHeight: 1.5 }}>
          For security, your password is required to save
          bank detail changes. All withdrawals will go to the
          account you configure here.
        </p>
      </div>

      {/* Back button if editing existing */}
      {vendor?.bank_name && (
        <button
          onClick={() => { resetForm(); setStep("view"); }}
          style={tb.backBtn}
        >
          ← Back to current bank
        </button>
      )}

      {/* Step 1: Select bank */}
      <Field label="Bank" required>
        <select
          value={form.bank_code}
          onChange={handleBankChange}
          style={fm.select}
        >
          <option value="">— Choose your bank —</option>
          {BANKS.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Step 2: Account number + verify */}
      <Field
        label="Account Number"
        required
        hint={`${form.account_number.length}/10 digits`}
      >
        <div style={tb.verifyRow}>
          <input
            value={form.account_number}
            onChange={handleAcctChange}
            placeholder="0123456789"
            inputMode="numeric"
            maxLength={10}
            style={{
              ...fm.input,
              flex: 1,
              fontFamily: "monospace",
              fontSize: "1rem",
              letterSpacing: "0.1em",
              borderColor: verified
                ? "#a7f3d0"
                : form.account_number.length === 10
                  ? "#6366f1" : "#e5e7eb",
            }}
          />
          <button
            onClick={handleVerify}
            disabled={!canVerify}
            style={{
              ...tb.verifyBtn,
              background:  verified ? "#ecfdf5"
                : verifying ? "#f3f4f6" : "#eff6ff",
              color:       verified ? "#065f46" : "#1e40af",
              borderColor: verified ? "#a7f3d0" : "#bfdbfe",
              opacity:     !canVerify ? 0.45 : 1,
            }}
          >
            {verifying
              ? <><Spin size={14} color="#6366f1" /> Verifying</>
              : verified
                ? "✓ Verified"
                : "Verify"
            }
          </button>
        </div>
      </Field>

      {/* Step 3: Verified name display */}
      {form.account_name && (
        <div style={tb.verifiedBox}>
          <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>✅</span>
          <div>
            <p style={{ fontWeight: 700, color: "#065f46",
              margin: 0, fontSize: "0.95rem" }}>
              {form.account_name}
            </p>
            <p style={{ color: "#059669", fontSize: "0.78rem",
              margin: "0.15rem 0 0" }}>
              {form.account_number} · {form.bank_name}
            </p>
          </div>
        </div>
      )}

      {/* Step 4: Password confirmation (only after verify) */}
      {verified && (
        <>
          <div style={tb.passwordSection}>
            <p style={{
              fontWeight: 700, color: "#374151",
              margin: "0 0 0.5rem", fontSize: "0.9rem",
            }}>
              🔐 Confirm with your password
            </p>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setMsg(null);
                }}
                placeholder="Enter your seller account password"
                autoComplete="current-password"
                style={{
                  ...fm.input,
                  paddingRight: "3rem",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={fm.eyeBtn}
                tabIndex={-1}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
        </>
      )}

      <Alert msg={msg} />

      <SaveBtn
        saving={saving}
        disabled={!verified || !password.trim()}
        label="Save Bank Details"
        icon="🏦"
        onClick={handleSave}
        fullWidth
      />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// TAB: Security
// POST /api/seller/settings/change-password
// POST /api/seller/settings/deactivate
// ═════════════════════════════════════════════════════════════
const SecurityTab = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    current_password: "",
    new_password:     "",
    confirm_password: "",
  });
  const [saving,       setSaving]       = useState(false);
  const [showPw,       setShowPw]       = useState(false);
  const [msg,          setMsg]          = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactPw,      setDeactPw]      = useState("");
  const [showDeact,    setShowDeact]    = useState(false);
  const [deactMsg,     setDeactMsg]     = useState(null);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };

  const pw = form.new_password;
  const strength = validatePassword(pw);

  const pwMatch = form.confirm_password.length > 0
    && form.confirm_password === pw;
  const pwMismatch = form.confirm_password.length > 0
    && form.confirm_password !== pw;

  const handleChangePassword = async () => {
    if (saving) return;

    if (!form.current_password) {
      setMsg({ type: "error", text: "Enter your current password" });
      return;
    }
    if (!strength.strong) {
      setMsg({ type: "error",
        text: "Password must be at least 8 characters with uppercase, number, and symbol" });
      return;
    }
    if (pw !== form.confirm_password) {
      setMsg({ type: "error", text: "Passwords don't match" });
      return;
    }
    if (form.current_password === pw) {
      setMsg({ type: "error",
        text: "New password must be different from current" });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.post(
        "/api/seller/settings/change-password",
        {
          current_password: form.current_password,
          new_password:     pw,
        }
      );
      if (data.success) {
        setMsg({ type: "success",
          text: "Password changed! Use your new password next time." });
        setForm({
          current_password: "",
          new_password:     "",
          confirm_password: "",
        });
      } else {
        setMsg({ type: "error", text: data.message });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Failed to change password",
      });
    } finally {
      setSaving(false);
    }
  };

  // POST /api/seller/settings/deactivate (with password)
  const handleDeactivate = async () => {
    if (deactivating) return;
    if (!deactPw.trim()) {
      setDeactMsg({ type: "error",
        text: "Enter your password to confirm" });
      return;
    }

    const ok = window.confirm(
      "FINAL WARNING\n\n"
      + "Deactivating will:\n"
      + "• Hide all your products immediately\n"
      + "• Stop all incoming orders\n"
      + "• You'll need to contact support to reactivate\n\n"
      + "Are you absolutely sure?"
    );
    if (!ok) return;

    setDeactivating(true);
    setDeactMsg(null);
    try {
      const { data } = await sellerApi.post(
        "/api/seller/settings/deactivate",
        { password: deactPw }
      );
      if (data.success) {
        localStorage.removeItem(SELLER_TOKEN_KEY);
        navigate("/become-seller", { replace: true });
      } else {
        setDeactMsg({ type: "error", text: data.message });
      }
    } catch (err) {
      setDeactMsg({
        type: "error",
        text: err.response?.data?.message ?? "Deactivation failed",
      });
    } finally {
      setDeactivating(false);
    }
  };

  const pwType = showPw ? "text" : "password";

  // Password requirement checks display
  const PasswordChecks = () => {
    if (!pw) return null;
    const items = [
      { ok: strength.checks.length,    text: "At least 8 characters" },
      { ok: strength.checks.uppercase, text: "One uppercase letter (A-Z)" },
      { ok: strength.checks.number,    text: "One number (0-9)" },
      { ok: strength.checks.special,   text: "One special character (!@#$)" },
    ];
    return (
      <div style={{ marginTop: "0.5rem", display: "flex",
        flexDirection: "column", gap: "0.2rem" }}>
        {items.map(({ ok, text }) => (
          <div key={text} style={{
            display:  "flex",
            alignItems:"center",
            gap:      "0.4rem",
            fontSize: "0.72rem",
            color:    ok ? "#10b981" : "#9ca3af",
          }}>
            <span>{ok ? "✓" : "○"}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={tb.body}>
      <div style={tb.sectionHeader}>
        <h3 style={tb.sectionTitle}>🔒 Password & Security</h3>
        <p style={tb.sectionSub}>
          Keep your seller account secure
        </p>
      </div>

      {/* Current password */}
      <Field label="Current Password" required>
        <div style={{ position: "relative" }}>
          <input
            type={pwType}
            value={form.current_password}
            onChange={set("current_password")}
            placeholder="Your current password"
            autoComplete="current-password"
            style={{ ...fm.input, paddingRight: "3rem" }}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            style={fm.eyeBtn}
            tabIndex={-1}
          >
            {showPw ? "🙈" : "👁️"}
          </button>
        </div>
      </Field>

      {/* New password */}
      <Field label="New Password" required>
        <input
          type={pwType}
          value={pw}
          onChange={set("new_password")}
          placeholder="Min. 8 characters with uppercase, number, symbol"
          autoComplete="new-password"
          style={fm.input}
        />

        {/* Strength bar */}
        {pw && (
          <>
            <div style={{
              display: "flex", gap: "3px", marginTop: "0.5rem",
            }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  flex:         1,
                  height:       "4px",
                  borderRadius: "100px",
                  background:   i <= strength.score
                    ? strength.color : "#e5e7eb",
                  transition:   "background 0.2s",
                }} />
              ))}
            </div>
            <div style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "flex-start",
              marginTop:      "0.3rem",
            }}>
              <span style={{
                fontSize:  "0.72rem",
                color:     strength.color,
                fontWeight:600,
              }}>
                {strength.label}
              </span>
            </div>
            <PasswordChecks />
          </>
        )}
      </Field>

      {/* Confirm */}
      <Field label="Confirm New Password" required>
        <input
          type={pwType}
          value={form.confirm_password}
          onChange={set("confirm_password")}
          placeholder="Repeat new password"
          autoComplete="new-password"
          style={{
            ...fm.input,
            borderColor: form.confirm_password
              ? (pwMatch ? "#a7f3d0" : "#fecaca")
              : "#e5e7eb",
          }}
        />
        {pwMismatch && (
          <p style={fm.error}>Passwords don't match</p>
        )}
        {pwMatch && (
          <p style={{
            color: "#10b981", fontSize: "0.72rem",
            margin: "0.25rem 0 0", fontWeight: 600,
          }}>
            ✓ Passwords match
          </p>
        )}
      </Field>

      <Alert msg={msg} />

      <SaveBtn
        saving={saving}
        label="Change Password"
        icon="🔒"
        onClick={handleChangePassword}
        disabled={!strength.strong || !pwMatch}
        fullWidth
      />

      {/* ── Danger Zone ─────────────────────────────── */}
      <div style={tb.divider} />

      <div style={tb.dangerZone}>
        <div style={tb.dangerHeader}>
          <span style={{ fontSize: "1.2rem" }}>⚠️</span>
          <div>
            <p style={tb.dangerTitle}>Danger Zone</p>
            <p style={tb.dangerSub}>
              Deactivating hides all products and stops new orders.
              Contact support to reactivate.
            </p>
          </div>
        </div>

        {!showDeact ? (
          <button
            onClick={() => setShowDeact(true)}
            style={tb.dangerBtn}
          >
            Deactivate Seller Account
          </button>
        ) : (
          <div style={tb.deactForm}>
            <Field label="Enter Password to Confirm" required>
              <input
                type="password"
                value={deactPw}
                onChange={(e) => {
                  setDeactPw(e.target.value);
                  setDeactMsg(null);
                }}
                placeholder="Your account password"
                autoComplete="current-password"
                style={fm.input}
              />
            </Field>

            <Alert msg={deactMsg} />

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => {
                  setShowDeact(false);
                  setDeactPw("");
                  setDeactMsg(null);
                }}
                style={tb.deactCancelBtn}
              >
                Cancel
              </button>
              <SaveBtn
                saving={deactivating}
                label="Deactivate Account"
                icon="⚠️"
                onClick={handleDeactivate}
                danger
                disabled={!deactPw.trim()}
                fullWidth
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// TABS CONFIG — no shipping (admin delivers)
// ═════════════════════════════════════════════════════════════
const TABS = [
  { key: "store",    icon: "🏪", label: "Store Info"   },
  { key: "bank",     icon: "🏦", label: "Bank Details" },
  { key: "security", icon: "🔒", label: "Security"     },
];

// ═════════════════════════════════════════════════════════════
// MAIN SETTINGS PAGE — Fully mobile responsive
// ═════════════════════════════════════════════════════════════
export default function Settings() {
  const { vendor }  = useDashboard();
  const navigate    = useNavigate();
  const [activeTab, setActiveTab] = useState("store");
  const [isMobile,  setIsMobile]  = useState(
    typeof window !== "undefined" ? window.innerWidth < 769 : false
  );

  // Responsive listener
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const TAB_CONTENT = {
    store:    <StoreInfoTab />,
    bank:     <BankTab />,
    security: <SecurityTab />,
  };

  const handleSignOut = () => {
    if (!window.confirm(
      "Sign out of your seller dashboard?\n\n"
      + "You'll need to log in again to manage your store."
    )) return;
    localStorage.removeItem(SELLER_TOKEN_KEY);
    navigate("/become-seller", { replace: true });
  };

  return (
    <div style={pg.root}>

      {/* Header */}
      <div style={pg.headerRow}>
        <div>
          <h2 style={pg.pageTitle}>⚙️ Settings</h2>
          <p style={pg.pageSub}>
            Manage your store, bank & security
          </p>
        </div>
        {!isMobile && (
          <button onClick={handleSignOut} style={pg.signOutBtn}>
            ↩ Sign Out
          </button>
        )}
      </div>

      {/* ── Mobile: horizontal tab pills ─────────────── */}
      {isMobile && (
        <div style={pg.mobileTabRow}>
          {TABS.map(({ key, icon, label }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  ...pg.mobileTab,
                  background:  active ? "#6366f1" : "white",
                  color:       active ? "white"   : "#6b7280",
                  borderColor: active ? "#6366f1" : "#e5e7eb",
                  fontWeight:  active ? 700 : 500,
                  boxShadow:   active
                    ? "0 2px 8px rgba(99,102,241,0.25)" : "none",
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
          <button
            onClick={handleSignOut}
            style={{
              ...pg.mobileTab,
              background:  "#fef2f2",
              color:       "#ef4444",
              borderColor: "#fecaca",
              fontWeight:  600,
            }}
          >
            <span>↩</span>
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* ── Layout ────────────────────────────────────── */}
      <div style={{
        ...pg.layout,
        gridTemplateColumns: isMobile ? "1fr" : "200px 1fr",
      }}>

        {/* Desktop: sidebar tabs */}
        {!isMobile && (
          <div style={pg.tabSidebar}>
            {TABS.map(({ key, icon, label }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    ...pg.tabBtn,
                    background:  active ? "#eef2ff" : "transparent",
                    color:       active ? "#6366f1" : "#374151",
                    borderColor: active ? "#c7d2fe" : "transparent",
                    fontWeight:  active ? 700 : 500,
                  }}
                >
                  <span style={{ fontSize: "1.05rem" }}>{icon}</span>
                  <span style={{ flex: 1, textAlign: "left" }}>
                    {label}
                  </span>
                  {active && (
                    <span style={{ color: "#6366f1",
                      fontSize: "0.9rem" }}>›</span>
                  )}
                </button>
              );
            })}
            <div style={pg.sidebarDivider} />
            <button
              onClick={handleSignOut}
              style={pg.sidebarSignOut}
            >
              <span>↩</span>
              <span>Sign Out</span>
            </button>
          </div>
        )}

        {/* Content panel */}
        <div style={pg.tabPanel}>
          <div
            key={activeTab}
            style={{ animation: "sdFadeIn 0.15s ease" }}
          >
            {TAB_CONTENT[activeTab]}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FORM STYLES
// ─────────────────────────────────────────────────────────────
const fm = {
  label: {
    display:      "block",
    fontSize:     "0.82rem",
    fontWeight:   600,
    color:        "#374151",
    marginBottom: "0.4rem",
  },
  input: {
    width:        "100%",
    padding:      "0.75rem 0.875rem",
    border:       "1.5px solid #e5e7eb",
    borderRadius: "10px",
    fontSize:     "0.9rem",
    color:        "#374151",
    boxSizing:    "border-box",
    background:   "white",
    fontFamily:   "inherit",
    transition:   "border-color 0.15s, box-shadow 0.15s",
  },
  select: {
    width:        "100%",
    padding:      "0.75rem 0.875rem",
    border:       "1.5px solid #e5e7eb",
    borderRadius: "10px",
    fontSize:     "0.9rem",
    color:        "#374151",
    boxSizing:    "border-box",
    background:   "white",
    fontFamily:   "inherit",
    cursor:       "pointer",
    appearance:   "auto",
  },
  textarea: {
    width:        "100%",
    padding:      "0.75rem 0.875rem",
    border:       "1.5px solid #e5e7eb",
    borderRadius: "10px",
    fontSize:     "0.9rem",
    color:        "#374151",
    boxSizing:    "border-box",
    background:   "white",
    fontFamily:   "inherit",
    resize:       "vertical",
    minHeight:    "100px",
    lineHeight:   1.5,
  },
  hint: {
    color:    "#9ca3af",
    fontSize: "0.72rem",
    margin:   "0.3rem 0 0",
  },
  error: {
    color:      "#ef4444",
    fontSize:   "0.75rem",
    margin:     "0.3rem 0 0",
    fontWeight: 500,
  },
  eyeBtn: {
    position:   "absolute",
    right:      "0.75rem",
    top:        "50%",
    transform:  "translateY(-50%)",
    background: "none",
    border:     "none",
    cursor:     "pointer",
    fontSize:   "1rem",
    padding:    "0.25rem",
    lineHeight: 1,
    color:      "#9ca3af",
  },
};

// ─────────────────────────────────────────────────────────────
// TAB BODY STYLES
// ─────────────────────────────────────────────────────────────
const tb = {
  body: {
    padding:       "1.5rem",
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  sectionHeader:  { marginBottom: "0.1rem" },
  sectionTitle: {
    fontWeight: 800,
    color:      "#1f2937",
    margin:     "0 0 0.2rem",
    fontSize:   "1.1rem",
  },
  sectionSub: {
    color:    "#9ca3af",
    fontSize: "0.82rem",
    margin:   0,
  },
  responsiveGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap:                 "1rem",
  },
  currentBank: {
    background:   "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
    border:       "1.5px solid #a7f3d0",
    borderRadius: "16px",
    padding:      "1.1rem 1.25rem",
    display:      "flex",
    alignItems:   "center",
    gap:          "0.875rem",
    flexWrap:     "wrap",
  },
  bankIconWrap: {
    width:          "48px",
    height:         "48px",
    background:     "white",
    borderRadius:   "12px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    border:         "1px solid #a7f3d0",
    flexShrink:     0,
  },
  currentBankName: {
    fontWeight: 700,
    color:      "#065f46",
    margin:     0,
    fontSize:   "1rem",
  },
  currentBankAcct: {
    fontWeight:    700,
    color:         "#059669",
    margin:        "0.2rem 0",
    fontSize:      "0.9rem",
    fontFamily:    "monospace",
    letterSpacing: "0.05em",
  },
  currentBankSub: {
    color:    "#059669",
    fontSize: "0.8rem",
    margin:   0,
  },
  changeBtn: {
    padding:      "0.75rem 1.25rem",
    background:   "white",
    border:       "1.5px solid #e5e7eb",
    borderRadius: "12px",
    color:        "#374151",
    fontWeight:   600,
    cursor:       "pointer",
    fontSize:     "0.875rem",
    fontFamily:   "inherit",
    transition:   "all 0.15s",
    textAlign:    "center",
  },
  backBtn: {
    padding:      "0.5rem 0",
    background:   "none",
    border:       "none",
    color:        "#6366f1",
    cursor:       "pointer",
    fontSize:     "0.85rem",
    fontWeight:   600,
    fontFamily:   "inherit",
    textAlign:    "left",
    paddingLeft:  0,
  },
  securityNotice: {
    display:      "flex",
    alignItems:   "flex-start",
    gap:          "0.6rem",
    background:   "#fffbeb",
    border:       "1px solid #fde68a",
    borderRadius: "12px",
    padding:      "0.875rem 1rem",
  },
  verifyRow: {
    display: "flex",
    gap:     "0.5rem",
  },
  verifyBtn: {
    padding:      "0.75rem 1.1rem",
    border:       "1.5px solid",
    borderRadius: "10px",
    fontWeight:   700,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    fontSize:     "0.82rem",
    fontFamily:   "inherit",
    transition:   "all 0.15s",
    flexShrink:   0,
    display:      "flex",
    alignItems:   "center",
    gap:          "0.4rem",
  },
  verifiedBox: {
    display:      "flex",
    alignItems:   "center",
    gap:          "0.75rem",
    padding:      "1rem",
    background:   "#f0fdf4",
    border:       "1.5px solid #a7f3d0",
    borderRadius: "12px",
  },
  passwordSection: {
    background:   "#f8fafc",
    border:       "1.5px solid #e5e7eb",
    borderRadius: "12px",
    padding:      "1.1rem",
  },
  divider: {
    height:     "1px",
    background: "#f3f4f6",
    margin:     "0.5rem 0",
  },
  dangerZone: {
    background:   "#fef2f2",
    border:       "1.5px solid #fecaca",
    borderRadius: "14px",
    padding:      "1.25rem",
  },
  dangerHeader: {
    display:      "flex",
    alignItems:   "flex-start",
    gap:          "0.75rem",
    marginBottom: "1rem",
  },
  dangerTitle: {
    fontWeight: 700,
    color:      "#991b1b",
    margin:     "0 0 0.15rem",
    fontSize:   "0.95rem",
  },
  dangerSub: {
    color:     "#b91c1c",
    fontSize:  "0.8rem",
    margin:    0,
    lineHeight:1.4,
  },
  dangerBtn: {
    padding:      "0.75rem",
    background:   "white",
    border:       "1.5px solid #fecaca",
    borderRadius: "10px",
    color:        "#ef4444",
    fontWeight:   700,
    cursor:       "pointer",
    fontSize:     "0.875rem",
    fontFamily:   "inherit",
    width:        "100%",
    transition:   "all 0.15s",
    textAlign:    "center",
  },
  deactForm: {
    display:       "flex",
    flexDirection: "column",
    gap:           "0.875rem",
  },
  deactCancelBtn: {
    padding:      "0.75rem 1.25rem",
    background:   "white",
    border:       "1.5px solid #e5e7eb",
    borderRadius: "10px",
    color:        "#374151",
    fontWeight:   600,
    cursor:       "pointer",
    fontSize:     "0.875rem",
    fontFamily:   "inherit",
    whiteSpace:   "nowrap",
  },
};

// ─────────────────────────────────────────────────────────────
// PAGE LAYOUT STYLES
// ─────────────────────────────────────────────────────────────
const pg = {
  root: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
  },
  headerRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "flex-start",
    flexWrap:       "wrap",
    gap:            "0.75rem",
  },
  pageTitle: {
    fontWeight: 800,
    fontSize:   "1.35rem",
    color:      "#1f2937",
    margin:     0,
  },
  pageSub: {
    color:    "#9ca3af",
    fontSize: "0.85rem",
    margin:   "0.2rem 0 0",
  },
  signOutBtn: {
    padding:      "0.6rem 1.25rem",
    background:   "#fef2f2",
    border:       "1.5px solid #fecaca",
    borderRadius: "10px",
    color:        "#ef4444",
    fontWeight:   600,
    cursor:       "pointer",
    fontSize:     "0.85rem",
    fontFamily:   "inherit",
    whiteSpace:   "nowrap",
    transition:   "all 0.15s",
  },
  mobileTabRow: {
    display:       "flex",
    gap:           "0.4rem",
    overflowX:     "auto",
    paddingBottom: "0.35rem",
    WebkitOverflowScrolling: "touch",
    msOverflowStyle:         "none",
    scrollbarWidth:          "none",
  },
  mobileTab: {
    display:      "flex",
    alignItems:   "center",
    gap:          "0.4rem",
    padding:      "0.55rem 1rem",
    borderRadius: "100px",
    border:       "1.5px solid",
    cursor:       "pointer",
    fontSize:     "0.82rem",
    whiteSpace:   "nowrap",
    fontFamily:   "inherit",
    flexShrink:   0,
    transition:   "all 0.15s",
  },
  layout: {
    display:    "grid",
    gap:        "1.25rem",
    alignItems: "start",
  },
  tabSidebar: {
    display:       "flex",
    flexDirection: "column",
    gap:           "0.3rem",
    background:    "white",
    borderRadius:  "16px",
    padding:       "0.75rem",
    border:        "1px solid #f3f4f6",
    position:      "sticky",
    top:           "72px",
    boxShadow:     "0 1px 4px rgba(0,0,0,0.04)",
  },
  tabBtn: {
    display:      "flex",
    alignItems:   "center",
    gap:          "0.6rem",
    padding:      "0.75rem 0.875rem",
    borderRadius: "10px",
    border:       "1.5px solid",
    cursor:       "pointer",
    fontSize:     "0.875rem",
    transition:   "all 0.15s",
    width:        "100%",
    fontFamily:   "inherit",
  },
  sidebarDivider: {
    height:     "1px",
    background: "#f3f4f6",
    margin:     "0.35rem 0",
  },
  sidebarSignOut: {
    display:      "flex",
    alignItems:   "center",
    gap:          "0.6rem",
    padding:      "0.75rem 0.875rem",
    borderRadius: "10px",
    border:       "none",
    cursor:       "pointer",
    fontSize:     "0.875rem",
    fontFamily:   "inherit",
    background:   "#fef2f2",
    color:        "#ef4444",
    fontWeight:   600,
    width:        "100%",
    transition:   "all 0.15s",
  },
  tabPanel: {
    background:   "white",
    borderRadius: "16px",
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
    minHeight:    "300px",
  },
};