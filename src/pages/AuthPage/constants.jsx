/* ════════════════════════════════════════════════════════════
   FILE: src/pages/AuthPage/constants.jsx
   Config · Icons · Helpers · Validation · Sanitisers
════════════════════════════════════════════════════════════ */

/* ── API ── */
export const BASE = import.meta.env.VITE_API_BASE_URL;
export const API  = `${BASE}/api/auth`;
export const VAPI = `${BASE}/api/verification`;
export const RAPI = `${BASE}/api/referrals`;

/* ── OTP / timing ── */
export const OTP_LENGTH   = 6;
export const RESEND_SECS  = 60;
export const MIN_INVITE_LEN = 4;
export const MAX_INVITE_LEN = 20;

/* ── Password strength ── */
export const STRENGTH_LEVELS = [
  { score: 0, label: "",       color: "transparent" },
  { score: 1, label: "Weak",   color: "#EF4444"     },
  { score: 2, label: "Fair",   color: "#F59E0B"     },
  { score: 3, label: "Good",   color: "#FF8040"     },
  { score: 4, label: "Strong", color: "#15803D"     },
];

export const TRUST_ITEMS = [
  { icon: "Shield",      label: "Secure Payments",  sub: "SSL encrypted"   },
  { icon: "Truck",       label: "Fast Delivery",    sub: "To your door"    },
  { icon: "CheckCircle", label: "Verified Sellers", sub: "Quality assured" },
  { icon: "Headphones",  label: "24/7 Support",     sub: "Always here"     },
];

export const FEATURES = [
  { icon: "Zap",         title: "Fast Delivery",    desc: "Dispatched quickly to your door" },
  { icon: "Shield",      title: "Secure Payments",  desc: "SSL-encrypted checkout"          },
  { icon: "CheckCircle", title: "Verified Sellers", desc: "Every seller reviewed"           },
  { icon: "Headphones",  title: "Real Support",     desc: "Help when you need it"           },
];

export const INITIAL_FORM = {
  name         : "",
  email        : "",
  password     : "",
  phone_number : "",
  country      : "",
  state        : "",
  city         : "",
  invite_code  : "",
};

/* ════════════════════════════════════════════════════════════
   ICONS
════════════════════════════════════════════════════════════ */
export const Ic = {
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
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5
               19.5 0 015.19 12 19.79 19.79 0 012.12 3.33A2 2 0 014.11 2h3
               a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11
               L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45
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

  /* ── Help / question mark ── */
  Help: ({ s = 17, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
         stroke={c} strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
};

/* Icon resolver for data-driven sections */
export const IcMap = {
  Shield      : (c) => <Ic.Shield      s={14} c={c} />,
  Truck       : (c) => <Ic.Truck       s={14} c={c} />,
  CheckCircle : (c) => <Ic.CheckCircle s={14} c={c} />,
  Headphones  : (c) => <Ic.Headphones  s={14} c={c} />,
  Zap         : (c) => <Ic.Zap         s={14} c={c} />,
};

/* ════════════════════════════════════════════════════════════
   PASSWORD STRENGTH
════════════════════════════════════════════════════════════ */
export const getStrength = (pw) => {
  if (!pw) return { ...STRENGTH_LEVELS[0], checks: [] };
  const checks = [
    { label: "8+ chars",  met: pw.length >= 8          },
    { label: "Uppercase", met: /[A-Z]/.test(pw)         },
    { label: "Number",    met: /[0-9]/.test(pw)         },
    { label: "Symbol",    met: /[^A-Za-z0-9]/.test(pw)  },
  ];
  return {
    ...STRENGTH_LEVELS[checks.filter((c) => c.met).length],
    checks,
  };
};

/* ════════════════════════════════════════════════════════════
   VALIDATION
════════════════════════════════════════════════════════════ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const validateLogin = (form) => {
  if (!form.email.trim())              return "Please enter your email address.";
  if (!EMAIL_RE.test(form.email.trim())) return "Please enter a valid email address.";
  if (!form.password)                  return "Please enter your password.";
  return null;
};

export const validateRegister = (form) => {
  if (!form.name.trim())               return "Please enter your full name.";
  if (!form.email.trim())              return "Please enter your email address.";
  if (!EMAIL_RE.test(form.email.trim())) return "Please enter a valid email address.";
  if (!form.password)                  return "Please enter a password.";
  if (form.password.length < 8)        return "Password must be at least 8 characters.";
  return null;
};

/* ════════════════════════════════════════════════════════════
   SANITISERS
════════════════════════════════════════════════════════════ */
export const sanitizeInviteCode = (raw) =>
  String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_INVITE_LEN);