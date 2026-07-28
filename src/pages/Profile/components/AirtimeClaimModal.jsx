// src/pages/Profile/components/AirtimeClaimModal.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import "../styles/AirtimeClaimModal.css";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const TOKEN_KEYS = [
  "marketplace_token","token","auth_token","authToken",
  "access_token","accessToken","jwt",
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

const NETWORK_COLORS = {
  MTN     : { bg: "#fef9c3", color: "#854d0e", emoji: "🟡" },
  Airtel  : { bg: "#fee2e2", color: "#991b1b", emoji: "🔴" },
  Glo     : { bg: "#dcfce7", color: "#166534", emoji: "🟢" },
  "9mobile":{ bg: "#e0f2fe", color: "#075985", emoji: "🔵" },
};

/* ═══════════════════════════════════════════════════════════════
   FLOATING DEBUG PANEL — separate component, ALWAYS visible
═══════════════════════════════════════════════════════════════ */
function DebugPanel({ logs, onClear, onCopy, onClose }) {
  return (
    <div style={{
      position     : "fixed",
      top          : 10,
      left         : 10,
      right        : 10,
      maxHeight    : "50vh",
      background   : "#000",
      color        : "#0f0",
      fontFamily   : "monospace",
      fontSize     : "11px",
      zIndex       : 9999999,
      border       : "2px solid #0f0",
      borderRadius : 8,
      overflow     : "hidden",
      display      : "flex",
      flexDirection: "column",
      boxShadow    : "0 4px 20px rgba(0,0,0,0.8)",
    }}>
      <div style={{
        display        : "flex",
        justifyContent : "space-between",
        padding        : "6px 10px",
        background     : "#0f0",
        color          : "#000",
        fontWeight     : "bold",
      }}>
        <span>🔧 DEBUG ({logs.length})</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={onCopy}
            style={{
              background: "#000",
              color     : "#0f0",
              border    : "1px solid #0f0",
              padding   : "2px 8px",
              fontSize  : 10,
              cursor    : "pointer",
              borderRadius: 4,
            }}>📋</button>
          <button
            onClick={onClear}
            style={{
              background: "#000",
              color     : "#0f0",
              border    : "1px solid #0f0",
              padding   : "2px 8px",
              fontSize  : 10,
              cursor    : "pointer",
              borderRadius: 4,
            }}>🗑</button>
          <button
            onClick={onClose}
            style={{
              background: "#000",
              color     : "#f00",
              border    : "1px solid #f00",
              padding   : "2px 8px",
              fontSize  : 10,
              cursor    : "pointer",
              borderRadius: 4,
            }}>✕</button>
        </div>
      </div>

      <div style={{
        flex        : 1,
        overflow    : "auto",
        padding     : "6px 10px",
        lineHeight  : 1.5,
        wordBreak   : "break-all",
        whiteSpace  : "pre-wrap",
        WebkitOverflowScrolling: "touch",
      }}>
        {logs.length === 0 ? (
          <div style={{ color: "#666", fontStyle: "italic" }}>
            Waiting for events…
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{
              color: log.level === "error" ? "#f66"
                   : log.level === "warn"  ? "#fc0"
                   : "#0f0",
              marginBottom: 2,
            }}>
              [{log.time}] {log.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AirtimeClaimModal({
  isOpen,
  coupon,
  savedPhone = null,
  onClose,
  onSuccess,
}) {
  const [phone,         setPhone]         = useState("");
  const [network,       setNetwork]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [submitted,     setSubmitted]     = useState(false);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [wasEdited,     setWasEdited]     = useState(false);
  const [checking,      setChecking]      = useState(false);
  const [phoneCheck,    setPhoneCheck]    = useState(null);

  /* Debug state — separate ref-based log so it never gets stuck */
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(true);   // ← always show

  const checkTimer = useRef(null);
  const inputRef   = useRef(null);

  /* addLog is stable — never causes re-renders that lose logs */
  const addLog = useCallback((level, ...args) => {
    const line = args.map((a) =>
      typeof a === "object" ? JSON.stringify(a) : String(a)
    ).join(" ");
    const stamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setDebugLogs((prev) => {
      const next = [...prev, { time: stamp, level, line }];
      return next.slice(-40);
    });
  }, []);

  const hasSavedPhone = !!savedPhone?.phone;

  /* Reset on open */
  useEffect(() => {
    if (isOpen) {
      const tok = getToken();
      const p   = normalisePhone(savedPhone?.phone || "");
      setPhone(p);
      setNetwork(p ? detectNetwork(p) : null);
      setError(null);
      setLoading(false);
      setSubmitted(false);
      setSaveAsDefault(true);
      setWasEdited(false);
      setPhoneCheck(null);

      setTimeout(() => {
        addLog("log", "════ OPENED ════");
        addLog("log", `API: ${API}`);
        addLog("log", `Token: ${tok ? "✓ " + tok.slice(0, 20) + "..." : "✗ MISSING"}`);
        addLog("log", `Coupon: ${coupon?.code}`);
        addLog("log", `Origin: ${window.location.origin}`);
        addLog("log", `Online: ${navigator.onLine}`);
      }, 50);
    }
  }, [isOpen, savedPhone, coupon, addLog]);

  /* Body scroll lock */
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  /* ══════════════════════════════════════════════
     LIVE PHONE CHECK
  ══════════════════════════════════════════════ */
  useEffect(() => {
    clearTimeout(checkTimer.current);
    setPhoneCheck(null);

    if (!wasEdited || !isValidPhone(phone)) return;

    const token = getToken();
    if (!token) {
      addLog("warn", "check: no token, skip");
      setPhoneCheck({ available: true, message: "" });
      return;
    }

    setChecking(true);
    addLog("log", `check queued: ${phone}`);

    checkTimer.current = setTimeout(async () => {
      const url = `${API}/airtime-coupons/check-phone/${phone}`;
      addLog("log", `→ GET check-phone`);

      const ctrl = new AbortController();
      const timeout = setTimeout(() => {
        ctrl.abort();
        addLog("error", "check: TIMEOUT 8s");
      }, 8000);

      try {
        const res = await fetch(url, {
          method : "GET",
          headers: authH(),
          signal : ctrl.signal,
        });
        clearTimeout(timeout);

        addLog("log", `← ${res.status} check-phone`);

        let data = {};
        try {
          const text = await res.text();
          if (text) data = JSON.parse(text);
        } catch (e) {
          addLog("error", `parse fail: ${e.message}`);
        }

        if (!res.ok) {
          addLog("warn", `check ${res.status} — fail open`);
          setPhoneCheck({ available: true, message: "" });
          return;
        }

        addLog("log", `✓ available=${data.available}`);
        setPhoneCheck(data);
      } catch (err) {
        clearTimeout(timeout);
        addLog("error", `check err: ${err.name} — ${err.message}`);
        if (err.message === "Failed to fetch") {
          addLog("error", "→ CORS/network issue");
        }
        setPhoneCheck({ available: true, message: "" });
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => clearTimeout(checkTimer.current);
  }, [phone, wasEdited, addLog]);

  const handlePhoneChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
    setPhone(raw);
    setNetwork(raw.length >= 4 ? detectNetwork(raw) : null);
    setError(null);
    setWasEdited(true);
  };

  /* ══════════════════════════════════════════════
     SUBMIT — with hard timeout + guaranteed reset
  ══════════════════════════════════════════════ */
  const handleSubmit = useCallback(async () => {
    const p = normalisePhone(phone);
    addLog("log", "════ SUBMIT ════");
    addLog("log", `phone=${p}`);

    if (!p || !isValidPhone(p)) {
      setError("Enter a valid 11-digit Nigerian number.");
      addLog("error", "invalid phone");
      return;
    }

    const token = getToken();
    if (!token) {
      setError("Not logged in. Please refresh.");
      addLog("error", "no token");
      return;
    }

    setLoading(true);
    setError(null);

    const url = `${API}/airtime-coupons/redeem`;
    addLog("log", `→ POST redeem`);

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => {
      ctrl.abort();
      addLog("error", "submit: HARD TIMEOUT 20s");
    }, 20000);

    /* Safety net — force reset loading after 25s no matter what */
    const safetyId = setTimeout(() => {
      addLog("error", "SAFETY NET fired — forcing loading=false");
      setLoading(false);
      setError("Request took too long. Please try again.");
    }, 25000);

    try {
      addLog("log", "fetch() starting...");

      const res = await fetch(url, {
        method : "POST",
        headers: authH(),
        signal : ctrl.signal,
        body   : JSON.stringify({
          code            : coupon.code,
          phone           : p,
          save_as_default : saveAsDefault,
        }),
      });

      clearTimeout(timeoutId);
      clearTimeout(safetyId);

      addLog("log", `← ${res.status} redeem`);
      addLog("log", `type: ${res.type}`);

      let data = {};
      try {
        const text = await res.text();
        addLog("log", `body length: ${text.length}`);
        if (text) {
          addLog("log", `body: ${text.slice(0, 150)}`);
          data = JSON.parse(text);
        }
      } catch (e) {
        addLog("error", `parse fail: ${e.message}`);
        throw new Error("Server returned invalid response");
      }

      if (!res.ok || !data.success) {
        addLog("error", `fail code=${data.code} msg=${data.message}`);

        if (data.code === "PHONE_COOLDOWN_ACTIVE") {
          throw new Error(`Change locked for ${data.cooldown?.days_left} days.`);
        }
        if (data.code === "PHONE_LIMIT_REACHED") {
          throw new Error("Phone reached maximum allowed accounts.");
        }
        if (data.code === "GIVEAWAYS_SUSPENDED") {
          throw new Error("Giveaways suspended. Contact support.");
        }
        if (data.code === "EMAIL_NOT_VERIFIED") {
          throw new Error("Please verify your email first.");
        }
        if (data.code === "CLAIM_LIMIT_REACHED") {
          throw new Error("Claim limit reached.");
        }
        if (res.status === 401) throw new Error("Not logged in.");
        if (res.status === 429) throw new Error("Too many attempts.");
        throw new Error(data.message || `HTTP ${res.status}`);
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
      clearTimeout(timeoutId);
      clearTimeout(safetyId);

      addLog("error", `catch: ${err.name} — ${err.message}`);

      if (err.name === "AbortError") {
        setError("Timed out. Please try again.");
      } else if (err.message === "Failed to fetch") {
        addLog("error", "═ FAILED TO FETCH ═");
        addLog("error", "Likely CORS or backend down");
        setError("Network error. Check connection.");
      } else {
        setError(err.message);
      }
    } finally {
      /* GUARANTEED reset */
      addLog("log", "finally: loading=false");
      setLoading(false);
    }
  }, [phone, coupon, network, saveAsDefault, onSuccess, addLog]);

  if (!isOpen || !coupon) return null;

  const amount   = coupon.amount ?? coupon.value ?? 0;
  const netStyle = network ? NETWORK_COLORS[network] : null;

  const canSubmit =
    !loading &&
    phone.length >= 10 &&
    isValidPhone(phone) &&
    !(phoneCheck && phoneCheck.available === false);

  const copyLogs = () => {
    const text = debugLogs.map((l) => `[${l.time}] ${l.level.toUpperCase()}: ${l.line}`).join("\n");
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => alert("✓ Logs copied!"),
        () => fallbackCopy(text)
      );
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      alert("✓ Logs copied!");
    } catch {
      alert("Copy failed. Screenshot the debug panel.");
    }
    document.body.removeChild(ta);
  };

  return (
    <>
      {/* Floating debug panel — outside modal, always on top */}
      {showDebug && (
        <DebugPanel
          logs={debugLogs}
          onClear={() => setDebugLogs([])}
          onCopy={copyLogs}
          onClose={() => setShowDebug(false)}
        />
      )}

      {/* Floating button to reopen debug */}
      {!showDebug && (
        <button
          onClick={() => setShowDebug(true)}
          style={{
            position    : "fixed",
            top         : 10,
            right       : 10,
            zIndex      : 9999999,
            background  : "#000",
            color       : "#0f0",
            border      : "2px solid #0f0",
            borderRadius: "50%",
            width       : 44,
            height      : 44,
            fontSize    : 20,
            cursor      : "pointer",
          }}>
          🔧
        </button>
      )}

      <div
        className="acm-overlay"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
      >
        <div className="acm-sheet">

          <button
            className="acm-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            ✕
          </button>

          {submitted ? (
            <div className="acm-success">
              <div className="acm-success-icon">✓</div>
              <h2 className="acm-title">Claim submitted!</h2>
              <p className="acm-sub">
                {naira(amount)} airtime will be sent to{" "}
                <strong>{phone}</strong> within 24 hours.
              </p>
            </div>
          ) : (
            <>
              <div className="acm-header">
                <span className="acm-emoji">📱</span>
                <h2 className="acm-title">Claim {naira(amount)} Airtime</h2>
                <p className="acm-sub">
                  Enter the number that should receive the airtime.
                </p>
              </div>

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

                {network && netStyle && (
                  <div
                    className="acm-network-badge"
                    style={{ background: netStyle.bg, color: netStyle.color }}
                  >
                    {netStyle.emoji} {network} detected
                  </div>
                )}

                {checking && (
                  <div className="acm-phone-checking">
                    <span className="acm-spin-dot" />
                    Checking availability…
                  </div>
                )}

                {phoneCheck && !checking && phoneCheck.message && (
                  phoneCheck.available ? (
                    <div className="acm-phone-ok">✓ {phoneCheck.message}</div>
                  ) : (
                    <div className="acm-phone-blocked">🚫 {phoneCheck.message}</div>
                  )
                )}
              </div>

              {error && (
                <div className="acm-error">
                  <span className="acm-error-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="acm-note">
                ℹ️ Send airtime to any Nigerian number. Processed within 24 hours.
              </div>

              <button
                className="acm-btn acm-btn--primary"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {loading ? (
                  <><span className="acm-spin-white" /> Submitting…</>
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
    </>
  );
}