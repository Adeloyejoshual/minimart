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
    bulkPriceFrom: "",
    bulkPricePerPiece: "",
    negotiation: "",
    category: "",
    subcategory: "",
    brand: "",
    model: "",
    condition: "",
    used_detail: "",
    ram: "",
    storage: "",
    color: [],
    sim: [],
    features: [],
    exchange_possible: false,
    phone_number: user?.phone_number || "",
    poster_name: user?.name || "",
    state: "",
    city: "",
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
    delivery: {
      name: "",
      region: "",
      daysFrom: "",
      daysTo: "",
      fee: 0,
      hasFee: false
    },
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);

  // CATEGORY RULES
  const categoryRules = {
    title: { min: 20, msg: "Title must be at least 20 characters" },
    description: { min: 50, msg: "Description must be at least 50 characters" },
    images: { max: 10, msg: "You can upload max 10 images" },
    price: { required: true, msg: "Price is required" },
  };

  // HANDLE CHANGE
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === "brand") setForm(prev => ({ ...prev, model: "" }));
    if (field === "description" && !form.title) {
      const firstLine = value.split("\n")[0];
      setForm(prev => ({ ...prev, title: firstLine.slice(0, 60) }));
    }
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  // MULTI-SELECT TOGGLE
  const handleToggle = (field, value) => {
    setForm(prev => {
      const current = prev[field];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  // IMAGES
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

  // PRICE
  const handlePriceChange = (value) => {
    const num = value.replace(/[^0-9.]/g, "");
    setForm(prev => ({ ...prev, price: num }));
    setErrors(prev => ({ ...prev, price: null }));
  };

  // VALIDATION
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

  // SUBMIT
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
      // reset form except user info
      setForm(prev => ({
        ...prev,
        title: "",
        description: "",
        price: "",
        images: [],
        category: "",
        subcategory: "",
        brand: "",
        model: "",
        condition: "",
        used_detail: "",
        ram: "",
        storage: "",
        color: [],
        sim: [],
        features: [],
        delivery: { name:"", region:"", daysFrom:"", daysTo:"", fee:0, hasFee:false },
      }));
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

  // DROPDOWN OPTIONS
  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableCities = locationsByState[form.state] || [];

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
          {Object.keys(categoryFields).map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        {errors.category && <span className="error">{errors.category}</span>}

        <select value={form.subcategory} onChange={e => handleChange("subcategory", e.target.value)}>
          <option value="">Select Subcategory</option>
          {(categoryFields[form.category]||[]).map(sub => <option key={sub} value={sub}>{sub}</option>)}
        </select>
        {errors.subcategory && <span className="error">{errors.subcategory}</span>}

        {/* Brand */}
        <div className="pill-list">
          {availableBrands.map(b => (
            <button
              type="button"
              key={b}
              className={form.brand === b ? "pill selected" : "pill"}
              onClick={() => handleChange("brand", b)}
            >{b}</button>
          ))}
        </div>

        {/* Model */}
        <div className="pill-list">
          {availableModels.map(m => (
            <button
              type="button"
              key={m}
              className={form.model === m ? "pill selected" : "pill"}
              onClick={() => handleChange("model", m)}
            >{m}</button>
          ))}
        </div>

        {/* Condition */}
        <div className="pill-list">
          {conditions.map(c => (
            <button
              type="button"
              key={c}
              className={form.condition === c ? "pill selected" : "pill"}
              onClick={() => handleChange("condition", c)}
            >{c}</button>
          ))}
        </div>

        {/* RAM, Storage, Color, SIM, Features */}
        {["ram", "storage", "color", "sim", "features"].map(field => (
          <div className="pill-list" key={field}>
            {(field === "ram" ? ramOptions :
              field === "storage" ? storageOptions :
              field === "color" ? colors :
              field === "sim" ? sims : categoryFeatures
            ).map(opt => (
              <button
                type="button"
                key={opt}
                className={form[field].includes(opt) ? "pill selected" : "pill"}
                onClick={() => field === "ram" || field === "storage" ? handleChange(field, opt) : handleToggle(field, opt)}
              >{opt}</button>
            ))}
          </div>
        ))}

        {/* State & City */}
        <select value={form.state} onChange={e => handleChange("state", e.target.value)}>
          <option value="">Select State</option>
          {Object.keys(locationsByState).map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={form.city} onChange={e => handleChange("city", e.target.value)}>
          <option value="">Select City</option>
          {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Delivery */}
        <div className="delivery-section">
          <button type="button" onClick={() => setShowDelivery(!showDelivery)}>Delivery</button>
          {showDelivery && (
            <div className="delivery-form">
              <input placeholder="Delivery Name" value={form.delivery.name} onChange={e => handleChange("delivery", { ...form.delivery, name: e.target.value })} />
              <input placeholder="Region" value={form.delivery.region} onChange={e => handleChange("delivery", { ...form.delivery, region: e.target.value })} />
              <input placeholder="Days From" type="number" value={form.delivery.daysFrom} onChange={e => handleChange("delivery", { ...form.delivery, daysFrom: e.target.value })} />
              <input placeholder="Days To" type="number" value={form.delivery.daysTo} onChange={e => handleChange("delivery", { ...form.delivery, daysTo: e.target.value })} />
              <div>
                <label>Charge Fee for Delivery?</label>
                <select value={form.delivery.hasFee ? "yes" : "no"} onChange={e => handleChange("delivery", { ...form.delivery, hasFee: e.target.value === "yes" })}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {form.delivery.hasFee && <input placeholder="Fee Amount" type="number" value={form.delivery.fee} onChange={e => handleChange("delivery", { ...form.delivery, fee: e.target.value })} />}
              </div>
            </div>
          )}
        </div>

        {/* Negotiation */}
        <input placeholder="Are you negotiable?" value={form.negotiation} onChange={e => handleChange("negotiation", e.target.value)} />

        {/* Price */}
        <input placeholder="Price" value={form.price} onChange={e => handlePriceChange(e.target.value)} />
        {errors.price && <span className="error">{errors.price}</span>}

        {/* Bulk Price */}
        <input placeholder="Bulk Price From" type="number" value={form.bulkPriceFrom} onChange={e => handleChange("bulkPriceFrom", e.target.value)} />
        <input placeholder="Bulk Price Per Piece" type="number" value={form.bulkPricePerPiece} onChange={e => handleChange("bulkPricePerPiece", e.target.value)} />

        {/* Name & Phone */}
        <input placeholder="Your Name" value={form.poster_name} disabled />
        <input placeholder="Phone Number" value={form.phone_number} onChange={e => handleChange("phone_number", e.target.value)} />

        {/* Images */}
        <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
        {errors.images && <span className="error">{errors.images}</span>}
        <div className="image-preview">{imagePreviews.map((src,i)=><img key={i} src={src} alt="Preview" />)}</div>

        {/* Promotion */}
        <select value={form.promo_plan} onChange={e => handleChange("promo_plan", e.target.value)}>
          <option value="">Select Promotion Plan</option>
          {promotionPlans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <button type="submit" disabled={loading}>{loading ? "Posting..." : "Post Ad"}</button>
      </form>
    </div>
  );
}