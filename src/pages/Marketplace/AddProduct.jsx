import { useState, useRef, useEffect } from "react";
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
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";
import "./AddProduct.css";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    bulk_price_from: "",
    bulk_price_per_piece: "",
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
    phone_number: user?.phone_number || "",
    poster_name: user?.name || "",
    location: "",
    state: "",
    country: "Nigeria",
    city: "",
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
    delivery: {},
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // ---------- CATEGORY SMART SUGGESTIONS ----------
  const suggestionsByCategory = {
    "Phones & Tablets": [
      "Add condition (New, Used, Refurbished)",
      "Include battery health",
      "List accessories included"
    ],
    Vehicles: [
      "Include mileage, year, transmission",
      "Mention fuel type",
      "Highlight service history"
    ],
    Property: [
      "Number of bedrooms/bathrooms",
      "Furnished/unfurnished details",
      "Nearby landmarks"
    ]
  };
  const categorySuggestions = suggestionsByCategory[form.category] || [];

  // ---------- HANDLERS ----------
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === "brand") setForm(prev => ({ ...prev, model: "" }));
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(files);
    setImagePreviews(files.map(file => URL.createObjectURL(file)));
  };

  const handleImproveDescription = async () => {
    if (!form.description) return;
    try {
      setLoading(true);
      const res = await fetch("/api/ai/improve-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.description, category: form.category }),
      });
      const data = await res.json();
      if (data.improved) setForm(prev => ({ ...prev, description: data.improved }));
    } catch (err) {
      console.error(err);
      alert("Failed to improve description");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTitle = async () => {
    if (!form.description) return;
    try {
      setLoading(true);
      const res = await fetch("/api/ai/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: form.description }),
      });
      const data = await res.json();
      if (data.title) setForm(prev => ({ ...prev, title: data.title }));
    } catch (err) {
      console.error(err);
      alert("Failed to generate title");
    } finally {
      setLoading(false);
    }
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
        const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`, { method: "POST", body: formData });
        const data = await res.json();
        uploadedUrls.push(data.secure_url);
      }

      const productData = {
        ...form,
        images: uploadedUrls,
        bulk_price: {
          from: form.bulk_price_from || null,
          per_piece: form.bulk_price_per_piece || null,
        },
      };

      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to add product");

      alert("✅ Product added successfully!");
      setForm(prev => ({ ...prev,
        title: "", description: "", price: "", bulk_price_from: "", bulk_price_per_piece: "",
        negotiation: "", category: "", subcategory: "", brand: "", model: "", condition: "",
        used_detail: "", ram: "", storage: "", color: "", sim: "", engine: "", mileage: "",
        year: "", fuel_type: "", transmission: "", age_range: "", bedrooms: "", bathrooms: "",
        size: "", furnished: false, features: "", exchange_possible: false, location: "",
        state: "", city: "", images: [], video_link: "", promoted: false, promo_plan: "", delivery: {}
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

  // ---------- DYNAMIC FIELD OPTIONS ----------
  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableSims = sims || [];
  const availableYears = years || [];

  // ---------- SEO HINTS ----------
  const seoHints = [];
  if (form.title && form.title.length < 10) seoHints.push("Title is too short for SEO");
  if (form.description && form.description.length < 50) seoHints.push("Description is short, add details for better ranking");
  if (form.images.length === 0) seoHints.push("Add at least one image for better SEO");

  return (
    <div className="add-product-container">
      <h2>Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit}>

        {/* Title */}
        <div className="flex-row">
          <input type="text" placeholder="Title" value={form.title} onChange={e => handleChange("title", e.target.value)} />
          <button type="button" className="button-secondary" onClick={handleGenerateTitle}>✨ Generate Title</button>
        </div>

        {/* Description */}
        <textarea placeholder="Description" value={form.description} onChange={e => handleChange("description", e.target.value)} />
        <button type="button" className="button-secondary" onClick={handleImproveDescription}>🤖 Improve Description</button>

        {/* Smart suggestions */}
        {categorySuggestions.length > 0 &&
          <div className="suggestions">
            {categorySuggestions.map((s, i) => <p key={i}>💡 {s}</p>)}
          </div>
        }

        {/* Price & Bulk */}
        <div className="flex-row">
          <input type="number" placeholder="Price" value={form.price} onChange={e => handleChange("price", e.target.value)} />
          <input type="number" placeholder="Bulk from" value={form.bulk_price_from} onChange={e => handleChange("bulk_price_from", e.target.value)} />
          <input type="number" placeholder="Per piece (₦)" value={form.bulk_price_per_piece} onChange={e => handleChange("bulk_price_per_piece", e.target.value)} />
        </div>

        {/* Negotiation */}
        <select value={form.negotiation} onChange={e => handleChange("negotiation", e.target.value)}>
          <option value="">Are you open to negotiation?</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
          <option value="Not sure">Not sure</option>
        </select>

        {/* Category */}
        <select value={form.category} onChange={e => handleChange("category", e.target.value)}>
          <option value="">Select Category</option>
          {Object.keys(categoryFields).map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>

        {/* Dynamic Fields */}
        {visibleFields.map(field => {
          switch(field){
            case "brand":
              return <select key={field} value={form.brand} onChange={e => handleChange("brand", e.target.value)}>
                <option value="">Select Brand</option>
                {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            case "model":
              return <select key={field} value={form.model} onChange={e => handleChange("model", e.target.value)}>
                <option value="">Select Model</option>
                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            case "sim":
              return <select key={field} value={form.sim} onChange={e => handleChange("sim", e.target.value)}>
                <option value="">Select SIM</option>
                {availableSims.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            case "year":
              return <select key={field} value={form.year} onChange={e => handleChange("year", e.target.value)}>
                <option value="">Select Year</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            case "condition":
              return <select key={field} value={form.condition} onChange={e => handleChange("condition", e.target.value)}>
                <option value="">Select Condition</option>
                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            default:
              return <input key={field} type="text" placeholder={field.replace("_"," ").toUpperCase()} value={form[field]} onChange={e => handleChange(field, e.target.value)} />
          }
        })}

        {/* Images */}
        <div className="images-section">
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
          <div className="preview-images">
            {imagePreviews.map((src,i) => <img key={i} src={src} alt="Preview" />)}
          </div>
        </div>

        {/* Video */}
        <input type="text" placeholder="Video Link" value={form.video_link} onChange={e => handleChange("video_link", e.target.value)} />

        {/* SEO Hints */}
        {seoHints.length > 0 &&
          <div className="seo-hints">
            {seoHints.map((hint,i) => <p key={i}>⚠️ {hint}</p>)}
          </div>
        }

        {/* Submit */}
        <button type="submit" disabled={loading}>{loading ? "Posting..." : "Post Ad"}</button>
      </form>
    </div>
  );
}