// src/pages/Profile/components/AirtimeClaimModal.jsx
// ═══════════════════════════════════════════════════════════════
// AIRTIME CLAIM MODAL — Production-grade UX
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from "react";
import "../styles/AirtimeClaimModal.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  null;

const authH = () => ({
  Authorization : `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

/* ═══════════════════════════════════════════════════════════════
   PHONE HELPERS
═══════════════════════════════════════════════════════════════ */
const normalisePhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

const isValidPhone = (p) => /^0[789][01]\d{8}$/.test(p);

const detectNetwork = (phone) => {
  const prefix = normalisePhone(phone).slice(0, 4);
  const map = {
    "0703":"MTN","0704":"MTN","0706":"MTN","0803":"MTN","0806":"MTN",
    "0810":"MTN","0813":"MTN","0814":"MTN","0816":"MTN","0903":"MTN",
    "0906":"MTN","0913":"MTN","0916":"MTN",
    "0701":"Airtel","0708":"Airtel","0802":"Airtel","0808":"Airtel",
    "0812":"Airtel","0901":"Airtel","0902":"Airtel","0904":"Airtel",
    "0907":"Airtel","0912":"Airtel",
    "0705":"Glo","0805":"Glo","0807":"Glo","0811":"Glo",
    "0815":"Glo","0905":"Glo","0915":"Glo",
    "0809":"9mobile","0817":"9mobile","0818":"9mobile",
    "0908":"9mobile","0909":"9mobile",
  };
  return map[prefix] || null;
};

const maskPhone = (phone) => {
  if (!phone) return "";
  const d = normalisePhone(phone);
  return d.slice(0, 4) + "****" + d.slice(-3);
};

const naira = (n) => {
  const num = parseFloat(n);
  return isNaN(num) ? "₦0" : "₦" + num.toLocaleString("en-NG");
};

/* Format date "27 August 2026" */
const fmtDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric",
  });
};

const NETWORK_COLORS = {
  MTN     : { bg: "#fef9c3", color: "#854d0e", emoji: "🟡" },
  Airtel  : { bg: "#fee2e2", color: "#991b1b", emoji: "🔴" },
  Glo     : { bg: "#dcfce7", color: "#166534", emoji: "🟢" },
  "9mobile":{ bg: "#e0f2fe", color: "#075985", emoji: "🔵" },
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AirtimeClaimModal({
  isOpen,
  coupon,
  savedPhone = null,   // { phone, masked, network, in_cooldown, days_left, next_change_at }
  onClose,
  onSuccess,
}) {
  const [phone,         setPhone]         = useState("");
  const [network,       setNetwork]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [errorCode,     setErrorCode]     = useState(null);
  const [submitted,     setSubmitted]     = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [wasEdited,     setWasEdited]     = useState(false);
  const [checking,      setChecking]      = useState(false);
  const [phoneCheck,    setPhoneCheck]    = useState(null);
  const [showChangeBtn, setShowChangeBtn] = useState(false);

  const checkTimer = useRef(null);
  const inputRef   = useRef(null);

  /* ── Derived state ── */
  const hasSavedPhone   = !!savedPhone?.phone;
  const inCooldown      = savedPhone?.in_cooldown;
  const daysLeft        = savedPhone?.days_left ?? 0;
  const nextChangeDate  = savedPhone?.next_change_at
    ? fmtDate(savedPhone.next_change_at)
    : null;

  /* ══════════════════════════════════════════════
     RESET when modal opens
  ══════════════════════════════════════════════ */
  useEffect(() => {
    if (isOpen) {
      const p = normalisePhone(savedPhone?.phone || "");
      setPhone(p);
      setNetwork(p ? detectNetwork(p) : null);
      setError(null);
      setErrorCode(null);
      setLoading(false);
      setSubmitted(false);
      setSaveAsDefault(true);
      setWasEdited(false);
      setPhoneCheck(null);
      setShowChangeBtn(false);
    }
  }, [isOpen, savedPhone]);

  /* ══════════════════════════════════════════════
     LOCK body scroll
  ══════════════════════════════════════════════ */
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  /* ══════════════════════════════════════════════
     LIVE PHONE AVAILABILITY CHECK
     Debounced 500ms — only when phone was edited
  ══════════════════════════════════════════════ */
  useEffect(() => {
    clearTimeout(checkTimer.current);
    setPhoneCheck(null);

    if (!wasEdited)           return;
    if (!isValidPhone(phone)) return;

    setChecking(true);
    checkTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(
          `${API}/airtime-coupons/check-phone/${phone}`,
          { headers: authH() }
        );
        const data = await res.json();
        setPhoneCheck(data);
      } catch { /* silent */ }
      finally  { setChecking(false); }
    }, 500);

    return () => clearTimeout(checkTimer.current);
  }, [phone, wasEdited]);

  /* ══════════════════════════════════════════════
     PHONE INPUT
  ══════════════════════════════════════════════ */
  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
    setPhone(raw);
    setNetwork(raw.length >= 4 ? detectNetwork(raw) : null);
    setError(null);
    setErrorCode(null);
    setWasEdited(true);
  };

  /* ══════════════════════════════════════════════
     "Change Number" button — reveals input
  ══════════════════════════════════════════════ */
  const handleShowChange = () => {
    setShowChangeBtn(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  /* ══════════════════════════════════════════════
     SUBMIT REDEEM
  ══════════════════════════════════════════════ */
  const handleSubmit = useCallback(async () => {
    const p = normalisePhone(phone);

    if (!p || !isValidPhone(p)) {
      setError("Enter a valid 11-digit Nigerian mobile number.");
      return;
    }

    if (phoneCheck && !phoneCheck.available) {
      setError(phoneCheck.message);
      return;
    }

    /* If editing during cooldown, force one-time use (don't save) */
    const shouldSave = wasEdited && inCooldown ? false : saveAsDefault;

    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const res  = await fetch(`${API}/airtime-coupons/redeem`, {
        method : "POST",
        headers: authH(),
        body   : JSON.stringify({
          code            : coupon.code,
          phone           : p,
          save_as_default : shouldSave,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorCode(data.code || null);

        /* Contextual error messages */
        if (data.code === "PHONE_COOLDOWN_ACTIVE") {
          throw new Error(
            `You can change your default number in ${data.cooldown?.days_left ?? "?"} days. ` +
            `Uncheck "Save as default" to send airtime just this once.`
          );
        }
        if (data.code === "PHONE_LIMIT_REACHED") {
          throw new Error(
            "This phone number has reached the maximum number of allowed accounts."
          );
        }
        if (data.code === "GIVEAWAYS_SUSPENDED") {
          throw new Error("Your giveaway access is suspended. Contact support.");
        }
        if (data.code === "EMAIL_NOT_VERIFIED") {
          throw new Error("Please verify your email first.");
        }
        if (data.code === "CLAIM_LIMIT_REACHED") {
          throw new Error(
            `You've reached your claim limit. ` +
            `Daily: ${data.limits?.daily_used}/${data.limits?.daily_used + data.limits?.daily_left}`
          );
        }

        throw new Error(data.message || "Claim failed. Please try again.");
      }

      /* ✓ Success */
      setSubmitted(true);

      setTimeout(() => {
        onSuccess?.(coupon.code, {
          phone  : p,
          network: network || detectNetwork(p),
          claim  : data.claim,
          saved  : data.airtime_phone_saved,
        });
      }, 1_800);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [phone, coupon, network, saveAsDefault, wasEdited, inCooldown, phoneCheck, onSuccess]);

  /* ══════════════════════════════════════════════
     EARLY EXIT
  ══════════════════════════════════════════════ */
  if (!isOpen)  return null;
  if (!coupon)  return null;

  const amount        = coupon.amount ?? coupon.value ?? 0;
  const netStyle      = network ? NETWORK_COLORS[network] : null;
  const savedNetStyle = savedPhone?.network ? NETWORK_COLORS[savedPhone.network] : null;

  /* ── Determine if user can submit ── */
  const canSubmit =
    !loading &&
    phone.length >= 10 &&
    (!phoneCheck || phoneCheck.available);

  /* ── Contextual sub-header text ── */
  const subLabel =
    hasSavedPhone && !wasEdited && !showChangeBtn
      ? "Using your saved airtime number."
      : hasSavedPhone && (wasEdited || showChangeBtn)
        ? "Sending to a different number this time?"
        : "Enter the number that should receive the airtime.";

  /* ── Save toggle disabled when in cooldown ── */
  const saveToggleDisabled = wasEdited && inCooldown;
  const effectiveSave      = saveToggleDisabled ? false : saveAsDefault;

  return (
    <div
      className="acm-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="acm-sheet">

        {/* Close button */}
        <button
          className="acm-close"
          onClick={onClose}
          disabled={loading}
          aria-label="Close"
        >
          ✕
        </button>

        {/* ══════════════════════════════════════
             SUCCESS STATE
        ══════════════════════════════════════ */}
        {submitted ? (
          <div className="acm-success">
            <div className="acm-success-icon">✓</div>
            <h2 className="acm-title">Claim submitted!</h2>
            <p className="acm-sub">
              {naira(amount)} airtime will be sent to{" "}
              <strong>{phone}</strong> within 24 hours.
            </p>
            <p className="acm-sub-small">
              You'll receive a notification once processed.
            </p>
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════
                 HEADER
            ══════════════════════════════════════ */}
            <div className="acm-header">
              <span className="acm-emoji">📱</span>
              <h2 className="acm-title">Claim {naira(amount)} Airtime</h2>
              <p className="acm-sub">{subLabel}</p>
            </div>

            {/* ══════════════════════════════════════
                 SAVED NUMBER DISPLAY (before editing)
            ══════════════════════════════════════ */}
            {hasSavedPhone && !wasEdited && !showChangeBtn && (
              <div className="acm-saved-card">
                <div className="acm-saved-row">
                  <span className="acm-saved-flag">🇳🇬</span>
                  <div className="acm-saved-main">
                    <div className="acm-saved-phone">{phone}</div>
                    {savedNetStyle && (
                      <div
                        className="acm-saved-net"
                        style={{ color: savedNetStyle.color }}
                      >
                        {savedNetStyle.emoji} {savedPhone.network}
                      </div>
                    )}
                  </div>
                  <span className="acm-saved-badge">💾 Saved</span>
                </div>

                {/* Cooldown notice */}
                {inCooldown && (
                  <div className="acm-cooldown-info">
                    <span>🔒</span>
                    <div>
                      <strong>Current number locked.</strong>
                      <br />
                      Next change available:{" "}
                      <strong>{nextChangeDate}</strong>{" "}
                      ({daysLeft} day{daysLeft !== 1 ? "s" : ""})
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="acm-change-btn"
                  onClick={handleShowChange}
                  disabled={loading}
                >
                  {inCooldown ? "Send to a different number (one-time)" : "Change number"}
                </button>
              </div>
            )}

            {/* ══════════════════════════════════════
                 PHONE INPUT
            ══════════════════════════════════════ */}
            {(!hasSavedPhone || wasEdited || showChangeBtn) && (
              <div className="acm-field">
                <label className="acm-label" htmlFor="acm-phone">
                  Airtime recipient number
                </label>

                <div className="acm-phone-wrap">
                  <span className="acm-prefix">🇳🇬 +234</span>
                  <input
                    ref={inputRef}
                    id="acm-phone"
                    className="acm-phone-input"
                    type="tel"
                    inputMode="numeric"
                    placeholder="08012345678"
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={11}
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>

                {/* Network badge */}
                {network && netStyle && (
                  <div
                    className="acm-network-badge"
                    style={{ background: netStyle.bg, color: netStyle.color }}
                  >
                    {netStyle.emoji} {network} detected
                  </div>
                )}

                {phone.length >= 7 && !network && (
                  <div className="acm-network-unknown">
                    ⚠️ Network not detected — check your number
                  </div>
                )}

                {/* ── Live availability check ── */}
                {checking && (
                  <div className="acm-phone-checking">
                    <span className="acm-spin-dot" />
                    Checking availability…
                  </div>
                )}

                {phoneCheck && !checking && (
                  phoneCheck.available ? (
                    <div className="acm-phone-ok">
                      ✓ Number can be used
                    </div>
                  ) : (
                    <div className="acm-phone-blocked">
                      🚫 {phoneCheck.message}
                    </div>
                  )
                )}

                {/* ── Save toggle ── */}
                {hasSavedPhone && wasEdited && (
                  <>
                    {inCooldown ? (
                      <div className="acm-cooldown-warn">
                        🔒 You can update your default number in{" "}
                        <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>.
                        <br />
                        This claim will use the new number{" "}
                        <strong>this time only</strong>.
                      </div>
                    ) : (
                      <label className="acm-save-toggle">
                        <input
                          type="checkbox"
                          checked={effectiveSave}
                          onChange={(e) => setSaveAsDefault(e.target.checked)}
                          disabled={loading || saveToggleDisabled}
                        />
                        <span>Save as my default airtime number</span>
                      </label>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════
                 ERROR MESSAGE
            ══════════════════════════════════════ */}
            {error && (
              <div className={`acm-error ${errorCode ? `acm-error--${errorCode.toLowerCase()}` : ""}`}>
                <span className="acm-error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* ══════════════════════════════════════
                 INFO NOTE
            ══════════════════════════════════════ */}
            <div className="acm-note">
              ℹ️ Send airtime to any Nigerian number — yours, family, or friends.
              We process claims within 24 hours.
            </div>

            {/* ══════════════════════════════════════
                 ACTIONS
            ══════════════════════════════════════ */}
            <button
              className="acm-btn acm-btn--primary"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? (
                <>
                  <span className="acm-spin-white" />
                  Submitting…
                </>
              ) : (
                `Claim ${naira(amount)} Airtime`
              )}
            </button>

            <button
              className="acm-btn acm-btn--ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </>
        )}

      </div>
    </div>
  );
}