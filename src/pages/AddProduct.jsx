// src/components/AddProduct.jsx
import { useEffect, useState } from "react";
import "./AddProduct.css";

export default function AddProduct({ selectedCategory, locationsByState }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [form, setForm] = useState({
    title: "",
    price: "",
    mainCategory: "",
    dynamic: {},
  });

  // ---------------- STATE & CITY ----------------
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const states = Object.keys(locationsByState || []);
  const cities = selectedState ? locationsByState[selectedState] : [];

  // Debug: only in dev
  useEffect(() => {
    console.log("AddProduct → locationsByState:", locationsByState);
    console.log("AddProduct → states:", states);
    console.log("AddProduct → selectedState:", selectedState);
  }, [locationsByState, states, selectedState]);

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch(console.error);
  }, []);

  // Use passed selectedCategory if present, otherwise fallback
  const usingCategory = selectedCategory || categories.find((c) => c.id === form.mainCategory);
  const dynamicFields = usingCategory?.dynamicOptions?.fields || [];

  // ---------------- OPTIONS MAP ----------------
  const optionsMap = {
    brand: usingCategory?.dynamicOptions?.brands || [],
    model: usingCategory?.dynamicOptions?.models?.[form.dynamic.brand] || [],
    color: usingCategory?.dynamicOptions?.colors || [],
    condition: usingCategory?.dynamicOptions?.conditions || [],
    used_detail: usingCategory?.dynamicOptions?.usedDetails || [],
    ram: usingCategory?.dynamicOptions?.ram || [],
    storage: usingCategory?.dynamicOptions?.storage || [],
    sim: usingCategory?.dynamicOptions?.sims || [],
    features: usingCategory?.dynamicOptions?.features || [],
    year: usingCategory?.dynamicOptions?.years || [],
    engine: usingCategory?.dynamicOptions?.engine || [],
    fuel_type: usingCategory?.dynamicOptions?.fuel_type || [],
  };

  // ---------------- FORM UPDATES ----------------
  const update = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateDynamic = (key, value) =>
    setForm((prev) => ({
      ...prev,
      dynamic: { ...prev.dynamic, [key]: value },
    }));

  // ---------------- RESET DYNAMIC FIELDS ON CATEGORY CHANGE ----------------
  useEffect(() => {
    if (!usingCategory) return;

    const initialDynamic = Object.fromEntries(
      dynamicFields.map((f) => [f, f === "features" ? [] : ""])
    );

    setForm((prev) => ({ ...prev, dynamic: initialDynamic }));
  }, [usingCategory]);

  // ---------------- HANDLE IMAGE SELECTION ----------------
  const handleImages = (files) => {
    setImages([...files]);
    const urls = [...files].map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
  };

  // ---------------- STATE & CITY HANDLERS ----------------
  const handleStateChange = (state) => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", ""); // reset city
  };

  const handleCityChange = (city) => {
    setSelectedCity(city);
    updateDynamic("location", city);
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
      formData.append("description", "");
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      formData.append("dynamicFields", JSON.stringify(form.dynamic));
      images.forEach((img) => formData.append("images", img));

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          body: formData,
        }
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
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g iPhone 13"
        />
      </div>

      {/* CATEGORY */}
      <div className="field">
        <label>Category</label>
        <select
          value={form.mainCategory}
          onChange={(e) => update("mainCategory", e.target.value)}
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map((field) => {
        const value = form.dynamic[field];
        if (field === "used_detail" && form.dynamic.condition !== "Used")
          return null;

        const isArrayField = field === "features";

        return (
          <div className="field" key={field}>
            <label>{field.replace(/_/g, " ").toUpperCase()}</label>

            {!optionsMap[field] || optionsMap[field].length === 0 ? (
              <input
                value={value || ""}
                onChange={(e) => updateDynamic(field, e.target.value)}
              />
            ) : isArrayField ? (
              <div className="multi-select">
                {optionsMap[field].map((opt) => {
                  const current = Array.isArray(value) ? value : [];
                  return (
                    <label key={opt}>
                      <input
                        type="checkbox"
                        checked={current.includes(opt)}
                        onChange={() => {
                          if (current.includes(opt)) {
                            updateDynamic(
                              field,
                              current.filter((v) => v !== opt)
                            );
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
              <select
                value={value || ""}
                onChange={(e) => updateDynamic(field, e.target.value)}
              >
                <option value="">Select {field}</option>
                {optionsMap[field].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}

      {/* STATE */}
      <div className="field">
        <label>State</label>
        <select
          value={selectedState}
          onChange={(e) => handleStateChange(e.target.value)}
        >
          <option value="">Select state</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      {/* CITY (only if state is selected) */}
      {selectedState && (
        <div className="field">
          <label>City</label>
          <select
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
          >
            <option value="">Select city</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input
          type="number"
          value={form.price}
          onChange={(e) => update("price", e.target.value)}
        />
      </div>

      {/* IMAGES */}
      <div className="field">
        <label>Images</label>
        <input
          type="file"
          multiple
          onChange={(e) => handleImages([...e.target.files])}
        />
        <div className="image-preview">
          {previewUrls.map((url, i) => (
            <img key={i} src={url} alt={`preview ${i}`} />
          ))}
        </div>
      </div>

      {/* SUBMIT BUTTON */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}