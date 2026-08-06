// hooks/useSellerFlow.js
import { useState, useCallback, useEffect, useRef } from "react";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// API BASE
// Seller auth is on a separate prefix from marketplace auth.
// Marketplace: /api/auth          → public.users
// Seller:      /api/seller-auth   → market.users
// ─────────────────────────────────────────────────────────────
const AUTH_API = "/api/seller-auth";

// ─────────────────────────────────────────────────────────────
// STEPS
// ─────────────────────────────────────────────────────────────
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

// Map vendor DB status → step
const STATUS_TO_STEP = {
  pending:      STEPS.VERIFICATION,
  under_review: STEPS.REVIEW,
  approved:     STEPS.APPROVED,
  active:       STEPS.APPROVED,
  rejected:     STEPS.STORE_SETUP,
  suspended:    STEPS.APPROVED,
};

// ─────────────────────────────────────────────────────────────
// TOKEN HELPERS
// ─────────────────────────────────────────────────────────────
export const SELLER_TOKEN_KEY = "seller_token";

const getToken   = ()  => localStorage.getItem(SELLER_TOKEN_KEY);
const saveToken  = (t) => localStorage.setItem(SELLER_TOKEN_KEY, t);
const clearToken = ()  => localStorage.removeItem(SELLER_TOKEN_KEY);

// ─────────────────────────────────────────────────────────────
// STORE CATEGORIES
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────
const INITIAL_REGISTER_DATA = {
  name:             "",
  email:            "",
  phone:            "",
  password:         "",
  confirm_password: "",
};

const INITIAL_STORE_DATA = {
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

const INITIAL_VERIFY_DATA = {
  id_card:       null,
  id_card_back:  null,
  selfie:        null,
  business_doc:  null,
  address_proof: null,
  id_type:       "",
  id_number:     "",
  address:       "",
};

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────
export const useSellerFlow = () => {

  const [step,              setStep]              = useState(null);
  const [registerData,      setRegisterData]      = useState(INITIAL_REGISTER_DATA);
  const [storeData,         setStoreData]         = useState(INITIAL_STORE_DATA);
  const [verifyData,        setVerifyData]        = useState(INITIAL_VERIFY_DATA);
  const [errors,            setErrors]            = useState({});
  const [loading,           setLoading]           = useState(false);
  const [initializing,      setInitializing]      = useState(true);
  const [serverMsg,         setServerMsg]         = useState("");
  const [serverErr,         setServerErr]         = useState("");
  const [previewLogo,       setPreviewLogo]       = useState(null);
  const [vendorData,        setVendorData]        = useState(null);
  const [showPassword,      setShowPassword]      = useState(false);
  const [showConfirm,       setShowConfirm]       = useState(false);
  const [isGmailUser,       setIsGmailUser]       = useState(false);
  const [pendingEmail,      setPendingEmail]      = useState("");
  const [verifiedResetCode, setVerifiedResetCode] = useState("");

  const syncedRef = useRef(false);

  // ── Clear messages whenever step changes ──────────────────
  useEffect(() => {
    if (step === null) return;
    setServerMsg("");
    setServerErr("");
    setErrors({});
  }, [step]);

  // ─────────────────────────────────────────────────────────
  // MOUNT — sync step from server
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    const syncFromServer = async () => {
      const t = getToken();

      // No token — show register immediately, skip API call
      if (!t) {
        setStep(STEPS.REGISTER);
        setInitializing(false);
        return;
      }

      try {
        const { data } = await axios.get(
          "/api/seller-onboarding/status",
          {
            headers: { Authorization: `Bearer ${t}` },
            timeout: 10_000,
          }
        );

        if (data?.vendor) {
          setVendorData(data.vendor);
          const restored = STATUS_TO_STEP[data.vendor.status];
          setStep(restored ?? STEPS.STORE_SETUP);
        } else {
          // Valid token, no vendor yet
          setStep(STEPS.STORE_SETUP);
        }

      } catch (err) {
        const httpStatus = err.response?.status;
        const code       = err.response?.data?.code;

        if (
          httpStatus === 401 ||
          code === "INVALID_TOKEN" ||
          code === "TOKEN_EXPIRED"
        ) {
          // Stale token → clear + show register
          clearToken();
          setStep(STEPS.REGISTER);

        } else if (httpStatus === 403 && code === "NOT_SELLER_ACCOUNT") {
          // Marketplace account tried to use seller routes
          clearToken();
          setIsGmailUser(true);
          setStep(STEPS.REGISTER);

        } else if (httpStatus === 403 && code === "EMAIL_NOT_VERIFIED") {
          // Has token but email not verified yet
          const email = err.response?.data?.email ?? "";
          setPendingEmail(email);
          setStep(STEPS.OTP_VERIFY);

        } else if (httpStatus === 404) {
          // Valid token, no vendor record yet
          setStep(STEPS.STORE_SETUP);

        } else {
          // Network error / 500 — clear token, restart
          console.warn("[useSellerFlow] sync error:", err.message);
          clearToken();
          setStep(STEPS.REGISTER);
        }

      } finally {
        setInitializing(false);
      }
    };

    syncFromServer();
  }, []);

  // ─────────────────────────────────────────────────────────
  // SIGN OUT
  // ─────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    clearToken();
    setStep(STEPS.REGISTER);
    setRegisterData(INITIAL_REGISTER_DATA);
    setStoreData(INITIAL_STORE_DATA);
    setVerifyData(INITIAL_VERIFY_DATA);
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

  // ─────────────────────────────────────────────────────────
  // FIELD HANDLERS
  // ─────────────────────────────────────────────────────────
  const handleRegisterChange = useCallback((e) => {
    const { name, value } = e.target;
    setRegisterData((p) => ({ ...p, [name]: value }));
    setErrors((p)       => ({ ...p, [name]: ""    }));
    setServerErr("");
  }, []);

  const handleStoreChange = useCallback((e) => {
    const { name, value, files } = e.target;
    if (files?.[0]) {
      const file = files[0];
      setStoreData((p) => ({ ...p, [name]: file }));
      if (name === "store_logo") {
        const reader = new FileReader();
        reader.onloadend = () => setPreviewLogo(reader.result);
        reader.readAsDataURL(file);
      }
    } else {
      setStoreData((p) => ({ ...p, [name]: value }));
    }
    setErrors((p) => ({ ...p, [name]: "" }));
    setServerErr("");
  }, []);

  const handleVerifyChange = useCallback((e) => {
    const { name, value, files } = e.target;
    if (files?.[0]) {
      setVerifyData((p) => ({ ...p, [name]: files[0] }));
    } else if (value !== undefined) {
      setVerifyData((p) => ({ ...p, [name]: value }));
    }
    setErrors((p) => ({ ...p, [name]: "" }));
    setServerErr("");
  }, []);

  const setBankField = useCallback((field, value) => {
    setStoreData((p) => ({ ...p, [field]: value }));
    setErrors((p)   => ({ ...p, [field]: "" }));
  }, []);

  // ─────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────
  const validateRegister = () => {
    const e       = {};
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRx = /^\+?[\d\s\-()]{7,15}$/;

    if (!registerData.name.trim())
      e.name = "Full name is required";
    else if (registerData.name.trim().length < 2)
      e.name = "Name must be at least 2 characters";

    if (!registerData.email.trim())
      e.email = "Email is required";
    else if (!emailRx.test(registerData.email))
      e.email = "Enter a valid email address";

    if (!registerData.phone.trim())
      e.phone = "Phone number is required";
    else if (!phoneRx.test(registerData.phone))
      e.phone = "Enter a valid phone number";

    if (!registerData.password)
      e.password = "Password is required";
    else if (registerData.password.length < 8)
      e.password = "At least 8 characters";
    else if (!/[A-Z]/.test(registerData.password))
      e.password = "Must contain one uppercase letter";
    else if (!/\d/.test(registerData.password))
      e.password = "Must contain one number";

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
    else if (storeData.store_name.length > 100)
      e.store_name = "Max 100 characters";

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
      const ID_DIGITS = {
        nin: 11, passport: 9, drivers: 12, voters: 19,
      };
      const cleaned  = verifyData.id_number.replace(/\s/g, "").toUpperCase();
      const expected = ID_DIGITS[verifyData.id_type];

      if (verifyData.id_type === "passport") {
        if (!/^[A-Z0-9]{9}$/.test(cleaned))
          e.id_number = "Passport must be 9 characters";
      } else if (expected) {
        const actual = cleaned.replace(/\D/g, "").length;
        if (actual !== expected) {
          const labels = {
            nin:     "NIN",
            drivers: "Driver's Licence",
            voters:  "Voter's Card",
          };
          e.id_number =
            `${labels[verifyData.id_type]} must be ${expected} digits`;
        }
      }
    }

    if (!verifyData.id_card)
      e.id_card      = "ID card front photo is required";
    if (!verifyData.id_card_back)
      e.id_card_back = "ID card back photo is required";
    if (!verifyData.selfie)
      e.selfie       = "Selfie with ID is required";
    if (!verifyData.address?.trim())
      e.address      = "Home address is required";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─────────────────────────────────────────────────────────
  // API: REGISTER
  // POST /api/seller-auth/register → market.users
  // ─────────────────────────────────────────────────────────
  const submitRegister = async () => {
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

      setPendingEmail(registerData.email.trim().toLowerCase());
      setServerMsg(
        data.message ??
        "Account created! Check your email for the verification code."
      );
      setStep(STEPS.OTP_VERIFY);

    } catch (err) {
      const code = err.response?.data?.code;

      // Unverified account already exists — redirect to OTP screen
      if (code === "EMAIL_TAKEN_UNVERIFIED") {
        setPendingEmail(
          err.response?.data?.email ??
          registerData.email.trim().toLowerCase()
        );
        setServerMsg(
          err.response?.data?.message ??
          "We've resent your verification code."
        );
        setStep(STEPS.OTP_VERIFY);
        return;
      }

      setServerErr(
        err.response?.data?.message ?? "Registration failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: VERIFY EMAIL OTP
  // POST /api/seller-auth/verify-email
  // ─────────────────────────────────────────────────────────
  const submitOtp = async (code) => {
    if (!code?.trim()) {
      setServerErr("Please enter the verification code.");
      return;
    }
    if (code.trim().length !== 6) {
      setServerErr("Code must be exactly 6 digits.");
      return;
    }

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/verify-email`, {
        email: pendingEmail,
        code:  code.trim(),
      });

      // Silent login to get seller token immediately
      // Uses password still in registerData (just filled in)
      if (registerData.password) {
        try {
          const { data: loginData } = await axios.post(
            `${AUTH_API}/login`,
            {
              email:    pendingEmail,
              password: registerData.password,
            }
          );
          if (loginData.token) saveToken(loginData.token);
        } catch {
          // Silent — they'll be prompted to log in at store setup
          // if token is missing
        }
      }

      setServerMsg("Email verified! Setting up your store…");
      setStep(STEPS.STORE_SETUP);

    } catch (err) {
      const c = err.response?.data?.code;
      if (c === "CODE_EXPIRED") {
        setServerErr("Your code has expired. Please request a new one.");
      } else if (c === "INVALID_CODE") {
        setServerErr("Invalid code. Please check and try again.");
      } else {
        setServerErr(
          err.response?.data?.message ?? "Verification failed."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: RESEND EMAIL OTP
  // POST /api/seller-auth/resend-verification
  // ─────────────────────────────────────────────────────────
  const resendOtp = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/resend-verification`, {
        email: pendingEmail,
      });
      setServerMsg(
        "A new verification code has been sent to your email."
      );
    } catch (err) {
      setServerErr(
        err.response?.data?.message ?? "Failed to resend code."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: LOGIN (returning sellers / sign-in form)
  // POST /api/seller-auth/login → market.users
  // Used by RegisterStep SignInForm
  // ─────────────────────────────────────────────────────────
  const submitLogin = async (email, password) => {
    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const { data: loginData } = await axios.post(
        `${AUTH_API}/login`,
        {
          email:    email.trim().toLowerCase(),
          password,
        }
      );

      if (!loginData.token) {
        setServerErr("Login failed — no token received.");
        return;
      }

      saveToken(loginData.token);

      // Fetch vendor status to restore correct step
      try {
        const { data: statusData } = await axios.get(
          "/api/seller-onboarding/status",
          {
            headers: { Authorization: `Bearer ${loginData.token}` },
            timeout: 10_000,
          }
        );

        if (statusData?.vendor) {
          setVendorData(statusData.vendor);
          const { status } = statusData.vendor;

          // Active / approved → redirect to dashboard
          if (["active", "approved"].includes(status)) {
            window.location.replace("/seller/dashboard");
            return;
          }

          const nextStep = STATUS_TO_STEP[status] ?? STEPS.STORE_SETUP;
          setStep(nextStep);

        } else {
          // No vendor yet → go to store setup
          setStep(STEPS.STORE_SETUP);
        }

      } catch (statusErr) {
        const httpStatus = statusErr.response?.status;
        const code       = statusErr.response?.data?.code;

        if (httpStatus === 404) {
          // Logged in but no vendor record
          setStep(STEPS.STORE_SETUP);

        } else if (httpStatus === 403 && code === "EMAIL_NOT_VERIFIED") {
          // Logged in but email not verified
          const unverifiedEmail =
            statusErr.response?.data?.email ??
            email.trim().toLowerCase();
          setPendingEmail(unverifiedEmail);
          setStep(STEPS.OTP_VERIFY);

        } else if (httpStatus === 403 && code === "NOT_SELLER_ACCOUNT") {
          // Marketplace account used on seller route
          clearToken();
          setServerErr(
            "This is a marketplace account. " +
            "Please create a separate seller account."
          );
        } else {
          // Status check failed — still navigate to store setup
          console.warn("[submitLogin] status check failed:", statusErr.message);
          setStep(STEPS.STORE_SETUP);
        }
      }

    } catch (err) {
      const status = err.response?.status;
      const code   = err.response?.data?.code;
      const msg    = err.response?.data?.message;

      if (status === 401) {
        setServerErr("Incorrect email or password.");

      } else if (status === 403 && code === "EMAIL_NOT_VERIFIED") {
        // Login blocked — email not verified
        // Go straight to OTP screen
        const unverifiedEmail =
          err.response?.data?.email ?? email.trim().toLowerCase();
        setPendingEmail(unverifiedEmail);
        setStep(STEPS.OTP_VERIFY);
        return;

      } else if (status === 403 && code === "ACCOUNT_SUSPENDED") {
        setServerErr("Your seller account has been suspended.");

      } else {
        setServerErr(msg ?? "Sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: FORGOT PASSWORD
  // POST /api/seller-auth/forgot-password → market.users
  // Sends 6-digit OTP — separate from marketplace forgot pw
  // ─────────────────────────────────────────────────────────
  const submitForgotPassword = async (email) => {
    if (!email?.trim()) {
      setServerErr("Email is required.");
      return;
    }

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email.trim())) {
      setServerErr("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/forgot-password`, {
        email: email.trim().toLowerCase(),
      });

      setPendingEmail(email.trim().toLowerCase());
      setServerMsg(
        "If a seller account exists, a reset code has been sent."
      );
      setStep(STEPS.RESET_CODE);

    } catch (err) {
      if (err.response?.status === 403) {
        setServerErr(
          "Your account has been suspended. Contact support."
        );
      } else {
        // Always go to RESET_CODE — don't reveal if email exists
        setPendingEmail(email.trim().toLowerCase());
        setServerMsg(
          "If a seller account exists, a reset code has been sent."
        );
        setStep(STEPS.RESET_CODE);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: VERIFY RESET CODE (step 1 of password reset)
  // POST /api/seller-auth/verify-reset-code → market.users
  // Validates OTP without changing password yet
  // ─────────────────────────────────────────────────────────
  const submitResetCode = async (code) => {
    if (!code?.trim()) {
      setServerErr("Please enter the reset code.");
      return;
    }
    if (code.trim().length !== 6) {
      setServerErr("Code must be exactly 6 digits.");
      return;
    }

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/verify-reset-code`, {
        email: pendingEmail,
        code:  code.trim(),
      });

      // Store verified code for step 2
      setVerifiedResetCode(code.trim());
      setServerMsg("Code verified! Now set your new password.");
      setStep(STEPS.RESET_NEW_PASSWORD);

    } catch (err) {
      const c = err.response?.data?.code;
      if (c === "CODE_EXPIRED") {
        setServerErr(
          "Reset code has expired. Please request a new one."
        );
      } else if (c === "INVALID_CODE") {
        setServerErr(
          "Invalid reset code. Please check and try again."
        );
      } else {
        setServerErr(
          err.response?.data?.message ?? "Verification failed."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: SET NEW PASSWORD (step 2 of password reset)
  // POST /api/seller-auth/reset-password → market.users
  // Re-verifies code + sets new password in one request
  // ─────────────────────────────────────────────────────────
  const submitNewPassword = async (newPassword, confirmPassword) => {
    if (!newPassword) {
      setServerErr("New password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setServerErr("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setServerErr("Must contain at least one uppercase letter.");
      return;
    }
    if (!/\d/.test(newPassword)) {
      setServerErr("Must contain at least one number.");
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

      setServerMsg(
        "Password reset successfully! Redirecting to sign in…"
      );
      setPendingEmail("");
      setVerifiedResetCode("");

      // Short delay so user sees the success message
      setTimeout(() => {
        setStep(STEPS.REGISTER);
        setServerMsg(
          "Password reset! Sign in with your new password."
        );
      }, 1500);

    } catch (err) {
      const c = err.response?.data?.code;
      if (c === "CODE_EXPIRED") {
        setServerErr("Code expired. Please start the reset over.");
        setTimeout(() => setStep(STEPS.FORGOT_PASSWORD), 2000);
      } else if (c === "INVALID_CODE") {
        setServerErr("Invalid code. Please start the reset over.");
        setTimeout(() => setStep(STEPS.FORGOT_PASSWORD), 2000);
      } else {
        setServerErr(
          err.response?.data?.message ?? "Reset failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: RESEND RESET CODE
  // POST /api/seller-auth/forgot-password (same endpoint)
  // Reuses forgot-password to issue a fresh OTP
  // ─────────────────────────────────────────────────────────
  const resendResetCode = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      await axios.post(`${AUTH_API}/forgot-password`, {
        email: pendingEmail,
      });
      setServerMsg(
        "A new reset code has been sent to your email."
      );
    } catch {
      // Always show success — don't reveal if email exists
      setServerMsg(
        "A new reset code has been sent to your email."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: SETUP STORE
  // POST /api/seller-onboarding/setup-store
  // ─────────────────────────────────────────────────────────
  const submitStore = async () => {
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

      if (storeData.bank_code)
        form.append("bank_code",    storeData.bank_code.trim());
      if (storeData.store_logo)
        form.append("store_logo",   storeData.store_logo);
      if (storeData.store_banner)
        form.append("store_banner", storeData.store_banner);

      const { data } = await axios.post(
        "/api/seller-onboarding/setup-store",
        form,
        {
          headers: {
            Authorization:  `Bearer ${getToken()}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (data.vendor) setVendorData(data.vendor);
      setServerMsg(data.message ?? "Store created!");
      setStep(STEPS.VERIFICATION);

    } catch (err) {
      const code           = err.response?.data?.code;
      const existingStatus = err.response?.data?.status;

      if (code === "VENDOR_EXISTS") {
        if (existingStatus === "pending") {
          setStep(STEPS.VERIFICATION);
          return;
        }
        if (existingStatus === "under_review") {
          setStep(STEPS.REVIEW);
          return;
        }
        if (["active", "approved"].includes(existingStatus)) {
          window.location.replace("/seller/dashboard");
          return;
        }
      }

      setServerErr(
        err.response?.data?.message ?? "Store setup failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: SUBMIT IDENTITY VERIFICATION
  // POST /api/seller-onboarding/verify
  // ─────────────────────────────────────────────────────────
  const submitVerification = async () => {
    if (!validateVerification()) return;
    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const form = new FormData();

      [
        "id_card", "id_card_back", "selfie",
        "business_doc", "address_proof",
      ].forEach((k) => {
        if (verifyData[k]) form.append(k, verifyData[k]);
      });

      form.append("id_type",   verifyData.id_type);
      form.append(
        "id_number",
        verifyData.id_number.replace(/\s/g, "").toUpperCase()
      );
      form.append("address",   verifyData.address.trim());

      const { data } = await axios.post(
        "/api/seller-onboarding/verify",
        form,
        {
          headers: {
            Authorization:  `Bearer ${getToken()}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (data.vendor) setVendorData(data.vendor);
      setServerMsg(
        data.message ??
        "Documents submitted! We'll review within 1–3 days."
      );
      setStep(STEPS.REVIEW);

    } catch (err) {
      setServerErr(
        err.response?.data?.message ?? "Verification failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────
  return {
    // ── State ──────────────────────────────────────────────
    step,               setStep,
    registerData,
    storeData,
    verifyData,
    errors,
    loading,
    initializing,
    serverMsg,          setServerMsg,
    serverErr,          setServerErr,
    previewLogo,
    vendorData,         setVendorData,
    showPassword,       setShowPassword,
    showConfirm,        setShowConfirm,
    isGmailUser,
    pendingEmail,       setPendingEmail,
    verifiedResetCode,

    // ── Field handlers ─────────────────────────────────────
    handleRegisterChange,
    handleStoreChange,
    handleVerifyChange,
    setBankField,

    // ── Auth API ───────────────────────────────────────────
    submitRegister,
    submitOtp,
    resendOtp,
    submitLogin,         // ← used by RegisterStep SignInForm

    // ── Password reset API ─────────────────────────────────
    submitForgotPassword,
    submitResetCode,
    submitNewPassword,
    resendResetCode,

    // ── Onboarding API ─────────────────────────────────────
    submitStore,
    submitVerification,

    // ── Session ────────────────────────────────────────────
    signOut,
  };
};

export default useSellerFlow;