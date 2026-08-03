// src/pages/Profile/components/AirtimeClaimModal.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import "../styles/AirtimeClaimModal.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

const SHOW_DEBUG = false;

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const TOKEN_KEYS = [
  "marketplace_token", "token", "auth_token", "authToken",
  "access_token", "accessToken", "jwt",
];

const getToken = () => {
  for (const key of TOKEN_KEYS) {
    const v = localStorage.getItem(key);
    if (v && v !== "null" && v !== "undefined") return v;
  }
  for (const key of TOKEN_KEYS) {
    const v = sessionStorage.getItem(key);
    if (v && v !== "null" && v !== "undefined") return v;
  }
  return null;
};

const authH = () => {
  const token = getToken();
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const normalisePhone = (raw) => {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.startsWith("234")) return "0" + d.slice(3);
  if (d.startsWith("0"))   return d;
  if (d.length === 10)     return "0" + d;
  return d;
};

const isValidPhone = (p) => /^0[789][01]\d{8}$/.test(p);

const NETWORK_PREFIX_MAP = {
  "0703":"MTN",  "0704":"MTN",  "0706":"MTN",  "0803":"MTN",
  "0806":"MTN",  "0810":"MTN",  "0813":"MTN",  "0814":"MTN",
  "0816":"MTN",  "0903":"MTN",  "0906":"MTN",  "0913":"MTN",
  "0916":"MTN",
  "0701":"Airtel","0708":"Airtel","0802":"Airtel","0808":"Airtel",
  "0812":"Airtel","0901":"Airtel","0902":"Airtel","0904":"Airtel",
  "0907":"Airtel","0912":"Airtel",
  "0705":"Glo",  "0805":"Glo",  "0807":"Glo",  "0811":"Glo",
  "0815":"Glo",  "0905":"Glo",  "0915":"Glo",
  "0809":"9mobile","0817":"9mobile","0818":"9mobile",
  "0908":"9mobile","0909":"9mobile",
};

const detectNetwork = (phone) => {
  if (!phone) return null;
  const prefix = normalisePhone(phone).slice(0, 4);
  return NETWORK_PREFIX_MAP[prefix] ?? null;
};

/*
 * maskPhone — used only in success screen and notifications.
 * The saved-phone card now shows the FULL number.
 */
const maskPhone = (phone) => {
  if (!phone) return "";
  const d = normalisePhone(phone);
  if (d.length < 7) return d;
  return d.slice(0, 4) + "****" + d.slice(-3);
};

const naira = (n) => {
  const num = parseFloat(n);
  return isNaN(num) ? "₦0" : "₦" + num.toLocaleString("en-NG");
};

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
   DEBUG PANEL
═══════════════════════════════════════════════════════════════ */
const debugBtnStyle = (c) => ({
  background: "#000", color: c, border: `1px solid ${c}`,
  padding: "2px 8px", fontSize: 10, cursor: "pointer", borderRadius: 4,
});

function DebugPanel({ logs, onClear, onCopy, onClose }) {
  return (
    <div style={{
      position: "fixed", top: 10, left: 10, right: 10,
      maxHeight: "50vh", background: "#000", color: "#0f0",
      fontFamily: "monospace", fontSize: "11px", zIndex: 9999999,
      border: "2px solid #0f0", borderRadius: 8, overflow: "hidden",
      display: "flex", flexDirection: "column",
      boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        padding: "6px 10px", background: "#0f0", color: "#000",
        fontWeight: "bold",
      }}>
        <span>🔧 DEBUG ({logs.length})</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onCopy}  style={debugBtnStyle("#0f0")}>📋</button>
          <button onClick={onClear} style={debugBtnStyle("#0f0")}>🗑</button>
          <button onClick={onClose} style={debugBtnStyle("#f00")}>✕</button>
        </div>
      </div>
      <div style={{
        flex: 1, overflow: "auto", padding: "6px 10px",
        lineHeight: 1.5, wordBreak: "break-all", whiteSpace: "pre-wrap",
        WebkitOverflowScrolling: "touch",
      }}>
        {logs.length === 0
          ? <div style={{ color: "#666", fontStyle: "italic" }}>Waiting…</div>
          : logs.map((log, i) => (
              <div key={i} style={{
                color : log.level === "error" ? "#f66"
                      : log.level === "warn"  ? "#fc0"
                      : "#0f0",
                marginBottom: 2,
              }}>
                [{log.time}] {log.line}
              </div>
            ))
        }
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NETWORK BADGE (reusable)
═══════════════════════════════════════════════════════════════ */
function NetworkBadge({ network, className = "acm-network-badge" }) {
  const style = network ? NETWORK_COLORS[network] : null;
  if (!style) return null;
  return (
    <div
      className={className}
      style={{ background: style.bg, color: style.color }}
    >
      {style.emoji} {network} detected
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SAVED PHONE CARD
   Shows the FULL phone number (not masked).
═══════════════════════════════════════════════════════════════ */
function SavedPhoneCard({
  savedPhone,
  inCooldown,
  daysLeft,
  nextChangeDate,
  loading,
  onClickChange,
}) {
  const netStyle = savedPhone?.network ? NETWORK_COLORS[savedPhone.network] : null;

  /*
   * Prefer the raw phone from the API so the user sees their full number.
   * Fall back to normalised form if the API only returned a masked string.
   */
  const displayPhone = normalisePhone(savedPhone.phone) || savedPhone.phone;

  return (
    <div className="acm-saved-card">
      {/* ── Phone row ── */}
      <div className="acm-saved-row">
        <span className="acm-saved-flag">🇳🇬</span>

        <div className="acm-saved-main">
          {/* Full number — no masking */}
          <div className="acm-saved-phone">{displayPhone}</div>

          {netStyle && (
            <div
              className="acm-saved-net"
              style={{ color: netStyle.color }}
            >
              {netStyle.emoji} {savedPhone.network}
            </div>
          )}
        </div>

        <span className="acm-saved-badge">💾 Saved</span>
      </div>

      {/* ── Cooldown notice ── */}
      {inCooldown && (
        <div className="acm-cooldown-info">
          <span>🔒</span>
          <div>
            <strong>Locked until {nextChangeDate}</strong>
            <br />
            You can change your default number in{" "}
            <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>.
          </div>
        </div>
      )}

      {/* ── Change button ── */}
      <button
        type="button"
        className="acm-change-btn"
        onClick={onClickChange}
        disabled={loading}
      >
        {inCooldown
          ? "Send to a different number (one-time)"
          : "Change number"}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PHONE INPUT FIELD
═══════════════════════════════════════════════════════════════ */
function PhoneInputField({
  inputRef,
  phone,
  network,
  loading,
  checking,
  phoneCheck,
  hasSavedPhone,
  wasEdited,
  inCooldown,
  daysLeft,
  saveAsDefault,
  saveToggleDisabled,
  effectiveSave,
  onChange,
  onSaveToggle,
}) {
  const netStyle = network ? NETWORK_COLORS[network] : null;

  return (
    <div className="acm-field">
      <label className="acm-label" htmlFor="acm-phone">
        Airtime recipient number
      </label>

      {/* Input row */}
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
          onChange={onChange}
          maxLength={11}
          disabled={loading}
          autoComplete="tel"
        />
      </div>

      {/* Network detection */}
      {network && netStyle && (
        <NetworkBadge network={network} />
      )}
      {phone.length >= 7 && !network && (
        <div className="acm-network-unknown">
          ⚠️ Network not detected — check your number
        </div>
      )}

      {/* Availability check */}
      {checking && (
        <div className="acm-phone-checking">
          <span className="acm-spin-dot" />
          Checking availability…
        </div>
      )}
      {phoneCheck && !checking && phoneCheck.message && (
        phoneCheck.available
          ? <div className="acm-phone-ok">✓ {phoneCheck.message}</div>
          : <div className="acm-phone-blocked">🚫 {phoneCheck.message}</div>
      )}

      {/* Save-as-default toggle — only when editing an existing saved number */}
      {hasSavedPhone && wasEdited && (
        inCooldown ? (
          <div className="acm-cooldown-warn">
            🔒 You can update your default in{" "}
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
              onChange={onSaveToggle}
              disabled={loading || saveToggleDisabled}
            />
            <span>Save as my default airtime number</span>
          </label>
        )
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUCCESS SCREEN
═══════════════════════════════════════════════════════════════ */
function SuccessScreen({ amount, phone, network }) {
  const netStyle = network ? NETWORK_COLORS[network] : null;

  return (
    <div className="acm-success">
      <div className="acm-success-icon">✓</div>
      <h2 className="acm-title">Claim submitted!</h2>

      <p className="acm-sub">
        {naira(amount)} airtime will be sent to{" "}
        {/* Show masked number on success screen for security */}
        <strong>{maskPhone(phone) || phone}</strong> shortly.
      </p>

      {netStyle && (
        <div
          className="acm-success-network"
          style={{ background: netStyle.bg, color: netStyle.color }}
        >
          {netStyle.emoji} {network}
        </div>
      )}

      <p className="acm-sub-small">
        You'll receive an email confirmation once processed.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN MODAL
═══════════════════════════════════════════════════════════════ */
export default function AirtimeClaimModal({
  isOpen,
  coupon,
  savedPhone     = null,   // { phone, masked, network, in_cooldown, days_left, next_change_at }
  prefilledPhone = "",
  onClose,
  onSuccess,
}) {
  /* ── Core state ── */
  const [phone,         setPhone]         = useState("");
  const [network,       setNetwork]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [errorCode,     setErrorCode]     = useState(null);
  const [submitted,     setSubmitted]     = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  /*
   * wasEdited  — true once the user types anything in the input
   * showInput  — true once "Change number" is clicked
   *              (distinct from wasEdited so we can show the input
   *               without marking the number as changed yet)
   */
  const [wasEdited,  setWasEdited]  = useState(false);
  const [showInput,  setShowInput]  = useState(false);

  /* Availability check */
  const [checking,   setChecking]   = useState(false);
  const [phoneCheck, setPhoneCheck] = useState(null);

  /* Debug */
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(SHOW_DEBUG);

  const checkTimer = useRef(null);
  const inputRef   = useRef(null);

  /* ── Debug logger ── */
  const addLog = useCallback((level, ...args) => {
    if (!SHOW_DEBUG) return;
    const line = args.map((a) =>
      typeof a === "object" ? JSON.stringify(a) : String(a)
    ).join(" ");
    const stamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setDebugLogs((prev) => [...prev, { time: stamp, level, line }].slice(-40));
  }, []);

  /* ── Derived values ── */
  const hasSavedPhone  = !!savedPhone?.phone;
  const inCooldown     = !!savedPhone?.in_cooldown;
  const daysLeft       = savedPhone?.days_left ?? 0;
  const nextChangeDate = savedPhone?.next_change_at ? fmtDate(savedPhone.next_change_at) : null;

  const saveToggleDisabled = wasEdited && inCooldown;
  const effectiveSave      = saveToggleDisabled ? false : saveAsDefault;

  /*
   * Show the phone input when:
   *   1. No saved phone (first-time user), OR
   *   2. User clicked "Change number", OR
   *   3. User has typed something
   */
  const inputVisible = !hasSavedPhone || showInput || wasEdited;

  /* ── Sub-header copy ── */
  const subLabel = hasSavedPhone && !showInput && !wasEdited
    ? "Using your saved airtime number."
    : hasSavedPhone && (showInput || wasEdited)
      ? "Sending to a different number this time?"
      : "Enter the number that should receive the airtime.";

  /* ══════════════════════════════════════════════
     RESET when modal opens
  ══════════════════════════════════════════════ */
  useEffect(() => {
    if (!isOpen) return;

    /*
     * Seed the input with the saved phone (full number) or prefilled value.
     * This means when the user clicks "Change number" the field already
     * contains their current number, ready to edit.
     */
    const seed = normalisePhone(savedPhone?.phone || prefilledPhone || "");

    setPhone(seed);
    setNetwork(seed ? detectNetwork(seed) : null);
    setError(null);
    setErrorCode(null);
    setLoading(false);
    setSubmitted(false);
    setSaveAsDefault(true);
    setWasEdited(false);
    setShowInput(false);
    setPhoneCheck(null);

    if (SHOW_DEBUG) {
      setTimeout(() => {
        addLog("log", "════ OPENED ════");
        addLog("log", `API: ${API}`);
        addLog("log", `Token: ${getToken() ? "✓ present" : "✗ MISSING"}`);
        addLog("log", `Coupon: ${coupon?.code}`);
        addLog("log", `SavedPhone: ${hasSavedPhone ? savedPhone.phone : "none"}`);
        addLog("log", `Cooldown: ${inCooldown ? `yes (${daysLeft}d left)` : "no"}`);
      }, 50);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Body scroll lock ── */
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  /* ══════════════════════════════════════════════
     LIVE PHONE AVAILABILITY CHECK
  ══════════════════════════════════════════════ */
  useEffect(() => {
    clearTimeout(checkTimer.current);
    setPhoneCheck(null);

    /* Only check when user has actually edited the field */
    if (!wasEdited || !isValidPhone(phone)) return;

    /* No need to check if it's the same as the saved number */
    if (hasSavedPhone && normalisePhone(savedPhone.phone) === phone) {
      setPhoneCheck({ available: true, message: "" });
      return;
    }

    if (!getToken()) {
      setPhoneCheck({ available: true, message: "" });
      return;
    }

    setChecking(true);
    addLog("log", `check queued: ${phone}`);

    checkTimer.current = setTimeout(async () => {
      const ctrl    = new AbortController();
      const timeout = setTimeout(() => {
        ctrl.abort();
        addLog("error", "check: TIMEOUT 8s");
      }, 8000);

      try {
        addLog("log", `→ GET check-phone/${phone}`);
        const res = await fetch(`${API}/airtime-coupons/check-phone/${phone}`, {
          headers: authH(),
          signal : ctrl.signal,
        });
        clearTimeout(timeout);
        addLog("log", `← ${res.status} check-phone`);

        let data = {};
        try {
          const text = await res.text();
          if (text) data = JSON.parse(text);
        } catch { /* ignore parse errors */ }

        /* On any HTTP error, fail open (don't block the user) */
        setPhoneCheck(res.ok ? data : { available: true, message: "" });
      } catch (err) {
        clearTimeout(timeout);
        addLog("error", `check err: ${err.name} — ${err.message}`);
        /* Network error → fail open */
        setPhoneCheck({ available: true, message: "" });
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => clearTimeout(checkTimer.current);
  }, [phone, wasEdited]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Phone input handler ── */
  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
    setPhone(raw);
    setNetwork(raw.length >= 4 ? detectNetwork(raw) : null);
    setError(null);
    setErrorCode(null);
    setWasEdited(true);
  };

  /* ── "Change number" button ── */
  const handleShowInput = () => {
    setShowInput(true);
    /* Pre-fill with their saved number so they can edit from it */
    const seed = normalisePhone(savedPhone?.phone || "");
    if (seed) {
      setPhone(seed);
      setNetwork(detectNetwork(seed));
    }
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  /* ══════════════════════════════════════════════
     SUBMIT
  ══════════════════════════════════════════════ */
  const handleSubmit = useCallback(async () => {
    const p = normalisePhone(phone);
    addLog("log", "════ SUBMIT ════");
    addLog("log", `phone=${p} wasEdited=${wasEdited}`);

    if (!p || !isValidPhone(p)) {
      setError("Enter a valid 11-digit Nigerian number.");
      return;
    }
    if (phoneCheck?.available === false) {
      setError(phoneCheck.message || "This number cannot be used.");
      return;
    }
    if (!getToken()) {
      setError("Not logged in. Please refresh.");
      return;
    }

    /*
     * If the user is in cooldown and edited the number,
     * force save_as_default = false (one-time use).
     */
    const shouldSave = wasEdited && inCooldown ? false : effectiveSave;

    setLoading(true);
    setError(null);
    setErrorCode(null);

    const ctrl     = new AbortController();
    const hardId   = setTimeout(() => { ctrl.abort(); addLog("error", "HARD TIMEOUT 20s"); }, 20_000);
    const safetyId = setTimeout(() => {
      addLog("error", "SAFETY NET — forcing loading=false");
      setLoading(false);
      setError("Request took too long. Please try again.");
    }, 25_000);

    try {
      addLog("log", "→ POST redeem");
      const res = await fetch(`${API}/airtime-coupons/redeem`, {
        method  : "POST",
        headers : authH(),
        signal  : ctrl.signal,
        body    : JSON.stringify({
          code            : coupon.code,
          phone           : p,
          save_as_default : shouldSave,
        }),
      });

      clearTimeout(hardId);
      clearTimeout(safetyId);
      addLog("log", `← ${res.status} redeem`);

      let data = {};
      try {
        const text = await res.text();
        if (text) {
          addLog("log", `body: ${text.slice(0, 200)}`);
          data = JSON.parse(text);
        }
      } catch {
        throw new Error("Server returned an invalid response.");
      }

      if (!res.ok || !data.success) {
        setErrorCode(data.code || null);
        addLog("error", `fail code=${data.code} msg=${data.message}`);

        const errorMessages = {
          PHONE_COOLDOWN_ACTIVE :
            `You can change your default number in ${data.cooldown?.days_left ?? "?"} days. ` +
            `Uncheck "Save as default" to send just this once.`,
          PHONE_LIMIT_REACHED   : "This phone number has reached the maximum allowed accounts.",
          GIVEAWAYS_SUSPENDED   : "Giveaways are suspended. Please contact support.",
          EMAIL_NOT_VERIFIED    : "Please verify your email address first.",
          CLAIM_LIMIT_REACHED   : "You've reached your claim limit. Try again later.",
        };

        if (errorMessages[data.code]) {
          throw new Error(errorMessages[data.code]);
        }
        if (res.status === 401) throw new Error("Not logged in. Please refresh.");
        if (res.status === 429) throw new Error("Too many attempts. Try again in a moment.");
        throw new Error(data.message || `Unexpected error (HTTP ${res.status}).`);
      }

      addLog("log", "✓ SUCCESS");
      setSubmitted(true);

      setTimeout(() => {
        onSuccess?.(coupon.code, {
          phone  : p,
          network: network || detectNetwork(p),
          claim  : data.claim,
          saved  : data.airtime_phone_saved,
        });
      }, 1800);

    } catch (err) {
      clearTimeout(hardId);
      clearTimeout(safetyId);
      addLog("error", `catch: ${err.name} — ${err.message}`);

      if (err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else if (err.message === "Failed to fetch") {
        setError("Network error. Check your connection and try again.");
      } else {
        setError(err.message);
      }
    } finally {
      addLog("log", "finally: loading=false");
      setLoading(false);
    }
  }, [phone, coupon, network, effectiveSave, wasEdited, inCooldown, phoneCheck, onSuccess, addLog]);

  /* ── Submit button availability ── */
  const canSubmit =
    !loading &&
    phone.length >= 10 &&
    isValidPhone(phone) &&
    !(phoneCheck?.available === false);

  /* ── Debug helpers ── */
  const copyLogs = () => {
    const text = debugLogs
      .map((l) => `[${l.time}] ${l.level.toUpperCase()}: ${l.line}`)
      .join("\n");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => alert("✓ Logs copied!"))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const ta = Object.assign(document.createElement("textarea"), {
      value   : text,
      style   : "position:fixed;top:0;left:0;opacity:0",
    });
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); alert("✓ Copied!"); }
    catch { alert("Copy failed — copy manually from console."); }
    document.body.removeChild(ta);
  };

  /* ══════════════════════════════════════════════
     RENDER GUARD
  ══════════════════════════════════════════════ */
  if (!isOpen || !coupon) return null;

  const amount = Number(coupon.amount ?? coupon.value ?? 0);

  return (
    <>
      {/* ── Debug panel ── */}
      {SHOW_DEBUG && (
        showDebug
          ? (
            <DebugPanel
              logs={debugLogs}
              onClear={() => setDebugLogs([])}
              onCopy={copyLogs}
              onClose={() => setShowDebug(false)}
            />
          ) : (
            <button
              onClick={() => setShowDebug(true)}
              style={{
                position: "fixed", top: 10, right: 10, zIndex: 9999999,
                background: "#000", color: "#0f0", border: "2px solid #0f0",
                borderRadius: "50%", width: 44, height: 44,
                fontSize: 20, cursor: "pointer",
              }}
            >🔧</button>
          )
      )}

      {/* ── Overlay ── */}
      <div
        className="acm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={`Claim ${naira(amount)} airtime`}
        onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
      >
        <div className="acm-sheet">

          {/* Close button */}
          <button
            className="acm-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >✕</button>

          {/* ══════════ SUCCESS STATE ══════════ */}
          {submitted ? (
            <SuccessScreen
              amount={amount}
              phone={phone}
              network={network || detectNetwork(phone)}
            />
          ) : (
            <>
              {/* ══════════ HEADER ══════════ */}
              <div className="acm-header">
                <span className="acm-emoji">📱</span>
                <h2 className="acm-title">Claim {naira(amount)} Airtime</h2>
                <p className="acm-sub">{subLabel}</p>
              </div>

              {/* ══════════ SAVED PHONE CARD ══════════
                   Shown when there IS a saved number AND
                   the user hasn't clicked "Change" or typed yet.
              ════════════════════════════════════════════ */}
              {hasSavedPhone && !showInput && !wasEdited && (
                <SavedPhoneCard
                  savedPhone={savedPhone}
                  inCooldown={inCooldown}
                  daysLeft={daysLeft}
                  nextChangeDate={nextChangeDate}
                  loading={loading}
                  onClickChange={handleShowInput}
                />
              )}

              {/* ══════════ PHONE INPUT ══════════
                   Shown when: no saved phone, OR change clicked, OR typing started.
              ════════════════════════════════════════════ */}
              {inputVisible && (
                <PhoneInputField
                  inputRef={inputRef}
                  phone={phone}
                  network={network}
                  loading={loading}
                  checking={checking}
                  phoneCheck={phoneCheck}
                  hasSavedPhone={hasSavedPhone}
                  wasEdited={wasEdited}
                  inCooldown={inCooldown}
                  daysLeft={daysLeft}
                  saveAsDefault={saveAsDefault}
                  saveToggleDisabled={saveToggleDisabled}
                  effectiveSave={effectiveSave}
                  onChange={handlePhoneChange}
                  onSaveToggle={(e) => setSaveAsDefault(e.target.checked)}
                />
              )}

              {/* ══════════ ERROR ══════════ */}
              {error && (
                <div
                  className={[
                    "acm-error",
                    errorCode ? `acm-error--${errorCode.toLowerCase()}` : "",
                  ].join(" ").trim()}
                  role="alert"
                >
                  <span className="acm-error-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* ══════════ INFO NOTE ══════════ */}
              <div className="acm-note">
                ℹ️ Send airtime to any Nigerian number — yours, family, or friends.
                Processed shortly after submission.
              </div>

              {/* ══════════ ACTIONS ══════════ */}
              <button
                className="acm-btn acm-btn--primary"
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-busy={loading}
              >
                {loading
                  ? <><span className="acm-spin-white" /> Submitting…</>
                  : `Claim ${naira(amount)} Airtime`
                }
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
    </>
  );
}