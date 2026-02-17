// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { categoryFields } from "../../config/categoryFields";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { locationsByState } from "../../config/locationsByState";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { years } from "../../config/years";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    phone_number: user?.phone_number || "",
    poster_name: user?.name || "",
    category: "",
    brand: "",
    model: "",
    ram: "",
    storage: "",
    color: "",
    features: "",
    condition: "",
    used_detail: "",
    year: "",
    engine: "",
    fuel_type: "",
    state: "",
    city: "",
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [step, setStep] = useState(null);
  const fileInputRef = useRef(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "brand") setForm((prev) => ({ ...prev, model: "" }));
    if (field === "state") setForm((prev) => ({ ...prev, city: "" }));
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(files);
    setImagePreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category) {
      alert("Title, Price, and Category are required");
      return;
    }
    alert("✅ Form submitted! You can connect Cloudinary/API next.");
  };

  // Dynamic options
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFieldsVisible = categoryFields[form.category] || [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableCities = form.state ? locationsByState[form.state] || [] : [];

  // Full-page selector component
  const FullPageSelector = ({ title, options, onSelect, onClose }) => (
    <div className="fps-overlay">
      <button className="fps-back" onClick={onClose}>Back</button>
      <h2 className="fps-title">{title}</h2>
      <div className="fps-options">
        {options.map((opt) => (
          <button key={opt} onClick={() => onSelect(opt)} className="fps-option">
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="form-container">
      <h2 className="form-header">Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit}>
        {/* Basic Inputs */}
        <input type="text" placeholder="Title" value={form.title} onChange={(e) => handleChange("title", e.target.value)} className="form-input"/>
        <textarea placeholder="Description" value={form.description} onChange={(e) => handleChange("description", e.target.value)} className="form-input"/>
        <input type="text" placeholder="Phone Number" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} className="form-input"/>
        <input type="number" placeholder="Price" value={form.price} onChange={(e) => handleChange("price", e.target.value)} className="form-input"/>

        {/* Full-page selector triggers */}
        <button type="button" className="selector-btn" onClick={() => setStep("category")}>{form.category || "Select Category"}</button>
        {categoryFieldsVisible.includes("brand") && <button type="button" className="selector-btn" onClick={() => setStep("brand")}>{form.brand || "Select Brand"}</button>}
        {categoryFieldsVisible.includes("model") && form.brand && <button type="button" className="selector-btn" onClick={() => setStep("model")}>{form.model || "Select Model"}</button>}
        {categoryFieldsVisible.includes("ram") && <button type="button" className="selector-btn" onClick={() => setStep("ram")}>{form.ram || "Select RAM"}</button>}
        {categoryFieldsVisible.includes("storage") && <button type="button" className="selector-btn" onClick={() => setStep("storage")}>{form.storage || "Select Storage"}</button>}
        {categoryFieldsVisible.includes("color") && <button type="button" className="selector-btn" onClick={() => setStep("color")}>{form.color || "Select Color"}</button>}
        {categoryFieldsVisible.includes("features") && <button type="button" className="selector-btn" onClick={() => setStep("features")}>{form.features || "Select Features"}</button>}
        {categoryFieldsVisible.includes("condition") && <button type="button" className="selector-btn" onClick={() => setStep("condition")}>{form.condition || "Select Condition"}</button>}
        {categoryFieldsVisible.includes("year") && <button type="button" className="selector-btn" onClick={() => setStep("year")}>{form.year || "Select Year"}</button>}
        {categoryFieldsVisible.includes("engine") && <button type="button" className="selector-btn" onClick={() => setStep("engine")}>{form.engine || "Select Engine"}</button>}
        {categoryFieldsVisible.includes("fuel_type") && <button type="button" className="selector-btn" onClick={() => setStep("fuel_type")}>{form.fuel_type || "Select Fuel Type"}</button>}

        {/* Location */}
        <button type="button" className="selector-btn" onClick={() => setStep("state")}>{form.state || "Select State"}</button>
        {form.state && <button type="button" className="selector-btn" onClick={() => setStep("city")}>{form.city || "Select City"}</button>}

        {/* Images */}
        <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} className="form-input"/>
        <div className="image-preview">
          {imagePreviews.map((src,i) => <img key={i} src={src} alt="preview" className="preview-img"/>)}
        </div>

        <button type="submit" className="submit-btn">Post Ad</button>
      </form>

      {/* Full-page selectors */}
      {step === "category" && <FullPageSelector title="Select Category" options={Object.keys(categoryFields)} onSelect={(val) => { handleChange("category", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "brand" && <FullPageSelector title="Select Brand" options={availableBrands} onSelect={(val) => { handleChange("brand", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "model" && <FullPageSelector title="Select Model" options={availableModels} onSelect={(val) => { handleChange("model", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "ram" && <FullPageSelector title="Select RAM" options={ramOptions} onSelect={(val) => { handleChange("ram", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "storage" && <FullPageSelector title="Select Storage" options={storageOptions} onSelect={(val) => { handleChange("storage", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "color" && <FullPageSelector title="Select Color" options={colors} onSelect={(val) => { handleChange("color", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "features" && <FullPageSelector title="Select Features" options={categoryFeatures} onSelect={(val) => { handleChange("features", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "condition" && <FullPageSelector title="Select Condition" options={conditions} onSelect={(val) => { handleChange("condition", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "year" && <FullPageSelector title="Select Year" options={years} onSelect={(val) => { handleChange("year", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "engine" && <FullPageSelector title="Select Engine" options={engines} onSelect={(val) => { handleChange("engine", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "fuel_type" && <FullPageSelector title="Select Fuel Type" options={fuelTypes} onSelect={(val) => { handleChange("fuel_type", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "state" && <FullPageSelector title="Select State" options={Object.keys(locationsByState)} onSelect={(val) => { handleChange("state", val); setStep(null); }} onClose={() => setStep(null)} />}
      {step === "city" && <FullPageSelector title="Select City" options={availableCities} onSelect={(val) => { handleChange("city", val); setStep(null); }} onClose={() => setStep(null)} />}
    </div>
  );
}