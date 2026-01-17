// src/pages/AddProduct.js
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";
import categoriesData from "../config/categoriesData";
import productOptions from "../config/productOptions";
import { locationsByRegion } from "../config/locationsByRegion";
import { useAdLimitCheck } from "../hooks/useAdLimits";
import ProductOptionsSelector from "../components/ProductOptionsSelector";

const AddProduct = () => {
  const [mainCategory, setMainCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [region, setRegion] = useState("");
  const [stateLocation, setStateLocation] = useState("");
  const [cityLocation, setCityLocation] = useState("");
  const [isPromoted, setIsPromoted] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [phoneNumber, setPhoneNumber] = useState("");

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  const { checkLimit } = useAdLimitCheck();

  // Flattened lists
  const allRegions = Object.keys(locationsByRegion);
  const allStates = region ? Object.keys(locationsByRegion[region]) : [];
  const allCities = stateLocation ? locationsByRegion[region][stateLocation] || [] : [];

  const subCategories = mainCategory ? categoriesData[mainCategory]?.subcategories || [] : [];
  const options = mainCategory ? productOptions[mainCategory] || {} : {};

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 10) return alert("Max 10 images allowed");
    setImages(prev => [...prev, ...files]);
    setPreviewImages(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  const resetForm = () => {
    // Revoke object URLs to prevent memory leaks
    previewImages.forEach(url => URL.revokeObjectURL(url));

    setMainCategory(""); setSubCategory(""); setBrand(""); setModel("");
    setCondition(""); setTitle(""); setDescription(""); setPrice("");
    setImages([]); setPreviewImages([]); setRegion(""); setStateLocation(""); setCityLocation("");
    setIsPromoted(false); setSelectedOptions({}); setPhoneNumber("");
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) return alert("Login required.");
    if (!mainCategory || !subCategory || !brand || !model || !condition || !title || !price || images.length === 0 || !region || !stateLocation || !cityLocation) {
      return alert("Please fill all required fields.");
    }
    if (!phoneNumber.match(/^\d{10,15}$/)) return alert("Enter a valid phone number.");

    try {
      setLoading(true);

      const limitReached = await checkLimit(auth.currentUser.uid, mainCategory);
      if (limitReached && !isPromoted) {
        setLoading(false);
        return alert("Free ad limit reached. Promote ad to post more.");
      }

      const imageUrls = await Promise.all(images.map(file => uploadToCloudinary(file)));

      await addDoc(collection(db, "products"), {
        mainCategory, subCategory, brand, model, condition, title, description,
        price: parseFloat(price.replace(/,/g, "")), // handle formatted price
        images: imageUrls, coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid, marketType,
        region, state: stateLocation, city: cityLocation,
        isPromoted, promotedAt: isPromoted ? new Date() : null,
        promotionExpiresAt: isPromoted ? new Date(Date.now() + 30*24*60*60*1000) : null,
        createdAt: serverTimestamp(),
        ...selectedOptions,
        phoneNumber
      });

      alert(`Product added successfully${isPromoted ? " and promoted for 30 days!" : ""}`);
      resetForm();
      navigate(`/${marketType}`);
    } catch (err) {
      console.error(err);
      alert("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleAdd} style={{
      maxWidth: 700, margin: "20px auto", padding: 20, borderRadius: 10, background: "#fff",
      display: "flex", flexDirection: "column", gap: 15, boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }}>
      <h2 style={{ textAlign: "center", color: "#0d6efd" }}>Post Ad ({marketType})</h2>

      {/* Main Category */}
      <select value={mainCategory} onChange={e => { setMainCategory(e.target.value); setSubCategory(""); setBrand(""); setModel(""); }} required>
        <option value="">Select Category</option>
        {Object.keys(categoriesData).map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>

      {/* Subcategory */}
      {subCategories.length > 0 && <select value={subCategory} onChange={e => { setSubCategory(e.target.value); setBrand(""); setModel(""); }} required>
        <option value="">Select Subcategory</option>
        {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
      </select>}

      {/* Product Options Selector */}
      {subCategory && (
        <ProductOptionsSelector
          mainCategory={mainCategory}
          subCategory={subCategory}
          onChange={opts => {
            setBrand(opts.brand);
            setModel(opts.model);
            setSelectedOptions({ ...opts });
            setRegion(opts.state?.region || region); // optional
          }}
        />
      )}

      {/* Title & Description */}
      <input type="text" placeholder="Title*" value={title} onChange={e => setTitle(e.target.value)} maxLength={70} required />
      <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} maxLength={850} />

      {/* Price & Phone */}
      <input
        type="text"
        placeholder="Price*"
        value={price}
        onChange={e => {
          const val = e.target.value.replace(/,/g, "");
          if (!isNaN(val) || val === "") {
            setPrice(val.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
          }
        }}
        required
      />
      <input type="tel" placeholder="Your phone number*" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required maxLength={15} />

      {/* Images */}
      <input type="file" multiple accept="image/*" onChange={handleFileChange} required />
      {previewImages.length > 0 && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {previewImages.map((src, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={src} alt={`preview-${i}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 5, border: "1px solid #ccc" }} />
            <button type="button" onClick={() => {
              setImages(prev => prev.filter((_, idx) => idx !== i));
              setPreviewImages(prev => prev.filter((_, idx) => idx !== i));
            }} style={{ position: "absolute", top: -5, right: -5, background: "red", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer" }}>×</button>
          </div>
        ))}
      </div>}

      {/* Region / State / City */}
      <select value={region} onChange={e => { setRegion(e.target.value); setStateLocation(""); setCityLocation(""); }} required>
        <option value="">Select Region</option>
        {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      {region && (
        <select value={stateLocation} onChange={e => { setStateLocation(e.target.value); setCityLocation(""); }} required>
          <option value="">Select State</option>
          {allStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {stateLocation && (
        <select value={cityLocation} onChange={e => setCityLocation(e.target.value)} required>
          <option value="">Select City</option>
          {allCities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Promote */}
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={isPromoted} onChange={() => setIsPromoted(!isPromoted)} />
        Promote this product (free, 30 days)
      </label>

      <button type="submit" disabled={loading} style={{ padding: "10px 15px", background: "#0d6efd", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>
        {loading ? "Uploading..." : `Add to ${marketType}`}
      </button>
    </form>
  );
};

export default AddProduct;