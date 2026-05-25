// hooks/useSellerFlow.js
import { useState, useCallback, useEffect } from "react";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// STEPS — all numbers so ProgressBar > < comparisons work
//
// REGISTER(0) is skipped in the flow UI —
// user is already logged in before reaching this page.
// Flow starts at STORE_SETUP(1).
// ─────────────────────────────────────────────────────────────
export const STEPS = {
  REGISTER:     0,   // not shown in seller flow UI
  STORE_SETUP:  1,
  VERIFICATION: 2,
  REVIEW:       3,
  APPROVED:     4,
};

// Map vendor DB status → correct step number
// Used on mount to restore progress after page refresh
const STATUS_TO_STEP = {
  pending:      STEPS.REVIEW,        // submitted, awaiting review
  under_review: STEPS.REVIEW,        // docs being checked
  approved:     STEPS.APPROVED,      // eligibility granted
  active:       STEPS.APPROVED,      // fully operational
  rejected:     STEPS.STORE_SETUP,   // back to start, can reapply
  suspended:    STEPS.APPROVED,      // show approved screen + warning
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
  // Start at STORE_SETUP — synced from server in useEffect below
  const [step,         setStep]         = useState(STEPS.STORE_SETUP);
  const [storeData,    setStoreData]    = useState(INITIAL_STORE_DATA);
  const [verifyData,   setVerifyData]   = useState(INITIAL_VERIFY_DATA);
  const [errors,       setErrors]       = useState({});
  const [loading,      setLoading]      = useState(false);
  const [initializing, setInitializing] = useState(true);  // mount sync
  const [serverMsg,    setServerMsg]    = useState("");
  const [previewLogo,  setPreviewLogo]  = useState(null);
  const [vendorData,   setVendorData]   = useState(null);  // real DB row

  // ── Token helper ───────────────────────────────────────────
  const token = () => localStorage.getItem("token");

  // ── Mount: sync step from server ───────────────────────────
  // Prevents step resetting to STORE_SETUP on every page refresh
  useEffect(() => {
    const syncFromServer = async () => {
      try {
        const t = token();

        // Not logged in — stay at STORE_SETUP, stop initializing
        if (!t) {
          setInitializing(false);
          return;
        }

        const { data } = await axios.get("/api/seller/status", {
          headers: { Authorization: `Bearer ${t}` },
        });

        if (data?.vendor) {
          setVendorData(data.vendor);

          // Restore correct step from real vendor status
          const restoredStep = STATUS_TO_STEP[data.vendor.status];
          if (restoredStep !== undefined) {
            setStep(restoredStep);
          }
        }
      } catch (err) {
        // 404 → no vendor yet → fine, stay at STORE_SETUP
        // anything else → log but don't crash
        if (err.response?.status !== 404) {
          console.warn("[useSellerFlow] sync error:", err.message);
        }
      } finally {
        // Always stop the mount spinner
        setInitializing(false);
      }
    };

    syncFromServer();
  }, []); // runs once on mount

  // ─── Store field handler ────────────────────────────────────
  const handleStoreChange = useCallback((e) => {
    const { name, value, files } = e.target;

    // ✅ Fixed: files?.[0] not just files
    if (files?.[0]) {
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

    // Clear that field's error as user types
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  // ─── Verify field handler ───────────────────────────────────
  const handleVerifyChange = useCallback((e) => {
    const { name, files } = e.target;

    // ✅ Fixed: guard against empty file input
    if (files?.[0]) {
      setVerifyData((prev) => ({ ...prev, [name]: files[0] }));
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }, []);

  // ─── Validation ────────────────────────────────────────────
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

    // Method-specific
    if (storeData.withdrawal_method === "bank_transfer" && !storeData.bank_account.trim())
      errs.bank_account = "Bank account is required";

    if (storeData.withdrawal_method === "paypal" && !storeData.paypal_email.trim())
      errs.paypal_email = "PayPal email is required";

    if (storeData.withdrawal_method === "crypto" && !storeData.crypto_wallet.trim())
      errs.crypto_wallet = "Crypto wallet address is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateVerification = () => {
    const errs = {};

    if (!verifyData.id_card)
      errs.id_card = "ID card is required";

    if (!verifyData.selfie)
      errs.selfie  = "Selfie with ID is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── API: Submit Store Setup ────────────────────────────────
  const submitStore = async () => {
    if (!validateStore()) return;

    setLoading(true);
    setServerMsg("");

    try {
      const form = new FormData();
      Object.entries(storeData).forEach(([k, v]) => {
        // Only append non-null, non-empty values
        if (v !== null && v !== "") form.append(k, v);
      });

      const { data } = await axios.post("/api/seller/setup-store", form, {
        headers: {
          Authorization:  `Bearer ${token()}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setServerMsg(data.message ?? "Store created!");

      // Store the returned vendor data if API sends it back
      if (data.vendor) setVendorData(data.vendor);

      setStep(STEPS.VERIFICATION); // → step 2
    } catch (err) {
      setServerMsg(
        err.response?.data?.message ?? "Store setup failed. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── API: Submit Verification Docs ─────────────────────────
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

      // Update vendor data if returned
      if (data.vendor) setVendorData(data.vendor);

      setStep(STEPS.REVIEW); // → step 3
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
    // Step control
    step,
    setStep,

    // Form data
    storeData,
    verifyData,

    // UI state
    errors,
    loading,
    initializing,   // ← true while checking server on mount
    serverMsg,
    previewLogo,

    // Real vendor row from DB
    vendorData,

    // Handlers
    handleStoreChange,
    handleVerifyChange,

    // Submissions
    submitStore,
    submitVerification,
  };
};