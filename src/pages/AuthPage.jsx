// src/pages/AuthPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { locationsByState } from "../config/locationsByState";
import { countries, getFlag } from "../config/countries";

const API = "https://minimart-ivrm.onrender.com/api/users";

/* ══════════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════════ */
const I = {
  Bag: ({ s = 28, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  User: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
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
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  Phone: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  Globe: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  ),
  Pin: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Eye: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
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
      <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  Zap: ({ s = 18, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Arrow: ({ s = 18 }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  CheckCircle: ({ s = 18, c = "currentColor" }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
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
const getPW = (pw) => {
  if (!pw) return { score: 0, label: "", color: "transparent", checks: [] };
  let s = 0;
  const checks = [
    { label: "8+ chars", met: pw.length >= 8 },
    { label: "Uppercase", met: /[A-Z]/.test(pw) },
    { label: "Number", met: /[0-9]/.test(pw) },
    { label: "Symbol", met: /[^A-Za-z0-9]/.test(pw) },
  ];
  checks.forEach((c) => c.met && s++);
  return {
    ...[
      { score: 0, label: "", color: "transparent" },
      { score: 1, label: "Weak", color: "#EF4444" },
      { score: 2, label: "Fair", color: "#F59E0B" },
      { score: 3, label: "Good", color: "#FF8040" },
      { score: 4, label: "Strong", color: "#15803D" },
    ][s],
    checks,
  };
};

/* ══════════════════════════════════════════════════════════════
   PARTICLE CANVAS
══════════════════════════════════════════════════════════════ */
function ParticleCanvas() {
  const ref = useRef(null);
  const pts = useRef([]);
  const mouse = useRef({ x: -9999, y: -9999 });
  const raf = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let w, h;
    const resize = () => {
      const r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts.current = Array.from({ length: Math.min(35, Math.floor((w * h) / 16000)) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 1.2 + 0.4, o: Math.random() * 0.07 + 0.02,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const a = pts.current, mx = mouse.current.x, my = mouse.current.y;
      for (const p of a) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -5) p.x = w + 5; if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5; if (p.y > h + 5) p.y = -5;
        const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
        if (d < 90 && d > 0) { p.x += dx * 0.005; p.y += dy * 0.005; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,80,0,${p.o})`; ctx.fill();
      }
      for (let i = 0; i < a.length; i++) {
        for (let j = i + 1; j < a.length; j++) {
          const d = Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y);
          if (d < 75) {
            ctx.beginPath(); ctx.moveTo(a[i].x, a[i].y); ctx.lineTo(a[j].x, a[j].y);
            ctx.strokeStyle = `rgba(180,80,0,${0.02 * (1 - d / 75)})`; ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      raf.current = requestAnimationFrame(draw);
    };
    resize(); draw();
    window.addEventListener("resize", resize);
    c.addEventListener("mousemove", (e) => {
      const r = c.getBoundingClientRect();
      mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    c.addEventListener("mouseleave", () => { mouse.current = { x: -9999, y: -9999 }; });
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize", resize); };
  }, []);
  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "all", zIndex: 0, opacity: 0.4 }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════
   CHEVRON — for select dropdowns
══════════════════════════════════════════════════════════════ */
const Chev = () => (
  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#A8A39D", display: "flex", alignItems: "center", zIndex: 2 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </span>
);

/* ══════════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════════ */
const CSS = `
@keyframes _spin{to{transform:rotate(360deg)}}
@keyframes _up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes _fade{from{opacity:0}to{opacity:1}}
@keyframes _su{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes _glow{0%,100%{box-shadow:0 0 14px rgba(255,92,0,.12)}50%{box-shadow:0 0 28px rgba(255,92,0,.24)}}
@keyframes _shim{0%{background-position:-250% 0}100%{background-position:250% 0}}
@keyframes _ring{0%{transform:scale(.8);opacity:.5}80%,100%{transform:scale(2);opacity:0}}
@keyframes _pop{0%{transform:scale(0)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes _gmv{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes _b1{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}40%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%;transform:translate(14px,-10px)}70%{border-radius:50% 50% 40% 60%/40% 60% 50% 50%;transform:translate(-8px,8px)}}
@keyframes _b2{0%,100%{border-radius:40% 60% 70% 30%/40% 50% 60% 50%}50%{border-radius:60% 40% 30% 70%/60% 40% 70% 30%;transform:translate(-14px,14px)}}

.fp{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:flex;overflow:hidden;font-family:var(--fb);background:#F7F4EF}

/* LEFT */
.fp-l{flex:0 0 44%;position:relative;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(160deg,#FFF9F5 0%,#FFF1E8 45%,#FFE6D5 100%)}
.fp-blob{position:absolute;filter:blur(72px);opacity:.1;pointer-events:none;z-index:0}
.fp-blob1{width:280px;height:280px;background:#FF5C00;top:-80px;left:-60px;animation:_b1 16s ease-in-out infinite}
.fp-blob2{width:220px;height:220px;background:#FF8040;bottom:-60px;right:-60px;animation:_b2 14s ease-in-out infinite 3s}
.fp-l-in{position:relative;z-index:2;display:flex;flex-direction:column;height:100%;padding:36px 40px;overflow-y:auto}
.fp-l-in::-webkit-scrollbar{width:3px}.fp-l-in::-webkit-scrollbar-thumb{background:rgba(0,0,0,.06);border-radius:2px}
.fp-logo{display:flex;align-items:center;gap:12px;flex-shrink:0;margin-bottom:28px}
.fp-logo-icon{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#FF5C00,#FF8040);display:flex;align-items:center;justify-content:center;position:relative;animation:_glow 4s ease-in-out infinite;flex-shrink:0}
.fp-logo-ring{position:absolute;inset:-4px;border-radius:16px;border:2px solid rgba(255,92,0,.18);animation:_ring 3s ease-out infinite}
.fp-logo-name{font-family:var(--fd);font-size:21px;font-weight:700;letter-spacing:-.4px;color:#1C1714}
.fp-logo-name b{color:#FF5C00}
.fp-hero{flex:1;display:flex;flex-direction:column;justify-content:center;padding:8px 0 12px}
.fp-hero-tag{display:inline-flex;align-items:center;gap:5px;background:#FFF0E6;border:1px solid rgba(255,92,0,.14);border-radius:100px;padding:4px 11px;font-size:11px;font-weight:600;color:#C04800;width:fit-content;margin-bottom:14px}
.fp-hero h2{font-family:var(--fd);font-size:clamp(24px,2.4vw,36px);font-weight:700;line-height:1.18;color:#1C1714;margin-bottom:12px;letter-spacing:-.4px}
.fp-hero h2 em{font-style:normal;color:#FF5C00}
.fp-hero-desc{font-size:clamp(13px,1vw,14.5px);color:#6B6560;line-height:1.7;max-width:340px}
.fp-feats{display:flex;flex-direction:column;gap:4px;margin-top:22px}
.fp-feat{display:flex;align-items:center;gap:11px;padding:7px 11px;border-radius:10px;transition:background .25s;cursor:default;animation:_su .4s ease both}
.fp-feat:hover{background:rgba(255,92,0,.04)}
.fp-feat:nth-child(2){animation-delay:.06s}.fp-feat:nth-child(3){animation-delay:.12s}.fp-feat:nth-child(4){animation-delay:.18s}
.fp-feat-icon{width:34px;height:34px;border-radius:9px;background:#FFFFFF;border:1px solid rgba(255,92,0,.1);box-shadow:0 1px 4px rgba(255,92,0,.05);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .25s}
.fp-feat:hover .fp-feat-icon{background:#FFF0E6;transform:scale(1.04)}
.fp-feat-text{font-size:clamp(11.5px,.85vw,13px);color:#6B6560;line-height:1.3}
.fp-feat-text strong{display:block;color:#1C1714;font-weight:700;font-size:clamp(12px,.9vw,13.5px)}
.fp-trust-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:auto;padding-top:18px;border-top:1px solid rgba(0,0,0,.06);flex-shrink:0}
.fp-trust-item{display:flex;align-items:center;gap:7px;padding:8px 10px;background:#FFFFFF;border:1px solid rgba(0,0,0,.05);border-radius:9px;box-shadow:0 1px 3px rgba(0,0,0,.03)}
.fp-trust-ic{width:28px;height:28px;border-radius:7px;background:#FFF0E6;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.fp-trust-label{font-size:11px;font-weight:700;color:#2D2820;line-height:1.25}
.fp-trust-sub{font-size:10px;color:#8A847C;font-weight:400}

/* RIGHT */
.fp-r{flex:1;display:flex;flex-direction:column;background:#FFFFFF;border-left:1px solid #EAE6E0;overflow:hidden}
.fp-r-scroll{flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:28px 48px 40px}
.fp-r-scroll::-webkit-scrollbar{width:4px}
.fp-r-scroll::-webkit-scrollbar-track{background:#F7F4EF}
.fp-r-scroll::-webkit-scrollbar-thumb{background:#D8D4CE;border-radius:2px}
.fp-r-box{width:100%;max-width:400px;margin-top:auto;margin-bottom:auto;animation:_up .5s cubic-bezier(.22,1,.36,1)}

.fp-tabs{display:flex;background:#F3F0EB;border-radius:12px;padding:3px;margin-bottom:22px;gap:2px}
.fp-tab{flex:1;padding:10px 12px;border:none;border-radius:9px;font-size:13.5px;font-weight:600;cursor:pointer;background:transparent;color:#8A847C;transition:all .25s;font-family:var(--fb)}
.fp-tab.on{color:#C04800;background:#FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.03)}
.fp-tab:not(.on):hover{color:#5A5650}
.fp-hd{margin-bottom:18px}
.fp-hd h3{font-family:var(--fd);font-size:clamp(20px,1.8vw,24px);font-weight:700;color:#1C1714;margin-bottom:4px;letter-spacing:-.3px}
.fp-hd p{font-size:13px;color:#6B6560;line-height:1.5}
.fp-google{width:100%;padding:11px;border:1.5px solid #DDD9D3;border-radius:10px;background:#FFFFFF;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;font-size:13.5px;font-weight:600;color:#1C1714;transition:all .2s;font-family:var(--fb)}
.fp-google:hover{border-color:#C8C2BA;background:#FAFAF8;box-shadow:0 2px 6px rgba(0,0,0,.04);transform:translateY(-1px)}
.fp-google:active{transform:translateY(0)}
.fp-div{display:flex;align-items:center;gap:12px;margin:14px 0;color:#A8A39D;font-size:11px;font-weight:600;letter-spacing:.6px;text-transform:uppercase}
.fp-div::before,.fp-div::after{content:'';flex:1;height:1px;background:#E8E4DE}

/* FORM */
.fp-form{display:flex;flex-direction:column;gap:12px}
.fp-row{display:flex;gap:10px}
.fp-row .fp-field{flex:1;min-width:0}
.fp-field{animation:_su .3s ease both}
.fp-label{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:700;color:#2D2820;margin-bottom:5px}
.fp-label-opt{font-weight:400;color:#A8A39D;font-size:11px}

/* Input wrapper — position:relative so Chev can absolute-position */
.fp-iw{
  display:flex;align-items:center;
  border:1.5px solid #DDD9D3;border-radius:10px;
  background:#FFFFFF;
  transition:border-color .2s,box-shadow .2s;
  overflow:visible;
  position:relative;
}
.fp-iw:focus-within{border-color:#FF5C00;box-shadow:0 0 0 3px rgba(255,92,0,.08)}
.fp-iw:hover:not(:focus-within){border-color:#C8C2BA}
.fp-ii{display:flex;align-items:center;justify-content:center;width:40px;flex-shrink:0;color:#A8A39D;transition:color .2s;z-index:1}
.fp-iw:focus-within .fp-ii{color:#FF5C00}

/* Text inputs */
.fp-iw input{
  flex:1;padding:11px 10px 11px 0;border:none;outline:none;
  font-size:14px;font-family:var(--fb);color:#1C1714;
  background:transparent;min-width:0;
}
.fp-iw input::placeholder{color:#B0AAA3}

/* Select dropdowns — native but styled */
.fp-iw select{
  flex:1;
  padding:11px 32px 11px 0;
  border:none;outline:none;
  font-size:14px;font-family:var(--fb);
  color:#1C1714;background:transparent;
  min-width:0;cursor:pointer;
  -webkit-appearance:none;-moz-appearance:none;appearance:none;
  position:relative;z-index:1;
}
.fp-iw select.empty{color:#B0AAA3}
.fp-iw select option{color:#1C1714;background:#FFFFFF}
.fp-iw select option[value=""]{color:#B0AAA3}
.fp-iw select option:disabled{color:#B0AAA3}

.fp-eye{background:none;border:none;padding:0 10px;cursor:pointer;color:#A8A39D;display:flex;align-items:center;transition:color .2s;z-index:1}
.fp-eye:hover{color:#5A5650}

/* PW */
.fp-pw{margin-top:7px;animation:_fade .3s ease}
.fp-pw-bars{display:flex;gap:3px;margin-bottom:5px}
.fp-pw-bar{flex:1;height:3px;border-radius:2px;background:#E8E4DE;transition:all .3s}
.fp-pw-bar.on{transform:scaleY(1.4)}
.fp-pw-lbl{font-size:11px;font-weight:700;margin-bottom:5px}
.fp-pw-cks{display:flex;flex-wrap:wrap;gap:4px}
.fp-pw-ck{display:flex;align-items:center;gap:3px;font-size:10px;padding:2px 6px;border-radius:5px;transition:all .2s;font-weight:600}
.fp-pw-ck.y{color:#15803D;background:#DCFCE7}
.fp-pw-ck.n{color:#8A847C;background:#F3F0EB}
.fp-pw-ck.y svg{animation:_pop .3s ease}

.fp-opts{display:flex;align-items:center;justify-content:space-between;margin-top:2px}
.fp-rem{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#3D3830;cursor:pointer;user-select:none;font-weight:500}
.fp-cb{width:17px;height:17px;border-radius:5px;border:1.5px solid #C8C2BA;display:flex;align-items:center;justify-content:center;background:#FFFFFF;transition:all .2s;flex-shrink:0}
.fp-cb.on{background:#FF5C00;border-color:#FF5C00}
.fp-forgot{font-size:12.5px;color:#C04800;font-weight:700;cursor:pointer;background:none;border:none;font-family:var(--fb);transition:color .2s}
.fp-forgot:hover{color:#FF5C00;text-decoration:underline}

.fp-cta{width:100%;padding:13px 22px;border:none;border-radius:12px;background:linear-gradient(135deg,#FF5C00 0%,#FF8040 100%);background-size:200% 200%;animation:_gmv 5s ease infinite;color:#FFFFFF;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .25s cubic-bezier(.22,1,.36,1);position:relative;overflow:hidden;margin-top:6px;font-family:var(--fb);letter-spacing:.15px}
.fp-cta::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 20%,rgba(255,255,255,.18) 50%,transparent 80%);background-size:250% 100%;opacity:0;transition:opacity .4s}
.fp-cta:hover::after{opacity:1;animation:_shim 1.8s ease infinite}
.fp-cta:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(255,92,0,.2),0 4px 10px rgba(255,92,0,.1)}
.fp-cta:active{transform:translateY(0)}
.fp-cta:disabled{opacity:.55;cursor:not-allowed;transform:none!important;box-shadow:none!important}
.fp-cta .sp{animation:_spin .7s linear infinite}

.fp-sw{text-align:center;font-size:13px;color:#5A5650;margin-top:16px}
.fp-sw a{color:#C04800;font-weight:700;cursor:pointer;text-decoration:none;border-bottom:2px solid transparent;padding-bottom:1px;transition:all .2s}
.fp-sw a:hover{color:#FF5C00;border-bottom-color:#FF5C00}
.fp-tm{text-align:center;font-size:10.5px;color:#8A847C;margin-top:10px;line-height:1.6}
.fp-tm a{color:#C04800;text-decoration:none;font-weight:600}.fp-tm a:hover{text-decoration:underline}
.fp-badges{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px;padding-top:10px;border-top:1px solid #EAE6E0;flex-wrap:wrap}
.fp-badge{display:flex;align-items:center;gap:4px;font-size:10px;color:#6B6560;font-weight:600;white-space:nowrap}

/* RESPONSIVE */
@media(min-width:1400px){.fp-l-in{padding:44px 50px}.fp-r-scroll{padding:36px 56px}.fp-r-box{max-width:440px}}
@media(max-width:1100px){.fp-l{flex:0 0 40%}.fp-l-in{padding:28px 28px}.fp-r-scroll{padding:24px 32px}}
@media(max-width:860px){.fp-l{flex:0 0 38%}.fp-l-in{padding:24px 22px}.fp-feats{display:none}.fp-r-scroll{padding:22px 24px}}
@media(max-width:768px){
  .fp{position:relative;flex-direction:column;height:auto;min-height:100vh;min-height:100dvh;overflow-y:auto;overflow-x:hidden}
  .fp-l{flex:0 0 auto;min-height:240px}.fp-l-in{padding:24px 20px}
  .fp-feats{display:none}
  .fp-trust-grid{grid-template-columns:repeat(4,1fr);gap:4px}
  .fp-trust-item{flex-direction:column;text-align:center;gap:3px;padding:6px 4px}
  .fp-trust-ic{width:24px;height:24px;border-radius:6px}.fp-trust-sub{display:none}
  .fp-hero h2{font-size:22px}
  .fp-r{flex:0 0 auto;border-left:none;border-top:1px solid #E5E0DA}
  .fp-r-scroll{padding:24px 20px 32px;overflow-y:visible}
  .fp-r-box{max-width:100%;margin-top:0;margin-bottom:0}
  .fp-row{flex-direction:column;gap:12px}
}
@media(max-width:480px){
  .fp-l{min-height:200px}.fp-l-in{padding:20px 16px}
  .fp-logo-name{font-size:19px}.fp-hero h2{font-size:20px}.fp-hero-desc{font-size:12.5px}
  .fp-trust-grid{grid-template-columns:1fr 1fr}.fp-trust-item{flex-direction:row;text-align:left}
  .fp-r-scroll{padding:20px 16px 28px}.fp-hd h3{font-size:19px}
  .fp-cta{padding:12px;font-size:14px}.fp-badges{gap:6px}
}
@media(max-width:360px){.fp-l-in{padding:16px 14px}.fp-r-scroll{padding:16px 12px 24px}.fp-hd h3{font-size:17px}.fp-iw input,.fp-iw select{font-size:13px}}
@media(max-height:500px) and (orientation:landscape){
  .fp{position:relative;flex-direction:row;height:auto;min-height:100vh;overflow-y:auto}
  .fp-l{flex:0 0 34%}.fp-l-in{padding:14px 16px}
  .fp-hero h2{font-size:17px;margin-bottom:6px}.fp-hero-desc{display:none}.fp-feats{display:none}.fp-trust-grid{display:none}.fp-hero-tag{display:none}
  .fp-r-scroll{padding:12px 20px}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;

let _inj = false;
function injectCSS() {
  if (_inj) return;
  _inj = true;
  const el = document.createElement("style");
  el.textContent = CSS;
  document.head.appendChild(el);
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function AuthPage({ setUser }) {
  useEffect(() => { injectCSS(); }, []);

  const navigate = useNavigate();
  const location = useLocation();                              // ✅ NEW

  // ✅ NEW — where the user was before being sent to /auth
  const from = location.state?.from?.pathname || "/";

  const [mode, setMode] = useState("login");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    phone_number: "", country: "", state: "", city: "",
  });

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((f) => {
      const u = { ...f, [name]: value };
      if (name === "country") { u.state = ""; u.city = ""; }
      if (name === "state") { u.city = ""; }
      return u;
    });
  }, []);

  const switchMode = (m) => { setMode(m); setShowPw(false); };

  /* Nigeria-specific dropdowns */
  const isNigeria = form.country === "Nigeria";
  const nigeriaStates = useMemo(() => Object.keys(locationsByState).sort(), []);
  const cities = useMemo(() => {
    if (isNigeria && form.state && locationsByState[form.state]) {
      return locationsByState[form.state];
    }
    return [];
  }, [isNigeria, form.state]);

  /* ══════════════════════════════════════════════
     LOGIN — sends (user, token, navigate, from)
  ══════════════════════════════════════════════ */
  const handleLogin = async () => {
    if (!form.email || !form.password)
      return toast.error("Please enter your email and password");

    setLoading(true);
    try {
      const res = await axios.post(`${API}/login`, {
        email: form.email,
        password: form.password,
      });
      const { user, token } = res.data;

      // ✅ FIX — pass navigate + from so App routes back correctly
      setUser(user, token, navigate, from);

    } catch (err) {
      console.error("Login error:", err);
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  /* ══════════════════════════════════════════════
     REGISTER — new user always goes to "/"
  ══════════════════════════════════════════════ */
  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password)
      return toast.error("Please fill in the required fields");

    setLoading(true);
    try {
      await axios.post(`${API}/register`, {
        name: form.name,
        email: form.email,
        password: form.password,
        phone_number: form.phone_number,
        country: form.country,
        state: form.state,
        city: form.city,
      });

      const loginRes = await axios.post(`${API}/login`, {
        email: form.email,
        password: form.password,
      });

      const { user, token } = loginRes.data;

      // ✅ FIX — new users land on "/" not the page they tried to visit
      setUser(user, token, navigate, "/");

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

  const pw = getPW(form.password);

  const trustItems = [
    { icon: <I.Shield s={14} c="#FF5C00" />, label: "Secure Payments", sub: "SSL encrypted" },
    { icon: <I.Truck s={14} c="#FF5C00" />, label: "Fast Delivery", sub: "To your door" },
    { icon: <I.CheckCircle s={14} c="#FF5C00" />, label: "Verified Sellers", sub: "Quality assured" },
    { icon: <I.Headphones s={14} c="#FF5C00" />, label: "24/7 Support", sub: "Always here" },
  ];

  return (
    <div className="fp">
      {/* ══ LEFT ══ */}
      <div className="fp-l">
        <div className="fp-blob fp-blob1" />
        <div className="fp-blob fp-blob2" />
        <ParticleCanvas />
        <div className="fp-l-in">
          <div className="fp-logo">
            <div className="fp-logo-icon">
              <div className="fp-logo-ring" />
              <I.Bag s={20} c="#fff" />
            </div>
            <span className="fp-logo-name">Mini<b>Mart</b></span>
          </div>
          <div className="fp-hero">
            <div className="fp-hero-tag">Your everyday marketplace</div>
            <h2>Shop Smarter,<br /><em>Live Better.</em></h2>
            <p className="fp-hero-desc">
              Discover quality products from verified sellers. Fast delivery,
              secure checkout, and real support — every order.
            </p>
            <div className="fp-feats">
              <div className="fp-feat">
                <div className="fp-feat-icon"><I.Zap s={14} c="#FF5C00" /></div>
                <div className="fp-feat-text"><strong>Fast Delivery</strong>Dispatched quickly to your door</div>
              </div>
              <div className="fp-feat">
                <div className="fp-feat-icon"><I.Shield s={14} c="#FF5C00" /></div>
                <div className="fp-feat-text"><strong>Secure Payments</strong>SSL-encrypted checkout</div>
              </div>
              <div className="fp-feat">
                <div className="fp-feat-icon"><I.CheckCircle s={14} c="#FF5C00" /></div>
                <div className="fp-feat-text"><strong>Verified Sellers</strong>Every seller reviewed</div>
              </div>
              <div className="fp-feat">
                <div className="fp-feat-icon"><I.Headphones s={14} c="#FF5C00" /></div>
                <div className="fp-feat-text"><strong>Real Support</strong>Help when you need it</div>
              </div>
            </div>
          </div>
          <div className="fp-trust-grid">
            {trustItems.map((t) => (
              <div className="fp-trust-item" key={t.label}>
                <div className="fp-trust-ic">{t.icon}</div>
                <div>
                  <div className="fp-trust-label">{t.label}</div>
                  <div className="fp-trust-sub">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ RIGHT ══ */}
      <div className="fp-r">
        <div className="fp-r-scroll">
          <div className="fp-r-box">
            <div className="fp-tabs">
              <button className={`fp-tab${mode === "login" ? " on" : ""}`} onClick={() => switchMode("login")}>Login</button>
              <button className={`fp-tab${mode === "register" ? " on" : ""}`} onClick={() => switchMode("register")}>Register</button>
            </div>

            <div className="fp-hd">
              <h3>{mode === "login" ? "Welcome back" : "Create your account"}</h3>
              <p>{mode === "login" ? "Enter your credentials to continue" : "Fill in your details to get started"}</p>
            </div>

            <button className="fp-google" type="button">
              <I.Google /> Continue with Google
            </button>
            <div className="fp-div">or use your email</div>

            <form onSubmit={onSubmit}>
              <div className="fp-form">

                {/* Register: Name */}
                {mode === "register" && (
                  <div className="fp-field">
                    <label className="fp-label">Full Name</label>
                    <div className="fp-iw">
                      <span className="fp-ii"><I.User /></span>
                      <input name="name" value={form.name} onChange={handleChange} placeholder="Full Name" autoComplete="name" />
                    </div>
                  </div>
                )}

                {/* Email — always visible */}
                <div className="fp-field">
                  <label className="fp-label">Email</label>
                  <div className="fp-iw">
                    <span className="fp-ii"><I.Mail /></span>
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Email" autoComplete="email" />
                  </div>
                </div>

                {/* Password — always visible */}
                <div className="fp-field">
                  <label className="fp-label">
                    Password
                    {mode === "login" && (
                      <button type="button" className="fp-forgot">Forgot?</button>
                    )}
                  </label>
                  <div className="fp-iw">
                    <span className="fp-ii"><I.Lock /></span>
                    <input
                      name="password"
                      type={showPw ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Password"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                    <button type="button" className="fp-eye" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                      {showPw ? <I.EyeOff /> : <I.Eye />}
                    </button>
                  </div>
                  {mode === "register" && form.password && (
                    <div className="fp-pw">
                      <div className="fp-pw-bars">
                        {[1, 2, 3, 4].map(v => (
                          <div key={v} className={`fp-pw-bar${pw.score >= v ? " on" : ""}`} style={pw.score >= v ? { background: pw.color } : {}} />
                        ))}
                      </div>
                      <div className="fp-pw-lbl" style={{ color: pw.color }}>{pw.label}</div>
                      <div className="fp-pw-cks">
                        {pw.checks.map((c, i) => (
                          <span key={i} className={`fp-pw-ck ${c.met ? "y" : "n"}`}>
                            {c.met
                              ? <I.Check s={10} c="#15803D" />
                              : <span style={{ width: 10, height: 10, display: "inline-block", borderRadius: "50%", border: "1.5px solid #B0AAA3" }} />
                            }
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Register: extra location fields */}
                {mode === "register" && (
                  <>
                    {/* Phone */}
                    <div className="fp-field">
                      <label className="fp-label">
                        Phone Number <span className="fp-label-opt">Optional</span>
                      </label>
                      <div className="fp-iw">
                        <span className="fp-ii"><I.Phone /></span>
                        <input name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="Phone Number" autoComplete="tel" />
                      </div>
                    </div>

                    {/* Country — dropdown from countries.js */}
                    <div className="fp-field">
                      <label className="fp-label">Country</label>
                      <div className="fp-iw">
                        <span className="fp-ii"><I.Globe /></span>
                        <select
                          name="country"
                          value={form.country}
                          onChange={handleChange}
                          className={form.country === "" ? "empty" : ""}
                        >
                          <option value="" disabled>Select Country</option>
                          {countries.map((c) => (
                            <option key={c.code} value={c.name}>
                              {getFlag(c.code)} {c.name}
                            </option>
                          ))}
                        </select>
                        <Chev />
                      </div>
                    </div>

                    {/* State & City — side by side */}
                    <div className="fp-row">
                      {/* STATE */}
                      <div className="fp-field">
                        <label className="fp-label">State</label>
                        <div className="fp-iw">
                          <span className="fp-ii"><I.Pin /></span>
                          {isNigeria ? (
                            <>
                              <select
                                name="state"
                                value={form.state}
                                onChange={handleChange}
                                className={form.state === "" ? "empty" : ""}
                              >
                                <option value="" disabled>Select State</option>
                                {nigeriaStates.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <Chev />
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

                      {/* CITY */}
                      <div className="fp-field">
                        <label className="fp-label">
                          City <span className="fp-label-opt">Optional</span>
                        </label>
                        <div className="fp-iw">
                          <span className="fp-ii"><I.Pin /></span>
                          {isNigeria && cities.length > 0 ? (
                            <>
                              <select
                                name="city"
                                value={form.city}
                                onChange={handleChange}
                                className={form.city === "" ? "empty" : ""}
                              >
                                <option value="" disabled>Select City</option>
                                {cities.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <Chev />
                            </>
                          ) : (
                            <input
                              name="city"
                              value={form.city}
                              onChange={handleChange}
                              placeholder={isNigeria && !form.state ? "Select state first" : "City"}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Login: Remember me */}
                {mode === "login" && (
                  <div className="fp-opts">
                    <label className="fp-rem" onClick={e => { e.preventDefault(); setRemember(!remember); }}>
                      <span className={`fp-cb${remember ? " on" : ""}`}>
                        {remember && <I.Check s={11} c="#fff" />}
                      </span>
                      Remember me
                    </label>
                  </div>
                )}

                <button type="submit" className="fp-cta" disabled={loading}>
                  {loading ? (
                    <>
                      <svg className="sp" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                      Please wait...
                    </>
                  ) : (
                    <>
                      {mode === "login" ? "Login" : "Register"}
                      <I.Arrow s={18} />
                    </>
                  )}
                </button>
              </div>
            </form>

            <p className="fp-sw">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <a onClick={() => switchMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "Register" : "Login"}
              </a>
            </p>
            <p className="fp-tm">
              By continuing you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
            </p>
            <div className="fp-badges">
              <span className="fp-badge"><I.Shield s={12} c="#6B6560" /> SSL Secured</span>
              <span className="fp-badge"><I.Lock s={12} c="#6B6560" /> Encrypted</span>
              <span className="fp-badge"><I.Check s={12} c="#6B6560" /> GDPR</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}