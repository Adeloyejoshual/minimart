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
import "./AddProduct.css";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();

  const [step, setStep] = useState(1); // 1 = category, 2 = subcategory, 3 = full form
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

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "brand") setForm((prev) => ({ ...prev, model: "" }));
    if (field === "description") autoGenerateTitle(value);
  };

  // Auto-generate title from description
  const autoGenerateTitle = (desc) => {
    if (!form.title || form.title === "") {
      const firstLine = desc.split("\n")[0] || "";
      setForm((prev) => ({ ...prev, title: firstLine.slice(0, 60) }));
    }
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category || !form.subcategory) {
      alert("Title, Price, Category, and Subcategory are required");
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
      // reset form except auto-filled user info
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
      setStep(1); // back to category selection
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

  // Smart description suggestions
  const addSuggestion = (text) => {
    setForm((prev) => ({ ...prev, description: prev.description + "\n" + text }));
  };

  return (
    <div className="add-product-container">
      <h2 className="form-title">Post Marketplace Ad</h2>

      {/* Step 1: Category */}
      {step === 1 && (
        <div className="category-grid">
          {Object.keys(categoryFields).map((cat) => (
            <div
              key={cat}
              className="category-tile"
              onClick={() => {
                setForm((prev) => ({ ...prev, category: cat }));
                setStep(2);
              }}
            >
              {cat}
            </div>
          ))}
        </div>
      )}

      {/* Step 2: Subcategory */}
      {step === 2 && (
        <div className="category-grid">
          {(categoryFields[form.category] || []).map((sub) => (
            <div
              key={sub}
              className="category-tile"
              onClick={() => {
                setForm((prev) => ({ ...prev, subcategory: sub }));
                setStep(3);
              }}
            >
              {sub}
            </div>
          ))}
          <button className="back-btn" onClick={() => setStep(1)}>Back</button>
        </div>
      )}

      {/* Step 3: Full Form */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="full-form">
          {/* Dynamic Fields */}
          {visibleFields.map((field) => {
            switch (field) {
              case "brand":
                return (
                  <select key={field} value={form.brand} onChange={(e) => handleChange("brand", e.target.value)}>
                    <option value="">Select Brand</option>
                    {availableBrands.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                );
              case "model":
                return (
                  <select key={field} value={form.model} onChange={(e) => handleChange("model", e.target.value)}>
                    <option value="">Select Model</option>
                    {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                );
              case "description":
                return (
                  <textarea
                    key={field}
                    placeholder="Description"
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                  />
                );
              case "features":
                return (
                  <select key={field} value={form.features} onChange={(e) => handleChange("features", e.target.value)}>
                    <option value="">Select Feature</option>
                    {categoryFeatures.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                );
              default:
                return (
                  <input
                    key={field}
                    placeholder={field.replace("_", " ")}
                    value={form[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                  />
                );
            }
          })}

          {/* Smart suggestions */}
          <div className="suggestions">
            <button type="button" onClick={() => addSuggestion("Add condition")}>Add Condition</button>
            <button type="button" onClick={() => addSuggestion("Battery Health")}>Battery Health</button>
            <button type="button" onClick={() => addSuggestion("Accessories")}>Accessories</button>
          </div>

          {/* Images */}
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
          <div className="image-preview">
            {imagePreviews.map((src, i) => <img key={i} src={src} alt="Preview" />)}
          </div>

          <button type="submit" disabled={loading}>{loading ? "Posting..." : "Post Ad"}</button>
        </form>
      )}
    </div>
  );
}