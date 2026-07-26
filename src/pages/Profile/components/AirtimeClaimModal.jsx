// src/pages/Profile/components/AirtimeClaimModal.jsx
import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import "../styles/AirtimeClaimModal.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;
const IS_DEV   = import.meta.env.DEV;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  null;

const authHeaders = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

/* ═══════════════════════════════════════════════════════════════
   NETWORKS
═══════════════════════════════════════════════════════════════ */
const NETWORKS = [
  { value: "mtn",     label: "MTN",     color: "#fbbf24" },
  { value: "airtel",  label: "Airtel",  color: "#dc2626" },
  { value: "glo",     label: "Glo",     color: "#16a34a" },
  { value: "9mobile", label: "9Mobile", color: "#0891b2" },
];

/* ═══════════════════════════════════════════════════════════════
   PHONE HELPERS
═══════════════════════════════════════════════════════════════ */
const detectNetwork = (num) => {
  if (!num) return null;
  const n      = String(num).replace(/\D/g, "");
  const prefix = n.startsWith("0") ? n.slice(0, 4) : "0" + n.slice(3, 6);

  const map = {
    mtn     : ["0803","0806","0703","0706","0813","0816","0810","0814",
               "0903","0906","0913","0704","0916"],
    airtel  : ["0802","0808","0701","0708","0812","0902","0907","0901",
               "0912","0904"],
    glo     : ["0805","0807","0705","0815","0811","0905","0915"],
    "9mobile": ["0809","0818","0817","0908","0909"],
  };

  for (const [network, prefixes] of Object.entries(map)) {
    if (prefixes.includes(prefix)) return network;
  }
  return null;
};

const normalisePhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  if (digits.length === 10)     return "0" + digits;
  return digits;
};

const formatPhone = (val) => {
  if (!val) return "";
  const d = String(val).replace(/\D/g, "").slice(0, 11);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
};

const maskPhone = (val) => {
  const d = String(val || "").replace(/\D/g, "");
  if (d.length < 7) return formatPhone(d);
  return `${d.slice(0, 4)} *** ${d.slice(-3)}`;
};

const isValidNgPhone = (num) => {
  const d = normalisePhone(num);
  return d.length === 11 && /^0[789][01]\d{8}$/.test(d);
};

/* ═══════════════════════════════════════════════════════════════
   SMART FETCH
   - AbortController timeout
   - HTML error page detection (Cloudflare, Nginx, Render)
   - Structured error objects with layer/code/status
═══════════════════════════════════════════════════════════════ */
const SERVER_ERROR_MESSAGES = {
  500 : "Our server ran into a problem.",
  502 : "Our server is temporarily unavailable.",
  503 : "Our service is down for maintenance.",
  504 : "The server is taking too long to respond.",
  520 : "Connection issue with our server.",
  521 : "Our server is offline.",
  522 : "Connection timed out.",
  523 : "Our server is unreachable.",
  524 : "The request took too long.",
};

async function smartFetch(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);
  const startTime  = Date.now();

  let res;
  let rawText = "";

  try {
    res     = await fetch(url, { ...options, signal: controller.signal });
    rawText = await res.text();
  } catch (netErr) {
    const duration = Date.now() - startTime;
    clearTimeout(timer);

    if (netErr.name === "AbortError") {
      console.error(`[AirtimeModal] Timeout after ${duration}ms:`, url);
      throw {
        status   : 0,
        code     : "TIMEOUT",
        layer    : "network",
        message  : `Request timed out after ${Math.round(timeoutMs / 1_000)}s. The server might be sleeping or overloaded.`,
        duration,
        url,
      };
    }

    console.error(`[AirtimeModal] Network error after ${duration}ms:`, netErr);
    throw {
      status   : 0,
      code     : "NETWORK_ERROR",
      layer    : "network",
      message  : "Network error. Please check your internet connection.",
      raw      : netErr.message,
      duration,
      url,
    };
  } finally {
    clearTimeout(timer);
  }

  const duration = Date.now() - startTime;
  const trimmed  = rawText.trim().toLowerCase();

  /* Detect HTML error pages from Cloudflare / Nginx / Render */
  if (
    trimmed.startsWith("<!doctype") ||
    trimmed.startsWith("<html")     ||
    trimmed.startsWith("<!--")
  ) {
    const titleMatch   = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title        = titleMatch?.[1]?.trim() ?? null;
    const isCloudflare = rawText.toLowerCase().includes("cloudflare");
    const isRender     = rawText.toLowerCase().includes("render");
    const isNginx      = rawText.toLowerCase().includes("nginx");

    const provider =
      isCloudflare ? "Cloudflare" :
      isRender     ? "Render"     :
      isNginx      ? "Nginx"      :
      "server";

    const friendly =
      SERVER_ERROR_MESSAGES[res.status] ||
      title                              ||
      `Server returned an error (${res.status})`;

    console.error(
      `[AirtimeModal] ${provider} returned HTML (${res.status}) for ${url} — ` +
      `title: "${title}" — ${duration}ms`
    );

    throw {
      status   : res.status,
      code     : "SERVER_UNAVAILABLE",
      layer    : "server",
      provider,
      message  : friendly,
      data     : null,
      duration,
      url,
    };
  }

  /* Parse JSON */
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { message: rawText.slice(0, 200) };
  }

  console.log(
    `[AirtimeModal] ${options.method || "GET"} ${url} → ${res.status} (${duration}ms)`,
    data
  );

  if (!res.ok || data?.success === false) {
    const msg =
      data?.message                    ||
      data?.error                      ||
      SERVER_ERROR_MESSAGES[res.status]||
      `Request failed (${res.status} ${res.statusText})`;

    throw {
      status   : res.status,
      code     : data?.code  || (res.status >= 500 ? "SERVER_UNAVAILABLE" : null),
      layer    : data?.layer || null,
      message  : msg,
      debug    : data?.debug || null,
      data,
      duration,
      url,
    };
  }

  return { ...data, __duration: duration };
}

/* ═══════════════════════════════════════════════════════════════
   DIAGNOSTIC RUNNER
   Uses explicit AbortController instead of AbortSignal.timeout
   for broad browser compatibility.
═══════════════════════════════════════════════════════════════ */
function makeTimeout(ms) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), ms);
  return {
    signal : controller.signal,
    clear  : () => clearTimeout(timer),
  };
}

async function runDiagnostics() {
  const startTime = Date.now();

  /* ── Test 1: Internet connectivity ── */
  const testInternet = async () => {
    const t0  = Date.now();
    const ctl = makeTimeout(8_000);
    try {
      /*
       * We ping our own origin instead of google.com/favicon.ico.
       * no-cors mode returns an opaque response that always "succeeds"
       * regardless of actual connectivity in some PWA environments.
       */
      await fetch(`${BASE_URL}/favicon.ico`, {
        cache  : "no-store",
        signal : ctl.signal,
      });
      return {
        name    : "Internet Connection",
        ok      : true,
        duration: Date.now() - t0,
        detail  : "Your device is online",
      };
    } catch (err) {
      return {
        name    : "Internet Connection",
        ok      : false,
        duration: Date.now() - t0,
        detail  : err.name === "AbortError"
          ? "Connectivity check timed out"
          : "No internet connection detected",
        error   : err.message,
      };
    } finally {
      ctl.clear();
    }
  };

  /* ── Test 2: API base reachable ── */
  const testApiReachable = async () => {
    const t0  = Date.now();
    const ctl = makeTimeout(10_000);
    try {
      const res    = await fetch(`${API}/health`, { signal: ctl.signal });
      const text   = await res.text();
      const isJson = text.trim().startsWith("{");
      return {
        name    : "API Reachable",
        ok      : res.ok && isJson,
        duration: Date.now() - t0,
        detail  : res.ok
          ? (isJson ? `API is up (${res.status})` : `API returned non-JSON (${res.status})`)
          : `API returned ${res.status}`,
        status  : res.status,
        isJson,
      };
    } catch (err) {
      return {
        name    : "API Reachable",
        ok      : false,
        duration: Date.now() - t0,
        detail  : err.name === "AbortError"
          ? "API timed out after 10s (server may be sleeping)"
          : "Cannot reach API server",
        error   : err.message,
      };
    } finally {
      ctl.clear();
    }
  };

  /* ── Test 3: Server-side diagnostics endpoint ── */
  const testServerDiag = async () => {
    const t0  = Date.now();
    const ctl = makeTimeout(15_000);
    try {
      const res = await fetch(`${API}/diagnostics`, {
        headers: authHeaders(),
        signal : ctl.signal,
      });
      if (!res.ok) {
        return {
          name    : "Server Diagnostics",
          ok      : false,
          duration: Date.now() - t0,
          detail  : `Endpoint returned ${res.status}`,
          status  : res.status,
        };
      }
      const data = await res.json();
      return {
        name    : "Server Diagnostics",
        ok      : true,
        duration: Date.now() - t0,
        detail  : "Diagnostic data received",
        data,
      };
    } catch (err) {
      return {
        name    : "Server Diagnostics",
        ok      : false,
        duration: Date.now() - t0,
        detail  : err.name === "AbortError"
          ? "Diagnostics endpoint timed out"
          : "Server diagnostic endpoint unavailable",
        error   : err.message,
      };
    } finally {
      ctl.clear();
    }
  };

  /* ── Test 4: Authentication token ── */
  const testAuth = async () => {
    const t0    = Date.now();
    const token = getToken();

    if (!token) {
      return {
        name    : "Authentication",
        ok      : false,
        duration: Date.now() - t0,
        detail  : "No auth token found in localStorage",
      };
    }

    const ctl = makeTimeout(10_000);
    try {
      const res    = await fetch(`${API}/users/me`, {
        headers: authHeaders(),
        signal : ctl.signal,
      });
      const text   = await res.text();
      const isJson = text.trim().startsWith("{");

      if (res.status === 401) {
        return {
          name    : "Authentication",
          ok      : false,
          duration: Date.now() - t0,
          detail  : "Token is invalid or expired",
          status  : 401,
        };
      }

      return {
        name    : "Authentication",
        ok      : res.ok && isJson,
        duration: Date.now() - t0,
        detail  : res.ok && isJson
          ? "Token is valid"
          : `Server returned ${res.status}${!isJson ? " (non-JSON)" : ""}`,
        status  : res.status,
      };
    } catch (err) {
      return {
        name    : "Authentication",
        ok      : false,
        duration: Date.now() - t0,
        detail  : err.name === "AbortError"
          ? "Auth check timed out"
          : "Could not verify token",
        error   : err.message,
      };
    } finally {
      ctl.clear();
    }
  };

  /* ── Test 5: Airtime endpoint ── */
  const testAirtimeEndpoint = async () => {
    const t0  = Date.now();
    const ctl = makeTimeout(10_000);
    try {
      const res    = await fetch(`${API}/airtime-coupons/phone-status`, {
        headers: authHeaders(),
        signal : ctl.signal,
      });
      const text   = await res.text();
      const isJson = text.trim().startsWith("{");

      return {
        name    : "Airtime API",
        ok      : res.ok && isJson,
        duration: Date.now() - t0,
        detail  : res.ok && isJson
          ? "Airtime endpoints are responding"
          : isJson
            ? `Failed with ${res.status}`
            : `Returned HTML instead of JSON (${res.status})`,
        status  : res.status,
      };
    } catch (err) {
      return {
        name    : "Airtime API",
        ok      : false,
        duration: Date.now() - t0,
        detail  : err.name === "AbortError"
          ? "Airtime endpoint timed out"
          : "Airtime endpoints unreachable",
        error   : err.message,
      };
    } finally {
      ctl.clear();
    }
  };

  const [internet, api, diag, auth, airtime] = await Promise.all([
    testInternet(),
    testApiReachable(),
    testServerDiag(),
    testAuth(),
    testAirtimeEndpoint(),
  ]);

  const results = [internet, api, diag, auth, airtime];

  const summary = {
    timestamp     : new Date().toISOString(),
    total_duration: Date.now() - startTime,
    api_url       : API,
    passed        : results.filter((r) => r.ok).length,
    failed        : results.filter((r) => !r.ok).length,
    results,
  };

  console.log("[AirtimeModal] Diagnostics complete:", summary);
  return summary;
}

/* ═══════════════════════════════════════════════════════════════
   ERROR LAYER CONFIG
═══════════════════════════════════════════════════════════════ */
const ERROR_LAYERS = {
  database : {
    icon: "🗄️", title: "Database Issue", color: "warn",
    tips: [
      "Our database is having trouble responding.",
      "This usually resolves within a few seconds.",
    ],
  },
  cache : {
    icon: "⚡", title: "Cache Issue", color: "warn",
    tips: [
      "Our cache service is temporarily down.",
      "Please retry — the request will bypass the cache.",
    ],
  },
  sms : {
    icon: "📵", title: "SMS Delivery Issue", color: "warn",
    tips: [
      "We couldn't send the SMS code.",
      "Check your phone number is correct and active.",
    ],
  },
  network : {
    icon: "🌐", title: "Connection Issue", color: "neutral",
    tips: [
      "Cannot reach our servers.",
      "Check your internet connection.",
    ],
  },
  auth : {
    icon: "🔒", title: "Authentication Issue", color: "err",
    tips: [
      "Your session may have expired.",
      "Please log out and log in again.",
    ],
  },
  server : {
    icon: "🔧", title: "Server Issue", color: "warn",
    tips: [
      "Something went wrong on our end.",
      "The server may be restarting or overloaded.",
    ],
  },
  input : {
    icon: "✏️", title: "Invalid Input", color: "err",
    tips: null,
  },
  policy : {
    icon: "🛡️", title: "Not Allowed", color: "err",
    tips: null,
  },
};

const ERROR_CODE_HINTS = {
  DB_UNAVAILABLE       : "Database connection failed.",
  TABLE_MISSING        : "A required database table is missing.",
  COLUMN_MISSING       : "A required database column is missing.",
  SQL_SYNTAX           : "Invalid SQL query.",
  DUPLICATE            : "This record already exists.",
  MISSING_FIELD        : "A required field is missing.",
  FK_VIOLATION         : "A referenced record does not exist.",
  DB_CONFLICT          : "Another request modified the data. Please retry.",
  RACE_CONDITION       : "The coupon was claimed by another request.",
  COUPON_NOT_FOUND     : "This coupon does not exist.",
  CACHE_UNAVAILABLE    : "Redis cache is not reachable.",
  SMS_NO_CREDIT        : "SMS provider is out of credit.",
  SMS_INVALID_NUMBER   : "SMS provider rejected the phone number.",
  SMS_RATE_LIMITED     : "SMS provider is rate-limiting us.",
  SMS_AUTH_FAILED      : "SMS provider auth failed (bad API key).",
  SMS_PROVIDER_ERROR   : "SMS delivery failed.",
  UPSTREAM_UNAVAILABLE : "Upstream service is unreachable.",
  AUTH_INVALID         : "Invalid or expired token.",
  USER_NOT_FOUND       : "Your account was not found.",
  SERVER_UNAVAILABLE   : "Server is unreachable.",
  NETWORK_ERROR        : "No internet connection.",
  TIMEOUT              : "Server took too long to respond.",
  INTERNAL_ERROR       : "Unexpected server error.",
  PHONE_NOT_VERIFIED   : "Phone number not verified yet.",
  PHONE_TAKEN          : "Phone number linked to another account.",
  RESEND_COOLDOWN      : "Please wait before resending.",
  RATE_LIMITED         : "Too many attempts.",
  CHANGE_COOLDOWN      : "Phone number was recently changed.",
  OTP_EXPIRED          : "OTP session expired.",
  OTP_INCORRECT        : "Wrong OTP code.",
  OTP_MAX_ATTEMPTS     : "Too many wrong OTP attempts.",
  INVALID_OTP_FORMAT   : "OTP must be 6 digits.",
  INVALID_PHONE        : "Phone number format is invalid.",
  UNKNOWN_NETWORK      : "Could not detect network from phone.",
  NOT_OWNER            : "You don't own this coupon.",
};

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */

/* ── Step Indicator ── */
function StepIndicator({ step }) {
  const steps = ["Phone", "Confirm", "Verify", "Done"];
  return (
    <div className="acm-steps">
      {steps.map((label, i) => {
        const num      = i + 1;
        const isActive = step === num;
        const isDone   = step > num;
        return (
          <div key={label} className="acm-step-item">
            <div
              className={[
                "acm-step-circle",
                isDone   ? "acm-step-circle--done"   : "",
                isActive ? "acm-step-circle--active" : "",
              ].filter(Boolean).join(" ")}
            >
              {isDone ? "✓" : num}
            </div>
            <span
              className={[
                "acm-step-label",
                isActive ? "acm-step-label--active" : "",
              ].filter(Boolean).join(" ")}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={[
                  "acm-step-line",
                  isDone ? "acm-step-line--done" : "",
                ].filter(Boolean).join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── OTP Input ── */
function OtpInput({ value, onChange, disabled }) {
  const refs   = useRef([]);
  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  const handleKey = (e, idx) => {
    if (e.key === "Backspace") {
      const next = [...digits];
      if (next[idx]) {
        next[idx] = "";
        onChange(next.join(""));
      } else if (idx > 0) {
        next[idx - 1] = "";
        onChange(next.join(""));
        refs.current[idx - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft"  && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) return;
    const next = [...digits];
    next[idx]  = val.slice(-1);
    onChange(next.join(""));
    if (idx < 5) refs.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="acm-otp-boxes">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={["acm-otp-box", d ? "acm-otp-box--filled" : ""]
            .filter(Boolean).join(" ")}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}

/* ── Diagnostic Panel ── */
function DiagnosticPanel({ diagnostics, running, onRun, onClose }) {
  if (!diagnostics && !running) return null;

  return (
    <div className="acm-diag" role="region" aria-label="System diagnostics">
      <div className="acm-diag-header">
        <span className="acm-diag-icon">🔍</span>
        <div className="acm-diag-title">
          <p className="acm-diag-heading">System Diagnostics</p>
          {diagnostics && (
            <p className="acm-diag-sub">
              {diagnostics.passed} passed · {diagnostics.failed} failed
              {" · "}{Math.round(diagnostics.total_duration / 1_000)}s
            </p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            className="acm-diag-close"
            onClick={onClose}
            aria-label="Close diagnostics"
          >
            ✕
          </button>
        )}
      </div>

      {running && (
        <div className="acm-diag-running">
          <span className="acm-spinner acm-spinner--sm" />
          Running tests…
        </div>
      )}

      {diagnostics && (
        <>
          <div className="acm-diag-list">
            {diagnostics.results.map((test, i) => (
              <div
                key={i}
                className={`acm-diag-item acm-diag-item--${test.ok ? "ok" : "fail"}`}
              >
                <span className="acm-diag-item-icon">
                  {test.ok ? "✅" : "❌"}
                </span>
                <div className="acm-diag-item-body">
                  <p className="acm-diag-item-name">{test.name}</p>
                  <p className="acm-diag-item-detail">{test.detail}</p>
                </div>
                <span className="acm-diag-item-time">{test.duration}ms</span>
              </div>
            ))}
          </div>

          {/* Server internals deep-dive */}
          {diagnostics.results.find((r) => r.name === "Server Diagnostics")?.data && (
            <details className="acm-diag-deep">
              <summary>Server internals ▾</summary>
              <pre>
                {JSON.stringify(
                  diagnostics.results.find(
                    (r) => r.name === "Server Diagnostics"
                  ).data,
                  null,
                  2
                )}
              </pre>
            </details>
          )}

          <div className="acm-diag-footer">
            <p className="acm-diag-info">
              <strong>API URL:</strong> <code>{diagnostics.api_url}</code>
            </p>
            <p className="acm-diag-info">
              <strong>Time:</strong> {diagnostics.timestamp}
            </p>
          </div>

          {onRun && (
            <button
              type="button"
              className="acm-diag-rerun"
              onClick={onRun}
              disabled={running}
            >
              🔄 Run Again
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ── Error Box ── */
function ErrorBox({ error, onRetry, loading, onDiagnose }) {
  const [expanded, setExpanded] = useState(false);

  if (!error) return null;

  /* Plain string errors */
  if (typeof error === "string") {
    return (
      <div className="acm-error acm-error--err" role="alert">
        <div className="acm-error-main">
          <span className="acm-error-icon">⚠️</span>
          <span className="acm-error-msg">{error}</span>
        </div>
      </div>
    );
  }

  /* Resolve layer from error object */
  let layer = error.layer;
  if (!layer) {
    if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT") layer = "network";
    else if (error.code === "SERVER_UNAVAILABLE")                    layer = "server";
    else if (error.status >= 500)                                    layer = "server";
    else if (error.status === 401)                                   layer = "auth";
  }

  const cfg      = layer ? ERROR_LAYERS[layer] : null;
  const codeHint = ERROR_CODE_HINTS[error.code];

  const isRetryable =
    layer && ["database", "cache", "sms", "network", "server"].includes(layer);

  const shouldOfferDiagnose =
    layer === "server"  ||
    layer === "network" ||
    (error.status >= 500) ||
    error.status === 0;

  const wrapperClass = cfg
    ? `acm-error acm-error--${cfg.color}`
    : "acm-error acm-error--err";

  return (
    <div className={wrapperClass} role="alert">
      <div className="acm-error-main">
        <span className="acm-error-icon">{cfg?.icon ?? "⚠️"}</span>
        <div className="acm-error-text">
          {cfg && <p className="acm-error-title">{cfg.title}</p>}
          <p className="acm-error-msg">{error.message}</p>
        </div>
        {error.status !== undefined && error.status !== 0 && (
          <span className="acm-error-code">HTTP {error.status}</span>
        )}
      </div>

      {/* Diagnostic pills */}
      {(error.code || layer || error.provider) && (
        <div className="acm-error-pills">
          {error.code && (
            <span className="acm-error-pill">
              <strong>Code:</strong> {error.code}
            </span>
          )}
          {layer && (
            <span className="acm-error-pill">
              <strong>Layer:</strong> {layer}
            </span>
          )}
          {error.provider && (
            <span className="acm-error-pill">
              <strong>From:</strong> {error.provider}
            </span>
          )}
          {error.duration && (
            <span className="acm-error-pill">
              <strong>Took:</strong> {error.duration}ms
            </span>
          )}
        </div>
      )}

      {/* Contextual tips */}
      {(codeHint || cfg?.tips) && (
        <ul className="acm-error-tips">
          {codeHint && <li className="acm-error-tip-hint">{codeHint}</li>}
          {cfg?.tips?.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}

      {/* Actions */}
      <div className="acm-error-actions">
        {onRetry && isRetryable && (
          <button
            type="button"
            className="acm-error-retry"
            onClick={onRetry}
            disabled={loading}
          >
            {loading
              ? <><span className="acm-spinner acm-spinner--sm" /> Retrying…</>
              : "🔄 Try Again"
            }
          </button>
        )}

        {shouldOfferDiagnose && onDiagnose && (
          <button
            type="button"
            className="acm-error-diagnose"
            onClick={onDiagnose}
            disabled={loading}
          >
            🔍 Run Diagnostics
          </button>
        )}

        {(error.debug || error.data) && (
          <button
            type="button"
            className="acm-error-toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide debug ▲" : "Show debug ▼"}
          </button>
        )}
      </div>

      {expanded && (error.debug || error.data) && (
        <pre className="acm-error-details">
          {JSON.stringify(error.debug ?? error.data, null, 2)}
        </pre>
      )}

      {error.url && (
        <p className="acm-error-url">
          <strong>Request:</strong> <code>{error.url}</code>
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP COMPONENTS
   Extracted for readability — each step receives only the props
   it needs, keeping the main modal render clean.
═══════════════════════════════════════════════════════════════ */

function StepPhone({
  phone, setPhone,
  network, setNetwork,
  error, setError,
  isPrefilledPhone, setIsPrefilledPhone,
  originalPhoneRef,
  prefilledNetwork,
  onContinue,
  runDiag, showDiag, diagResults, diagRunning,
}) {
  const phoneRaw = normalisePhone(phone);

  return (
    <div className="acm-body">
      <p className="acm-instruction">
        Enter the phone number where you want to receive the airtime.
      </p>

      {isPrefilledPhone && (
        <div className="acm-prefill-notice">
          <span className="acm-prefill-icon">📋</span>
          <div>
            <p className="acm-prefill-title">Using your registered number</p>
            <p className="acm-prefill-sub">Tap to edit if you want a different number.</p>
          </div>
        </div>
      )}

      <div className="acm-field">
        <label className="acm-label">
          Phone Number
          {isPrefilledPhone && (
            <span className="acm-registered-tag">Registered</span>
          )}
        </label>

        <div
          className={[
            "acm-phone-row",
            isPrefilledPhone ? "acm-phone-row--prefilled" : "",
          ].filter(Boolean).join(" ")}
        >
          <span className="acm-prefix">🇳🇬 +234</span>
          <input
            className="acm-phone-input"
            type="tel"
            placeholder="0812 345 6789"
            value={formatPhone(phoneRaw)}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              setPhone(raw);
              setError(null);
              setIsPrefilledPhone(raw === originalPhoneRef.current);
            }}
            maxLength={14}
            autoFocus={!isPrefilledPhone}
            inputMode="numeric"
            autoComplete="tel-national"
          />
          {phone && (
            <button
              className="acm-phone-clear"
              type="button"
              aria-label="Clear number"
              onClick={() => {
                setPhone("");
                setNetwork("");
                setIsPrefilledPhone(false);
                setError(null);
              }}
            >
              ✕
            </button>
          )}
        </div>

        {phoneRaw.length >= 4 && (
          <p className="acm-phone-hint">
            Will send to:{" "}
            <strong>+234 {formatPhone(phoneRaw).slice(1)}</strong>
          </p>
        )}
      </div>

      <div className="acm-field">
        <label className="acm-label">
          Network
          {network && (
            <span className="acm-auto-detect">
              {prefilledNetwork ? "✓ Saved" : "✓ Auto-detected"}
            </span>
          )}
        </label>
        <div className="acm-networks">
          {NETWORKS.map((n) => (
            <button
              key={n.value}
              type="button"
              className={[
                "acm-network-btn",
                network === n.value ? "acm-network-btn--active" : "",
              ].filter(Boolean).join(" ")}
              style={
                network === n.value
                  ? {
                      borderColor : n.color,
                      background  : n.color + "18",
                      color       : n.color,
                    }
                  : {}
              }
              onClick={() => {
                setNetwork(n.value);
                setError(null);
              }}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div className="acm-info-box">
        <span>ℹ️</span>
        <p>
          We will send a one-time code to verify this number.
          Airtime is credited within <strong>24 hours</strong>.
        </p>
      </div>

      <ErrorBox error={error} onDiagnose={runDiag} />

      {showDiag && (
        <DiagnosticPanel
          diagnostics={diagResults}
          running={diagRunning}
          onRun={runDiag}
          onClose={() => {/* handled by parent */}}
        />
      )}

      <button
        className="acm-primary-btn"
        type="button"
        onClick={onContinue}
        disabled={!phoneRaw || !network}
      >
        Continue →
      </button>
    </div>
  );
}

function StepConfirm({
  phone, network, coupon,
  error, loading,
  onSend, onBack,
  runDiag, showDiag, diagResults, diagRunning,
}) {
  const phoneRaw = normalisePhone(phone);
  const netCfg   = NETWORKS.find((n) => n.value === network);

  return (
    <div className="acm-body">
      <div className="acm-confirm-card">
        <div className="acm-confirm-icon">📲</div>
        <p className="acm-confirm-title">Send verification code?</p>
        <p className="acm-confirm-sub">We'll send a 6-digit SMS code to:</p>

        <div className="acm-confirm-number">
          {netCfg && (
            <span
              className="acm-network-tag"
              style={{ background: netCfg.color }}
            >
              {netCfg.label}
            </span>
          )}
          <span className="acm-confirm-phone">{formatPhone(phoneRaw)}</span>
        </div>

        <div className="acm-confirm-amount">
          <span className="acm-confirm-amount-label">Claiming</span>
          <span className="acm-confirm-amount-value">
            ₦{coupon?.value} Airtime
          </span>
        </div>
      </div>

      <div className="acm-confirm-warn">
        <span>⚠️</span>
        <p>
          Make sure this number is correct and active.
          The OTP will expire in <strong>10 minutes</strong>.
        </p>
      </div>

      <ErrorBox
        error={error}
        onRetry={onSend}
        loading={loading}
        onDiagnose={runDiag}
      />

      {showDiag && (
        <DiagnosticPanel
          diagnostics={diagResults}
          running={diagRunning}
          onRun={runDiag}
        />
      )}

      <button
        className="acm-primary-btn"
        type="button"
        onClick={onSend}
        disabled={loading}
      >
        {loading
          ? <><span className="acm-spinner" /> Sending…</>
          : "📨 Send Code Now"
        }
      </button>

      <button
        className="acm-ghost-btn"
        type="button"
        onClick={onBack}
        disabled={loading}
      >
        ← Change Number
      </button>
    </div>
  );
}

function StepVerify({
  phone, network,
  otp, setOtp,
  countdown, attemptsLeft,
  devOtp,
  error, loading,
  onVerify, onResend, onBack,
  runDiag, showDiag, diagResults, diagRunning,
}) {
  const phoneRaw = normalisePhone(phone);
  const netCfg   = NETWORKS.find((n) => n.value === network);

  return (
    <div className="acm-body">
      <div className="acm-otp-sent">
        <div className="acm-otp-sent-icon">💬</div>
        <p className="acm-instruction">Code sent! Check your SMS.</p>
        <p className="acm-phone-display">
          {netCfg && (
            <span
              className="acm-network-tag"
              style={{ background: netCfg.color }}
            >
              {netCfg.label}
            </span>
          )}
          {maskPhone(phoneRaw)}
        </p>

        {attemptsLeft !== null && attemptsLeft <= 1 && (
          <p className="acm-attempts-warn">
            ⚠️ {attemptsLeft} resend attempt
            {attemptsLeft !== 1 ? "s" : ""} left
          </p>
        )}
      </div>

      {/* Only shown in dev mode — never in production */}
      {IS_DEV && devOtp && (
        <div className="acm-dev-otp">
          <span>🔧 Dev Mode</span>
          <p>Your OTP: <strong>{devOtp}</strong></p>
        </div>
      )}

      <div className="acm-field">
        <label className="acm-label">Enter 6-digit code</label>
        <OtpInput
          value={otp}
          onChange={(val) => {
            setOtp(val);
          }}
          disabled={loading}
        />
      </div>

      <div className="acm-resend">
        {countdown > 0 ? (
          <p className="acm-resend-timer">
            Resend in <strong>{countdown}s</strong>
          </p>
        ) : (
          <button
            className="acm-resend-btn"
            type="button"
            onClick={onResend}
            disabled={loading}
          >
            Resend Code
          </button>
        )}
      </div>

      <ErrorBox
        error={error}
        onRetry={onVerify}
        loading={loading}
        onDiagnose={runDiag}
      />

      {showDiag && (
        <DiagnosticPanel
          diagnostics={diagResults}
          running={diagRunning}
          onRun={runDiag}
        />
      )}

      <button
        className="acm-primary-btn"
        type="button"
        onClick={onVerify}
        disabled={loading || otp.length < 6}
      >
        {loading
          ? <><span className="acm-spinner" /> Verifying…</>
          : "Verify & Claim Airtime ✓"
        }
      </button>

      <button
        className="acm-ghost-btn"
        type="button"
        onClick={onBack}
        disabled={loading}
      >
        ← Change Number
      </button>
    </div>
  );
}

function StepSuccess({ phone, network, coupon, onClose }) {
  const phoneRaw = normalisePhone(phone);
  const netCfg   = NETWORKS.find((n) => n.value === network);

  return (
    <div className="acm-body acm-body--success">
      <div className="acm-success-animation">
        <div className="acm-success-circle">
          <span className="acm-success-check">✓</span>
        </div>
      </div>

      <h3 className="acm-success-title">Claim Submitted!</h3>
      <p className="acm-success-msg">
        Your ₦{coupon?.value} airtime will be sent to
      </p>

      <p className="acm-success-phone">
        {netCfg && (
          <span
            className="acm-network-tag"
            style={{ background: netCfg.color }}
          >
            {netCfg.label}
          </span>
        )}
        {formatPhone(phoneRaw)}
      </p>

      <div className="acm-success-timeline">
        <div className="acm-timeline-item acm-timeline-item--done">
          <span className="acm-tl-dot" />
          <p>Phone number verified ✓</p>
        </div>
        <div className="acm-timeline-item acm-timeline-item--done">
          <span className="acm-tl-dot" />
          <p>Claim submitted ✓</p>
        </div>
        <div className="acm-timeline-item acm-timeline-item--pending">
          <span className="acm-tl-dot" />
          <p>Airtime credited <em>(within 24 hours)</em></p>
        </div>
      </div>

      <button
        className="acm-primary-btn"
        type="button"
        onClick={onClose}
      >
        Done
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN MODAL
═══════════════════════════════════════════════════════════════ */
export default function AirtimeClaimModal({
  isOpen,
  coupon,
  onClose,
  onSuccess,
  prefilledPhone   = "",
  prefilledNetwork = "",
}) {
  const [step,             setStep]             = useState(1);
  const [phone,            setPhone]            = useState("");
  const [network,          setNetwork]          = useState("");
  const [otp,              setOtp]              = useState("");
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState(null);
  const [countdown,        setCountdown]        = useState(0);
  const [attemptsLeft,     setAttemptsLeft]     = useState(null);
  const [isPrefilledPhone, setIsPrefilledPhone] = useState(false);
  const [devOtp,           setDevOtp]           = useState(null);

  /* Diagnostic state */
  const [showDiag,    setShowDiag]    = useState(false);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState(null);

  const timerRef         = useRef(null);
  const originalPhoneRef = useRef("");
  const mountedRef       = useRef(true);

  /* Track mount state to avoid setting state after unmount */
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* Countdown timer */
  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) setCountdown((c) => c - 1);
    }, 1_000);
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  /* Reset all state when modal opens */
  useEffect(() => {
    if (!isOpen) return;
    const clean = normalisePhone(prefilledPhone);
    originalPhoneRef.current = clean;

    setStep(1);
    setPhone(clean);
    setNetwork(prefilledNetwork || detectNetwork(clean) || "");
    setOtp("");
    setError(null);
    setCountdown(0);
    setAttemptsLeft(null);
    setDevOtp(null);
    setIsPrefilledPhone(!!clean);
    setShowDiag(false);
    setDiagResults(null);
  }, [isOpen, prefilledPhone, prefilledNetwork]);

  /* Auto-detect network as the user types */
  useEffect(() => {
    if (prefilledNetwork) return;
    const detected = detectNetwork(phone);
    if (detected && detected !== network) {
      setNetwork(detected);
    }
  }, [phone, network, prefilledNetwork]);

  /*
   * OTP auto-submit — use an effect so we never close over a stale
   * verifyAndClaim reference. The effect re-runs when `otp` changes
   * and only fires when the code is complete.
   */
  useEffect(() => {
    if (otp.length !== 6 || step !== 3 || loading) return;
    const timer = setTimeout(() => {
      if (mountedRef.current) verifyAndClaim();
    }, 300);
    return () => clearTimeout(timer);
    // verifyAndClaim is defined below with useCallback — safe to include
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step, loading]);

  /* ESC to close */
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isOpen, loading, onClose]);

  /* Backdrop click */
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && !loading) onClose();
  };

  /* Run diagnostics */
  const runDiag = useCallback(async () => {
    setShowDiag(true);
    setDiagRunning(true);
    setDiagResults(null);
    try {
      const results = await runDiagnostics();
      if (mountedRef.current) setDiagResults(results);
    } catch (err) {
      console.error("[AirtimeModal] Diagnostics failed:", err);
      if (mountedRef.current) {
        setDiagResults({
          timestamp     : new Date().toISOString(),
          total_duration: 0,
          api_url       : API,
          passed        : 0,
          failed        : 1,
          results       : [{
            name    : "Diagnostics Failed",
            ok      : false,
            duration: 0,
            detail  : "Could not complete diagnostics",
            error   : err.message,
          }],
        });
      }
    } finally {
      if (mountedRef.current) setDiagRunning(false);
    }
  }, []);

  /* Step 1 → 2 */
  const handleProceedToConfirm = () => {
    setError(null);
    if (!isValidNgPhone(phone)) {
      setError("Enter a valid 11-digit Nigerian number (e.g. 08012345678).");
      return;
    }
    if (!network) {
      setError("Please select your network provider.");
      return;
    }
    setStep(2);
  };

  /* Step 2 → 3 : send OTP */
  const sendOtp = useCallback(async () => {
    setLoading(true);
    setError(null);
    setShowDiag(false);

    try {
      const data = await smartFetch(
        `${API}/airtime-coupons/send-otp`,
        {
          method  : "POST",
          headers : authHeaders(),
          body    : JSON.stringify({
            phone   : normalisePhone(phone),
            network,       // included for reference; server re-detects
            purpose : "verify",
          }),
        }
      );

      /*
       * dev_otp is only present in non-production responses.
       * Guard IS_DEV on the frontend too for belt-and-suspenders.
       */
      if (IS_DEV && data.dev_otp) setDevOtp(data.dev_otp);

      setCountdown(Number(data.resend_after) || OTP_RESEND_COOLDOWN);

      if (typeof data.attempts_left === "number") {
        setAttemptsLeft(data.attempts_left);
      }

      setStep(3);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [phone, network]);

  /* Constant for the frontend countdown default */
  const OTP_RESEND_COOLDOWN = 60;

  /* Step 3 : verify OTP then redeem coupon */
  const verifyAndClaim = useCallback(async () => {
    if (otp.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError(null);
    setShowDiag(false);

    try {
      /*
       * verify-otp marks the phone as verified on the user account.
       * redeem then reads the verified phone from the DB — so the order
       * matters and is correct.
       */
      await smartFetch(
        `${API}/airtime-coupons/verify-otp`,
        {
          method  : "POST",
          headers : authHeaders(),
          body    : JSON.stringify({
            phone   : normalisePhone(phone),
            otp,
            purpose : "verify",
          }),
        }
      );

      const claimRes = await smartFetch(
        `${API}/airtime-coupons/redeem`,
        {
          method  : "POST",
          headers : authHeaders(),
          body    : JSON.stringify({ code: coupon?.code }),
        }
      );

      setStep(4);
      onSuccess?.(coupon?.code, {
        phone   : normalisePhone(phone),
        network : claimRes.coupon?.network || network,
        coupon  : claimRes.coupon,
        ...claimRes,
      });

    } catch (err) {
      /* If already redeemed concurrently, treat as success */
      if (
        err.code === "ALREADY_REDEEMED" ||
        err.code?.startsWith("ALREADY_")
      ) {
        setStep(4);
        onSuccess?.(coupon?.code, {
          phone   : normalisePhone(phone),
          network,
          alreadyRedeemed: true,
        });
        return;
      }

      setError(err);

      /* Clear OTP on any OTP-related error so user can re-enter */
      const isOtpErr =
        err.code?.startsWith("OTP_")             ||
        err.data?.remaining !== undefined         ||
        err.message?.toLowerCase().includes("otp")  ||
        err.message?.toLowerCase().includes("code");

      if (isOtpErr) setOtp("");

    } finally {
      setLoading(false);
    }
  }, [otp, phone, network, coupon?.code, onSuccess]);

  const resendOtp = useCallback(async () => {
    setOtp("");
    setError(null);
    setDevOtp(null);
    await sendOtp();
  }, [sendOtp]);

  const changeNumber = () => {
    setStep(1);
    setOtp("");
    setError(null);
    setDevOtp(null);
    setCountdown(0);
    setAttemptsLeft(null);
    setShowDiag(false);
  };

  if (!isOpen) return null;

  /* Shared diagnostic props passed to every step */
  const diagProps = {
    runDiag,
    showDiag,
    diagResults,
    diagRunning,
  };

  return (
    <div className="acm-backdrop" onClick={handleBackdrop}>
      <div className="acm-modal" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="acm-header">
          <div className="acm-header-left">
            <div className="acm-header-icon">📱</div>
            <div>
              <h2 className="acm-title">Claim Airtime</h2>
              <p className="acm-subtitle">
                ₦{coupon?.value} · {coupon?.code}
              </p>
            </div>
          </div>
          <button
            className="acm-close"
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <StepIndicator step={step} />

        {step === 1 && (
          <StepPhone
            phone={phone}               setPhone={setPhone}
            network={network}           setNetwork={setNetwork}
            error={error}               setError={setError}
            isPrefilledPhone={isPrefilledPhone}
            setIsPrefilledPhone={setIsPrefilledPhone}
            originalPhoneRef={originalPhoneRef}
            prefilledNetwork={prefilledNetwork}
            onContinue={handleProceedToConfirm}
            {...diagProps}
          />
        )}

        {step === 2 && (
          <StepConfirm
            phone={phone}
            network={network}
            coupon={coupon}
            error={error}
            loading={loading}
            onSend={sendOtp}
            onBack={changeNumber}
            {...diagProps}
          />
        )}

        {step === 3 && (
          <StepVerify
            phone={phone}
            network={network}
            otp={otp}                   setOtp={setOtp}
            countdown={countdown}
            attemptsLeft={attemptsLeft}
            devOtp={devOtp}
            error={error}
            loading={loading}
            onVerify={verifyAndClaim}
            onResend={resendOtp}
            onBack={changeNumber}
            {...diagProps}
          />
        )}

        {step === 4 && (
          <StepSuccess
            phone={phone}
            network={network}
            coupon={coupon}
            onClose={onClose}
          />
        )}

      </div>
    </div>
  );
}