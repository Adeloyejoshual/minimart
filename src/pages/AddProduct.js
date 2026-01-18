// src/pages/AddProduct.js
import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";
import categories from "../config/categories";
import categoryRules from "../config/categoryRules";
import { locationsByState } from "../config/locationsByState";
import phoneModels from "../config/phoneModels";
import conditions from "../config/condition";
import "./AddProduct.css";

const MAX_IMAGES = 10;

const AddProduct = () => {
  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    usedDetail: "",
    title: "",
    description: "",
    price: "",
    phoneNumber: "",
    images: [],
    previewImages: [],
    state: "",
    city: "",
    isPromoted: false,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectionStep, setSelectionStep] = useState(null); // Full-page selection step
  const [backStep, setBackStep] = useState(null);

  // ---------------- Derived lists ----------------
  const getSubcategories = () =>
    categories.find(c => c.name === form.mainCategory)?.subcategories || [];

  const getBrandOptions = () => {
    if (!form.mainCategory) return [];
    const data = phoneModels[form.mainCategory];
    if (!data) return [];
    return Object.keys(data).filter(b => b !== "Other");
  };

  const getModelOptions = () => {
    if (!form.brand || !form.mainCategory) return [];
    return phoneModels[form.mainCategory][form.brand] || [];
  };

  const getStateOptions = () => Object.keys(locationsByState);
  const getCityOptions = () => (form.state ? locationsByState[form.state] : []);
  const getConditionOptions = () => conditions.main;
  const getUsedDetailOptions = () => conditions.usedDetails;

  // ---------------- Handlers ----------------
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));

    // Reset dependent fields  
    if (field === "mainCategory") setForm(prev => ({ ...prev, subCategory: "", brand: "", model: "", condition: "", usedDetail: "" }));
    if (field === "subCategory") setForm(prev => ({ ...prev, brand: "", model: "", condition: "", usedDetail: "" }));
    if (field === "brand") setForm(prev => ({ ...prev, model: "" }));
    if (field === "condition") setForm(prev => ({ ...prev, usedDetail: "" }));
    if (field === "state") setForm(prev => ({ ...prev, city: "" }));
  };

  const handlePriceChange = e => {
    let val = e.target.value.replace(/,/g, "");
    if (!isNaN(val)) setForm(prev => ({ ...prev, price: val }));
  };

  const handleFileChange = e => {
    const files = Array.from(e.target.files);
    if (files.length + form.images.length > MAX_IMAGES)
      return alert(`Max ${MAX_IMAGES} images allowed`);
    setForm(prev => ({
      ...prev,
      images: [...prev.images, ...files],
      previewImages: [...prev.previewImages, ...files.map(f => URL.createObjectURL(f))]
    }));
  };

  const removeImage = idx => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
      previewImages: prev.previewImages.filter((_, i) => i !== idx)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    const requiredFields = ["mainCategory", "subCategory", "title", "price", "phoneNumber", "state", "city"];
    requiredFields.forEach(f => { if (!form[f]) newErrors[f] = "This field is required"; });

    // Mobile Phones extra validation  
    if (form.subCategory === "Mobile Phones") {
      ["brand", "model", "condition"].forEach(f => { if (!form[f]) newErrors[f] = "This field is required"; });
      if (form.condition === "Used" && !form.usedDetail) newErrors.usedDetail = "This field is required";
    }

    // Phone number format
    if (form.phoneNumber && !/^\d{10,15}$/.test(form.phoneNumber))
      newErrors.phoneNumber = "Enter a valid phone number";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = async e => {
    e.preventDefault();
    if (!auth.currentUser) return setErrors({ general: "Login required" });
    if (!validateForm()) return;

    try {
      setLoading(true);
      const uploaded = await Promise.all(form.images.map(f => uploadToCloudinary(f)));

      await addDoc(collection(db, "products"), {
        ...form,
        images: uploaded,
        coverImage: uploaded[0],
        ownerId: auth.currentUser.uid,
        marketType,
        createdAt: serverTimestamp(),
      });

      alert("Product added successfully");
      setForm({
        mainCategory: "",
        subCategory: "",
        brand: "",
        model: "",
        condition: "",
        usedDetail: "",
        title: "",
        description: "",
        price: "",
        phoneNumber: "",
        images: [],
        previewImages: [],
        state: "",
        city: "",
        isPromoted: false,
      });
      navigate(`/${marketType}`);
    } catch (err) {
      setErrors({ general: "Error: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Cleanup preview URLs on unmount
  useEffect(() => () => form.previewImages.forEach(url => URL.revokeObjectURL(url)), [form.previewImages]);

  // ---------------- Full Page List Component ----------------
  const FullPageList = ({ title, options, valueKey, allowCustom = true }) => {
    const [customValue, setCustomValue] = useState("");

    const handleCustomSubmit = () => {
      if (customValue.trim() !== "") {
        handleChange(valueKey, customValue.trim());
        setCustomValue("");
        setSelectionStep(null);
      }
    };

    return (
      <div className="fullpage-list">
        {backStep && <div className="options-back" onClick={() => setSelectionStep(backStep)}>← Back</div>}
        <h3>{title}</h3>
        <div className="options-scroll">
          {options.map(opt => (
            <div key={opt} className={`option-item ${form[valueKey] === opt ? "active" : ""}`}
              onClick={() => { handleChange(valueKey, opt); setSelectionStep(null); }}>
              {opt}
            </div>
          ))}
          {allowCustom && (
            <div className="option-item custom-input">
              <input type="text" placeholder={`Enter ${valueKey}...`} value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCustomSubmit()} />
              <button type="button" onClick={handleCustomSubmit}>Submit</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---------------- Full Page Step ----------------
  if (selectionStep) {
    switch (selectionStep) {
      case "subCategory": return <FullPageList title="Select Subcategory" options={getSubcategories()} valueKey="subCategory" />;
      case "brand": return <FullPageList title="Select Brand" options={getBrandOptions()} valueKey="brand" />;
      case "model": return <FullPageList title="Select Model" options={getModelOptions()} valueKey="model" />;
      case "condition": return <FullPageList title="Select Condition" options={getConditionOptions()} valueKey="condition" />;
      case "usedDetail": return <FullPageList title="Select Used Detail" options={getUsedDetailOptions()} valueKey="usedDetail" />;
      case "state": return <FullPageList title="Select State" options={getStateOptions()} valueKey="state" />;
      case "city": return <FullPageList title="Select City" options={getCityOptions()} valueKey="city" />;
      default: break;
    }
  }

  // ---------------- Main Form ----------------
  return (
    <form onSubmit={handleAdd} className="add-product-form">
      <h2>Post Ad ({marketType})</h2>
      {errors.general && <div className="error">{errors.general}</div>}

      {/* Main Category */}
      <div className="field">
        <label>Main Category</label>
        <div className="option-item clickable" onClick={() => { setBackStep(null); setSelectionStep("mainCategory"); }}>
          {form.mainCategory || "Select Main Category"}
        </div>
      </div>

      {/* Subcategory */}
      {form.mainCategory && (
        <div className="field">
          <label>Subcategory</label>
          <div className="option-item clickable" onClick={() => { setBackStep(null); setSelectionStep("subCategory"); }}>
            {form.subCategory || "Select Subcategory"}
          </div>
        </div>
      )}

      {/* Brand */}
      {form.subCategory && (
        <div className="field">
          <label>Brand</label>
          <div className="option-item clickable" onClick={() => { setBackStep("subCategory"); setSelectionStep("brand"); }}>
            {form.brand || "Select Brand"}
          </div>
        </div>
      )}

      {/* Model */}
      {form.brand && (
        <div className="field">
          <label>Model</label>
          <div className="option-item clickable" onClick={() => { setBackStep("brand"); setSelectionStep("model"); }}>
            {form.model || "Select Model"}
          </div>
        </div>
      )}

      {/* Condition */}
      {(form.subCategory === "Mobile Phones") && form.model && (
        <div className="field">
          <label>Condition</label>
          <div className="option-item clickable" onClick={() => { setBackStep("model"); setSelectionStep("condition"); }}>
            {form.condition || "Select Condition"}
          </div>
          {form.condition === "Used" && (
            <div className="field">
              <label>Used Detail</label>
              <div className="option-item clickable" onClick={() => { setBackStep("condition"); setSelectionStep("usedDetail"); }}>
                {form.usedDetail || "Select Used Detail"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <input type="text" placeholder="Title" value={form.title} onChange={e => handleChange("title", e.target.value)} />

      {/* Description */}
      <textarea placeholder="Description" value={form.description} onChange={e => handleChange("description", e.target.value)} />

      {/* Price */}
      <input type="text" placeholder="Price" value={form.price} onChange={handlePriceChange} />

      {/* Phone */}
      <input type="tel" placeholder="Phone Number" value={form.phoneNumber} onChange={e => handleChange("phoneNumber", e.target.value)} />

      {/* Images */}
      <input type="file" multiple accept="image/*" onChange={handleFileChange} />
      {form.previewImages.length > 0 && (
        <div className="preview-images">
          {form.previewImages.map((src, i) => (
            <div key={i} className="img-wrap">
              <img src={src} alt={`preview-${i}`} />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* State / City */}
      <div className="field">
        <label>State</label>
        <div className="option-item clickable" onClick={() => { setBackStep(null); setSelectionStep("state"); }}>
          {form.state || "Select State"}
        </div>
      </div>
      {form.state && (
        <div className="field">
          <label>City</label>
          <div className="option-item clickable" onClick={() => { setBackStep("state"); setSelectionStep("city"); }}>
            {form.city || "Select City"}
          </div>
        </div>
      )}

      {/* Promote */}
      <label>
        <input type="checkbox" checked={form.isPromoted} onChange={() => handleChange("isPromoted", !form.isPromoted)} />
        Promote this product (free)
      </label>

      <button type="submit" disabled={loading}>{loading ? "Uploading..." : `Add to ${marketType}`}</button>
    </form>
  );
};

export default AddProduct;