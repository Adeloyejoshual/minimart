/**
 * TestOTP.jsx
 * Dead-simple OTP test page — no dependencies except React.
 * Visit /test-otp while logged in to diagnose the email issue.
 * DELETE this file once email sending is confirmed working.
 */

import { useState } from "react";

const API = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "/api";

/* Try every possible token key your app might use */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  localStorage.getItem("authToken")         ||
  localStorage.getItem("auth_token")        ||
  localStorage.getItem("jwt")               ||
  localStorage.getItem("accessToken")       ||
  localStorage.getItem("access_token")      ||
  sessionStorage.getItem("token")           ||
  sessionStorage.getItem("marketplace_token") ||
  "";

const S = {
  page: {
    minHeight      : "100vh",
    background     : "#060b14",
    display        : "flex",
    alignItems     : "center",
    justifyContent : "center",
    padding        : 24,
    fontFamily     : "monospace",
  },
  card: {
    background   : "#0d1523",
    border       : "1px solid rgba(255,255,255,0.1)",
    borderRadius : 16,
    padding      : 32,
    width        : "100%",
    maxWidth     : 640,
    display      : "flex",
    flexDirection: "column",
    gap          : 16,
  },
  title: {
    fontSize   : 20,
    fontWeight : 700,
    color      : "#f1f5f9",
    margin     : 0,
  },
  label: {
    fontSize   : 11,
    fontWeight : 700,
    color      : "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom : 4,
  },
  value: {
    fontSize     : 13,
    color        : "#94a3b8",
    wordBreak    : "break-all",
    background   : "#111c2d",
    padding      : "8px 12px",
    borderRadius : 8,
    border       : "1px solid rgba(255,255,255,0.06)",
    lineHeight   : 1.5,
  },
  btn: (color = "#3b82f6", disabled = false) => ({
    padding      : "12px 20px",
    background   : disabled ? "#1f2937" : color,
    color        : disabled ? "#4b5563" : "#fff",
    border       : "none",
    borderRadius : 8,
    fontSize     : 14,
    fontWeight   : 700,
    cursor       : disabled ? "not-allowed" : "pointer",
    fontFamily   : "monospace",
    opacity      : disabled ? 0.6 : 1,
  }),
  input: {
    width        : "100%",
    padding      : "11px 14px",
    background   : "#111c2d",
    border       : "1.5px solid rgba(255,255,255,0.1)",
    borderRadius : 8,
    color        : "#f1f5f9",
    fontSize     : 18,
    fontFamily   : "monospace",
    textAlign    : "center",
    letterSpacing: 8,
    outline      : "none",
    boxSizing    : "border-box",
  },
  log: {
    background   : "#020810",
    border       : "1px solid rgba(255,255,255,0.06)",
    borderRadius : 8,
    padding      : 14,
    fontSize     : 12,
    color        : "#94a3b8",
    maxHeight    : 300,
    overflowY    : "auto",
    lineHeight   : 1.7,
    whiteSpace   : "pre-wrap",
    wordBreak    : "break-all",
  },
  row: {
    display : "flex",
    gap     : 10,
  },
  ok  : { color: "#22c55e", fontWeight: 700 },
  err : { color: "#ef4444", fontWeight: 700 },
  warn: { color: "#f59e0b", fontWeight: 700 },
  hr  : {
    border      : "none",
    borderTop   : "1px solid rgba(255,255,255,0.07)",
    margin      : "4px 0",
  },
};

export default function TestOTP() {
  const [logs,    setLogs]    = useState([]);
  const [otp,     setOtp]     = useState("");
  const [loading, setLoading] = useState("");

  const token       = getToken();
  const tokenPreview= token
    ? `${token.slice(0, 20)}…${token.slice(-8)} (${token.length} chars)`
    : "❌ NOT FOUND";

  /* scan localStorage for all keys */
  const allKeys = Object.keys(localStorage);

  const log = (msg, type = "info") => {
    const ts   = new Date().toISOString().slice(11, 23);
    const mark = type === "ok" ? "✓" : type === "err" ? "✗" : type === "warn" ? "⚠" : "·";
    setLogs((p) => [`[${ts}] ${mark} ${msg}`, ...p]);
  };

  const divider = () => setLogs((p) => ["─".repeat(50), ...p]);

  /* ── Step 1: check status ── */
  const checkStatus = async () => {
    setLoading("status");
    divider();
    log("GET /api/verification/status");
    log(`Token: ${tokenPreview}`);
    log(`API: ${API}`);

    try {
      const res  = await fetch(`${API}/verification/status`, {
        headers: {
          "Content-Type" : "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
      });
      const text = await res.text();
      log(`HTTP ${res.status} ${res.statusText}`, res.ok ? "ok" : "err");

      try {
        const data = JSON.parse(text);
        log(`Response: ${JSON.stringify(data, null, 2)}`);
        if (data.email_verified !== undefined) {
          log(`email_verified: ${data.email_verified}`, data.email_verified ? "ok" : "warn");
        }
      } catch {
        log(`Raw response: ${text}`, "warn");
      }
    } catch (err) {
      log(`Network error: ${err.message}`, "err");
    }

    setLoading("");
  };

  /* ── Step 2: send OTP ── */
  const sendOtp = async () => {
    setLoading("send");
    divider();
    log("POST /api/verification/send-email-otp");
    log(`Token present: ${Boolean(token)}`);
    log(`Full URL: ${API}/verification/send-email-otp`);

    try {
      const res  = await fetch(`${API}/verification/send-email-otp`, {
        method  : "POST",
        headers : {
          "Content-Type" : "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
      });
      const text = await res.text();
      log(`HTTP ${res.status} ${res.statusText}`, res.ok ? "ok" : "err");

      try {
        const data = JSON.parse(text);
        log(`Response: ${JSON.stringify(data, null, 2)}`);

        if (data.success) {
          log("✓ OTP sent — check your email", "ok");
          if (data.dev_otp) {
            log(`DEV OTP: ${data.dev_otp}`, "warn");
          }
          if (data.email) {
            log(`Sent to: ${data.email}`, "ok");
          }
        } else {
          log(`Failed: ${data.message}`, "err");
        }
      } catch {
        log(`Raw: ${text}`, "warn");
      }
    } catch (err) {
      log(`Network error: ${err.message}`, "err");
      log("Is VITE_API_BASE_URL set correctly?", "warn");
    }

    setLoading("");
  };

  /* ── Step 3: verify OTP ── */
  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      log("Enter a 6-digit OTP first", "warn");
      return;
    }
    setLoading("verify");
    divider();
    log(`POST /api/verification/verify-email-otp  otp=${otp}`);

    try {
      const res  = await fetch(`${API}/verification/verify-email-otp`, {
        method  : "POST",
        headers : {
          "Content-Type" : "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ otp }),
      });
      const text = await res.text();
      log(`HTTP ${res.status} ${res.statusText}`, res.ok ? "ok" : "err");

      try {
        const data = JSON.parse(text);
        log(`Response: ${JSON.stringify(data, null, 2)}`);
        if (data.success) {
          log("EMAIL VERIFIED! trust_score=" + data.trust_score, "ok");
        } else {
          log(`Failed: ${data.message}`, "err");
        }
      } catch {
        log(`Raw: ${text}`, "warn");
      }
    } catch (err) {
      log(`Network error: ${err.message}`, "err");
    }

    setLoading("");
  };

  /* ── Step 4: raw fetch test ── */
  const rawTest = async () => {
    setLoading("raw");
    divider();
    log("Raw fetch test — no auth header");

    try {
      const res = await fetch(`${API}/health`);
      const data = await res.json();
      log(`/api/health → ${res.status}`, res.ok ? "ok" : "err");
      log(`DB: ${data.database ? "✓ connected" : "✗ down"}`, data.database ? "ok" : "err");
      log(`ENV: ${data.env}`);
      log(`Uptime: ${data.uptime_s}s`);
    } catch (err) {
      log(`Cannot reach ${API}/health — ${err.message}`, "err");
      log("VITE_API_BASE_URL may be wrong", "warn");
    }

    setLoading("");
  };

  /* ── clear logs ── */
  const clear = () => setLogs([]);

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* title */}
        <p style={S.title}>🔬 OTP Debug Panel</p>
        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
          Delete this page after confirming email delivery.
        </p>

        <hr style={S.hr} />

        {/* environment */}
        <div>
          <p style={S.label}>API Base URL</p>
          <p style={S.value}>{API}</p>
        </div>

        <div>
          <p style={S.label}>
            Auth Token
            {!token && (
              <span style={{ color: "#ef4444", marginLeft: 8 }}>
                ← THIS IS WHY IT FAILS
              </span>
            )}
          </p>
          <p style={{ ...S.value, color: token ? "#22c55e" : "#ef4444" }}>
            {tokenPreview}
          </p>
        </div>

        <div>
          <p style={S.label}>All localStorage Keys ({allKeys.length})</p>
          <p style={S.value}>
            {allKeys.length === 0
              ? "EMPTY — not logged in"
              : allKeys.join("\n")}
          </p>
        </div>

        <hr style={S.hr} />

        {/* action buttons */}
        <div style={S.row}>
          <button
            style={S.btn("#475569", loading === "raw")}
            onClick={rawTest}
            disabled={Boolean(loading)}
          >
            {loading === "raw" ? "…" : "1. Ping API"}
          </button>

          <button
            style={S.btn("#6366f1", loading === "status")}
            onClick={checkStatus}
            disabled={Boolean(loading)}
          >
            {loading === "status" ? "…" : "2. Check Status"}
          </button>

          <button
            style={S.btn("#3b82f6", loading === "send")}
            onClick={sendOtp}
            disabled={Boolean(loading)}
          >
            {loading === "send" ? "Sending…" : "3. Send OTP"}
          </button>
        </div>

        {/* OTP entry + verify */}
        <div>
          <p style={S.label}>Enter OTP (from email or dev_otp above)</p>
          <div style={S.row}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={S.input}
            />
            <button
              style={S.btn("#22c55e", loading === "verify" || otp.length !== 6)}
              onClick={verifyOtp}
              disabled={loading === "verify" || otp.length !== 6}
            >
              {loading === "verify" ? "…" : "4. Verify"}
            </button>
          </div>
        </div>

        <hr style={S.hr} />

        {/* log output */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={S.label}>Log Output</p>
            <button
              onClick={clear}
              style={{
                background   : "none",
                border       : "none",
                color        : "#475569",
                cursor       : "pointer",
                fontSize     : 12,
                fontFamily   : "monospace",
              }}
            >
              clear
            </button>
          </div>
          <div style={S.log}>
            {logs.length === 0
              ? "Click a button above to start testing…"
              : logs.map((l, i) => (
                <div
                  key={i}
                  style={
                    l.includes("✓") ? S.ok   :
                    l.includes("✗") ? S.err  :
                    l.includes("⚠") ? S.warn :
                    {}
                  }
                >
                  {l}
                </div>
              ))
            }
          </div>
        </div>

        {/* instructions */}
        <div style={{
          background   : "rgba(59,130,246,0.06)",
          border       : "1px solid rgba(59,130,246,0.15)",
          borderRadius : 8,
          padding      : "12px 14px",
          fontSize     : 12,
          color        : "#64748b",
          lineHeight   : 1.7,
        }}>
          <strong style={{ color: "#93c5fd" }}>How to use:</strong><br />
          1. Click <strong style={{ color: "#f1f5f9" }}>Ping API</strong> — confirms frontend can reach backend<br />
          2. Click <strong style={{ color: "#f1f5f9" }}>Check Status</strong> — confirms auth token works<br />
          3. Click <strong style={{ color: "#f1f5f9" }}>Send OTP</strong> — sends email (check inbox + spam)<br />
          4. Enter the 6-digit code and click <strong style={{ color: "#f1f5f9" }}>Verify</strong><br />
          <br />
          <strong style={{ color: "#fcd34d" }}>If token shows NOT FOUND:</strong> you are not logged in,
          or your app stores the token under a different localStorage key.
          Check DevTools → Application → Local Storage.
        </div>

      </div>
    </div>
  );
}