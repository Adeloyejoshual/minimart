import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { Link } from "react-router-dom";
import ProductComponents from "./product/components.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { apiFetch, ApiError } from "../utils/apiFetch.js";
import imageCompression from "browser-image-compression";
import "../styles/AddProduct.css";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */

const API_BASE = "https://minimart-ivrm.onrender.com/api";
const STORAGE_PAYMENT = "payment_retry";
const MAX_IMAGES = 6;
const MAX_SIZE = 3 * 1024 * 1024;

/* ─────────────────────────────────────────────
   Initial Form
───────────────────────────────────────────── */

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  subcategory_id: "",
  attributes: {
    brand: "",
    model: "",
    color: "",
    condition: "",
    used_detail: "",
    ram: "",
    storage: "",
    sim: "",
    year: "",
    engine: "",
    fuel_type: "",
    features: [],
    size: "",
    age_range: "",
    bedrooms: "",
    bathrooms: "",
    experience_level: "",
    skills: "",
  },
  delivery: {
    available: false,
    duration: { from: "", to: "" },
    fee: "",
    note: "",
  },
  contact: {
    phone: "",
    whatsapp: "",
    whatsapp_link: "",
    email: "",
    preferred: "chat",
  },
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
const onlyDigits = (v = "") => v.replace(/[^0-9]/g, "");
const toArray = (v) => (Array.isArray(v) ? v : []);
const getToken = () => localStorage.getItem("token");

const displayPrice = (v) =>
  Number(v) > 0 ? new Intl.NumberFormat("en-NG").format(v) : "";

const formatLabel = (t) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const generateIdempotencyKey = () =>
  crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */

export default function AddProductPage({ user }) {
  const STORAGE_DRAFT = `product_draft_${user?.id ?? "anon"}`;

  /* ───── State ───── */

  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [promotionPlans, setPromotionPlans] = useState([]);
  const [locationState, setLocationState] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [detectedCoords, setDetectedCoords] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const isSubmittingRef = useRef(false);

  /* ─────────────────────────────────────────────
     Derived
  ───────────────────────────────────────────── */

  const selectedCategory = useMemo(
    () =>
      categories.find((c) => String(c.id) === String(form.category_id)) ??
      null,
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions ?? {};
  const states = Object.keys(locationsByState ?? {});
  const cities =
    locationState ? locationsByState[locationState] ?? [] : [];

  /* ─────────────────────────────────────────────
     Load Categories
  ───────────────────────────────────────────── */

  useEffect(() => {
    apiFetch(`${API_BASE}/addproduct/categories`)
      .then((data) =>
        setCategories(Array.isArray(data) ? data : [])
      )
      .catch(() => setCategories([]));
  }, []);

  /* ─────────────────────────────────────────────
     Load Promotion Plans
  ───────────────────────────────────────────── */

  useEffect(() => {
    apiFetch(`${API_BASE}/payment/plans`)
      .then((res) => {
        if (res.success && Array.isArray(res.plans)) {
          setPromotionPlans([
            { id: 0, name: "Free", price: 0 },
            ...res.plans,
          ]);
        }
      })
      .catch(() => setPromotionPlans([]));
  }, []);

  /* ─────────────────────────────────────────────
     Draft Restore
  ───────────────────────────────────────────── */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_DRAFT);
      if (!raw) return;
      const draft = JSON.parse(raw);

      setForm({
        ...INITIAL_FORM,
        ...draft.form,
        attributes: {
          ...INITIAL_FORM.attributes,
          ...(draft.form?.attributes ?? {}),
          features: toArray(draft.form?.attributes?.features),
        },
      });

      setLocationState(draft.locationState ?? "");
      setCity(draft.city ?? "");
      if (draft.selectedPlan && promotionPlans.length) {
        const match = promotionPlans.find(
          (p) => Number(p.id) === Number(draft.selectedPlan)
        );
        if (match) setSelectedPlan(match);
      }
    } catch {}
  }, [promotionPlans, STORAGE_DRAFT]);

  /* ─────────────────────────────────────────────
     Auto Save Draft
  ───────────────────────────────────────────── */

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(
        STORAGE_DRAFT,
        JSON.stringify({
          form,
          locationState,
          city,
          selectedPlan: selectedPlan?.id ?? null,
        })
      );
    }, 1000);
    return () => clearTimeout(t);
  }, [form, locationState, city, selectedPlan, STORAGE_DRAFT]);

  /* ─────────────────────────────────────────────
     Validation
  ───────────────────────────────────────────── */

  const validateForm = useCallback(() => {
    if (!form.title.trim()) return "Title required";
    if (!form.description.trim()) return "Description required";
    if (!form.price || Number(form.price) <= 0)
      return "Valid price required";
    if (!form.category_id) return "Category required";
    if (!images.length) return "At least one image required";
    if (!locationState || !city)
      return "Select state and city";
    if (!agreedToTerms)
      return "Accept Terms & Conditions";
    return null;
  }, [form, images, locationState, city, agreedToTerms]);

  /* ─────────────────────────────────────────────
     Submit
  ───────────────────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    if (loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      isSubmittingRef.current = false;
      return;
    }

    setLoading(true);
    setError("");

    let product = null;

    try {
      const token = getToken();
      if (!token) throw new ApiError("Login required", 401);

      const finalPlan =
        selectedPlan ||
        promotionPlans.find((p) => Number(p.price) === 0);

      if (!finalPlan)
        throw new ApiError("No plan available");

      const isFree = Number(finalPlan.price) === 0;

      /* ───── Create Product ───── */

      const fd = new FormData();
      fd.append("title", form.title.trim());
      fd.append("description", form.description.trim());
      fd.append("price", Number(form.price).toFixed(2));
      fd.append("category_id", form.category_id);
      fd.append("location_state", locationState);
      fd.append("location_city", city);
      fd.append(
        "attributes",
        JSON.stringify({
          ...form.attributes,
          features: toArray(form.attributes.features),
        })
      );
      fd.append("delivery", JSON.stringify(form.delivery));
      fd.append("contact", JSON.stringify(form.contact));
      fd.append("idempotency_key", generateIdempotencyKey());
      fd.append("seller_name", user?.store_name || user?.name || "Minimart");

      images.forEach((img) => fd.append("images", img.file));

      const res = await fetch(
        `${API_BASE}/addproduct/products`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        }
      );

      const data = await res.json();
      if (!res.ok)
        throw new ApiError(data?.message || "Product creation failed");

      product = data.product;

      /* ───── Free Plan ───── */

      if (isFree) {
        await apiFetch(
          `${API_BASE}/addproduct/products/${product.id}/activate`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ promotion_id: null }),
          }
        );

        localStorage.removeItem(STORAGE_DRAFT);
        window.location.href = "/";
        return;
      }

      /* ───── Paid Plan ───── */

      const payment = await apiFetch(
        `${API_BASE}/payment/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: form.contact.email,
            plan_id: finalPlan.id,
            product_id: product.id,
          }),
        }
      );

      if (!payment.authorization_url)
        throw new ApiError("Payment setup failed");

      localStorage.setItem(
        STORAGE_PAYMENT,
        JSON.stringify(payment)
      );

      window.open(payment.authorization_url, "_blank");

    } catch (err) {
      console.error(err);
      setError(err.message || "Submission failed");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [
    loading,
    validateForm,
    selectedPlan,
    promotionPlans,
    form,
    images,
    locationState,
    city,
    user,
    STORAGE_DRAFT,
  ]);

  /* ─────────────────────────────────────────────
     Render
  ───────────────────────────────────────────── */

  return (
    <div className="add-product-container">
      <ProductComponents
        form={form}
        categories={categories}
        options={options}
        selectedCategory={selectedCategory}
        states={states}
        cities={cities}
        images={images}
        setImages={setImages}
        selectedPlan={selectedPlan}
        setSelectedPlan={setSelectedPlan}
        promotionPlans={promotionPlans}
        loading={loading}
        error={error}
        success={success}
        agreedToTerms={agreedToTerms}
        setAgreedToTerms={setAgreedToTerms}
        handleSubmit={handleSubmit}
        displayPrice={displayPrice}
        onlyNumbers={onlyNumbers}
        onlyDigits={onlyDigits}
        formatLabel={formatLabel}
        MAX_IMAGES={MAX_IMAGES}
      />
    </div>
  );
}