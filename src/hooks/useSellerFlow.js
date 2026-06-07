// hooks/useSellerFlow.js
import { useState, useCallback, useEffect, useRef } from "react";
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
// TOKEN KEY — must match SellerDashboard.jsx SELLER_TOKEN_KEY
// Single source of truth for the seller JWT
// ─────────────────────────────────────────────────────────────
export const SELLER_TOKEN_KEY = "seller_token";

const getToken   = ()    => localStorage.getItem(SELLER_TOKEN_KEY);
const saveToken  = (t)   => localStorage.setItem(SELLER_TOKEN_KEY, t);
const clearToken = ()    => localStorage.removeItem(SELLER_TOKEN_KEY);

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
// INITIAL STATE (exported so BecomeSeller can reset)
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
  // ── step: null = not yet determined (syncing with server) ─
  // This is important — null prevents premature rendering
  const [step,         setStep]         = useState(null);
  const [registerData, setRegisterData] = useState(INITIAL_REGISTER_DATA);
  const [storeData,    setStoreData]    = useState(INITIAL_STORE_DATA);
  const [verifyData,   setVerifyData]   = useState(INITIAL_VERIFY_DATA);
  const [errors,       setErrors]       = useState({});
  const [loading,      setLoading]      = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [serverMsg,    setServerMsg]    = useState("");
  const [serverErr,    setServerErr]    = useState("");
  const [previewLogo,  setPreviewLogo]  = useState(null);
  const [vendorData,   setVendorData]   = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [isGmailUser,  setIsGmailUser]  = useState(false);

  // Prevent double-run in React StrictMode dev
  const syncedRef = useRef(false);

  // ── Clear form messages when step changes ──────────────
  useEffect(() => {
    if (step === null) return;
    setServerMsg("");
    setServerErr("");
    setErrors({});
  }, [step]);

  // ── Mount: read token, restore step from server ─────────
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    const syncFromServer = async () => {
      const t = getToken();

      // ── No token at all → show register instantly ────────
      // Don't even call the API — save the round trip
      if (!t) {
        setStep(STEPS.REGISTER);
        setInitializing(false);
        return;
      }

      // ── Has token → verify with server ──────────────────
      try {
        const { data } = await axios.get(
          "/api/seller-onboarding/status",
          {
            headers:  { Authorization: `Bearer ${t}` },
            timeout:  10_000,
          }
        );

        if (data?.vendor) {
          setVendorData(data.vendor);
          const restored = STATUS_TO_STEP[data.vendor.status];
          setStep(restored ?? STEPS.STORE_SETUP);
        } else {
          // Token valid, logged into market.users, no vendor yet
          setStep(STEPS.STORE_SETUP);
        }

      } catch (err) {
        const httpStatus  = err.response?.status;
        const code        = err.response?.data?.code;

        if (httpStatus === 401
          || code === "INVALID_TOKEN"
          || code === "TOKEN_EXPIRED") {
          // Stale/invalid token → clear it → register
          clearToken();
          setStep(STEPS.REGISTER);

        } else if (httpStatus === 403
          && code === "NOT_SELLER_ACCOUNT") {
          // public.users login (Gmail/marketplace)
          // cannot access seller routes
          clearToken();
          setIsGmailUser(true);
          setStep(STEPS.REGISTER);

        } else if (httpStatus === 404) {
          // Valid token, no vendor yet
          setStep(STEPS.STORE_SETUP);

        } else {
          // Network error or 500 — clear token to be safe,
          // avoid infinite "loading" state
          console.warn("[useSellerFlow] sync error:", err.message);
          clearToken();
          setStep(STEPS.REGISTER);
        }
      } finally {
        setInitializing(false);
      }
    };

    syncFromServer();
  }, []); // run once on mount

  // ─────────────────────────────────────────────────────────
  // SIGN OUT
  // Clears token + resets all state back to REGISTER
  // Call this from any sign-out button
  // ─────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    // 1. Clear the token
    clearToken();

    // 2. Reset all state synchronously
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

    // 3. Allow re-sync on next mount if component remounts
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

  // Direct bank field setter (used by bank verify component)
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
        nin:      11,
        passport: 9,
        drivers:  12,
        voters:   19,
      };
      const cleaned  = verifyData.id_number
        .replace(/\s/g, "").toUpperCase();
      const expected = ID_DIGITS[verifyData.id_type];

      if (verifyData.id_type === "passport") {
        if (!/^[A-Z0-9]{9}$/.test(cleaned))
          e.id_number = "Passport must be 9 characters (e.g. A12345678)";
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
      e.id_card = "ID card front photo is required";

    if (!verifyData.id_card_back)
      e.id_card_back = "ID card back photo is required";

    if (!verifyData.selfie)
      e.selfie = "Selfie with ID is required";

    if (!verifyData.address?.trim())
      e.address = "Home address is required";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─────────────────────────────────────────────────────────
  // API: REGISTER
  // POST /api/auth/register
  // ─────────────────────────────────────────────────────────
  const submitRegister = async () => {
    if (!validateRegister()) return;
    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const { data } = await axios.post("/api/auth/register", {
        name:     registerData.name.trim(),
        email:    registerData.email.trim().toLowerCase(),
        phone:    registerData.phone.trim(),
        password: registerData.password,
      });

      // ✅ KEY FIX: save as "seller_token"
      if (data.token) saveToken(data.token);

      setIsGmailUser(false);
      setServerMsg(data.message ?? "Account created successfully!");
      setStep(STEPS.STORE_SETUP);

    } catch (err) {
      setServerErr(
        err.response?.data?.message ?? "Registration failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // API: LOGIN (returning sellers)
  // POST /api/auth/login
  // ─────────────────────────────────────────────────────────
  const submitLogin = async (email, password) => {
    setLoading(true);
    setServerMsg("");
    setServerErr("");

    try {
      const { data } = await axios.post("/api/auth/login", {
        email:    email.trim().toLowerCase(),
        password,
      });

      // ✅ KEY FIX: save as "seller_token"
      if (data.token) saveToken(data.token);

      if (data.vendor) {
        setVendorData(data.vendor);
        const restored = STATUS_TO_STEP[data.vendor.status];
        setStep(restored ?? STEPS.STORE_SETUP);
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
      console.error("[submitStore]", err.response?.data ?? err.message);

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
          // Already active — redirect to dashboard
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

      // Files
      [
        "id_card", "id_card_back", "selfie",
        "business_doc", "address_proof",
      ].forEach((k) => {
        if (verifyData[k]) form.append(k, verifyData[k]);
      });

      // Text fields
      form.append(
        "id_type",   verifyData.id_type
      );
      form.append(
        "id_number",
        verifyData.id_number.replace(/\s/g, "").toUpperCase()
      );
      form.append(
        "address",   verifyData.address.trim()
      );

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
    showPassword,  setShowPassword,
    showConfirm,   setShowConfirm,
    isGmailUser,
    setVendorData,

    // Handlers
    handleRegisterChange,
    handleStoreChange,
    handleVerifyChange,
    setBankField,

    // API submitters
    submitRegister,
    submitLogin,
    submitStore,
    submitVerification,

    // Sign out — clears token + resets all state
    signOut,
  };
};

export default useSellerFlow;