/**
 * useVerification.js
 * All API calls and state for the verification flow.
 * Keeps the UI component clean and testable.
 */

import {
  useState,
  useCallback,
  useRef,
} from "react";

/* ─── constants ─────────────────────────────────────────────────────────── */
const API           = `${import.meta.env.VITE_API_BASE_URL}/api`;
const OTP_LENGTH    = 6;
const RESEND_SECS   = 30;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  "";

const authJson = () => ({
  "Content-Type" : "application/json",
  Authorization  : `Bearer ${getToken()}`,
});

const authMultipart = () => ({
  Authorization: `Bearer ${getToken()}`,
});

/* ─── hook ──────────────────────────────────────────────────────────────── */
export function useVerification({ onStatusChange } = {}) {
  /* ── remote status ─────────────────────────────────────────────────── */
  const [status,      setStatus]      = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [pageError,   setPageError]   = useState("");

  /* ── email step ────────────────────────────────────────────────────── */
  const [emailPhase,      setEmailPhase]      = useState("idle"); // idle | sending | otp | verifying | done
  const [emailError,      setEmailError]      = useState("");
  const [otp,             setOtp]             = useState("");
  const [otpError,        setOtpError]        = useState(false);  // shake trigger
  const [attemptsLeft,    setAttemptsLeft]    = useState(null);
  const [resendRemaining, setResendRemaining] = useState(null);
  const [resendKey,       setResendKey]       = useState(0);      // force Countdown remount
  const [canResend,       setCanResend]       = useState(false);
  const [devOtp,          setDevOtp]          = useState("");
  const [maskedEmail,     setMaskedEmail]     = useState("");

  /* ── identity step ─────────────────────────────────────────────────── */
  const [idPhase,  setIdPhase]  = useState("idle"); // idle | submitting | done | error
  const [idMsg,    setIdMsg]    = useState({ text: "", ok: false });

  /* ── store step ────────────────────────────────────────────────────── */
  const [storePhase, setStorePhase] = useState("idle");
  const [storeMsg,   setStoreMsg]   = useState({ text: "", ok: false });

  /* ── race-condition guard ───────────────────────────────────────────── */
  const verifyingRef = useRef(false);

  /* ════════════════════════════════════════════════════════════════════
     fetchStatus
  ════════════════════════════════════════════════════════════════════ */
  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/verification/status`, {
        headers: authJson(),
      });

      if (res.status === 401) return { needsAuth: true };

      const data = await res.json();

      if (res.ok) {
        setStatus(data);
        if (data.email_verified)               setEmailPhase("done");
        if (data.email)                        setMaskedEmail(data.email);
        if (typeof data.resend_remaining === "number") {
          setResendRemaining(data.resend_remaining);
        }
        onStatusChange?.(data);
        return data;
      }

      setPageError(data.message || "Failed to load verification status.");
      return null;

    } catch (err) {
      setPageError("Network error — check your connection.");
      console.error("[useVerification] fetchStatus:", err);
      return null;
    } finally {
      setLoadingPage(false);
    }
  }, [onStatusChange]);

  /* ════════════════════════════════════════════════════════════════════
     sendOtp
  ════════════════════════════════════════════════════════════════════ */
  const sendOtp = useCallback(async () => {
    setEmailPhase("sending");
    setEmailError("");
    setOtp("");
    setOtpError(false);
    setCanResend(false);
    setDevOtp("");
    setResendKey((k) => k + 1);

    try {
      const res  = await fetch(`${API}/verification/send-email-otp`, {
        method  : "POST",
        headers : authJson(),
      });
      const data = await res.json();

      if (res.ok) {
        setEmailPhase("otp");
        if (data.email)                        setMaskedEmail(data.email);
        if (typeof data.remaining === "number") setResendRemaining(data.remaining);
        if (data.dev_otp)                      setDevOtp(data.dev_otp);
        return { ok: true };
      }

      // Rate-limited or other error
      if (res.status === 429) {
        setEmailPhase("otp");            // keep OTP area open
        setEmailError(data.message || "Too many requests.");
        if (data.retryAfter)             setCanResend(false); // countdown already running
        if (data.remaining === 0)        setResendRemaining(0);
      } else {
        setEmailPhase("idle");
        setEmailError(data.message || "Failed to send code.");
      }

      return { ok: false, message: data.message };

    } catch {
      setEmailPhase("idle");
      setEmailError("Network error — check your connection.");
      return { ok: false };
    }
  }, []);

  /* ════════════════════════════════════════════════════════════════════
     verifyOtp
  ════════════════════════════════════════════════════════════════════ */
  const verifyOtp = useCallback(async (code) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setEmailPhase("verifying");
    setEmailError("");

    try {
      const res  = await fetch(`${API}/verification/verify-email-otp`, {
        method  : "POST",
        headers : authJson(),
        body    : JSON.stringify({ otp: code }),
      });
      const data = await res.json();

      if (res.ok) {
        setEmailPhase("done");
        setDevOtp("");
        setStatus((prev) => ({
          ...prev,
          email_verified : true,
          trust_score    : data.trust_score ??
                           ((prev?.trust_score || 0) + 30),
        }));
        fetchStatus();
        return { ok: true };
      }

      // Wrong code
      setOtpError(true);
      setOtp("");
      setEmailPhase("otp");
      setEmailError(data.message || "Incorrect code.");
      if (typeof data.attemptsLeft === "number") {
        setAttemptsLeft(data.attemptsLeft);
      }
      setTimeout(() => setOtpError(false), 700);
      return { ok: false };

    } catch {
      setEmailPhase("otp");
      setEmailError("Network error — check your connection.");
      return { ok: false };
    } finally {
      verifyingRef.current = false;
    }
  }, [fetchStatus]);

  /* ════════════════════════════════════════════════════════════════════
     submitIdentity
  ════════════════════════════════════════════════════════════════════ */
  const submitIdentity = useCallback(async (fields) => {
    const { docType, docNumber, docFront, docBack, selfie } = fields;
    setIdPhase("submitting");
    setIdMsg({ text: "", ok: false });

    const fd = new FormData();
    fd.append("document_type",   docType);
    fd.append("document_number", docNumber.trim());
    if (docFront) fd.append("doc_front", docFront);
    if (docBack)  fd.append("doc_back",  docBack);
    if (selfie)   fd.append("selfie",    selfie);

    try {
      const res  = await fetch(`${API}/verification/submit-identity`, {
        method  : "POST",
        headers : authMultipart(),
        body    : fd,
      });
      const data = await res.json();

      if (res.ok) {
        setIdPhase("done");
        setIdMsg({ text: data.message || "Submitted successfully.", ok: true });
        fetchStatus();
      } else {
        setIdPhase("error");
        setIdMsg({ text: data.message || "Submission failed.", ok: false });
      }
      return { ok: res.ok };

    } catch {
      setIdPhase("error");
      setIdMsg({ text: "Network error — check your connection.", ok: false });
      return { ok: false };
    }
  }, [fetchStatus]);

  /* ════════════════════════════════════════════════════════════════════
     submitStore
  ════════════════════════════════════════════════════════════════════ */
  const submitStore = useCallback(async (fields) => {
    const { storeName, storeDesc, storeLogo } = fields;
    setStorePhase("submitting");
    setStoreMsg({ text: "", ok: false });

    const fd = new FormData();
    fd.append("store_name",        storeName.trim());
    fd.append("store_description", storeDesc.trim());
    if (storeLogo) fd.append("store_logo", storeLogo);

    try {
      const res  = await fetch(`${API}/verification/submit-store`, {
        method  : "POST",
        headers : authMultipart(),
        body    : fd,
      });
      const data = await res.json();

      if (res.ok) {
        setStorePhase("done");
        setStoreMsg({ text: data.message || "Store submitted.", ok: true });
        fetchStatus();
      } else {
        setStorePhase("error");
        setStoreMsg({ text: data.message || "Submission failed.", ok: false });
      }
      return { ok: res.ok };

    } catch {
      setStorePhase("error");
      setStoreMsg({ text: "Network error — check your connection.", ok: false });
      return { ok: false };
    }
  }, [fetchStatus]);

  /* ── expose ─────────────────────────────────────────────────────────── */
  return {
    // status
    status, loadingPage, pageError, fetchStatus,

    // email
    emailPhase, emailError, otp, setOtp,
    otpError, attemptsLeft, resendRemaining,
    resendKey, canResend, setCanResend,
    devOtp, maskedEmail,
    sendOtp, verifyOtp,

    // identity
    idPhase, idMsg, submitIdentity,

    // store
    storePhase, storeMsg, submitStore,
  };
}