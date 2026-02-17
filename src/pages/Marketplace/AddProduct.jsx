import { useState, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
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
    fuel_type: "",
    features: [],
    price: "",
    bulk_price_from: "",
    bulk_price_per_piece: "",
    negotiable: false,
    poster_name: user?.name || "",
    phone_number: user?.phone_number || "",
    additional_numbers: [],
    state: "",
    city: "",
    images: [],
    delivery: {
      name: "",
      region: "",
      days_from: "",
      days_to: "",
      fee: 0,
    },
    promoted: false,
    promo_plan: "",
    description: "",
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
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleFeatureSelect = (feature) => {
    setForm(prev => {
      const exists = prev.features.includes(feature);
      return { ...prev, features: exists ? prev.features.filter(f => f !== feature) : [...prev.features, feature] };
    });
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 10);
    setImageFiles(files);
    setImagePreviews(files.map(f => URL.createObjectURL(f)));
    if (files.length > categoryRules.images.max) setErrors(prev => ({ ...prev, images: categoryRules.images.msg }));
  };

  const handlePriceChange = (value) => {
    const num = value.replace(/[^0-9.]/g, "");
    setForm(prev => ({ ...prev, price: num }));
    setErrors(prev => ({ ...prev, price: null }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.title || form.title.length < categoryRules.title.min) newErrors.title = categoryRules.title.msg;
    if (!form.description || form.description.length < categoryRules.description.min) newErrors.description = categoryRules.description.msg;
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
      window.location.reload();
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

  const TileList = ({ options = [], selected, onSelect, multiSelect = false }) => (
    <div className="tile-list">
      {options.map(opt => {
        const isSelected = multiSelect ? selected.includes(opt) : selected === opt;
        return (
          <div
            key={opt}
            className={`tile ${isSelected ? "selected" : ""}`}
            onClick={() => multiSelect ? onSelect(opt) : onSelect(opt)}
          >
            {opt}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="add-product-container professional-ui">
      <h2 className="form-title">Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit} className="full-form">
        {/* 1. Title */}
        <input placeholder="Title" value={form.title} onChange={e=>handleChange("title", e.target.value)} />
        {errors.title && <span className="error">{errors.title}</span>}

        {/* 2. Category & Subcategory */}
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

        {/* 3. Tiles: Brand, Model, Condition, RAM, Storage, Color, SIM, Features */}
        {visibleFields.map(field => {
          switch(field){
            case "brand": return <TileList key="brand" options={availableBrands} selected={form.brand} onSelect={val=>handleChange("brand", val)} />;
            case "model": return <TileList key="model" options={availableModels} selected={form.model} onSelect={val=>handleChange("model", val)} />;
            case "condition": return <TileList key="condition" options={conditions} selected={form.condition} onSelect={val=>handleChange("condition", val)} />;
            case "used_detail": return <TileList key="used_detail" options={usedDetails} selected={form.used_detail} onSelect={val=>handleChange("used_detail", val)} />;
            case "ram": return <TileList key="ram" options={ramOptions} selected={form.ram} onSelect={val=>handleChange("ram", val)} />;
            case "storage": return <TileList key="storage" options={storageOptions} selected={form.storage} onSelect={val=>handleChange("storage", val)} />;
            case "color": return <TileList key="color" options={colors} selected={form.color} onSelect={val=>handleChange("color", val)} />;
            case "sim": return <TileList key="sim" options={availableSims} selected={form.sim} onSelect={val=>handleChange("sim", val)} />;
            case "features": return <TileList key="features" options={categoryFeatures} selected={form.features} onSelect={handleFeatureSelect} multiSelect={true} />;
            default: return null;
          }
        })}

        {/* 4. Images */}
        <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
        {errors.images && <span className="error">{errors.images}</span>}
        <div className="image-preview">{imagePreviews.map((src,i)=><img key={i} src={src} alt="Preview" />)}</div>

        {/* 5. State & City */}
        <input placeholder="State" value={form.state} onChange={e=>handleChange("state", e.target.value)} />
        <input placeholder="City" value={form.city} onChange={e=>handleChange("city", e.target.value)} />

        {/* 6. Description */}
        <textarea placeholder="Description" value={form.description} onChange={e=>handleChange("description", e.target.value)} />

        {/* 7-8. Price & Bulk */}
        <input placeholder="Price" value={form.price} onChange={e=>handlePriceChange(e.target.value)} />
        <input placeholder="Bulk Price From" value={form.bulk_price_from} onChange={e=>handleChange("bulk_price_from", e.target.value)} />
        <input placeholder="Price Per Piece" value={form.bulk_price_per_piece} onChange={e=>handleChange("bulk_price_per_piece", e.target.value)} />

        {/* 9. Negotiable */}
        <label>
          <input type="checkbox" checked={form.negotiable} onChange={e=>handleChange("negotiable", e.target.checked)} />
          Are you negotiable?
        </label>

        {/* 10-11. Poster Name & Phone */}
        <input placeholder="Your Name" value={form.poster_name} readOnly />
        <input placeholder="Phone Number" value={form.phone_number} onChange={e=>handleChange("phone_number", e.target.value)} />
        <input placeholder="Additional Phone Numbers" value={form.additional_numbers.join(", ")} onChange={e=>handleChange("additional_numbers", e.target.value.split(",").map(n=>n.trim()))} />

        {/* 12. Delivery */}
        <h4>Delivery</h4>
        <input placeholder="Delivery Name" value={form.delivery.name} onChange={e=>setForm(prev=>({...prev, delivery:{...prev.delivery, name:e.target.value}}))} />
        <input placeholder="Region" value={form.delivery.region} onChange={e=>setForm(prev=>({...prev, delivery:{...prev.delivery, region:e.target.value}}))} />
        <input placeholder="Days From" type="number" value={form.delivery.days_from} onChange={e=>setForm(prev=>({...prev, delivery:{...prev.delivery, days_from:e.target.value}}))} />
        <input placeholder="Days To" type="number" value={form.delivery.days_to} onChange={e=>setForm(prev=>({...prev, delivery:{...prev.delivery, days_to:e.target.value}}))} />
        <label>
          <input type="checkbox" checked={form.delivery.fee>0} onChange={e=>setForm(prev=>({...prev, delivery:{...prev.delivery, fee: prev.delivery.fee>0 ? 0 : 100}}))} />
          Charge Fee for Delivery
        </label>
        {form.delivery.fee>0 && <input type="number" placeholder="Fee Amount" value={form.delivery.fee} onChange={e=>setForm(prev=>({...prev, delivery:{...prev.delivery, fee:e.target.value}}))} />}

        {/* 13. Promotion */}
        <label>
          <input type="checkbox" checked={form.promoted} onChange={e=>handleChange("promoted", e.target.checked)} />
          Promote Product
        </label>
        {form.promoted && (
          <select value={form.promo_plan} onChange={e=>handleChange("promo_plan", e.target.value)}>
            <option value="">Select Promotion Plan</option>
            {["Standard", "Premium", "Featured"].map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        )}

        {/* 14. Submit */}
        <div className="form-actions">
          <button type="submit" disabled={loading}>{loading ? "Posting..." : "Post Ad"}</button>
        </div>
      </form>
    </div>
  );
}