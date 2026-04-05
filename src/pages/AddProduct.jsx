import { useEffect, useState, useRef } from "react";
import imageCompression from "browser-image-compression";

import { brands } from "../config/brands.js";
import { colors } from "../config/colors.js";
import { categoryFields } from "../config/categoryFields.js";
import { conditions, usedDetails } from "../config/conditions.js";
import { featuresByCategory } from "../config/featuresByCategory.js";
import { models } from "../config/models.js";
import { ramOptions } from "../config/ramOptions.js";
import { sims } from "../config/sims.js";
import { storageOptions } from "../config/storageOptions.js";
import { years } from "../config/years.js";
import { engines } from "../config/engines.js";
import { fuelTypes } from "../config/fuelTypes.js";
import { locationsByState } from "../config/locationsByState.js";
import { fieldOptions } from "../config/fieldOptions.js";

const STORAGE_KEY = "product_draft_v2";

export default function AddProduct({ user }) {
  const fileRef = useRef();

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category_id: "",
    subcategory_id: "",
    attributes: {},
    location_state: "",
    location_city: "",
    delivery: { duration: "", fee: "" },
    contact: { email: "", phone: "" }
  });

  const [images, setImages] = useState([]);

  // ================= LOAD DRAFT =================
  useEffect(() => {
    const draft = localStorage.getItem(STORAGE_KEY);
    if (draft) {
      const parsed = JSON.parse(draft);
      setForm(parsed.form || {});
      setImages(parsed.images || []);
    }
  }, []);

  // ================= AUTO SAVE =================
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, images }));
  }, [form, images]);

  // ================= INPUT =================
  const update = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const updateNested = (section, key, value) => {
    setForm(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }));
  };

  const updateAttr = (key, value) => {
    setForm(prev => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: value }
    }));
  };

  // ================= DYNAMIC FIELDS =================
  const dynamicFields = categoryFields[form.category_id] || [];

  const getOptions = (field) => {
    if (field === "brand") return brands;
    if (field === "model") return models[form.attributes.brand] || [];
    if (field === "color") return colors;
    if (field === "ram") return ramOptions;
    if (field === "storage") return storageOptions;
    if (field === "sim") return sims;
    if (field === "year") return years;
    if (field === "engine") return engines;
    if (field === "fuel") return fuelTypes;
    return fieldOptions[field] || [];
  };

  // ================= IMAGES =================
  const handleImages = async (files) => {
    const list = Array.from(files).slice(0, 6 - images.length);

    const compressed = await Promise.all(
      list.map(file =>
        imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1024 })
      )
    );

    const mapped = compressed.map((file, i) => ({
      file,
      url: URL.createObjectURL(file),
      position: images.length + i
    }));

    setImages(prev => [...prev, ...mapped]);
  };

  const removeImage = (index) => {
    const updated = images.filter((_, i) => i !== index)
      .map((img, i) => ({ ...img, position: i }));
    setImages(updated);
  };

  // ================= DRAG =================
  const dragItem = useRef();
  const dragOverItem = useRef();

  const handleSort = () => {
    const copy = [...images];
    const dragged = copy.splice(dragItem.current, 1)[0];
    copy.splice(dragOverItem.current, 0, dragged);

    const updated = copy.map((img, i) => ({ ...img, position: i }));
    setImages(updated);
  };

  // ================= VALIDATION =================
  const validate = () => {
    if (!form.title || !form.price || !form.category_id) {
      alert("Missing required fields");
      return false;
    }

    if (form.contact.email &&
      !/^[^@]+@[^@]+\.[^@]+$/.test(form.contact.email)) {
      alert("Invalid email");
      return false;
    }

    if (form.contact.phone &&
      !/^\d{10,15}$/.test(form.contact.phone)) {
      alert("Invalid phone");
      return false;
    }

    return true;
  };

  // ================= SUBMIT =================
  const submit = async () => {
    if (!validate()) return;

    setLoading(true);

    const fd = new FormData();

    Object.entries(form).forEach(([k, v]) => {
      if (typeof v === "object") {
        fd.append(k, JSON.stringify(v));
      } else {
        fd.append(k, v);
      }
    });

    fd.append("user_id", user?.id);

    images.forEach(img => fd.append("images", img.file));

    try {
      const res = await fetch("/api/marketplace/products", {
        method: "POST",
        body: fd
      });

      if (!res.ok) throw new Error();

      localStorage.removeItem(STORAGE_KEY);
      alert("Product created");

    } catch {
      alert("Failed to submit");

    } finally {
      setLoading(false);
    }
  };

  // ================= LOCATION =================
  const cities = locationsByState[form.location_state] || [];

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">

      <h2 className="text-xl font-bold">Add Product</h2>

      <input placeholder="Title"
        value={form.title}
        onChange={e => update("title", e.target.value)} />

      <textarea placeholder="Description"
        value={form.description}
        onChange={e => update("description", e.target.value)} />

      <input placeholder="Price"
        value={form.price}
        onChange={e => update("price", e.target.value)} />

      {/* CATEGORY */}
      <select onChange={e => update("category_id", e.target.value)}>
        <option value="">Select Category</option>
        {Object.keys(categoryFields).map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* DYNAMIC */}
      {dynamicFields.map(field => (
        <select key={field}
          value={form.attributes[field] || ""}
          onChange={e => updateAttr(field, e.target.value)}>
          <option value="">Select {field}</option>
          {getOptions(field).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ))}

      {/* LOCATION */}
      <select onChange={e => update("location_state", e.target.value)}>
        <option>Select State</option>
        {Object.keys(locationsByState).map(s => (
          <option key={s}>{s}</option>
        ))}
      </select>

      <select onChange={e => update("location_city", e.target.value)}>
        <option>Select City</option>
        {cities.map(c => <option key={c}>{c}</option>)}
      </select>

      {/* DELIVERY */}
      <input placeholder="Delivery Duration"
        onChange={e => updateNested("delivery", "duration", e.target.value)} />

      <input placeholder="Delivery Fee"
        onChange={e => updateNested("delivery", "fee", e.target.value)} />

      {/* CONTACT */}
      <input placeholder="Email"
        onChange={e => updateNested("contact", "email", e.target.value)} />

      <input placeholder="Phone"
        onChange={e => updateNested("contact", "phone", e.target.value)} />

      {/* IMAGES */}
      <div className="border p-3">
        <button onClick={() => fileRef.current.click()}>Upload Images</button>
        <input type="file" hidden multiple ref={fileRef}
          onChange={e => handleImages(e.target.files)} />

        <div className="grid grid-cols-3 gap-2 mt-2">
          {images.map((img, i) => (
            <div key={i}
              draggable
              onDragStart={() => dragItem.current = i}
              onDragEnter={() => dragOverItem.current = i}
              onDragEnd={handleSort}
              className="relative">

              <img src={img.url}
                onClick={() => setPreview(img.url)}
                className="h-24 w-full object-cover" />

              <button onClick={() => removeImage(i)}
                className="absolute top-0 right-0 bg-black text-white px-1">x</button>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center">
          <img src={preview} className="max-h-[90%]" />
          <button onClick={() => setPreview(null)}>Close</button>
        </div>
      )}

      <button onClick={submit} disabled={loading}>
        {loading ? "Submitting..." : "Submit"}
      </button>

    </div>
  );
}