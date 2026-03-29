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
    // 1. Get signature
    const sigRes = await fetch(`${API_BASE}/cloudinary-signature`);
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
      return { url: data.secure_url, position: Date.now() }; // temp position
    }
    throw new Error("Upload failed");
  }, []);

  const handleImages = async (files) => {
    const raw = Array.from(files);
    if (images.length + raw.length > activeRule.maxImages)
      return setError(`Max ${activeRule.maxImages} images`);

    for (let f of raw) {
      if (f.size > activeRule.maxImageSizeMB * 1024 * 1024)
        return setError(`Image must be < ${activeRule.maxImageSizeMB}MB`);
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
    if (form.title.trim().length < activeRule.minTitle)
      return `Title must be at least ${activeRule.minTitle} characters`;
    if (form.description.trim().length < activeRule.minDescription)
      return `Description must be at least ${activeRule.minDescription} characters`;
    if (!form.price || !onlyNumbers(form.price)) return "Valid price required";
    if (!form.category_id) return "Select category";
    if (!form.contact.phone || form.contact.phone.length < 10)
      return "Valid phone required";
    if (!form.attributes.condition) return "Select condition";
    if (images.length < activeRule.minImages)
      return `Upload at least ${activeRule.minImages} images`;
    if (images.length > activeRule.maxImages)
      return `Max ${activeRule.maxImages} images allowed`;

    if (form.delivery.available) {
      if (form.delivery.duration.from === 0 || form.delivery.duration.to === 0)
        return "Enter delivery days";
      if (form.delivery.duration.from > form.delivery.duration.to)
        return "Invalid delivery range";
    }

    return null;
  }, [form, images.length, activeRule]);

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
      return setError("Duplicate listing detected");

    setLoading(true);
    setError(null);

    try {
      // 1. Upload images first
      const imageUrls = await uploadAllImages();

      // 2. Create product
      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: onlyNumbers(form.price),
          category_id: form.category_id,
          subcategory_id: form.subcategory_id || null,
          attributes: form.attributes,
          delivery: form.delivery,
          contact: form.contact,
          promotion_id: form.promotion_id || null,
          location_state: state,
          location_city: city,
          image_urls, // ✅ Backend expects this format
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create product");
      }

      localStorage.setItem("last_hash", hash);
      localStorage.removeItem("draft_product");
      alert("✅ Product created successfully!");
      
      // Reset form
      setForm(INITIAL_FORM);
      setImages([]);
      setPreviews([]);
      setState("");
      setCity("");
      navigate("/marketplace");
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= TOGGLE FEATURE ================= */
  const toggleFeature = useCallback((f) => {
    setForm((p) => {
      const list = p.attributes.features || [];
      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: list.includes(f)
            ? list.filter((x) => x !== f)
            : [...list, f],
        },
      };
    });
  }, []);

  /* ================= JSX ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />
      {loading && (
        <div className="upload-overlay">
          <div className="upload-box">
            <h2>{uploadingImages ? "Uploading images..." : "Creating product..."}</h2>
            <div className="progress-bar">
              <div style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* FORM FIELDS */}
      <input
        placeholder="Product title *"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <textarea
        placeholder="Description *"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <input
        placeholder="Price (₦) *"
        value={form.price}
        onChange={(e) =>
          setForm({ ...form, price: formatPrice(e.target.value) })
        }
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
      <select value={state} onChange={(e) => setState(e.target.value)}>
        <option value="">Select State</option>
        {Object.keys(locationsByState).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {state && (
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={!state}
        >
          <option value="">Select City</option>
          {locationsByState[state]?.map((c) => (
            <option key={c} value={c}>
              {c}
          </option>
          ))}
        </select>
      )}

      {/* FEATURES */}
      {options.features?.length > 0 && (
        <div className="form-section">
          <h3>Features</h3>
          <div className="checkbox-grid">
            {options.features.map((f) => (
              <label key={f}>
                <input
                  type="checkbox"
                  checked={form.attributes.features.includes(f)}
                  onChange={() => toggleFeature(f)}
                />
                {f}
              </label>
            ))}
          </div>
        </div>
      )}

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
          <>
            <input
              placeholder="From days"
              type="number"
              value={form.delivery.duration.from}
              onChange={(e) =>
                setForm({
                  ...form,
                  delivery: {
                    ...form.delivery,
                    duration: {
                      ...form.delivery.duration,
                      from: +e.target.value,
                    },
                  },
                })
              }
              min="0"
            />
            <input
              placeholder="To days"
              type="number"
              value={form.delivery.duration.to}
              onChange={(e) =>
                setForm({
                  ...form,
                  delivery: {
                    ...form.delivery,
                    duration: {
                      ...form.delivery.duration,
                      to: +e.target.value,
                    },
                  },
                })
              }
              min="1"
            />
            <input
              placeholder="Fee (₦)"
              value={form.delivery.fee}
              onChange={(e) =>
                setForm({
                  ...form,
                  delivery: {
                    ...form.delivery,
                    fee: formatPrice(e.target.value),
                  },
                })
              }
            />
          </>
        )}
      </div>

      {/* IMAGES */}
      <label className="add-image-btn">
        + Add Images ({images.length}/{activeRule.maxImages})
        <input
          type="file"
          multiple
          accept="image/*"
          hidden
          onChange={(e) => handleImages(e.target.files)}
          disabled={uploadingImages}
        />
      </label>

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i} className="preview-item">
            <img src={src} alt={`Preview ${i}`} />
            <button onClick={() => removeImage(i)}>×</button>
          </div>
        ))}
      </div>

      {/* ERROR */}
      {error && <div className="error-box">{error}</div>}

      {/* SUBMIT */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || loading || uploadingImages}
        className="submit-btn"
      >
        {loading
          ? uploadingImages
            ? "Uploading images..."
            : "Creating product..."
          : "Create Product"}
      </button>
    </div>
  );
}