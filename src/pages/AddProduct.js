// src/pages/AddProduct.js
import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";
import categoriesData from "../config/categoriesData";
import categoryRules from "../config/categoryRules";
import { locationsByRegion } from "../config/locationsByRegion";
import ProductOptionsSelector from "../components/ProductOptionsSelector";

const AddProduct = () => {
  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    brand: null,
    model: null,
    condition: null,
    type: null,
    title: "",
    description: "",
    price: "",
    phoneNumber: "",
    images: [],
    previewImages: [],
    region: "",
    stateLocation: "",
    cityLocation: "",
    isPromoted: false,
    selectedOptions: { features: {} },
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  // Derived lists
  const subCategories = form.mainCategory ? categoriesData[form.mainCategory]?.subcategories || [] : [];
  const allRegions = Object.keys(locationsByRegion);
  const allStates = form.region ? Object.keys(locationsByRegion[form.region]) : [];
  const allCities = form.stateLocation ? locationsByRegion[form.region][form.stateLocation] || [] : [];

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));

    if (field === "mainCategory") setForm(prev => ({ ...prev, subCategory: "", brand: null, model: null, condition: null, type: null, selectedOptions: { features: {} } }));
    if (field === "subCategory") setForm(prev => ({ ...prev, brand: null, model: null, condition: null, type: null, selectedOptions: { features: {} } }));
    if (field === "region") setForm(prev => ({ ...prev, stateLocation: "", cityLocation: "" }));
    if (field === "stateLocation") setForm(prev => ({ ...prev, cityLocation: "" }));
  };

  const handlePriceChange = e => {
    const val = e.target.value.replace(/,/g, "");
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setForm(prev => ({ ...prev, price: val }));
      setErrors(prev => ({ ...prev, price: "" }));
    }
  };

  const handleFileChange = e => {
    const files = Array.from(e.target.files);
    if (files.length + form.images.length > rules.maxImages) return alert(`Max ${rules.maxImages} images allowed`);
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

  const resetForm = () => {
    form.previewImages.forEach(url => URL.revokeObjectURL(url));
    setForm({
      mainCategory: "",
      subCategory: "",
      brand: null,
      model: null,
      condition: null,
      type: null,
      title: "",
      description: "",
      price: "",
      phoneNumber: "",
      images: [],
      previewImages: [],
      region: "",
      stateLocation: "",
      cityLocation: "",
      isPromoted: false,
      selectedOptions: { features: {} },
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.title || form.title.length < rules.minTitle || form.title.length > rules.maxTitle) {
      newErrors.title = `Title must be between ${rules.minTitle} and ${rules.maxTitle} characters`;
    }

    if (form.description && form.description.length > rules.maxDescription) {
      newErrors.description = `Description cannot exceed ${rules.maxDescription} characters`;
    }

    if (form.images.length < rules.minImages) newErrors.images = `Upload at least ${rules.minImages} image(s)`;
    if (form.images.length > rules.maxImages) newErrors.images = `Maximum ${rules.maxImages} images allowed`;

    if (rules.requireBrand && !form.brand) newErrors.brand = "Brand is required";
    if (rules.requireModel && !form.model) newErrors.model = "Model is required";
    if (rules.requireCondition && !form.condition) newErrors.condition = "Condition is required";
    if (rules.requireType && !form.type) newErrors.type = "Type is required";

    if (rules.requireLocation) {
      if (!form.region) newErrors.region = "Region is required";
      if (!form.stateLocation) newErrors.stateLocation = "State is required";
      if (!form.cityLocation) newErrors.cityLocation = "City is required";
    }

    const numericPrice = parseFloat(form.price);
    if (isNaN(numericPrice) || numericPrice <= 0) newErrors.price = "Enter a valid price";

    if (!/^\d{10,15}$/.test(form.phoneNumber)) newErrors.phoneNumber = "Enter a valid phone number";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = async e => {
    e.preventDefault();
    if (!auth.currentUser) return setErrors({ general: "Login required." });
    if (!validateForm()) return;

    try {
      setLoading(true);

      // Upload images
      const imageUrls = await Promise.all(form.images.map(f => uploadToCloudinary(f)));

      // Prepare data safely
      const productData = {
        mainCategory: form.mainCategory,
        subCategory: form.subCategory || null,
        brand: form.brand || null,
        model: form.model || null,
        condition: form.condition || null,
        type: form.type || null,
        title: form.title,
        description: form.description || null,
        price: parseFloat(form.price),
        phoneNumber: form.phoneNumber,
        images: imageUrls,
        coverImage: imageUrls[0] || null,
        ownerId: auth.currentUser.uid,
        marketType,
        region: form.region,
        stateLocation: form.stateLocation,
        cityLocation: form.cityLocation,
        createdAt: serverTimestamp(),
        promotionExpiresAt: form.isPromoted ? new Date(Date.now() + 30*24*60*60*1000) : null,
        selectedOptions: {
          ...form.selectedOptions,
          features: form.selectedOptions.features || {},
        }
      };

      const docRef = await addDoc(collection(db, "products"), productData);

      alert(`Product added! ID: ${docRef.id}`);
      resetForm();
      navigate(`/${marketType}`);
    } catch (err) {
      console.error(err);
      setErrors({ general: "Error adding product: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => form.previewImages.forEach(url => URL.revokeObjectURL(url)), [form.previewImages]);

  return (
    <form onSubmit={handleAdd} style={{ maxWidth: 700, margin: 20, padding: 20, borderRadius: 10, background: "#fff", display: "flex", flexDirection: "column", gap: 15 }}>
      <h2 style={{ textAlign: "center", color: "#0d6efd" }}>Post Ad ({marketType})</h2>
      {errors.general && <div style={{ color: "red", padding: 8, borderRadius: 5, background: "#ffe6e6" }}>{errors.general}</div>}

      {/* Category */}
      <select value={form.mainCategory} onChange={e => handleChange("mainCategory", e.target.value)} required>
        <option value="">Select Category</option>
        {Object.keys(categoriesData).map(cat => <option key={cat}>{cat}</option>)}
      </select>

      {/* Subcategory */}
      {subCategories.length > 0 && (
        <select value={form.subCategory} onChange={e => handleChange("subCategory", e.target.value)}>
          <option value="">Select Subcategory</option>
          {subCategories.map(sub => <option key={sub}>{sub}</option>)}
        </select>
      )}

      {/* Options */}
      {form.subCategory && (
        <ProductOptionsSelector
          mainCategory={form.mainCategory}
          subCategory={form.subCategory}
          onChange={data => setForm(prev => ({
            ...prev,
            brand: data.brand,
            model: data.model,
            condition: data.condition || null,
            type: data.type || null,
            selectedOptions: {
              ...data.options,
              features: data.options.features || {},
            }
          }))}
        />
      )}

      {/* Title */}
      <input type="text" placeholder="Title*" value={form.title} onChange={e => handleChange("title", e.target.value)} required />

      {/* Description */}
      <textarea placeholder="Description" value={form.description} onChange={e => handleChange("description", e.target.value)} />

      {/* Price */}
      <input type="text" placeholder="Price*" value={form.price} onChange={handlePriceChange} required />

      {/* Phone */}
      <input type="tel" placeholder="Phone Number*" value={form.phoneNumber} onChange={e => handleChange("phoneNumber", e.target.value)} required />

      {/* Images */}
      <input type="file" multiple accept="image/*" onChange={handleFileChange} />
      {form.previewImages.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {form.previewImages.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={src} alt={`preview-${i}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 5, border: "1px solid #ccc" }} />
              <button type="button" onClick={() => removeImage(i)} style={{ position: "absolute", top: -5, right: -5, background: "red", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Promote */}
      <label>
        <input type="checkbox" checked={form.isPromoted} onChange={() => handleChange("isPromoted", !form.isPromoted)} />
        Promote this product
      </label>

      <button type="submit" disabled={loading}>{loading ? "Uploading..." : `Add to ${marketType}`}</button>
    </form>
  );
};

export default AddProduct;