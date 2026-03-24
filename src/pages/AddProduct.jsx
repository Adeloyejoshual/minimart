// src/pages/AddProductPage.jsx
import { useEffect, useState } from "react";
import { locationsByState } from "../config/locationsByState.js";
import { categoryRules } from "../config/categoryRules.js";
import { promotionPlans, getActivePrice } from "../config/promotions.js";
import "./AddProduct.css";

export default function AddProductPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [selectedPromotion, setSelectedPromotion] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    mainCategory: "",
    subCategory: "",
    dynamic: {},
  });

  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const states = Object.keys(locationsByState || {});
  const cities = selectedState ? locationsByState[selectedState] : [];

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/categories"
        );
        const data = await res.json();
        setCategories(data || []);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    }
    fetchCategories();
  }, []);

  const selectedCategory = categories.find(c => c.id === form.mainCategory);
  const subcategories = selectedCategory?.subcategories || [];
  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
  const options = selectedCategory?.dynamicOptions || {};

  const optionsMap = {
    brand: options.brands || [],
    model: options.models?.[form.dynamic.brand] || [],
    color: options.colors || [],
    condition: options.conditions || [],
    used_detail: options.usedDetails || [],
    ram: options.ram || [],
    storage: options.storage || [],
    sim: options.sims || [],
    features: options.features || [],
    year: options.years || [],
    engine: options.engine || [],
    fuel_type: options.fuel_type || [],
  };

  const update = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const updateDynamic = (key, value) =>
    setForm(prev => ({
      ...prev,
      dynamic: { ...prev.dynamic, [key]: value },
    }));

  // ---------------- RESET DYNAMIC FIELDS ON CATEGORY CHANGE ----------------
  useEffect(() => {
    if (!selectedCategory) return;

    const initialDynamic = Object.fromEntries(
      dynamicFields.map(f => [f, f === "features" ? [] : ""])
    );

    setForm(prev => ({ ...prev, dynamic: initialDynamic, subCategory: "" }));
  }, [selectedCategory]);

  // ---------------- HANDLE IMAGES ----------------
  const handleImages = files => {
    const arr = Array.from(files);
    setImages(arr);
    setPreviewUrls(arr.map(f => URL.createObjectURL(f)));
  };

  // ---------------- HANDLE STATE & CITY ----------------
  const handleStateChange = state => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", "");
  };

  const handleCityChange = city => {
    setSelectedCity(city);
    updateDynamic("location", city);
  };

  // ---------------- VALIDATION AGAINST CATEGORY RULES ----------------
  const validateRules = () => {
    if (!form.mainCategory) return "Category is required";

    const categoryName = selectedCategory?.name;
    const rules = categoryRules[categoryName];
    if (!rules) return null;

    // Required fields
    for (const field of rules.requiredFields) {
      if (!form.dynamic[field] || (Array.isArray(form.dynamic[field]) && form.dynamic[field].length === 0)) {
        return `${field.replace(/_/g, " ")} is required for ${categoryName}`;
      }
    }

    // Max images
    if (rules.maxImages && images.length > rules.maxImages) {
      return `Maximum ${rules.maxImages} images allowed for ${categoryName}`;
    }

    return null;
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    // Basic required checks
    if (!form.title || !form.price || !form.mainCategory) {
      return alert("Title, price, and category are required");
    }

    if (images.length === 0) return alert("Please upload at least one image");

    // Category rules validation
    const error = validateRules();
    if (error) return alert(error);

    // Clean dynamic fields
    const cleanedDynamic = Object.fromEntries(
      Object.entries(form.dynamic).filter(
        ([_, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)
      )
    );

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      if (form.subCategory) formData.append("subcategory_id", form.subCategory);
      formData.append("dynamicFields", JSON.stringify(cleanedDynamic));
      if (selectedPromotion) formData.append("promotion_id", selectedPromotion.id);
      images.forEach(img => formData.append("images", img));

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: formData }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");

      alert("Product added successfully!");
      setForm({ title: "", description: "", price: "", mainCategory: "", subCategory: "", dynamic: {} });
      setImages([]);
      setPreviewUrls([]);
      setSelectedState("");
      setSelectedCity("");
      setSelectedPromotion(null);
    } catch (err) {
      console.error(err);
      alert(err.message);
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

      {/* DESCRIPTION */}
      <div className="field">
        <label>Description</label>
        <textarea
          value={form.description}
          onChange={e => update("description", e.target.value)}
          placeholder="Write product details here..."
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
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* SUBCATEGORY */}
      {subcategories.length > 0 && (
        <div className="field">
          <label>Subcategory</label>
          <select
            value={form.subCategory}
            onChange={e => update("subCategory", e.target.value)}
          >
            <option value="">Select subcategory</option>
            {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map(field => {
        const value = form.dynamic[field];
        if (field === "used_detail" && form.dynamic.condition !== "Used") return null;
        const isArray = field === "features";

        return (
          <div className="field" key={field}>
            <label>{field.replace(/_/g, " ").toUpperCase()}</label>
            {!optionsMap[field] || optionsMap[field].length === 0 ? (
              <input value={value || ""} onChange={e => updateDynamic(field, e.target.value)} />
            ) : isArray ? (
              <div className="multi-select">
                {optionsMap[field].map(opt => {
                  const current = Array.isArray(value) ? value : [];
                  return (
                    <label key={opt}>
                      <input
                        type="checkbox"
                        checked={current.includes(opt)}
                        onChange={() =>
                          updateDynamic(
                            field,
                            current.includes(opt)
                              ? current.filter(v => v !== opt)
                              : [...current, opt]
                          )
                        }
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            ) : (
              <select value={value || ""} onChange={e => updateDynamic(field, e.target.value)}>
                <option value="">Select</option>
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
          {states.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* CITY */}
      {selectedState && (
        <div className="field">
          <label>City</label>
          <select value={selectedCity} onChange={e => handleCityChange(e.target.value)}>
            <option value="">Select city</option>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input
          type="text"
          value={form.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          onChange={e => {
            const value = e.target.value.replace(/,/g, "");
            if (!isNaN(value)) update("price", value);
          }}
          placeholder="e.g 50,000"
        />
      </div>

      {/* PROMOTION */}
      {selectedCategory && categoryRules[selectedCategory.name]?.allowPromotions && (
        <div className="field">
          <label>Promotion</label>
          <select value={selectedPromotion?.id || ""} onChange={e => {
            const plan = promotionPlans.find(p => p.id.toString() === e.target.value);
            setSelectedPromotion(plan || null);
          }}>
            <option value="">No promotion</option>
            {promotionPlans.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} - ₦{getActivePrice(p.price, p.discount)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* IMAGES */}
      <div className="field">
        <label>Images</label>
        <input type="file" multiple onChange={e => handleImages(e.target.files)} />
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