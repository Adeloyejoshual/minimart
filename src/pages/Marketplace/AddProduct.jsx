// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
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
import { sims } from "../../config/sim";
import { years } from "../../config/years";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
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
    phone_number: user?.phone_number || "",
    additional_phone: "",
    poster_name: user?.name || "",
    state: "",
    city: "",
    location: "",
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
    exchange_possible: false,
    delivery: {},
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "brand") setForm((prev) => ({ ...prev, model: "" }));
    if (field === "state") setForm((prev) => ({ ...prev, city: "" }));
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 10) {
      alert("You can upload maximum 10 images");
      return;
    }
    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.title || form.title.trim().length < 30)
      errors.title = "Title must be at least 30 characters";
    if (!form.description || form.description.trim().length < 50)
      errors.description = "Description must be at least 50 characters";
    if (!form.price || Number(form.price) <= 0)
      errors.price = "Price must be greater than 0";
    if (!form.phone_number || !/^\d{10,11}$/.test(form.phone_number))
      errors.phone_number = "Enter a valid phone number";
    if (!form.category) errors.category = "Category is required";
    if (!form.state) errors.state = "Select a state";
    if (!form.city) errors.city = "Select a city";
    if (!imageFiles.length) errors.images = "Upload at least 1 image";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      alert(Object.values(errors)[0]);
      return;
    }

    try {
      setLoading(true);
      const uploadedUrls = [];
      for (let file of imageFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "upload_preset",
          import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        );
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: formData }
        );
        const data = await res.json();
        uploadedUrls.push(data.secure_url);
      }

      const productData = { ...form, images: uploadedUrls };

      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to add product");

      alert("✅ Product added successfully!");
      setForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        price: "",
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
        state: "",
        city: "",
        location: "",
        images: [],
        video_link: "",
        promoted: false,
        promo_plan: "",
        exchange_possible: false,
        delivery: {},
      }));
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
  const availableSims = sims || [];
  const availableYears = years || [];
  const availableCities = locationsByState[form.state] || [];

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", padding: "20px", border: "1px solid #eee", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit}>

        {/* Title & Description */}
        <input type="text" placeholder="Title" value={form.title} onChange={(e) => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => handleChange("description", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Price */}
        <input type="number" placeholder="Price" value={form.price} onChange={(e) => handleChange("price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Phone Numbers */}
        <input type="text" placeholder="Phone Number" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        <input type="text" placeholder="Additional Phone Number" value={form.additional_phone} onChange={(e) => handleChange("additional_phone", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Poster Name */}
        <input type="text" placeholder="Poster Name" value={form.poster_name} readOnly style={{ width: "100%", padding: "10px", marginBottom: "15px", background: "#f5f5f5" }} />

        {/* Category */}
        <select value={form.category} onChange={(e) => handleChange("category", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
          <option value="">Select Category</option>
          {Object.keys(categoryFields).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>

        {/* Dynamic Fields */}
        {visibleFields.map((field) => {
          switch (field) {
            case "brand":
              return (
                <select key={field} value={form.brand} onChange={(e) => handleChange("brand", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Brand</option>
                  {availableBrands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              );
            case "model":
              return (
                <select key={field} value={form.model} onChange={(e) => handleChange("model", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Model</option>
                  {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              );
            case "condition":
              return (
                <select key={field} value={form.condition} onChange={(e) => handleChange("condition", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Condition</option>
                  {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              );
            case "used_detail":
              return (
                <select key={field} value={form.used_detail} onChange={(e) => handleChange("used_detail", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Detail if Used</option>
                  {usedDetails.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              );
            case "ram":
              return (
                <select key={field} value={form.ram} onChange={(e) => handleChange("ram", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select RAM</option>
                  {ramOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              );
            case "storage":
              return (
                <select key={field} value={form.storage} onChange={(e) => handleChange("storage", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Storage</option>
                  {storageOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              );
            case "color":
              return (
                <select key={field} value={form.color} onChange={(e) => handleChange("color", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Color</option>
                  {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              );
            case "sim":
              return (
                <select key={field} value={form.sim} onChange={(e) => handleChange("sim", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select SIM</option>
                  {availableSims.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              );
            case "year":
              return (
                <select key={field} value={form.year} onChange={(e) => handleChange("year", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Year</option>
                  {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              );
            case "engine":
              return (
                <select key={field} value={form.engine} onChange={(e) => handleChange("engine", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Engine</option>
                  {engines.map((en) => <option key={en} value={en}>{en}</option>)}
                </select>
              );
            case "fuel_type":
              return (
                <select key={field} value={form.fuel_type} onChange={(e) => handleChange("fuel_type", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Fuel Type</option>
                  {fuelTypes.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              );
            case "features":
              return (
                <select key={field} value={form.features} onChange={(e) => handleChange("features", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
                  <option value="">Select Features</option>
                  {categoryFeatures.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              );
            case "exchange_possible":
            case "promoted":
              return (
                <label key={field} style={{ display: "block", marginBottom: "15px" }}>
                  <input type="checkbox" checked={form[field]} onChange={(e) => handleChange(field, e.target.checked)} /> {field.replace("_", " ").toUpperCase()}
                </label>
              );
            default:
              return null;
          }
        })}

        {/* State / City */}
        <select value={form.state} onChange={(e) => handleChange("state", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
          <option value="">Select State</option>
          {Object.keys(locationsByState).map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        <select value={form.city} onChange={(e) => handleChange("city", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
          <option value="">Select City</option>
          {availableCities.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
        </select>

        {/* Location / Address */}
        <input type="text" placeholder="Location / Address" value={form.location} onChange={(e) => handleChange("location", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Images */}
        <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} style={{ marginBottom: "15px" }} />
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>
          {imagePreviews.map((src, i) => (
            <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "5px" }} />
          ))}
        </div>

        {/* Video Link */}
        <input type="text" placeholder="Video Link" value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Promotion Plan */}
        <label style={{ display: "block", marginBottom: "15px" }}>
          <input type="checkbox" checked={form.promoted} onChange={(e) => handleChange("promoted", e.target.checked)} /> Promote Ad
        </label>
        {form.promoted && (
          <select value={form.promo_plan} onChange={(e) => handleChange("promo_plan", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
            <option value="">Select Promotion Plan</option>
            {promotionPlans.map((p) => <option key={p} value={p}>{p}</option>)}
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