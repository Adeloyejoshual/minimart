// src/pages/MartProduct.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import categoriesData from "../config/categoriesData";
import productOptions from "../config/productOptions";
import axios from "axios";
import { compressImage } from "../utils/imageUtils"; // optional helper

export default function MartProduct() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    usedDetails: "",
    title: "",
    description: "",
    price: "",
    phone: "",
    images: [],
    previewImages: [],
    state: "",
    city: "",
    promotionPlan: null,
    isPromoted: false,
  });

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const handleFileChange = async e => {
    const files = Array.from(e.target.files);
    const compressed = await Promise.all(files.map(f => compressImage(f, 800)));
    setForm(prev => ({
      ...prev,
      images: compressed,
      previewImages: compressed.map(f => URL.createObjectURL(f)),
    }));
  };

  const validateStep = () => {
    const stepErrors = {};
    if (step === 0) {
      if (!form.mainCategory) stepErrors.mainCategory = "Select main category";
      if (!form.subCategory) stepErrors.subCategory = "Select subcategory";
    }
    if (step === 1) {
      if (!form.brand) stepErrors.brand = "Select brand";
      if (!form.model) stepErrors.model = "Select model";
      if (!form.condition) stepErrors.condition = "Select condition";
      if (form.condition === "Used" && !form.usedDetails) stepErrors.usedDetails = "Provide used details";
    }
    if (step === 2) {
      if (!form.title) stepErrors.title = "Enter title";
      if (!form.description) stepErrors.description = "Enter description";
      if (!form.price || isNaN(form.price)) stepErrors.price = "Enter valid price";
      if (!form.phone) stepErrors.phone = "Enter phone number";
      if (form.images.length === 0) stepErrors.images = "Upload at least one image";
      if (!form.state) stepErrors.state = "Select state";
      if (!form.city) stepErrors.city = "Select city";
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(prev => prev + 1);
  };

  const handlePrev = () => setStep(prev => Math.max(prev - 1, 0));

  // --- Submit to MongoDB API ---
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "images") {
          value.forEach((file, i) => formData.append("images", file));
        } else {
          formData.append(key, value);
        }
      });

      await axios.post(`${process.env.REACT_APP_API_URL}/products`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Product added successfully!");
      navigate("/minimart");
    } catch (err) {
      console.error(err);
      alert("Failed to add product: " + err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Multi-step UI ---
  const StepContent = () => {
    switch (step) {
      case 0:
        return (
          <div>
            <h3>Select Category</h3>
            <select value={form.mainCategory} onChange={e => handleChange("mainCategory", e.target.value)}>
              <option value="">Main Category</option>
              {categoriesData.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            {form.mainCategory && (
              <select value={form.subCategory} onChange={e => handleChange("subCategory", e.target.value)}>
                <option value="">Subcategory</option>
                {categoriesData.find(c => c.name === form.mainCategory)?.subcategories.map(sc => (
                  <option key={sc} value={sc}>{sc}</option>
                ))}
              </select>
            )}
            {errors.mainCategory && <p style={{color:"red"}}>{errors.mainCategory}</p>}
            {errors.subCategory && <p style={{color:"red"}}>{errors.subCategory}</p>}
          </div>
        );
      case 1:
        return (
          <div>
            <h3>Product Details</h3>
            <select value={form.brand} onChange={e => handleChange("brand", e.target.value)}>
              <option value="">Brand</option>
              {productOptions.brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={form.model} onChange={e => handleChange("model", e.target.value)}>
              <option value="">Model</option>
              {productOptions.models[form.brand]?.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={form.condition} onChange={e => handleChange("condition", e.target.value)}>
              <option value="">Condition</option>
              {productOptions.conditions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {form.condition === "Used" && (
              <select value={form.usedDetails} onChange={e => handleChange("usedDetails", e.target.value)}>
                <option value="">Used Details</option>
                {productOptions.usedDetails.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {errors.brand && <p style={{color:"red"}}>{errors.brand}</p>}
          </div>
        );
      case 2:
        return (
          <div>
            <h3>More Info</h3>
            <input type="text" placeholder="Title" value={form.title} onChange={e => handleChange("title", e.target.value)} />
            <textarea placeholder="Description" value={form.description} onChange={e => handleChange("description", e.target.value)} />
            <input type="number" placeholder="Price" value={form.price} onChange={e => handleChange("price", e.target.value)} />
            <input type="text" placeholder="Phone Number" value={form.phone} onChange={e => handleChange("phone", e.target.value)} />
            <input type="file" multiple accept="image/*" onChange={handleFileChange} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {form.previewImages.map((img, i) => <img key={i} src={img} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />)}
            </div>
            <input type="text" placeholder="State" value={form.state} onChange={e => handleChange("state", e.target.value)} />
            <input type="text" placeholder="City" value={form.city} onChange={e => handleChange("city", e.target.value)} />
            {errors.title && <p style={{color:"red"}}>{errors.title}</p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "50px auto", padding: 20, background: "#fff", borderRadius: 10 }}>
      <h2 style={{ marginBottom: 20 }}>Sell Product (MongoDB)</h2>

      <StepContent />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        {step > 0 && <button onClick={handlePrev}>Back</button>}
        {step < 2 && <button onClick={handleNext}>Next</button>}
        {step === 2 && <button onClick={handleSubmit} disabled={loading}>{loading ? "Submitting..." : "Publish"}</button>}
      </div>
    </div>
  );
}