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
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";
import "./AddProduct.css";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(1); // 1=category, 2=subcategory, 3=form
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
    city: "",
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const categoryRules = {
    title: { min: 20, msg: "Title must be at least 20 characters" },
    description: { min: 50, msg: "Description must be at least 50 characters" },
    images: { max: 10, msg: "You can upload max 10 images" },
    price: { required: true, msg: "Price is required" },
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === "brand") setForm(prev => ({ ...prev, model: "" }));
    if (field === "description") autoGenerateTitle(value);
    // Remove error on input
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const autoGenerateTitle = (desc) => {
    if (!form.title) {
      const firstLine = desc.split("\n")[0] || "";
      setForm(prev => ({ ...prev, title: firstLine.slice(0, 60) }));
    }
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 10);
    setImageFiles(files);
    setImagePreviews(files.map(f => URL.createObjectURL(f)));
    if (files.length > categoryRules.images.max) {
      setErrors(prev => ({ ...prev, images: categoryRules.images.msg }));
    } else {
      setErrors(prev => ({ ...prev, images: null }));
    }
  };

  const handlePriceChange = (value) => {
    const num = value.replace(/[^0-9.]/g, "");
    setForm(prev => ({ ...prev, price: num }));
    setErrors(prev => ({ ...prev, price: null }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.title || form.title.length < categoryRules.title.min)
      newErrors.title = categoryRules.title.msg;
    if (!form.description || form.description.length < categoryRules.description.min)
      newErrors.description = categoryRules.description.msg;
    if (!form.price) newErrors.price = categoryRules.price.msg;
    if (imageFiles.length > categoryRules.images.max) newErrors.images = categoryRules.images.msg;
    if (!form.category) newErrors.category = "Please select a category";
    if (!form.subcategory) newErrors.subcategory = "Please select a subcategory";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      // Focus first invalid field
      const firstErrorField = Object.keys(errors)[0];
      const el = document.getElementsByName(firstErrorField)[0];
      if (el) el.focus();
      return;
    }

    try {
      setLoading(true);
      const uploadedUrls = [];
      for (let file of imageFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`, {
          method: "POST",
          body: formData,
        });
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
      // reset form
      setForm(prev => ({ ...prev, title:"", description:"", price:"", images:[], category:"", subcategory:"" }));
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
      setStep(1);
      setErrors({});
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

  const addSuggestion = (text) => {
    setForm(prev => ({ ...prev, description: prev.description + "\n" + text }));
  };

  return (
    <div className="add-product-container">
      <h2 className="form-title">Post Marketplace Ad</h2>

      {/* Step 1: Category */}
      {step === 1 && (
        <div className="category-grid">
          {Object.keys(categoryFields).map(cat => (
            <div key={cat} className="category-tile" onClick={() => { setForm(prev => ({ ...prev, category: cat })); setStep(2); }}>{cat}</div>
          ))}
        </div>
      )}

      {/* Step 2: Subcategory */}
      {step === 2 && (
        <div className="category-grid">
          {(categoryFields[form.category] || []).map(sub => (
            <div key={sub} className="category-tile" onClick={() => { setForm(prev => ({ ...prev, subcategory: sub })); setStep(3); }}>{sub}</div>
          ))}
          <button className="back-btn" onClick={() => setStep(1)}>Back</button>
        </div>
      )}

      {/* Step 3: Full Form */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="full-form">
          {visibleFields.map(field => {
            switch(field){
              case "brand":
                return (
                  <div key={field}>
                    <select name="brand" value={form.brand} onChange={e=>handleChange("brand", e.target.value)}>
                      <option value="">Select Brand</option>
                      {availableBrands.map(b=><option key={b} value={b}>{b}</option>)}
                    </select>
                    {errors.brand && <span className="error">{errors.brand}</span>}
                  </div>
                );
              case "model":
                return (
                  <div key={field}>
                    <select name="model" value={form.model} onChange={e=>handleChange("model", e.target.value)}>
                      <option value="">Select Model</option>
                      {availableModels.map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                    {errors.model && <span className="error">{errors.model}</span>}
                  </div>
                );
              case "description":
                return (
                  <div key={field}>
                    <textarea name="description" placeholder="Description" value={form.description} onChange={e=>handleChange("description", e.target.value)} />
                    {errors.description && <span className="error">{errors.description}</span>}
                  </div>
                );
              case "price":
                return (
                  <div key={field}>
                    <input name="price" placeholder="Price" value={form.price} onChange={e=>handlePriceChange(e.target.value)} />
                    {errors.price && <span className="error">{errors.price}</span>}
                  </div>
                );
              default:
                return (
                  <input key={field} name={field} placeholder={field.replace("_"," ")} value={form[field]} onChange={e=>handleChange(field,e.target.value)} />
                );
            }
          })}

          <div className="suggestions">
            <button type="button" onClick={()=>addSuggestion("Add condition")}>Add Condition</button>
            <button type="button" onClick={()=>addSuggestion("Battery Health")}>Battery Health</button>
            <button type="button" onClick={()=>addSuggestion("Accessories")}>Accessories</button>
          </div>

          <div>
            <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
            {errors.images && <span className="error">{errors.images}</span>}
          </div>
          <div className="image-preview">
            {imagePreviews.map((src,i)=><img key={i} src={src} alt="Preview" />)}
          </div>

          <button type="submit" disabled={loading}>{loading?"Posting...":"Post Ad"}</button>
        </form>
      )}
    </div>
  );
}