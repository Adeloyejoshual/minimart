// pages/seller/Settings.jsx
import React, { useState, useCallback } from "react";
import { sellerApi } from "./SellerDashboard";
import { useDashboard } from "./SellerDashboard";

// ── Shared field component ─────────────────────────────────────
const Field = ({ label, hint, error, children }) => (
  <div>
    <label style={fm.label}>{label}</label>
    {children}
    {hint && (
      <p style={{ color:"#9ca3af", fontSize:"0.72rem",
        margin:"0.25rem 0 0" }}>
        {hint}
      </p>
    )}
    {error && (
      <p style={{ color:"#ef4444", fontSize:"0.72rem",
        margin:"0.25rem 0 0" }}>
        {error}
      </p>
    )}
  </div>
);

// ── Inline alert ───────────────────────────────────────────────
const Alert = ({ msg }) => {
  if (!msg?.text) return null;
  const ok = msg.type === "success";
  return (
    <div style={{
      padding:      "0.75rem 1rem",
      borderRadius: "10px",
      background:   ok ? "#ecfdf5" : "#fef2f2",
      color:        ok ? "#065f46" : "#991b1b",
      border:       `1px solid ${ok ? "#a7f3d0" : "#fecaca"}`,
      fontSize:     "0.875rem",
      fontWeight:   500,
      display:      "flex",
      alignItems:   "center",
      gap:          "0.5rem",
    }}>
      {ok ? "✅" : "⚠️"} {msg.text}
    </div>
  );
};

// ── Save button ────────────────────────────────────────────────
const SaveBtn = ({ saving, label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={saving || disabled}
    style={{
      padding:      "0.875rem 2rem",
      background:   "linear-gradient(135deg,#6366f1,#8b5cf6)",
      color:        "white",
      border:       "none",
      borderRadius: "12px",
      fontWeight:   700,
      cursor:       saving || disabled ? "not-allowed" : "pointer",
      fontSize:     "0.9rem",
      alignSelf:    "flex-start",
      opacity:      saving || disabled ? 0.6 : 1,
      transition:   "opacity 0.15s",
      fontFamily:   "inherit",
    }}
  >
    {saving ? "Saving…" : label}
  </button>
);

// ═════════════════════════════════════════════════════════════
// TAB: Store Info
// PUT /api/seller/settings/store
// ═════════════════════════════════════════════════════════════
const StoreInfoTab = () => {
  const { vendor, setVendor } = useDashboard();

  const [form, setForm] = useState({
    store_name:        vendor?.store_name        ?? "",
    store_description: vendor?.store_description ?? "",
    store_category:    vendor?.store_category    ?? "",
    phone:             vendor?.phone             ?? "",
    store_address:     vendor?.store_address     ?? "",
    return_policy:     vendor?.return_policy     ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState(null);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };

  const handleSave = async () => {
    if (!form.store_name.trim()) {
      setMsg({ type:"error", text:"Store name is required" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.put(
        "/api/seller/settings/store", form
      );
      if (data.success) {
        setMsg({ type:"success", text:"Store info updated!" });
        if (data.vendor) setVendor(data.vendor);
      } else {
        setMsg({ type:"error", text: data.message });
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

  const CATS = [
    "Fashion","Electronics","Food & Beverages",
    "Health & Beauty","Home & Living","Sports",
    "Books & Media","Agriculture","Services","Other",
  ];

  return (
    <div style={tb.body}>
      <div style={tb.sectionHeader}>
        <h3 style={tb.sectionTitle}>Store Information</h3>
        <p style={tb.sectionSub}>
          This info appears on your public store page
        </p>
      </div>

      <Field label="Store Name *">
        <input
          value={form.store_name}
          onChange={set("store_name")}
          placeholder="Your store name"
          style={fm.input}
        />
      </Field>

      <Field label="Category">
        <select
          value={form.store_category}
          onChange={set("store_category")}
          style={{ ...fm.input, cursor:"pointer" }}
        >
          <option value="">Select category</option>
          {CATS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      <Field
        label="Description"
        hint="Tell buyers what makes your store unique"
      >
        <textarea
          value={form.store_description}
          onChange={set("store_description")}
          rows={4}
          placeholder="We sell high-quality…"
          style={{ ...fm.input, resize:"vertical",
            minHeight:"100px" }}
        />
      </Field>

      <div style={tb.twoCol}>
        <Field label="Phone Number">
          <input
            value={form.phone}
            onChange={set("phone")}
            placeholder="+234 800 000 0000"
            style={fm.input}
          />
        </Field>
        <Field label="Store Address">
          <input
            value={form.store_address}
            onChange={set("store_address")}
            placeholder="Lagos, Nigeria"
            style={fm.input}
          />
        </Field>
      </div>

      <Field
        label="Return Policy"
        hint="Displayed on your product pages"
      >
        <textarea
          value={form.return_policy}
          onChange={set("return_policy")}
          rows={3}
          placeholder="We accept returns within 7 days…"
          style={{ ...fm.input, resize:"vertical" }}
        />
      </Field>

      <Alert msg={msg} />
      <SaveBtn
        saving={saving}
        label="💾 Save Store Info"
        onClick={handleSave}
      />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// TAB: Bank Details
// POST /api/seller/payout/resolve-account
// PUT  /api/seller/settings/bank
// ═════════════════════════════════════════════════════════════
const BankTab = () => {
  const { vendor } = useDashboard();

  const [form, setForm] = useState({
    bank_name:      vendor?.bank_name      ?? "",
    account_number: vendor?.bank_account   ?? vendor?.account_number ?? "",
    account_name:   vendor?.account_name   ?? "",
    bank_code:      vendor?.bank_code      ?? "",
  });
  const [verifying, setVerifying] = useState(false);
  const [verified,  setVerified]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState(null);

  // GET /api/seller/payout/banks
  // Uses the static list from your route
  const BANKS = [
    { name:"Access Bank",       code:"044" },
    { name:"GTBank",            code:"058" },
    { name:"Zenith Bank",       code:"057" },
    { name:"First Bank",        code:"011" },
    { name:"UBA",               code:"033" },
    { name:"Kuda MFB",          code:"090267" },
    { name:"OPay",              code:"100004" },
    { name:"Palmpay",           code:"100033" },
    { name:"Stanbic IBTC",      code:"221" },
    { name:"Sterling Bank",     code:"232" },
    { name:"Ecobank",           code:"050" },
    { name:"Fidelity Bank",     code:"070" },
    { name:"Union Bank",        code:"032" },
    { name:"Wema Bank",         code:"035" },
    { name:"Polaris Bank",      code:"076" },
    { name:"FCMB",              code:"214" },
    { name:"Heritage Bank",     code:"030" },
    { name:"Keystone Bank",     code:"082" },
    { name:"Providus Bank",     code:"101" },
    { name:"Titan Trust Bank",  code:"102" },
    { name:"Moniepoint MFB",    code:"090405" },
  ];

  const handleBankChange = (e) => {
    const bank = BANKS.find((b) => b.name === e.target.value);
    setForm((f) => ({
      ...f,
      bank_name:    bank?.name ?? "",
      bank_code:    bank?.code ?? "",
      account_name: "",
    }));
    setVerified(false);
    setMsg(null);
  };

  // POST /api/seller/payout/resolve-account
  const handleVerify = async () => {
    if (!form.account_number || form.account_number.length !== 10) {
      setMsg({ type:"error",
        text:"Account number must be 10 digits" });
      return;
    }
    if (!form.bank_name) {
      setMsg({ type:"error", text:"Please select a bank first" });
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
      if (data.success) {
        setForm((f) => ({
          ...f,
          account_name: data.account_name,
          bank_code:    data.bank_code,
        }));
        setVerified(true);
        setMsg({ type:"success",
          text:`Verified: ${data.account_name}` });
      } else {
        setMsg({ type:"error", text: data.message });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message
          ?? "Verification failed. Try again.",
      });
    } finally {
      setVerifying(false);
    }
  };

  // PUT /api/seller/settings/bank
  const handleSave = async () => {
    if (!verified) {
      setMsg({ type:"error",
        text:"Please verify your account first" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.put(
        "/api/seller/settings/bank", form
      );
      if (data.success) {
        setMsg({ type:"success",
          text:"Bank details saved!" });
      } else {
        setMsg({ type:"error", text: data.message });
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

  return (
    <div style={tb.body}>
      <div style={tb.sectionHeader}>
        <h3 style={tb.sectionTitle}>Bank Details</h3>
        <p style={tb.sectionSub}>
          Withdrawals will be sent to this account
        </p>
      </div>

      {/* Current bank */}
      {vendor?.bank_name && (
        <div style={{
          background:   "#f0fdf4",
          border:       "1px solid #a7f3d0",
          borderRadius: "12px",
          padding:      "1rem",
          display:      "flex",
          alignItems:   "center",
          gap:          "0.75rem",
        }}>
          <span style={{ fontSize:"1.5rem" }}>✅</span>
          <div>
            <p style={{ fontWeight:700, color:"#065f46",
              margin:0, fontSize:"0.95rem" }}>
              {vendor.account_name}
            </p>
            <p style={{ color:"#059669", fontSize:"0.8rem",
              margin:"0.1rem 0 0" }}>
              {vendor.bank_account ?? vendor.account_number} ·{" "}
              {vendor.bank_name}
            </p>
          </div>
        </div>
      )}

      {/* Bank select */}
      <Field label="Bank *">
        <select
          value={form.bank_name}
          onChange={handleBankChange}
          style={{ ...fm.input, cursor:"pointer" }}
        >
          <option value="">— Select your bank —</option>
          {BANKS.map((b) => (
            <option key={b.code} value={b.name}>{b.name}</option>
          ))}
        </select>
      </Field>

      {/* Account number + verify */}
      <Field label="Account Number *"
        hint="Must be exactly 10 digits">
        <div style={{ display:"flex", gap:"0.5rem" }}>
          <input
            value={form.account_number}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 10);
              setForm((f) => ({
                ...f, account_number: v, account_name: "",
              }));
              setVerified(false);
              setMsg(null);
            }}
            placeholder="0123456789"
            maxLength={10}
            style={{ ...fm.input, flex:1,
              borderColor: verified ? "#a7f3d0" : "#e5e7eb" }}
          />
          <button
            onClick={handleVerify}
            disabled={verifying
              || form.account_number.length !== 10
              || !form.bank_name}
            style={{
              padding:      "0 1.25rem",
              background:   verified ? "#ecfdf5" : "#eff6ff",
              border:       `1px solid ${
                verified ? "#a7f3d0" : "#bfdbfe"
              }`,
              borderRadius: "10px",
              color:        verified ? "#065f46" : "#1e40af",
              fontWeight:   700,
              cursor:       "pointer",
              whiteSpace:   "nowrap",
              fontSize:     "0.85rem",
              fontFamily:   "inherit",
              opacity:      verifying
                || form.account_number.length !== 10
                || !form.bank_name ? 0.5 : 1,
            }}
          >
            {verifying ? "…" : verified ? "✓ Verified" : "Verify"}
          </button>
        </div>
      </Field>

      {/* Account name (auto-filled) */}
      {form.account_name && (
        <Field label="Account Name">
          <input
            value={form.account_name}
            readOnly
            style={{ ...fm.input, background:"#f8fafc",
              color:"#10b981", fontWeight:700 }}
          />
        </Field>
      )}

      <Alert msg={msg} />

      <SaveBtn
        saving={saving}
        disabled={!verified}
        label="🏦 Save Bank Details"
        onClick={handleSave}
      />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// TAB: Shipping
// PUT /api/seller/settings/shipping
// ═════════════════════════════════════════════════════════════
const ShippingTab = () => {
  const { vendor } = useDashboard();

  const [form, setForm] = useState({
    free_shipping_threshold: vendor?.free_shipping_threshold ?? "",
    default_shipping_fee:    vendor?.default_shipping_fee    ?? "",
    processing_time:         vendor?.processing_time         ?? "1-2 days",
    ships_to:                vendor?.ships_to                ?? "Nigeria",
  });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState(null);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.put(
        "/api/seller/settings/shipping", form
      );
      setMsg({
        type: data.success ? "success" : "error",
        text: data.message
          ?? (data.success ? "Saved!" : "Failed"),
      });
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Failed",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={tb.body}>
      <div style={tb.sectionHeader}>
        <h3 style={tb.sectionTitle}>Shipping Settings</h3>
        <p style={tb.sectionSub}>
          Control delivery options for your store
        </p>
      </div>

      <div style={tb.twoCol}>
        <Field
          label="Default Shipping Fee (₦)"
          hint="Applied to all orders unless overridden"
        >
          <input
            type="number"
            value={form.default_shipping_fee}
            onChange={set("default_shipping_fee")}
            placeholder="0"
            min="0"
            style={fm.input}
          />
        </Field>
        <Field
          label="Free Shipping Threshold (₦)"
          hint="Orders above this get free shipping"
        >
          <input
            type="number"
            value={form.free_shipping_threshold}
            onChange={set("free_shipping_threshold")}
            placeholder="5000"
            min="0"
            style={fm.input}
          />
        </Field>
      </div>

      <div style={tb.twoCol}>
        <Field label="Processing Time">
          <select
            value={form.processing_time}
            onChange={set("processing_time")}
            style={{ ...fm.input, cursor:"pointer" }}
          >
            {[
              "Same day","1-2 days","2-3 days",
              "3-5 days","1 week","2 weeks",
            ].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Ships To">
          <select
            value={form.ships_to}
            onChange={set("ships_to")}
            style={{ ...fm.input, cursor:"pointer" }}
          >
            {[
              "Nigeria","Lagos Only","South West",
              "South East","North","Nationwide",
            ].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>

      <Alert msg={msg} />
      <SaveBtn
        saving={saving}
        label="🚚 Save Shipping"
        onClick={handleSave}
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
  const [form, setForm] = useState({
    current_password: "",
    new_password:     "",
    confirm_password: "",
  });
  const [saving,      setSaving]      = useState(false);
  const [showPw,      setShowPw]      = useState(false);
  const [msg,         setMsg]         = useState(null);
  const [deactivating,setDeactivating]= useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };

  // Password strength
  const strength = (() => {
    const p = form.new_password;
    if (!p) return { score:0, label:"", color:"#e5e7eb" };
    let s = 0;
    if (p.length >= 8)           s++;
    if (/[A-Z]/.test(p))         s++;
    if (/[0-9]/.test(p))         s++;
    if (/[^A-Za-z0-9]/.test(p))  s++;
    const labels = ["","Weak","Fair","Good","Strong"];
    const colors = ["","#ef4444","#f59e0b","#3b82f6","#10b981"];
    return { score:s, label:labels[s], color:colors[s] };
  })();

  const handleSave = async () => {
    if (!form.current_password) {
      setMsg({ type:"error", text:"Enter your current password" });
      return;
    }
    if (form.new_password.length < 8) {
      setMsg({ type:"error",
        text:"New password must be at least 8 characters" });
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setMsg({ type:"error", text:"Passwords don't match" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await sellerApi.post(
        "/api/seller/settings/change-password",
        {
          current_password: form.current_password,
          new_password:     form.new_password,
        }
      );
      if (data.success) {
        setMsg({ type:"success", text:"Password changed!" });
        setForm({
          current_password: "",
          new_password:     "",
          confirm_password: "",
        });
      } else {
        setMsg({ type:"error", text: data.message });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err.response?.data?.message ?? "Failed",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(
      "Deactivate your seller account?\n\n"
      + "All your products will be hidden. "
      + "Contact support to reactivate."
    )) return;
    setDeactivating(true);
    try {
      await sellerApi.post(
        "/api/seller/settings/deactivate", {}
      );
      localStorage.removeItem("seller_token");
      window.location.href = "/become-seller";
    } catch (err) {
      alert(
        err.response?.data?.message ?? "Deactivation failed"
      );
      setDeactivating(false);
    }
  };

  const pwType = showPw ? "text" : "password";

  return (
    <div style={tb.body}>
      <div style={tb.sectionHeader}>
        <h3 style={tb.sectionTitle}>Security</h3>
        <p style={tb.sectionSub}>
          Manage your password and account access
        </p>
      </div>

      {/* Current password */}
      <Field label="Current Password">
        <div style={{ position:"relative" }}>
          <input
            type={pwType}
            value={form.current_password}
            onChange={set("current_password")}
            placeholder="Your current password"
            style={fm.input}
          />
          <button
            onClick={() => setShowPw((v) => !v)}
            style={fm.eyeBtn}
          >
            {showPw ? "🙈" : "👁️"}
          </button>
        </div>
      </Field>

      {/* New password */}
      <Field label="New Password">
        <div style={{ position:"relative" }}>
          <input
            type={pwType}
            value={form.new_password}
            onChange={set("new_password")}
            placeholder="Min. 8 characters"
            style={fm.input}
          />
          <button
            onClick={() => setShowPw((v) => !v)}
            style={fm.eyeBtn}
          >
            {showPw ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Strength meter */}
        {form.new_password && (
          <div style={{ marginTop:"0.5rem" }}>
            <div style={{ display:"flex", gap:"3px" }}>
              {[1,2,3,4].map((i) => (
                <div key={i} style={{
                  flex:         1,
                  height:       "3px",
                  borderRadius: "100px",
                  background:   i <= strength.score
                    ? strength.color : "#e5e7eb",
                  transition:   "background 0.2s",
                }} />
              ))}
            </div>
            {strength.label && (
              <p style={{ fontSize:"0.7rem", margin:"0.2rem 0 0",
                color:strength.color, fontWeight:600 }}>
                {strength.label}
              </p>
            )}
          </div>
        )}
      </Field>

      {/* Confirm password */}
      <Field label="Confirm New Password">
        <input
          type={pwType}
          value={form.confirm_password}
          onChange={set("confirm_password")}
          placeholder="Repeat new password"
          style={{
            ...fm.input,
            borderColor: form.confirm_password
              && form.confirm_password !== form.new_password
                ? "#ef4444" : "#e5e7eb",
          }}
        />
        {form.confirm_password
          && form.confirm_password !== form.new_password && (
          <p style={{ color:"#ef4444", fontSize:"0.72rem",
            margin:"0.25rem 0 0" }}>
            Passwords don't match
          </p>
        )}
      </Field>

      <Alert msg={msg} />
      <SaveBtn
        saving={saving}
        label="🔒 Change Password"
        onClick={handleSave}
      />

      {/* Danger zone */}
      <div style={{
        background:   "#fef2f2",
        border:       "1px solid #fecaca",
        borderRadius: "14px",
        padding:      "1.25rem",
        marginTop:    "0.5rem",
      }}>
        <p style={{ fontWeight:700, color:"#991b1b",
          margin:"0 0 0.4rem", fontSize:"0.95rem" }}>
          ⚠️ Danger Zone
        </p>
        <p style={{ color:"#b91c1c", fontSize:"0.82rem",
          margin:"0 0 1rem", lineHeight:1.5 }}>
          Deactivating your store will hide all your products
          and stop new orders immediately.
          Contact support to reactivate.
        </p>
        <button
          onClick={handleDeactivate}
          disabled={deactivating}
          style={{
            padding:      "0.7rem 1.4rem",
            background:   "white",
            border:       "1px solid #fecaca",
            borderRadius: "10px",
            color:        "#ef4444",
            fontWeight:   700,
            cursor:       deactivating ? "not-allowed" : "pointer",
            fontSize:     "0.875rem",
            opacity:      deactivating ? 0.6 : 1,
            fontFamily:   "inherit",
          }}
        >
          {deactivating
            ? "Deactivating…"
            : "Deactivate Seller Account"}
        </button>
      </div>

    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// MAIN SETTINGS PAGE
// ═════════════════════════════════════════════════════════════
const TABS = [
  { key:"store",    icon:"🏪", label:"Store Info"   },
  { key:"bank",     icon:"🏦", label:"Bank Details" },
  { key:"shipping", icon:"🚚", label:"Shipping"     },
  { key:"security", icon:"🔒", label:"Security"     },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("store");

  const TAB_CONTENT = {
    store:    <StoreInfoTab />,
    bank:     <BankTab     />,
    shipping: <ShippingTab />,
    security: <SecurityTab />,
  };

  return (
    <div style={pg.root}>

      {/* Header */}
      <div>
        <h2 style={pg.pageTitle}>⚙️ Settings</h2>
        <p style={pg.pageSub}>
          Manage your store configuration
        </p>
      </div>

      <div style={pg.layout}>

        {/* Tab sidebar */}
        <div style={pg.tabSidebar}>
          {TABS.map(({ key, icon, label }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  ...pg.tabBtn,
                  background:  active ? "#eef2ff" : "white",
                  color:       active ? "#6366f1" : "#374151",
                  borderColor: active ? "#c7d2fe" : "#f3f4f6",
                  fontWeight:  active ? 700 : 500,
                }}
              >
                <span style={{ fontSize:"1.1rem" }}>{icon}</span>
                <span style={{ flex:1, textAlign:"left" }}>
                  {label}
                </span>
                {active && (
                  <span style={{ color:"#6366f1",
                    fontSize:"0.9rem" }}>›</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab panel */}
        <div style={pg.tabPanel}>
          <div key={activeTab}
            style={{ animation:"sdFadeIn 0.15s ease" }}>
            {TAB_CONTENT[activeTab]}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const fm = {
  label: {
    display:      "block",
    fontSize:     "0.8rem",
    fontWeight:   600,
    color:        "#374151",
    marginBottom: "0.35rem",
  },
  input: {
    width:        "100%",
    padding:      "0.7rem 0.875rem",
    border:       "1px solid #e5e7eb",
    borderRadius: "10px",
    fontSize:     "0.875rem",
    color:        "#374151",
    boxSizing:    "border-box",
    background:   "white",
    fontFamily:   "inherit",
    transition:   "border-color 0.15s",
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
    padding:    "0.2rem",
    lineHeight: 1,
  },
};

const tb = {
  body: {
    padding:       "1.75rem",
    display:       "flex",
    flexDirection: "column",
    gap:           "1.1rem",
  },
  sectionHeader: {
    marginBottom: "0.25rem",
  },
  sectionTitle: {
    fontWeight: 800,
    color:      "#1f2937",
    margin:     "0 0 0.2rem",
    fontSize:   "1.05rem",
  },
  sectionSub: {
    color:    "#9ca3af",
    fontSize: "0.82rem",
    margin:   0,
  },
  twoCol: {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 "1rem",
  },
};

const pg = {
  root: {
    display:       "flex",
    flexDirection: "column",
    gap:           "1.25rem",
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
  layout: {
    display:             "grid",
    gridTemplateColumns: "200px 1fr",
    gap:                 "1.25rem",
    alignItems:          "start",
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
    display:       "flex",
    alignItems:    "center",
    gap:           "0.6rem",
    padding:       "0.7rem 0.875rem",
    borderRadius:  "10px",
    border:        "1px solid",
    cursor:        "pointer",
    fontSize:      "0.875rem",
    transition:    "all 0.15s",
    width:         "100%",
    fontFamily:    "inherit",
  },
  tabPanel: {
    background:   "white",
    borderRadius: "16px",
    border:       "1px solid #f3f4f6",
    overflow:     "hidden",
    boxShadow:    "0 1px 4px rgba(0,0,0,0.04)",
  },
};