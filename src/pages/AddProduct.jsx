import { useEffect, useState } from "react";
import "./AddProduct.css";

export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [form, setForm] = useState({
    title: "",
    price: "",
    mainCategory: "",
    dynamic: {}, // dynamic fields like brand, model, state, city, features, etc.
  });

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then(res => res.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  const selectedCategory = categories.find(c => c.id === form.mainCategory);
  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];

  // ---------------- FORM UPDATE HELPERS ----------------
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateDynamic = (key, value) =>
    setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  // ---------------- RESET DYNAMIC FIELDS ON CATEGORY CHANGE ----------------
  useEffect(() => {
    if (!selectedCategory) return;

    const initialDynamic = Object.fromEntries(
      dynamicFields.map(f => [f, f === "features" ? [] : ""])
    );
    setForm(prev => ({ ...prev, dynamic: initialDynamic }));
  }, [selectedCategory]);

  // ---------------- HANDLE IMAGE SELECTION ----------------
  const handleImages = files => {
    setImages([...files]);
    setPreviewUrls([...files].map(f => URL.createObjectURL(f)));
  };

  // ---------------- SUBMIT PRODUCT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) {
      return alert("Title, price, and category are required");
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      formData.append("dynamicFields", JSON.stringify(form.dynamic));
      images.forEach(img => formData.append("images", img));

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: formData }
      );

      const data = await res.json();
      console.log("Added product:", data);

      alert("Product added successfully!");
      setForm({ title: "", price: "", mainCategory: "", dynamic: {} });
      setImages([]);
      setPreviewUrls([]);
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      {/* TITLE */}
      <div className="field">
        <label>Title</label>
        <input
          value={form.title}
          onChange={e => update("title", e.target.value)}
          placeholder="e.g iPhone 13"
        />
      </div>

      {/* CATEGORY */}
      <div className="field">
        <label>Category</label>
        <select
          value={form.mainCategory}
          onChange={e => update("mainCategory", e.target.value)}
        >
          <option value="">Select category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map(field => {
        const value = form.dynamic[field];

        // ---------------- STATE → CITY DEPENDENT ----------------
        if (field === "state") {
          const stateOptions = selectedCategory?.dynamicOptions?.state || [];
          return (
            <div className="field" key={field}>
              <label>State</label>
              <select
                value={value || ""}
                onChange={e => {
                  updateDynamic("state", e.target.value);
                  updateDynamic("city", "");
                }}
              >
                <option value="">Select state</option>
                {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          );
        }

        if (field === "city") {
          const state = form.dynamic.state;
          const cityMap = selectedCategory?.dynamicOptions?.cityMap || {};
          const cities = state ? cityMap[state] || [] : [];

          return (
            <div className="field" key={field}>
              <label>City</label>
              <select
                value={value || ""}
                onChange={e => updateDynamic("city", e.target.value)}
                disabled={!state}
              >
                <option value="">Select city</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          );
        }

        // ---------------- FEATURES MULTISELECT ----------------
        const isArrayField = field === "features";
        const options = selectedCategory?.dynamicOptions?.[field] || [];

        if (!options || options.length === 0) {
          return (
            <div className="field" key={field}>
              <label>{field.toUpperCase()}</label>
              <input value={value || ""} onChange={e => updateDynamic(field, e.target.value)} />
            </div>
          );
        }

        if (isArrayField) {
          const current = Array.isArray(value) ? value : [];
          return (
            <div className="field" key={field}>
              <label>{field.toUpperCase()}</label>
              <div className="multi-select">
                {options.map(opt => (
                  <label key={opt}>
                    <input
                      type="checkbox"
                      checked={current.includes(opt)}
                      onChange={() => {
                        if (current.includes(opt)) {
                          updateDynamic(field, current.filter(v => v !== opt));
                        } else {
                          updateDynamic(field, [...current, opt]);
                        }
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          );
        }

        // ---------------- SIMPLE SELECT ----------------
        return (
          <div className="field" key={field}>
            <label>{field.toUpperCase()}</label>
            <select value={value || ""} onChange={e => updateDynamic(field, e.target.value)}>
              <option value="">Select {field}</option>
              {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        );
      })}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input type="number" value={form.price} onChange={e => update("price", e.target.value)} />
      </div>

      {/* IMAGES */}
      <div className="field">
        <label>Images</label>
        <input type="file" multiple onChange={e => handleImages([...e.target.files])} />
        <div className="image-preview">
          {previewUrls.map((url, i) => <img key={i} src={url} alt={`preview ${i}`} />)}
        </div>
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}