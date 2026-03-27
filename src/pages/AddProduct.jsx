import { useEffect, useMemo, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
import imageCompression from "browser-image-compression";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",
  subcategory_id: "",
  attributes: {},
  delivery: {
    available: true,
    type: "fixed",
    fee: 0,
    radius_km: 0,
    estimated_days: "1-3",
    note: "",
  },
  contact: {
    phone: "",
    whatsapp: "",
    preferred: "chat",
  },
};

export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/categories"
        );
        const data = await res.json();
        setCategories(data || []);
      } catch (err) {
        console.error("Category load failed:", err);
      }
    };

    load();
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const dynamicFields = useMemo(
    () => selectedCategory?.dynamicOptions?.fields || [],
    [selectedCategory]
  );

  const options = selectedCategory?.dynamicOptions || {};

  const brand = form.attributes?.brand;

  const optionsMap = useMemo(
    () => ({
      brand: options.brands || [],
      model: options.models?.[brand] || [],
      color: options.colors || [],
      condition: options.conditions || [],
      used_detail: options.usedDetails || [],
      ram: options.ram || [],
      storage: options.storage || [],
      sim: options.sims || [],
      features: options.features || [],
      year: options.years || [],
      engine: options.engines || [],
      fuel_type: options.fuel_types || [],
    }),
    [options, brand]
  );

  /* ================= HELPERS ================= */
  const updateForm = (key, value) =>
    setForm((p) => ({ ...p, [key]: value }));

  const updateAttr = (key, value) =>
    setForm((p) => ({
      ...p,
      attributes: { ...p.attributes, [key]: value },
    }));

  const updateDelivery = (key, value) =>
    setForm((p) => ({
      ...p,
      delivery: { ...p.delivery, [key]: value },
    }));

  const states = Object.keys(locationsByState || {});
  const cities = state ? locationsByState[state] || [] : [];

  /* ================= IMAGE HANDLING ================= */

  const compressImages = async (files) => {
    const config = {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    const list = Array.from(files).slice(0, 8);
    const result = [];

    for (const file of list) {
      await new Promise((r) => setTimeout(r, 0)); // keep UI responsive
      result.push(await imageCompression(file, config));
    }

    return result;
  };

  const handleImages = async (files) => {
    const rawFiles = Array.from(files).slice(0, 8);

    // ⚡ instant preview (no waiting)
    const previewUrls = rawFiles.map((file) =>
      URL.createObjectURL(file)
    );

    setPreviews(previewUrls);

    // compress in background
    const compressed = await compressImages(rawFiles);
    setImages(compressed);
  };

  const removeImage = (index) => {
    setImages((p) => p.filter((_, i) => i !== index));

    setPreviews((p) => {
      URL.revokeObjectURL(p[index]);
      return p.filter((_, i) => i !== index);
    });
  };

  /* ================= VALIDATION ================= */
  const validate = () => {
    if (!form.title.trim()) return "Title is required";
    if (!form.price) return "Price is required";
    if (!form.category_id) return "Category is required";
    return null;
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const error = validate();
    if (error) return alert(error);

    const fd = new FormData();

    const payload = {
      title: form.title,
      description: form.description,
      price: form.price,
      category_id: form.category_id,
      subcategory_id: form.subcategory_id,
      attributes: JSON.stringify(form.attributes),
      delivery: JSON.stringify(form.delivery),
      contact: JSON.stringify(form.contact),
      location_state: state,
      location_city: city,
    };

    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));

    images.forEach((img) => fd.append("images", img));

    try {
      setLoading(true);
      setProgress(0);

      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        "https://minimart-ivrm.onrender.com/api/marketplace/products"
      );

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setLoading(false);

        if (xhr.status >= 200 && xhr.status < 300) {
          setForm(INITIAL_FORM);
          setImages([]);
          setPreviews([]);
          setState("");
          setCity("");
          setProgress(0);

          alert("Product created 🚀");
        } else {
          alert("Upload failed");
        }
      };

      xhr.onerror = () => {
        setLoading(false);
        alert("Network error");
      };

      xhr.send(fd);
    } catch (err) {
      setLoading(false);
      console.error(err);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="add-product">
      <h2>Add Product</h2>

      {loading && (
        <div className="progress">
          <div style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}

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
        onChange={(e) => updateForm("price", e.target.value)}
      />

      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) => updateForm("category_id", v)}
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

      {dynamicFields.map((field) => (
        <DropdownModal
          key={field}
          label={field}
          value={form.attributes[field] || ""}
          onChange={(v) => updateAttr(field, v)}
          options={optionsMap[field] || []}
        />
      ))}

      <DropdownModal
        label="State"
        value={state}
        onChange={setState}
        options={states}
      />

      {state && (
        <DropdownModal
          label="City"
          value={city}
          onChange={setCity}
          options={cities}
        />
      )}

      <h3>Delivery</h3>

      <label>
        <input
          type="checkbox"
          checked={form.delivery.available}
          onChange={(e) =>
            updateDelivery("available", e.target.checked)
          }
        />
        Available
      </label>

      {form.delivery.available && (
        <>
          <DropdownModal
            label="Type"
            value={form.delivery.type}
            onChange={(v) => updateDelivery("type", v)}
            options={["fixed", "free", "negotiable"]}
          />

          {form.delivery.type === "fixed" && (
            <input
              placeholder="Fee"
              value={form.delivery.fee}
              onChange={(e) =>
                updateDelivery("fee", e.target.value)
              }
            />
          )}

          <input
            placeholder="Radius km"
            value={form.delivery.radius_km}
            onChange={(e) =>
              updateDelivery("radius_km", e.target.value)
            }
          />
        </>
      )}

      <input
        placeholder="Phone"
        value={form.contact.phone}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            contact: { ...p.contact, phone: e.target.value },
          }))
        }
      />

      <input
        placeholder="WhatsApp"
        value={form.contact.whatsapp}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            contact: { ...p.contact, whatsapp: e.target.value },
          }))
        }
      />

      <input
        type="file"
        multiple
        onChange={(e) => handleImages(e.target.files)}
      />

      <div className="preview">
        {previews.map((src, i) => (
          <div key={i}>
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>X</button>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Create Product"}
      </button>
    </div>
  );
}