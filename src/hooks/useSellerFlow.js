// hooks/useSellerFlow.js
import { useState, useCallback, useEffect } from "react";
import axios from "axios";

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
export const useSellerFlow = (user = null) => {
  const [step,         setStep]         = useState(
    user ? STEPS.STORE_SETUP : STEPS.REGISTER
  );
  const [registerData, setRegisterData] = useState(INITIAL_REGISTER_DATA);
  const [storeData,    setStoreData]    = useState(INITIAL_STORE_DATA);
  const [verifyData,   setVerifyData]   = useState(INITIAL_VERIFY_DATA);
  const [errors,       setErrors]       = useState({});
  const [loading,      setLoading]      = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [serverMsg,    setServerMsg]    = useState("");
  const [previewLogo,  setPreviewLogo]  = useState(null);
  const [vendorData,   setVendorData]   = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  const token = () => localStorage.getItem("token");

  // ── Mount: restore step from server ────────────────────────
  useEffect(() => {
    const syncFromServer = async () => {
      try {
        const t = token();

        if (!t) {
          setStep(STEPS.REGISTER);
          setInitializing(false);
          return;
        }

        // ✅ FIXED URL 1
        const { data } = await axios.get(
          "/api/seller-onboarding/status",
          { headers: { Authorization: `Bearer ${t}` } }
        );

        if (data?.vendor) {
          setVendorData(data.vendor);
          const restored = STATUS_TO_STEP[data.vendor.status];
          setStep(restored ?? STEPS.STORE_SETUP);
        } else {
          setStep(STEPS.STORE_SETUP);
        }

      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          setStep(STEPS.REGISTER);
        } else if (err.response?.status === 404) {
          setStep(STEPS.STORE_SETUP);
        } else {
          console.warn("[useSellerFlow] sync error:", err.message);
          setStep(user ? STEPS.STORE_SETUP : STEPS.REGISTER);
        }
      } finally {
        setInitializing(false);
      }
    };

    syncFromServer();
  }, []);

  // ── Handlers ──────────────────────────────────────────────
  const handleRegisterChange = useCallback((e) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev)      => ({ ...prev, [name]: ""    }));
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
  }, []);

  const handleVerifyChange = useCallback((e) => {
    const { name, files } = e.target;
    if (files?.[0]) {
      setVerifyData((prev) => ({ ...prev, [name]: files[0] }));
      setErrors((prev)     => ({ ...prev, [name]: ""       }));
    }
  }, []);

  // ── Validation ────────────────────────────────────────────
  const validateRegister = () => {
    const errs       = {};
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

    if (storeData.withdrawal_method === "bank_transfer" &&
        !storeData.bank_account.trim())
      errs.bank_account = "Bank account is required";

    if (storeData.withdrawal_method === "paypal" &&
        !storeData.paypal_email.trim())
      errs.paypal_email = "PayPal email is required";

    if (storeData.withdrawal_method === "crypto" &&
        !storeData.crypto_wallet.trim())
      errs.crypto_wallet = "Crypto wallet address is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateVerification = () => {
    const errs = {};
    if (!verifyData.id_card) errs.id_card = "ID card is required";
    if (!verifyData.selfie)  errs.selfie  = "Selfie with ID is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── API: Register ─────────────────────────────────────────
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

  // ── API: Store Setup ──────────────────────────────────────
  const submitStore = async () => {
    if (!validateStore()) return;
    setLoading(true);
    setServerMsg("");

    try {
      const form = new FormData();
      Object.entries(storeData).forEach(([k, v]) => {
        if (v !== null && v !== "") form.append(k, v);
      });

      // ✅ FIXED URL 2
      const { data } = await axios.post(
        "/api/seller-onboarding/setup-store",
        form,
        {
          headers: {
            Authorization:  `Bearer ${token()}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

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

  // ── API: Verification ─────────────────────────────────────
  const submitVerification = async () => {
    if (!validateVerification()) return;
    setLoading(true);
    setServerMsg("");

    try {
      const form = new FormData();
      Object.entries(verifyData).forEach(([k, v]) => {
        if (v !== null) form.append(k, v);
      });

      // ✅ FIXED URL 3
      const { data } = await axios.post(
        "/api/seller-onboarding/verify",
        form,
        {
          headers: {
            Authorization:  `Bearer ${token()}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

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

  return {
    step,          setStep,
    registerData,  storeData,       verifyData,
    errors,        loading,         initializing,
    serverMsg,     previewLogo,     vendorData,
    showPassword,  setShowPassword,
    showConfirm,   setShowConfirm,
    setVendorData,
    handleRegisterChange,
    handleStoreChange,
    handleVerifyChange,
    submitRegister,
    submitStore,
    submitVerification,
  };
};

export default useSellerFlow;