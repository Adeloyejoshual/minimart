// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef, useEffect } from "react";
import { useUser } from "@auth0/auth0-react";

import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { promotionPlans } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";   // create sim.js
import { years } from "../../config/years"; // create years.js

export default function AddMarketplaceProduct() {
  const { user } = useUser();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    title: "",
    description: "",
    price: "",
    bulk_price: "", // e.g., "₦1000/piece from 10 pieces"
    negotiation: "", // "Yes", "No", "Not sure"
    category: "",
    subcategory: "",
    brand: "",
    model: "",
    condition: "",
    used_detail: "",
    ram: "",
    storage: "",
    color: "",
    sim: "",
    engine: "",
    mileage: "",
    year: "",
    fuel_type: "",
    transmission: "",
    age_range: "",
    bedrooms: "",
    bathrooms: "",
    size: "",
    furnished: false,
    features: "",
    exchange_possible: false,
    location: "",
    state: "",
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
    delivery: {},
    screen_size: "",
    os: "",
    display_type: "",
    resolution: "",
    card_slot: "",
    main_camera: "",
    selfie_camera: "",
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);

  // Auto-fill name from Auth0
  useEffect(() => {
    if (user) {
      setForm(prev => ({ ...prev, name: user.name || prev.name }));
    }
  }, [user]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === "brand") setForm(prev => ({ ...prev, model: "" }));
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(files);
    setImagePreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category) {
      alert("Title, Price, and Category are required");
      return;
    }
    try {
      setLoading(true);
      const uploadedUrls = [];

      for (let file of imageFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: formData }
        );
        const data = await res.json();
        uploadedUrls.push(data.secure_url);
      }

      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, images: uploadedUrls }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to add product");

      alert("✅ Product added successfully!");
      setForm(prev => ({ ...prev, title: "", description: "", price: "", images: [], bulk_price: "", negotiation: "" }));
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const states = Object.keys(locationsByState);
  const cities = form.state ? locationsByState[form.state] : [];

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", padding: "20px", border: "1px solid #eee", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit}>
        {/* Name auto-filled */}
        <input
          type="text"
          placeholder="Your Name"
          value={form.name}
          onChange={e => handleChange("name", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Phone Number */}
        <input
          type="text"
          placeholder="Phone Number"
          value={form.phone_number}
          onChange={e => handleChange("phone_number", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Bulk Price */}
        <input
          type="text"
          placeholder="Bulk Price (e.g., ₦1,000/piece from 10 pieces)"
          value={form.bulk_price}
          onChange={e => handleChange("bulk_price", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Negotiation */}
        <select
          value={form.negotiation}
          onChange={e => handleChange("negotiation", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        >
          <option value="">Are you open to negotiation?</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
          <option value="Not sure">Not sure</option>
        </select>

        {/* Title */}
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={e => handleChange("title", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Description */}
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={e => handleChange("description", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Price */}
        <input
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={e => handleChange("price", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Category */}
        <select
          value={form.category}
          onChange={e => handleChange("category", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        >
          <option value="">Select Category</option>
          {Object.keys(categoryFields).map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>

        {/* Dynamic fields like brand, model, etc. */}
        {visibleFields.map(field => {
          switch (field) {
            case "brand":
              return (
                <select
                  key={field}
                  value={form.brand}
                  onChange={e => handleChange("brand", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Brand</option>
                  {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              );
            case "model":
              return (
                <select
                  key={field}
                  value={form.model}
                  onChange={e => handleChange("model", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Model</option>
                  {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              );
            case "sim":
              return (
                <select
                  key={field}
                  value={form.sim}
                  onChange={e => handleChange("sim", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select SIM</option>
                  {sims.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              );
            case "year":
              return (
                <select
                  key={field}
                  value={form.year}
                  onChange={e => handleChange("year", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Year</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              );
            // ...handle other fields like ram, storage, engine, fuel_type, features, etc.
            default:
              return (
                <input
                  key={field}
                  type="text"
                  placeholder={field.replace("_", " ").toUpperCase()}
                  value={form[field]}
                  onChange={e => handleChange(field, e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                />
              );
          }
        })}

        {/* State & City */}
        <select
          value={form.state}
          onChange={e => handleChange("state", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        >
          <option value="">Select State</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={form.location}
          onChange={e => handleChange("location", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        >
          <option value="">Select City</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Images */}
        <div style={{ marginBottom: "15px" }}>
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
            {imagePreviews.map((src, i) => (
              <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "5px" }} />
            ))}
          </div>
        </div>

        {/* Video Link */}
        <input
          type="text"
          placeholder="Video Link"
          value={form.video_link}
          onChange={e => handleChange("video_link", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Promotion */}
        <label style={{ display: "block", marginBottom: "15px" }}>
          <input type="checkbox" checked={form.promoted} onChange={e => handleChange("promoted", e.target.checked)} /> PROMOTED
        </label>
        {form.promoted && (
          <select value={form.promo_plan} onChange={e => handleChange("promo_plan", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
            <option value="">Select Promotion Plan</option>
            {promotionPlans.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "black", color: "#fff", border: "none", cursor: "pointer", fontSize: "16px" }}>
          {loading ? "Posting..." : "Post Ad"}
        </button>
      </form>
    </div>
  );
}