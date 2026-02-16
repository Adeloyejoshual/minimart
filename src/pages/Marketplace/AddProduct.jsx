// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef, useEffect } from "react";
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
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    bulk_price: { from: "", per_piece: "" },
    negotiation: "",
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
    phone_number: "",
    poster_name: "",
    location: "",
    state: "",
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
    delivery: {},
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoFillVisible, setAutoFillVisible] = useState(false);
  const [autoFillFields, setAutoFillFields] = useState({});
  const fileInputRef = useRef(null);

  // Load previous auto-fill data
  useEffect(() => {
    const savedAutoFill = localStorage.getItem("autoFillData");
    if (savedAutoFill) {
      setAutoFillFields(JSON.parse(savedAutoFill));
      setAutoFillVisible(true);
    }
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "brand") setForm((prev) => ({ ...prev, model: "" }));
  };

  const handleAutoFillChange = (field, value) => {
    handleChange(field, value);
    const updated = { ...autoFillFields, [field]: value };
    setAutoFillFields(updated);
    localStorage.setItem("autoFillData", JSON.stringify(updated));
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
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

      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, images: uploadedUrls }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to add product");

      alert("✅ Product added successfully!");
      // reset form
      setForm({
        title: "",
        description: "",
        price: "",
        bulk_price: { from: "", per_piece: "" },
        negotiation: "",
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
        phone_number: "",
        poster_name: "",
        location: "",
        state: "",
        images: [],
        video_link: "",
        promoted: false,
        promo_plan: "",
        delivery: {},
      });
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

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", padding: "20px", border: "1px solid #eee", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Post Marketplace Ad</h2>

      {/* Auto-fill */}
      {autoFillVisible && Object.keys(autoFillFields).length > 0 && (
        <div style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "15px", borderRadius: "5px", background: "#f9f9f9" }}>
          <strong>👌 We’ve automatically filled in some fields for you!</strong>
          <button onClick={() => setAutoFillVisible(false)} style={{ float: "right" }}>Hide</button>
          <div style={{ marginTop: "10px" }}>
            {Object.entries(autoFillFields).map(([field, value]) => (
              <div key={field} style={{ marginBottom: "8px" }}>
                <label style={{ display: "block", fontSize: "14px", color: "#555" }}>
                  {field.replace("_", " ").toUpperCase()}
                </label>
                <input type="text" value={form[field] || value} onChange={(e) => handleAutoFillChange(field, e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "3px" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Fields */}
        <input type="text" placeholder="Title" value={form.title} onChange={(e) => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => handleChange("description", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        <input type="number" placeholder="Price" value={form.price} onChange={(e) => handleChange("price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Bulk price */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <input type="number" placeholder="From X pieces" value={form.bulk_price.from} onChange={(e) => handleChange("bulk_price", { ...form.bulk_price, from: e.target.value })} style={{ flex: 1, padding: "10px" }} />
          <input type="number" placeholder="₦ per piece" value={form.bulk_price.per_piece} onChange={(e) => handleChange("bulk_price", { ...form.bulk_price, per_piece: e.target.value })} style={{ flex: 1, padding: "10px" }} />
        </div>

        {/* Negotiation */}
        <select value={form.negotiation} onChange={(e) => handleChange("negotiation", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
          <option value="">Are you open to negotiation?</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
          <option value="Not sure">Not sure</option>
        </select>

        {/* Category */}
        <select value={form.category} onChange={(e) => handleChange("category", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
          <option value="">Select Category</option>
          {Object.keys(categoryFields).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>

        {/* Dynamic Fields */}
        {visibleFields.map((field) => {
          switch (field) {
            case "brand":
              return <select key={field} value={form.brand} onChange={(e) => handleChange("brand", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}><option value="">Select Brand</option>{availableBrands.map((b) => <option key={b} value={b}>{b}</option>)}</select>;
            case "model":
              return <select key={field} value={form.model} onChange={(e) => handleChange("model", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}><option value="">Select Model</option>{availableModels.map((m) => <option key={m} value={m}>{m}</option>)}</select>;
            case "year":
              return <select key={field} value={form.year} onChange={(e) => handleChange("year", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}><option value="">Select Year</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>;
            case "sim":
              return <select key={field} value={form.sim} onChange={(e) => handleChange("sim", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}><option value="">Select SIM</option>{sims.map((s) => <option key={s} value={s}>{s}</option>)}</select>;
            default:
              return null;
          }
        })}

        {/* Images */}
        <div style={{ marginBottom: "15px" }}>
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
            {imagePreviews.map((src, i) => <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "5px" }} />)}
          </div>
        </div>

        {/* Video */}
        <input type="text" placeholder="Video Link" value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Delivery */}
        <textarea placeholder="Add delivery options" value={form.delivery.options || ""} onChange={(e) => handleChange("delivery", { ...form.delivery, options: e.target.value })} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Post Button */}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "black", color: "#fff", border: "none", cursor: "pointer", fontSize: "16px" }}>
          {loading ? "Posting..." : "Post Ad"}
        </button>
      </form>
    </div>
  );
}