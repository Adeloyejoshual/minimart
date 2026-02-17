import { useState, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { sims } from "../../config/sim";
import { featuresByCategory } from "../../config/features";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { locationsByState } from "../../config/locationsByState";
import { promotionPlans } from "../../config/promotion";
import "./AddProduct.css";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

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
    features: [],
    state: "",
    city: "",
    delivery: { region: "", from: "", to: "", fee: 0, chargeFee: false },
    phone_number: user?.phone_number || "",
    poster_name: user?.name || "",
    images: [],
    promoted: false,
    promo_plan: "",
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [errors, setErrors] = useState({});
  const [showDelivery, setShowDelivery] = useState(false);
  const [loading, setLoading] = useState(false);

  const categoryRules = {
    title: { min: 20, msg: "Title must be at least 20 characters" },
    description: { min: 50, msg: "Description must be at least 50 characters" },
    price: { required: true, msg: "Price is required" },
    images: { max: 10, msg: "You can upload max 10 images" },
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === "brand") setForm(prev => ({ ...prev, model: "" }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const toggleFeature = (feature) => {
    setForm(prev => {
      const current = prev.features;
      if (current.includes(feature)) {
        return { ...prev, features: current.filter(f => f !== feature) };
      } else {
        return { ...prev, features: [...current, feature] };
      }
    });
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
      setForm(prev => ({ ...prev, title:"", description:"", price:"", images:[], category:"", subcategory:"", features:[], delivery:{ region:"", from:"", to:"", fee:0, chargeFee:false } }));
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
  const availableStates = Object.keys(locationsByState);

  return (
    <div className="add-product-container">
      <h2 className="form-title">Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit} className="full-form">

        {/* Title */}
        <input placeholder="Title" value={form.title} onChange={e => handleChange("title", e.target.value)} />
        {errors.title && <span className="error">{errors.title}</span>}

        {/* Category & Subcategory */}
        <select value={form.category} onChange={e => handleChange("category", e.target.value)}>
          <option value="">Select Category</option>
          {Object.keys(categoryFields).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {errors.category && <span className="error">{errors.category}</span>}
        <select value={form.subcategory} onChange={e => handleChange("subcategory", e.target.value)}>
          <option value="">Select Subcategory</option>
          {(categoryFields[form.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {errors.subcategory && <span className="error">{errors.subcategory}</span>}

        {/* Pills for brand/model/ram/storage/color/sim */}
        {visibleFields.includes("brand") && (
          <div className="pill-container">
            {availableBrands.map(b => (
              <span
                key={b}
                className={`pill ${form.brand === b ? "selected" : ""}`}
                onClick={() => handleChange("brand", b)}
              >{b}</span>
            ))}
          </div>
        )}
        {visibleFields.includes("model") && (
          <div className="pill-container">
            {availableModels.map(m => (
              <span
                key={m}
                className={`pill ${form.model === m ? "selected" : ""}`}
                onClick={() => handleChange("model", m)}
              >{m}</span>
            ))}
          </div>
        )}
        {/* Similar for RAM */}
        {visibleFields.includes("ram") && (
          <div className="pill-container">
            {ramOptions.map(r => (
              <span
                key={r}
                className={`pill ${form.ram === r ? "selected" : ""}`}
                onClick={() => handleChange("ram", r)}
              >{r}</span>
            ))}
          </div>
        )}
        {/* Storage */}
        {visibleFields.includes("storage") && (
          <div className="pill-container">
            {storageOptions.map(s => (
              <span
                key={s}
                className={`pill ${form.storage === s ? "selected" : ""}`}
                onClick={() => handleChange("storage", s)}
              >{s}</span>
            ))}
          </div>
        )}
        {/* Color */}
        {visibleFields.includes("color") && (
          <div className="pill-container">
            {colors.map(c => (
              <span
                key={c}
                className={`pill ${form.color === c ? "selected" : ""}`}
                onClick={() => handleChange("color", c)}
              >{c}</span>
            ))}
          </div>
        )}
        {/* SIM */}
        {visibleFields.includes("sim") && (
          <div className="pill-container">
            {sims.map(s => (
              <span
                key={s}
                className={`pill ${form.sim === s ? "selected" : ""}`}
                onClick={() => handleChange("sim", s)}
              >{s}</span>
            ))}
          </div>
        )}

        {/* Features Multi-select */}
        {categoryFeatures.length > 0 && (
          <div className="pill-container">
            {categoryFeatures.map(f => (
              <span
                key={f}
                className={`pill ${form.features.includes(f) ? "selected" : ""}`}
                onClick={() => toggleFeature(f)}
              >{f}</span>
            ))}
          </div>
        )}

        {/* State */}
        <select value={form.state} onChange={e => handleChange("state", e.target.value)}>
          <option value="">Select State</option>
          {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Delivery Section */}
        <button type="button" className="delivery-btn" onClick={() => setShowDelivery(!showDelivery)}>Delivery</button>
        {showDelivery && (
          <div className="delivery-card">
            <input placeholder="Region" value={form.delivery.region} onChange={e => setForm(prev => ({ ...prev, delivery: { ...prev.delivery, region: e.target.value } }))} />
            <input placeholder="From (days)" value={form.delivery.from} onChange={e => setForm(prev => ({ ...prev, delivery: { ...prev.delivery, from: e.target.value } }))} />
            <input placeholder="To (days)" value={form.delivery.to} onChange={e => setForm(prev => ({ ...prev, delivery: { ...prev.delivery, to: e.target.value } }))} />
            <label>
              <input type="checkbox" checked={form.delivery.chargeFee} onChange={e => setForm(prev => ({ ...prev, delivery: { ...prev.delivery, chargeFee: e.target.checked } }))} /> Charge Fee for Delivery
            </label>
            {form.delivery.chargeFee && (
              <input placeholder="Delivery Fee" value={form.delivery.fee} onChange={e => setForm(prev => ({ ...prev, delivery: { ...prev.delivery, fee: e.target.value } }))} />
            )}
          </div>
        )}

        {/* Negotiation */}
        <input placeholder="Are you negotiable?" value={form.negotiation} onChange={e => handleChange("negotiation", e.target.value)} />

        {/* Price */}
        <input placeholder="Price" value={form.price} onChange={e => handlePriceChange(e.target.value)} />
        {errors.price && <span className="error">{errors.price}</span>}

        {/* Bulk Price */}
        <input placeholder="Bulk Price From" value={form.bulk_price_from} onChange={e => handleChange("bulk_price_from", e.target.value)} />
        <input placeholder="Bulk Price Per Piece" value={form.bulk_price_per_piece} onChange={e => handleChange("bulk_price_per_piece", e.target.value)} />

        {/* Name & Phone */}
        <input placeholder="Your Name" value={form.poster_name} disabled />
        <input placeholder="Phone Number" value={form.phone_number} onChange={e => handleChange("phone_number", e.target.value)} />

        {/* Promotion */}
        <select value={form.promo_plan} onChange={e => handleChange("promo_plan", e.target.value)}>
          <option value="">Select Promotion</option>
          {promotionPlans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Images */}
        <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
        {errors.images && <span className="error">{errors.images}</span>}
        <div className="image-preview">
          {imagePreviews.map((src, i) => <img key={i} src={src} alt="Preview" />)}
        </div>

        <button type="submit" disabled={loading}>{loading ? "Posting..." : "Post Ad"}</button>
      </form>
    </div>
  );
}