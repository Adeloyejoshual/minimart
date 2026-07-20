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

export function useAuthLogic({ setUser, navigate }) {
  const [params] = useSearchParams();

  /* Sanitise the redirect target to prevent open-redirect */
  /* NOTE: location is not directly accessible in a hook without
     being passed in, so we read it from the navigate state below */

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

  /* ── Auto-fill from URL ── */
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
      setUser(data.user, data.token);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }, [form, remember, setUser, navigate]);

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

      if (inviteStatus === "valid" && form.invite_code) {
        payload.invite_code = form.invite_code;
      }

      const { data } = await axios.post(`${API}/register`, payload);

      const token = data.token;
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
      const msg = err.response?.data?.message || "Registration failed.";
      toast.error(msg);
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
    if (isVerifying) return;
    setIsVerifying(true);
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
      setIsVerifying(false);
    }
  }, [authToken, navigate, isVerifying]);

  /* Auto-submit */
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