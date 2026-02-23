// src/pages/Marketplace/AddProduct.jsx
// v22 - REMOVED PHONE VALIDATION + CSS SUPPORT

import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import "./AddProduct.css"; // 🔥 ADDED: Dedicated CSS module

/* ---------------- CONFIG ---------------- */
import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { promotionPlans } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

/* ---------------- SECTIONS ---------------- */
import ProductDetailsSection from "../../components/AddProduct/ProductDetailsSection";
import PricingBoostSection from "../../components/AddProduct/PricingBoostSection";
import DescriptionMediaSection from "../../components/AddProduct/DescriptionMediaSection";
import DeliveryContactSection from "../../components/AddProduct/DeliveryContactSection";

/* ---------------- CONSTANTS ---------------- */
const STORAGE_KEYS = { DRAFT: "marketplace_draft_v22" }; // 🔥 Updated version
const MAX_FILE_SIZE = 5_000_000;
const MAX_IMAGES = 10;
const CONCURRENT_UPLOADS = 3;
const QUEUE_TIMEOUT = 15000;
const MAX_PRICE = 999_999_999_999;

// 🔥 REMOVED: NIGERIAN_PHONE_REGEX

const apiUrl = import.meta.env.VITE_API_URL || "/api/marketplace";
const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;

/* ---------------- UTILS ---------------- */
const extractDigits = (value = "") => value.replace(/[^d]/g, "");

const initializeForm = (user) => ({
  title: "",
  description: "",
  price: "",
  discount_price: "",
  category: "",
  subcategory: "",
  brand: "",
  model: "",
  condition: "",
  used_detail: "",
  color: "",
  features: [],
  sim: [],
  ram: "",
  storage: "",
  engine: "",
  mileage: "",
  year: "",
  fuel_type: "",
  transmission: "",
  bedrooms: "",
  bathrooms: "",
  size: "",
  furnished: false,
  age_range: "",
  breed: "",
  experience_level: "",
  skills: [],
  education: "",
  phone_number: user?.phone_number || "", // 🔥 Still kept in form but no validation
  additional_phone: "",
  poster_name: user?.name || "",
  state: "",
  city: "",
  images: [],
  video_link: "",
  promoted: false,
  promo_plan: "",
  flash_sale: false,
  negotiable: false,
  deliveryRegions: []
});

const initializeDeliveryForm = () => ({
  state: "",
  city: "",
  method: "",
  from: "",
  to: "",
  chargeFee: false,
  fee: "",
  expressAvailable: false,
  warehouseAddress: ""
});

/* ---------------- FIXED IDEMPOTENCY ---------------- */
const generateIdempotencyKey = async (form, images, userId) => {
  const fileSignature = images.files
    .map(f => `${f.name}-${f.size}`)
    .join("|");

  const raw = `${userId}|${form.title}|${form.category}|${extractDigits(
    form.price
  )}|${form.phone_number}|${fileSignature}`;

  const data = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return `publish_${hashArray
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32)}`;
};

/* ===================================================== */

export default function AddProduct() {
  const { user, getAccessTokenSilently } = useAuth0();

  // Refs
  const publishLockRef = useRef(false);
  const abortControllerRef = useRef(null);
  const queueAbortControllerRef = useRef(null);
  const validationTimeoutRef = useRef(null);
  const uploadedPublicIdsRef = useRef([]);
  const currentIdempotencyKeyRef = useRef(null);

  // State
  const [form, setForm] = useState(() => initializeForm(user));
  const [images, setImages] = useState({ files: [], previews: [] });
  const [deliveryForm, setDeliveryForm] = useState(initializeDeliveryForm());
  const [ui, setUi] = useState({
    loading: false,
    publishStatus: "idle",
    errors: {},
    submitError: null
  });
  const [touched, setTouched] = useState({});

  /* ---------------- DRAFT PERSISTENCE ---------------- */
  useLayoutEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DRAFT);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setForm(parsed.form || initializeForm(user));
        setDeliveryForm(parsed.delivery || initializeDeliveryForm());
        setTouched(parsed.touched || {});
      } catch {
        console.warn("Failed to load draft");
      }
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.DRAFT,
      JSON.stringify({ form, delivery: deliveryForm, touched })
    );
  }, [form, deliveryForm, touched]);

  /* ---------------- CLEANUP ---------------- */
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      queueAbortControllerRef.current?.abort();
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  /* ---------------- COMPUTED VALUES ---------------- */
  const cleanPrice = useMemo(() => {
    const n = Number(extractDigits(form.price));
    return n > 0 && n <= MAX_PRICE ? n : 0;
  }, [form.price]);

  const cleanDiscountPrice = useMemo(() => {
    const n = Number(extractDigits(form.discount_price));
    return n > 0 && n <= cleanPrice ? n : 0;
  }, [form.discount_price, cleanPrice]);

  /* ---------------- VALIDATION ENGINE ---------------- */
  const isEmptyValue = useCallback((value) => {
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return !value.trim();
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "boolean") return false;
    return !value;
  }, []);

  const getCategoryRules = useCallback((category) => {
    return categoryFields[category] || [];
  }, []);

  const validateField = useCallback((field, value) => {
    const errors = {};

    // 🔥 REMOVED: phone_number validation

    if (field === "price" && !cleanPrice) {
      errors.price = "Price is required";
    }

    if (field === "discount_price" && cleanDiscountPrice >= cleanPrice) {
      errors.discount_price = "Discount must be less than price";
    }

    if (field === "images") {
      if (images.files.length === 0) errors.images = "At least 1 image required";
      if (images.files.length > MAX_IMAGES) errors.images = `Max ${MAX_IMAGES} images`;
    }

    return errors;
  }, [cleanPrice, cleanDiscountPrice, images.files.length]);

  const validateForm = useCallback(() => {
    const errors = {};

    if (isEmptyValue(form.title)) errors.title = "Product title required";
    if (isEmptyValue(form.category)) errors.category = "Select category";

    // 🔥 REMOVED: phone_number validation completely

    if (isEmptyValue(form.state)) errors.state = "Select state";
    if (isEmptyValue(form.city)) errors.city = "City required";
    if (!cleanPrice) errors.price = "Valid price required";

    // Category-specific validation
    const requiredFields = getCategoryRules(form.category);
    requiredFields.forEach(field => {
      if (isEmptyValue(form[field])) {
        errors[field] = `${field.replace(/_/g, " ").replace(/\bw/g, l => l.toUpperCase())} required`;
      }
    });

    if (images.files.length === 0) errors.images = "Add at least 1 photo";
    if (images.files.length > MAX_IMAGES) errors.images = `Max ${MAX_IMAGES} images`;

    if (deliveryForm.chargeFee && isEmptyValue(deliveryForm.fee)) {
      errors.delivery_fee = "Delivery fee required when charging";
    }

    return errors;
  }, [form, deliveryForm, cleanPrice, images.files.length, isEmptyValue, getCategoryRules]);

  /* ---------------- CLEANUP FUNCTION ---------------- */
  const cleanupUploads = useCallback(async () => {
    if (!uploadedPublicIdsRef.current.length) return;

    try {
      const token = await getAccessTokenSilently();
      await fetch(`${apiUrl}/cleanup/images`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          public_ids: uploadedPublicIdsRef.current
        })
      });
    } catch (e) {
      console.warn("Cleanup failed", e);
    }

    uploadedPublicIdsRef.current = [];
  }, [apiUrl, getAccessTokenSilently]);

  /* ---------------- EVENT HANDLERS ---------------- */
  const handleFieldChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));

    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    validationTimeoutRef.current = setTimeout(() => {
      const fieldErrors = validateField(field, value);
      setUi(prev => {
        const updated = { ...prev.errors };
        delete updated[field];
        return {
          ...prev,
          errors: { ...updated, ...fieldErrors }
        };
      });
    }, 300);
  }, [validateField]);

  const handleImagesChange = useCallback((newImages) => {
    setImages(newImages);
    setTouched(prev => ({ ...prev, images: true }));

    const errors = validateField("images");
    setUi(prev => {
      const updated = { ...prev.errors };
      delete updated.images;
      return {
        ...prev,
        errors: { ...updated, ...errors }
      };
    });
  }, [validateField]);

  const handleDeliveryChange = useCallback((updates) => {
    setDeliveryForm(prev => ({ ...prev, ...updates }));
  }, []);

  /* ---------------- BULLETPROOF PUBLISH ---------------- */
  const handlePublish = useCallback(async () => {
    if (publishLockRef.current || ui.loading) return;

    const errors = validateForm();
    if (Object.keys(errors).length) {
      setUi(prev => ({ ...prev, errors }));
      setTimeout(() => {
        const firstError = Object.keys(errors)[0];
        const element = document.getElementById(`field-${firstError}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
          element.classList.add('ring-4', 'ring-red-500');
          setTimeout(() => element.classList.remove('ring-4', 'ring-red-500'), 2000);
        }
      }, 100);
      return;
    }

    publishLockRef.current = true;
    setUi(prev => ({
      ...prev,
      loading: true,
      publishStatus: "uploading",
      submitError: null,
      errors: {}
    }));

    let timeoutId = null;

    try {
      if (!currentIdempotencyKeyRef.current) {
        currentIdempotencyKeyRef.current = await generateIdempotencyKey(form, images, user?.sub);
      }
      const idempotencyKey = currentIdempotencyKeyRef.current;

      const { urls, publicIds } = await uploadImages();
      uploadedPublicIdsRef.current = [...publicIds];

      queueAbortControllerRef.current = new AbortController();
      const token = await getAccessTokenSilently();

      const queuePromise = fetch(`${apiUrl}/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          ...form,
          price: cleanPrice,
          discount_price: cleanDiscountPrice,
          images: urls,
          image_public_ids: publicIds,
          delivery: deliveryForm
        }),
        signal: queueAbortControllerRef.current.signal
      });

      timeoutId = setTimeout(() => {
        queueAbortControllerRef.current?.abort();
      }, QUEUE_TIMEOUT);

      const response = await queuePromise;
      clearTimeout(timeoutId);
      timeoutId = null;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      setUi({ loading: false, publishStatus: "success", errors: {}, submitError: null });
      localStorage.removeItem(STORAGE_KEYS.DRAFT);
      currentIdempotencyKeyRef.current = null;

      setTimeout(() => {
        setForm(initializeForm(user));
        setImages({ files: [], previews: [] });
        setDeliveryForm(initializeDeliveryForm());
        setTouched({});
        setUi({ loading: false, publishStatus: "idle", errors: {}, submitError: null });
      }, 3000);

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Publish failed:", error);
        setUi(prev => ({
          ...prev,
          loading: false,
          publishStatus: "processing",
          submitError: error.message || "Publish failed. Please try again.",
          errors: {}
        }));
        await cleanupUploads();
      } else {
        setUi(prev => ({
          ...prev,
          loading: false,
          publishStatus: "processing",
          submitError: "Processing... Check your listings page in a moment.",
          errors: {}
        }));
      }
    } finally {
      publishLockRef.current = false;
      queueAbortControllerRef.current = null;
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, [form, deliveryForm, cleanPrice, cleanDiscountPrice, images, ui.loading, user, validateForm, cleanupUploads]);

  /* ---------------- FIXED IMAGE UPLOAD ---------------- */
  const uploadImages = useCallback(async () => {
    if (!images.files.length) return { urls: [], publicIds: [] };

    abortControllerRef.current = new AbortController();
    const results = { urls: [], publicIds: [] };

    const chunks = [];
    for (let i = 0; i < images.files.length; i += CONCURRENT_UPLOADS) {
      chunks.push(images.files.slice(i, i + CONCURRENT_UPLOADS));
    }

    for (const chunk of chunks) {
      const uploads = chunk.map(file => {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File "${file.name}" too large (${Math.round(file.size/1024/1024)}MB > 5MB)`);
        }

        const fd = new FormData();    
        fd.append("file", file);    
        fd.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);    

        return fetch(cloudinaryUrl, {    
          method: "POST",    
          body: fd,    
          signal: abortControllerRef.current.signal    
        }).then(res => {    
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`);    
          return res.json();    
        });
      });

      const settled = await Promise.allSettled(uploads);
      for (const result of settled) {
        if (result.status === "rejected") {
          throw new Error(result.reason?.message || "Image upload failed");
        }
        const data = result.value;
        if (data.error) throw new Error(`Cloudinary: ${data.error.message}`);

        results.urls.push(data.secure_url);    
        results.publicIds.push(data.public_id);
      }
    }

    return results;
  }, [images.files]);

  /* ---------------- RENDER ---------------- */
  return (
    <div className="add-product-container min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">  
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="text-center pb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Add New Product
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Fill all required fields. We'll validate everything before publishing.
          </p>
        </div>

        <ProductDetailsSection    
          form={form}    
          onFieldChange={handleFieldChange}    
          categoryFields={categoryFields}    
          brands={brands}    
          models={models}    
          conditions={conditions}    
          usedDetails={usedDetails}    
          ramOptions={ramOptions}    
          storageOptions={storageOptions}    
          colors={colors}    
          sims={sims}    
          years={years}    
          engines={engines}    
          fuelTypes={fuelTypes}    
          featuresByCategory={featuresByCategory}    
          errors={ui.errors}    
          touched={touched}    
        />    

        <PricingBoostSection    
          form={form}    
          onFieldChange={handleFieldChange}    
          promotionPlans={promotionPlans}    
          cleanPrice={cleanPrice}    
          errors={ui.errors}    
          touched={touched}    
        />    

        <DescriptionMediaSection    
          form={form}    
          onFieldChange={handleFieldChange}    
          images={images}    
          onImagesChange={handleImagesChange}    
          errors={ui.errors}    
          touched={touched}    
        />    

        <DeliveryContactSection    
          form={form}    
          onFieldChange={handleFieldChange}    
          deliveryForm={deliveryForm}    
          onDeliveryChange={handleDeliveryChange}    
          locationsByState={locationsByState}    
          errors={ui.errors}    
          touched={touched}    
        />    

        {/* Sticky Action Bar */}    
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 pt-6 pb-4 px-6 md:px-12 z-50 shadow-2xl">    
          {ui.submitError && (    
            <div className="mb-6 p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl text-orange-800 text-sm animate-pulse">    
              <div className="font-medium">Status:</div>    
              {ui.submitError}    
            </div>    
          )}    
            
          <div className="flex gap-4 items-center justify-between">    
            <button    
              onClick={() => localStorage.removeItem(STORAGE_KEYS.DRAFT)}    
              className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all"    
            >    
              Clear Draft    
            </button>    
              
            <button    
              onClick={handlePublish}    
              disabled={ui.loading || ui.publishStatus === "success"}    
              className={`group relative w-full max-w-md py-4 px-8 font-bold text-lg rounded-2xl transition-all duration-300 overflow-hidden ${    
                ui.loading || ui.publishStatus === "success"    
                  ? "bg-gray-400 cursor-not-allowed"    
                  : "bg-gradient-to-r from-emerald-500 via-blue-600 to-purple-600 hover:from-emerald-600 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transform hover:-translate-y-1 active:translate-y-0"    
              }`}    
            >    
              <span className="flex items-center justify-center gap-3 relative z-10">    
                {ui.loading ? (    
                  <>    
                    <div className="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin" />    
                    Publishing...    
                  </>    
                ) : ui.publishStatus === "success" ? (    
                  <>    
                    ✅ Product Live!    
                    <div className="w-5 h-5 bg-white/20 rounded-full animate-ping" />    
                  </>    
                ) : ui.publishStatus === "processing" ? (
                  <>    
                    ⏳ Processing...    
                    <div className="w-5 h-5 bg-white/20 rounded-full animate-pulse" />    
                  </>    
                ) : (    
                  <>    
                    🚀 Publish Product    
                    <span className="group-hover:scale-110 transition-transform">✨</span>    
                  </>    
                )}    
              </span>    
            </button>    
          </div>    
            
          {Object.keys(ui.errors).length > 0 && (    
            <div className="mt-4 pt-4 border-t border-gray-200 text-center">    
              <p className="text-sm text-red-600">    
                Fix {Object.keys(ui.errors).length} error{Object.keys(ui.errors).length !== 1 ? 's' : ''} to publish    
              </p>    
            </div>    
          )}    
        </div>
      </div>    
    </div>
  );
}