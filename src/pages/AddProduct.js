// src/pages/AddProduct.js
import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";
import categoriesData from "../config/categoriesData";
import productOptions from "../config/productOptions";
import { locationsByRegion } from "../config/locationsByRegion";
import { useAdLimitCheck } from "../hooks/useAdLimits";
import ProductOptionsSelector from "../components/ProductOptionsSelector";

const MAX_IMAGES = 10;

const AddProduct = () => {
  // --- Form state ---
  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
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
    selectedOptions: {},
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  const { checkLimit } = useAdLimitCheck();

  // --- Derived lists ---
  const allRegions = Object.keys(locationsByRegion);
  const allStates = form.region ? Object.keys(locationsByRegion[form.region]) : [];
  const allCities = form.stateLocation ? locationsByRegion[form.region][form.stateLocation] || [] : [];
  const subCategories = form.mainCategory ? categoriesData[form.mainCategory]?.subcategories || [] : [];
  const options = form.mainCategory ? productOptions[form.mainCategory] || {} : {};

  // --- Handlers ---
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));

    // Clear dependent fields
    if (field === "mainCategory") setForm(prev => ({ ...prev, subCategory: "", brand: "", model: "", selectedOptions: {} }));
    if (field === "subCategory") setForm(prev => ({ ...prev, brand: "", model: "", selectedOptions: {} }));
    if (field === "region") setForm(prev => ({ ...prev, stateLocation: "", cityLocation: "" }));
    if (field === "stateLocation") setForm(prev => ({ ...prev, cityLocation: "" }));
  };

  const handlePriceChange = e => {
    let val = e.target.value.replace(/,/g, "");
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      const formatted = val === "." ? "0." : Number(val).toLocaleString("en-US", { maximumFractionDigits: 2 });
      handleChange("price", formatted);
    }
  };

  const handleFileChange = e => {
    const files = Array.from(e.target.files);
    if (files.length + form.images.length > MAX_IMAGES) return alert(`Max ${MAX_IMAGES} images allowed`);
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
      brand: "",
      model: "",
      condition: "",
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
      selectedOptions: {},
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    const requiredFields = ["mainCategory", "subCategory", "title", "price", "phoneNumber", "region", "stateLocation", "cityLocation"];

    requiredFields.forEach(f => {
      if (!form[f]) newErrors[f] = "This field is required";
    });

    // Mobile Phones extra validation
    if (form.subCategory === "Mobile Phones") {
      ["brand", "model", "condition"].forEach(f => { if (!form[f]) newErrors[f] = "This field is required"; });
      ["storageOptions", "colors", "simTypes"].forEach(opt => {
        if (options[opt] && !form.selectedOptions[opt]) newErrors[opt] = "This field is required";
      });
    }

    // Price numeric validation
    const numericPrice = parseFloat(form.price.replace(/,/g, ""));
    if (isNaN(numericPrice) || numericPrice <= 0) newErrors.price = "Enter a valid price";

    // Phone validation
    if (!/^\d{10,15}$/.test(form.phoneNumber)) newErrors.phoneNumber = "Enter a valid phone number";

    // Images validation
    if (form.images.length === 0) newErrors.images = "Upload at least one image";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdd = async e => {
    e.preventDefault();
    if (!auth.currentUser) return setErrors({ general: "Login required." });
    if (!validateForm()) return;

    try {
      setLoading(true);
      const limitReached = await checkLimit(auth.currentUser.uid, form.mainCategory);
      if (limitReached && !form.isPromoted) {
        setErrors({ general: "Free ad limit reached. Promote ad to post more." });
        setLoading(false);
        return;
      }

      const imageUrls = await Promise.all(form.images.map(f => uploadToCloudinary(f)));

      await addDoc(collection(db, "products"), {
        ...form,
        price: parseFloat(form.price.replace(/,/g, "")),
        images: imageUrls,
        coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid,
        marketType,
        createdAt: serverTimestamp(),
        promotionExpiresAt: form.isPromoted ? new Date(Date.now() + 30*24*60*60*1000) : null,
      });

      alert(`Product added successfully${form.isPromoted ? " and promoted for 30 days!" : ""}`);
      resetForm();
      navigate(`/${marketType}`);
    } catch (err) {
      console.error(err);
      setErrors({ general: "Error adding product: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Cleanup object URLs
  useEffect(() => () => form.previewImages.forEach(url => URL.revokeObjectURL(url)), [form.previewImages]);

  // --- Render ---
  return (
    <form onSubmit={handleAdd} style={{
      maxWidth: 750, margin: "20px auto", padding: 20, borderRadius: 10, background: "#fff",
      display: "flex", flexDirection: "column", gap: 15, boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }}>
      <h2 style={{ textAlign: "center", color: "#0d6efd" }}>Post Ad ({marketType})</h2>

      {errors.general && <div style={{ color: "red", padding: 8, borderRadius: 5, background: "#ffe6e6" }}>{errors.general}</div>}

      {/* Main Category */}
      <select value={form.mainCategory} onChange={e => handleChange("mainCategory", e.target.value)} required aria-label="Select Main Category">
        <option value="">Select Category</option>
        {Object.keys(categoriesData).map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>
      {errors.mainCategory && <span style={{ color: "red", fontSize: 12 }}>{errors.mainCategory}</span>}

      {/* Subcategory */}
      {subCategories.length > 0 && (
        <>
          <select value={form.subCategory} onChange={e => handleChange("subCategory", e.target.value)} required aria-label="Select Subcategory">
            <option value="">Select Subcategory</option>
            {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
          {errors.subCategory && <span style={{ color: "red", fontSize: 12 }}>{errors.subCategory}</span>}
        </>
      )}

      {/* Product Options Selector */}
      {subCategory && (
        <ProductOptionsSelector
          mainCategory={form.mainCategory}
          subCategory={form.subCategory}
          onChange={opts => {
            handleChange("brand", opts.brand || "");
            handleChange("model", opts.model || "");
            setForm(prev => ({ ...prev, selectedOptions: opts }));
          }}
        />
      )}

      {/* Title */}
      <input type="text" placeholder="Title*" value={form.title} onChange={e => handleChange("title", e.target.value)} maxLength={70} required />
      {errors.title && <span style={{ color: "red", fontSize: 12 }}>{errors.title}</span>}

      {/* Description */}
      <textarea placeholder="Description" value={form.description} onChange={e => handleChange("description", e.target.value)} maxLength={850} />

      {/* Price */}
      <input type="text" placeholder="Price*" value={form.price} onChange={handlePriceChange} required />
      {errors.price && <span style={{ color: "red", fontSize: 12 }}>{errors.price}</span>}

      {/* Phone */}
      <input type="tel" placeholder="Phone Number*" value={form.phoneNumber} onChange={e => handleChange("phoneNumber", e.target.value)} maxLength={15} required />
      {errors.phoneNumber && <span style={{ color: "red", fontSize: 12 }}>{errors.phoneNumber}</span>}

      {/* Images */}
      <input type="file" multiple accept="image/*" onChange={handleFileChange} />
      {errors.images && <span style={{ color: "red", fontSize: 12 }}>{errors.images}</span>}
      {form.previewImages.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {form.previewImages.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={src} alt={`preview-${i}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 5, border: "1px solid #ccc" }} />
              <button type="button" aria-label={`Remove image ${i+1}`} onClick={() => removeImage(i)}
                style={{ position: "absolute", top: -5, right: -5, background: "red", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Region / State / City */}
      <select value={form.region} onChange={e => handleChange("region", e.target.value)} required aria-label="Select Region">
        <option value="">Select Region</option>
        {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      {form.region && (
        <select value={form.stateLocation} onChange={e => handleChange("stateLocation", e.target.value)} required aria-label="Select State">
          <option value="">Select State</option>
          {allStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {form.stateLocation && (
        <select value={form.cityLocation} onChange={e => handleChange("cityLocation", e.target.value)} required aria-label="Select City">
          <option value="">Select City</option>
          {allCities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Promote */}
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={form.isPromoted} onChange={() => handleChange("isPromoted", !form.isPromoted)} />
        Promote this product (free, 30 days)
      </label>

      <button type="submit" disabled={loading} style={{ padding: "10px 15px", background: "#0d6efd", color: "#fff", border: "none", borderRadius: 5, cursor: loading ? "not-allowed" : "pointer" }}>
        {loading ? "Uploading..." : `Add to ${marketType}`}
      </button>
    </form>
  );
};

export default AddProduct;