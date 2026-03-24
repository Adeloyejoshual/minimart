import { useEffect, useState } from "react";
import "./AddProduct.css";

export default function AddProduct({ categories }) {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [form, setForm] = useState({
    title: "",
    price: "",
    mainCategory: "",
    dynamic: {},
  });

  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  // ---------------- SELECTED CATEGORY ----------------
  const selectedCategory = categories.find(c => c.id === form.mainCategory);
  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
  const dynamicLocation = selectedCategory?.dynamicOptions?.location || {}; // object state->cities

  const states = Object.keys(dynamicLocation);
  const cities = selectedState ? dynamicLocation[selectedState] || [] : [];

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

  // ---------------- FORM UPDATE ----------------
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateDynamic = (key, value) =>
    setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  // ---------------- RESET DYNAMIC FIELDS ----------------
  useEffect(() => {
    if (!selectedCategory) return;
    const initialDynamic = Object.fromEntries(
      dynamicFields.map(f => [f, f === "features" ? [] : ""])
    );
    setForm(prev => ({ ...prev, dynamic: initialDynamic }));
    setSelectedState("");
    setSelectedCity("");
  }, [selectedCategory]);

  // ---------------- IMAGE HANDLER ----------------
  const handleImages = (files) => {
    setImages([...files]);
    setPreviewUrls([...files].map(f => URL.createObjectURL(f)));
  };

  // ---------------- STATE & CITY HANDLERS ----------------
  const handleStateChange = (state) => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", ""); // reset city in dynamic fields
  };

  const handleCityChange = (city) => {
    setSelectedCity(city);
    updateDynamic("location", city);
  };

  // ---------------- SUBMIT ----------------
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
      setSelectedState("");
      setSelectedCity("");
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
        const isArrayField = field === "features";

        return (
          <div className="field" key={field}>
            <label>{field.replace(/_/g, " ").toUpperCase()}</label>

            {!optionsMap[field] || optionsMap[field].length === 0 ? (
              <input value={value || ""} onChange={e => updateDynamic(field, e.target.value)} />
            ) : isArrayField ? (
              <div className="multi-select">
                {optionsMap[field].map(opt => {
                  const current = Array.isArray(value) ? value : [];
                  return (
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

      {/* STATE */}
      <div className="field">
        <label>State</label>
        <select value={selectedState} onChange={e => handleStateChange(e.target.value)}>
          <option value="">Select state</option>
          {states.map(state => <option key={state} value={state}>{state}</option>)}
        </select>
      </div>

      {/* CITY */}
      {selectedState && (
        <div className="field">
          <label>City</label>
          <select value={selectedCity} onChange={e => handleCityChange(e.target.value)}>
            <option value="">Select city</option>
            {cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
        </div>
      )}

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

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}