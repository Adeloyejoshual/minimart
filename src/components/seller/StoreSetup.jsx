import React from "react";
import { WITHDRAWAL_METHODS, STORE_CATEGORIES } from "../../hooks/useSellerFlow";

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

  return (
    <div className="seller-card">
      {/* Title */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1f2937" }}>
          🏪 Store Setup
        </h2>
        <p style={{ color: "#6b7280", marginTop: "0.35rem" }}>
          Tell us about your store — this is what buyers will see.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── Store Name ─────────────────────── */}
        <div className="seller-field">
          <label className="seller-label">
            🏷️ Store Name <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            name="store_name"
            value={storeData.store_name}
            onChange={handleStoreChange}
            placeholder="e.g. TechHub Electronics"
            className={`seller-input ${errors.store_name ? "error" : ""}`}
          />
          {errors.store_name && (
            <span className="field-error">⚠️ {errors.store_name}</span>
          )}
          <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
            {storeData.store_name.length}/100 characters
          </span>
        </div>

        {/* ── Store Category ──────────────────── */}
        <div className="seller-field">
          <label className="seller-label">
            📂 Store Category <span style={{ color: "#ef4444" }}>*</span>
          </label>
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
          {errors.store_category && (
            <span className="field-error">⚠️ {errors.store_category}</span>
          )}
        </div>

        {/* ── Description ────────────────────── */}
        <div className="seller-field">
          <label className="seller-label">
            📝 Store Description <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            name="store_description"
            value={storeData.store_description}
            onChange={handleStoreChange}
            placeholder="Describe what your store sells, your specialties, shipping policy..."
            className={`seller-textarea ${errors.store_description ? "error" : ""}`}
          />
          {errors.store_description && (
            <span className="field-error">⚠️ {errors.store_description}</span>
          )}
        </div>

        {/* ── Store Logo ──────────────────────── */}
        <div className="seller-field">
          <label className="seller-label">🖼️ Store Logo</label>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            {previewLogo && (
              <img
                src={previewLogo}
                alt="Logo preview"
                className="logo-preview-circle"
              />
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
              <p className="upload-sub">PNG, JPG up to 2MB</p>
            </div>
          </div>
        </div>

        {/* ── Store Banner ─────────────────────── */}
        <div className="seller-field">
          <label className="seller-label">🖼️ Store Banner</label>
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
              <p style={{ color: "#10b981", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                ✅ {storeData.store_banner.name}
              </p>
            )}
          </div>
        </div>

        {/* ── Withdrawal Method ───────────────── */}
        <div className="seller-field">
          <label className="seller-label">
            💳 Withdrawal Method <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div className="method-cards">
            {WITHDRAWAL_METHODS.map((m) => (
              <div
                key={m.value}
                className={`method-card ${
                  storeData.withdrawal_method === m.value ? "selected" : ""
                }`}
                onClick={() =>
                  handleStoreChange({
                    target: { name: "withdrawal_method", value: m.value },
                  })
                }
              >
                <span className="check">✓</span>
                <div className="method-icon">{m.icon}</div>
                <div className="method-label">{m.label}</div>
              </div>
            ))}
          </div>
          {errors.withdrawal_method && (
            <span className="field-error">⚠️ {errors.withdrawal_method}</span>
          )}
        </div>

        {/* ── Method-Specific Fields ──────────── */}
        {storeData.withdrawal_method === "bank_transfer" && (
          <div className="seller-field">
            <label className="seller-label">🏦 Bank Account Number</label>
            <input
              name="bank_account"
              value={storeData.bank_account}
              onChange={handleStoreChange}
              placeholder="IBAN or account number"
              className={`seller-input ${errors.bank_account ? "error" : ""}`}
            />
            {errors.bank_account && (
              <span className="field-error">⚠️ {errors.bank_account}</span>
            )}
          </div>
        )}

        {storeData.withdrawal_method === "paypal" && (
          <div className="seller-field">
            <label className="seller-label">💰 PayPal Email</label>
            <input
              name="paypal_email"
              type="email"
              value={storeData.paypal_email}
              onChange={handleStoreChange}
              placeholder="your@paypal.com"
              className={`seller-input ${errors.paypal_email ? "error" : ""}`}
            />
            {errors.paypal_email && (
              <span className="field-error">⚠️ {errors.paypal_email}</span>
            )}
          </div>
        )}

        {storeData.withdrawal_method === "crypto" && (
          <div className="seller-field">
            <label className="seller-label">₿ Crypto Wallet Address</label>
            <input
              name="crypto_wallet"
              value={storeData.crypto_wallet}
              onChange={handleStoreChange}
              placeholder="0x... or bc1..."
              className={`seller-input ${errors.crypto_wallet ? "error" : ""}`}
            />
            {errors.crypto_wallet && (
              <span className="field-error">⚠️ {errors.crypto_wallet}</span>
            )}
          </div>
        )}

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
          disabled={loading}
          className="btn-seller-primary"
        >
          {loading ? (
            <>
              <span className="spinner" />
              Saving Store...
            </>
          ) : (
            <>Continue to Verification →</>
          )}
        </button>
      </div>
    </div>
  );
};

export default StoreSetup;