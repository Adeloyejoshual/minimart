import { useEffect, useMemo, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { locationsByState } from "../config/locationsByState.js";
import "./AddProduct.css";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",

  attributes: {
    brand: "",
    model: "",
    features: [],
  },

  delivery: {
    available: true,
    duration: { from: "", to: "" },
    fee: "",
    note: "",
  },

  contact: {
    phone: "",
    whatsapp: "",
    preferred: "chat",
  },
};

export default function AddProduct() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);

  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  /* ================= CATEGORY ================= */
  const selectedCategory = useMemo(() => {
    return categories.find(
      (c) => String(c.id) === String(form.category_id)
    );
  }, [categories, form.category_id]);

  /* IMPORTANT: normalize dynamicOptions safely */
  const options = useMemo(() => {
    const raw = selectedCategory?.dynamicOptions || {};

    return {
      brands: raw.brands || [],
      models: raw.models || {},
      colors: raw.colors || [],
      conditions: raw.conditions || [],
      usedDetails: raw.usedDetails || [],
      ram: raw.ram || [],
      storage: raw.storage || [],
      sims: raw.sims || [],
      years: raw.years || [],
      engines: raw.engines || [],
      fuel_types: raw.fuel_types || [],
      features: raw.features || [],
      fields: raw.fields || [],
    };
  }, [selectedCategory]);

  const brand = form.attributes.brand;

  /* FIX: model depends on brand */
  const modelOptions = useMemo(() => {
    if (!brand) return [];
    return options.models?.[brand] || [];
  }, [brand, options.models]);

  const fields = useMemo(() => {
    return ["condition", ...(options.fields || [])];
  }, [options.fields]);

  /* ================= HELPERS ================= */
  const update = (key, value) =>
    setForm((p) => ({ ...p, [key]: value }));

  const updateAttr = (key, value) =>
    setForm((p) => ({
      ...p,
      attributes: { ...p.attributes, [key]: value },
    }));

  const formatLabel = (t) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  const onlyNumbers = (v) => v.replace(/[^\d]/g, "");

  const toggleFeature = (feature) => {
    setForm((p) => {
      const current = p.attributes.features || [];
      const exists = current.includes(feature);

      return {
        ...p,
        attributes: {
          ...p.attributes,
          features: exists
            ? current.filter((f) => f !== feature)
            : [...current, feature],
        },
      };
    });
  };

  /* ================= IMAGES ================= */
  const handleImages = (files) => {
    const list = Array.from(files).slice(0, 8);

    previews.forEach((p) => URL.revokeObjectURL(p));

    setImages(list);
    setPreviews(list.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (i) => {
    setImages((p) => p.filter((_, x) => x !== i));
    setPreviews((p) => {
      URL.revokeObjectURL(p[i]);
      return p.filter((_, x) => x !== i);
    });
  };

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />

      {/* TITLE */}
      <input
        placeholder="Title"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
      />

      {/* DESCRIPTION */}
      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
      />

      {/* PRICE */}
      <input
        placeholder="Price"
        value={form.price}
        onChange={(e) =>
          update("price", e.target.value.replace(/[^\d]/g, ""))
        }
      />

      {/* CATEGORY */}
      <DropdownModal
        label="Category"
        value={form.category_id}
        onChange={(v) =>
          setForm((p) => ({
            ...p,
            category_id: v,
            attributes: { brand: "", model: "", features: [] },
          }))
        }
        options={categories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />

      {/* BRAND */}
      {options.brands.length > 0 && (
        <DropdownModal
          label="Brand"
          value={form.attributes.brand}
          onChange={(v) => updateAttr("brand", v)}
          options={options.brands}
        />
      )}

      {/* MODEL (FIXED) */}
      {modelOptions.length > 0 && (
        <DropdownModal
          label="Model"
          value={form.attributes.model}
          onChange={(v) => updateAttr("model", v)}
          options={modelOptions}
        />
      )}

      {/* OTHER DYNAMIC FIELDS */}
      {fields.map((f) => {
        const value = form.attributes?.[f] || "";

        return (
          <DropdownModal
            key={f}
            label={formatLabel(f)}
            value={value}
            onChange={(v) => updateAttr(f, v)}
            options={options[f] || []}
          />
        );
      })}

      {/* FEATURES */}
      {options.features.length > 0 && (
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

      {/* LOCATION */}
      <DropdownModal
        label="State"
        value={state}
        onChange={setState}
        options={Object.keys(locationsByState || {})}
      />

      {state && (
        <DropdownModal
          label="City"
          value={city}
          onChange={setCity}
          options={locationsByState[state] || []}
        />
      )}

      {/* CONTACT */}
      <input
        placeholder="Phone"
        value={form.contact.phone}
        onChange={(e) =>
          update("contact", {
            ...form.contact,
            phone: onlyNumbers(e.target.value),
          })
        }
      />

      <input
        placeholder="WhatsApp"
        value={form.contact.whatsapp}
        onChange={(e) =>
          update("contact", {
            ...form.contact,
            whatsapp: onlyNumbers(e.target.value),
          })
        }
      />

      {/* IMAGES */}
      <input
        type="file"
        multiple
        onChange={(e) => handleImages(e.target.files)}
      />

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i}>
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>X</button>
          </div>
        ))}
      </div>
    </div>
  );
}