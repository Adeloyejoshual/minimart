// src/pages/AddProduct.js
import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";
import categoriesData from "../config/categoriesData";
import ProductOptionsSelector from "../components/ProductOptionsSelector";

const AddProduct = () => {
  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    features: {},
    price: "",
    images: [],
    previewImages: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  const subCategories = form.mainCategory ? categoriesData[form.mainCategory]?.subcategories || [] : [];

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError("");
    if (field === "mainCategory") setForm(prev => ({ ...prev, subCategory: "", brand: "", model: "", condition: "", features: {} }));
  };

  const handlePriceChange = e => {
    let val = e.target.value.replace(/,/g, "");
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setForm(prev => ({ ...prev, price: Number(val).toLocaleString("en-US", { maximumFractionDigits: 2 }) }));
      setError("");
    }
  };

  const handleFileChange = e => {
    const files = Array.from(e.target.files);
    setForm(prev => ({
      ...prev,
      images: [...prev.images, ...files],
      previewImages: [...prev.previewImages, ...files.map(f => URL.createObjectURL(f))],
    }));
  };

  const removeImage = idx => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
      previewImages: prev.previewImages.filter((_, i) => i !== idx),
    }));
  };

  // Validation
  const validateForm = () => {
    if (!form.mainCategory) { setError("Select main category"); return false; }
    if (!form.subCategory) { setError("Select subcategory"); return false; }
    if (!form.price || form.images.length === 0) { setError("Add price and at least one image"); return false; }
    return true;
  };

  const handleAddProduct = async e => {
    e.preventDefault();
    if (!auth.currentUser) { setError("Login required."); return; }
    if (!validateForm()) return;

    try {
      setLoading(true);
      const imageUrls = await Promise.all(form.images.map(f => uploadToCloudinary(f)));

      const docRef = await addDoc(collection(db, "products"), {
        ...form,
        price: parseFloat(form.price.replace(/,/g, "")),
        images: imageUrls,
        coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid,
        marketType,
        createdAt: serverTimestamp(),
      });

      alert(`Product added! ID: ${docRef.id}`);
      setForm({
        mainCategory: "",
        subCategory: "",
        brand: "",
        model: "",
        condition: "",
        features: {},
        price: "",
        images: [],
        previewImages: [],
      });
      navigate(`/${marketType}`);
    } catch (err) {
      console.error(err);
      setError("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => form.previewImages.forEach(url => URL.revokeObjectURL(url)), [form.previewImages]);

  return (
    <div style={{ maxWidth: 550, margin: "40px auto", padding: 25, borderRadius: 12, background: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,0.1)" }}>
      <h2 style={{ textAlign: "center", color: "#0D6EFD", marginBottom: 20 }}>Post Product</h2>

      {error && <div style={{ background: "#ffe6e6", color: "red", padding: 10, borderRadius: 6, marginBottom: 15 }}>{error}</div>}

      <form onSubmit={handleAddProduct} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {/* Main Category */}
        <div>
          <label style={{ fontWeight: 500 }}>Category*</label>
          <select value={form.mainCategory} onChange={e => handleChange("mainCategory", e.target.value)} style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc", width: "100%" }}>
            <option value="">Select Main Category</option>
            {Object.keys(categoriesData).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {/* Subcategory */}
        {subCategories.length > 0 && (
          <div>
            <label style={{ fontWeight: 500 }}>Subcategory*</label>
            <select value={form.subCategory} onChange={e => handleChange("subCategory", e.target.value)} style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc", width: "100%" }}>
              <option value="">Select Subcategory</option>
              {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>
        )}

        {/* Product Options Selector */}
        {form.subCategory && (
          <ProductOptionsSelector
            mainCategory={form.mainCategory}
            subCategory={form.subCategory}
            onChange={data => setForm(prev => ({
              ...prev,
              brand: data.brand,
              model: data.model,
              condition: data.condition,
              features: data.options?.features || {}
            }))}
          />
        )}

        {/* Price */}
        <div>
          <label style={{ fontWeight: 500 }}>Price*</label>
          <input type="text" value={form.price} onChange={handlePriceChange} placeholder="₦0.00" style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc", width: "100%" }} />
        </div>

        {/* Images */}
        <div>
          <label style={{ fontWeight: 500 }}>Images*</label>
          <input type="file" multiple accept="image/*" onChange={handleFileChange} />
          {form.previewImages.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              {form.previewImages.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={src} alt={`preview-${i}`} style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 6, border: "1px solid #ccc" }} />
                  <button type="button" onClick={() => removeImage(i)} style={{ position: "absolute", top: -5, right: -5, background: "red", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer" }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} style={{ padding: "12px 20px", background: "#0D6EFD", color: "#fff", border: "none", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer", fontWeight: 500 }}>
          {loading ? "Uploading..." : "Add Product"}
        </button>
      </form>
    </div>
  );
};

export default AddProduct;