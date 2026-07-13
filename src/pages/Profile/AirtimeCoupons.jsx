// src/pages/Profile/AirtimeCoupons.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/AirtimeCoupons.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API + AUTH + HELPERS + ICONS
   (Same as before — keeping them identical)
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = () => ({
  Authorization  : `Bearer ${getToken()}`,
  "Content-Type" : "application/json",
});

const naira = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return "₦0";
  return "₦" + num.toLocaleString("en-NG");
};

const fmtDate = (d) => {
  if (!d) return "";
  return new Date(d).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

/* ═══════════════════════════════════════════════════════════════
   STATUS + NETWORK CONFIG
═══════════════════════════════════════════════════════════════ */
const STATUS_CFG = {
  available  : { label: "Available",  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  redeemed   : { label: "Redeemed",   color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  processing : { label: "Processing", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  completed  : { label: "Completed",  color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  failed     : { label: "Failed",     color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

const NETWORK_COLORS = {
  MTN      : { bg: "#fff7e6", color: "#b45309", dot: "#f59e0b" },
  Airtel   : { bg: "#fef2f2", color: "#dc2626", dot: "#ef4444" },
  Glo      : { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e" },
  "9mobile": { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
};

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const IconRefresh = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/>
    <path d="M3 21v-5h5"/>
  </svg>
);

const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);

const IconPhoneLg = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);

const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconCheckCircle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const IconAlertCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconSend = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconLock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);

const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconInfo = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconAlertTriangle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const StatusIcon = ({ status }) => {
  switch (status) {
    case "available":  return <IconPhone />;
    case "redeemed":   return <IconClock />;
    case "processing": return <IconSend />;
    case "completed":  return <IconCheckCircle />;
    case "failed":     return <IconAlertCircle />;
    default:           return <IconPhone />;
  }
};

/* ═══════════════════════════════════════════════════════════════
   OTP INPUT
═══════════════════════════════════════════════════════════════ */
function OtpInput({ value, onChange, disabled }) {
  const refs = useRef([]);

  const set = (i, char) => {
    const digits = (value || "").split("");
    digits[i]    = char.replace(/\D/, "").slice(-1);
    onChange(digits.join(""));
    if (char && i < 5) refs.current[i + 1]?.focus();
  };

  const onKey = (i, e) => {
    if (e.key === "Backspace" && !(value || "")[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const onPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      onChange(pasted);
      refs.current[5]?.focus();
      e.preventDefault();
    }
  };

  return (
    <div className="at-otp-row" onPaste={onPaste}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="at-otp-box"
          maxLength={1}
          value={(value || "")[i] || ""}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════════════════════════════════ */
function ConfirmModal({ coupon, phoneMasked, network, onConfirm, onCancel, loading }) {
  return (
    <div className="at-overlay" role="dialog" aria-modal="true">
      <div className="at-modal">
        <button className="at-modal-close" onClick={onCancel} aria-label="Close">
          <IconX />
        </button>

        <div className="at-modal-icon-wrap">
          <IconPhoneLg />
        </div>

        <h2 className="at-modal-title">Redeem this coupon?</h2>
        <p className="at-modal-amount">{naira(coupon.amount)} Airtime</p>

        <div className="at-modal-code-wrap">
          <span className="at-modal-code">{coupon.code}</span>
        </div>

        {/* Show which number will receive it */}
        {phoneMasked && (
          <div className="at-modal-phone">
            <IconPhone />
            <span>Sending to <strong>{phoneMasked}</strong></span>
            {network && <span className="at-modal-network">· {network}</span>}
          </div>
        )}

        <div className="at-modal-warn">
          <IconAlertTriangle />
          <p>This action cannot be undone. The airtime will be sent to your verified phone number.</p>
        </div>

        <div className="at-modal-actions">
          <button className="at-modal-cancel" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="at-modal-confirm" onClick={onConfirm} disabled={loading}>
            {loading ? "Processing…" : "Redeem"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COUPON CARD
═══════════════════════════════════════════════════════════════ */
function AirtimeCouponCard({ coupon, onRedeem }) {
  const cfg = STATUS_CFG[coupon.status] || STATUS_CFG.available;

  return (
    <div className="at-card" style={{ "--card-border": cfg.border }}>
      <div className="at-strip" style={{ background: cfg.color }} />

      <div className="at-body">
        <div className="at-top">
          <div className="at-amount-wrap">
            <div className="at-amount-icon-wrap">
              <IconPhone />
            </div>
            <div>
              <p className="at-amount">{naira(coupon.amount)}</p>
              <p className="at-code">Code: {coupon.code}</p>
            </div>
          </div>
          <div
            className="at-status-badge"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            <StatusIcon status={coupon.status} />
            <span>{cfg.label}</span>
          </div>
        </div>

        {coupon.status === "available" && (
          <p className="at-detail-hint">
            Tap Redeem to send airtime to your verified number.
          </p>
        )}

        {coupon.status === "redeemed" && (
          <div className="at-detail-block" style={{ background: cfg.bg, borderColor: cfg.border }}>
            <div className="at-detail-row">
              <IconClock />
              <span>Waiting for processing</span>
            </div>
            {coupon.redeemed_at && (
              <div className="at-detail-row at-detail-date">
                <IconClock />
                <span>Redeemed on {fmtDate(coupon.redeemed_at)}</span>
              </div>
            )}
          </div>
        )}

        {coupon.status === "processing" && (
          <div className="at-detail-block" style={{ background: cfg.bg, borderColor: cfg.border }}>
            <div className="at-detail-row">
              <IconSend />
              <span>Your airtime is being processed</span>
            </div>
            {coupon.redeemed_at && (
              <div className="at-detail-row at-detail-date">
                <IconClock />
                <span>Redeemed on {fmtDate(coupon.redeemed_at)}</span>
              </div>
            )}
          </div>
        )}

        {coupon.status === "completed" && (
          <div className="at-detail-block" style={{ background: cfg.bg, borderColor: cfg.border }}>
            <div className="at-detail-row at-detail-success">
              <IconCheckCircle />
              <span>{naira(coupon.amount)} airtime sent successfully</span>
            </div>
            {coupon.redeemed_at && (
              <div className="at-detail-row at-detail-date">
                <IconClock />
                <span>Redeemed on {fmtDate(coupon.redeemed_at)}</span>
              </div>
            )}
            {coupon.processed_at && (
              <div className="at-detail-row at-detail-date">
                <IconCheck />
                <span>Completed on {fmtDate(coupon.processed_at)}</span>
              </div>
            )}
            {coupon.phone_masked && (
              <div className="at-detail-row at-detail-date">
                <IconPhone />
                <span>Sent to {coupon.phone_masked}{coupon.network ? ` · ${coupon.network}` : ""}</span>
              </div>
            )}
          </div>
        )}

        {coupon.status === "failed" && (
          <div className="at-detail-block" style={{ background: cfg.bg, borderColor: cfg.border }}>
            <div className="at-detail-row at-detail-fail">
              <IconAlertCircle />
              <span>{coupon.admin_note || "Redemption failed. Please contact support."}</span>
            </div>
            {coupon.redeemed_at && (
              <div className="at-detail-row at-detail-date">
                <IconClock />
                <span>Redeemed on {fmtDate(coupon.redeemed_at)}</span>
              </div>
            )}
          </div>
        )}

        {coupon.can_redeem && (
          <button className="at-redeem-btn" onClick={() => onRedeem(coupon)}>
            <IconSend /> Redeem
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AirtimeCoupons() {
  const navigate = useNavigate();

  const [phoneStatus, setPhoneStatus] = useState(null);
  const [coupons,     setCoupons]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [confirming,  setConfirming]  = useState(null);
  const [redeeming,   setRedeeming]   = useState(false);
  const [toast,       setToast]       = useState(null);
  const toastRef = useRef(null);

  /* Phone verification state */
  const [step,       setStep]       = useState(null);   // null | "phone" | "otp"
  const [phone,      setPhone]      = useState("");
  const [otp,        setOtp]        = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [countdown,  setCountdown]  = useState(0);
  const [msg,        setMsg]        = useState(null);
  const timerRef = useRef(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!getToken()) navigate("/auth?redirect=/airtime-coupons");
  }, [navigate]);

  /* ── Toast ── */
  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 4_000);
  }, []);

  /* ── Countdown ── */
  const startCountdown = useCallback((seconds = 600) => {
    setCountdown(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1_000);
  }, []);

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [phoneRes, couponRes] = await Promise.all([
        fetch(`${API}/airtime-coupons/phone-status`, { headers: authH() }),
        fetch(`${API}/airtime-coupons`,              { headers: authH() }),
      ]);

      if (phoneRes.ok) {
        const d = await phoneRes.json();
        if (d.success) {
          setPhoneStatus(d.phone);

          /* ── Pre-fill phone if user has one from registration ── */
          if (d.phone.has_phone && !d.phone.verified) {
            /* Convert +234XXXXXXXXXX back to 0XXXXXXXXXX for the input */
            const raw = d.phone.number || "";
            const local = raw.startsWith("+234")
              ? "0" + raw.slice(4)
              : raw;
            setPhone(local);
          }
        }
      }

      if (couponRes.ok) {
        const d = await couponRes.json();
        if (d.success) setCoupons(d.coupons || []);
      }
    } catch {
      showToast("error", "Could not load data. Pull to refresh.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
    return () => {
      clearTimeout(toastRef.current);
      clearInterval(timerRef.current);
    };
  }, [loadData]);

  /* ═════════════════════════════════════════════
     SMART VERIFY FLOW
     Decides which step to show based on phone status
  ═════════════════════════════════════════════ */
  const startVerification = useCallback(() => {
    if (!phoneStatus) {
      /* Data not loaded yet — show phone entry */
      setStep("phone");
      return;
    }

    if (phoneStatus.verified) {
      /* Already verified — nothing to do */
      return;
    }

    if (phoneStatus.has_phone) {
      /*
       * Phone exists from registration but NOT verified yet.
       * Skip phone entry → go straight to OTP.
       * Pre-fill is already done in loadData.
       */
      setStep("otp");
      sendOtpForExisting();
    } else {
      /* No phone at all → ask them to enter one */
      setStep("phone");
    }
  }, [phoneStatus]);

  /* ── Send OTP using existing phone (auto-triggered) ── */
  const sendOtpForExisting = async () => {
    if (!phoneStatus?.number) return;

    /* Convert to local format for the API */
    const raw   = phoneStatus.number;
    const local = raw.startsWith("+234") ? "0" + raw.slice(4) : raw;

    setOtpLoading(true);
    setMsg(null);
    try {
      const res  = await fetch(`${API}/airtime-coupons/send-otp`, {
        method : "POST",
        headers: authH(),
        body   : JSON.stringify({ phone: local, purpose: "verify" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      startCountdown(data.expires_in || 600);
      setMsg({ type: "success", text: `OTP sent to ${data.masked}` });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Failed to send OTP." });
      /* Fall back to phone entry if something went wrong */
      setStep("phone");
    } finally {
      setOtpLoading(false);
    }
  };

  /* ── Send OTP (manual — from phone entry step) ── */
  const sendOtp = async (purpose = "verify") => {
    if (phone.replace(/\D/g, "").length < 10) {
      setMsg({ type: "error", text: "Enter a valid 11-digit phone number." });
      return;
    }
    setOtpLoading(true);
    setMsg(null);
    try {
      const res  = await fetch(`${API}/airtime-coupons/send-otp`, {
        method : "POST",
        headers: authH(),
        body   : JSON.stringify({ phone: phone.trim(), purpose }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setOtp("");
      setStep("otp");
      startCountdown(data.expires_in || 600);
      setMsg({ type: "success", text: data.message });
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Failed to send OTP." });
    } finally {
      setOtpLoading(false);
    }
  };

  /* ── Verify OTP ── */
  const verifyOtp = async () => {
    if (otp.length < 6) {
      setMsg({ type: "error", text: "Enter the full 6-digit OTP." });
      return;
    }
    setOtpLoading(true);
    setMsg(null);
    try {
      const res  = await fetch(`${API}/airtime-coupons/verify-otp`, {
        method : "POST",
        headers: authH(),
        body   : JSON.stringify({ phone: phone.trim(), otp, purpose: "verify" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPhoneStatus({
        ...phoneStatus,
        masked    : data.phone.masked,
        network   : data.phone.network,
        verified  : true,
        has_phone : true,
      });
      setStep(null);
      showToast("success", "Phone verified successfully!");
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Verification failed." });
    } finally {
      setOtpLoading(false);
    }
  };

  /* ── Redeem ── */
  const handleRedeem = useCallback((coupon) => {
    if (!phoneStatus?.verified) {
      /* Phone not verified — trigger smart verification */
      startVerification();
      return;
    }
    /* Phone verified — show confirm modal */
    setConfirming(coupon);
  }, [phoneStatus, startVerification]);

  const executeRedeem = async () => {
    if (!confirming) return;
    setRedeeming(true);
    try {
      const res  = await fetch(`${API}/airtime-coupons/redeem`, {
        method : "POST",
        headers: authH(),
        body   : JSON.stringify({ code: confirming.code }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.code === "PHONE_NOT_VERIFIED") {
          setConfirming(null);
          startVerification();
          showToast("error", "Please verify your phone number first.");
          return;
        }
        throw new Error(data.message);
      }
      setCoupons((prev) =>
        prev.map((c) => c.id === confirming.id ? { ...c, ...data.coupon } : c)
      );
      setConfirming(null);
      showToast("success", data.message);
    } catch (e) {
      showToast("error", e.message || "Redemption failed.");
      setConfirming(null);
    } finally {
      setRedeeming(false);
    }
  };

  /* ── Derived ── */
  const isVerified = phoneStatus?.verified === true;
  const available  = coupons.filter((c) => c.status === "available").length;
  const inProgress = coupons.filter((c) => ["redeemed", "processing"].includes(c.status)).length;
  const completed  = coupons.filter((c) => c.status === "completed").length;
  const netColor   = phoneStatus?.network
    ? NETWORK_COLORS[phoneStatus.network] || NETWORK_COLORS.MTN
    : null;

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="at-page">

      {/* ── Topbar ── */}
      <div className="at-topbar">
        <button className="at-back" onClick={() => navigate(-1)} aria-label="Go back">
          <IconBack />
        </button>
        <div className="at-topbar-text">
          <h1 className="at-topbar-title">Airtime Coupons</h1>
          <p className="at-topbar-sub">{coupons.length} coupon{coupons.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="at-refresh" onClick={loadData} aria-label="Refresh" disabled={loading}>
          <IconRefresh />
        </button>
      </div>

      <div className="at-scroll">

        {/* ══════════════════════════════════════
           SCENARIO A: Not verified + no step active
           Show prompt to verify
        ══════════════════════════════════════ */}
        {!loading && !isVerified && step === null && (
          <div className="at-verify-prompt">
            <div className="at-verify-prompt-icon"><IconShield /></div>
            <div className="at-verify-prompt-text">
              <h3>Verify your phone number</h3>
              <p>
                {phoneStatus?.has_phone
                  ? `We found ${phoneStatus.masked} from your registration. Tap to verify it.`
                  : "A verified phone number is required to redeem airtime coupons."
                }
              </p>
            </div>
            <button className="at-verify-prompt-btn" onClick={startVerification}>
              {phoneStatus?.has_phone ? "Verify" : "Add Number"}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════
           PHONE ENTRY STEP
           Only shown when user has NO phone on file
        ══════════════════════════════════════ */}
        {step === "phone" && (
          <div className="at-verify-card">
            <h2 className="at-verify-title">Enter your phone number</h2>
            <p className="at-verify-sub">
              We'll send a one-time code to verify your number. Airtime will always be sent to this number.
            </p>

            <div className="at-phone-row">
              <span className="at-phone-prefix">+234</span>
              <input
                className="at-phone-input"
                placeholder="080X XXX XXXX"
                inputMode="tel"
                maxLength={11}
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setMsg(null); }}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                disabled={otpLoading}
              />
            </div>

            {msg && (
              <div className={`at-msg at-msg--${msg.type}`} role="alert">
                {msg.type === "success" ? <IconCheckCircle /> : <IconAlertCircle />}
                <span>{msg.text}</span>
              </div>
            )}

            <button
              className="at-btn"
              onClick={() => sendOtp("verify")}
              disabled={otpLoading || phone.replace(/\D/g, "").length < 10}
            >
              {otpLoading ? "Sending…" : "Send OTP"}
            </button>

            <p className="at-note">
              <IconLock /> This number will be linked to your account. One number per account.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════
           OTP STEP
           Shown for both new numbers and
           pre-existing registration numbers
        ══════════════════════════════════════ */}
        {step === "otp" && (
          <div className="at-verify-card">
            <h2 className="at-verify-title">Enter the OTP</h2>
            <p className="at-verify-sub">
              We sent a 6-digit code to{" "}
              <strong>
                {phoneStatus?.has_phone
                  ? phoneStatus.masked
                  : `+234${phone.replace(/^0/, "")}`
                }
              </strong>
            </p>

            <OtpInput value={otp} onChange={setOtp} disabled={otpLoading} />

            <div className="at-countdown">
              {countdown > 0
                ? `Code expires in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`
                : <span className="at-expired">Code expired</span>
              }
            </div>

            {msg && (
              <div className={`at-msg at-msg--${msg.type}`} role="alert">
                {msg.type === "success" ? <IconCheckCircle /> : <IconAlertCircle />}
                <span>{msg.text}</span>
              </div>
            )}

            <button
              className="at-btn"
              onClick={verifyOtp}
              disabled={otpLoading || otp.length < 6}
            >
              {otpLoading ? "Verifying…" : "Verify"}
            </button>

            <div className="at-resend-row">
              <span>Didn't receive it?</span>
              {countdown > 0
                ? <span className="at-resend-disabled">Resend in {countdown}s</span>
                : <button
                    className="at-resend-btn"
                    onClick={() => {
                      if (phoneStatus?.has_phone) {
                        sendOtpForExisting();
                      } else {
                        sendOtp("verify");
                      }
                    }}
                    disabled={otpLoading}
                  >
                    Resend OTP
                  </button>
              }
            </div>

            {/* Only show "change number" if the phone was manually entered */}
            {!phoneStatus?.has_phone && (
              <button
                className="at-text-btn"
                onClick={() => { setStep("phone"); setOtp(""); setMsg(null); }}
              >
                ← Change phone number
              </button>
            )}

            {/* If phone from registration, allow them to use a different number */}
            {phoneStatus?.has_phone && (
              <button
                className="at-text-btn"
                onClick={() => {
                  setStep("phone");
                  setPhone("");
                  setOtp("");
                  setMsg(null);
                }}
              >
                ← Use a different number
              </button>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
           VERIFIED BADGE
        ══════════════════════════════════════ */}
        {!loading && isVerified && step === null && (
          <div className="at-verified-card">
            <div className="at-verified-left">
              <span className="at-verified-icon"><IconCheckCircle /></span>
              <div>
                <p className="at-verified-label">Verified Number</p>
                <p className="at-verified-phone">{phoneStatus.masked}</p>
              </div>
            </div>
            <div className="at-verified-right">
              {netColor && (
                <span className="at-network-badge" style={{ background: netColor.bg, color: netColor.color }}>
                  <span className="at-network-dot" style={{ background: netColor.dot }} />
                  {phoneStatus.network}
                </span>
              )}
              {phoneStatus.can_change ? (
                <button
                  className="at-change-btn"
                  onClick={() => { setStep("phone"); setPhone(""); setMsg(null); }}
                >
                  <IconEdit /> Change
                </button>
              ) : (
                <span className="at-locked-label">
                  <IconLock /> {phoneStatus.days_until_change}d
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Summary pills ── */}
        {!loading && coupons.length > 0 && (
          <div className="at-summary">
            <div className="at-pill at-pill--green">
              <span className="at-pill-num">{available}</span>
              <span className="at-pill-label">Available</span>
            </div>
            <div className="at-pill at-pill--orange">
              <span className="at-pill-num">{inProgress}</span>
              <span className="at-pill-label">In Progress</span>
            </div>
            <div className="at-pill at-pill--gray">
              <span className="at-pill-num">{completed}</span>
              <span className="at-pill-label">Completed</span>
            </div>
          </div>
        )}

        {/* ── Skeleton ── */}
        {loading && (
          <div className="at-sk-list">
            {[1, 2, 3].map((i) => <div key={i} className="at-sk" />)}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && coupons.length === 0 && (
          <div className="at-empty">
            <span className="at-empty-icon"><IconPhoneLg /></span>
            <p>No airtime coupons yet</p>
            <small>Airtime coupons you earn will appear here.</small>
          </div>
        )}

        {/* ── Coupon list ── */}
        {!loading && coupons.length > 0 && (
          <div className="at-list">
            {coupons.map((c) => (
              <AirtimeCouponCard key={c.id} coupon={c} onRedeem={handleRedeem} />
            ))}
          </div>
        )}

        {/* ── How it works ── */}
        {!loading && (
          <div className="at-how">
            <div className="at-how-header">
              <IconInfo />
              <h3 className="at-how-title">How airtime coupons work</h3>
            </div>
            {[
              { icon: <IconPhone />,       t: "Verify your phone number once." },
              { icon: <IconSend />,        t: "Tap Redeem on an available coupon." },
              { icon: <IconClock />,       t: "We process and send the airtime to your verified number." },
              { icon: <IconCheckCircle />, t: "Status updates to Completed once sent." },
            ].map((tip, idx) => (
              <div key={idx} className="at-how-tip">
                <span className="at-how-tip-icon">{tip.icon}</span>
                <p>{tip.t}</p>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── Confirm modal ── */}
      {confirming && (
        <ConfirmModal
          coupon={confirming}
          phoneMasked={phoneStatus?.masked}
          network={phoneStatus?.network}
          onConfirm={executeRedeem}
          onCancel={() => setConfirming(null)}
          loading={redeeming}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`at-toast at-toast--${toast.type}`} role="alert" aria-live="assertive">
          {toast.type === "success" ? <IconCheck /> : <IconAlertCircle />}
          {toast.text}
        </div>
      )}

    </div>
  );
}