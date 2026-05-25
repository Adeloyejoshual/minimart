// hooks/useSellerFlow.js
import { useState, useCallback, useEffect } from "react";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// STEPS — numbers required for ProgressBar > < comparison
// REGISTER(0) is now the first visible step in the flow
// ─────────────────────────────────────────────────────────────
export const STEPS = {
  REGISTER:     0,
  STORE_SETUP:  1,
  VERIFICATION: 2,
  REVIEW:       3,
  APPROVED:     4,
};

// Map vendor DB status → correct step
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
  { value: "paypal",        label: "PayPal",        icon: "💰" },
  { value: "crypto",        label: "Crypto Wallet", icon: "₿"  },
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

// ─── Initial State ────────────────────────────────────────────
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
  withdrawal_method: "",
  bank_account:      "",
  paypal_email:      "",
  crypto_wallet:     "",
};

const INITIAL_VERIFY_DATA = {
  id_card:       null,
  business_doc:  null,
  address_proof: null,
  selfie:        null,
};

// ─── Hook ─────────────────────────────────────────────────────
export const useSellerFlow = () => {
  const [step,          setStep]          = useState(STEPS.REGISTER);
  const [registerData,  setRegisterData]  = useState(INITIAL_REGISTER_DATA);
  const [storeData,     setStoreData]     = useState(INITIAL_STORE_DATA);
  const [verifyData,    setVerifyData]    = useState(INITIAL_VERIFY_DATA);
  const [errors,        setErrors]        = useState({});
  const [loading,       setLoading]       = useState(false);
  const [initializing,  setInitializing]  = useState(true);
  const [serverMsg,     setServerMsg]     = useState("");
  const [previewLogo,   setPreviewLogo]   = useState(null);
  const [vendorData,    setVendorData]    = useState(null);
  const [showPassword,  setShowPassword]  = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);

  // ── Token helper ───────────────────────────────────────────
  const token = () => localStorage.getItem("token");

  // ── Mount: sync step from server ───────────────────────────
  useEffect(() => {
    const syncFromServer = async () => {
      try {
        const t = token();

        // Already logged in — skip REGISTER step
        if (t) {
          const { data } = await axios.get("/api/seller/status", {
            headers: { Authorization: `Bearer ${t}` },
          });

          if (data?.vendor) {
            setVendorData(data.vendor);
            const restoredStep = STATUS_TO_STEP[data.vendor.status];
            if (restoredStep !== undefined) setStep(restoredStep);
          } else {
            // Logged in but no vendor yet → go to store setup
            setStep(STEPS.STORE_SETUP);
          }
        }
        // Not logged in → stay at REGISTER (default)
      } catch (err) {
        if (err.response?.status === 404) {
          // Logged in, no vendor → store setup
          setStep(STEPS.STORE_SETUP);
        } else {
          console.warn("[useSellerFlow] sync error:", err.message);
        }
      } finally {
        setInitializing(false);
      }
    };

    syncFromServer();
  }, []);

  // ─── Register field handler ─────────────────────────────────
  const handleRegisterChange = useCallback((e) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  // ─── Store field handler ────────────────────────────────────
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
  }, []);

  // ─── Verify field handler ───────────────────────────────────
  const handleVerifyChange = useCallback((e) => {
    const { name, files } = e.target;
    if (files?.[0]) {
      setVerifyData((prev) => ({ ...prev, [name]: files[0] }));
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }, []);

  // ─── Validation: Register ───────────────────────────────────
  const validateRegister = () => {
    const errs = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;

    if (!registerData.name.trim())
      errs.name = "Full name is required";
    else if (registerData.name.trim().length < 2)
      errs.name = "Name must be at least 2 characters";

    if (!registerData.email.trim())
      errs.email = "Email is required";
    else if (!emailRegex.test(registerData.email))
      errs.email = "Enter a valid email address";

    if (!registerData.phone.trim())
      errs.phone = "Phone number is required";
    else if (!phoneRegex.test(registerData.phone))
      errs.phone = "Enter a valid phone number";

    if (!registerData.password)
      errs.password = "Password is required";
    else if (registerData.password.length < 8)
      errs.password = "Password must be at least 8 characters";
    else if (!/(?=.*[A-Z])/.test(registerData.password))
      errs.password = "Must contain at least one uppercase letter";
    else if (!/(?=.*\d)/.test(registerData.password))
      errs.password = "Must contain at least one number";

    if (!registerData.confirm_password)
      errs.confirm_password = "Please confirm your password";
    else if (registerData.password !== registerData.confirm_password)
      errs.confirm_password = "Passwords do not match";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Validation: Store ──────────────────────────────────────
  const validateStore = () => {
    const errs = {};

    if (!storeData.store_name.trim())
      errs.store_name = "Store name is required";
    else if (storeData.store_name.length > 100)
      errs.store_name = "Max 100 characters";

    if (!storeData.store_category)
      errs.store_category = "Please select a category";

    if (!storeData.store_description.trim())
      errs.store_description = "Description is required";

    if (!storeData.withdrawal_method)
      errs.withdrawal_method = "Select a withdrawal method";

    if (storeData.withdrawal_method === "bank_transfer" && !storeData.bank_account.trim())
      errs.bank_account = "Bank account is required";

    if (storeData.withdrawal_method === "paypal" && !storeData.paypal_email.trim())
      errs.paypal_email = "PayPal email is required";

    if (storeData.withdrawal_method === "crypto" && !storeData.crypto_wallet.trim())
      errs.crypto_wallet = "Crypto wallet address is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Validation: Verification ───────────────────────────────
  const validateVerification = () => {
    const errs = {};

    if (!verifyData.id_card)
      errs.id_card = "ID card is required";

    if (!verifyData.selfie)
      errs.selfie = "Selfie with ID is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── API: Register ──────────────────────────────────────────
  const submitRegister = async () => {
    if (!validateRegister()) return;

    setLoading(true);
    setServerMsg("");

    try {
      const { data } = await axios.post("/api/auth/register", {
        name:     registerData.name.trim(),
        email:    registerData.email.trim(),
        phone:    registerData.phone.trim(),
        password: registerData.password,
      });

      // Store token from registration response
      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      setServerMsg(data.message ?? "Account created successfully!");
      setStep(STEPS.STORE_SETUP);
    } catch (err) {
      setServerMsg(
        err.response?.data?.message ?? "Registration failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── API: Submit Store ──────────────────────────────────────
  const submitStore = async () => {
    if (!validateStore()) return;

    setLoading(true);
    setServerMsg("");

    try {
      const form = new FormData();
      Object.entries(storeData).forEach(([k, v]) => {
        if (v !== null && v !== "") form.append(k, v);
      });

      const { data } = await axios.post("/api/seller/setup-store", form, {
        headers: {
          Authorization:  `Bearer ${token()}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setServerMsg(data.message ?? "Store created!");
      if (data.vendor) setVendorData(data.vendor);
      setStep(STEPS.VERIFICATION);
    } catch (err) {
      setServerMsg(
        err.response?.data?.message ?? "Store setup failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── API: Submit Verification ───────────────────────────────
  const submitVerification = async () => {
    if (!validateVerification()) return;

    setLoading(true);
    setServerMsg("");

    try {
      const form = new FormData();
      Object.entries(verifyData).forEach(([k, v]) => {
        if (v !== null) form.append(k, v);
      });

      const { data } = await axios.post("/api/seller/verify", form, {
        headers: {
          Authorization:  `Bearer ${token()}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setServerMsg(data.message ?? "Documents submitted!");
      if (data.vendor) setVendorData(data.vendor);
      setStep(STEPS.REVIEW);
    } catch (err) {
      setServerMsg(
        err.response?.data?.message ?? "Verification failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Return ─────────────────────────────────────────────────
  return {
    step, setStep,
    registerData, storeData, verifyData,
    errors, loading, initializing,
    serverMsg, previewLogo,
    vendorData,
    showPassword,  setShowPassword,
    showConfirm,   setShowConfirm,
    handleRegisterChange,
    handleStoreChange,
    handleVerifyChange,
    submitRegister,
    submitStore,
    submitVerification,
  };
};