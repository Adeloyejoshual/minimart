// src/pages/Verification.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence }                           from "framer-motion";
import { useNavigate }                                       from "react-router-dom";
import {
  Shield, Mail, CheckCircle, Store,
  Loader2, XCircle, RefreshCw, Lock,
  ArrowRight, BadgeCheck,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ══════════════════════════════════════════════════════════════════════════════
   POLICY ENGINE — frontend display only
   Backend enforces independently via middleware
══════════════════════════════════════════════════════════════════════════════ */
const policy = {
  canBrowse   : ()  => true,
  canBuy      : ()  => true,
  canChat     : (c) => c.email_verified === true,
  canPost     : (c) => c.email_verified === true && c.role === "seller",
  canWithdraw : (c) =>
    c.email_verified === true &&
    c.store_verified === true &&
    c.seller_type    === "store_owner",

  resolve: (claims = {}) => ({
    can_browse   : policy.canBrowse(),
    can_buy      : policy.canBuy(),
    can_chat     : policy.canChat(claims),
    can_post     : policy.canPost(claims),
    can_withdraw : policy.canWithdraw(claims),
  }),
};

/* ══════════════════════════════════════════════════════════════════════════════
   CHIP CONFIG — system-style status labels
══════════════════════════════════════════════════════════════════════════════ */
const CHIP = {
  complete  : { label: "Completed", row: "bg-green-500/10  border-green-500/20",  text: "text-white",    badge: "text-green-400"  },
  active    : { label: "Active",    row: "bg-blue-500/10   border-blue-500/20",   text: "text-white",    badge: "text-blue-400"   },
  in_review : { label: "In Review", row: "bg-yellow-500/10 border-yellow-500/20", text: "text-white",    badge: "text-yellow-400" },
  rejected  : { label: "Rejected",  row: "bg-red-500/10    border-red-500/20",    text: "text-white",    badge: "text-red-400"    },
  pending   : { label: "Pending",   row: "bg-gray-800/50   border-gray-800",      text: "text-gray-500", badge: "text-gray-600"   },
};

/* ══════════════════════════════════════════════════════════════════════════════
   CHIP
══════════════════════════════════════════════════════════════════════════════ */
function Chip({ status }) {
  const cfg = CHIP[status] || CHIP.pending;
  return (
    <span className={`text-xs font-semibold ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   STATUS ROW
══════════════════════════════════════════════════════════════════════════════ */
function StatusRow({ label, status, adminMessage }) {
  const cfg = CHIP[status] || CHIP.pending;
  return (
    <div>
      <div className={`
        flex items-center justify-between px-4 py-3 rounded-xl border
        ${cfg.row}
      `}>
        <span className={`text-sm font-medium ${cfg.text}`}>
          {label}
        </span>
        <Chip status={status} />
      </div>

      {/* Admin feedback — only shown on rejection */}
      {status === "rejected" && adminMessage && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y:  0 }}
          className="mt-1.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
        >
          <p className="text-red-400 text-xs font-semibold mb-1">
            Review Result
          </p>
          <p className="text-red-300/70 text-xs leading-relaxed">
            {adminMessage}
          </p>
        </motion.div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   BUILD STATUS ROWS — backend truth only, no UI inference mixed in
══════════════════════════════════════════════════════════════════════════════ */
const buildStatusRows = (status) => {
  if (!status) return [];

  const emailDone = status.email_verified === true;
  const storeDone = status.store_verified === true;
  const isSeller  = status.role === "seller" || status.role === "admin";
  const reviewSt  = status.store_review?.status  || null;
  const reviewMsg = status.store_review?.message || null;

  const storeStatus = storeDone
    ? "complete"
    : reviewSt === "rejected" ? "rejected"
    : reviewSt === "pending"  ? "in_review"
    : "pending";

  return [
    {
      id           : "email",
      label        : "Email Verification",
      status       : emailDone ? "complete" : "active",
      adminMessage : null,
    },
    {
      id           : "seller",
      label        : "Seller Access",
      status       : isSeller
        ? "complete"
        : emailDone ? "active" : "pending",
      adminMessage : null,
    },
    {
      id           : "store",
      label        : "Store Verification",
      status       : storeStatus,
      adminMessage : storeStatus === "rejected" ? reviewMsg : null,
    },
    {
      id           : "trust",
      label        : "Profile Status",
      status       : emailDone ? "active" : "pending",
      adminMessage : null,
    },
  ];
};

/* ══════════════════════════════════════════════════════════════════════════════
   SCORE ROW
══════════════════════════════════════════════════════════════════════════════ */
function ScoreRow({ label, points, done }) {
  return (
    <div className="flex items-center gap-3">
      {done
        ? <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
        : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-700 flex-shrink-0" />
      }
      <span className={`text-xs flex-1 ${done ? "text-gray-300" : "text-gray-600"}`}>
        {label}
      </span>
      <span className={`text-xs font-bold ${done ? "text-green-400" : "text-gray-700"}`}>
        +{points}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TRUST RING
══════════════════════════════════════════════════════════════════════════════ */
function TrustRing({ score = 0 }) {
  const r    = 52;
  const circ = 2 * Math.PI * r;
  const cfg  =
    score >= 80 ? { color: "#22c55e", label: "Excellent" } :
    score >= 60 ? { color: "#3b82f6", label: "Good"      } :
    score >= 40 ? { color: "#f59e0b", label: "Fair"      } :
                  { color: "#ef4444", label: "Low"        };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg width="130" height="130" viewBox="0 0 140 140">
          <circle
            cx="70" cy="70" r={r}
            fill="none" stroke="#1f2937" strokeWidth="10"
          />
          <motion.circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke={cfg.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ}
            animate={{ strokeDashoffset: circ - (score / 100) * circ }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
            style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
          />
        </svg>
        <div className="absolute text-center">
          <motion.span
            key={score}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1   }}
            className="text-3xl font-black text-white block leading-none"
          >
            {score}
          </motion.span>
          <span className="text-xs text-gray-600">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-500 tracking-wide uppercase">
        {cfg.label}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   OTP INPUT
══════════════════════════════════════════════════════════════════════════════ */
function OTPInput({ length = 6, value, onChange, disabled, hasError }) {
  const refs = useRef([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  const handleChange = (i, e) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) {
      const arr = value.split("");
      arr[i]    = "";
      onChange(arr.join(""));
      if (i > 0) refs.current[i - 1]?.focus();
      return;
    }
    const arr = value.split("");
    arr[i]    = val.slice(-1);
    onChange(arr.join(""));
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0)
      refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    onChange(pasted.padEnd(length, "").slice(0, length));
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length }).map((_, i) => (
        <motion.input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          whileFocus={{ scale: 1.08, y: -2 }}
          className={`
            w-12 h-14 text-center text-2xl font-bold rounded-xl border-2
            bg-gray-900 text-white outline-none transition-all duration-200
            ${hasError
              ? "border-red-500 bg-red-500/5"
              : value[i]
                ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                : "border-gray-700 focus:border-blue-400 focus:bg-gray-800"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-text"}
          `}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   COUNTDOWN — stable, runs once per mount
══════════════════════════════════════════════════════════════════════════════ */
function Countdown({ seconds, onComplete }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    let active = true;
    const t    = setInterval(() => {
      if (!active) return;
      setLeft((p) => {
        if (p <= 1) { clearInterval(t); onComplete?.(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => { active = false; clearInterval(t); };
  }, []); // intentional — runs once

  return (
    <span className={`text-sm font-mono font-bold tabular-nums ${
      left < 20 ? "text-red-400" : "text-gray-400"
    }`}>
      {left}s
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════════════════ */
export default function Verification() {
  const navigate = useNavigate();

  const [status,          setStatus]          = useState(null);
  const [pageLoading,     setPageLoading]     = useState(true);
  const [step,            setStep]            = useState("overview");
  const [otp,             setOtp]             = useState("");
  const [sending,         setSending]         = useState(false);
  const [verifying,       setVerifying]       = useState(false);
  const [canResend,       setCanResend]       = useState(false);
  const [error,           setError]           = useState("");
  const [attemptsLeft,    setAttemptsLeft]    = useState(5);
  const [hasError,        setHasError]        = useState(false);
  const [resendRemaining, setResendRemaining] = useState(2);

  const verifyingRef = useRef(false);

  /* ── Auth headers ─────────────────────────────────────────────────────────── */
  const authHeaders = useCallback(() => ({
    "Content-Type" : "application/json",
    Authorization  : `Bearer ${localStorage.getItem("token")}`,
  }), []);

  /* ── Fetch status ─────────────────────────────────────────────────────────── */
  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/api/verification/status`, {
        headers: authHeaders(),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus(data);
        if (typeof data.resend_remaining === "number") {
          setResendRemaining(data.resend_remaining);
        }
      } else if (res.status === 401) {
        navigate("/login");
      }
    } catch (err) {
      console.error("[fetchStatus]", err.message);
    } finally {
      setPageLoading(false);
    }
  }, [authHeaders, navigate]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  /* ── Derived — memoized from raw backend claims ───────────────────────────── */
  const permissions = useMemo(() => policy.resolve({
    email_verified : status?.email_verified,
    store_verified : status?.store_verified,
    role           : status?.role,
    seller_type    : status?.seller_type,
  }), [status]);

  const statusRows = useMemo(() => buildStatusRows(status), [status]);

  const trustScore    = status?.trust_score    || 0;
  const emailVerified = status?.email_verified || false;
  const storeVerified = status?.store_verified || false;
  const storeReview   = status?.store_review   || null;
  const isSeller      = status?.role === "seller" || status?.role === "admin";

  const storeChipStatus = storeVerified
    ? "complete"
    : storeReview?.status === "rejected" ? "rejected"
    : storeReview?.status === "pending"  ? "in_review"
    : "pending";

  /* ── Send OTP ─────────────────────────────────────────────────────────────── */
  const sendOTP = useCallback(async () => {
    setSending(true);
    setError("");
    setOtp("");
    setHasError(false);

    try {
      const res  = await fetch(`${API}/api/verification/send-email-otp`, {
        method  : "POST",
        headers : authHeaders(),
      });
      const data = await res.json();

      if (res.ok) {
        setStep("otp");
        setCanResend(false);
        if (typeof data.remaining === "number") {
          setResendRemaining(data.remaining);
        }
      } else {
        setError(data.message || "Failed to send code.");
        if (res.status === 429 && data.remaining === 0) {
          setResendRemaining(0);
        }
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSending(false);
    }
  }, [authHeaders]);

  /* ── Verify OTP ───────────────────────────────────────────────────────────── */
  const verifyOTP = useCallback(async () => {
    if (otp.length < 6 || verifyingRef.current || verifying) return;
    verifyingRef.current = true;

    setVerifying(true);
    setError("");
    setHasError(false);

    try {
      const res  = await fetch(`${API}/api/verification/verify-email-otp`, {
        method  : "POST",
        headers : authHeaders(),
        body    : JSON.stringify({ otp }),
      });
      const data = await res.json();

      if (res.ok) {
        // Optimistic update — no stale render cycle
        setStatus((prev) => ({
          ...prev,
          email_verified : true,
          trust_score    : data.trust_score ?? (prev?.trust_score || 0) + 40,
        }));
        setStep("success");
        fetchStatus(); // background sync
      } else {
        setHasError(true);
        setOtp("");
        setError(data.message || "Invalid code.");
        if (typeof data.attemptsLeft === "number") {
          setAttemptsLeft(data.attemptsLeft);
        }
        setTimeout(() => setHasError(false), 600);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setVerifying(false);
      verifyingRef.current = false;
    }
  }, [otp, verifying, authHeaders, fetchStatus]);

  /* ── Auto-submit — debounced + race guard ─────────────────────────────────── */
  useEffect(() => {
    if (
      otp.length === 6 &&
      step === "otp"   &&
      !verifying       &&
      !verifyingRef.current
    ) {
      const t = setTimeout(() => verifyOTP(), 120);
      return () => clearTimeout(t);
    }
  }, [otp, step, verifying, verifyOTP]);

  /* ── Reset ────────────────────────────────────────────────────────────────── */
  const goBack = useCallback(() => {
    setStep("overview");
    setError("");
    setOtp("");
    setHasError(false);
  }, []);

  /* ── Loading ──────────────────────────────────────────────────────────────── */
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={26} className="text-blue-400 animate-spin" />
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y:   0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 mb-4">
            <Shield size={24} className="text-blue-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Account Verification
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Complete to access seller features
          </p>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════════════════════════
              OVERVIEW
          ════════════════════════════════════════════════════════════════ */}
          {step === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 14  }}
              animate={{ opacity: 1, y: 0   }}
              exit={{    opacity: 0, y: -14 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >

              {/* Trust Score */}
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                <div className="flex flex-col items-center">
                  <TrustRing score={trustScore} />
                  <div className="w-full mt-5 pt-5 border-t border-gray-800 space-y-2.5">
                    <ScoreRow
                      label="Email verified"
                      points={40}
                      done={emailVerified}
                    />
                    <ScoreRow
                      label="Store verified"
                      points={20}
                      done={storeVerified}
                    />
                    <ScoreRow
                      label="Account age 30 days"
                      points={10}
                      done={trustScore >= 60}
                    />
                    <ScoreRow
                      label="Account age 90 days"
                      points={10}
                      done={trustScore >= 70}
                    />
                  </div>
                </div>
              </div>

              {/* Verification Status */}
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                  <BadgeCheck size={14} className="text-blue-400" />
                  Verification Status
                </h3>
                <div className="space-y-2">
                  {statusRows.map((row) => (
                    <StatusRow
                      key={row.id}
                      label={row.label}
                      status={row.status}
                      adminMessage={row.adminMessage}
                    />
                  ))}
                </div>
              </div>

              {/* Email action — only when not verified */}
              {!emailVerified && (
                <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 flex-shrink-0">
                      <Mail size={20} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">
                        Email Verification
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5 truncate">
                        {status?.email || "—"}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{  scale: 0.97 }}
                      onClick={sendOTP}
                      disabled={sending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors flex-shrink-0"
                    >
                      {sending
                        ? <Loader2 size={13} className="animate-spin" />
                        : <ArrowRight size={13} />
                      }
                      {sending ? "Sending" : "Verify"}
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Store card */}
              <div className={`
                bg-gray-900 rounded-2xl border border-gray-800 p-5
                ${!emailVerified ? "opacity-40 pointer-events-none" : ""}
              `}>
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                    storeVerified ? "bg-green-500/10" : "bg-gray-800"
                  }`}>
                    <Store
                      size={20}
                      className={storeVerified ? "text-green-400" : "text-gray-500"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-sm font-medium">
                      Store Verification
                    </p>
                  </div>
                  <Chip status={storeChipStatus} />
                </div>

                {/* Admin rejection message */}
                {storeChipStatus === "rejected" && storeReview?.message && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y:  0 }}
                    className="mt-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <p className="text-red-400 text-xs font-semibold mb-1">
                      Review Result
                    </p>
                    <p className="text-red-300/70 text-xs leading-relaxed">
                      {storeReview.message}
                    </p>
                  </motion.div>
                )}
              </div>

            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              OTP
          ════════════════════════════════════════════════════════════════ */}
          {step === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20  }}
              animate={{ opacity: 1, x: 0   }}
              exit={{    opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <button
                onClick={goBack}
                className="text-gray-500 hover:text-white text-sm transition-colors"
              >
                ← Back
              </button>

              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">

                {/* Header */}
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1,    opacity: 1 }}
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4"
                  >
                    <Mail size={26} className="text-blue-400" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-white">
                    Enter Verification Code
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    Sent to{" "}
                    <span className="text-white font-medium">
                      {status?.email}
                    </span>
                  </p>
                </div>

                {/* OTP Input */}
                <div className="mb-2">
                  <OTPInput
                    length={6}
                    value={otp}
                    onChange={setOtp}
                    disabled={verifying}
                    hasError={hasError}
                  />
                </div>

                <p className="text-center text-gray-600 text-xs mb-6">
                  Auto-submit enabled
                </p>

                {/* Verifying */}
                <AnimatePresence>
                  {verifying && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{    opacity: 0 }}
                      className="flex items-center justify-center gap-2 mb-4"
                    >
                      <Loader2 size={14} className="animate-spin text-blue-400" />
                      <span className="text-blue-400 text-sm">Verifying</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y:  0 }}
                      exit={{    opacity: 0        }}
                      className="flex items-start gap-2 p-3 rounded-xl mb-4 bg-red-500/10 border border-red-500/20"
                    >
                      <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-400 text-sm">{error}</p>
                        {attemptsLeft < 5 && attemptsLeft > 0 && (
                          <p className="text-red-500/60 text-xs mt-0.5">
                            {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Resend row */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">

                  {/* Left — resend control */}
                  <div>
                    {resendRemaining <= 0 ? (
                      // Daily limit hit — backend already blocking
                      <span className="text-gray-600 text-sm">
                        Daily limit reached
                      </span>
                    ) : canResend ? (
                      <button
                        onClick={sendOTP}
                        disabled={sending}
                        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={sending ? "animate-spin" : ""} />
                        Resend code
                        {resendRemaining > 0 && (
                          <span className="text-gray-600 font-normal text-xs">
                            ({resendRemaining} left)
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                        <span>Resend in</span>
                        <Countdown
                          seconds={60}
                          onComplete={() => setCanResend(true)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right — security note */}
                  <div className="flex items-center gap-1.5">
                    <Lock size={11} className="text-gray-700" />
                    <span className="text-gray-700 text-xs">
                      Do not share this code
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SUCCESS — system style, no emojis, no marketing tone
          ════════════════════════════════════════════════════════════════ */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1    }}
              exit={{    opacity: 0               }}
              transition={{ duration: 0.22 }}
            >
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">

                {/* Header */}
                <div className="text-center mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 220, delay: 0.08 }}
                    className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 mb-4"
                  >
                    <CheckCircle size={28} className="text-green-400" />
                  </motion.div>
                  <h2 className="text-xl font-bold text-white">
                    Email Verified
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    Verification successful
                  </p>
                </div>

                {/* Status blocks */}
                <div className="space-y-2 mb-4">
                  <StatusRow
                    label="Email Verification"
                    status="complete"
                    adminMessage={null}
                  />
                  <StatusRow
                    label="Seller Access"
                    status={isSeller ? "complete" : "pending"}
                    adminMessage={null}
                  />
                  <StatusRow
                    label="Store Verification"
                    status={storeChipStatus}
                    adminMessage={
                      storeChipStatus === "rejected"
                        ? storeReview?.message
                        : null
                    }
                  />
                  <StatusRow
                    label="Profile Status"
                    status="active"
                    adminMessage={null}
                  />
                </div>

                {/* Trust score */}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700 mb-5">
                  <span className="text-sm text-gray-400">Trust Score</span>
                  <span className="text-sm font-bold text-white">
                    {trustScore} / 100
                  </span>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{  scale: 0.98 }}
                    onClick={() => setStep("overview")}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition-colors"
                  >
                    Continue
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{  scale: 0.98 }}
                    onClick={() => navigate("/dashboard")}
                    className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 font-medium transition-colors"
                  >
                    Dashboard
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}