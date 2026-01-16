// src/pages/AddProduct.js
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";
import categoriesData from "../config/categoriesData"; // <-- full brands/models
import locations from "../config/locations";
import { useAdLimitCheck } from "../hooks/useAdLimits";

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
  const [stateLocation, setStateLocation] = useState("");
  const [cityLocation, setCityLocation] = useState("");
  const [isPromoted, setIsPromoted] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  const { checkLimit } = useAdLimitCheck();

  // Dynamically get subcategories, brands, and models
  const subCategories = mainCategory ? categoriesData[mainCategory]?.subcategories || [] : [];
  const brands = subCategory ? categoriesData[mainCategory]?.brands[subCategory] || [] : [];
  const models = brand ? categoriesData[mainCategory]?.models[brand] || [] : [];

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setImages(selectedFiles);
    setPreviewImages(selectedFiles.map(f => URL.createObjectURL(f)));
  };

  const resetForm = () => {
    setMainCategory("");
    setSubCategory("");
    setBrand("");
    setModel("");
    setCondition("");
    setTitle("");
    setDescription("");
    setPrice("");
    setImages([]);
    setPreviewImages([]);
    setStateLocation("");
    setCityLocation("");
    setIsPromoted(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) return alert("Login required");
    if (!mainCategory || !subCategory || !brand || !model || !title || !price || images.length === 0 || !condition || !stateLocation || !cityLocation) {
      return alert("Please fill all required fields.");
    }

    try {
      setLoading(true);

      // Check free ad limit
      const limitReached = await checkLimit(auth.currentUser.uid, mainCategory);
      if (limitReached && !isPromoted) {
        setLoading(false);
        return alert("Free ad limit reached. Promote ad to post more.");
      }

      // Upload images
      const imageUrls = await Promise.all(images.map(file => uploadToCloudinary(file)));

      // Save to Firestore
      await addDoc(collection(db, "products"), {
        mainCategory,
        subCategory,
        brand,
        model,
        condition,
        title,
        description,
        price: parseFloat(price),
        images: imageUrls,
        coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid,
        marketType,
        state: stateLocation,
        city: cityLocation,
        isPromoted,
        promotedAt: isPromoted ? new Date() : null,
        promotionExpiresAt: isPromoted ? new Date(Date.now() + 30*24*60*60*1000) : null,
        createdAt: serverTimestamp()
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
    <form onSubmit={handleAdd} style={{ maxWidth: 700, margin: "20px auto", padding: 20, borderRadius: 10, background: "#f9f9f9", display: "flex", flexDirection: "column", gap: 15, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <h2 style={{ textAlign: "center", color: "#0d6efd" }}>Post Ad ({marketType})</h2>

      {/* Category → Subcategory → Brand → Model */}
      <select value={mainCategory} onChange={e => { setMainCategory(e.target.value); setSubCategory(""); setBrand(""); setModel(""); }} required>
        <option value="">Select Category</option>
        {Object.keys(categoriesData).map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>

      {subCategories.length > 0 && (
        <select value={subCategory} onChange={e => { setSubCategory(e.target.value); setBrand(""); setModel(""); }} required>
          <option value="">Select Subcategory</option>
          {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
        </select>
      )}

      {brands.length > 0 && (
        <select value={brand} onChange={e => { setBrand(e.target.value); setModel(""); }} required>
          <option value="">Select Brand</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      )}

      {models.length > 0 && (
        <select value={model} onChange={e => setModel(e.target.value)} required>
          <option value="">Select Model</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )}

      {/* Condition */}
      <select value={condition} onChange={e => setCondition(e.target.value)} required>
        <option value="">Select Condition</option>
        <option value="New">Brand New</option>
        <option value="Used">Used</option>
      </select>

      {/* Title & Description */}
      <input type="text" placeholder="Title*" value={title} onChange={e => setTitle(e.target.value)} maxLength={70} required />
      <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} maxLength={850} />

      {/* Price */}
      <input type="number" placeholder="Price*" value={price} onChange={e => setPrice(e.target.value)} required />

      {/* Images */}
      <input type="file" multiple accept="image/*" onChange={handleFileChange} required />
      {previewImages.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {previewImages.map((src, i) => <img key={i} src={src} alt={`preview-${i}`} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 5, border: "1px solid #ccc" }} />)}
        </div>
      )}

      {/* Location */}
      <select value={stateLocation} onChange={e => { setStateLocation(e.target.value); setCityLocation(""); }} required>
        <option value="">Select State</option>
        {Object.keys(locations).map(st => <option key={st} value={st}>{st}</option>)}
      </select>

      {stateLocation && (
        <select value={cityLocation} onChange={e => setCityLocation(e.target.value)} required>
          <option value="">Select City</option>
          {locations[stateLocation].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Promotion */}
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