import { useState, useCallback } from "react";
import axios from "axios";

// ─── Constants ──────────────────────────────────────────────
export const STEPS = {
  REGISTER:     0,
  STORE_SETUP:  1,
  VERIFICATION: 2,
  REVIEW:       3,
  APPROVED:     4,
};

export const WITHDRAWAL_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer",   icon: "🏦" },
  { value: "paypal",        label: "PayPal",          icon: "💰" },
  { value: "crypto",        label: "Crypto Wallet",   icon: "₿"  },
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

// ─── Initial State ───────────────────────────────────────────
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

// ─── Hook ────────────────────────────────────────────────────
export const useSellerFlow = () => {
  const [step,        setStep]        = useState(STEPS.STORE_SETUP);
  const [storeData,   setStoreData]   = useState(INITIAL_STORE_DATA);
  const [verifyData,  setVerifyData]  = useState(INITIAL_VERIFY_DATA);
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(false);
  const [serverMsg,   setServerMsg]   = useState("");
  const [previewLogo, setPreviewLogo] = useState(null);

  // ── Helpers ────────────────────────────────────────────────
  const token = () => localStorage.getItem("token");

  const handleStoreChange = useCallback((e) => {
    const { name, value, files } = e.target;

    if (files) {
      const file = files[0];
      setStoreData((prev) => ({ ...prev, [name]: file }));

      // Live logo preview
      if (name === "store_logo") {
        const reader = new FileReader();
        reader.onloadend = () => setPreviewLogo(reader.result);
        reader.readAsDataURL(file);
      }
    } else {
      setStoreData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear field error on change
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const handleVerifyChange = useCallback((e) => {
    const { name, files } = e.target;
    setVerifyData((prev) => ({ ...prev, [name]: files[0] }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  // ── Validation ─────────────────────────────────────────────
  const validateStore = () => {
    const errs = {};
    if (!storeData.store_name.trim())
      errs.store_name = "Store name is required";
    if (storeData.store_name.length > 100)
      errs.store_name = "Max 100 characters";
    if (!storeData.store_category)
      errs.store_category = "Please select a category";
    if (!storeData.store_description.trim())
      errs.store_description = "Description is required";
    if (!storeData.withdrawal_method)
      errs.withdrawal_method = "Select a withdrawal method";

    // Method-specific validation
    if (storeData.withdrawal_method === "bank_transfer" && !storeData.bank_account)
      errs.bank_account = "Bank account is required";
    if (storeData.withdrawal_method === "paypal" && !storeData.paypal_email)
      errs.paypal_email = "PayPal email is required";
    if (storeData.withdrawal_method === "crypto" && !storeData.crypto_wallet)
      errs.crypto_wallet = "Crypto wallet address is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateVerification = () => {
    const errs = {};
    if (!verifyData.id_card)
      errs.id_card = "ID card is required";
    if (!verifyData.selfie)
      errs.selfie = "Selfie with ID is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── API Calls ──────────────────────────────────────────────
  const submitStore = async () => {
    if (!validateStore()) return;
    setLoading(true);
    setServerMsg("");

    try {
      const form = new FormData();
      Object.entries(storeData).forEach(([k, v]) => {
        if (v) form.append(k, v);
      });

      const { data } = await axios.post("/api/seller/setup-store", form, {
        headers: {
          Authorization:  `Bearer ${token()}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setServerMsg(data.message);
      setStep(STEPS.VERIFICATION);
    } catch (err) {
      setServerMsg(
        err.response?.data?.message || "Store setup failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const submitVerification = async () => {
    if (!validateVerification()) return;
    setLoading(true);
    setServerMsg("");

    try {
      const form = new FormData();
      Object.entries(verifyData).forEach(([k, v]) => {
        if (v) form.append(k, v);
      });

      const { data } = await axios.post("/api/seller/verify", form, {
        headers: {
          Authorization:  `Bearer ${token()}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setServerMsg(data.message);
      setStep(STEPS.REVIEW);
    } catch (err) {
      setServerMsg(
        err.response?.data?.message || "Verification failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    step, setStep,
    storeData, verifyData,
    errors, loading, serverMsg, previewLogo,
    handleStoreChange,
    handleVerifyChange,
    submitStore,
    submitVerification,
  };
};