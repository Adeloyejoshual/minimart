import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dragIndex, setDragIndex] = useState(null);

  const MAX_IMAGES = 6;
  const MAX_SIZE = 3 * 1024 * 1024;

  /* ================= UTILITIES ================= */
  const onlyNumbers = (v = "") => v.replace(/[^\d.]/g, "");
  const onlyDigits = (v = "") => v.replace(/\D/g, "");

  const displayPrice = (v) => {
    const num = Number(v);
    return Number.isNaN(num) || num <= 0 ? "" : new Intl.NumberFormat("en-NG").format(num);
  };

  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 4000);
  };

  const compressImage = async (file) => {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    });
  };

  /* ================= DERIVED ================= */
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id == form.category_id),
    [categories, form.category_id]
  );

  const options = selectedCategory?.dynamicOptions || {};
  const attributes = form.attributes;

  const normalizeOptions = (list = []) =>
    Array.isArray(list)
      ? list.map((x) => (typeof x === "string" ? { id: x, name: x } : x))
      : [];

  const optionsMap = useMemo(() => {
    const map = {};
    Object.keys(options || {}).forEach((key) => {
      if (key === "model") {
        map.model = normalizeOptions(options.model?.[attributes.brand] || []);
      } else {
        map[key] = normalizeOptions(options[key]);
      }
    });
    return map;
  }, [options, attributes.brand]);

  const sortedFeatures = useMemo(
    () => [...(options.features || [])].sort(),
    [options.features]
  );

  const fields = useMemo(() => {
    const dynamic = options.fields || [];
    return dynamic.includes("condition") ? dynamic : ["condition", ...dynamic];
  }, [options]);

  /* ================= UPDATERS ================= */
  const updateForm = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const updateAttribute = (k, v) =>
    setForm((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        [k]: v,
        ...(k === "brand" && { model: "" }),
      },
    }));

  const updateContact = (k, v) =>
    setForm((p) => ({ ...p, contact: { ...p.contact, [k]: v } }));

  const updateDelivery = (k, v) =>
    setForm((p) => ({ ...p, delivery: { ...p.delivery, [k]: v } }));

  const updateDeliveryDuration = (k, v) =>
    setForm((p) => ({
      ...p,
      delivery: {
        ...p.delivery,
        duration: { ...p.delivery.duration, [k]: v },
      },
    }));

  const toggleFeature = (f) =>
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

  /* ================= VALIDATION ================= */
  const validateForm = () => {
    if (form.title.length < 10) return "Title must be at least 10 characters";
    if (form.description.length < 20) return "Description too short";
    if (!form.price || Number(form.price) <= 0) return "Invalid price";
    if (!form.category_id) return "Select category";
    if (!form.contact.phone || form.contact.phone.length < 10) return "Invalid phone";
    if (!form.contact.email.includes("@")) return "Invalid email";
    if (!images.length) return "Upload at least 1 image";
    if (!state || !city) return "Select location";

    if (!["none", "pickup"].includes(form.delivery.type)) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);
      if (isNaN(from) || isNaN(to)) return "Enter delivery duration";
      if (to < from) return "Invalid duration";
      if (!form.delivery.fee) return "Enter delivery fee";
    }
    return null;
  };

  /* ================= IMAGE ================= */
  const handleImages = (files) => {
    if (images.length >= MAX_IMAGES) return showError("Max 6 images");

    const valid = Array.from(files)
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_SIZE)
      .slice(0, MAX_IMAGES - images.length);

    const newImgs = valid.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
    }));

    setImages((p) => [...p, ...newImgs]);
  };

  const removeImage = (id) =>
    setImages((p) => p.filter((x) => x.id !== id));

  const reorderImages = (to) => {
    if (dragIndex === null) return;
    setImages((p) => {
      const copy = [...p];
      const [moved] = copy.splice(dragIndex, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
    setDragIndex(null);
  };

  /* ================= API ================= */
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
    };

    Object.entries(payload).forEach(([k, v]) => {
      if (v !== "" && v !== null) fd.append(k, v);
    });

    const compressed = await Promise.all(
      images.map((img) => compressImage(img.file).catch(() => img.file))
    );

    compressed.forEach((f) => fd.append("images", f));

    const res = await fetch("/api/marketplace/products", {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    return data.product;
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const err = validateForm();
    if (err) return showError(err);

    setLoading(true);

    try {
      const product = await createProductDraft();
      showSuccess("Product created!");
      setForm(INITIAL_FORM);
      setImages([]);
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= EFFECTS ================= */
  useEffect(() => {
    fetch("/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview));
    };
  }, [images]);

  const states = Object.keys(locationsByState);
  const cities = state ? locationsByState[state] : [];

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />

      <input
        placeholder="Title"
        value={form.title}
        onChange={(e) => updateForm("title", e.target.value)}
      />

      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) => updateForm("description", e.target.value)}
      />

      <input
        placeholder="Price"
        value={form.price}
        onChange={(e) => updateForm("price", onlyNumbers(e.target.value))}
      />

      <DropdownModal
        value={form.category_id}
        onChange={(v) => updateForm("category_id", v)}
        options={categories.map((c) => ({ id: c.id, name: c.name }))}
      />

      <DropdownModal
        value={state}
        onChange={setState}
        options={states.map((s) => ({ id: s, name: s }))}
      />

      <DropdownModal
        value={city}
        onChange={setCity}
        options={cities.map((c) => ({ id: c, name: c }))}
      />

      <div className="image-upload">
        {images.map((img, i) => (
          <div
            key={img.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDrop={() => reorderImages(i)}
            onDragOver={(e) => e.preventDefault()}
          >
            <img src={img.preview} alt="" />
            <button onClick={() => removeImage(img.id)}>✕</button>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <input
            type="file"
            multiple
            onChange={(e) => handleImages(e.target.files)}
          />
        )}
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Processing..." : "Create Product"}
      </button>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}
    </div>
  );
}