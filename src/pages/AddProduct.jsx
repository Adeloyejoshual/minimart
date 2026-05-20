import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import ProductComponents from "./product/components.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { apiFetch, ApiError } from "../utils/apiFetch.js";
import imageCompression from "browser-image-compression";
import "../styles/AddProduct.css";

/* ─────────────────────────────────────────────────────────────
   Constants
────────────────────────────────────────────────────────────── */

const API_BASE        = "https://minimart-ivrm.onrender.com/api";
const STORAGE_PAYMENT = "payment_retry";
const MAX_IMAGES      = 6;
const MAX_SIZE        = 3 * 1024 * 1024;

/* ─────────────────────────────────────────────────────────────
   Initial Form State
────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
const onlyDigits  = (v = "") => v.replace(/[^0-9]/g, "");

const displayPrice = (v) => {
  const num = Number(v);
  return Number.isFinite(num) && num > 0
    ? new Intl.NumberFormat("en-NG").format(num)
    : "";
};

const formatLabel = (t) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const getToken = () => localStorage.getItem("token");

const toArray = (v) => (Array.isArray(v) ? v : []);

const multipartPost = async (url, formData, token) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data?.message ?? `Request failed (${response.status})`,
      response.status
    );
  }

  return data;
};

/* ─────────────────────────────────────────────────────────────
   Component
────────────────────────────────────────────────────────────── */

export default function AddProductPage({ user }) {

  const STORAGE_DRAFT = `product_draft_${user?.id ?? "anon"}`;

  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [promotionPlans, setPromotionPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

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

  /* ────────────────────────────────────────────────────────────
     Load Categories
  ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    apiFetch(`${API_BASE}/addproduct/categories`)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  /* ────────────────────────────────────────────────────────────
     Load Promotion Plans (Dynamic)
  ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/payment/plans`);

        if (!mounted) return;

        if (res.success && Array.isArray(res.plans)) {
          setPromotionPlans([
            { id: 0, name: "Free", price: 0, duration: "Unlimited" },
            ...res.plans,
          ]);
        }
      } catch (err) {
        console.error("Failed to load plans", err);
      } finally {
        if (mounted) setPlansLoading(false);
      }
    };

    loadPlans();
    return () => { mounted = false; };
  }, []);

  /* ────────────────────────────────────────────────────────────
     Draft Restore
  ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_DRAFT);
    if (!saved) return;

    try {
      const draft = JSON.parse(saved);
      setForm(draft.form ?? INITIAL_FORM);
      setLocationState(draft.locationState ?? "");
      setCity(draft.city ?? "");

      if (draft.selectedPlan && promotionPlans.length) {
        const match = promotionPlans.find(
          (p) => Number(p.id) === Number(draft.selectedPlan)
        );
        if (match) setSelectedPlan(match);
      }
    } catch {}
  }, [promotionPlans]);

  /* ────────────────────────────────────────────────────────────
     Auto Save Draft
  ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    const timeout = setTimeout(() => {
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

    return () => clearTimeout(timeout);
  }, [form, locationState, city, selectedPlan]);

  /* ────────────────────────────────────────────────────────────
     Validation
  ──────────────────────────────────────────────────────────── */

  const validateForm = () => {
    if (!form.title.trim()) return "Title required";
    if (!form.description.trim()) return "Description required";
    if (!form.price || Number(form.price) <= 0) return "Valid price required";
    if (!form.category_id) return "Category required";
    if (!images.length) return "At least one image required";
    if (!locationState || !city) return "Location required";
    if (!agreedToTerms) return "Accept Terms & Conditions";

    return null;
  };

  /* ────────────────────────────────────────────────────────────
     Submit
  ──────────────────────────────────────────────────────────── */

  const handleSubmit = async () => {
    if (loading) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (plansLoading) {
      setError("Plans still loading...");
      return;
    }

    const finalPlan =
      selectedPlan ||
      promotionPlans.find((p) => Number(p.price) === 0);

    if (!finalPlan) {
      setError("No promotion plan available.");
      return;
    }

    setLoading(true);
    setError("");

    let product = null;

    try {
      const token = getToken();
      if (!token) throw new ApiError("Login required", 401);

      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("price", Number(form.price));
      fd.append("category_id", form.category_id);
      fd.append("location_state", locationState);
      fd.append("location_city", city);
      fd.append("attributes", JSON.stringify(form.attributes));
      fd.append("delivery", JSON.stringify(form.delivery));
      fd.append("contact", JSON.stringify(form.contact));

      images.forEach((img) => fd.append("images", img.file));

      const res = await multipartPost(
        `${API_BASE}/addproduct/products`,
        fd,
        token
      );

      product = res.product;

      const isFree = Number(finalPlan.price) === 0;

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

      const payment = await apiFetch(`${API_BASE}/payment/initiate`, {
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
      });

      if (!payment.authorization_url) {
        throw new Error("Payment failed");
      }

      setPaymentData(payment);
      window.open(payment.authorization_url, "_blank");

    } catch (err) {
      console.error(err);
      setError(err.message ?? "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  /* ────────────────────────────────────────────────────────────
     Render
  ──────────────────────────────────────────────────────────── */

  return (
    <div className="add-product-container">
      <ProductComponents
        form={form}
        attributes={form.attributes}
        images={images}
        categories={categories}
        promotionPlans={promotionPlans}
        selectedPlan={selectedPlan}
        paymentData={paymentData}
        loading={loading}
        error={error}
        success={success}
        agreedToTerms={agreedToTerms}
        setSelectedPlan={setSelectedPlan}
        handleSubmit={handleSubmit}
        displayPrice={displayPrice}
        formatLabel={formatLabel}
        onlyNumbers={onlyNumbers}
        onlyDigits={onlyDigits}
        MAX_IMAGES={MAX_IMAGES}
        INITIAL_FORM={INITIAL_FORM}
      />
    </div>
  );
}