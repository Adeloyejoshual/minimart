// hooks/useSellerFlow.js
import { useState, useCallback, useEffect } from "react";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// STEPS
// ─────────────────────────────────────────────────────────────
export const STEPS = {
  REGISTER:     0,
  STORE_SETUP:  1,
  VERIFICATION: 2,
  REVIEW:       3,
  APPROVED:     4,
};

const STATUS_TO_STEP = {
  pending:      STEPS.REVIEW,
  under_review: STEPS.REVIEW,
  approved:     STEPS.APPROVED,
  active:       STEPS.APPROVED,
  rejected:     STEPS.STORE_SETUP,
  suspended:    STEPS.APPROVED,
};

export const WITHDRAWAL_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer", icon: "🏦" },
];

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
// TOKEN KEY — single source of truth
// Must match SELLER_TOKEN_KEY in SellerDashboard.jsx
// ─────────────────────────────────────────────────────────────
export const SELLER_TOKEN_KEY = "seller_token";

const getToken  = ()         => localStorage.getItem(SELLER_TOKEN_KEY);
const saveToken = (t)        => localStorage.setItem(SELLER_TOKEN_KEY, t);
const clearToken = ()        => localStorage.removeItem(SELLER_TOKEN_KEY);

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
  id_type:       "nin",
  id_number:     "",
  address:       "",
  id_card:       null,
  id_card_back:  null,
  selfie:        null,
  business_doc:  null,
  address_proof: null,
};

// ─────────────────────────────────────────────────────────────
// AXIOS INSTANCE
// ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  timeout: 15_000,
});

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────
export const useSellerFlow = () => {
  const [step,          setStep]          = useState(STEPS.REGISTER);
  const [registerData,  setRegisterData]  = useState(INITIAL_REGISTER_DATA);
  const [storeData,     setStoreData]     = useState(INITIAL_STORE_DATA);
  const [verifyData,    setVerifyData]    = useState(INITIAL_VERIFY_DATA);
  const [errors,        setErrors]        = useState({});
  const [loading,       setLoading]       = useState(false);
  const [initializing,  setInitializing]  = useState(true);
  const [serverMsg,     setServerMsg]     = useState("");
  const [serverErr,     setServerErr]     = useState("");
  const [previewLogo,   setPreviewLogo]   = useState(null);
  const [vendorData,    setVendorData]    = useState(null);
  const [showPassword,  setShowPassword]  = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [isGmailUser,   setIsGmailUser]   = useState(false);

  // ── Mount: restore step from server ─────────────────────
  useEffect(() => {
    const syncFromServer = async () => {
      const t = getToken();

      if (!t) {
        // No seller token → show register
        setStep(STEPS.REGISTER);
        setInitializing(false);
        return;
      }

      try {
        const { data } = await api.get(
          "/api/seller-onboarding/status",
          { headers: { Authorization: `Bearer ${t}` } }
        );

        if (data?.vendor) {
          setVendorData(data.vendor);
          const restoredStep = STATUS_TO_STEP[data.vendor.status];
          setStep(restoredStep ?? STEPS.STORE_SETUP);
        } else {
          // Authenticated but no vendor yet
          setStep(STEPS.STORE_SETUP);
        }

      } catch (err) {
        const status = err.response?.status;
        const code   = err.response?.data?.code;

        if (status === 401
          || code === "INVALID_TOKEN"
          || code === "TOKEN_EXPIRED") {
          // Token expired → clear and restart
          clearToken();
          setStep(STEPS.REGISTER);

        } else if (status === 403
          && code === "NOT_SELLER_ACCOUNT") {
          // This is a marketplace user (Gmail/social login)
          // trying to access seller routes
          setIsGmailUser(true);
          setStep(STEPS.REGISTER);

        } else if (status === 404) {
          // Logged in, no vendor yet
          setStep(STEPS.STORE_SETUP);

        } else {
          // Network error or 500 — fallback gracefully
          console.warn("[useSellerFlow] sync error:", err.message);
          setStep(STEPS.REGISTER);
        }
      } finally {
        setInitializing(false);
      }
    };

    syncFromServer();
  }, []);

  // ── Clear messages on step change ───────────────────────
  useEffect(() => {
    setServerMsg("");
    setServerErr("");
    setErrors({});
  }, [step]);

  // ─────────────────────────────────────────────────────────
  // FIELD HANDLERS
  // ─────────────────────────────────────────────────────────
  const handleRegisterChange = useCallback((e) => {
    const { name, value } = e.target;
    setRegisterData((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
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
    } else {
      setVerifyData((p) => ({ ...p, [name]: value }));
    }
    setErrors((p) => ({ ...p, [name]: "" }));
    setServerErr("");
  }, []);

  // Expose a direct setter for bank fields
  // (used by BankVerify component in StoreSetup)
  const setBankField = useCallback((field, value) => {
    setStoreData((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  }, []);

  // ─────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────
  const validateRegister = () => {
    const e    = {};
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
      e.password = "Password must be at least 8 characters";
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
    else if (storeData.store_name.length > 100)
      e.store_name = "Max 100 characters";

    if (!storeData.store_category)
      e.store_category = "Please select a category";

    if (!storeData.store_description.trim())
      e.store_description = "Description is required";

    // Bank details required
    if (!storeData.bank_account.trim())
      e.bank_account = "Bank account number is required";

    if (!storeData.bank_name.trim())
      e.bank_name = "Please select and verify your bank";

    if (!storeData.account_name?.trim())
      e.account_name = "Please verify your bank account first";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateVerification = () => {
    const e = {};

    if (!verifyData.id_type)
      e.id_type = "Select an ID type";

    if (!verifyData.id_number?.trim())
      e.id_number = "ID number is required";

    if (!verifyData.address?.trim())
      e.address = "Home address is required";

    if (!verifyData.id_card)
      e.id_card = "Front photo of ID card is required";

    if (!verifyData.selfie)
      e.selfie = "Selfie with ID is required";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─────────────────────────────────────────────────────────
  // API: REGISTER / LOGIN
  // POST /api/auth/register
  // POST /api/auth/login     (if seller already has account)
  // ─────────────────────────────────────────────────────────
  const submitRegister = async () => {
    if (!validateRegister()) return;

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const { data } = await api.post("/api/auth/register", {
        name:     registerData.name.trim(),
        email:    registerData.email.trim().toLowerCase(),
        phone:    registerData.phone.trim(),
        password: registerData.password,
      });

      // ✅ FIXED: save as "seller_token" not "token"
      if (data.token) {
        saveToken(data.token);
      }

      setServerMsg(data.message ?? "Account created!");
      setStep(STEPS.STORE_SETUP);

    } catch (err) {
      const msg = err.response?.data?.message
        ?? "Registration failed. Try again.";
      setServerErr(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: LOGIN (for returning sellers)
  // POST /api/auth/login
  // ─────────────────────────────────────────────────────────
  const submitLogin = async (email, password) => {
    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const { data } = await api.post("/api/auth/login", {
        email:    email.trim().toLowerCase(),
        password,
      });

      // ✅ FIXED: save as "seller_token" not "token"
      if (data.token) {
        saveToken(data.token);
      }

      // Reload step from server
      if (data.vendor) {
        setVendorData(data.vendor);
        const restoredStep = STATUS_TO_STEP[data.vendor.status];
        setStep(restoredStep ?? STEPS.STORE_SETUP);
      } else {
        setStep(STEPS.STORE_SETUP);
      }

      setServerMsg("Welcome back!");

    } catch (err) {
      setServerErr(
        err.response?.data?.message ?? "Login failed. Try again."
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

      // Append all fields — skip null/empty
      Object.entries(storeData).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== "") {
          form.append(k, v);
        }
      });

      const { data } = await api.post(
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
      setServerMsg(data.message ?? "Store setup complete!");
      setStep(STEPS.VERIFICATION);

    } catch (err) {
      setServerErr(
        err.response?.data?.message ?? "Store setup failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: SUBMIT VERIFICATION
  // POST /api/seller-onboarding/verify
  // ─────────────────────────────────────────────────────────
  const submitVerification = async () => {
    if (!validateVerification()) return;

    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const form = new FormData();

      // Text fields
      ["id_type", "id_number", "address"].forEach((k) => {
        if (verifyData[k]) form.append(k, verifyData[k]);
      });

      // File fields
      ["id_card", "id_card_back", "selfie",
        "business_doc", "address_proof"].forEach((k) => {
        if (verifyData[k]) form.append(k, verifyData[k]);
      });

      const { data } = await api.post(
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
        data.message ?? "Documents submitted! We'll review within 1–3 days."
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
  // API: REAPPLY
  // POST /api/seller-onboarding/reapply
  // ─────────────────────────────────────────────────────────
  const submitReapply = async () => {
    setLoading(true);
    setServerErr("");
    try {
      const { data } = await api.post(
        "/api/seller-onboarding/reapply",
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setServerMsg(data.message ?? "Reapplication submitted.");
      setStep(STEPS.STORE_SETUP);
    } catch (err) {
      setServerErr(
        err.response?.data?.message ?? "Reapply failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────────────────
  return {
    // State
    step,
    setStep,
    registerData,
    storeData,
    verifyData,
    errors,
    loading,
    initializing,
    serverMsg,
    serverErr,
    previewLogo,
    vendorData,
    showPassword,
    setShowPassword,
    showConfirm,
    setShowConfirm,
    isGmailUser,

    // Handlers
    handleRegisterChange,
    handleStoreChange,
    handleVerifyChange,
    setBankField,

    // Submitters
    submitRegister,
    submitLogin,
    submitStore,
    submitVerification,
    submitReapply,
  };
};