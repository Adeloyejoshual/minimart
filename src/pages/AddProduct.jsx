import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import ErrorBoundary from "../components/ErrorBoundary";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import "../styles/AddProduct.css";
import imageCompression from "browser-image-compression";

const STORAGE_DRAFT = "product_draft";
const STORAGE_PAYMENT = "payment_retry";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
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
  },
  delivery: {
    type: "standard",
    duration: { from: "", to: "" },
    fee: "",
    note: "",
  },
  contact: {
    phone: "",
    whatsapp: "",
    email: "",
    preferred: "chat",
  },
};

export default function AddProduct() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState([]);
  const [activeImage, setActiveImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [errors, setErrors] = useState({});
  const [productId, setProductId] = useState(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const fieldRefs = useRef({});

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024;

  const isSlowDevice = () =>
    navigator.hardwareConcurrency <= 4 ||
    navigator.deviceMemory <= 4 ||
    /Android|iPhone/i.test(navigator.userAgent);

  const compressImage = async (file) => {
    return await imageCompression(file, {
      maxSizeMB: isSlowDevice() ? 0.4 : 0.8,
      maxWidthOrHeight: isSlowDevice() ? 900 : 1280,
      useWebWorker: true,
    });
  };

  /* ================= CORE UTILITIES ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;
  const brand = attributes.brand;

  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) =>
          typeof x === "string" ? { id: x, name: x } : x
        )
      : [];

  const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
  const displayPrice = (v) =>
    v ? new Intl.NumberFormat("en-NG").format(Number(v)) : "";

  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/(^|s)w/g, (l) => l.toUpperCase() || l);

  /* ================= DYNAMIC OPTIONS MAP (ROBUST) ================= */
  const optionsMap = useMemo(() => {
    const map = {};

    // Brands always first
    map.brand = normalizeOptions(options.brands || []);

    // Model depends on brand
    if (brand && options.models && options.models[brand]) {
      map.model = normalizeOptions(options.models[brand]);
    } else {
      map.model = [];
    }

    // Flexible: handle color/colors, condition/conditions etc.
    const keys = [
      "colors",
      "color",
      "conditions",
      "condition",
      "ram",
      "storage",
      "sim",
      "year",
      "engine",
      "fuel_type",
    ];

    keys.forEach((key) => {
      const field = key.replace(/s$/, "");
      const backendKey =
        options[key] !== undefined
          ? key
          : options[field] !== undefined
          ? field
          : null;

      map[field] = normalizeOptions(
        backendKey ? options[backendKey] || [] : []
      );
    });

    return map;
  }, [options, brand]);

  const sortedFeatures = useMemo(() => {
    return [...(options.features || [])].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [options.features]);

  const fields = useMemo(() => {
    const dynamic = options.fields || [];
    return dynamic.includes("condition")
      ? dynamic
      : ["condition", ...dynamic];
  }, [options]);

  /* ================= VALIDATION + SCROLL ================= */
  const validate = () => {
    const e = {};
    if (form.title.length < 10)
      e.title = "Minimum 10 characters required";
    if (form.description.length < 20)
      e.description = "Minimum 20 characters required";
    if (!form.price || Number(form.price) <= 0)
      e.price = "Enter valid price (₦)";
    if (!form.category_id) e.category_id = "Select a category";
    if (!form.contact.phone || form.contact.phone.length < 10)
      e.phone = "Valid phone required (10+ digits)";
    if (!form.contact.email || !form.contact.email.includes("@"))
      e.email = "Valid email required";
    if (images.length === 0) e.images = "Add at least 1 image";
    if (!state) e.state = "Select your state";
    if (!city) e.city = "Select your city";

    if (
      form.delivery.type !== "none" &&
      form.delivery.type !== "pickup"
    ) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to))
        e.delivery_duration = "Delivery range required";
      if (to < from)
        e.delivery_duration = "End day must be after start day";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0)
        e.delivery_fee = "Delivery fee required";
    }

    setErrors(e);
    return Object.keys(e).length ? e : null;
  };

  const scrollToFirstError = useCallback((errObj) => {
    const firstKey = Object.keys(errObj)[0];
    const el = fieldRefs.current[firstKey];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("shake");
      setTimeout(() => el.classList.remove("shake"), 500);
    }
  }, []);

  /* ================= DRAFT MANAGEMENT ================= */
  const saveDraft = useCallback(() => {
    if (loading) return;
    const draft = {
      form,
      state,
      city,
      selectedPlan: selectedPlan?.id || null,
    };
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
  }, [form, state, city, selectedPlan, loading]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (saved) {
        const draft = JSON.parse(saved);
        setForm(draft.form || INITIAL_FORM);
        setState(draft.state || "");
        setCity(draft.city || "");
        if (draft.selectedPlan !== null) {
          const plan = promotionPlans.find(
            (p) => p.id === draft.selectedPlan
          );
          setSelectedPlan(plan || null);
        }
      }
    } catch (e) {
      console.error("Draft load failed:", e);
    }
  }, []);

  const clearDraft = useCallback(() => {
    setForm(INITIAL_FORM);
    setImages([]);
    setState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    setErrors({});
    setProductId(null);
    setPaymentPending(false);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
  }, []);

  /* ================= FORM UPDATERS ================= */
  const update = (key, value) =>
    setForm((p) => ({ ...p, [key]: value }));

  const updateAttr = (key, value) =>
    setForm((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        [key]: value,
        ...(key === "brand" && { model: "" }),
      },
    }));

  const updateContact = (key, value) =>
    setForm((p) => ({ ...p, contact: { ...p.contact, [key]: value } }));

  const updateDelivery = (key, value) =>
    setForm((p) => ({
      ...p,
      delivery: { ...p.delivery, [key]: value },
    }));

  const updateDeliveryDuration = (key, value) =>
    setForm((p) => ({
      ...p,
      delivery: {
        ...p.delivery,
        duration: { ...p.delivery.duration, [key]: value },
      },
    }));

  const toggleFeature = (feature) => {
    setForm((p) => {
      const list = p.attributes.features || [];
      const exists = list.includes(feature);
      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists
            ? list.filter((f) => f !== feature)
            : [...list, feature],
        },
      };
    });
  };

  /* ================= IMAGE HANDLING ================= */
  const handleImages = (files) => {
    const fileArray = Array.from(files);
    if (images.length >= MAX_IMAGES) {
      setErrors((prev) => ({
        ...prev,
        images: `Maximum ${MAX_IMAGES} images allowed`,
      }));
      return;
    }
    const remaining = MAX_IMAGES - images.length;
    const validFiles = fileArray
      .filter(
        (f) =>
          f.type.startsWith("image/") && f.size <= MAX_SIZE
      )
      .slice(0, remaining);

    const newImages = validFiles.map((file) => ({
      id:
        crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);
    if (errors.images)
      setErrors((prev) => ({ ...prev, images: "" }));
  };

  const removeImage = (id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  const compressImagesSequentially = async (imageFiles) => {
    const compressedFiles = [];
    for (const file of imageFiles) {
      try {
        const compressed = await compressImage(file);
        compressedFiles.push(compressed);
      } catch (e) {
        compressedFiles.push(file);
      }
    }
    return compressedFiles;
  };

  /* ================= EFFECTS ================= */
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    if (!loading) {
      const timeout = setTimeout(saveDraft, 800);
      return () => clearTimeout(timeout);
    }
  }, [form, state, city, selectedPlan, loading, saveDraft]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_PAYMENT);
    if (saved) {
      try {
        setPaymentData(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem(STORAGE_PAYMENT);
      }
    }
  }, []);

  useLayoutEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
    };
  }, [images]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      "https://minimart-ivrm.onrender.com/api/marketplace/categories",
      {
        signal: controller.signal,
      }
    )
      .then((r) => {
        if (!r.ok)
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then(setCategories)
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Categories fetch failed:", err);
          setErrors((prev) => ({
            ...prev,
            submit: "Failed to load categories",
          }));
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!options.fields?.length) return;
    setForm((prev) => {
      const newAttrs = { ...prev.attributes };
      options.fields.forEach((f) => {
        if (newAttrs[f] === undefined) {
          newAttrs[f] = f === "features" ? [] : "";
        }
      });
      return { ...prev, attributes: newAttrs };
    });
  }, [form.category_id, options.fields]);

  /* ================= API FUNCTIONS ================= */
  const createProductDraft = async () => {
    const fd = new FormData();
    const payload = {
      ...form,
      price: Number(form.price),
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
      promotion_plan: selectedPlan?.id || null,
      // ❌ do NOT include position or any other unique field
    };

    Object.entries(payload)
      .filter(
        ([_, v]) =>
          v !== null && v !== undefined && v !== ""
      )
      .forEach(([k, v]) => fd.append(k, String(v)));

    const imageFiles = images.map((img) => img.file);
    const compressedFiles = await compressImagesSequentially(
      imageFiles
    );
    compressedFiles.forEach((file) => fd.append("images", file));

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/marketplace/products",
      {
        method: "POST",
        body: fd,
      }
    );

    // Check status before parsing JSON
    if (!res.ok) {
      let text;
      try {
        text = await res.text();
      } catch (e) {
        text = "Unknown error";
      }
      throw new Error(text || `HTTP ${res.status}`);
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(
        `Server returned non‑JSON: ${res.status}`
      );
    }

    return data.product;
  };

  const startPayment = async (productId, plan) => {
    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/payment/initialize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.contact.email,
          amount: Number(plan.price),
          planId: plan.id,
          productId,
        }),
      }
    );

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Non‑JSON response: ${res.status}`);
    }

    if (!data.success || !data.authorization_url) {
      throw new Error(
        data.message || "Payment initialization failed"
      );
    }
    return data.authorization_url;
  };

  /* ================= handleSubmit ================= */
  const handleSubmit = async () => {
    const error = validate();
    if (error) return scrollToFirstError(error);

    setLoading(true);
    try {
      // CREATE DRAFT
      const product = await createProductDraft();
      setProductId(product.id);

      const finalPlan =
        selectedPlan ||
        promotionPlans.find((p) => p.price === 0);

      if (finalPlan.price === 0) {
        // FREE – activate via your endpoint
        const res = await fetch(
          `/api/marketplace/products/${product.id}/activate`,
          {
            method: "POST",
          }
        );
        if (!res.ok) throw new Error("Free activation failed");
        clearDraft();
        alert("✅ Product live!");
        window.location.href = "/";
      } else {
        // PAID
        setPaymentPending(true);
        const authUrl = await startPayment(product.id, finalPlan);
        window.location.href = authUrl;
      }
    } catch (err) {
      console.error(err);
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  /* ================= retryPayment ================= */
  const retryPayment = async () => {
    if (!productId || !paymentData) return;
    setLoading(true);
    try {
      const plan = { id: paymentData.planId, price: paymentData.amount };
      const authUrl = await startPayment(productId, plan);
      window.location.href = authUrl;
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  /* ================= STATES / CITIES ================= */
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  const needsPayment =
    selectedPlan?.price > 0 && productId && paymentPending;
  const canCreate = !productId || !paymentPending;

  return (
    <ErrorBoundary
      fallback={
        <div className="error-boundary">
          Error loading form.{" "}
          <button onClick={clearDraft} className="retry-btn">
            Reset Form
          </button>
        </div>
      }
    >
      <div className="add-product-container">
        <AddProductHeader
          title="Add Product"
          onClearDraft={clearDraft}
        />

                  {/* BASIC INFO */}
          <div className="form-card blue">
            <h3>Basic Information</h3>
            <div className="form-group">
              <label>
                Product Title <span className="required">*</span>
              </label>
              <input
                ref={(el) => (fieldRefs.current.title = el)}
                placeholder="Enter product title (min 10 chars)"
                value={form.title}
                onChange={(e) => {
                  update("title", e.target.value);
                  if (errors.title)
                    setErrors((prev) => ({ ...prev, title: "" }));
                }}
              />
              {errors.title && <span className="error">{errors.title}</span>}
            </div>
            <div className="form-group">
              <label>
                Description <span className="required">*</span>
              </label>
              <textarea
                ref={(el) => (fieldRefs.current.description = el)}
                placeholder="Detailed description (min 20 chars)"
                value={form.description}
                onChange={(e) => {
                  update("description", e.target.value);
                  if (errors.description)
                    setErrors((prev) => ({ ...prev, description: "" }));
                }}
                rows="4"
              />
              {errors.description && (
                <span className="error">{errors.description}</span>
              )}
            </div>

            {/* PRICE INPUT – BULLETPROOF */}
            <div className="form-group">
              <label>
                Price (₦) <span className="required">*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  ref={(el) => (fieldRefs.current.price = el)}
                  placeholder="59900"
                  value={form.price}
                  className="price-input"
                  onChange={(e) => {
                    const raw = onlyNumbers(e.target.value);
                    update("price", raw);
                    setErrors((prev) => ({ ...prev, price: "" }));
                  }}
                  onBlur={(e) => {
                    const raw = onlyNumbers(e.target.value);
                    const val = raw ? Number(raw).toString() : "";
                    update("price", val);
                  }}
                />
              </div>
              {errors.price ? (
                <span className="error">{errors.price}</span>
              ) : form.price ? (
                <small className="price-display">
                  ₦{displayPrice(form.price)}
                </small>
              ) : null}
            </div>
          </div>

          {/* CATEGORY & FEATURES */}
          <div className="form-card blue">
            <h3>Product Details</h3>
            {!categories.length ? (
              <div className="skeleton">Loading categories...</div>
            ) : (
              <>
                <div className="form-group">
                  <label>
                    Category <span className="required">*</span>
                  </label>
                  <div ref={(el) => (fieldRefs.current.category_id = el)}>
                    <DropdownModal
                      label=""
                      value={form.category_id}
                      onChange={(v) => {
                        setForm((prev) => ({
                          ...prev,
                          category_id: v,
                          attributes: INITIAL_FORM.attributes,
                        }));
                        if (errors.category_id)
                          setErrors((prev) => ({ ...prev, category_id: "" }));
                      }}
                      options={categories.map((c) => ({
                        id: c.id,
                        name: c.name,
                      }))}
                    />
                  </div>
                  {errors.category_id && (
                    <span className="error">{errors.category_id}</span>
                  )}
                </div>

                {fields.map((f) => {
                  if (!optionsMap[f] && f !== "features") return null;
                  if (f === "used_detail" && attributes.condition !== "Used")
                    return null;

                  return (
                    <div key={f} className="form-group">
                      <label>{formatLabel(f)}</label>
                      <DropdownModal
                        label=""
                        value={attributes[f] || ""}
                        onChange={(v) => updateAttr(f, v)}
                        options={optionsMap[f]}
                      />
                    </div>
                  );
                })}

                {sortedFeatures.length > 0 && (
                  <div className="form-group">
                    <label>Features</label>
                    <div className="checkbox-grid-inline">
                      {sortedFeatures.map((f) => (
                        <label
                          key={f}
                          className="checkbox-inline right-check"
                        >
                          <span>{formatLabel(f)}</span>
                          <input
                            type="checkbox"
                            checked={(attributes.features || []).includes(f)}
                            onChange={() => toggleFeature(f)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* CONTACT */}
          <div className="form-card blue">
            <h3>Contact Information</h3>
            <div className="form-group">
              <label>
                Email <span className="required">*</span>
              </label>
              <input
                ref={(el) => (fieldRefs.current.email = el)}
                type="email"
                placeholder="your@email.com"
                value={form.contact.email}
                onChange={(e) => {
                  updateContact("email", e.target.value);
                  if (errors.email)
                    setErrors((prev) => ({ ...prev, email: "" }));
                }}
              />
              {errors.email && (
                <span className="error">{errors.email}</span>
              )}
            </div>
            <div className="form-group">
              <label>
                Phone <span className="required">*</span>
              </label>
              <input
                ref={(el) => (fieldRefs.current.phone = el)}
                placeholder="08012345678"
                value={form.contact.phone}
                onChange={(e) => {
                  updateContact("phone", onlyNumbers(e.target.value));
                  if (errors.phone)
                    setErrors((prev) => ({ ...prev, phone: "" }));
                }}
              />
              {errors.phone && (
                <span className="error">{errors.phone}</span>
              )}
            </div>
          </div>

          {/* LOCATION + DELIVERY */}
          <div className="form-card blue">
            <h3>Location & Delivery</h3>
            <div className="form-group">
              <label>
                State <span className="required">*</span>
              </label>
              <div ref={(el) => (fieldRefs.current.state = el)}>
                <DropdownModal
                  label=""
                  value={state}
                  onChange={setState}
                  options={states}
                />
              </div>
              {errors.state && (
                <span className="error">{errors.state}</span>
              )}
            </div>
            {state && (
              <div className="form-group">
                <label>
                  City <span className="required">*</span>
                </label>
                <div ref={(el) => (fieldRefs.current.city = el)}>
                  <DropdownModal
                    label=""
                    value={city}
                    onChange={setCity}
                    options={cities}
                  />
                </div>
                {errors.city && (
                  <span className="error">{errors.city}</span>
                )}
              </div>
            )}
            <div className="form-group">
              <label>Delivery Type</label>
              <DropdownModal
                label=""
                value={form.delivery.type}
                onChange={(v) => {
                  updateDelivery("type", v);
                  if (errors.delivery_type)
                    setErrors((prev) => ({ ...prev, delivery_type: "" }));
                }}
                options={[
                  { id: "none", name: "No delivery" },
                  { id: "standard", name: "Standard delivery" },
                  { id: "express", name: "Express delivery" },
                  { id: "pickup", name: "Pickup only" },
                ]}
              />
            </div>

            {form.delivery.type !== "none" &&
              form.delivery.type !== "pickup" && (
                <div className="sub-grid">
                  <div className="form-section-round-small">
                    <label>
                      From (days) <span className="required">*</span>
                    </label>
                    <input
                      ref={(el) =>
                        (fieldRefs.current.delivery_duration = el)
                      }
                      type="number"
                      min="1"
                      value={form.delivery.duration.from}
                      onChange={(e) =>
                        updateDeliveryDuration("from", onlyNumbers(e.target.value))
                      }
                    />
                  </div>
                  <div className="form-section-round-small">
                    <label>
                      To (days) <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.delivery.duration.to}
                      onChange={(e) =>
                        updateDeliveryDuration("to", onlyNumbers(e.target.value))
                      }
                    />
                  </div>
                  <div className="form-section-round-small">
                    <label>
                      Fee (₦) <span className="required">*</span>
                    </label>
                    <input
                      ref={(el) =>
                        (fieldRefs.current.delivery_fee = el)
                      }
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.delivery.fee}
                      onChange={(e) =>
                        updateDelivery("fee", onlyNumbers(e.target.value))
                      }
                    />
                  </div>
                  {(errors.delivery_duration || errors.delivery_fee) && (
                    <span
                      className="error"
                      style={{ gridColumn: "1 / -1", textAlign: "center" }}
                    >
                      {errors.delivery_duration || errors.delivery_fee}
                    </span>
                  )}
                </div>
              )}
          </div>

          {/* IMAGES */}
          <div className="form-card blue">
            <h3>Product Images</h3>
            <label className="form-group-label">
              Product Images (max 6, 3MB each){" "}
              <span className="required">*</span>
            </label>
            <div
              className="images-section"
              ref={(el) => (fieldRefs.current.images = el)}
            >
              {images.length > 0 && (
                <div className="preview-grid-modern">
                  {images.map((img) => (
                    <div key={img.id} className="preview-card">
                      <img
                        src={img.preview}
                        alt=""
                        onClick={() => setActiveImage(img.preview)}
                        style={{ cursor: "pointer" }}
                      />
                      <button
                        className="remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(img.id);
                        }}
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {images.length < MAX_IMAGES && (
                <label className="add-card">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      handleImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <span>+</span>
                  <small>
                    {images.length
                      ? `Add more (${MAX_IMAGES - images.length} left)`
                      : "Add images"}
                  </small>
                </label>
              )}
              {errors.images && (
                <span className="error">{errors.images}</span>
              )}
            </div>
          </div>

          {/* PROMOTION */}
          <div className="form-card blue">
            <h3>Promotion Plan (Optional)</h3>
            <div className="plans-grid">
              {promotionPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`plan-card ${
                    selectedPlan?.id === plan.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  <div className="plan-header">
                    <strong>{plan.name}</strong>
                    <span className="plan-price">
                      ₦{displayPrice(plan.price.toString())}
                    </span>
                  </div>
                  <div className="plan-duration">{plan.duration}</div>
                  <ul className="plan-features">
                    {plan.features.map((feat, i) => (
                      <li key={i}>{feat}</li>
                    ))}
                  </ul>
                  {plan.description && (
                    <p className="plan-desc">{plan.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="form-card blue button-section">
            {errors.submit && (
              <span
                className="error"
                style={{ display: "block", marginBottom: "1rem" }}
              >
                {errors.submit}
              </span>
            )}

            <div className="button-section">
              {canCreate && (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="primary-btn"
                >
                  {loading ? "Processing..." : "Create Product"}
                </button>
              )}
              {needsPayment && (
                <button
                  onClick={retryPayment}
                  className="retry-btn"
                  disabled={loading}
                >
                  {loading ? "Retrying..." : "Retry Payment"}
                </button>
              )}
            </div>
          </div>

                          {/* FULLSCREEN IMAGE PREVIEW */}
          {activeImage && (
            <div
              className="image-modal"
              onClick={() => setActiveImage(null)}
            >
              <img src={activeImage} alt="preview" />
            </div>
          )}
        </div>
      </ErrorBoundary>
    );
  }
}