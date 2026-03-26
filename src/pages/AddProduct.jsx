import { useEffect, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans, getActivePrice, getDiscountPercent } from "../config/promotions.js";
import imageCompression from "browser-image-compression";

export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category_id: "",
    subcategory_id: "",
    promotion_id: "",

    attributes: {},

    delivery: {
      available: true,
      type: "fixed",
      note: ""
    },

    contact: {
      phone: "",
      whatsapp: "",
      preferred: "chat"
    },

    negotiable: false,
  });

  const states = Object.keys(locationsByState || []);
  const cities = state ? locationsByState[state] : [];

  // ---------------- LOAD CATEGORIES ----------------
  useEffect(() => {
    (async () => {
      const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories");
      const data = await res.json();
      setCategories(data || []);
    })();
  }, []);

  const selectedCategory = categories.find(c => c.id === form.category_id);
  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
  const options = selectedCategory?.dynamicOptions || {};

  const optionsMap = {
    brand: options.brands || [],
    model: options.models?.[form.attributes?.brand] || [],
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
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const updateAttr = (k, v) =>
    setForm(p => ({ ...p, attributes: { ...p.attributes, [k]: v } }));

  // ---------------- LOCATION ----------------
  const handleState = (s) => {
    setState(s);
    setCity("");
  };

  const handleCity = (c) => setCity(c);

  // ---------------- IMAGE COMPRESSION ----------------
  const compress = async (files) => {
    const opts = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true
    };

    return Promise.all(
      Array.from(files).map(f => imageCompression(f, opts))
    );
  };

  const handleImages = async (files) => {
    const compressed = await compress(files);
    setImages(compressed);
    setPreviews(compressed.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (i) => {
    setImages(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.category_id)
      return alert("Missing required fields");

    const fd = new FormData();

    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("price", form.price);
    fd.append("category_id", form.category_id);

    if (form.subcategory_id)
      fd.append("subcategory_id", form.subcategory_id);

    if (form.promotion_id)
      fd.append("promotion_id", form.promotion_id);

    fd.append("attributes", JSON.stringify(form.attributes));
    fd.append("delivery", JSON.stringify(form.delivery));
    fd.append("contact", JSON.stringify(form.contact));

    fd.append("location_state", state);
    fd.append("location_city", city);

    images.forEach(img => fd.append("images", img));

    try {
      setLoading(true);
      setProgress(0);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "https://minimart-ivrm.onrender.com/api/marketplace/products");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setLoading(false);

        if (xhr.status >= 200 && xhr.status < 300) {
          alert("Product created!");

          setForm({
            title: "",
            description: "",
            price: "",
            category_id: "",
            subcategory_id: "",
            promotion_id: "",
            attributes: {},
            delivery: { available: true, type: "fixed", note: "" },
            contact: { phone: "", whatsapp: "", preferred: "chat" },
            negotiable: false,
          });

          setImages([]);
          setPreviews([]);
          setState("");
          setCity("");
          setProgress(0);
        } else {
          alert("Upload failed");
        }
      };

      xhr.onerror = () => {
        setLoading(false);
        alert("Network error");
      };

      xhr.send(fd);
    } catch (e) {
      setLoading(false);
      console.error(e);
    }
  };

  // ---------------- UI (MINIMAL CLEAN) ----------------
  return (
    <div className="add-product">

      <h2>Add Product</h2>

      {loading && (
        <div className="progress">
          <div style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}

      <input placeholder="Title"
        value={form.title}
        onChange={e => update("title", e.target.value)}
      />

      <textarea placeholder="Description"
        value={form.description}
        onChange={e => update("description", e.target.value)}
      />

      <input placeholder="Price"
        value={form.price}
        onChange={e => update("price", e.target.value)}
      />

      {/* CATEGORY */}
      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={v => update("category_id", v)}
        options={categories.map(c => ({ id: c.id, name: c.name }))}
      />

      {/* SUBCATEGORY */}
      {selectedCategory?.subcategories?.length > 0 && (
        <DropdownModal
          label="Subcategory"
          value={form.subcategory_id}
          onChange={v => update("subcategory_id", v)}
          options={selectedCategory.subcategories.map(s => ({
            id: s.id,
            name: s.name
          }))}
        />
      )}

      {/* ATTRIBUTES */}
      {dynamicFields.map(field => (
        <DropdownModal
          key={field}
          label={field}
          value={form.attributes[field] || ""}
          onChange={v => updateAttr(field, v)}
          options={optionsMap[field] || []}
        />
      ))}

      {/* LOCATION */}
      <DropdownModal
        label="State"
        value={state}
        onChange={handleState}
        options={states}
      />

      {state && (
        <DropdownModal
          label="City"
          value={city}
          onChange={handleCity}
          options={cities}
        />
      )}

      {/* CONTACT */}
      <input
        placeholder="Phone"
        value={form.contact.phone}
        onChange={e =>
          setForm(p => ({
            ...p,
            contact: { ...p.contact, phone: e.target.value }
          }))
        }
      />

      <input
        placeholder="WhatsApp"
        value={form.contact.whatsapp}
        onChange={e =>
          setForm(p => ({
            ...p,
            contact: { ...p.contact, whatsapp: e.target.value }
          }))
        }
      />

      {/* IMAGES */}
      <input type="file" multiple onChange={e => handleImages(e.target.files)} />

      <div className="preview">
        {previews.map((p, i) => (
          <div key={i}>
            <img src={p} />
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