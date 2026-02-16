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
    if (!validate()) return;

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
      setForm(prev => ({ ...prev, title:"", description:"", price:"", images:[], category:"", subcategory:"" }));
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
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
  const availableSims = sims || [];
  const availableYears = years || [];

  const addSuggestion = (text) => {
    setForm(prev => ({ ...prev, description: prev.description + "\n" + text }));
  };

  return (
    <div className="add-product-container">
      <h2 className="form-title">Post Marketplace Ad</h2>

      <form onSubmit={handleSubmit} className="full-form">
        {/* Category & Subcategory */}
        <select value={form.category} onChange={e=>handleChange("category", e.target.value)}>
          <option value="">Select Category</option>
          {Object.keys(categoryFields).map(cat=><option key={cat} value={cat}>{cat}</option>)}
        </select>
        {errors.category && <span className="error">{errors.category}</span>}

        <select value={form.subcategory} onChange={e=>handleChange("subcategory", e.target.value)}>
          <option value="">Select Subcategory</option>
          {(categoryFields[form.category]||[]).map(sub=><option key={sub} value={sub}>{sub}</option>)}
        </select>
        {errors.subcategory && <span className="error">{errors.subcategory}</span>}

        {/* Title */}
        <input name="title" placeholder="Title" value={form.title} onChange={e=>handleChange("title", e.target.value)} />
        {errors.title && <span className="error">{errors.title}</span>}

        {/* Description */}
        <textarea name="description" placeholder="Description" value={form.description} onChange={e=>handleChange("description", e.target.value)} />
        {errors.description && <span className="error">{errors.description}</span>}

        {/* Price */}
        <input name="price" placeholder="Price" value={form.price} onChange={e=>handlePriceChange(e.target.value)} />
        {errors.price && <span className="error">{errors.price}</span>}

        {/* Dynamic dropdowns */}
        {visibleFields.map(field=>{
          switch(field){
            case "brand":
              return (
                <div key={field}>
                  <select name="brand" value={form.brand} onChange={e=>handleChange("brand", e.target.value)}>
                    <option value="">Select Brand</option>
                    {availableBrands.map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              );
            case "model":
              return (
                <div key={field}>
                  <select name="model" value={form.model} onChange={e=>handleChange("model", e.target.value)}>
                    <option value="">Select Model</option>
                    {availableModels.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              );
            case "condition":
              return (
                <div key={field}>
                  <select value={form.condition} onChange={e=>handleChange("condition", e.target.value)}>
                    <option value="">Select Condition</option>
                    {conditions.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              );
            case "used_detail":
              return (
                <div key={field}>
                  <select value={form.used_detail} onChange={e=>handleChange("used_detail", e.target.value)}>
                    <option value="">Select Detail if Used</option>
                    {usedDetails.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              );
            case "ram":
              return (
                <div key={field}>
                  <select value={form.ram} onChange={e=>handleChange("ram", e.target.value)}>
                    <option value="">Select RAM</option>
                    {ramOptions.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              );
            case "storage":
              return (
                <div key={field}>
                  <select value={form.storage} onChange={e=>handleChange("storage", e.target.value)}>
                    <option value="">Select Storage</option>
                    {storageOptions.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              );
            case "color":
              return (
                <div key={field}>
                  <select value={form.color} onChange={e=>handleChange("color", e.target.value)}>
                    <option value="">Select Color</option>
                    {colors.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              );
            case "sim":
              return (
                <div key={field}>
                  <select value={form.sim} onChange={e=>handleChange("sim", e.target.value)}>
                    <option value="">Select SIM</option>
                    {availableSims.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              );
            case "features":
              return (
                <div key={field}>
                  <select value={form.features} onChange={e=>handleChange("features", e.target.value)}>
                    <option value="">Select Feature</option>
                    {categoryFeatures.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              );
            default:
              return null;
          }
        })}

        {/* Smart suggestions */}
        <div className="suggestions">
          <button type="button" onClick={()=>addSuggestion("Add Condition")}>Add Condition</button>
          <button type="button" onClick={()=>addSuggestion("Battery Health")}>Battery Health</button>
          <button type="button" onClick={()=>addSuggestion("Accessories")}>Accessories</button>
        </div>

        {/* Images */}
        <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
        {errors.images && <span className="error">{errors.images}</span>}
        <div className="image-preview">
          {imagePreviews.map((src,i)=><img key={i} src={src} alt="Preview" />)}
        </div>

        <button type="submit" disabled={loading}>{loading ? "Posting..." : "Post Ad"}</button>
      </form>
    </div>
  );
}