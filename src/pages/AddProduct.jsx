import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { categoryRules } from "../config/categoryRules.js";
import { locationsByState } from "../config/locationsByState.js";
import "./AddProduct.css";

/* ================= CLOUDINARY ================= */
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/YOUR_CLOUD/upload";
const CLOUDINARY_PRESET = "YOUR_UPLOAD_PRESET";

/* ================= INITIAL STATE ================= */
const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",

  attributes: {
    features: [],
    condition: "",
  },

  delivery: {
    available: true,
    from_days: "",
    to_days: "",
    fee: "",
    note: "",
  },

  contact: {
    phone: "",
    whatsapp: "",
    preferred: "chat",
  },
};

/* ================= HELPERS ================= */
const onlyNumbers = (v) => v.replace(/[^\d]/g, "");

const formatPrice = (v) => {
  const num = v.replace(/[^\d]/g, "");
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name, { type: "image/jpeg" }));
      }, "image/jpeg", 0.7);
    };

    reader.readAsDataURL(file);
  });

export default function AddProduct() {
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isValid, setIsValid] = useState(false);

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  /* ================= FETCH ================= */
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (c) => String(c.id) === String(form.category_id)
      ),
    [categories, form.category_id]
  );

  const activeRule = useMemo(() => {
    const name = selectedCategory?.name;
    return categoryRules[name] || categoryRules.default;
  }, [selectedCategory]);

  const options = selectedCategory?.dynamicOptions || {};

  /* ================= AUTO SAVE ================= */
  useEffect(() => {
    const saved = localStorage.getItem("draft_product");
    if (saved) setForm(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("draft_product", JSON.stringify(form));
  }, [form]);

  /* ================= FEATURES ================= */
  const toggleFeature = (f) => {
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
  };

  /* ================= IMAGE HANDLING ================= */
  const handleImages = async (files) => {
    const raw = Array.from(files);

    if (images.length + raw.length > activeRule.maxImages)
      return alert(`Max ${activeRule.maxImages} images`);

    for (let f of raw) {
      if (f.size > activeRule.maxImageSizeMB * 1024 * 1024)
        return alert(`Image must be < ${activeRule.maxImageSizeMB}MB`);
    }

    const compressed = await Promise.all(raw.map(compressImage));

    setImages((p) => [...p, ...compressed]);
    setPreviews((p) => [
      ...p,
      ...compressed.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const removeImage = (i) => {
    setImages((p) => p.filter((_, x) => x !== i));
    setPreviews((p) => p.filter((_, x) => x !== i));
  };

  /* ================= DUPLICATE ================= */
  const generateHash = () =>
    `${form.title}-${form.price}-${form.category_id}`.toLowerCase();

  const isDuplicate = () =>
    localStorage.getItem("last_hash") === generateHash();

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (form.title.trim().length < activeRule.minTitle)
      return `Title must be at least ${activeRule.minTitle} characters`;

    if (form.description.trim().length < activeRule.minDescription)
      return `Description must be at least ${activeRule.minDescription} characters`;

    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";

    if (!form.contact.phone || form.contact.phone.length < 10)
      return "Valid phone required";

    if (!form.attributes.condition)
      return "Select condition";

    if (images.length > activeRule.maxImages)
      return `Max ${activeRule.maxImages} images allowed`;

    if (
      activeRule.minImages > 0 &&
      images.length < activeRule.minImages
    )
      return `Upload at least ${activeRule.minImages} images`;

    for (let img of images) {
      if (img.size > activeRule.maxImageSizeMB * 1024 * 1024)
        return `Each image must be < ${activeRule.maxImageSizeMB}MB`;
    }

    if (form.delivery.available) {
      if (!form.delivery.from_days || !form.delivery.to_days)
        return "Enter delivery days";

      if (+form.delivery.from_days > +form.delivery.to_days)
        return "Invalid delivery range";
    }

    return null;
  };

  useEffect(() => {
    const result = validate();
    setError(result);
    setIsValid(!result);
  }, [form, images, selectedCategory]);

  /* ================= UPLOAD ================= */
  const uploadImages = async () => {
    const urls = [];

    for (let i = 0; i < images.length; i++) {
      const fd = new FormData();
      fd.append("file", images[i]);
      fd.append("upload_preset", CLOUDINARY_PRESET);

      const res = await fetch(CLOUDINARY_URL, {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      urls.push(data.secure_url);

      setProgress(Math.round(((i + 1) / images.length) * 100));
    }

    return urls;
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) return alert(validationError);

    if (isDuplicate()) return alert("Duplicate listing detected");

    setLoading(true);

    try {
      const imageUrls = await uploadImages();

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            price: onlyNumbers(form.price),
            delivery: {
              ...form.delivery,
              fee: onlyNumbers(form.delivery.fee),
            },
            images: imageUrls,
            location_state: state,
            location_city: city,
          }),
        }
      );

      if (!res.ok) throw new Error();

      localStorage.setItem("last_hash", generateHash());
      localStorage.removeItem("draft_product");

      alert("Uploaded successfully");

      setForm(INITIAL_FORM);
      setImages([]);
      setPreviews([]);
    } catch {
      alert("Upload failed");
    }

    setLoading(false);
  };

  /* ================= UI ================= */
  return (
    <div className="add-product-container">

      <AddProductHeader title="Add Product" />

      {/* FULL SCREEN UPLOAD */}
      {loading && (
        <div className="upload-overlay">
          <div className="upload-box">
            <h2>Uploading...</h2>
            <div className="progress-bar">
              <div style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      <input
        placeholder="Title"
        value={form.title}
        onChange={(e) =>
          setForm({ ...form, title: e.target.value })
        }
      />

      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) =>
          setForm({ ...form, description: e.target.value })
        }
      />

      <input
        placeholder="Price"
        value={form.price}
        onChange={(e) =>
          setForm({
            ...form,
            price: formatPrice(e.target.value),
          })
        }
      />

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

        <input
          placeholder="From days"
          value={form.delivery.from_days}
          onChange={(e) =>
            setForm({
              ...form,
              delivery: {
                ...form.delivery,
                from_days: e.target.value,
              },
            })
          }
        />

        <input
          placeholder="To days"
          value={form.delivery.to_days}
          onChange={(e) =>
            setForm({
              ...form,
              delivery: {
                ...form.delivery,
                to_days: e.target.value,
              },
            })
          }
        />

        <input
          placeholder="Fee"
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
      </div>

      {/* IMAGES */}
      <label className="add-image-btn">
        + Add Images
        <input
          type="file"
          multiple
          hidden
          onChange={(e) => handleImages(e.target.files)}
        />
      </label>

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i}>
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>×</button>
          </div>
        ))}
      </div>

      {/* ERROR */}
      {error && <div className="error-box">{error}</div>}

      <button onClick={handleSubmit} disabled={!isValid || loading}>
        {loading ? "Uploading..." : "Create Product"}
      </button>
    </div>
  );
}