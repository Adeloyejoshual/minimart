// src/pages/AuthPage.jsx

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { locationsByState } from "../config/locationsByState";
import { countries, getFlag } from "../config/countries";
import "../styles/AuthPage.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const BASE = import.meta.env.VITE_API_BASE_URL;
const API  = `${BASE}/api/auth`;
const VAPI = `${BASE}/api/verification`;
const RAPI = `${BASE}/api/referrals`;

const OTP_LENGTH  = 6;
const RESEND_SECS = 60;

const STRENGTH_LEVELS = [
  { score: 0, label: "",       color: "transparent" },
  { score: 1, label: "Weak",   color: "#EF4444"     },
  { score: 2, label: "Fair",   color: "#F59E0B"     },
  { score: 3, label: "Good",   color: "#FF8040"     },
  { score: 4, label: "Strong", color: "#15803D"     },
];

const TRUST_ITEMS = [
  { icon: "Shield",      label: "Secure Payments", sub: "SSL encrypted"   },
  { icon: "Truck",       label: "Fast Delivery",   sub: "To your door"    },
  { icon: "CheckCircle", label: "Verified Sellers", sub: "Quality assured" },
  { icon: "Headphones",  label: "24/7 Support",    sub: "Always here"     },
];

const FEATURES = [
  { icon: "Zap",         title: "Fast Delivery",    desc: "Dispatched quickly to your door" },
  { icon: "Shield",      title: "Secure Payments",  desc: "SSL-encrypted checkout"          },
  { icon: "CheckCircle", title: "Verified Sellers", desc: "Every seller reviewed"           },
  { icon: "Headphones",  title: "Real Support",     desc: "Help when you need it"           },
];

/* ═══════════════════════════════════════════════════════════════
   PASSWORD STRENGTH
═══════════════════════════════════════════════════════════════ */
const getStrength = (pw) => {
  if (!pw) return { ...STRENGTH_LEVELS[0], checks: [] };
  const checks = [
    { label: "8+ chars",  met: pw.length >= 8          },
    { label: "Uppercase", met: /[A-Z]/.test(pw)         },
    { label: "Number",    met: /[0-9]/.test(pw)         },
    { label: "Symbol",    met: /[^A-Za-z0-9]/.test(pw)  },
  ];
  return { ...STRENGTH_LEVELS[checks.filter((c) => c.met).length], checks };
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Ic = {
  User: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Mail: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  Lock: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),
  Phone: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 015.19 12 19.79 19.79 0 012.12 3.33A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  Globe: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
  Pin: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Eye: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  EyeOff: ({ s = 17 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  Gift: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
    </svg>
  ),
  Check: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Shield: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Truck: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  Zap: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Arrow: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  CheckCircle: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  Headphones: ({ s = 15, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0118 0v6"/>
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z"/>
      <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
    </svg>
  ),
  Refresh: ({ s = 14 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  ),
  X: ({ s = 14, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
};

const IcMap = {
  Shield      : (c) => <Ic.Shield      s={14} c={c} />,
  Truck       : (c) => <Ic.Truck       s={14} c={c} />,
  CheckCircle : (c) => <Ic.CheckCircle s={14} c={c} />,
  Headphones  : (c) => <Ic.Headphones  s={14} c={c} />,
  Zap         : (c) => <Ic.Zap         s={14} c={c} />,
};

/* ═══════════════════════════════════════════════════════════════
   PARTICLE CANVAS
═══════════════════════════════════════════════════════════════ */
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
      w = r.width; h = r.height;
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
        q.x += q.vx; q.y += q.vy;
        if (q.x < -4) q.x = w + 4; if (q.x > w + 4) q.x = -4;
        if (q.y < -4) q.y = h + 4; if (q.y > h + 4) q.y = -4;
        const dx = q.x - ox, dy = q.y - oy, d = Math.hypot(dx, dy);
        if (d < 80 && d > 0) { q.x += dx * 0.005; q.y += dy * 0.005; }
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
      const r = canvas.getBoundingClientRect();
      mx.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onLeave = () => { mx.current = { x: -9999, y: -9999 }; };

    resize(); draw();
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
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

/* ═══════════════════════════════════════════════════════════════
   OTP CELLS
═══════════════════════════════════════════════════════════════ */
function OtpCells({ value, onChange, disabled, hasError }) {
  const refs = useRef([]);

  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const char   = (i) => value[i] ?? "";
  const update = (i, ch) => {
    const arr = Array.from({ length: OTP_LENGTH }, (_, k) => value[k] ?? "");
    arr[i] = ch;
    onChange(arr.join(""));
  };

  return (
    <div
      className={`ap-otp-group${hasError ? " ap-otp-group--error" : ""}`}
      role="group"
      aria-label="Code input"
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
          aria-label={`Digit ${i + 1}`}
          className={[
            "ap-otp-cell",
            char(i)  ? "ap-otp-cell--filled" : "",
            hasError ? "ap-otp-cell--error"  : "",
          ].join(" ")}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(-1);
            update(i, d);
            if (d && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (char(i)) update(i, "");
              else if (i > 0) {
                update(i - 1, "");
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === "ArrowLeft"  && i > 0)              refs.current[i - 1]?.focus();
            else if   (e.key === "ArrowRight" && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => {
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
            refs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN
═══════════════════════════════════════════════════════════════ */
function Countdown({ seconds, resendKey, onDone }) {
  const [left,    setLeft]  = useState(seconds);
  const onDoneRef           = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const id = setInterval(() => {
      setLeft((p) => {
        if (p <= 1) { clearInterval(id); onDoneRef.current?.(); return 0; }
        return p - 1;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [seconds, resendKey]);

  return (
    <span className={`ap-countdown${left <= 10 ? " ap-countdown--warn" : ""}`}>
      {left}s
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SMALL HELPERS
═══════════════════════════════════════════════════════════════ */
function Chevron() {
  return (
    <span className="ap-chev">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </span>
  );
}

function Spinner({ c = "#fff" }) {
  return (
    <svg className="ap-spinner" width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  );
}

function Badges() {
  return (
    <div className="ap-badges">
      <span className="ap-badge"><Ic.Shield s={11} c="#6B6560" /> SSL Secured</span>
      <span className="ap-badge"><Ic.Lock   s={11} c="#6B6560" /> Encrypted</span>
      <span className="ap-badge"><Ic.Check  s={11} c="#6B6560" /> GDPR</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INVITE CODE PREVIEW
═══════════════════════════════════════════════════════════════ */
function InviteCodePreview({ status, preview, onClear }) {
  if (!status) return null;

  if (status === "checking") {
    return (
      <div className="ap-invite-status ap-invite-status--checking">
        <Spinner c="#6B7280" />
        <span>Checking invite code…</span>
      </div>
    );
  }

  if (status === "valid" && preview) {
    return (
      <div className="ap-invite-status ap-invite-status--valid">
        {preview.avatar_url ? (
          <img
            src={preview.avatar_url}
            alt={preview.display_name}
            className="ap-invite-avatar"
          />
        ) : (
          <div className="ap-invite-avatar ap-invite-avatar--letter">
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
      <div className="ap-invite-status ap-invite-status--invalid">
        <Ic.X s={12} c="#DC2626" />
        <span>Invalid invite code — it won't be applied</span>
      </div>
    );
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   LEFT PANEL
═══════════════════════════════════════════════════════════════ */
function LeftPanel() {
  return (
    <div className="ap-left">
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

/* ═══════════════════════════════════════════════════════════════
   OTP PANEL
═══════════════════════════════════════════════════════════════ */
function OtpPanel({
  otp, setOtp,
  otpError, otpErrMsg,
  attemptsLeft,
  canResend, resendKey,
  resendLeft,
  devOtp, maskedEmail,
  verifyingRef,
  onResend, onSkip,
}) {
  return (
    <>
      <div className="ap-otp-header">
        <div className="ap-otp-icon-wrap">
          <Ic.Mail s={28} c="#fff" />
        </div>
        <h3 className="ap-otp-title">Check your email</h3>
        <p className="ap-otp-sub">
          We sent a 6-digit code to{" "}
          {maskedEmail ? <strong>{maskedEmail}</strong> : "your email address"}.
          Enter it below to verify your account.
        </p>
      </div>

      {devOtp && (
        <div className="ap-dev-otp">
          Dev mode — code: <strong>{devOtp}</strong>
        </div>
      )}

      <OtpCells
        value={otp}
        onChange={setOtp}
        disabled={verifyingRef.current}
        hasError={otpError}
      />

      <p className="ap-otp-hint">Auto-submits when all 6 digits are entered</p>

      {otpErrMsg && (
        <div className="ap-otp-error">
          {otpErrMsg}
          {attemptsLeft !== null && attemptsLeft > 0 && attemptsLeft <= 4 && (
            <span className="ap-otp-error__sub">
              {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
            </span>
          )}
        </div>
      )}

      <div className="ap-otp-resend">
        <div>
          {resendLeft === 0 ? (
            <span className="ap-otp-resend__limit">Daily limit reached — try tomorrow</span>
          ) : canResend ? (
            <button type="button" className="ap-otp-resend__btn" onClick={onResend}>
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
        <span className="ap-otp-resend__note"><Ic.Lock s={11} /> Never share this</span>
      </div>

      <div className="ap-otp-skip">
        <button type="button" className="ap-forgot" onClick={onSkip}>
          Skip for now — verify later
        </button>
      </div>

      <Badges />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AuthPage({ setUser }) {
  const navigate     = useNavigate();
  const location     = useLocation();
  const [params]     = useSearchParams();
  const from         = location.state?.from?.pathname || "/";

  /* ── mode ── */
  const [mode,     setMode]     = useState("login");
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);

  /* ── form ── */
  const [form, setForm] = useState({
    name         : "",
    email        : "",
    password     : "",
    phone_number : "",
    country      : "",
    state        : "",
    city         : "",
    invite_code  : "",
  });

  /* ── invite code validation ── */
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

  /* ═══════════════════════════════════════════════════════════
     AUTO-FILL INVITE CODE FROM URL
     Supports:
       /auth?ref=JOSHUA247
       /auth?code=JOSHUA247
       /auth?invite=JOSHUA247
       /invite/JOSHUA247 (via redirect)
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const refCode = (
      params.get("ref")    ||
      params.get("code")   ||
      params.get("invite") ||
      ""
    ).trim().toUpperCase();

    if (refCode && refCode.length >= 4) {
      setForm((f) => ({ ...f, invite_code: refCode }));
      validateInviteCode(refCode);
      /* Auto-switch to register if user arrived via invite link */
      setMode("register");
    }
  }, [params]);

  /* ═══════════════════════════════════════════════════════════
     VALIDATE INVITE CODE
  ═══════════════════════════════════════════════════════════ */
  const validateInviteCode = useCallback(async (code) => {
    const clean = (code || "").trim().toUpperCase();
    if (!clean || clean.length < 4) {
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
          avatar_url   : data.avatar_url,
        });
      } else {
        setInviteStatus("invalid");
        setInvitePreview(null);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setInviteStatus("invalid");
      } else {
        setInviteStatus(null);
      }
      setInvitePreview(null);
    }
  }, []);

  /* ═══════════════════════════════════════════════════════════
     FORM HANDLERS
  ═══════════════════════════════════════════════════════════ */
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
    const raw   = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    setForm((f) => ({ ...f, invite_code: raw }));

    clearTimeout(inviteDebounce.current);
    if (!raw || raw.length < 4) {
      setInviteStatus(null);
      setInvitePreview(null);
      return;
    }
    inviteDebounce.current = setTimeout(() => {
      validateInviteCode(raw);
    }, 600);
  }, [validateInviteCode]);

  const clearInviteCode = useCallback(() => {
    setForm((f) => ({ ...f, invite_code: "" }));
    setInviteStatus(null);
    setInvitePreview(null);
  }, []);

  const switchMode = useCallback((m) => {
    setMode(m);
    setShowPw(false);
    setOtp("");
    setOtpError(false);
    setOtpErrMsg("");
  }, []);

  const isNigeria     = form.country === "Nigeria";
  const nigeriaStates = useMemo(() => Object.keys(locationsByState).sort(), []);
  const cities        = useMemo(() => {
    if (isNigeria && form.state && locationsByState[form.state])
      return locationsByState[form.state];
    return [];
  }, [isNigeria, form.state]);

  const pw = useMemo(() => getStrength(form.password), [form.password]);

  /* ═══════════════════════════════════════════════════════════
     SEND OTP
  ═══════════════════════════════════════════════════════════ */
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

  /* ═══════════════════════════════════════════════════════════
     LOGIN
  ═══════════════════════════════════════════════════════════ */
  const handleLogin = async () => {
    if (!form.email || !form.password)
      return toast.error("Please enter your email and password.");

    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/login`, {
        email    : form.email.trim().toLowerCase(),
        password : form.password,
      });
      setUser(data.user, data.token, navigate, from);
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     REGISTER
  ═══════════════════════════════════════════════════════════ */
  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password)
      return toast.error("Please fill in the required fields.");

    setLoading(true);
    try {
      /* Build payload — only include invite_code if valid */
      const payload = {
        name         : form.name.trim(),
        email        : form.email.trim().toLowerCase(),
        password     : form.password,
        phone_number : form.phone_number || null,
        country      : form.country      || null,
        state        : form.state        || null,
        city         : form.city         || null,
      };

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

      toast.success("Account created! Check your email for the verification code.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     VERIFY OTP
  ═══════════════════════════════════════════════════════════ */
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
      return () => { clearTimeout(t); autoRef.current = false; };
    }
  }, [otp, mode, verifyOtp]);

  const handleResend = async () => {
    setCanResend(false);
    setResendKey((k) => k + 1);
    setOtp("");
    setOtpError(false);
    setOtpErrMsg("");
    setDevOtp("");
    await sendOtp();
    toast.success("New code sent!");
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (mode === "login")    handleLogin();
    if (mode === "register") handleRegister();
  };

  /* ═══════════════════════════════════════════════════════════
     OTP MODE
  ═══════════════════════════════════════════════════════════ */
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

  /* ═══════════════════════════════════════════════════════════
     LOGIN / REGISTER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div className="ap">
      <LeftPanel />
      <div className="ap-right">
        <div className="ap-right-scroll">
          <div className="ap-box">

            {/* Tabs */}
            <div className="ap-tabs">
              <button
                type="button"
                className={`ap-tab${mode === "login" ? " active" : ""}`}
                onClick={() => switchMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={`ap-tab${mode === "register" ? " active" : ""}`}
                onClick={() => switchMode("register")}
              >
                Register
              </button>
            </div>

            {/* Heading */}
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

            {/* ── Invite Code Banner (show when valid code from URL) ── */}
            {mode === "register" && inviteStatus === "valid" && invitePreview && (
              <div className="ap-invite-banner">
                <Ic.Gift s={18} c="#15803D" />
                <div>
                  <strong>{invitePreview.display_name}</strong> invited you to join Loemart!
                  <br />
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    You'll both earn rewards when you sign up
                  </span>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={onSubmit}>
              <div className="ap-form">

                {/* Name */}
                {mode === "register" && (
                  <div className="ap-field">
                    <label className="ap-label">Full Name</label>
                    <div className="ap-iw">
                      <span className="ap-icon"><Ic.User /></span>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your full name"
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="ap-field">
                  <label className="ap-label">Email</label>
                  <div className="ap-iw">
                    <span className="ap-icon"><Ic.Mail /></span>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Email address"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="ap-field">
                  <label className="ap-label">
                    Password
                    {mode === "login" && (
                      <button
                        type="button"
                        className="ap-forgot"
                        onClick={() => navigate("/forgot-password")}
                      >
                        Forgot?
                      </button>
                    )}
                  </label>
                  <div className="ap-iw">
                    <span className="ap-icon"><Ic.Lock /></span>
                    <input
                      name="password"
                      type={showPw ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Password"
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                    />
                    <button
                      type="button"
                      className="ap-eye"
                      onClick={() => setShowPw((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPw ? <Ic.EyeOff /> : <Ic.Eye />}
                    </button>
                  </div>

                  {mode === "register" && form.password && (
                    <div className="ap-pw">
                      <div className="ap-pw-bars">
                        {[1, 2, 3, 4].map((v) => (
                          <div
                            key={v}
                            className={`ap-pw-bar${pw.score >= v ? " ap-pw-bar--on" : ""}`}
                            style={pw.score >= v ? { background: pw.color } : {}}
                          />
                        ))}
                      </div>
                      <div className="ap-pw-label" style={{ color: pw.color }}>
                        {pw.label}
                      </div>
                      <div className="ap-pw-checks">
                        {pw.checks.map((c, i) => (
                          <span
                            key={i}
                            className={`ap-pw-check ${c.met ? "ap-pw-check--met" : "ap-pw-check--no"}`}
                          >
                            {c.met
                              ? <Ic.Check s={9} c="#15803D" />
                              : <span style={{
                                  width: 9, height: 9, display: "inline-block",
                                  borderRadius: "50%", border: "1.5px solid #B0AAA3",
                                }} />
                            }
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ══════════════════════════════════════════
                    INVITE CODE FIELD — Register only
                ══════════════════════════════════════════ */}
                {mode === "register" && (
                  <div className="ap-field">
                    <label className="ap-label">
                      Invite Code
                      <span className="ap-label-opt">Optional</span>
                    </label>
                    <div className="ap-iw" style={{
                      borderColor:
                        inviteStatus === "valid"   ? "#22C55E" :
                        inviteStatus === "invalid" ? "#EF4444" : undefined,
                    }}>
                      <span className="ap-icon">
                        <Ic.Gift s={17} c={
                          inviteStatus === "valid"   ? "#15803D" :
                          inviteStatus === "invalid" ? "#DC2626" : "currentColor"
                        } />
                      </span>
                      <input
                        name="invite_code"
                        value={form.invite_code}
                        onChange={handleInviteChange}
                        placeholder="e.g. JOSHUA247"
                        maxLength={20}
                        autoComplete="off"
                        spellCheck={false}
                        style={{
                          textTransform : "uppercase",
                          letterSpacing : form.invite_code ? "1.5px" : undefined,
                          fontWeight    : form.invite_code ? 700 : undefined,
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

                    {/* Invite code status preview */}
                    <InviteCodePreview
                      status={inviteStatus}
                      preview={invitePreview}
                      onClear={clearInviteCode}
                    />
                  </div>
                )}

                {/* Register extras */}
                {mode === "register" && (
                  <>
                    <div className="ap-field">
                      <label className="ap-label">
                        Phone Number
                        <span className="ap-label-opt">Optional</span>
                      </label>
                      <div className="ap-iw">
                        <span className="ap-icon"><Ic.Phone /></span>
                        <input
                          name="phone_number"
                          value={form.phone_number}
                          onChange={handleChange}
                          placeholder="Phone number"
                          autoComplete="tel"
                        />
                      </div>
                    </div>

                    <div className="ap-field">
                      <label className="ap-label">Country</label>
                      <div className="ap-iw">
                        <span className="ap-icon"><Ic.Globe /></span>
                        <select
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

                    <div className="ap-row">
                      <div className="ap-field">
                        <label className="ap-label">State</label>
                        <div className="ap-iw">
                          <span className="ap-icon"><Ic.Pin /></span>
                          {isNigeria ? (
                            <>
                              <select
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
                              name="state"
                              value={form.state}
                              onChange={handleChange}
                              placeholder="State / Region"
                            />
                          )}
                        </div>
                      </div>

                      <div className="ap-field">
                        <label className="ap-label">
                          City
                          <span className="ap-label-opt">Optional</span>
                        </label>
                        <div className="ap-iw">
                          <span className="ap-icon"><Ic.Pin /></span>
                          {isNigeria && cities.length > 0 ? (
                            <>
                              <select
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
                              name="city"
                              value={form.city}
                              onChange={handleChange}
                              placeholder={
                                isNigeria && !form.state ? "Select state first" : "City"
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Remember me */}
                {mode === "login" && (
                  <div className="ap-opts">
                    <label
                      className="ap-remember"
                      onClick={(e) => {
                        e.preventDefault();
                        setRemember((v) => !v);
                      }}
                    >
                      <span className={`ap-checkbox${remember ? " ap-checkbox--on" : ""}`}>
                        {remember && <Ic.Check s={10} c="#fff" />}
                      </span>
                      Remember me
                    </label>
                  </div>
                )}

                <button type="submit" className="ap-submit" disabled={loading}>
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

            <p className="ap-switch">
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "
              }
              <a onClick={() => switchMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Register" : "Login"}
              </a>
            </p>

            <p className="ap-terms">
              By continuing you agree to our{" "}
              <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>
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