// src/pages/AuthPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { locationsByState } from "../config/locationsByState";
import { countries, getFlag } from "../config/countries";
import "../styles/AuthPage.css";

const API = "https://minimart-ivrm.onrender.com/api/users";

/* ══════════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════════ */
const Ic = {
  Bag: ({ s = 28, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  User: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Mail: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  Lock: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  Phone: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  Globe: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  ),
  Pin: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Eye: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Check: ({ s = 16, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Shield: ({ s = 18, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Truck: ({ s = 18, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  Zap: ({ s = 18, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Arrow: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  CheckCircle: ({ s = 18, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Headphones: ({ s = 18, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" />
      <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
    </svg>
  ),
  Google: ({ s = 20 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
};

/* ══════════════════════════════════════════════════════════════
   PASSWORD STRENGTH
══════════════════════════════════════════════════════════════ */
const STRENGTH_LEVELS = [
  { score: 0, label: "",       color: "transparent" },
  { score: 1, label: "Weak",   color: "#EF4444" },
  { score: 2, label: "Fair",   color: "#F59E0B" },
  { score: 3, label: "Good",   color: "#FF8040" },
  { score: 4, label: "Strong", color: "#15803D" },
];

function getPasswordStrength(pw) {
  if (!pw) return { ...STRENGTH_LEVELS[0], checks: [] };
  const checks = [
    { label: "8+ chars",  met: pw.length >= 8 },
    { label: "Uppercase", met: /[A-Z]/.test(pw) },
    { label: "Number",    met: /[0-9]/.test(pw) },
    { label: "Symbol",    met: /[^A-Za-z0-9]/.test(pw) },
  ];
  const score = checks.filter((c) => c.met).length;
  return { ...STRENGTH_LEVELS[score], checks };
}

/* ══════════════════════════════════════════════════════════════
   PARTICLE CANVAS
══════════════════════════════════════════════════════════════ */
function ParticleCanvas() {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const mouse     = useRef({ x: -9999, y: -9999 });
  const rafId     = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let w, h;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles.current = Array.from(
        { length: Math.min(35, Math.floor((w * h) / 16000)) },
        () => ({
          x:  Math.random() * w,
          y:  Math.random() * h,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          r:  Math.random() * 1.2 + 0.4,
          o:  Math.random() * 0.07 + 0.02,
        })
      );
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const pts = particles.current;
      const { x: mx, y: my } = mouse.current;

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -5)    p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        if (p.y < -5)    p.y = h + 5;
        if (p.y > h + 5) p.y = -5;

        const dx = p.x - mx, dy = p.y - my;
        const d  = Math.hypot(dx, dy);
        if (d < 90 && d > 0) { p.x += dx * 0.005; p.y += dy * 0.005; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,80,0,${p.o})`;
        ctx.fill();
      }

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < 75) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(180,80,0,${0.02 * (1 - d / 75)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      rafId.current = requestAnimationFrame(draw);
    };

    const onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMouseLeave = () => { mouse.current = { x: -9999, y: -9999 }; };

    resize();
    draw();
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        pointerEvents: "all", zIndex: 0, opacity: 0.4,
      }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════
   CHEVRON
══════════════════════════════════════════════════════════════ */
function Chevron() {
  return (
    <span className="ap-chev">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   SPINNER (inline — used inside button)
══════════════════════════════════════════════════════════════ */
function Spinner() {
  return (
    <svg className="ap-spinner" width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   TRUST ITEMS DATA
══════════════════════════════════════════════════════════════ */
const TRUST_ITEMS = [
  { icon: <Ic.Shield s={14} c="#FF5C00" />,     label: "Secure Payments", sub: "SSL encrypted" },
  { icon: <Ic.Truck s={14} c="#FF5C00" />,      label: "Fast Delivery",   sub: "To your door" },
  { icon: <Ic.CheckCircle s={14} c="#FF5C00" />,label: "Verified Sellers",sub: "Quality assured" },
  { icon: <Ic.Headphones s={14} c="#FF5C00" />, label: "24/7 Support",    sub: "Always here" },
];

const FEATURES = [
  { icon: <Ic.Zap s={14} c="#FF5C00" />,        title: "Fast Delivery",    desc: "Dispatched quickly to your door" },
  { icon: <Ic.Shield s={14} c="#FF5C00" />,      title: "Secure Payments",  desc: "SSL-encrypted checkout" },
  { icon: <Ic.CheckCircle s={14} c="#FF5C00" />, title: "Verified Sellers", desc: "Every seller reviewed" },
  { icon: <Ic.Headphones s={14} c="#FF5C00" />,  title: "Real Support",     desc: "Help when you need it" },
];

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function AuthPage({ setUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Where user was before being sent to /auth
  const from = location.state?.from?.pathname || "/";

  const [mode,     setMode]     = useState("login");
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", password: "",
    phone_number: "", country: "", state: "", city: "",
  });

  /* ── form change ── */
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "country") { next.state = ""; next.city = ""; }
      if (name === "state")   { next.city  = ""; }
      return next;
    });
  }, []);

  const switchMode = useCallback((m) => {
    setMode(m);
    setShowPw(false);
  }, []);

  /* ── Nigeria location helpers ── */
  const isNigeria    = form.country === "Nigeria";
  const nigeriaStates = useMemo(() => Object.keys(locationsByState).sort(), []);
  const cities = useMemo(() => {
    if (isNigeria && form.state && locationsByState[form.state]) {
      return locationsByState[form.state];
    }
    return [];
  }, [isNigeria, form.state]);

  /* ── password strength ── */
  const pw = useMemo(() => getPasswordStrength(form.password), [form.password]);

  /* ══════════════════════════════════════════════
     LOGIN
  ══════════════════════════════════════════════ */
  const handleLogin = async () => {
    if (!form.email || !form.password)
      return toast.error("Please enter your email and password");

    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/login`, {
        email:    form.email.trim().toLowerCase(),
        password: form.password,
      });
      // Pass navigate + from so App.handleAuthSuccess can redirect correctly
      setUser(data.user, data.token, navigate, from);
    } catch (err) {
      console.error("Login error:", err);
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  /* ══════════════════════════════════════════════
     REGISTER
  ══════════════════════════════════════════════ */
  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password)
      return toast.error("Please fill in the required fields");

    setLoading(true);
    try {
      // Backend now returns token directly — no second /login needed
      const { data } = await axios.post(`${API}/register`, {
        name:         form.name.trim(),
        email:        form.email.trim().toLowerCase(),
        password:     form.password,
        phone_number: form.phone_number || null,
        country:      form.country      || null,
        state:        form.state        || null,
        city:         form.city         || null,
      });
      // New users always go to "/"
      setUser(data.user, data.token, navigate, "/");
    } catch (err) {
      console.error("Register error:", err);
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    mode === "login" ? handleLogin() : handleRegister();
  };

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="ap">

      {/* ══ LEFT PANEL ══ */}
      <div className="ap-left">
        <div className="ap-blob ap-blob1" />
        <div className="ap-blob ap-blob2" />
        <ParticleCanvas />

        <div className="ap-left-inner">

          {/* Logo */}
          <div className="ap-logo">
            <div className="ap-logo-icon">
              <div className="ap-logo-ring" />
              <Ic.Bag s={20} c="#fff" />
            </div>
            <span className="ap-logo-name">Mini<b>Mart</b></span>
          </div>

          {/* Hero */}
          <div className="ap-hero">
            <div className="ap-hero-tag">Your everyday marketplace</div>
            <h2>Shop Smarter,<br /><em>Live Better.</em></h2>
            <p className="ap-hero-desc">
              Discover quality products from verified sellers. Fast delivery,
              secure checkout, and real support — every order.
            </p>

            {/* Features list */}
            <div className="ap-feats">
              {FEATURES.map((f) => (
                <div className="ap-feat" key={f.title}>
                  <div className="ap-feat-icon">{f.icon}</div>
                  <div className="ap-feat-text">
                    <strong>{f.title}</strong>
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust grid */}
          <div className="ap-trust-grid">
            {TRUST_ITEMS.map((t) => (
              <div className="ap-trust-item" key={t.label}>
                <div className="ap-trust-ic">{t.icon}</div>
                <div>
                  <div className="ap-trust-label">{t.label}</div>
                  <div className="ap-trust-sub">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div className="ap-right">
        <div className="ap-right-scroll">
          <div className="ap-box">

            {/* Tabs */}
            <div className="ap-tabs">
              <button
                className={`ap-tab${mode === "login" ? " active" : ""}`}
                onClick={() => switchMode("login")}
                type="button"
              >
                Login
              </button>
              <button
                className={`ap-tab${mode === "register" ? " active" : ""}`}
                onClick={() => switchMode("register")}
                type="button"
              >
                Register
              </button>
            </div>

            {/* Heading */}
            <div className="ap-heading">
              <h3>{mode === "login" ? "Welcome back" : "Create your account"}</h3>
              <p>{mode === "login" ? "Enter your credentials to continue" : "Fill in your details to get started"}</p>
            </div>

            {/* Google */}
            <button className="ap-google" type="button">
              <Ic.Google /> Continue with Google
            </button>

            <div className="ap-divider">or use your email</div>

            {/* Form */}
            <form onSubmit={onSubmit}>
              <div className="ap-form">

                {/* Name — register only */}
                {mode === "register" && (
                  <div className="ap-field">
                    <label className="ap-label">Full Name</label>
                    <div className="ap-iw">
                      <span className="ap-icon"><Ic.User /></span>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Full Name"
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
                      <button type="button" className="ap-forgot">Forgot?</button>
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
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
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

                  {/* Strength meter — register only */}
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
                              ? <Ic.Check s={10} c="#15803D" />
                              : <span style={{ width: 10, height: 10, display: "inline-block", borderRadius: "50%", border: "1.5px solid #B0AAA3" }} />
                            }
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Register extra fields ── */}
                {mode === "register" && (
                  <>
                    {/* Phone */}
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
                          placeholder="Phone Number"
                          autoComplete="tel"
                        />
                      </div>
                    </div>

                    {/* Country */}
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

                    {/* State + City */}
                    <div className="ap-row">

                      {/* State */}
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

                      {/* City */}
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
                                isNigeria && !form.state
                                  ? "Select state first"
                                  : "City"
                              }
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
                    <label
                      className="ap-remember"
                      onClick={(e) => { e.preventDefault(); setRemember((v) => !v); }}
                    >
                      <span className={`ap-checkbox${remember ? " ap-checkbox--on" : ""}`}>
                        {remember && <Ic.Check s={11} c="#fff" />}
                      </span>
                      Remember me
                    </label>
                  </div>
                )}

                {/* Submit */}
                <button type="submit" className="ap-submit" disabled={loading}>
                  {loading ? (
                    <><Spinner /> Please wait...</>
                  ) : (
                    <>{mode === "login" ? "Login" : "Create Account"}<Ic.Arrow s={18} /></>
                  )}
                </button>

              </div>
            </form>

            {/* Switch mode */}
            <p className="ap-switch">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <a onClick={() => switchMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Register" : "Login"}
              </a>
            </p>

            {/* Terms */}
            <p className="ap-terms">
              By continuing you agree to our{" "}
              <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>
              {" "}and{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
            </p>

            {/* Trust badges */}
            <div className="ap-badges">
              <span className="ap-badge"><Ic.Shield s={12} c="#6B6560" /> SSL Secured</span>
              <span className="ap-badge"><Ic.Lock   s={12} c="#6B6560" /> Encrypted</span>
              <span className="ap-badge"><Ic.Check  s={12} c="#6B6560" /> GDPR</span>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}