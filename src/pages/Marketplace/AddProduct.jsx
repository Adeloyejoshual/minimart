// src/pages/Marketplace/AddMarketplaceProduct.jsx
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
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

// Example FullPageSelector component
function FullPageSelector({ title, options, field, onSelect, onBack }) {
  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "#fff",
      zIndex: 1000,
      padding: "20px",
      overflowY: "auto"
    }}>
      <button onClick={onBack} style={{ marginBottom: "20px" }}>Back</button>
      <h3 style={{ marginBottom: "15px" }}>{title}</h3>
      {options.map((opt) => (
        <div key={opt} style={{ padding: "10px 0", borderBottom: "1px solid #eee", cursor: "pointer" }}
             onClick={() => onSelect(field, opt)}>
          {opt}
        </div>
      ))}
    </div>
  );
}

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
    additional_phone_number: "",
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
  const [activeSelector, setActiveSelector] = useState(null);
  const fileInputRef = useRef(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "brand") setForm((prev) => ({ ...prev, model: "" }));
    if (field === "state") setForm((prev) => ({ ...prev, city: "" }));
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const handleSelect = (field, value) => {
    handleChange(field, value);
    setActiveSelector(null);
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
      setForm((prev) => ({
        ...prev,
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
        location: "",
        state: "",
        city: "",
        images: [],
        video_link: "",
        promoted: false,
        promo_plan: "",
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
  const availableCities = form.state ? locationsByState[form.state] || [] : [];

  // If a selector is active, show only the full page selector
  if (activeSelector) {
    switch (activeSelector) {
      case "category":
        return (
          <FullPageSelector
            title="Select Category"
            options={Object.keys(categoryFields)}
            field="category"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "brand":
        return (
          <FullPageSelector
            title="Select Brand"
            options={availableBrands}
            field="brand"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "model":
        return (
          <FullPageSelector
            title="Select Model"
            options={availableModels}
            field="model"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "condition":
        return (
          <FullPageSelector
            title="Select Condition"
            options={conditions}
            field="condition"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "used_detail":
        return (
          <FullPageSelector
            title="Select Used Detail"
            options={usedDetails}
            field="used_detail"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "ram":
        return (
          <FullPageSelector
            title="Select RAM"
            options={ramOptions}
            field="ram"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "storage":
        return (
          <FullPageSelector
            title="Select Storage"
            options={storageOptions}
            field="storage"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "color":
        return (
          <FullPageSelector
            title="Select Color"
            options={colors}
            field="color"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "sim":
        return (
          <FullPageSelector
            title="Select SIM"
            options={availableSims}
            field="sim"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "year":
        return (
          <FullPageSelector
            title="Select Year"
            options={availableYears}
            field="year"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "engine":
        return (
          <FullPageSelector
            title="Select Engine"
            options={engines}
            field="engine"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "fuel_type":
        return (
          <FullPageSelector
            title="Select Fuel Type"
            options={fuelTypes}
            field="fuel_type"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "features":
        return (
          <FullPageSelector
            title="Select Features"
            options={categoryFeatures}
            field="features"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "state":
        return (
          <FullPageSelector
            title="Select State"
            options={Object.keys(locationsByState)}
            field="state"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "city":
        return (
          <FullPageSelector
            title="Select City"
            options={availableCities}
            field="city"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      case "promo_plan":
        return (
          <FullPageSelector
            title="Select Promotion Plan"
            options={promotionPlans.map(p => p.name)}
            field="promo_plan"
            onSelect={handleSelect}
            onBack={() => setActiveSelector(null)}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", padding: "20px", border: "1px solid #eee", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit}>

        {/* Title & Description */}
        <input type="text" placeholder="Title" value={form.title} onChange={(e) => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => handleChange("description", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Price & Bulk */}
        <input type="number" placeholder="Price" value={form.price} onChange={(e) => handleChange("price", e.target.value)} style={{ width: "48%", padding: "10px", marginBottom: "15px", marginRight: "4%" }} />
        <input type="number" placeholder="Bulk from (pieces)" value={form.bulk_price_from} onChange={(e) => handleChange("bulk_price_from", e.target.value)} style={{ width: "24%", padding: "10px", marginBottom: "15px", marginRight: "2%" }} />
        <input type="number" placeholder="Per piece (₦)" value={form.bulk_price_per_piece} onChange={(e) => handleChange("bulk_price_per_piece", e.target.value)} style={{ width: "24%", padding: "10px", marginBottom: "15px" }} />

        {/* Negotiation */}
        <select value={form.negotiation} onChange={(e) => handleChange("negotiation", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
          <option value="">Are you open to negotiation?</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
          <option value="Not sure">Not sure</option>
        </select>

        {/* Poster & Phones */}
        <input type="text" placeholder="Poster Name" value={form.poster_name} disabled style={{ width: "100%", padding: "10px", marginBottom: "15px", background: "#eee" }} />
        <input type="text" placeholder="Phone Number" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} style={{ width: "48%", padding: "10px", marginBottom: "15px", marginRight: "4%" }} />
        <input type="text" placeholder="Additional Phone Number" value={form.additional_phone_number} onChange={(e) => handleChange("additional_phone_number", e.target.value)} style={{ width: "48%", padding: "10px", marginBottom: "15px" }} />

        {/* Category Selector */}
        <div onClick={() => setActiveSelector("category")} style={{ width: "100%", padding: "10px", marginBottom: "15px", border: "1px solid #ccc", cursor: "pointer" }}>
          {form.category || "Select Category"}
        </div>

        {/* Dynamic Fields */}
        {visibleFields.map((field) => (
          <div
            key={field}
            onClick={() => {
              if (["brand","model","condition","used_detail","ram","storage","color","sim","features","engine","fuel_type","year","state","city","promo_plan"].includes(field))
                setActiveSelector(field);
            }}
            style={{ width: "100%", padding: "10px", marginBottom: "15px", border: "1px solid #ccc", cursor: ["brand","model","condition","used_detail","ram","storage","color","sim","features","engine","fuel_type","year","state","city","promo_plan"].includes(field) ? "pointer" : "auto" }}
          >
            {form[field] || field.replace("_", " ").toUpperCase()}
          </div>
        ))}

        {/* Location / Address */}
        <input type="text" placeholder="Location / Address" value={form.location} onChange={(e) => handleChange("location", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

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
        <input type="text" placeholder="Video Link" value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

        {/* Submit */}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "black", color: "#fff", border: "none", cursor: "pointer", fontSize: "16px" }}>
          {loading ? "Posting..." : "Post Ad"}
        </button>
      </form>
    </div>
  );
}