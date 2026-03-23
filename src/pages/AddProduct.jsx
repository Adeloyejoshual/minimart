import { useEffect, useState } from "react";
import "./AddProduct.css";

export default function AddProduct({ locationsByState }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [form, setForm] = useState({
    title: "",
    price: "",
    mainCategory: "",
    dynamic: {},
    state: "",    // permanent
    city: "",     // dependent
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

  // ---------------- OPTIONS MAP ----------------
  const optionsMap = {
    brand: selectedCategory?.dynamicOptions?.brands || [],
    model: selectedCategory?.dynamicOptions?.models?.[form.dynamic.brand] || [],
    color: selectedCategory?.dynamicOptions?.colors || [],
    condition: selectedCategory?.dynamicOptions?.conditions || [],
    used_detail: selectedCategory?.dynamicOptions?.usedDetails || [],
    ram: selectedCategory?.dynamicOptions?.ram || [],
    storage: selectedCategory?.dynamicOptions?.storage || [],
    sim: selectedCategory?.dynamicOptions?.sims || [],
    features: selectedCategory?.dynamicOptions?.features || [],
    year: selectedCategory?.dynamicOptions?.years || [],
    engine: selectedCategory?.dynamicOptions?.engine || [],
    fuel_type: selectedCategory?.dynamicOptions?.fuel_type || [],
  };

  // ---------------- FORM UPDATES ----------------
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateDynamic = (key, value) =>
    setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  // ---------------- RESET DYNAMIC FIELDS ----------------
  useEffect(() => {
    if (!selectedCategory) return;
    const initialDynamic = Object.fromEntries(
      dynamicFields.map(f => [f, ["features"].includes(f) ? [] : ""])
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
    if (!form.state || !form.city) {
      return alert("State and City are required");
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      formData.append("dynamicFields", JSON.stringify(form.dynamic));
      formData.append("state", form.state);
      formData.append("city", form.city);
      images.forEach(img => formData.append("images", img));

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: formData }
      );

      const data = await res.json();
      console.log("Added product:", data);

      alert("Product added successfully!");
      setForm({ title: "", price: "", mainCategory: "", dynamic: {}, state: "", city: "" });
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
        if (field === "used_detail" && form.dynamic.condition !== "Used") return null;
        const isArrayField = ["features"].includes(field);

        return (
          <div className="field" key={field}>
            <label>{field.replace(/_/g, " ").toUpperCase()}</label>

            {!optionsMap[field] || optionsMap[field].length === 0 ? (
              <input value={value || ""} onChange={e => updateDynamic(field, e.target.value)} />
            ) : isArrayField ? (
              <div className="multi-select">
                {optionsMap[field].map(opt => {
                  const current = Array.isArray(value) ? value : [];
                  const selected = current.includes(opt);
                  return (
                    <label key={opt}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          updateDynamic(field, selected ? current.filter(v => v !== opt) : [...current, opt])
                        }
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            ) : (
              <select value={value || ""} onChange={e => updateDynamic(field, e.target.value)}>
                <option value="">Select {field}</option>
                {optionsMap[field].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
          </div>
        );
      })}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input
          type="number"
          value={form.price}
          onChange={e => update("price", e.target.value)}
        />
      </div>

      {/* IMAGES */}
      <div className="field">
        <label>Images</label>
        <input type="file" multiple onChange={e => handleImages([...e.target.files])} />
        <div className="image-preview">
          {previewUrls.map((url, i) => <img key={i} src={url} alt={`preview ${i}`} />)}
        </div>
      </div>

      {/* STATE & CITY - ALWAYS AT BOTTOM */}
      <div className="field">
        <label>State</label>
        <select
          value={form.state}
          onChange={e => {
            update("state", e.target.value);
            update("city", ""); // reset city when state changes
          }}
        >
          <option value="">Select State</option>
          {Object.keys(locationsByState).map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>City</label>
        <select
          value={form.city}
          onChange={e => update("city", e.target.value)}
          disabled={!form.state}
        >
          <option value="">Select City</option>
          {form.state && locationsByState[form.state].map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}