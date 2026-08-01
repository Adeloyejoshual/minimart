/* ════════════════════════════════════════════════════════════
   FILE: src/pages/AuthPage/useAuthLogic.js
   All state + API calls extracted into one hook.
   Both desktop and mobile consume this — zero duplication.
════════════════════════════════════════════════════════════ */
import {
  useState, useEffect, useRef,
  useCallback, useMemo,
} from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import {
  API, VAPI, RAPI,
  OTP_LENGTH,
  MIN_INVITE_LEN,
  INITIAL_FORM,
  getStrength,
  validateLogin,
  validateRegister,
  sanitizeInviteCode,
} from "./constants";

/* ════════════════════════════════════════════════════════════
   REDIRECT SAFETY
   Prevent open-redirect attacks — only allow same-origin paths.
════════════════════════════════════════════════════════════ */
function sanitizeRedirect(raw) {
  if (!raw || typeof raw !== "string") return "/";
  // Must start with a single "/" and not "//" (protocol-relative)
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  // Block anything that tries to embed a URL
  if (/^\/https?:/i.test(raw)) return "/";
  return raw;
}

/* ════════════════════════════════════════════════════════════
   ERROR MESSAGE EXTRACTOR
   Only produce a user-facing message for real HTTP errors.
   Client-side/programming errors are logged, not toasted,
   so we never show "Login failed" when login actually worked.
════════════════════════════════════════════════════════════ */
function extractApiError(err, fallback) {
  // Real HTTP response from server
  if (err?.response) {
    return err.response.data?.message || fallback;
  }
  // Request was made but no response (network / CORS / timeout)
  if (err?.request) {
    return "Network error. Please check your connection.";
  }
  // Something else — likely a client-side bug. Don't toast.
  if (import.meta.env.DEV) {
    console.error("[useAuthLogic] non-HTTP error:", err);
  }
  return null;
}

export function useAuthLogic({ setUser, navigate }) {
  const [params] = useSearchParams();

  /* ── Mode ── */
  const [mode,     setMode]     = useState("login");
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading,  setLoading]  = useState(false);

  /* ── Form ── */
  const [form, setForm] = useState(INITIAL_FORM);

  /* ── Invite ── */
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
  const [isVerifying,  setIsVerifying]  = useState(false);

  /* ── Post-login redirect (sanitised) ── */
  const redirectTo = useMemo(
    () => sanitizeRedirect(params.get("redirect")),
    [params]
  );

  /* ── Password strength ── */
  const pw = useMemo(() => getStrength(form.password), [form.password]);

  /* ════════════════════════════════════════════════════════
     VALIDATE INVITE CODE
  ════════════════════════════════════════════════════════ */
  const validateInviteCode = useCallback(async (code, signal) => {
    const clean = sanitizeInviteCode(code);
    if (clean.length < MIN_INVITE_LEN) {
      setInviteStatus(null);
      setInvitePreview(null);
      return;
    }

    setInviteStatus("checking");

    try {
      const { data } = await axios.get(
        `${RAPI}/validate/${encodeURIComponent(clean)}`,
        { signal }
      );

      if (data.valid) {
        setInviteStatus("valid");
        setInvitePreview({ code_preview: data.code_preview ?? null });
      } else {
        setInviteStatus("invalid");
        setInvitePreview(null);
      }
    } catch (err) {
      if (axios.isCancel(err)) return;
      setInviteStatus(err.response?.status === 404 ? "invalid" : null);
      setInvitePreview(null);
    }
  }, []);

  /* ── Auto-fill invite from URL ── */
  useEffect(() => {
    const raw =
      params.get("ref")    ||
      params.get("code")   ||
      params.get("invite") ||
      "";

    const refCode = sanitizeInviteCode(raw);
    if (refCode.length < MIN_INVITE_LEN) return;

    setForm((f) => ({ ...f, invite_code: refCode }));
    setMode("register");

    const controller = new AbortController();
    validateInviteCode(refCode, controller.signal);
    return () => controller.abort();
  }, [params, validateInviteCode]);

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

    const controller = new AbortController();
    inviteDebounce.current = setTimeout(() => {
      validateInviteCode(raw, controller.signal);
    }, 600);
  }, [validateInviteCode]);

  const clearInviteCode = useCallback(() => {
    clearTimeout(inviteDebounce.current);
    setForm((f) => ({ ...f, invite_code: "" }));
    setInviteStatus(null);
    setInvitePreview(null);
  }, []);

  useEffect(() => () => clearTimeout(inviteDebounce.current), []);

  const switchMode = useCallback((m) => {
    setMode(m);
    setShowPw(false);
    setOtp("");
    setOtpError(false);
    setOtpErrMsg("");
  }, []);

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
      const msg = extractApiError(err, "Failed to send OTP.");
      if (msg) toast.error(msg);
    }
  }, [authToken]);

  /* ════════════════════════════════════════════════════════
     LOGIN
     ✅ Split into two try/catch blocks:
        1. Network call — errors here mean login failed.
        2. Post-login handoff — errors here are client-side
           bugs; log them but never show "Login failed" to
           the user because login already succeeded.
  ════════════════════════════════════════════════════════ */
  const handleLogin = useCallback(async () => {
    const validationError = validateLogin(form);
    if (validationError) return toast.error(validationError);

    setLoading(true);

    // ─── 1. Perform login ───────────────────────────────
    let loginResult;
    try {
      const { data } = await axios.post(`${API}/login`, {
        email    : form.email.trim().toLowerCase(),
        password : form.password,
        remember,
      });
      loginResult = data;
    } catch (err) {
      const msg = extractApiError(err, "Login failed.");
      if (msg) toast.error(msg);
      setLoading(false);
      return;
    }

    // ─── 2. Hand off to App.jsx (setUser === handleAuthSuccess)
    //        This is the fix for the double-toast bug:
    //        pass ALL 4 args (user, token, navigate, from).
    try {
      setUser(loginResult.user, loginResult.token, navigate, redirectTo);
    } catch (err) {
      // App-side handoff failure — don't show "Login failed"
      // because the login itself worked.
      if (import.meta.env.DEV) {
        console.error("[handleLogin] post-login handoff failed:", err);
      }
      toast.error("Signed in, but something went wrong. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [form, remember, setUser, navigate, redirectTo]);

  /* ════════════════════════════════════════════════════════
     REGISTER
  ════════════════════════════════════════════════════════ */
  const handleRegister = useCallback(async () => {
    const validationError = validateRegister(form);
    if (validationError) return toast.error(validationError);

    setLoading(true);

    // ─── 1. Perform registration ────────────────────────
    let registerResult;
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

      if (inviteStatus === "valid" && form.invite_code) {
        payload.invite_code = form.invite_code;
      }

      const { data } = await axios.post(`${API}/register`, payload);
      registerResult = data;
    } catch (err) {
      const msg = extractApiError(err, "Registration failed.");
      if (msg) toast.error(msg);

      if (err?.response?.data?.code === "INVALID_INVITE_CODE") {
        setInviteStatus("invalid");
        setInvitePreview(null);
      }
      setLoading(false);
      return;
    }

    // ─── 2. Move to OTP screen ──────────────────────────
    try {
      const token = registerResult.token;
      setAuthToken(token);
      sessionStorage.setItem("marketplace_token", token);

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
      // Registration succeeded but OTP send / state setup failed.
      if (import.meta.env.DEV) {
        console.error("[handleRegister] post-register handoff failed:", err);
      }
      toast.error("Account created, but we couldn't send the code. Try resending.");
    } finally {
      setLoading(false);
    }
  }, [form, inviteStatus, sendOtp]);

  /* ════════════════════════════════════════════════════════
     VERIFY OTP
     After success: hand off to App via setUser so we don't
     require a page refresh for the app to know we're logged in.
  ════════════════════════════════════════════════════════ */
  const verifyOtp = useCallback(async (code) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setOtpErrMsg("");

    // ─── 1. Verify code ────────────────────────────────
    let verifyResult;
    try {
      const { data } = await axios.post(
        `${VAPI}/verify-email-otp`,
        { otp: code },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      verifyResult = data;
    } catch (err) {
      const msg  = err?.response?.data?.message || "Incorrect code.";
      const left = err?.response?.data?.attemptsLeft;
      setOtpError(true);
      setOtp("");
      setOtpErrMsg(msg);
      if (typeof left === "number") setAttemptsLeft(left);
      setTimeout(() => setOtpError(false), 700);
      setIsVerifying(false);
      return;
    }

    // ─── 2. Hand off to App ────────────────────────────
    try {
      if (verifyResult?.success) {
        toast.success("Email verified! Welcome to Loemart 🎉");

        // Prefer server-returned user; fall back to a minimal shape.
        const user  = verifyResult.user  ?? { email: maskedEmail };
        const token = verifyResult.token ?? authToken;

        // Clean up the temporary session token
        sessionStorage.removeItem("marketplace_token");

        // Small delay so the success toast is visible
        setTimeout(() => {
          try {
            setUser(user, token, navigate, redirectTo);
          } catch (err) {
            if (import.meta.env.DEV) {
              console.error("[verifyOtp] handoff failed:", err);
            }
            navigate("/", { replace: true });
          }
        }, 600);
      }
    } finally {
      setIsVerifying(false);
    }
  }, [authToken, navigate, isVerifying, setUser, redirectTo, maskedEmail]);

  /* Auto-submit OTP when full length reached */
  useEffect(() => {
    if (otp.length !== OTP_LENGTH || mode !== "otp" || isVerifying) return;
    const t = setTimeout(() => verifyOtp(otp), 180);
    return () => clearTimeout(t);
  }, [otp, mode, isVerifying, verifyOtp]);

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
     SUBMIT DISPATCHER
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
     PUBLIC API
  ════════════════════════════════════════════════════════ */
  return {
    /* mode */
    mode, switchMode,
    /* form */
    form, handleChange, handleInviteChange, clearInviteCode,
    /* invite */
    inviteStatus, invitePreview,
    /* password */
    pw, showPw, setShowPw,
    /* remember */
    remember, setRemember,
    /* loading */
    loading,
    /* OTP */
    otp, setOtp,
    otpError, otpErrMsg,
    attemptsLeft,
    canResend, setCanResend,
    resendKey, resendLeft,
    maskedEmail,
    authToken,
    devOtp,
    isVerifying,
    /* handlers */
    onSubmit, handleResend, sendOtp,
  };
}