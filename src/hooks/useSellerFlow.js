// hooks/useSellerFlow.js
// ═════════════════════════════════════════════════════════════
// Central state machine for the seller onboarding flow.
//
// v3 — Token key aligned + stuck-loader eliminated
// ─────────────────────────────────────────────────────────────
// Backend saves JWT as "sellerToken" (from sellerAuth.routes.js)
// This file + SellerDashboard.jsx MUST use the same key.
//
// Auth endpoints   → /api/seller-auth   (market.users)
// Onboarding       → /api/seller-onboarding
//
// NEVER touches /api/auth or public.users
// ═════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from "react";
import axios from "axios";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const AUTH_API       = "/api/seller-auth";
const ONBOARDING_API = "/api/seller-onboarding";

/*
 * ✅ CRITICAL: must match sellerAuth.routes.js SELLER_TOKEN_KEY
 *    and pages/seller/SellerDashboard.jsx SELLER_TOKEN_KEY.
 *    Mismatch causes infinite loader / blank dashboard.
 */
export const SELLER_TOKEN_KEY = "sellerToken";

export const STEPS = {
  REGISTER:           0,
  OTP_VERIFY:         1,
  STORE_SETUP:        2,
  VERIFICATION:       3,
  REVIEW:             4,
  APPROVED:           5,
  FORGOT_PASSWORD:    6,
  RESET_CODE:         7,
  RESET_NEW_PASSWORD: 8,
};

/* Vendor DB status → UI step */
const STATUS_TO_STEP = {
  pending:      STEPS.VERIFICATION,
  under_review: STEPS.REVIEW,
  approved:     STEPS.APPROVED,
  active:       STEPS.APPROVED,
  rejected:     STEPS.STORE_SETUP,
  suspended:    STEPS.APPROVED,
};

export const STORE_CATEGORIES = [
  "Electronics",
  "Fashion & Apparel",
  "Home & Garden",
  "Health & Beauty",
  "Sports & Outdoors",
  "Books & Media",
  "Food & Grocery",
  "Toys & Games",
  "Automotive",
  "Other",
];

/* ═══════════════════════════════════════════════════════════════
   TOKEN HELPERS
═══════════════════════════════════════════════════════════════ */
const getToken   = ()    => localStorage.getItem(SELLER_TOKEN_KEY);
const saveToken  = (tok) => localStorage.setItem(SELLER_TOKEN_KEY, tok);
const clearToken = ()    => localStorage.removeItem(SELLER_TOKEN_KEY);

/*
 * ✅ One-time migration for users who logged in before this fix.
 *    Runs on module load, before any component mounts.
 */
(function migrateLegacyToken() {
  if (typeof window === "undefined") return;

  const NEW_KEY  = "sellerToken";
  const OLD_KEYS = ["seller_token", "token", "auth_token", "sellerAuthToken"];

  if (localStorage.getItem(NEW_KEY)) return; /* already correct */

  for (const oldKey of OLD_KEYS) {
    const oldVal = localStorage.getItem(oldKey);
    /* Sanity check — JWTs have 3 dot-separated parts */
    if (oldVal && oldVal.split(".").length === 3) {
      localStorage.setItem(NEW_KEY, oldVal);
      localStorage.removeItem(oldKey);
      console.log(
        `[useSellerFlow] 🔄 Migrated token: "${oldKey}" → "${NEW_KEY}"`
      );
      return;
    }
  }
})();

/* ═══════════════════════════════════════════════════════════════
   INITIAL STATE SHAPES
═══════════════════════════════════════════════════════════════ */
const INIT_REGISTER = {
  name:             "",
  email:            "",
  phone:            "",
  password:         "",
  confirm_password: "",
};

const INIT_STORE = {
  store_name:        "",
  store_description: "",
  store_category:    "",
  store_logo:        null,
  store_banner:      null,
  withdrawal_method: "bank_transfer",
  bank_account:      "",
  bank_name:         "",
  bank_code:         "",
  account_name:      "",
};

const INIT_VERIFY = {
  id_card:       null,
  id_card_back:  null,
  selfie:        null,
  business_doc:  null,
  address_proof: null,
  id_type:       "",
  id_number:     "",
  address:       "",
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RX = /^\+?[\d\s\-()]{7,15}$/;

const apiMsg     = (err, fb) => err?.response?.data?.message ?? fb;
const apiCode    = (err)     => err?.response?.data?.code    ?? null;
const httpStatus = (err)     => err?.response?.status        ?? 0;

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */
export const useSellerFlow = () => {

  /* ── Core UI state ─────────────────────────────────────────── */
  const [step,         setStepRaw]     = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [loading,      setLoading]     = useState(false);

  /* ── Form data ─────────────────────────────────────────────── */
  const [registerData, setRegisterData] = useState(INIT_REGISTER);
  const [storeData,    setStoreData]    = useState(INIT_STORE);
  const [verifyData,   setVerifyData]   = useState(INIT_VERIFY);

  /* ── Feedback ─────────────────────────────────────────────── */
  const [errors,    setErrors]    = useState({});
  const [serverMsg, setServerMsg] = useState("");
  const [serverErr, setServerErr] = useState("");

  /* ── Misc ─────────────────────────────────────────────────── */
  const [previewLogo,       setPreviewLogo]       = useState(null);
  const [vendorData,        setVendorData]        = useState(null);
  const [showPassword,      setShowPassword]      = useState(false);
  const [showConfirm,       setShowConfirm]       = useState(false);
  const [isGmailUser,       setIsGmailUser]       = useState(false);
  const [pendingEmail,      setPendingEmail]      = useState("");
  const [verifiedResetCode, setVerifiedResetCode] = useState("");

  /* Prevent double-sync in React StrictMode */
  const syncedRef = useRef(false);

  /* ── Step setter — clears feedback on navigation ─────────── */
  const setStep = useCallback((nextStep, opts = {}) => {
    const { keepMsg = false } = opts;
    setStepRaw(nextStep);
    setErrors({});
    if (!keepMsg) {
      setServerMsg("");
      setServerErr("");
    }
  }, []);

  const clearMessages = useCallback(() => {
    setServerMsg("");
    setServerErr("");
    setErrors({});
  }, []);

  /* ═══════════════════════════════════════════════════════════
     MOUNT SYNC
     ─────────────────────────────────────────────────────
     ✅ Hard timeout (15s) prevents infinite loading
     ✅ Outer try/catch guarantees setInitializing(false)
     ✅ Network errors keep token (may just be slow)
     ✅ Logs every response code for debugging
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    /* Safety net: force exit after 15s */
    const hardTimeout = setTimeout(() => {
      console.warn("[useSellerFlow] ⏰ 15s timeout — forcing REGISTER");
      setStepRaw((s) => s ?? STEPS.REGISTER);
      setInitializing(false);
    }, 15_000);

    const syncFromServer = async () => {
      try {
        const tok = getToken();

        /* No token — new visitor */
        if (!tok) {
          console.log("[useSellerFlow] No token — showing REGISTER");
          setStepRaw(STEPS.REGISTER);
          return;
        }

        console.log("[useSellerFlow] Token found — checking status…");

        try {
          const { data } = await axios.get(`${ONBOARDING_API}/status`, {
            headers: { Authorization: `Bearer ${tok}` },
            timeout: 10_000,
          });

          console.log("[useSellerFlow] Status response:", data);

          if (data?.vendor) {
            setVendorData(data.vendor);
            const nextStep = STATUS_TO_STEP[data.vendor.status] ?? STEPS.STORE_SETUP;
            console.log(`[useSellerFlow] Vendor status="${data.vendor.status}" → step=${nextStep}`);
            setStepRaw(nextStep);
          } else {
            /* Valid token, no vendor record yet */
            console.log("[useSellerFlow] No vendor yet — STORE_SETUP");
            setStepRaw(STEPS.STORE_SETUP);
          }

        } catch (err) {
          const status = httpStatus(err);
          const code   = apiCode(err);

          console.log("[useSellerFlow] Sync error:", { status, code, msg: err.message });

          if (
            status === 401 ||
            code   === "INVALID_TOKEN" ||
            code   === "TOKEN_EXPIRED"
          ) {
            clearToken();
            setStepRaw(STEPS.REGISTER);

          } else if (status === 403 && code === "NOT_SELLER_ACCOUNT") {
            clearToken();
            setIsGmailUser(true);
            setStepRaw(STEPS.REGISTER);

          } else if (status === 403 && code === "EMAIL_NOT_VERIFIED") {
            setPendingEmail(err.response?.data?.email ?? "");
            setStepRaw(STEPS.OTP_VERIFY);

          } else if (status === 404) {
            /* Token valid, no vendor yet — new seller after login */
            setStepRaw(STEPS.STORE_SETUP);

          } else if (status === 0 || !err.response) {
            /*
             * Network error — DON'T clear token.
             * Show store setup so they can retry any action.
             */
            console.warn("[useSellerFlow] Network error — keeping token");
            setStepRaw(STEPS.STORE_SETUP);

          } else {
            console.warn("[useSellerFlow] Unexpected error — clearing token");
            clearToken();
            setStepRaw(STEPS.REGISTER);
          }
        }

      } catch (fatalErr) {
        /* Absolute fallback — never leave user staring at blank screen */
        console.error("[useSellerFlow] Fatal error:", fatalErr);
        setStepRaw(STEPS.REGISTER);

      } finally {
        clearTimeout(hardTimeout);
        setInitializing(false);
      }
    };

    syncFromServer();

    return () => clearTimeout(hardTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══════════════════════════════════════════════════════════
     SIGN OUT — full state reset
  ═══════════════════════════════════════════════════════════ */
  const signOut = useCallback(() => {
    clearToken();
    setStepRaw(STEPS.REGISTER);
    setRegisterData(INIT_REGISTER);
    setStoreData(INIT_STORE);
    setVerifyData(INIT_VERIFY);
    setVendorData(null);
    setErrors({});
    setServerMsg("");
    setServerErr("");
    setPreviewLogo(null);
    setShowPassword(false);
    setShowConfirm(false);
    setIsGmailUser(false);
    setLoading(false);
    setPendingEmail("");
    setVerifiedResetCode("");
    syncedRef.current = false;
  }, []);

  /* ═══════════════════════════════════════════════════════════
     FIELD HANDLERS
  ═══════════════════════════════════════════════════════════ */
  const handleRegisterChange = useCallback((e) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev)       => ({ ...prev, [name]: "" }));
    setServerErr("");
  }, []);

  const handleStoreChange = useCallback((e) => {
    const { name, value, files } = e.target;

    if (files?.[0]) {
      const file = files[0];
      setStoreData((prev) => ({ ...prev, [name]: file }));

      if (name === "store_logo") {
        const reader = new FileReader();
        reader.onloadend = () => setPreviewLogo(reader.result);
        reader.readAsDataURL(file);
      }
    } else {
      setStoreData((prev) => ({ ...prev, [name]: value }));
    }

    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerErr("");
  }, []);

  const handleVerifyChange = useCallback((e) => {
    const { name, value, files } = e.target;

    if (files?.[0]) {
      setVerifyData((prev) => ({ ...prev, [name]: files[0] }));
    } else if (value !== undefined) {
      setVerifyData((prev) => ({ ...prev, [name]: value }));
    }

    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerErr("");
  }, []);

  const setBankField = useCallback((field, value) => {
    setStoreData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev)   => ({ ...prev, [field]: "" }));
  }, []);

  /* ═══════════════════════════════════════════════════════════
     VALIDATION
  ═══════════════════════════════════════════════════════════ */
  const validateRegister = () => {
    const e = {};

    if (!registerData.name.trim())
      e.name = "Full name is required";
    else if (registerData.name.trim().length < 2)
      e.name = "Name must be at least 2 characters";

    if (!registerData.email.trim())
      e.email = "Email is required";
    else if (!EMAIL_RX.test(registerData.email.trim()))
      e.email = "Enter a valid email address";

    if (!registerData.phone.trim())
      e.phone = "Phone number is required";
    else if (!PHONE_RX.test(registerData.phone.trim()))
      e.phone = "Enter a valid phone number (e.g. +234 800 000 0000)";

    if (!registerData.password)
      e.password = "Password is required";
    else if (registerData.password.length < 8)
      e.password = "At least 8 characters required";
    else if (!/[A-Z]/.test(registerData.password))
      e.password = "Must contain at least one uppercase letter";
    else if (!/\d/.test(registerData.password))
      e.password = "Must contain at least one number";

    if (!registerData.confirm_password)
      e.confirm_password = "Please confirm your password";
    else if (registerData.password !== registerData.confirm_password)
      e.confirm_password = "Passwords do not match";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStore = () => {
    const e = {};

    if (!storeData.store_name.trim())
      e.store_name = "Store name is required";
    else if (storeData.store_name.trim().length > 100)
      e.store_name = "Store name must be under 100 characters";

    if (!storeData.store_category)
      e.store_category = "Please select a category";

    if (!storeData.store_description.trim())
      e.store_description = "Description is required";

    if (!storeData.bank_name.trim())
      e.bank_name = "Please select a bank";

    if (!storeData.bank_account.trim())
      e.bank_account = "Bank account number is required";
    else if (!/^\d{10}$/.test(storeData.bank_account.trim()))
      e.bank_account = "Account number must be exactly 10 digits";

    if (!storeData.account_name?.trim())
      e.account_name = "Please verify your bank account first";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateVerification = () => {
    const e = {};

    if (!verifyData.id_type)
      e.id_type = "Please select an ID type";

    if (!verifyData.id_number?.trim()) {
      e.id_number = "ID number is required";
    } else {
      const cleaned  = verifyData.id_number.replace(/\s/g, "").toUpperCase();
      const ID_RULES = {
        nin:      { digits: 11, label: "NIN" },
        passport: { digits: 9,  label: "Passport", alphanumeric: true },
        drivers:  { digits: 12, label: "Driver's Licence" },
        voters:   { digits: 19, label: "Voter's Card" },
      };
      const rule = ID_RULES[verifyData.id_type];

      if (rule) {
        if (rule.alphanumeric) {
          if (!/^[A-Z0-9]{9}$/.test(cleaned))
            e.id_number = "Passport must be 9 alphanumeric characters";
        } else {
          const digitCount = cleaned.replace(/\D/g, "").length;
          if (digitCount !== rule.digits)
            e.id_number = `${rule.label} must be ${rule.digits} digits`;
        }
      }
    }

    if (!verifyData.id_card)         e.id_card      = "ID card front photo is required";
    if (!verifyData.id_card_back)    e.id_card_back = "ID card back photo is required";
    if (!verifyData.selfie)          e.selfie       = "Selfie with ID is required";
    if (!verifyData.address?.trim()) e.address      = "Home address is required";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ═══════════════════════════════════════════════════════════
     API — REGISTER
  ═══════════════════════════════════════════════════════════ */
  const submitRegister = useCallback(async () => {
    if (!validateRegister()) return;

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const { data } = await axios.post(`${AUTH_API}/register`, {
        name:     registerData.name.trim(),
        email:    registerData.email.trim().toLowerCase(),
        phone:    registerData.phone.trim(),
        password: registerData.password,
      });

      const email = registerData.email.trim().toLowerCase();
      setPendingEmail(email);
      setStep(STEPS.OTP_VERIFY, { keepMsg: true });
      setServerMsg(
        data.message ??
        "Account created! Check your email for a 6-digit verification code."
      );

    } catch (err) {
      const code = apiCode(err);

      if (code === "EMAIL_TAKEN_UNVERIFIED") {
        const email = err.response?.data?.email ?? registerData.email.trim().toLowerCase();
        setPendingEmail(email);
        setStep(STEPS.OTP_VERIFY, { keepMsg: true });
        setServerMsg(
          err.response?.data?.message ??
          "Account found! We've resent your verification code."
        );
        return;
      }

      setServerErr(apiMsg(err, "Registration failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [registerData]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══════════════════════════════════════════════════════════
     API — VERIFY EMAIL OTP
  ═══════════════════════════════════════════════════════════ */
  const submitOtp = useCallback(async (code) => {
    const trimmed = code?.trim() ?? "";

    if (!trimmed) {
      setServerErr("Please enter the 6-digit verification code.");
      return;
    }
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setServerErr("Code must be exactly 6 digits.");
      return;
    }

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/verify-email`, {
        email: pendingEmail,
        code:  trimmed,
      });

      /* Silent login using password still in memory */
      if (registerData.password) {
        try {
          const { data: loginData } = await axios.post(`${AUTH_API}/login`, {
            email:    pendingEmail,
            password: registerData.password,
          });
          if (loginData.token) saveToken(loginData.token);
        } catch (silentErr) {
          console.warn(
            "[submitOtp] silent login failed:",
            silentErr.response?.data?.message ?? silentErr.message
          );
        }
      }

      setStep(STEPS.STORE_SETUP, { keepMsg: true });
      setServerMsg("Email verified! Let's set up your store.");

    } catch (err) {
      const code = apiCode(err);
      if (code === "CODE_EXPIRED")
        setServerErr("Code has expired. Please request a new one.");
      else if (code === "INVALID_CODE")
        setServerErr("Incorrect code. Please check and try again.");
      else
        setServerErr(apiMsg(err, "Verification failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [pendingEmail, registerData.password]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══════════════════════════════════════════════════════════
     API — RESEND OTP
  ═══════════════════════════════════════════════════════════ */
  const resendOtp = useCallback(async () => {
    if (!pendingEmail) return;

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/resend-verification`, { email: pendingEmail });
      setServerMsg("A new code has been sent to your email.");
    } catch (err) {
      setServerErr(apiMsg(err, "Failed to resend code. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [pendingEmail]);

  /* ═══════════════════════════════════════════════════════════
     API — LOGIN
     ✅ FIX: redirects to /seller/dashboard/overview (with tab)
  ═══════════════════════════════════════════════════════════ */
  const submitLogin = useCallback(async (email, password) => {
    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const { data: loginData } = await axios.post(`${AUTH_API}/login`, {
        email:    email.trim().toLowerCase(),
        password,
      });

      if (!loginData.token) {
        setServerErr("Login failed — no token received. Please try again.");
        return;
      }

      saveToken(loginData.token);

      /* Fetch vendor status to route correctly */
      try {
        const { data: statusData } = await axios.get(`${ONBOARDING_API}/status`, {
          headers: { Authorization: `Bearer ${loginData.token}` },
          timeout: 10_000,
        });

        if (statusData?.vendor) {
          setVendorData(statusData.vendor);
          const { status } = statusData.vendor;

          if (status === "active" || status === "approved") {
            window.location.replace("/seller/dashboard/overview");
            return;
          }

          setStep(STATUS_TO_STEP[status] ?? STEPS.STORE_SETUP);
        } else {
          setStep(STEPS.STORE_SETUP);
        }

      } catch (statusErr) {
        const status = httpStatus(statusErr);
        const code   = apiCode(statusErr);

        if (status === 404) {
          setStep(STEPS.STORE_SETUP);

        } else if (status === 403 && code === "EMAIL_NOT_VERIFIED") {
          setPendingEmail(statusErr.response?.data?.email ?? email.trim().toLowerCase());
          setStep(STEPS.OTP_VERIFY);

        } else if (status === 403 && code === "NOT_SELLER_ACCOUNT") {
          clearToken();
          setServerErr(
            "This email belongs to a marketplace account. " +
            "Please create a separate seller account."
          );

        } else {
          console.warn("[submitLogin] status check failed:", statusErr.message);
          setStep(STEPS.STORE_SETUP);
        }
      }

    } catch (err) {
      const status = httpStatus(err);
      const code   = apiCode(err);

      if (status === 401) {
        setServerErr("Incorrect email or password.");

      } else if (status === 403 && code === "EMAIL_NOT_VERIFIED") {
        setPendingEmail(err.response?.data?.email ?? email.trim().toLowerCase());
        setStep(STEPS.OTP_VERIFY);

      } else if (status === 403 && code === "ACCOUNT_SUSPENDED") {
        setServerErr("Your seller account has been suspended. Please contact support.");

      } else if (status === 429) {
        setServerErr("Too many sign-in attempts. Please wait 15 minutes and try again.");

      } else {
        setServerErr(apiMsg(err, "Sign in failed. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══════════════════════════════════════════════════════════
     API — FORGOT PASSWORD
  ═══════════════════════════════════════════════════════════ */
  const submitForgotPassword = useCallback(async (email) => {
    const cleanEmail = email?.trim().toLowerCase() ?? "";

    if (!cleanEmail) {
      setServerErr("Email address is required.");
      return;
    }
    if (!EMAIL_RX.test(cleanEmail)) {
      setServerErr("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/forgot-password`, { email: cleanEmail });
    } catch (err) {
      if (httpStatus(err) === 403) {
        setServerErr("Your account has been suspended. Contact support.");
        setLoading(false);
        return;
      }
    } finally {
      setLoading(false);
    }

    setPendingEmail(cleanEmail);
    setStep(STEPS.RESET_CODE, { keepMsg: true });
    setServerMsg(
      "If a seller account exists with this email, " +
      "a 6-digit reset code has been sent."
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══════════════════════════════════════════════════════════
     API — VERIFY RESET CODE
  ═══════════════════════════════════════════════════════════ */
  const submitResetCode = useCallback(async (code) => {
    const trimmed = code?.trim() ?? "";

    if (!trimmed) {
      setServerErr("Please enter the 6-digit reset code.");
      return;
    }
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setServerErr("Code must be exactly 6 digits.");
      return;
    }

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/verify-reset-code`, {
        email: pendingEmail,
        code:  trimmed,
      });

      setVerifiedResetCode(trimmed);
      setStep(STEPS.RESET_NEW_PASSWORD, { keepMsg: true });
      setServerMsg("Code verified! Please set your new password below.");

    } catch (err) {
      const code = apiCode(err);
      if (code === "CODE_EXPIRED")
        setServerErr("Reset code has expired. Please request a new one.");
      else if (code === "INVALID_CODE" || code === "NO_RESET_REQUESTED")
        setServerErr("Invalid or expired reset code. Please try again.");
      else
        setServerErr(apiMsg(err, "Verification failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [pendingEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══════════════════════════════════════════════════════════
     API — SET NEW PASSWORD
  ═══════════════════════════════════════════════════════════ */
  const submitNewPassword = useCallback(async (newPassword, confirmPassword) => {
    if (!newPassword) {
      setServerErr("New password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setServerErr("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setServerErr("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/\d/.test(newPassword)) {
      setServerErr("Password must contain at least one number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setServerErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/reset-password`, {
        email:       pendingEmail,
        code:        verifiedResetCode,
        newPassword,
      });

      const resetEmail = pendingEmail;
      setPendingEmail("");
      setVerifiedResetCode("");

      setStep(STEPS.REGISTER, { keepMsg: true });
      setServerMsg(
        "✅ Password reset successfully! Please sign in with your new password."
      );

      setPendingEmail(resetEmail);

    } catch (err) {
      const code = apiCode(err);

      if (code === "CODE_EXPIRED") {
        setServerErr("Your reset code has expired. Please start the process again.");
        setTimeout(() => setStep(STEPS.FORGOT_PASSWORD), 2500);

      } else if (code === "INVALID_CODE" || code === "NO_RESET_REQUESTED") {
        setServerErr("Invalid reset code. Please start the process again.");
        setTimeout(() => setStep(STEPS.FORGOT_PASSWORD), 2500);

      } else {
        setServerErr(apiMsg(err, "Password reset failed. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [pendingEmail, verifiedResetCode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══════════════════════════════════════════════════════════
     API — RESEND RESET CODE
  ═══════════════════════════════════════════════════════════ */
  const resendResetCode = useCallback(async () => {
    if (!pendingEmail) return;

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/forgot-password`, { email: pendingEmail });
    } catch {
      /* silent — never reveal if email exists */
    } finally {
      setLoading(false);
    }

    setServerMsg("A new reset code has been sent to your email.");
  }, [pendingEmail]);

  /* ═══════════════════════════════════════════════════════════
     API — SETUP STORE
     ✅ FIX: redirects to /seller/dashboard/overview
  ═══════════════════════════════════════════════════════════ */
  const submitStore = useCallback(async () => {
    if (!validateStore()) return;

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const form = new FormData();
      form.append("store_name",        storeData.store_name.trim());
      form.append("store_description", storeData.store_description.trim());
      form.append("store_category",    storeData.store_category);
      form.append("withdrawal_method", "bank_transfer");
      form.append("bank_account",      storeData.bank_account.trim());
      form.append("bank_name",         storeData.bank_name.trim());
      form.append("account_name",      storeData.account_name.trim());

      if (storeData.bank_code)    form.append("bank_code",    storeData.bank_code.trim());
      if (storeData.store_logo)   form.append("store_logo",   storeData.store_logo);
      if (storeData.store_banner) form.append("store_banner", storeData.store_banner);

      const { data } = await axios.post(`${ONBOARDING_API}/setup-store`, form, {
        headers: {
          Authorization:  `Bearer ${getToken()}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (data.vendor) setVendorData(data.vendor);
      setStep(STEPS.VERIFICATION, { keepMsg: true });
      setServerMsg(data.message ?? "Store created! Let's verify your identity.");

    } catch (err) {
      const code           = apiCode(err);
      const existingStatus = err.response?.data?.status;

      if (code === "VENDOR_EXISTS") {
        if (existingStatus === "pending") { setStep(STEPS.VERIFICATION); return; }
        if (existingStatus === "under_review") { setStep(STEPS.REVIEW); return; }
        if (existingStatus === "active" || existingStatus === "approved") {
          window.location.replace("/seller/dashboard/overview");
          return;
        }
      }

      setServerErr(apiMsg(err, "Store setup failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [storeData]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══════════════════════════════════════════════════════════
     API — SUBMIT VERIFICATION
  ═══════════════════════════════════════════════════════════ */
  const submitVerification = useCallback(async () => {
    if (!validateVerification()) return;

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const form = new FormData();

      ["id_card", "id_card_back", "selfie", "business_doc", "address_proof"]
        .forEach((key) => {
          if (verifyData[key]) form.append(key, verifyData[key]);
        });

      form.append("id_type",   verifyData.id_type);
      form.append("id_number", verifyData.id_number.replace(/\s/g, "").toUpperCase());
      form.append("address",   verifyData.address.trim());

      const { data } = await axios.post(`${ONBOARDING_API}/verify`, form, {
        headers: {
          Authorization:  `Bearer ${getToken()}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (data.vendor) setVendorData(data.vendor);
      setStep(STEPS.REVIEW, { keepMsg: true });
      setServerMsg(
        data.message ??
        "Documents submitted! We'll review within 1–3 business days."
      );

    } catch (err) {
      setServerErr(apiMsg(err, "Verification submission failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [verifyData]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ═══════════════════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════════════════ */
  return {
    /* UI state */
    step, setStep,
    initializing,
    loading,

    /* Form data */
    registerData,
    storeData,
    verifyData,

    /* Feedback */
    errors,
    serverMsg, setServerMsg,
    serverErr, setServerErr,
    clearMessages,

    /* Misc */
    previewLogo,
    vendorData, setVendorData,
    showPassword, setShowPassword,
    showConfirm,  setShowConfirm,
    isGmailUser,
    pendingEmail, setPendingEmail,
    verifiedResetCode,

    /* Field handlers */
    handleRegisterChange,
    handleStoreChange,
    handleVerifyChange,
    setBankField,

    /* Auth API */
    submitRegister,
    submitOtp,
    resendOtp,
    submitLogin,

    /* Password reset API */
    submitForgotPassword,
    submitResetCode,
    submitNewPassword,
    resendResetCode,

    /* Onboarding API */
    submitStore,
    submitVerification,

    /* Session */
    signOut,
  };
};

export default useSellerFlow;