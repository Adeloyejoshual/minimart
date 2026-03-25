// src/pages/AddProductPage.jsx
import { useEffect, useState } from "react";
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

  const [modalOpen, setModalOpen] = useState({ type: "", open: false });

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
  const updateDynamic = (key, value) => setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  // ---------------- RESET DYNAMIC FIELDS ----------------
  useEffect(() => {
    if (!selectedCategory) return;
    const initialDynamic = Object.fromEntries(dynamicFields.map(f => [f, f === "features" ? [] : ""]));
    setForm(prev => ({ ...prev, dynamic: initialDynamic, subCategory: "" }));
  }, [selectedCategory]);

  // ---------------- IMAGES ----------------
  const handleImages = files => {
    const arr = Array.from(files);
    setImages(arr);
    setPreviewUrls(arr.map(f => URL.createObjectURL(f)));
  };

  // ---------------- STATE/CITY ----------------
  const handleStateChange = state => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", "");
  };

  const handleCityChange = city => {
    setSelectedCity(city);
    updateDynamic("location", city);
  };

  // ---------------- PRICE ----------------
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

  // ---------------- MODAL DROPDOWN ----------------
  const openModal = type => setModalOpen({ type, open: true });
  const closeModal = () => setModalOpen({ type: "", open: false });

  const renderOptions = (type, options, onSelect) => {
    if (!modalOpen.open || modalOpen.type !== type) return null;
    return (
      <div className="modal-dropdown">
        <div className="modal-backdrop" onClick={closeModal}></div>
        <div className="modal-content">
          {options.map(opt => (
            <div key={opt.id || opt} className="modal-item" onClick={() => { onSelect(opt); closeModal(); }}>
              {opt.name || opt}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="add-product-container">
      <button onClick={() => window.history.back()} className="back-button">← Back</button>
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
      <div className="field">
        <label>Category</label>
        <div className="dropdown" onClick={() => openModal("category")}>
          {selectedCategory?.name || "Select category"}
        </div>
        {renderOptions("category", categories, opt => update("mainCategory", opt.id))}
      </div>

      {/* SUBCATEGORY */}
      {subcategories.length > 0 && (
        <div className="field">
          <label>Subcategory</label>
          <div className="dropdown" onClick={() => openModal("subcategory")}>
            {form.subCategory ? subcategories.find(s => s.id === form.subCategory)?.name : "Select subcategory"}
          </div>
          {renderOptions("subcategory", subcategories, opt => update("subCategory", opt.id))}
        </div>
      )}

      {/* STATE */}
      <div className="field">
        <label>State</label>
        <div className="dropdown" onClick={() => openModal("state")}>
          {selectedState || "Select state"}
        </div>
        {renderOptions("state", states, opt => handleStateChange(opt))}
      </div>

      {/* CITY */}
      {selectedState && (
        <div className="field">
          <label>City</label>
          <div className="dropdown" onClick={() => openModal("city")}>
            {selectedCity || "Select city"}
          </div>
          {renderOptions("city", cities, opt => handleCityChange(opt))}
        </div>
      )}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input type="text" value={formatPrice(form.price)} onChange={e => handlePriceChange(e.target.value)} />
      </div>

      {/* PROMOTION */}
      <div className="field">
        <label>Promotion</label>
        <div className="dropdown" onClick={() => openModal("promotion")}>
          {form.promotionId ? promotionPlans.find(p => p.id === form.promotionId)?.name : "Select promotion"}
        </div>
        {renderOptions("promotion", promotionPlans, opt => update("promotionId", opt.id))}
      </div>

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