// src/pages/AddProductPage.jsx - PRODUCTION READY
import { useEffect, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans, getActivePrice, getDiscountPercent } from "../config/promotions.js";
import "./AddProduct.css";

export default function AddProductPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    mainCategory: "",
    subCategory: "",
    dynamic: {},
    promotionId: "",
  });

  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const states = Object.keys(locationsByState || {});
  const cities = selectedState ? locationsByState[selectedState] : [];

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories");
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

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateDynamic = (key, value) =>
    setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  // ---------------- RESET DYNAMIC FIELDS ON CATEGORY CHANGE ----------------
  useEffect(() => {
    if (!selectedCategory) return;
    const initialDynamic = Object.fromEntries(
      dynamicFields.map(f => [f, f === "features" ? [] : ""])
    );
    setForm(prev => ({ ...prev, dynamic: initialDynamic, subCategory: "" }));
  }, [selectedCategory]);

  // ---------------- HANDLE IMAGE PREVIEWS ----------------
  const handleImages = files => {
    const arr = Array.from(files);
    setImages(arr);
    setPreviewUrls(arr.map(f => URL.createObjectURL(f)));
  };

  const removeImage = index => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
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

  // ---------------- HANDLE PRICE INPUT ----------------
  const handlePriceChange = value => {
    const numeric = value.replace(/[^0-9.]/g, "");
    update("price", numeric);
  };

  const formatPrice = price => {
    if (!price) return "";
    const [integer, decimal] = price.toString().split(".");
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal ? "." + decimal : "");
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory)
      return alert("Title, price, and category are required");
    if (images.length === 0) return alert("Please upload at least one image");

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
      if (form.promotionId) formData.append("promotionId", form.promotionId);

      images.forEach(img => formData.append("images", img));

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");

      alert("Product added successfully!");
      setForm({ title: "", description: "", price: "", mainCategory: "", subCategory: "", dynamic: {}, promotionId: "" });
      setImages([]);
      setPreviewUrls([]);
      setSelectedState("");
      setSelectedCity("");
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
      <DropdownModal
        label="Category"
        value={form.mainCategory}
        onChange={val => update("mainCategory", val)}
        options={categories.map(c => ({ id: c.id, name: c.name }))}
      />

      {/* SUBCATEGORY */}
      {subcategories.length > 0 && (
        <DropdownModal
          label="Subcategory"
          value={form.subCategory}
          onChange={val => update("subCategory", val)}
          options={subcategories.map(s => ({ id: s.id, name: s.name }))}
        />
      )}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map(field => {
        const value = form.dynamic[field];
        if (field === "used_detail" && form.dynamic.condition !== "Used") return null;
        const isArray = field === "features";

        return (
          <div key={field}>
            {isArray ? (
              <div className="multi-select">
                <label>{field.replace(/_/g, " ").toUpperCase()}</label>
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
              <DropdownModal
                label={field.replace(/_/g, " ").toUpperCase()}
                value={value || ""}
                onChange={val => updateDynamic(field, val)}
                options={optionsMap[field]}
              />
            )}
          </div>
        );
      })}

      {/* STATE & CITY */}
      <DropdownModal label="State" value={selectedState} onChange={handleStateChange} options={states} />
      {selectedState && <DropdownModal label="City" value={selectedCity} onChange={handleCityChange} options={cities} />}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input type="text" value={formatPrice(form.price)} onChange={e => handlePriceChange(e.target.value)} />
      </div>

      {/* PROMOTION */}
      <DropdownModal
        label="Promotion"
        value={form.promotionId}
        onChange={val => update("promotionId", val)}
        options={promotionPlans.map(plan => {
          const activePrice = getActivePrice(plan.price, plan.discount);
          const discountPercent = getDiscountPercent(plan.originalPrice, plan.discount);
          return { id: plan.id, name: `${plan.name} - ₦${activePrice.toLocaleString()} (${discountPercent}% off)` };
        })}
      />

      {/* IMAGES */}
      <div className="field">
        <label>Images</label>
        <input type="file" multiple accept="image/*" onChange={e => handleImages(e.target.files)} />
        <div className="image-preview">
          {previewUrls.map((url, i) => (
            <div key={i} className="preview-wrapper">
              <img src={url} alt={`preview ${i}`} />
              <button type="button" onClick={() => removeImage(i)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}