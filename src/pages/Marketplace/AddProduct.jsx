// src/pages/Marketplace/AddMarketplaceProduct.jsx
// 🔥 WORLD-CLASS JIJI/JUMIA - FASHION FIXED ✅
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { PaystackButton } from "react-paystack";
import { FaStar, FaRocket, FaGift, FaBullhorn, FaBolt, FaSpinner } from "react-icons/fa";
import './AddProduct.css'; // 🔥 WORLD-CLASS STYLES

// 🔥 ALL CONFIG IMPORTS
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

const getDiscountPercent = (price, discount) => {
  if (!price || price === 0 || !discount) return 0;
  return Math.round((discount / price) * 100);
};

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

  // 🔥 CORE FORM STATE (EXPANDED)
  const [form, setForm] = useState({
    title: "", description: "", price: "", discount_price: "", quantity: "",
    category: "", subcategory: "", brand: "", model: "", condition: "",
    used_detail: "", ram: "", storage: "", color: "", sim: [], features: [],
    engine: "", mileage: "", year: "", fuel_type: "", transmission: "",
    phone_number: user?.phone_number || "", additional_phone: "", poster_name: user?.name || "",
    state: "", city: "", location: "", social_link: "", images: [], video_link: "",
    promoted: false, promo_plan: "", flash_sale: false, exchange_possible: false,
    negotiable: false, deliveryRegions: []
  });

  // 🔥 UI STATES
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [errors, setErrors] = useState({});

  // 🔥 DYNAMIC OPTIONS ✅ FASHION FIXED
  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? (models[form.category]?.[form.brand] || []) : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableCities = locationsByState[form.state] || [];
  
  const paystackKey = import.meta.env.MODE === 'production' 
    ? import.meta.env.VITE_PAYSTACK_PUBLIC_KEY 
    : `pk_test_${import.meta.env.VITE_PAYSTACK_PUBLIC_KEY?.split('_')[1]}`;

  // 🔥 STEPS CONFIG
  const steps = [
    { id: 0, title: 'Basic Info', icon: '📝', validate: () => 
      form.title.trim().length >= 30 && form.category && form.price 
    },
    { id: 1, title: 'Photos', icon: '🖼️', validate: () => imageFiles.length > 0 },
    { id: 2, title: 'Details', icon: '⚙️', validate: () => form.state && form.city },
    { id: 3, title: 'Boost', icon: '🚀', validate: () => true }
  ];

  // 🔥 FORM CHANGE HANDLER ✅ FASHION SAFE
  const handleChange = useCallback((field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      
      // 🔥 FULL CASCADE RESET
      if (field === "category") {
        return {
          ...updated,
          subcategory: "", brand: "", model: "", ram: "", storage: "", 
          color: "", sim: [], features: [], condition: "", used_detail: "",
          engine: "", mileage: "", year: "", fuel_type: "", transmission: ""
        };
      }
      if (field === "brand") return { ...updated, model: "" };
      if (field === "state") return { ...updated, city: "" };
      
      return updated;
    });
    setErrors(prev => ({ ...prev, [field]: "" }));
  }, []);

  // 🔥 PRICE FORMATTER
  const handlePriceInput = (value) => {
    const num = value.replace(/[^0-9]/g, "");
    const formatted = num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    handleChange("price", formatted);
  };

  // 🔥 IMAGE HANDLER
  const handleImagesChange = useCallback((e) => {
    const files = Array.from(e.target.files).slice(0, 12);
    if (files.length + imageFiles.length > 12) {
      alert(`Maximum 12 images (${imageFiles.length}/12)`);
      return;
    }

    imagePreviews.forEach(URL.revokeObjectURL);
    setImageFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...files.map(file => URL.createObjectURL(file))]);
  }, [imageFiles.length, imagePreviews]);

  useEffect(() => {
    return () => imagePreviews.forEach(URL.revokeObjectURL);
  }, [imagePreviews]);

  // 🔥 FIELD OPTIONS HELPER ✅ FASHION SAFE
  const getFieldOptions = (field) => {
    const optionsMap = {
      subcategory: visibleFields,
      brand: availableBrands,
      model: availableModels,
      condition: conditions,
      used_detail: usedDetails,
      ram: ramOptions,
      storage: storageOptions,
      color: colors,
      engine: engines,
      fuel_type: fuelTypes,
      year: years,
      transmission: ["Manual", "Automatic", "CVT"]
    };
    return optionsMap[field] || [];
  };

  // 🔥 VALIDATION
  const validateCurrentStep = () => {
    const step = steps[currentStep];
    const errors = {};
    
    if (step.id === 0) {
      if (!form.title?.trim() || form.title.trim().length < 30)
        errors.title = "Title must be at least 30 characters";
      if (!form.category) errors.category = "Category required";
      if (!form.price || parseInt(form.price.replace(/,/g, '')) < 1000)
        errors.price = "Valid price required (min ₦1,000)";
    }
    
    if (step.id === 1 && imageFiles.length === 0)
      errors.images = "At least 1 image required";
      
    if (step.id === 2) {
      if (!form.state) errors.state = "State required";
      if (!form.city) errors.city = "City required";
      if (!form.phone_number?.match(/^(0|\+234)[0-9]{10}$/))
        errors.phone_number = "Valid Nigerian phone number required";
    }
    
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 🔥 UPLOAD IMAGES
  const uploadImages = async () => {
    const uploadedUrls = [];
    setLoading(true);
    
    for (let file of imageFiles) {
      if (file.size > 10 * 1024 * 1024) continue;
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      
      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: formData }
        );
        const data = await res.json();
        uploadedUrls.push(data.secure_url);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    
    setLoading(false);
    return uploadedUrls;
  };

  // 🔥 PUBLISH
  const handlePublish = async () => {
    setLoading(true);
    try {
      const uploadedUrls = await uploadImages();
      const payload = {
        ...form,
        images: uploadedUrls,
        price: parseInt(form.price.replace(/,/g, '')),
        poster_id: user?.sub
      };

      const res = await fetch("/api/marketplace/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("🎉 Product published successfully!");
        resetForm();
      }
    } catch (err) {
      alert("Publish failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 RESET FORM
  const resetForm = () => {
    setForm({
      title: "", description: "", price: "", discount_price: "", quantity: "",
      category: "", subcategory: "", brand: "", model: "", condition: "",
      used_detail: "", ram: "", storage: "", color: "", sim: [], features: [],
      engine: "", mileage: "", year: "", fuel_type: "", transmission: "",
      phone_number: user?.phone_number || "", additional_phone: "", poster_name: user?.name || "",
      state: "", city: "", location: "", social_link: "", images: [], video_link: "",
      promoted: false, promo_plan: "", flash_sale: false, exchange_possible: false,
      negotiable: false, deliveryRegions: []
    });
    setImageFiles([]);
    setImagePreviews([]);
    setCurrentStep(0);
    setSelectedPlan(null);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  // 🔥 RENDER STEPS
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          <div className="step-content">
            <div className="field-group">
              <label className="label">Product Title <span style={{color: 'var(--error-500)'}}>*</span></label>
              <input
                className={`input ${form.title.length >= 30 ? 'valid' : ''} ${errors.title ? 'error' : ''}`}
                placeholder="iPhone 15 Pro Max 256GB - Like New (30+ chars)"
                value={form.title}
                onChange={e => handleChange("title", e.target.value)}
              />
              {errors.title && <small className="error-text">{errors.title}</small>}
            </div>

            <div className="field-group">
              <label className="label">Category <span style={{color: 'var(--error-500)'}}>*</span></label>
              <select
                className="select"
                value={form.category}
                onChange={e => handleChange("category", e.target.value)}
              >
                <option value="">Select Category</option>
                {Object.keys(brands).map(cat => (
                  <option key={cat} value={cat}>
                    {categoryFields[cat]?.label || cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 🔥 FASHION FIELDS ✅ FIXED */}
            {form.category && visibleFields.map(field => (
              <div key={field.key || field} className="field-group">
                <label className="label">{field.label || field.replace("_", " ")}</label>
                {field.type === 'multi' ? (
                  <div className="checkbox-grid">
                    {(field.key === 'features' ? categoryFeatures : getFieldOptions(field.key || field)).map(opt => (
                      <label key={opt} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={form[field.key || field]?.includes(opt)}
                          onChange={e => {
                            const current = form[field.key || field] || [];
                            handleChange(field.key || field, 
                              e.target.checked ? [...current, opt] : current.filter(v => v !== opt)
                            );
                          }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <select
                    className="select"
                    value={form[field.key || field] || ''}
                    onChange={e => handleChange(field.key || field, e.target.value)}
                  >
                    <option value="">{field.placeholder || `Select ${field.label || field}`}</option>
                    {(field.options || getFieldOptions(field.key || field)).map(opt => (
                      <option key={opt.value || opt} value={opt.value || opt}>
                        {opt.label || opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}

            <div className="field-row">
              <div className="field-group">
                <label className="label">Price ₦ <span style={{color: 'var(--error-500)'}}>*</span></label>
                <input
                  className={`input ${errors.price ? 'error' : ''}`}
                  value={form.price}
                  onChange={e => handlePriceInput(e.target.value)}
                  placeholder="500000"
                />
                {errors.price && <small className="error-text">{errors.price}</small>}
              </div>
              <div className="field-group">
                <label className="label">Discount Price</label>
                <input
                  className="input"
                  value={form.discount_price}
                  onChange={e => handleChange("discount_price", e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="450000"
                />
              </div>
            </div>
          </div>
        );

      case 1: // Photos
        return (
          <div className="step-content">
            <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
              <FaSpinner className="upload-icon" />
              <p>Click or drag {imageFiles.length === 0 ? 'images' : `more images`} (Max 12)</p>
              {imageFiles.length > 0 && <p>{imageFiles.length}/12 images</p>}
            </div>
            
            <input
              ref={fileInputRef}
              type="file" accept="image/*" multiple
              onChange={handleImagesChange}
              style={{ display: 'none' }}
            />
            
            {imageFiles.length > 0 && (
              <div className="image-grid">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="image-container">
                    <img src={src} alt={`Preview ${i + 1}`} className="image-preview" />
                    <button 
                      className="remove-image-btn" 
                      onClick={() => {
                        URL.revokeObjectURL(imagePreviews[i]);
                        setImageFiles(prev => prev.filter((_, idx) => idx !== i));
                        setImagePreviews(prev => prev.filter((_, idx) => idx !== i));
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {errors.images && <small className="error-text">{errors.images}</small>}
          </div>
        );

      case 2: // Location
        return (
          <div className="step-content">
            <div className="field-row">
              <div className="field-group">
                <label className="label">State <span style={{color: 'var(--error-500)'}}>*</span></label>
                <select
                  className={`select ${errors.state ? 'error' : ''}`}
                  value={form.state}
                  onChange={e => handleChange("state", e.target.value)}
                >
                  <option value="">Select State</option>
                  {Object.keys(locationsByState).map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              {form.state && (
                <div className="field-group">
                  <label className="label">City <span style={{color: 'var(--error-500)'}}>*</span></label>
                  <select
                    className={`select ${errors.city ? 'error' : ''}`}
                    value={form.city}
                    onChange={e => handleChange("city", e.target.value)}
                  >
                    <option value="">{form.state} Cities</option>
                    {availableCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="field-group">
              <label className="label">Phone <span style={{color: 'var(--error-500)'}}>*</span></label>
              <input
                className={`input ${errors.phone_number ? 'error' : ''}`}
                value={form.phone_number}
                onChange={e => handleChange("phone_number", e.target.value)}
                placeholder="08012345678"
              />
              {errors.phone_number && <small className="error-text">{errors.phone_number}</small>}
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.negotiable}
                  onChange={e => handleChange("negotiable", e.target.checked)}
                />
                💰 Price Negotiable
              </label>
            </div>
          </div>
        );

      case 3: // Boost
        return (
          <div className="step-content">
            <label className="checkbox-label large">
              <input
                type="checkbox"
                checked={form.promoted}
                onChange={e => {
                  handleChange("promoted", e.target.checked);
                  if (!e.target.checked) handleChange("promo_plan", "");
                }}
              />
              🚀 Boost my listing (10x more views!)
            </label>

            {form.promoted && (
              <div className="promo-grid">
                {promotionPlans.map(plan => {
                  const discountPercent = getDiscountPercent(plan.price, plan.discount || 0);
                  const finalPrice = plan.price - (plan.discount || 0);
                  return (
                    <div
                      key={plan.id}
                      className={`promo-card ${selectedPlan?.id === plan.id ? 'active' : ''}`}
                      onClick={() => {
                        handleChange("promo_plan", plan.id);
                        setSelectedPlan(plan);
                      }}
                    >
                      <div className="promo-icon">{plan.icon}</div>
                      <div className="promo-name">{plan.name}</div>
                      <div className="promo-price">
                        {discountPercent > 0 && (
                          <span style={{ textDecoration: "line-through", fontSize: "0.875rem", color: "var(--gray-500)" }}>
                            ₦{plan.price.toLocaleString()}
                          </span>
                        )}
                        ₦{finalPrice.toLocaleString()}
                      </div>
                      <small className="promo-duration">{plan.duration}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="page-container">
      {/* 🔥 PROGRESS HEADER */}
      <header className="progress-header">
        <div className="progress-bar-container">
          <div 
            className={`progress-fill ${currentStep === 3 ? 'good' : ''}`} 
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
          <span>Step {currentStep + 1}/4</span>
        </div>
      </header>

      {/* 🔥 STEPS NAV */}
      <nav className="steps-nav" aria-label="Form steps">
        {steps.map((step, index) => (
          <button
            key={step.id}
            className={`step-btn 
              ${currentStep === index ? 'active' : ''} 
              ${index <= currentStep && step.validate() ? 'valid' : ''}`}
            onClick={() => {
              if (index <= currentStep) setCurrentStep(index);
            }}
            disabled={index > currentStep}
          >
            <span aria-hidden="true">{step.icon}</span>
            {step.title}
          </button>
        ))}
      </nav>

      {/* 🔥 CURRENT STEP */}
      <main>{renderStepContent()}</main>

      {/* 🔥 NAV BUTTONS */}
      <footer className="nav-buttons">
        {currentStep > 0 && (
          <button className="back-btn" onClick={() => setCurrentStep(c => c - 1)}>
            ← Previous
          </button>
        )}
        <button
          className={`next-btn ${!steps[currentStep].validate() || loading ? 'disabled' : ''}`}
          onClick={async () => {
            if (validateCurrentStep()) {
              if (currentStep === 3) {
                if (form.promoted && selectedPlan?.price > 0) {
                  setShowPaymentModal(true);
                } else {
                  await handlePublish();
                }
              } else {
                setCurrentStep(c => c + 1);
              }
            }
          }}
          disabled={!steps[currentStep].validate() || loading}
        >
          {loading ? '⏳ Publishing...' : 
           currentStep === 3 ? '🚀 Publish Product' : 'Next →'}
        </button>
      </footer>

      {/* 🔥 HIDDEN FILE INPUT */}
      <input
        ref={fileInputRef}
        type="file" accept="image/*" multiple
        onChange={handleImagesChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export { getDiscountPercent };
