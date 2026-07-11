// ════════════════════════════════════════════════════════════
// FILE: src/pages/AuthPage.jsx
// ════════════════════════════════════════════════════════════

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  useNavigate,
  useLocation,
  useSearchParams,
  useParams,
  Navigate,
} from "react-router-dom";
import axios  from "axios";
import toast  from "react-hot-toast";
import { locationsByState } from "../config/locationsByState";
import { countries, getFlag } from "../config/countries";
import "../styles/AuthPage.css";

/* ════════════════════════════════════════════════════════════
   CONFIG
════════════════════════════════════════════════════════════ */
const BASE = import.meta.env.VITE_API_BASE_URL;
const API  = `${BASE}/api/auth`;
const VAPI = `${BASE}/api/verification`;
const RAPI = `${BASE}/api/referrals`;

const OTP_LENGTH  = 6;
const RESEND_SECS = 60;

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const STRENGTH_LEVELS = [
  { score: 0, label: "",       color: "transparent" },
  { score: 1, label: "Weak",   color: "#EF4444"     },
  { score: 2, label: "Fair",   color: "#F59E0B"     },
  { score: 3, label: "Good",   color: "#FF8040"     },
  { score: 4, label: "Strong", color: "#15803D"     },
];

const TRUST_ITEMS = [
  { icon: "Shield",      label: "Secure Payments",  sub: "SSL encrypted"   },
  { icon: "Truck",       label: "Fast Delivery",    sub: "To your door"    },
  { icon: "CheckCircle", label: "Verified Sellers", sub: "Quality assured" },
  { icon: "Headphones",  label: "24/7 Support",     sub: "Always here"     },
];

const FEATURES = [
  { icon: "Zap",         title: "Fast Delivery",    desc: "Dispatched quickly to your door" },
  { icon: "Shield",      title: "Secure Payments",  desc: "SSL-encrypted checkout"          },
  { icon: "CheckCircle", title: "Verified Sellers", desc: "Every seller reviewed"           },
  { icon: "Headphones",  title: "Real Support",     desc: "Help when you need it"           },
];

const INITIAL_FORM = {
  name         : "",
  email        : "",
  password     : "",
  phone_number : "",
  country      : "",
  state        : "",
  city         : "",
  invite_code  : "",
};

/* Minimum length before we bother hitting the validate API */
const MIN_INVITE_LEN = 4;
const MAX_INVITE_LEN = 20;

/* ════════════════════════════════════════════════════════════
   PASSWORD STRENGTH
════════════════════════════════════════════════════════════ */
const getStrength = (pw) => {
  if (!pw) return { ...STRENGTH_LEVELS[0], checks: [] };
  const checks = [
    { label: "8+ chars",  met: pw.length >= 8         },
    { label: "Uppercase", met: /[A-Z]/.test(pw)        },
    { label: "Number",    met: /[0-9]/.test(pw)        },
    { label: "Symbol",    met: /[^A-Za-z0-9]/.test(pw) },
  ];
  return {
    ...STRENGTH_LEVELS[checks.filter((c) => c.met).length],
    checks,
  };
};

/* ════════════════════════════════════════════════════════════
   VALIDATION
════════════════════════════════════════════════════════════ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateLogin = (form) => {
  if (!form.email.trim())    return "Please enter your email address.";
  if (!EMAIL_RE.test(form.email.trim())) return "Please enter a valid email address.";
  if (!form.password)        return "Please enter your password.";
  return null;
};

const validateRegister = (form) => {
  if (!form.name.trim())     return "Please enter your full name.";
  if (!form.email.trim())    return "Please enter your email address.";
  if (!EMAIL_RE.test(form.email.trim())) return "Please enter a valid email address.";
  if (!form.password)        return "Please enter a password.";
  if (form.password.length < 8) return "Password must be at least 8 characters.";
  return null;
};

/* ════════════════════════════════════════════════════════════
   SANITISERS
════════════════════════════════════════════════════════════ */

/**
 * Cleans any raw invite-code input into the canonical format:
 * uppercase, alphanumeric only, max 20 chars.
 * Used consistently everywhere invite codes are read/written.
 */
const sanitizeInviteCode = (raw) =>
  String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_INVITE_LEN);

/* ════════════════════════════════════════════════════════════
   ICONS
════════════════════════════════════════════════════════════ */
const Ic = {
  User: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),

  Mail: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),

  Lock: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),

  Phone: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.19 12
               19.79 19.79 0 012.12 3.33A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7
               2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45
               c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),

  Globe: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10
               15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),

  Pin: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),

  Eye: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),

  EyeOff: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8
               a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4
               c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07
               a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),

  Gift: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
    </svg>
  ),

  Check: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),

  Shield: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),

  Truck: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5"  cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),

  Zap: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),

  Arrow: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),

  CheckCircle: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),

  Headphones: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0118 0v6"/>
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z"/>
      <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
    </svg>
  ),

  Refresh: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  ),

  X: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6"  x2="6"  y2="18"/>
      <line x1="6"  y1="6"  x2="18" y2="18"/>
    </svg>
  ),
};

/* Icon resolver for data-driven sections */
const IcMap = {
  Shield      : (c) => <Ic.Shield      s={14} c={c} />,
  Truck       : (c) => <Ic.Truck       s={14} c={c} />,
  CheckCircle : (c) => <Ic.CheckCircle s={14} c={c} />,
  Headphones  : (c) => <Ic.Headphones  s={14} c={c} />,
  Zap         : (c) => <Ic.Zap         s={14} c={c} />,
};

/* ════════════════════════════════════════════════════════════
   INVITE REDIRECT
   Handles /invite/:code → redirects to /auth?ref=CODE
   Add this to your router:
     <Route path="/invite/:code" element={<InviteRedirect />} />
════════════════════════════════════════════════════════════ */
export function InviteRedirect() {
  const { code } = useParams();
  const safeCode = sanitizeInviteCode(code);
  return <Navigate to={`/auth?ref=${safeCode}`} replace />;
}

/* ════════════════════════════════════════════════════════════
   PARTICLE CANVAS
════════════════════════════════════════════════════════════ */
function ParticleCanvas() {
  const ref = useRef(null);
  const pts = useRef([]);
  const mx  = useRef({ x: -9999, y: -9999 });
  const raf = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let w, h;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      pts.current = Array.from(
        { length: Math.min(30, Math.floor((w * h) / 18_000)) },
        () => ({
          x  : Math.random() * w,
          y  : Math.random() * h,
          vx : (Math.random() - 0.5) * 0.18,
          vy : (Math.random() - 0.5) * 0.18,
          r  : Math.random() * 1.1 + 0.4,
          o  : Math.random() * 0.07 + 0.02,
        })
      );
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const p = pts.current;
      const { x: ox, y: oy } = mx.current;

      for (const q of p) {
        q.x += q.vx;
        q.y += q.vy;
        if (q.x < -4)    q.x = w + 4;
        if (q.x > w + 4) q.x = -4;
        if (q.y < -4)    q.y = h + 4;
        if (q.y > h + 4) q.y = -4;

        const dx = q.x - ox;
        const dy = q.y - oy;
        const d  = Math.hypot(dx, dy);
        if (d < 80 && d > 0) {
          q.x += dx * 0.005;
          q.y += dy * 0.005;
        }

        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,80,0,${q.o})`;
        ctx.fill();
      }

      for (let i = 0; i < p.length; i++) {
        for (let j = i + 1; j < p.length; j++) {
          const d = Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y);
          if (d < 70) {
            ctx.beginPath();
            ctx.moveTo(p[i].x, p[i].y);
            ctx.lineTo(p[j].x, p[j].y);
            ctx.strokeStyle = `rgba(180,80,0,${0.025 * (1 - d / 70)})`;
            ctx.lineWidth   = 0.5;
            ctx.stroke();
          }
        }
      }

      raf.current = requestAnimationFrame(draw);
    };

    const onMove  = (e) => {
      const r    = canvas.getBoundingClientRect();
      mx.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mx.current = { x: -9999, y: -9999 }; };

    resize();
    draw();
    window.addEventListener("resize",     resize);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize",     resize);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position      : "absolute",
        inset         : 0,
        width         : "100%",
        height        : "100%",
        pointerEvents : "all",
        zIndex        : 0,
        opacity       : 0.45,
      }}
    />
  );
}

/* ════════════════════════════════════════════════════════════
   OTP CELLS
════════════════════════════════════════════════════════════ */
function OtpCells({ value, onChange, disabled, hasError }) {
  const refs = useRef([]);

  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const char   = (i) => value[i] ?? "";
  const update = (i, ch) => {
    const arr = Array.from(
      { length: OTP_LENGTH },
      (_, k) => value[k] ?? ""
    );
    arr[i] = ch;
    onChange(arr.join(""));
  };

  return (
    <div
      className={`ap-otp-group${hasError ? " ap-otp-group--error" : ""}`}
      role="group"
      aria-label="One-time code input"
    >
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={char(i)}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          className={[
            "ap-otp-cell",
            char(i)  ? "ap-otp-cell--filled" : "",
            hasError ? "ap-otp-cell--error"  : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            update(i, d);
            if (d && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (char(i)) {
                update(i, "");
              } else if (i > 0) {
                update(i - 1, "");
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === "ArrowLeft"  && i > 0)              refs.current[i - 1]?.focus();
            else if   (e.key === "ArrowRight" && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e)  => e.target.select()}
          onPaste={(e)  => {
            e.preventDefault();
            const digits = e.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, OTP_LENGTH);
            const result = Array.from(
              { length: OTP_LENGTH },
              (_, k) => digits[k] ?? ""
            ).join("");
            onChange(result);
            refs.current[
              Math.min(digits.length, OTP_LENGTH - 1)
            ]?.focus();
          }}
        />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   COUNTDOWN
════════════════════════════════════════════════════════════ */
function Countdown({ seconds, resendKey, onDone }) {
  const [left,    setLeft]  = useState(seconds);
  const onDoneRef           = useRef(onDone);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;

    const id = setInterval(() => {
      setLeft((p) => {
        if (p <= 1) {
          clearInterval(id);
          onDoneRef.current?.();
          return 0;
        }
        return p - 1;
      });
    }, 1_000);

    return () => clearInterval(id);
  }, [seconds, resendKey]);

  return (
    <span className={`ap-countdown${left <= 10 ? " ap-countdown--warn" : ""}`}
          aria-live="polite"
          aria-atomic="true">
      {left}s
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   SMALL HELPERS
════════════════════════════════════════════════════════════ */
function Chevron() {
  return (
    <span className="ap-chev" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2.5"
           strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </span>
  );
}

function Spinner({ c = "#fff" }) {
  return (
    <svg
      className="ap-spinner"
      width="18" height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

function Badges() {
  return (
    <div className="ap-badges" aria-label="Security badges">
      <span className="ap-badge"><Ic.Shield s={11} c="#6B6560" /> SSL Secured</span>
      <span className="ap-badge"><Ic.Lock   s={11} c="#6B6560" /> Encrypted</span>
      <span className="ap-badge"><Ic.Check  s={11} c="#6B6560" /> GDPR</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   INVITE CODE PREVIEW
════════════════════════════════════════════════════════════ */
function InviteCodePreview({ status, preview, onClear }) {
  if (!status) return null;

  if (status === "checking") {
    return (
      <div className="ap-invite-status ap-invite-status--checking" aria-live="polite">
        <Spinner c="#6B7280" />
        <span>Checking invite code…</span>
      </div>
    );
  }

  if (status === "valid" && preview) {
    return (
      <div
        className="ap-invite-status ap-invite-status--valid"
        role="status"
        aria-live="polite"
      >
        {preview.avatar_url ? (
          <img
            src={preview.avatar_url}
            alt={preview.display_name}
            className="ap-invite-avatar"
          />
        ) : (
          <div
            className="ap-invite-avatar ap-invite-avatar--letter"
            aria-hidden="true"
          >
            {preview.display_name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div className="ap-invite-info">
          <span className="ap-invite-valid-label">
            <Ic.CheckCircle s={12} c="#15803D" /> Valid invite code
          </span>
          <span className="ap-invite-inviter">
            Invited by <strong>{preview.display_name}</strong>
          </span>
        </div>
        {onClear && (
          <button
            type="button"
            className="ap-invite-clear"
            onClick={onClear}
            aria-label="Clear invite code"
          >
            <Ic.X s={12} c="#9CA3AF" />
          </button>
        )}
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div
        className="ap-invite-status ap-invite-status--invalid"
        role="alert"
        aria-live="assertive"
      >
        <Ic.X s={12} c="#DC2626" />
        <span>Invalid invite code — it won't be applied</span>
      </div>
    );
  }

  return null;
}

/* ════════════════════════════════════════════════════════════
   LEFT PANEL
════════════════════════════════════════════════════════════ */
function LeftPanel() {
  return (
    <div className="ap-left" aria-hidden="true">
      <div className="ap-blob ap-blob1" />
      <div className="ap-blob ap-blob2" />
      <ParticleCanvas />
      <div className="ap-left-inner">
        <div className="ap-logo">
          <div className="ap-logo-icon">
            <div className="ap-logo-ring" />
            <div className="ap-logo-bag">
              <div className="ap-logo-pin" />
            </div>
          </div>
          <span className="ap-logo-name">Loe<b>mart</b></span>
        </div>
        <div className="ap-hero">
          <div className="ap-hero-tag">Your everyday marketplace</div>
          <h2>Shop Smarter,<br /><em>Live Better.</em></h2>
          <p className="ap-hero-desc">
            Discover quality products from verified sellers. Fast delivery,
            secure checkout, and real support — every order.
          </p>
          <div className="ap-feats">
            {FEATURES.map((f) => (
              <div className="ap-feat" key={f.title}>
                <div className="ap-feat-icon">{IcMap[f.icon]?.("#FF5C00")}</div>
                <div className="ap-feat-text">
                  <strong>{f.title}</strong>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ap-trust-grid">
          {TRUST_ITEMS.map((t) => (
            <div className="ap-trust-item" key={t.label}>
              <div className="ap-trust-ic">{IcMap[t.icon]?.("#FF5C00")}</div>
              <div>
                <div className="ap-trust-label">{t.label}</div>
                <div className="ap-trust-sub">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PASSWORD STRENGTH METER
════════════════════════════════════════════════════════════ */
function PasswordStrength({ pw }) {
  if (!pw.checks?.length) return null;

  return (
    <div className="ap-pw" role="status" aria-live="polite">
      <div className="ap-pw-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((v) => (
          <div
            key={v}
            className={`ap-pw-bar${pw.score >= v ? " ap-pw-bar--on" : ""}`}
            style={pw.score >= v ? { background: pw.color } : {}}
          />
        ))}
      </div>
      <div
        className="ap-pw-label"
        style={{ color: pw.color }}
        aria-label={`Password strength: ${pw.label}`}
      >
        {pw.label}
      </div>
      <div className="ap-pw-checks">
        {pw.checks.map((c, i) => (
          <span
            key={i}
            className={`ap-pw-check ${c.met ? "ap-pw-check--met" : "ap-pw-check--no"}`}
            aria-label={`${c.label}: ${c.met ? "met" : "not met"}`}
          >
            {c.met ? (
              <Ic.Check s={9} c="#15803D" />
            ) : (
              <span
                aria-hidden="true"
                style={{
                  width        : 9,
                  height       : 9,
                  display      : "inline-block",
                  borderRadius : "50%",
                  border       : "1.5px solid #B0AAA3",
                }}
              />
            )}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   OTP PANEL
════════════════════════════════════════════════════════════ */
function OtpPanel({
  otp,
  setOtp,
  otpError,
  otpErrMsg,
  attemptsLeft,
  canResend,
  resendKey,
  resendLeft,
  devOtp,
  maskedEmail,
  verifyingRef,
  onResend,
  onSkip,
}) {
  return (
    <>
      <div className="ap-otp-header">
        <div className="ap-otp-icon-wrap" aria-hidden="true">
          <Ic.Mail s={28} c="#fff" />
        </div>
        <h3 className="ap-otp-title">Check your email</h3>
        <p className="ap-otp-sub">
          We sent a 6-digit code to{" "}
          {maskedEmail
            ? <strong>{maskedEmail}</strong>
            : "your email address"
          }.
          Enter it below to verify your account.
        </p>
      </div>

      {devOtp && (
        <div className="ap-dev-otp" role="note">
          Dev mode — code: <strong>{devOtp}</strong>
        </div>
      )}

      <OtpCells
        value={otp}
        onChange={setOtp}
        disabled={verifyingRef.current}
        hasError={otpError}
      />

      <p className="ap-otp-hint" aria-live="polite">
        Auto-submits when all {OTP_LENGTH} digits are entered
      </p>

      {otpErrMsg && (
        <div className="ap-otp-error" role="alert" aria-live="assertive">
          {otpErrMsg}
          {typeof attemptsLeft === "number" &&
           attemptsLeft > 0 &&
           attemptsLeft <= 4 && (
            <span className="ap-otp-error__sub">
              {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
            </span>
          )}
        </div>
      )}

      <div className="ap-otp-resend">
        <div>
          {resendLeft === 0 ? (
            <span className="ap-otp-resend__limit">
              Daily limit reached — try tomorrow
            </span>
          ) : canResend ? (
            <button
              type="button"
              className="ap-otp-resend__btn"
              onClick={onResend}
              aria-label="Resend verification code"
            >
              <Ic.Refresh s={13} /> Resend code
              {resendLeft !== null && (
                <span className="ap-otp-resend__count">({resendLeft} left)</span>
              )}
            </button>
          ) : (
            <span className="ap-otp-resend__timer">
              Resend in{" "}
              <Countdown
                key={resendKey}
                seconds={RESEND_SECS}
                resendKey={resendKey}
                onDone={() => {}}
              />
            </span>
          )}
        </div>
        <span className="ap-otp-resend__note">
          <Ic.Lock s={11} /> Never share this
        </span>
      </div>

      <div className="ap-otp-skip">
        <button
          type="button"
          className="ap-forgot"
          onClick={onSkip}
          aria-label="Skip email verification for now"
        >
          Skip for now — verify later
        </button>
      </div>

      <Badges />
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function AuthPage({ setUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const from     = location.state?.from?.pathname || "/";

  /* ── Mode ── */
  const [mode,     setMode]     = useState("login");
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);

  /* ── Form ── */
  const [form, setForm] = useState(INITIAL_FORM);

  /* ── Invite code ── */
  const [inviteStatus,  setInviteStatus]  = useState(null);
  const [invitePreview, setInvitePreview] = useState(null);
  const inviteDebounce                    = useRef(null);

  /* ── OTP ── */
  const [otp,          setOtp]          = useState("");
  const [otpError,     setOtpError]     = useState(false);
  const [otpErrMsg,    setOtpErrMsg]    = useState("");
  const [canResend,    setCanResend]    = useState(false);
  const [resendKey,    setResendKey]    = useState(0);
  const [resendLeft,   setResendLeft]   = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [maskedEmail,  setMaskedEmail]  = useState("");
  const [authToken,    setAuthToken]    = useState("");
  const [devOtp,       setDevOtp]       = useState("");

  const autoRef      = useRef(false);
  const verifyingRef = useRef(false);

  /* ════════════════════════════════════════════════════════
     VALIDATE INVITE CODE
     ⚠️ Defined BEFORE the useEffect below so it exists when
        that effect calls it on first render. This was the
        root cause of the invite code not showing — the effect
        ran before this function existed in the closure.
  ════════════════════════════════════════════════════════ */
  const validateInviteCode = useCallback(async (code) => {
    const clean = sanitizeInviteCode(code);

    if (clean.length < MIN_INVITE_LEN) {
      setInviteStatus(null);
      setInvitePreview(null);
      return;
    }

    setInviteStatus("checking");

    try {
      const { data } = await axios.get(
        `${RAPI}/validate/${encodeURIComponent(clean)}`
      );

      if (data.valid) {
        setInviteStatus("valid");
        setInvitePreview({
          display_name : data.display_name,
          avatar_url   : data.avatar_url ?? null,
        });
      } else {
        setInviteStatus("invalid");
        setInvitePreview(null);
      }
    } catch (err) {
      /* 404 = definitively invalid; anything else = network/server issue */
      setInviteStatus(err.response?.status === 404 ? "invalid" : null);
      setInvitePreview(null);
    }
  }, []); // no external deps — only calls setState

  /* ════════════════════════════════════════════════════════
     AUTO-FILL INVITE CODE FROM URL
     Supports: ?ref=  ?code=  ?invite=
     (Path-style /invite/:code is handled by <InviteRedirect />,
      which redirects to /auth?ref=CODE before this ever runs.)
  ════════════════════════════════════════════════════════ */
  useEffect(() => {
    const raw =
      params.get("ref")    ||
      params.get("code")   ||
      params.get("invite") ||
      "";

    const refCode = sanitizeInviteCode(raw);

    if (refCode.length >= MIN_INVITE_LEN) {
      setForm((f) => ({ ...f, invite_code: refCode }));
      setMode("register");
      validateInviteCode(refCode); // ✅ safe — defined above, in deps below
    }
  }, [params, validateInviteCode]); // ✅ correct deps, no eslint-disable needed

  /* ════════════════════════════════════════════════════════
     FORM HANDLERS
  ════════════════════════════════════════════════════════ */
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "country") { next.state = ""; next.city = ""; }
      if (name === "state")   { next.city  = ""; }
      return next;
    });
  }, []);

  const handleInviteChange = useCallback((e) => {
    const raw = sanitizeInviteCode(e.target.value);

    setForm((f) => ({ ...f, invite_code: raw }));
    clearTimeout(inviteDebounce.current);

    if (raw.length < MIN_INVITE_LEN) {
      setInviteStatus(null);
      setInvitePreview(null);
      return;
    }

    inviteDebounce.current = setTimeout(() => {
      validateInviteCode(raw);
    }, 600);
  }, [validateInviteCode]);

  const clearInviteCode = useCallback(() => {
    clearTimeout(inviteDebounce.current);
    setForm((f)   => ({ ...f, invite_code: "" }));
    setInviteStatus(null);
    setInvitePreview(null);
  }, []);

  /* Cleanup debounce timer on unmount */
  useEffect(() => () => clearTimeout(inviteDebounce.current), []);

  const switchMode = useCallback((m) => {
    setMode(m);
    setShowPw(false);
    setOtp("");
    setOtpError(false);
    setOtpErrMsg("");
  }, []);

  /* ── Derived location data ── */
  const isNigeria     = form.country === "Nigeria";
  const nigeriaStates = useMemo(() => Object.keys(locationsByState).sort(), []);
  const cities        = useMemo(() => {
    if (isNigeria && form.state && locationsByState[form.state])
      return locationsByState[form.state];
    return [];
  }, [isNigeria, form.state]);

  /* ── Password strength ── */
  const pw = useMemo(() => getStrength(form.password), [form.password]);

  /* ════════════════════════════════════════════════════════
     SEND OTP
  ════════════════════════════════════════════════════════ */
  const sendOtp = useCallback(async (token) => {
    const tok = token || authToken;
    try {
      const { data } = await axios.post(
        `${VAPI}/send-email-otp`,
        {},
        { headers: { Authorization: `Bearer ${tok}` } }
      );
      if (data.email)                         setMaskedEmail(data.email);
      if (typeof data.remaining === "number") setResendLeft(data.remaining);
      if (data.dev_otp)                       setDevOtp(data.dev_otp);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP.");
    }
  }, [authToken]);

  /* ════════════════════════════════════════════════════════
     LOGIN
  ════════════════════════════════════════════════════════ */
  const handleLogin = useCallback(async () => {
    const err = validateLogin(form);
    if (err) return toast.error(err);

    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/login`, {
        email    : form.email.trim().toLowerCase(),
        password : form.password,
        remember,
      });
      setUser(data.user, data.token, navigate, from);
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }, [form, remember, setUser, navigate, from]);

  /* ════════════════════════════════════════════════════════
     REGISTER
  ════════════════════════════════════════════════════════ */
  const handleRegister = useCallback(async () => {
    const err = validateRegister(form);
    if (err) return toast.error(err);

    setLoading(true);
    try {
      const payload = {
        name         : form.name.trim(),
        email        : form.email.trim().toLowerCase(),
        password     : form.password,
        phone_number : form.phone_number || null,
        country      : form.country      || null,
        state        : form.state        || null,
        city         : form.city         || null,
      };

      /* Only send invite_code when it passed validation */
      if (inviteStatus === "valid" && form.invite_code) {
        payload.invite_code = form.invite_code;
      }

      const { data } = await axios.post(`${API}/register`, payload);

      const token = data.token;
      setAuthToken(token);
      localStorage.setItem("marketplace_token", token);

      await sendOtp(token);

      setCanResend(false);
      setResendKey((k) => k + 1);
      setOtp("");
      setOtpError(false);
      setOtpErrMsg("");
      setDevOtp("");
      setMode("otp");

      toast.success(
        "Account created! Check your email for the verification code."
      );
    } catch (err) {
      /* Surface backend validation errors (e.g. INVALID_INVITE_CODE) clearly */
      const msg = err.response?.data?.message || "Registration failed.";
      toast.error(msg);

      /* If the invite code was rejected server-side, reflect that in the UI */
      if (err.response?.data?.code === "INVALID_INVITE_CODE") {
        setInviteStatus("invalid");
        setInvitePreview(null);
      }
    } finally {
      setLoading(false);
    }
  }, [form, inviteStatus, sendOtp]);

  /* ════════════════════════════════════════════════════════
     VERIFY OTP
  ════════════════════════════════════════════════════════ */
  const verifyOtp = useCallback(async (code) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setOtpErrMsg("");

    try {
      const { data } = await axios.post(
        `${VAPI}/verify-email-otp`,
        { otp: code },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (data.success) {
        toast.success("Email verified! Welcome to Loemart 🎉");
        setTimeout(() => navigate("/"), 800);
      }
    } catch (err) {
      const msg  = err.response?.data?.message || "Incorrect code.";
      const left = err.response?.data?.attemptsLeft;
      setOtpError(true);
      setOtp("");
      setOtpErrMsg(msg);
      if (typeof left === "number") setAttemptsLeft(left);
      setTimeout(() => setOtpError(false), 700);
    } finally {
      verifyingRef.current = false;
    }
  }, [authToken, navigate]);

  useEffect(() => {
    if (
      otp.length === OTP_LENGTH &&
      mode === "otp"            &&
      !autoRef.current          &&
      !verifyingRef.current
    ) {
      autoRef.current = true;
      const t = setTimeout(async () => {
        await verifyOtp(otp);
        autoRef.current = false;
      }, 180);
      return () => {
        clearTimeout(t);
        autoRef.current = false;
      };
    }
  }, [otp, mode, verifyOtp]);

  /* ════════════════════════════════════════════════════════
     RESEND OTP
  ════════════════════════════════════════════════════════ */
  const handleResend = useCallback(async () => {
    setCanResend(false);
    setResendKey((k) => k + 1);
    setOtp("");
    setOtpError(false);
    setOtpErrMsg("");
    setDevOtp("");
    await sendOtp();
    toast.success("New code sent!");
  }, [sendOtp]);

  /* ════════════════════════════════════════════════════════
     FORM SUBMIT DISPATCHER
  ════════════════════════════════════════════════════════ */
  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (mode === "login")    handleLogin();
      if (mode === "register") handleRegister();
    },
    [mode, handleLogin, handleRegister]
  );

  /* ════════════════════════════════════════════════════════
     OTP SCREEN
  ════════════════════════════════════════════════════════ */
  if (mode === "otp") {
    return (
      <div className="ap">
        <LeftPanel />
        <div className="ap-right">
          <div className="ap-right-scroll">
            <div className="ap-box">
              <OtpPanel
                otp={otp}
                setOtp={setOtp}
                otpError={otpError}
                otpErrMsg={otpErrMsg}
                attemptsLeft={attemptsLeft}
                canResend={canResend}
                resendKey={resendKey}
                resendLeft={resendLeft}
                devOtp={devOtp}
                maskedEmail={maskedEmail}
                verifyingRef={verifyingRef}
                onResend={handleResend}
                onSkip={() => {
                  toast("You can verify your email later from Account Settings.");
                  navigate("/");
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     LOGIN / REGISTER SCREEN
  ════════════════════════════════════════════════════════ */
  return (
    <div className="ap">
      <LeftPanel />

      <div className="ap-right">
        <div className="ap-right-scroll">
          <div className="ap-box">

            {/* ── Tab switcher ── */}
            <div className="ap-tabs" role="tablist" aria-label="Authentication mode">
              {[
                { key: "login",    label: "Login"    },
                { key: "register", label: "Register" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  className={`ap-tab${mode === key ? " active" : ""}`}
                  onClick={() => switchMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Heading ── */}
            <div className="ap-heading">
              <h3>
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h3>
              <p>
                {mode === "login"
                  ? "Enter your credentials to continue"
                  : "Fill in your details — we'll verify your email next"
                }
              </p>
            </div>

            {/* ── Invite banner (shown when a valid code is pre-filled) ── */}
            {mode === "register" && inviteStatus === "valid" && invitePreview && (
              <div className="ap-invite-banner" role="note">
                <Ic.Gift s={18} c="#15803D" />
                <div>
                  <strong>{invitePreview.display_name}</strong>{" "}
                  invited you to join Loemart!
                  <br />
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    You'll both earn rewards when you sign up
                  </span>
                </div>
              </div>
            )}

            {/* ── Form ── */}
            <form onSubmit={onSubmit} noValidate>
              <div className="ap-form">

                {/* Full Name */}
                {mode === "register" && (
                  <div className="ap-field">
                    <label className="ap-label" htmlFor="ap-name">
                      Full Name
                    </label>
                    <div className="ap-iw">
                      <span className="ap-icon" aria-hidden="true">
                        <Ic.User />
                      </span>
                      <input
                        id="ap-name"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your full name"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="ap-field">
                  <label className="ap-label" htmlFor="ap-email">
                    Email
                  </label>
                  <div className="ap-iw">
                    <span className="ap-icon" aria-hidden="true">
                      <Ic.Mail />
                    </span>
                    <input
                      id="ap-email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Email address"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="ap-field">
                  <label className="ap-label" htmlFor="ap-password">
                    Password
                    {mode === "login" && (
                      <button
                        type="button"
                        className="ap-forgot"
                        onClick={() => navigate("/forgot-password")}
                        aria-label="Forgot password"
                      >
                        Forgot?
                      </button>
                    )}
                  </label>
                  <div className="ap-iw">
                    <span className="ap-icon" aria-hidden="true">
                      <Ic.Lock />
                    </span>
                    <input
                      id="ap-password"
                      name="password"
                      type={showPw ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Password"
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                    />
                    <button
                      type="button"
                      className="ap-eye"
                      onClick={() => setShowPw((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                    >
                      {showPw ? <Ic.EyeOff /> : <Ic.Eye />}
                    </button>
                  </div>

                  {mode === "register" && form.password && (
                    <PasswordStrength pw={pw} />
                  )}
                </div>

                {/* ── Register-only fields ── */}
                {mode === "register" && (
                  <>
                    {/* Invite Code */}
                    <div className="ap-field">
                      <label className="ap-label" htmlFor="ap-invite-code">
                        Invite Code
                        <span className="ap-label-opt">Optional</span>
                      </label>
                      <div
                        className="ap-iw"
                        style={{
                          borderColor:
                            inviteStatus === "valid"   ? "#22C55E" :
                            inviteStatus === "invalid" ? "#EF4444" : undefined,
                        }}
                      >
                        <span className="ap-icon" aria-hidden="true">
                          <Ic.Gift
                            s={17}
                            c={
                              inviteStatus === "valid"   ? "#15803D" :
                              inviteStatus === "invalid" ? "#DC2626" : "currentColor"
                            }
                          />
                        </span>
                        <input
                          id="ap-invite-code"
                          name="invite_code"
                          value={form.invite_code}
                          onChange={handleInviteChange}
                          placeholder="e.g. JOSHUA247"
                          maxLength={MAX_INVITE_LEN}
                          autoComplete="off"
                          spellCheck={false}
                          aria-describedby="ap-invite-status"
                          style={{
                            textTransform : "uppercase",
                            letterSpacing : form.invite_code ? "1.5px"  : undefined,
                            fontWeight    : form.invite_code ? 700      : undefined,
                          }}
                        />
                        {form.invite_code && inviteStatus !== "checking" && (
                          <button
                            type="button"
                            className="ap-eye"
                            onClick={clearInviteCode}
                            aria-label="Clear invite code"
                            style={{ padding: 4 }}
                          >
                            <Ic.X s={14} c="#9CA3AF" />
                          </button>
                        )}
                      </div>

                      <div id="ap-invite-status">
                        <InviteCodePreview
                          status={inviteStatus}
                          preview={invitePreview}
                          onClear={clearInviteCode}
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="ap-field">
                      <label className="ap-label" htmlFor="ap-phone">
                        Phone Number
                        <span className="ap-label-opt">Optional</span>
                      </label>
                      <div className="ap-iw">
                        <span className="ap-icon" aria-hidden="true">
                          <Ic.Phone />
                        </span>
                        <input
                          id="ap-phone"
                          name="phone_number"
                          type="tel"
                          value={form.phone_number}
                          onChange={handleChange}
                          placeholder="Phone number"
                          autoComplete="tel"
                        />
                      </div>
                    </div>

                    {/* Country */}
                    <div className="ap-field">
                      <label className="ap-label" htmlFor="ap-country">
                        Country
                      </label>
                      <div className="ap-iw">
                        <span className="ap-icon" aria-hidden="true">
                          <Ic.Globe />
                        </span>
                        <select
                          id="ap-country"
                          name="country"
                          value={form.country}
                          onChange={handleChange}
                          className={form.country === "" ? "ap-empty" : ""}
                        >
                          <option value="" disabled>Select Country</option>
                          {countries.map((c) => (
                            <option key={c.code} value={c.name}>
                              {getFlag(c.code)} {c.name}
                            </option>
                          ))}
                        </select>
                        <Chevron />
                      </div>
                    </div>

                    {/* State + City */}
                    <div className="ap-row">
                      <div className="ap-field">
                        <label className="ap-label" htmlFor="ap-state">
                          State
                        </label>
                        <div className="ap-iw">
                          <span className="ap-icon" aria-hidden="true">
                            <Ic.Pin />
                          </span>
                          {isNigeria ? (
                            <>
                              <select
                                id="ap-state"
                                name="state"
                                value={form.state}
                                onChange={handleChange}
                                className={form.state === "" ? "ap-empty" : ""}
                              >
                                <option value="" disabled>Select State</option>
                                {nigeriaStates.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <Chevron />
                            </>
                          ) : (
                            <input
                              id="ap-state"
                              name="state"
                              value={form.state}
                              onChange={handleChange}
                              placeholder="State / Region"
                            />
                          )}
                        </div>
                      </div>

                      <div className="ap-field">
                        <label className="ap-label" htmlFor="ap-city">
                          City
                          <span className="ap-label-opt">Optional</span>
                        </label>
                        <div className="ap-iw">
                          <span className="ap-icon" aria-hidden="true">
                            <Ic.Pin />
                          </span>
                          {isNigeria && cities.length > 0 ? (
                            <>
                              <select
                                id="ap-city"
                                name="city"
                                value={form.city}
                                onChange={handleChange}
                                className={form.city === "" ? "ap-empty" : ""}
                              >
                                <option value="" disabled>Select City</option>
                                {cities.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <Chevron />
                            </>
                          ) : (
                            <input
                              id="ap-city"
                              name="city"
                              value={form.city}
                              onChange={handleChange}
                              placeholder={
                                isNigeria && !form.state
                                  ? "Select state first"
                                  : "City"
                              }
                              disabled={isNigeria && !form.state}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Remember me — login only */}
                {mode === "login" && (
                  <div className="ap-opts">
                    <label className="ap-remember" htmlFor="ap-remember">
                      <input
                        id="ap-remember"
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        style={{ display: "none" }}
                      />
                      <span
                        className={`ap-checkbox${remember ? " ap-checkbox--on" : ""}`}
                        aria-hidden="true"
                      >
                        {remember && <Ic.Check s={10} c="#fff" />}
                      </span>
                      Remember me
                    </label>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  className="ap-submit"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading ? (
                    <><Spinner /> Please wait…</>
                  ) : mode === "login" ? (
                    <>Login <Ic.Arrow s={17} /></>
                  ) : (
                    <>Create Account & Verify Email <Ic.Arrow s={17} /></>
                  )}
                </button>

              </div>
            </form>

            {/* ── Mode switcher ── */}
            <p className="ap-switch">
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "
              }
              <a
                role="button"
                tabIndex={0}
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    switchMode(mode === "login" ? "register" : "login");
                }}
                style={{ cursor: "pointer" }}
              >
                {mode === "login" ? "Register" : "Login"}
              </a>
            </p>

            <p className="ap-terms">
              By continuing you agree to our{" "}
              <a href="/terms"   target="_blank" rel="noreferrer">Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
            </p>

            <Badges />

          </div>
        </div>
      </div>
    </div>
  );
}