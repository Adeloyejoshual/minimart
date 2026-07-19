/**
 * src/pages/SettingsPage/components/AccountSection.jsx
 *
 * Account settings section:
 *   - Edit Profile → navigates to /profile/edit
 *   - Change Password → navigates to /settings/change-password
 *   - Email Address → inline edit modal
 *   - Phone Number → inline edit modal
 *   - Two-Factor Auth → disabled, coming soon
 *
 * All icons are transparent SVGs using design token colours.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import SettingsSection from "./SettingsSection.jsx";
import SettingsItem    from "./SettingsItem.jsx";
import "../styles/AccountSection.css";

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const KeyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778
             5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22
             7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <polyline points="22,7 12,13 2,7" />
  </svg>
);

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <line x1="18" y1="6"  x2="6"  y2="18" />
    <line x1="6"  y1="6"  x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   API
═══════════════════════════════════════════════════════════════ */
const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

/* ═══════════════════════════════════════════════════════════════
   INLINE EDIT SHEET — reusable for email + phone
═══════════════════════════════════════════════════════════════ */
function InlineEditSheet({
  title,
  fieldLabel,
  fieldType      = "text",
  placeholder,
  currentValue,
  currentDisplay,
  passwordRequired = true,
  hint,
  onClose,
  onSave,
}) {
  const [value,    setValue]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const inputRef   = useRef(null);
  const overlayRef = useRef(null);

  /* Focus input on mount */
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  /* Close on overlay click */
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  /* Submit */
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!value.trim()) {
      setError(`${fieldLabel} is required.`);
      return;
    }
    if (passwordRequired && !password) {
      setError("Password is required for this change.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await onSave(value.trim(), password);
      setSuccess(result?.message ?? "Updated successfully.");
      setValue("");
      setPassword("");

      /* Auto-close after showing success */
      setTimeout(() => onClose(), 1_800);
    } catch (err) {
      setError(err.message ?? "Update failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="account-edit-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="account-edit-sheet">

        {/* Header */}
        <div className="account-edit-sheet__header">
          <h3 className="account-edit-sheet__title">{title}</h3>
          <button
            type="button"
            className="account-edit-sheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Success */}
        {success && (
          <div className="account-edit-success" role="status">
            <CheckIcon />
            {success}
          </div>
        )}

        {/* Current value */}
        {currentDisplay && !success && (
          <div className="account-edit-current">
            <span className="account-edit-current__icon">
              <CheckIcon />
            </span>
            Current: <strong>{currentDisplay}</strong>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit}>

            {/* New value */}
            <div className="account-edit-field">
              <label
                className="account-edit-field__label"
                htmlFor="edit-new-value"
              >
                New {fieldLabel}
              </label>
              <input
                id="edit-new-value"
                ref={inputRef}
                type={fieldType}
                className="account-edit-field__input"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={loading}
                autoComplete={fieldType === "email" ? "email" : "tel"}
              />
              {hint && (
                <p className="account-edit-field__hint">{hint}</p>
              )}
            </div>

            {/* Password */}
            {passwordRequired && (
              <div className="account-edit-field">
                <label
                  className="account-edit-field__label"
                  htmlFor="edit-password"
                >
                  Current Password
                </label>
                <input
                  id="edit-password"
                  type="password"
                  className="account-edit-field__input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <p className="account-edit-field__hint">
                  Required to verify your identity
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="account-edit-field__error" role="alert">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="account-edit-actions">
              <button
                type="button"
                className="account-edit-btn account-edit-btn--cancel"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="account-edit-btn account-edit-btn--submit"
                disabled={loading || !value.trim()}
              >
                {loading ? (
                  <>
                    <span className="account-spinner" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MASK HELPERS
═══════════════════════════════════════════════════════════════ */
const maskEmail = (email) => {
  if (!email) return "Not set";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.length <= 2 ? user : user.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(0, user.length - 2))}@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone) return "Not set";
  if (phone.length <= 4) return phone;
  return `${"•".repeat(phone.length - 4)}${phone.slice(-4)}`;
};

/* ═══════════════════════════════════════════════════════════════
   ACCOUNT SECTION
═══════════════════════════════════════════════════════════════ */
export default function AccountSection({ settings }) {
  const { user, showToast } = settings;

  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);

  /* ── Save email ── */
  const handleSaveEmail = useCallback(async (newEmail, password) => {
    const token = getToken();
    if (!token) throw new Error("Not authenticated.");

    const res = await fetch(`${API_BASE}/settings/email`, {
      method  : "PATCH",
      headers : {
        "Content-Type" : "application/json",
        Authorization  : `Bearer ${token}`,
      },
      body: JSON.stringify({ email: newEmail, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Failed to update email.");

    /* Update user state in settings hook if available */
    if (showToast) showToast("success", data.message);

    return data;
  }, [showToast]);

  /* ── Save phone ── */
  const handleSavePhone = useCallback(async (newPhone, password) => {
    const token = getToken();
    if (!token) throw new Error("Not authenticated.");

    const res = await fetch(`${API_BASE}/settings/phone`, {
      method  : "PATCH",
      headers : {
        "Content-Type" : "application/json",
        Authorization  : `Bearer ${token}`,
      },
      body: JSON.stringify({ phone: newPhone, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Failed to update phone.");

    if (showToast) showToast("success", data.message);

    return data;
  }, [showToast]);

  return (
    <SettingsSection title="Account">
      <div className="account-section">

        {/* Edit Profile */}
        <SettingsItem
          icon={<UserIcon />}
          label="Edit Profile"
          sublabel={user?.name ?? "Update your name, bio and photo"}
          to="/profile/edit"
        />

        {/* Change Password */}
        <SettingsItem
          icon={<KeyIcon />}
          label="Change Password"
          to="/settings/change-password"
        />

        {/* Email Address */}
        <SettingsItem
          icon={<MailIcon />}
          label="Email Address"
          sublabel={maskEmail(user?.email)}
          onClick={() => setEditingEmail(true)}
        />

        {/* Phone Number */}
        <SettingsItem
          icon={<PhoneIcon />}
          label="Phone Number"
          sublabel={maskPhone(user?.phone)}
          onClick={() => setEditingPhone(true)}
        />

        {/* Two-Factor Authentication */}
        <SettingsItem
          icon={<ShieldIcon />}
          label="Two-Factor Authentication"
          badge="Coming Soon"
          disabled
          last
        />

      </div>

      {/* ── Email edit sheet ── */}
      {editingEmail && (
        <InlineEditSheet
          title="Change Email Address"
          fieldLabel="Email"
          fieldType="email"
          placeholder="new@example.com"
          currentValue={user?.email}
          currentDisplay={user?.email}
          passwordRequired
          hint="A verification link will be sent to your new address."
          onClose={() => setEditingEmail(false)}
          onSave={handleSaveEmail}
        />
      )}

      {/* ── Phone edit sheet ── */}
      {editingPhone && (
        <InlineEditSheet
          title="Change Phone Number"
          fieldLabel="Phone Number"
          fieldType="tel"
          placeholder="08012345678"
          currentValue={user?.phone}
          currentDisplay={maskPhone(user?.phone)}
          passwordRequired
          hint="Enter your number with country code or local format."
          onClose={() => setEditingPhone(false)}
          onSave={handleSavePhone}
        />
      )}

    </SettingsSection>
  );
}