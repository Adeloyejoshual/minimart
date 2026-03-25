import { useEffect, useState } from "react";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans, getActivePrice, getDiscountPercent } from "../config/promotions.js";
import DropdownModal from "../components/DropdownModal.jsx";
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
    state: "",
    city: "",
  });

  const states = Object.keys(locationsByState || []);
  const cities = form.state ? locationsByState[form.state] : [];

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateDynamic = (key, value) => setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

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

  // Reset dynamic fields when category changes
  useEffect(() => {
    if (!selectedCategory) return;
    const initialDynamic = Object.fromEntries(dynamicFields.map(f => [f, f === "features" ? [] : ""]));
    setForm(prev => ({ ...prev, dynamic: initialDynamic, subCategory: "" }));
  }, [selectedCategory]);

  // Handle images
  const handleImages = files => {
    const arr = Array.from(files);
    setImages(arr);
    setPreviewUrls(arr.map(f => URL.createObjectURL(f)));
  };

  // Handle price
  const handlePriceChange = value => {
    const numeric = value.replace(/[^0-9.]/g, "");
    update("price", numeric);
  };
  const formatPrice = price => {
    if (!price) return "";
    const [integer, decimal] = price.toString().split(".");
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal ? "." + decimal : "");
  };

  // Submit
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) return alert("Title, price, and category are required");
    if (images.length === 0) return alert("Please upload at least one image");

    const cleanedDynamic = Object.fromEntries(
      Object.entries(form.dynamic).filter(([_, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0))
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

      const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");

      alert("Product added successfully!");
      setForm({ title: "", description: "", price: "", mainCategory: "", subCategory: "", dynamic: {}, promotionId: "", state: "", city: "" });
      setImages([]);
      setPreviewUrls([]);
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
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 13" />
      </div>

      {/* DESCRIPTION */}
      <div className="field">
        <label>Description</label>
        <textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="Write product details here..." />
      </div>

      {/* CATEGORY */}
      <DropdownModal label="Category" value={form.mainCategory} onChange={val => update("mainCategory", val)} options={categories.map(c => ({ label: c.name, value: c.id }))} />

      {/* SUBCATEGORY */}
      {subcategories.length > 0 && (
        <DropdownModal label="Subcategory" value={form.subCategory} onChange={val => update("subCategory", val)} options={subcategories.map(s => ({ label: s.name, value: s.id }))} />
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
                      <input type="checkbox" checked={current.includes(opt)} onChange={() => updateDynamic(field, current.includes(opt) ? current.filter(v => v !== opt) : [...current, opt])} />
                      {opt}
                    </label>
                  );
                })}
              </div>
            ) : (
              <DropdownModal label={field.replace(/_/g, " ")} value={value || ""} onChange={val => updateDynamic(field, val)} options={optionsMap[field]} />
            )}
          </div>
        );
      })}

      {/* STATE */}
      <DropdownModal label="State" value={form.state} onChange={val => update("state", val)} options={states} />

      {/* CITY */}
      {form.state && <DropdownModal label="City" value={form.city} onChange={val => update("city", val)} options={cities} />}

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
        options={promotionPlans.map(plan => ({
          label: `${plan.name} - ₦${getActivePrice(plan.price, plan.discount).toLocaleString()} (${getDiscountPercent(plan.originalPrice, plan.discount)}% off)`,
          value: plan.id
        }))}
      />

      {/* IMAGES */}
      <div className="field">
        <label>Images</label>
        <input type="file" multiple onChange={e => handleImages(e.target.files)} />
        <div className="image-preview">
          {previewUrls.map((url, i) => <img key={i} src={url} alt={`preview ${i}`} />)}
        </div>
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>{loading ? "Saving..." : "Add Product"}</button>
    </div>
  );
}