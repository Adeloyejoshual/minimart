import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { categoryRules } from "../config/categoryRules.js";
import { locationsByState } from "../config/locationsByState.js";
import "./AddProduct.css";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

/* ================= INITIAL STATE ================= */
const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  subcategory_id: "",
  attributes: { features: [], condition: "" },
  delivery: {
    available: true,
    duration: { from: 0, to: 0 },
    fee: "",
    type: "optional",
    note: "",
  },
  contact: { phone: "", whatsapp: "", preferred: "chat" },
};

/* ================= HELPERS ================= */
const onlyNumbers = (v) => v.replace(/[^d]/g, "");
const formatPrice = (v) => {
  const num = v.replace(/[^d]/g, "");
  return num.replace(/B(?=(d{3})+(?!d))/g, ",");
};

const compressImage = (file) =>
  new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => (img.src = e.target.result);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 1000;
      let w = img.width;
      let h = img.height;

      if (w > h && w > MAX) {
        h *= MAX / w;
        w = MAX;
      } else if (h > MAX) {
        w *= MAX / h;
        h = MAX;
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: "image/jpeg" })),
        "image/jpeg",
        0.7
      );
    };
    reader.readAsDataURL(file);
  });

export default function AddProduct() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isValid, setIsValid] = useState(false);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [categories, setCategories] = useState([]);

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => setError("Failed to load categories"));
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const activeRule = useMemo(() => {
    const name = selectedCategory?.name;
    return categoryRules[name] || categoryRules.default;
  }, [selectedCategory]);

  const options = selectedCategory?.dynamicOptions || {};

  /* ================= DRAFT SAVE ================= */
  useEffect(() => {
    const saved = localStorage.getItem("draft_product");
    if (saved) setForm(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("draft_product", JSON.stringify(form));
  }, [form]);

  /* ================= IMAGE UPLOAD (SIGNED) ================= */
  const uploadImageToCloudinary = useCallback(async (file) => {
    try {
      // 1. Get signature from backend
      const sigRes = await fetch(`${API_BASE}/cloudinary-signature`);
      if (!sigRes.ok) throw new Error("Failed to get upload signature");
      
      const sig = await sigRes.json();

      // 2. Upload direct to Cloudinary
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.api_key);
      fd.append("timestamp", sig.timestamp);
      fd.append("signature", sig.signature);
      fd.append("folder", "products");

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        { method: "POST", body: fd }
      );

      const data = await res.json();
      if (data.secure_url) {
        return { url: data.secure_url, position: Date.now() };
      }
      throw new Error(data.error?.message || "Upload failed");
    } catch (err) {
      throw new Error(`Image upload failed: ${err.message}`);
    }
  }, []);

  const handleImages = async (files) => {
    const raw = Array.from(files);
    
    if (images.length + raw.length > (activeRule.maxImages || 10))
      return setError(`Max ${activeRule.maxImages || 10} images`);

    for (let f of raw) {
      if (f.size > (activeRule.maxImageSizeMB || 5) * 1024 * 1024)
        return setError(`Image must be < ${(activeRule.maxImageSizeMB || 5)}MB`);
    }

    const compressed = await Promise.all(raw.map(compressImage));
    setImages((p) => [...p, ...compressed]);
    setPreviews((p) => [
      ...p,
      ...compressed.map((f) => URL.createObjectURL(f)),
    ]);
    setError(null);
  };

  const removeImage = (i) => {
    setImages((p) => p.filter((_, x) => x !== i));
    setPreviews((p) => p.filter((_, x) => x !== i));
    // Cleanup URL
    URL.revokeObjectURL(previews[i]);
  };

  /* ================= UPLOAD ALL IMAGES ================= */
  const uploadAllImages = async () => {
    setUploadingImages(true);
    setProgress(0);
    const imageUrls = [];

    try {
      for (let i = 0; i < images.length; i++) {
        const result = await uploadImageToCloudinary(images[i]);
        imageUrls.push(result);
        setProgress(Math.round(((i + 1) / images.length) * 100));
      }
      return imageUrls;
    } finally {
      setUploadingImages(false);
      setProgress(0);
    }
  };

  /* ================= VALIDATION ================= */
  const validate = useCallback(() => {
    if (!form.title?.trim()) return "Title is required";
    if (form.title.trim().length < (activeRule.minTitle || 10))
      return `Title must be at least ${activeRule.minTitle || 10} characters`;
      
    if (form.description.trim().length < (activeRule.minDescription || 20))
      return `Description must be at least ${activeRule.minDescription || 20} characters`;
      
    if (!form.price || !onlyNumbers(form.price)) return "Valid price required";
    if (!form.category_id) return "Select category";
    if (!form.contact?.phone || form.contact.phone.length < 10)
      return "Valid phone number required (10+ digits)";
    if (!form.attributes?.condition) return "Select condition";
      
    const minImages = activeRule.minImages || 1;
    const maxImages = activeRule.maxImages || 10;
      
    if (images.length < minImages) return `Upload at least ${minImages} image(s)`;
    if (images.length > maxImages) return `Max ${maxImages} images allowed`;

    if (form.delivery.available) {
      if (form.delivery.duration.from === 0 || form.delivery.duration.to === 0)
        return "Enter delivery days (From-To)";
      if (form.delivery.duration.from > form.delivery.duration.to)
        return "Delivery 'To' days must be greater than 'From' days";
    }

    if (!state) return "Select your state";
    if (!city) return "Select your city";

    return null;
  }, [form, images.length, state, city, activeRule]);

  useEffect(() => {
    const result = validate();
    setError(result);
    setIsValid(!result);
  }, [validate]);

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) return setError(validationError);

    const hash = `${form.title}-${onlyNumbers(form.price)}-${form.category_id}`.toLowerCase();
    if (localStorage.getItem("last_hash") === hash)
      return setError("Duplicate listing detected - try changing title/price");

    setLoading(true);
    setError(null);

    try {
      // 1. Upload images first
      const imageUrls = await uploadAllImages();

      // 2. Create product with proper image_urls format
      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          price: onlyNumbers(form.price),
          category_id: form.category_id,
          subcategory_id: form.subcategory_id || null,
          attributes: form.attributes,
          delivery: form.delivery,
          contact: form.contact,
          promotion_id: form.promotion_id || null,
          location_state: state,
          location_city: city,
          image_urls, // Backend expects: [{url, position}]
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to create product");
      }

      // Success!
      localStorage.setItem("last_hash", hash);
      localStorage.removeItem("draft_product");
      
      // Cleanup previews
      previews.forEach(URL.revokeObjectURL);
      
      alert("✅ Product created successfully!");
      navigate("/marketplace");
    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || "Upload failed - please try again");
    } finally {
      setLoading(false);
    }
  };

  /* ================= TOGGLE FEATURE ================= */
  const toggleFeature = useCallback((feature) => {
    setForm((prev) => {
      const features = prev.attributes.features || [];
      const newFeatures = features.includes(feature)
        ? features.filter((f) => f !== feature)
        : [...features, feature];
      return {
        ...prev,
        attributes: { ...prev.attributes, features: newFeatures },
      };
    });
  }, []);

  /* ================= CLEANUP ================= */
  useEffect(() => {
    return () => {
      previews.forEach(URL.revokeObjectURL);
    };
  }, []);

  /* ================= JSX ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />
      
      {/* LOADING OVERLAY */}
      {loading && (
        <div className="upload-overlay">
          <div className="upload-box">
            <h2>{uploadingImages ? "Uploading images..." : "Creating product..."}</h2>
            <div className="progress-bar">
              <div style={{ width: `${progress}%` }} />
              <span>{progress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* FORM */}
      <div className="form-grid">
        <input
          placeholder="Product title *"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        
        <textarea
          placeholder="Description *"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows="4"
        />
        
        <input
          placeholder="Price (₦) *"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: formatPrice(e.target.value) })}
        />

        {/* CATEGORIES */}
        <select
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
        >
          <option value="">Select Category *</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* LOCATION */}
        <select 
          value={state} 
          onChange={(e) => {
            setState(e.target.value);
            setCity(""); // Reset city when state changes
          }}
        >
          <option value="">Select State *</option>
          {Object.keys(locationsByState).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        
        {state && (
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Select City *</option>
            {locationsByState[state]?.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {/* DYNAMIC FEATURES */}
        {options.features?.length > 0 && (
          <div className="form-section">
            <h3>Features</h3>
            <div className="checkbox-grid">
              {options.features.map((feature) => (
                <label key={feature}>
                  <input
                    type="checkbox"
                    checked={form.attributes.features?.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  {feature}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* CONTACT */}
        <div className="form-section">
          <h3>Contact</h3>
          <input
            placeholder="Phone *"
            value={form.contact.phone}
            onChange={(e) =>
              setForm({
                ...form,
                contact: { ...form.contact, phone: e.target.value },
              })
            }
          />
          <input
            placeholder="WhatsApp"
            value={form.contact.whatsapp}
            onChange={(e) =>
              setForm({
                ...form,
                contact: { ...form.contact, whatsapp: e.target.value },
              })
            }
          />
        </div>

        {/* DELIVERY */}
        <div className="form-section">
          <h3>Delivery</h3>
          <label>
            <input
              type="checkbox"
              checked={form.delivery.available}
              onChange={(e) =>
                setForm({
                  ...form,
                  delivery: { ...form.delivery, available: e.target.checked },
                })
              }
            />
            Offer delivery
          </label>
          {form.delivery.available && (
            <div className="delivery-grid">
              <input
                placeholder="From days"
                type="number"
                min="0"
                value={form.delivery.duration.from}
                onChange={(e) =>
                  setForm({
                    ...form,
                    delivery: {
                      ...form.delivery,
                      duration: { ...form.delivery.duration, from: +e.target.value },
                    },
                  })
                }
              />
              <input
                placeholder="To days"
                type="number"
                min="1"
                value={form.delivery.duration.to}
                onChange={(e) =>
                  setForm({
                    ...form,
                    delivery: {
                      ...form.delivery,
                      duration: { ...form.delivery.duration, to: +e.target.value },
                    },
                  })
                }
              />
              <input
                placeholder="Fee (₦)"
                value={form.delivery.fee}
                onChange={(e) =>
                  setForm({
                    ...form,
                    delivery: { ...form.delivery, fee: formatPrice(e.target.value) },
                  })
                }
              />
            </div>
          )}
        </div>

        {/* IMAGE UPLOAD */}
        <label className="add-image-btn">
          + Add Images ({images.length}/{activeRule.maxImages || 10})
          <input
            type="file"
            multiple
            accept="image/*"
            hidden
            onChange={(e) => handleImages(e.target.files)}
            disabled={uploadingImages || loading}
          />
        </label>

        <div className="preview-grid">
          {previews.map((src, i) => (
            <div key={i} className="preview-item">
              <img src={src} alt={`Preview ${i + 1}`} />
              <button 
                type="button"
                onClick={() => removeImage(i)}
                disabled={uploadingImages || loading}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* VALIDATION ERROR */}
        {error && (
          <div className="error-box">
            <strong>⚠️ {error}</strong>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={!isValid || loading || uploadingImages}
        >
          {loading
            ? uploadingImages
              ? `Uploading images... ${progress}%`
              : "Creating product..."
            : `Create Product (${images.length} images)`}
        </button>
      </div>
    </div>
  );
}