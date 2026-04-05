import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import "../styles/AddProduct.css";
import imageCompression from "browser-image-compression";

const STORAGE_DRAFT = "product_draft";

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
    subcategory: "",
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
  // State
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState([]);
  const [activeImage, setActiveImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024;

  // Utilities
  const isSlowDevice = useCallback(() =>
    navigator.hardwareConcurrency <= 4 ||
    navigator.deviceMemory <= 4 ||
    /Android|iPhone|iPad/i.test(navigator.userAgent)
  , []);

  const compressImage = useCallback(async (file) => {
    return await imageCompression(file, {
      maxSizeMB: isSlowDevice() ? 0.4 : 0.8,
      maxWidthOrHeight: isSlowDevice() ? 900 : 1280,
      useWebWorker: true,
    });
  }, [isSlowDevice]);

  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(""), 5000);
  }, []);

  const showSuccess = useCallback((message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 3000);
  }, []);

  const onlyNumbers = useCallback((v = "") => v.replace(/[^0-9.]/g, ""), []);
  const onlyDigits = useCallback((v = "") => v.replace(/D/g, ""), []);
  const displayPrice = useCallback((v) => {
    const num = Number(v);
    return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
  }, []);
  const formatLabel = useCallback((t) =>
    t.replace(/_/g, " ").replace(/\bw/g, (l) => l.toUpperCase()),
  []);

  // Selectors
  const selectedCategory = useMemo(() =>
    categories.find(c => String(c.id) === String(form.category_id)),
  [categories, form.category_id]);

  const optionsMap = useMemo(() => {
    const opt = selectedCategory?.dynamicOptions || {};
    const normalize = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.map(v => typeof v === "string" ? { id: v, name: v } : v);
      }
      if (typeof val === "object") {
        return Object.values(val).flat().map(v => ({ id: v, name: v }));
      }
      return [];
    };
    return {
      brand: normalize(opt.brands),
      model: normalize(opt.models),
      color: normalize(opt.colors),
      condition: normalize(opt.conditions),
      ram: normalize(opt.ram),
      storage: normalize(opt.storage),
      sim: normalize(opt.sims),
      year: normalize(opt.years),
      engine: normalize(opt.engines),
      fuel_type: normalize(opt.fuel_types),
    };
  }, [selectedCategory]);

  const sortedFeatures = useMemo(() =>
    [...(selectedCategory?.dynamicOptions?.features || [])].sort((a, b) => a.localeCompare(b)),
  [selectedCategory?.dynamicOptions?.features]);

  const fields = useMemo(() => {
    const dynamic = selectedCategory?.dynamicOptions?.fields || [];
    return dynamic.includes("condition") ? dynamic : ["condition", ...dynamic];
  }, [selectedCategory?.dynamicOptions?.fields]);

  // Form updaters
  const updateForm = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateAttribute = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value,
        ...(key === "brand" && { model: "" }),
      },
    }));
  }, []);

  const updateContact = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      contact: { ...prev.contact, [key]: value },
    }));
  }, []);

  const updateDelivery = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      delivery: { ...prev.delivery, [key]: value },
    }));
  }, []);

  const updateDeliveryDuration = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        duration: { ...prev.delivery.duration, [key]: value },
      },
    }));
  }, []);

  const toggleFeature = useCallback((feature) => {
    setForm(prev => {
      const features = prev.attributes.features || [];
      const exists = features.includes(feature);
      return {
        ...prev,
        attributes: {
          ...prev.attributes,
          features: exists
            ? features.filter(f => f !== feature)
            : [...features, feature],
        },
      };
    });
  }, []);

  // Validation
  const validateForm = useCallback(() => {
    if (form.title.length < 10) return "Title must be at least 10 characters";
    if (form.description.length < 20) return "Description must be at least 20 characters";
    if (!form.price || Number(form.price) <= 0) return "Please enter a valid price";
    if (!form.category_id) return "Please select a category";
    if (!form.contact.phone || form.contact.phone.length < 10) return "Please enter a valid phone number";
    if (!form.contact.email || !form.contact.email.includes("@")) return "Please enter a valid email";
    if (images.length === 0) return "Please upload at least 1 image";
    if (!state || !city) return "Please select your state and city";

    if (form.delivery.type !== "none" && form.delivery.type !== "pickup") {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (Number.isNaN(from) || Number.isNaN(to)) return "Please enter delivery duration";
      if (to < from) return "End day must be after start day";
      if (!form.delivery.fee || Number(form.delivery.fee) <= 0) return "Please enter delivery fee";
    }
    return null;
  }, [form, images.length, state, city]);

  // Draft
  const saveDraft = useCallback(() => {
    if (loading) return;
    const draft = { form, state, city };
    localStorage.setItem(STORAGE_DRAFT, JSON.stringify(draft));
  }, [form, state, city, loading]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT);
      if (saved) {
        const draft = JSON.parse(saved);
        setForm(draft.form || INITIAL_FORM);
        setState(draft.state || "");
        setCity(draft.city || "");
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
    setError(""); 
    setSuccess("");
    localStorage.removeItem(STORAGE_DRAFT);
  }, []);

  // Images
  const handleImages = useCallback((files) => {
    if (images.length >= MAX_IMAGES) {
      showError("Maximum 6 images allowed");
      return;
    }
    const fileArray = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    const validFiles = fileArray
      .filter(f => f.type.startsWith("image/") && f.size <= MAX_SIZE)
      .slice(0, remaining);

    const generateId = () =>
      crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

    const newImages = validFiles.map(file => ({
      id: generateId(),
      file, 
      preview: URL.createObjectURL(file),
    }));

    setImages(prev => [...prev, ...newImages]);
  }, [images.length, showError]);

  const removeImage = useCallback((id) => {
    setImages(prev => {
      const target = prev.find(x => x.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter(x => x.id !== id);
    });
  }, []);

  const handleDrop = useCallback((e, index) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData("index"));
    setImages(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(index, 0, moved);
      return copy;
    });
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e, index) => {
    const timer = setTimeout(() => {
      e.preventDefault();
      setIsDragging(true);
      if (e.dataTransfer) e.dataTransfer.setData("index", index);
    }, 500);
    e.currentTarget.dataset.timer = String(timer);
  }, []);

  const handleLongPressEnd = useCallback((e) => {
    const timerId = e.currentTarget?.dataset.timer;
    if (timerId) {
      clearTimeout(Number(timerId));
      delete e.currentTarget.dataset.timer;
    }
    setIsDragging(false);
  }, []);

  // API
  const createProductDraft = async () => {
    const fd = new FormData();
    const payload = {
      title: form.title, 
      description: form.description,
      price: Number(form.price), 
      category_id: form.category_id,
      subcategory_id: form.attributes.subcategory || null,
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state, 
      location_city: city,
    };

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        fd.append(key, String(value));
      }
    });

    const imageFiles = images.map(img => img.file).filter(Boolean);
    const compressedFiles = await Promise.all(
      imageFiles.map(async (file) => {
        try {
          const compressed = await compressImage(file);
          return new File([compressed], file.name, { type: compressed.type });
        } catch {
          return file;
        }
      })
    );

    compressedFiles.forEach((file) => fd.append("images", file));

    const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", {
      method: "POST", 
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text || "{}"); } catch {}
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    return (await res.json()).product;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const product = await createProductDraft();
      if (!product?.id) {
        throw new Error("Failed to create product");
      }

      showSuccess("✅ Product created successfully!");
      clearDraft();
      setTimeout(() => window.location.href = "/", 2000);

    } catch (err) {
      console.error("Submit error:", err);
      showError(err.message || "Failed to create product.");
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => loadDraft(), []);
  
  useEffect(() => {
    if (!loading) {
      const timeout = setTimeout(saveDraft, 1000);
      return () => clearTimeout(timeout);
    }
  }, [form, state, city, images.length, loading]);

  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then(r => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedCategory?.dynamicOptions?.fields?.length) return;
    setForm(prev => {
      const newAttrs = { ...prev.attributes };
      selectedCategory.dynamicOptions.fields.forEach(f => {
        if (newAttrs[f] === undefined) {
          newAttrs[f] = f === "features" ? [] : "";
        }
      });
      return { ...prev, attributes: newAttrs };
    });
  }, [form.category_id, selectedCategory?.dynamicOptions?.fields]);

  useEffect(() => {
    return () => {
      images.forEach(img => img.preview && URL.revokeObjectURL(img.preview));
    };
  }, [images]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setActiveImage(null);
    };
    if (activeImage) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [activeImage]);

  // Render data
  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] : [];

  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" onClearDraft={clearDraft} />

      {/* BASIC INFO */}
      <section className="section form-card">
        <h3 className="section-title">Basic Information</h3>
        <div className="form-group">
          <label>Product Title <span className="required">*</span></label>
          <input
            placeholder="Enter product title"
            value={form.title}
            onChange={e => updateForm("title", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Description <span className="required">*</span></label>
          <textarea
            placeholder="Detailed product description"
            value={form.description}
            onChange={e => updateForm("description", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Price (₦) <span className="required">*</span></label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="10000"
            value={displayPrice(form.price)}
            onChange={e => updateForm("price", onlyNumbers(e.target.value))}
          />
        </div>
      </section>

      {/* PRODUCT DETAILS */}
      <section className="section form-card">
        <h3 className="section-title">Product Details</h3>
        <div className="form-group">
          <label>Category <span className="required">*</span></label>
          <DropdownModal
            value={form.category_id}
            onChange={(v) =>
              setForm(prev => ({
                ...prev,
                category_id: v,
                attributes: INITIAL_FORM.attributes,
              }))
            }
            options={categories.map(c => ({ id: c.id, name: c.name }))}
          />
        </div>

        {fields.map(field => {
          if (!optionsMap[field] && field !== "features") return null;
          if (field === "used_detail" && form.attributes.condition !== "Used") return null;

          return (
            <div key={field} className="form-group">
              <label>{formatLabel(field)}</label>
              <DropdownModal
                value={form.attributes[field] || ""}
                onChange={v => updateAttribute(field, v)}
                options={optionsMap[field]}
              />
            </div>
          );
        })}

        {sortedFeatures.length > 0 && (
          <div className="form-group">
            <label>Features</label>
            <div className="checkbox-grid-inline">
              {sortedFeatures.map(feature => (
                <label key={feature} className="checkbox-inline">
                  <span>{formatLabel(feature)}</span>
                  <input
                    type="checkbox"
                    checked={(form.attributes.features || []).includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CONTACT */}
      <section className="section form-card">
        <h3 className="section-title">Contact Information</h3>
        <div className="form-group">
          <label>Email <span className="required">*</span></label>
          <input
            type="email"
            placeholder="your@email.com"
            value={form.contact.email}
            onChange={e => updateContact("email", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Phone <span className="required">*</span></label>
          <input
            type="text"
            inputMode="tel"
            placeholder="08012345678"
            value={form.contact.phone}
            onChange={e => updateContact("phone", onlyDigits(e.target.value))}
          />
        </div>
      </section>

      {/* LOCATION & DELIVERY */}
      <section className="section form-card">
        <h3 className="section-title">Location & Delivery</h3>
        <div className="form-group">
          <label>State <span className="required">*</span></label>
          <DropdownModal
            value={state}
            onChange={setState}
            options={states.map(s => ({ id: s, name: s }))}
          />
        </div>
        {state && (
          <div className="form-group">
            <label>City <span className="required">*</span></label>
            <DropdownModal
              value={city}
              onChange={setCity}
              options={cities.map(c => ({ id: c, name: c }))}
            />
          </div>
        )}

        <div className="form-group">
          <label>Delivery Type</label>
          <DropdownModal
            value={form.delivery.type}
            onChange={v => updateDelivery("type", v)}
            options={[
              { id: "none", name: "No delivery" },
              { id: "standard", name: "Standard delivery" },
              { id: "express", name: "Express delivery" },
              { id: "pickup", name: "Pickup only" },
            ]}
          />
        </div>

        {form.delivery.type !== "none" && form.delivery.type !== "pickup" && (
          <div className="delivery-grid sub-grid">
            <div className="form-group">
              <label>From (days) <span className="required">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                min="1"
                value={form.delivery.duration.from}
                onChange={e => updateDeliveryDuration("from", onlyDigits(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>To (days) <span className="required">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                min="1"
                value={form.delivery.duration.to}
                onChange={e => updateDeliveryDuration("to", onlyDigits(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Fee (₦) <span className="required">*</span></label>
              <input
                type="text"
                inputMode="numeric"
                value={displayPrice(form.delivery.fee)}
                onChange={e => updateDelivery("fee", onlyNumbers(e.target.value))}
              />
            </div>
          </div>
        )}
      </section>

      {/* IMAGES */}
      <section className="section form-card">
        <h3 className="section-title">Product Images</h3>
        <label className="form-group-label">
          Product Images (max 6, 3MB each) <span className="required">*</span>
        </label>
        <div className="preview-grid-modern image-upload-box">
          {images.map((img, i) => (
            <div
              key={img.id}
              className={`preview-thumb ${isDragging ? "dragging" : ""}`}
              draggable
              onClick={() => setActiveImage(img.preview)}
              onDragStart={e => e.dataTransfer.setData("index", i)}
              onDragOver={e => e.preventDefault()}
              onDragEnd={() => setIsDragging(false)}
              onDrop={e => handleDrop(e, i)}
              onTouchStart={e => handleTouchStart(e, i)}
              onTouchEnd={handleLongPressEnd}
              onMouseDown={e => handleTouchStart(e, i)}
              onMouseUp={handleLongPressEnd}
            >
              <img src={img.preview} alt="" />
              <button
                onClick={e => {
                  e.stopPropagation();
                  removeImage(img.id);
                }}
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
                onChange={e => {
                  handleImages(e.target.files);
                  e.target.value = "";
                }}
              />
              <div>+</div>
              <span>Add Image</span>
            </label>
          )}
        </div>
        {images.length > 0 && (
          <small className="price-preview">{images.length}/6 images</small>
        )}
      </section>

      {/* CREATE BUTTON */}
      <div className="button-section section form-card">
        <button
          type="button"
          className="primary-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Product"}
        </button>
      </div>

      {/* MESSAGES */}
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

      {/* MODALS */}
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