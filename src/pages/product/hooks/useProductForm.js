// src/pages/product/hooks/useProductForm.js
import { useState, useCallback, useMemo } from "react";
import imageCompression from "browser-image-compression";

import {
  fetchCategories,
  createProduct,
  deleteProduct,
} from "../api/productApi.js";
import { initPayment, activateFreeProduct } from "../api/paymentApi.js";
import { promotionPlans } from "../../config/promotions.js";
import { categoryFields } from "../../config/categoryFields.js";

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

const MAX_IMAGES = 6;
const MAX_SIZE = 3 * 1024 * 1024;

const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
const onlyDigits = (v = "") => v.replace(/[^0-9]/g, "");

const displayPrice = (v) => {
  const num = Number(v);
  return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
};

export function useProductForm() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCategory = useMemo(
    () =>
      categories.find((c) => String(c.id) === String(form.category_id)) || null,
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes || INITIAL_FORM.attributes;

  const normalizeOptions = useCallback((list) => {
    if (!list) return [];
    return Array.isArray(list)
      ? list.map((x) => (typeof x === "string" ? { id: x, name: x } : x))
      : [];
  }, []);

  const fields = useMemo(() => {
    const backendFields = Array.isArray(options.fields) ? options.fields : [];
    const categoryName = selectedCategory?.name;
    const frontendFields = categoryFields[categoryName] || [];
    return [...new Set([...backendFields, ...frontendFields])].filter(Boolean);
  }, [options.fields, selectedCategory?.name]);

  const optionsMap = useMemo(
    () => ({
      brand: normalizeOptions(options.brands),
      model: options.models || {},
      color: normalizeOptions(options.colors),
      condition: normalizeOptions(options.conditions),
      used_detail: normalizeOptions(options.usedDetails || options.used_details),
      ram: normalizeOptions(options.ram),
      storage: normalizeOptions(options.storage),
      sim: normalizeOptions(options.sim),
      features: Array.isArray(options.features) ? options.features : [],
      year: normalizeOptions(options.years),
      engine: normalizeOptions(options.engines || options.engine),
      fuel_type: normalizeOptions(options.fuel_types || options.fuelType),
      size: normalizeOptions(options.size),
      age_range: normalizeOptions(options.age_range),
      bedrooms: normalizeOptions(options.bedrooms),
      bathrooms: normalizeOptions(options.bathrooms),
      experience_level: normalizeOptions(options.experience_level),
      skills: normalizeOptions(options.skills),
    }),
    [options, normalizeOptions]
  );

  const modelOptions = useMemo(() => {
    if (!options.models || !attributes?.brand) return [];
    const matchKey = Object.keys(options.models).find(
      (k) => k.toLowerCase() === attributes.brand.toLowerCase()
    );
    return normalizeOptions(matchKey ? options.models[matchKey] || [] : []);
  }, [attributes?.brand, options.models, normalizeOptions]);

  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((