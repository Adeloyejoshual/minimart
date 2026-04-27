// src/components/AddProduct.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans } from "../config/promotions.js";
import { categoryFields } from "../config/categoryFields.js";
import "../styles/AddProduct.css";
import imageCompression from "browser-image-compression";

const STORAGE_DRAFT = "product_draft";
const STORAGE_PAYMENT = "payment_retry";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const submitRef = useRef(false);

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024;

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === String(form.category_id)) || null,
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

  const onlyNumbers = (v = "") => v.replace(/[^0-9.]/g, "");
  const onlyDigits = (v = "") => v.replace(/[^0-9]/g, "");

  const displayPrice = (v) => {
    const num = Number(v);
    return Number.isNaN(num) || num <= 0
      ? ""
      : new Intl.NumberFormat("en-NG").format(num);
  };

  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\bw\b/g, (l) => l.toUpperCase());

  const showError = useCallback((msg) => {
    console.error("❌ Error:", msg);
    setError(msg);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((msg) => {
    console.log("✅ Success:", msg);
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 5000);
  }, []);

  // 1. Load categories
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        console.log("✅ Categories loaded:", data);
        setCategories(data);
      })
      .catch((err) => {
        console.error("❌ Categories fetch failed:", err);
        showError("Failed to load categories");
        setCategories([]);
      });
  }, [showError]);

  // 2. Clear payment retry on mount
  useEffect(() => {
    const savedPayment = localStorage.getItem(STORAGE_PAYMENT);
    if (savedPayment) {
      localStorage.removeItem(STORAGE_PAYMENT);
    }
  }, []);

  // 3. Restore draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (saved) {
        const draft = JSON.parse(saved);
        const safeForm = {
          title: draft.form?.title ?? "",
          description: draft.form?.description ?? "",
          price: draft.form?.price ?? "",
          category_id: draft.form?.category_id ?? "",
          subcategory_id: draft.form?.subcategory_id ?? "",
          attributes: {
            ...INITIAL_FORM.attributes,
            ...draft.form?.attributes,
          },
          delivery: {
            available: draft.form?.delivery?.available ?? false,
            duration: {
              from: draft.form?.delivery?.duration?.from ?? "",
              to: draft.form?.delivery?.duration?.to ?? "",
            },
            fee: draft.form?.delivery?.fee ?? "",
            note: draft.form?.delivery?.note ?? "",
          },
          contact: {
            phone: draft.form?.contact?.phone ?? "",
            whatsapp: draft.form?.contact?.whatsapp ?? "",
            whatsapp_link: draft.form?.contact?.whatsapp_link ?? "",
            email: draft.form?.contact?.email ?? "",
            preferred: draft.form?.contact?.preferred ?? "chat",
          },
        };

        setForm(safeForm);
        setState(draft.state || "");
        setCity(draft.city || "");
        setSelectedPlan(
          promotionPlans.find((p) => p.id === draft.selectedPlan) || null
        );
        showSuccess("Draft restored");
      }
    } catch (e) {
      console.error("Draft restore failed:", e);
    }
  }, [showSuccess]);

  // 4. Auto‑save draft
  useEffect(() => {
    if (loading) return;
    const timeout = setTimeout(() => {
      try {
        const draft = {
          form,
          state,
          city,
          imagesCount: images.length,
          selectedPlan: selectedPlan?.id || null,
        };
        localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
      } catch (e) {
        console.error("Draft save failed:", e);
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [
    form.title,
    form.description,
    form.price,
    form.category_id,
    form.subcategory_id,
    state,
    city,
    selectedPlan?.id,
    images.length,
    loading,
  ]);

  const updateForm = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm((prev) => {
      const updated = { ...prev.attributes, [key]: value };
      if (key === "brand") updated.model = "";
      if (key === "condition") updated.used_detail = "";
      return { ...prev, attributes: updated };
    });
  }, []);

  const updateContact = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      contact: { ...prev.contact, [key]: value },
    }));
  }, []);

  const updateDelivery = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: { ...prev.delivery, [key]: value },
    }));
  }, []);

  const updateDeliveryDuration = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        duration: { ...prev.delivery.duration, [key]: value },
      },
    }));
  }, []);

  const toggleFeature = useCallback((feature) => {
    setForm((prev) => {
      const features = prev.attributes?.features || [];
      const exists = features.includes(feature);
      return {
        ...prev,
        attributes: {
          ...prev.attributes,
          features: exists
            ? features.filter((f) => f !== feature)
            : [...features, feature],
        },
      };
    });
  }, []);

  const validateForm = useCallback(() => {
    if (!form.title?.trim() || form.title.length < 10)
      return "Title must be at least 10 characters";
    if (!form.description?.trim() || form.description.length < 20)
      return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0) return "Valid price required";
    if (!form.category_id) return "Please select a category";
    if (!form.contact?.phone || form.contact.phone.length < 10)
      return "Valid phone required";
    if (!form.contact?.email?.includes("@"))
      return "Valid email required";
    if (!form.contact?.whatsapp || form.contact.whatsapp.length < 10)
      return "WhatsApp required";
    if (images.length === 0) return "Upload at least 1 image";
    if (!state || !city) return "Select state and city";

    if (form.delivery?.available) {
      const from = Number(form.delivery.duration?.from);
      const to = Number(form.delivery.duration?.to);
      if (Number.isNaN(from) || Number.isNaN(to))
        return "Enter valid delivery duration";
      if (to < from) return "End day must be after start day";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0)
        return "Enter valid delivery fee";
    }
    return null;
  }, [form, images.length, state, city]);

  const clearDraft = useCallback(() => {
    setForm(INITIAL_FORM);
    setImages([]);
    setState("");
    setCity("");
    setSelectedPlan(null);
    setPaymentData(null);
    localStorage.removeItem(STORAGE_DRAFT);
    localStorage.removeItem(STORAGE_PAYMENT);
    showSuccess("Draft cleared");
  }, [showSuccess]);

  const handleImages = useCallback(
    async (files) => {
      if (images.length >= MAX_IMAGES) {
        showError("Maximum 6 images allowed");
        return;
      }
      const fileArray = Array.from(files);
      const remaining = MAX_IMAGES - images.length;
      const validFiles = fileArray
        .filter((f) => f.type.startsWith("image/") && f.size <= MAX_SIZE)
        .slice(0, remaining);

      Promise.all(validFiles.map((file) => compressImage(file)))
        .then((compressed) => {
          const newImages = compressed.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            preview: URL.createObjectURL(file),
          }));
          setImages((prev) => [...prev, ...newImages]);
          showSuccess(`${compressed.length} image(s) added`);
        })
        .catch((err) => {
          console.error("Image compression failed:", err);
          showError("Image processing failed");
        });
    },
    [images.length, showError, showSuccess]
  );

  const compressImage = async (file) => {
    try {
      return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });
    } catch (e) {
      console.warn("Compression failed, using original:", e);
      return file;
    }
  };

  const removeImage = useCallback((id) => {
    setImages((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const handleDrop = useCallback((e, index) => {
    e.preventDefault();
    const from = dragIndex;
    if (from === null || from === index) return;

    setImages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(index, 0, moved);
      return copy;
    });
    setDragIndex(null);
  }, [dragIndex]);

  const fields = useMemo(() => {
    const backendFields = Array.isArray(options.fields) ? options.fields : [];
    const categoryName = selectedCategory?.name;
    const frontendFields = categoryFields[categoryName] || [];
    const allFields = [...backendFields, ...frontendFields];
    return [...new Set(allFields)].filter(Boolean);
  }, [options.fields, selectedCategory?.name]);

  const optionsMap = useMemo(() => ({
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
  }), [options, normalizeOptions]);

  const modelOptions = useMemo(() => {
    if (!options.models || !attributes?.brand) return [];
    const matchKey = Object.keys(options.models).find(
      (k) => k.toLowerCase() === attributes.brand.toLowerCase()
    );
    return normalizeOptions(matchKey ? options.models[matchKey] || [] : []);
  }, [attributes?.brand, options.models, normalizeOptions]);

  const states = Object.keys(locationsByState || {});
  const cities = state ? (locationsByState[state] || []) : [];

  // 5. Create product with auth token
  const createProduct = async () => {
    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("description", form.description.trim());
    fd.append("price", Number(form.price).toString());
    fd.append("category_id", form.category_id);
    fd.append("subcategory_id", form.subcategory_id || "");
    fd.append("attributes", JSON.stringify(attributes));
    fd.append("delivery", JSON.stringify(form.delivery));
    fd.append("contact", JSON.stringify(form.contact));
    fd.append("location_state", state);
    fd.append("location_city", city);

    const imageFiles = images.map((img) => img.file);
    const compressedFiles = await Promise.all(
      imageFiles.map((file) => compressImage(file))
    );
    compressedFiles.forEach((file) => fd.append("images", file));

    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token; please log in again");
    }

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/marketplace/products",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    const { product } = await res.json();
    return product;
  };

  // 6. POST to /api/payment/initiate (paid plan)
  const initPayment = async (productId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No token; please log in before paying");
    }

    const payload = {
      email: form.contact.email,
      amount: Number(form.price),
      plan_id: selectedPlan.id,
      product_id: productId,
    };

    const res = await fetch(
      "https://minimart-ivrm.onrender.com/api/payment/initiate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    if (!res.ok || !data.success || !data.authorization_url) {
      throw new Error(data.message || "Payment initialization failed");
    }

    return {
      reference: data.reference,
      authUrl: data.authorization_url,
    };
  };

  // 7. POST /api/marketplace/products/:id/activate (free plan)
  const activateFreePlan = async (productId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No token; please log in before activating");
    }

    const res = await fetch(
      `https://minimart-ivrm.onrender.com/api/marketplace/products/${productId}/activate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ promotion_id: selectedPlan?.id || null }),
      }
    );

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Product activation failed");
    }
    return data;
  };

  const handleSubmit = useCallback(async () => {
    if (loading || submitRef.current) return;
    submitRef.current = true;

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      submitRef.current = false;
      return;
    }

    const finalPlan = selectedPlan || promotionPlans.find((p) => p.price === 0);
    setLoading(true);
    setError("");

    let product = null;

    try {
      product = await createProduct();
      if (!product?.id) throw new Error("Failed to create product");

      if (finalPlan.price === 0) {
        await activateFreePlan(product.id);
        clearDraft();
        showSuccess("✅ Product created and published!");
        return;
      }

      const paymentRes = await initPayment(product.id);
      const { reference, authUrl } = paymentRes;

            const paymentSession = {
        reference,
        authUrl,
        planId: finalPlan.id,
        productId: product.id,
        email: form.contact.email,
        amount: Number(finalPlan.price),
        createdAt: Date.now(),
      };

      localStorage.setItem(STORAGE_PAYMENT, JSON.stringify(paymentSession));
      setPaymentData(paymentSession);

      showSuccess("💳 Redirecting to payment...");
      const win = window.open(authUrl, "_blank");
      if (!win || win.closed) {
        showError("Popup blocked; allow popups and try again");
      }
    } catch (err) {
      console.error("Submit error:", err);
      // If product exists but payment failed, delete it only if not already active
      if (product?.id) {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(
            `https://minimart-ivrm.onrender.com/api/marketplace/products/${product.id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            }
          );
          if (!res.ok) {
            const text = await res.text();
            console.warn("Failed to cleanup product:", text);
          }
        } catch (cleanupErr) {
          console.warn("Cleanup failed:", cleanupErr);
        }
      }
      showError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
      submitRef.current = false;
    }
  }, [form, images, state, city, selectedPlan, validateForm, loading, clearDraft]);

  // 8. Optional: cleanup object URLs
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
    };
  }, [images]);

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* Basic Info */}
      <section className="section form-card">
        <h3 className="section-title">Basic Information</h3>
        <div className="form-group">
          <label>
            Product Title <span className="required">*</span>
          </label>
          <input
            placeholder="Enter product title (min 10 chars)"
            value={form.title}
            onChange={(e) => updateForm("title", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>
            Description <span className="required">*</span>
          </label>
          <textarea
            placeholder="Detailed product description (min 20 chars)"
            rows={4}
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>
            Price (₦) <span className="required">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Enter price"
            value={displayPrice(form.price)}
            onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
          />
        </div>
      </section>

      {/* Category & Attributes */}
      <section className="section form-card">
        <h3 className="section-title">Product Details</h3>
        <div className="form-group">
          <label>
            Category <span className="required">*</span>
          </label>
          <DropdownModal
            value={String(form.category_id)}
            onChange={(v) => {
              updateForm("category_id", v);
              updateForm("subcategory_id", "");
              updateForm("attributes", INITIAL_FORM.attributes);
            }}
            options={categories}
            placeholder="Select category"
          />
        </div>

        {/* Brand */}
        {optionsMap.brand.length > 0 && (
          <div className="form-group">
            <label>{formatLabel("brand")}</label>
            <DropdownModal
              value={attributes?.brand || ""}
              onChange={(v) => updateAttribute("brand", v)}
              options={optionsMap.brand}
            />
          </div>
        )}

        {/* Model (only if brand chosen and models available) */}
        {modelOptions.length > 0 && (
          <div className="form-group">
            <label>{formatLabel("model")}</label>
            <DropdownModal
              value={attributes?.model || ""}
              onChange={(v) => updateAttribute("model", v)}
              options={modelOptions}
            />
          </div>
        )}

        {/* Dynamic fields from category fields */}
        {fields.map((field) => {
          if (field === "brand" || field === "model") return null;

          const fieldOptions = optionsMap[field] || [];
          if (!fieldOptions.length) return null;

          if (field === "used_detail" && attributes?.condition !== "Used")
            return null;

          return (
            <div key={field} className="form-group">
              <label>{formatLabel(field)}</label>
              <DropdownModal
                value={attributes?.[field] || ""}
                onChange={(v) => updateAttribute(field, v)}
                options={fieldOptions}
              />
            </div>
          );
        })}

        {/* Features (if any) */}
        {optionsMap.features.length > 0 && (
          <div className="form-group">
            <label>Features</label>
            <div className="checkbox-grid-inline">
              {optionsMap.features
                .slice()
                .sort((a, b) => (a || "").localeCompare(b || ""))
                .map((feature) => (
                  <label key={feature} className="checkbox-inline">
                    {formatLabel(feature)}
                    <input
                      type="checkbox"
                      checked={attributes?.features?.includes(feature) || false}
                      onChange={() => toggleFeature(feature)}
                    />
                  </label>
                ))}
            </div>
          </div>
        )}
      </section>

      {/* Contact */}
      <section className="section form-card">
        <h3 className="section-title">Contact Information</h3>
        <div className="form-group">
          <label>
            Email <span className="required">*</span>
          </label>
          <input
            type="email"
            placeholder="your@email.com"
            value={form.contact.email}
            onChange={(e) => updateContact("email", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>
            Phone <span className="required">*</span>
          </label>
          <input
            type="tel"
            placeholder="08012345678"
            value={form.contact.phone}
            onChange={(e) =>
              updateContact("phone", onlyDigits(e.target.value))
            }
          />
        </div>
        <div className="form-group">
          <label>
            WhatsApp <span className="required">*</span>
          </label>
          <input
            type="tel"
            placeholder="08012345678"
            value={form.contact.whatsapp}
            onChange={(e) =>
              updateContact("whatsapp", onlyDigits(e.target.value))
            }
          />
        </div>
        <div className="form-group">
          <label>WhatsApp Link</label>
          <input
            type="url"
            placeholder="https://wa.me/2348012345678"
            value={form.contact.whatsapp_link}
            onChange={(e) =>
              updateContact("whatsapp_link", e.target.value.trim())
            }
          />
        </div>
      </section>

      {/* Location & Delivery */}
      <section className="section form-card">
        <h3 className="section-title">Location & Delivery</h3>
        <div className="form-group">
          <label>
            State <span className="required">*</span>
          </label>
          <DropdownModal
            value={state}
            onChange={setState}
            options={states.map((s) => ({ id: s, name: s }))}
          />
        </div>
        {state && (
          <div className="form-group">
            <label>
              City <span className="required">*</span>
            </label>
            <DropdownModal
              value={city}
              onChange={setCity}
              options={cities.map((c) => ({ id: c, name: c }))}
            />
          </div>
        )}
        <div className="form-group">
          <label>Delivery Available</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={form.delivery.available}
              onChange={(e) =>
                updateDelivery("available", e.target.checked)
              }
            />
            <span className="slider"></span>
          </label>
        </div>
        {form.delivery.available && (
          <div className="delivery-grid sub-grid">
            <div className="form-group">
              <label>
                From Day <span className="required">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="1"
                value={form.delivery.duration.from}
                onChange={(e) =>
                  updateDeliveryDuration("from", onlyDigits(e.target.value))
                }
              />
            </div>
            <div className="form-group">
              <label>
                To Day <span className="required">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="3"
                value={form.delivery.duration.to}
                onChange={(e) =>
                  updateDeliveryDuration("to", onlyDigits(e.target.value))
                }
              />
            </div>
            <div className="form-group">
              <label>
                Fee (₦) <span className="required">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={displayPrice(form.delivery.fee)}
                onChange={(e) =>
                  updateDelivery("fee", onlyNumbers(e.target.value))
                }
              />
            </div>
            <div className="form-group full-width">
              <label>Delivery Note</label>
              <textarea
                placeholder="e.g., Cash on delivery available"
                value={form.delivery.note}
                onChange={(e) => updateDelivery("note", e.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      {/* Images */}
      <section className="section form-card">
        <h3 className="section-title">Product Images</h3>
        <label className="form-group-label">
          Max 6 images, 3MB each <span className="required">*</span>
        </label>
        <div className="preview-grid-modern image-upload-box">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="preview-thumb"
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, i)}
              onClick={() => setActiveImage(img.preview)}
            >
              <img src={img.preview} alt={`Preview ${i + 1}`} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(img.id);
                }}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="add-image-box add-image-btn">
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
              <div>+</div>
              <span>Add Image</span>
            </label>
          )}
        </div>
        {images.length > 0 && <small>{images.length}/6 images</small>}
      </section>

      {/* Promotion Plans */}
      <section className="section form-card">
        <h3 className="section-title">Promotion Plan (Optional)</h3>
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
                <span className="plan-price">₦{displayPrice(plan.price)}</span>
              </div>
              <div className="plan-duration">{plan.duration || "Always"}</div>
              <ul className="plan-features">
                {plan.features?.map((feat, i) => (
                  <li key={i}>{feat}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="button-section section form-card">
        <button
          className="primary-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Processing..." : "🚀 Create Product"}
        </button>
        {paymentData && (
          <button
            className="secondary-btn"
            onClick={() => window.open(paymentData.authUrl, "_blank")}
          >
            💳 Pay Now
          </button>
        )}
      </div>

      {error && (
        <div className="form-error">
          <span>⚠️</span> {error}
        </div>
      )}
      {success && (
        <div className="form-success">
          <span>✅</span> {success}
        </div>
      )}

      {activeImage && (
        <div className="image-modal" onClick={() => setActiveImage(null)}>
          <img src={activeImage} alt="Full preview" />
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loader"></div>
          <div className="loading-text">Creating your product...</div>
        </div>
      )}
    </div>
  );
}

export default AddProduct;