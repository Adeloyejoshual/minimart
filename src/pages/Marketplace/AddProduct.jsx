// src/pages/Marketplace/AddMarketplaceProduct.jsx
// 🔥 ENTERPRISE 7-STEP JIJI/JUMIA - ALL 15 CONFIGS ✅
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { PaystackButton } from "react-paystack";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import imageCompression from 'browser-image-compression';
import {
  FaStar, FaRocket, FaGift, FaBullhorn, FaBolt, FaSpinner, 
  FaCheckCircle, FaImage, FaMapMarkerAlt, FaPhone, FaBrain, FaVideo
} from "react-icons/fa";
import './AddProduct.css';

// 🔥 ALL CONFIG IMPORTS RESTORED ✅
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

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

  // 🔥 CORE FORM STATE (ALL FIELDS)
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState({
    title: '', description: '', price: '', discount_price: '', quantity: '',
    category: '', subcategory: '', brand: '', model: '', condition: '', used_detail: '',
    ram: '', storage: '', color: '', sim: [], features: [], engine: '', mileage: '',
    year: '', fuel_type: '', transmission: '', phone_number: user?.phone_number || '',
    additional_phone: '', state: '', city: '', location: '', social_link: '',
    video_link: '', promoted: false, promo_plan: '', flash_sale: false,
    exchange_possible: false, negotiable: false, deliveryRegions: []
  });

  // 🔥 UI STATE
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qualityScore, setQualityScore] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // 🔥 DYNAMIC DATA WITH ALL CONFIGS ✅
  const visibleFields = useMemo(() => categoryFields[form.category] || [], [form.category]);
  const availableBrands = useMemo(() => brands[form.category] || [], [form.category]);
  const availableModels = useMemo(() => 
    form.brand ? models[form.category]?.[form.brand] || [] : [], [form.category, form.brand]
  );
  const categoryFeatures = useMemo(() => featuresByCategory[form.category] || [], [form.category]);
  const availableCities = useMemo(() => locationsByState[form.state] || [], [form.state]);
  const paystackKey = import.meta.env.MODE === 'production' 
    ? import.meta.env.VITE_PAYSTACK_PUBLIC_KEY 
    : `pk_test_${import.meta.env.VITE_PAYSTACK_PUBLIC_KEY?.split('_')[1]}`;

  // 🔥 QUALITY SCORING ENGINE (ALL CONFIGS)
  const calculateQualityScore = useCallback(() => {
    let score = 0;
    score += form.title.length >= 30 ? 15 : 0;
    score += form.category ? 10 : 0;
    score += (form.brand && form.model) ? 15 : form.brand ? 8 : 0;
    score += form.condition ? 10 : 0;
    score += form.price && parseInt(form.price.replace(/,/g,'')) >= 1000 ? 15 : 0;
    score += imageFiles.length >= 5 ? 25 : imageFiles.length >= 3 ? 20 : imageFiles.length ? 10 : 0;
    score += form.description?.length >= 150 ? 20 : form.description?.length >= 50 ? 10 : 0;
    score += form.deliveryRegions.length > 0 ? 10 : 0;
    score += form.promoted ? 10 : 0;
    score += (form.ram || form.storage || form.color || form.sim.length) ? 10 : 0;
    return Math.min(score, 100);
  }, [form, imageFiles.length]);

  useEffect(() => {
    setQualityScore(calculateQualityScore());
  }, [calculateQualityScore]);

  // 🔥 7 STEPS WITH FULL VALIDATION
  const steps = [
    { 
      id: 0, title: 'Basic Info', icon: '📝', 
      validate: () => form.title.length >= 30 && form.category && form.condition 
    },
    { 
      id: 1, title: 'Pricing', icon: '💰', 
      validate: () => form.price && parseInt(form.price.replace(/,/g,'')) >= 1000 
    },
    { 
      id: 2, title: 'Photos', icon: '🖼️', 
      validate: () => imageFiles.length >= 1 
    },
    { 
      id: 3, title: 'Description', icon: '📄', 
      validate: () => form.description?.length >= 50 
    },
    { 
      id: 4, title: 'Delivery', icon: '🚚', 
      validate: () => form.state && form.city && form.phone_number 
    },
    { 
      id: 5, title: 'Boost', icon: '🚀', 
      validate: () => true 
    },
    { 
      id: 6, title: 'Preview', icon: '👀', 
      validate: () => true 
    }
  ];

  // 🔥 FORM UPDATER WITH CASCADE LOGIC
  const updateField = useCallback((field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      
      // 🔥 CASCADE RESET LOGIC (ALL CONFIGS)
      if (field === 'category') {
        return {
          ...updated,
          subcategory: '', brand: '', model: '', ram: '', storage: '', 
          color: '', sim: [], features: [], condition: '', used_detail: '',
          engine: '', mileage: '', year: '', fuel_type: '', transmission: ''
        };
      }
      if (field === 'brand') return { ...updated, model: '' };
      if (field === 'state') return { ...updated, city: '' };
      
      return updated;
    });
  }, []);

  // 🔥 PRICE FORMATTER
  const formatPrice = useCallback((value) => {
    const num = value.replace(/[^0-9]/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }, []);

  // 🔥 IMAGE HANDLER WITH COMPRESSION
  const handleImagesChange = useCallback(async (files) => {
    const newFiles = Array.from(files).slice(0, 10 - imageFiles.length);
    const compressedFiles = await Promise.all(
      newFiles.map(file => imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920 }))
    );
    
    setImageFiles(prev => [...prev, ...compressedFiles]);
    setImagePreviews(prev => [...prev, ...compressedFiles.map(f => URL.createObjectURL(f))]);
  }, [imageFiles.length]);

  const removeImage = useCallback((index) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  }, [imagePreviews]);

  // 🔥 NAVIGATION
  const nextStep = useCallback(() => {
    if (steps[currentStep].validate()) {
      setCurrentStep(prev => Math.min(prev + 1, 6));
    }
  }, [currentStep, steps]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  // 🔥 BOOST PLAN SELECTOR
  const selectBoostPlan = useCallback((plan) => {
    updateField('promo_plan', plan.id);
    setSelectedPlan(plan);
  }, [updateField]);

  // 🔥 PUBLISH HANDLER
  const handlePublish = async () => {
    setLoading(true);
    try {
      const imageUrls = await Promise.all(
        imageFiles.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
          
          const res = await fetch(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
            { method: 'POST', body: formData }
          );
          return (await res.json()).secure_url;
        })
      );

      const payload = {
        ...form,
        images: imageUrls,
        qualityScore,
        price: parseInt(form.price.replace(/,/g, '')),
        poster_id: user?.sub,
        createdAt: new Date().toISOString()
      };

      const res = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('🎉 Product published successfully!');
        // Reset everything
        setCurrentStep(0);
        setForm({ phone_number: user?.phone_number || '' });
        setImageFiles([]);
        setImagePreviews([]);
        setSelectedPlan(null);
      }
    } catch (error) {
      alert('Publish failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 PAYMENT SUCCESS
  const handlePaymentSuccess = async (response) => {
    // Handle paid boost
    await handlePublish();
  };

  // 🔥 RENDER CURRENT STEP
  const renderStep = () => {
    switch (currentStep) {
      case 0: // 🔥 STEP 1: BASIC INFO (ALL CONFIGS)
        return (
          <div className="step-content">
            <div className="field-group">
              <label>Product Title <span className="required">*</span></label>
              <input
                className={`input ${form.title.length >= 30 ? 'valid' : ''}`}
                placeholder="iPhone 15 Pro Max 256GB - Like New (30+ chars)"
                value={form.title}
                onChange={e => updateField('title', e.target.value)}
                maxLength={150}
              />
              <small>{form.title.length}/150 ({form.title.length >= 30 ? '✅ Perfect!' : '📝 Add more details'})</small>
            </div>

            <div className="field-row">
              <div className="field-group">
                <label>Category <span className="required">*</span></label>
                <select 
                  className="select" 
                  value={form.category}
                  onChange={e => updateField('category', e.target.value)}
                >
                  <option value="">Select category</option>
                  {Object.keys(brands).map(cat => (
                    <option key={cat} value={cat}>{catFields[cat]?.label || cat}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label>Condition <span className="required">*</span></label>
                <select 
                  className="select" 
                  value={form.condition}
                  onChange={e => updateField('condition', e.target.value)}
                >
                  <option value="">Select condition</option>
                  {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* 🔥 DYNAMIC FIELDS FROM categoryFields CONFIG */}
            {form.category && visibleFields.map(field => (
              <div key={field.key || field} className="field-group">
                <label>{field.label || field.replace('_', ' ').toUpperCase()}</label>
                {field.type === 'multi' ? (
                  <div className="checkbox-grid">
                    {(field.key === 'features' ? categoryFeatures : 
                      field.key === 'sim' ? sims : []).map(item => (
                      <label key={item} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={form[field.key]?.includes(item)}
                          onChange={e => {
                            const current = form[field.key] || [];
                            updateField(field.key, 
                              e.target.checked 
                                ? [...current, item] 
                                : current.filter(i => i !== item)
                            );
                          }}
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                ) : (
                  <select 
                    className="select"
                    value={form[field.key] || ''}
                    onChange={e => updateField(field.key, e.target.value)}
                  >
                    <option value="">{`Select ${field.label || field}`}</option>
                    {getFieldOptions(field.key || field).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}

            {form.condition === 'Used' && (
              <div className="field-group">
                <label>Usage Details</label>
                <select 
                  className="select"
                  value={form.used_detail}
                  onChange={e => updateField('used_detail', e.target.value)}
                >
                  <option value="">Optional</option>
                  {usedDetails.map(detail => (
                    <option key={detail} value={detail}>{detail}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );

      case 1: // 🔥 STEP 2: PRICING
        return (
          <div className="step-content">
            <div className="field-row">
              <div className="field-group">
                <label>Price ₦ <span className="required">*</span></label>
                <input
                  className={`input price-input ${qualityScore >= 75 ? 'valid' : ''}`}
                  value={form.price}
                  onChange={e => updateField('price', formatPrice(e.target.value))}
                  placeholder="500000"
                />
              </div>
              <div className="field-group">
                <label>Discount Price</label>
                <input
                  className="input"
                  value={form.discount_price}
                  onChange={e => updateField('discount_price', formatPrice(e.target.value))}
                  placeholder="450000"
                />
              </div>
            </div>
            <div className={`price-rating ${qualityScore >= 75 ? 'success' : 'warning'}`}>
              <span>💰 {qualityScore >= 75 ? '🟢 Great Deal!' : '🟡 Competitive'}</span>
              <small>{qualityScore >= 75 ? 'Perfect for maximum sales!' : 'Consider adding discount'}</small>
            </div>
          </div>
        );

      case 2: // 🔥 STEP 3: MEDIA (10 IMAGES)
        return (
          <div className="step-content">
            <div 
              className={`upload-area ${imageFiles.length > 0 ? 'has-images' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <FaImage className="upload-icon" />
              <p>{imageFiles.length === 0 ? 'Click or drag images (Max 10)' : `${imageFiles.length}/10 images`}</p>
              <small>Auto-compressed • First image = Cover photo</small>
            </div>
            
            <input
              ref={fileInputRef}
              type="file" accept="image/*" multiple
              onChange={e => handleImagesChange(e.target.files)}
              style={{ display: 'none' }}
            />

            {imageFiles.length > 0 && (
              <div className="image-grid">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="image-container">
                    <img src={src} alt={`Preview ${i + 1}`} className="image-preview" />
                    {i === 0 && <div className="cover-badge">⭐ COVER</div>}
                    <button 
                      className="remove-image-btn" 
                      onClick={e => { e.stopPropagation(); removeImage(i); }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 3: // 🔥 STEP 4: DESCRIPTION
        return (
          <div className="step-content">
            <div className="field-group">
              <label>Description <span className="required">*</span></label>
              <ReactQuill
                value={form.description}
                onChange={value => updateField('description', value)}
                className="quill-editor"
                placeholder="Describe your product in detail..."
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                  ]
                }}
              />
              <small>{form.description?.length || 0}/1000 chars ({form.description?.length >= 150 ? '✅ Excellent!' : '📝 Add more details'})</small>
            </div>
          </div>
        );

      case 4: // 🔥 STEP 5: DELIVERY & CONTACT
        return (
          <div className="step-content">
            <div className="field-row">
              <div className="field-group">
                <label>State <span className="required">*</span></label>
                <select 
                  className="select"
                  value={form.state}
                  onChange={e => updateField('state', e.target.value)}
                >
                  <option value="">Select state</option>
                  {Object.keys(locationsByState).map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label>City <span className="required">*</span></label>
                <select 
                  className="select"
                  value={form.city}
                  onChange={e => updateField('city', e.target.value)}
                  disabled={!form.state}
                >
                  <option value="">{form.state ? `${form.state} Cities` : 'Select state first'}</option>
                  {availableCities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-group">
              <label>Phone Number <span className="required">*</span></label>
              <input
                className="input"
                value={form.phone_number}
                onChange={e => updateField('phone_number', e.target.value)}
                placeholder="08012345678 or +2348012345678"
              />
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.negotiable}
                  onChange={e => updateField('negotiable', e.target.checked)}
                />
                💰 Price Negotiable
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.exchange_possible}
                  onChange={e => updateField('exchange_possible', e.target.checked)}
                />
                🔄 Exchange Possible
              </label>
            </div>
          </div>
        );

      case 5: // 🔥 STEP 6: BOOST SYSTEM
        return (
          <div className="step-content">
            <div className="boost-section">
              <label className="checkbox-label large">
                <input
                  type="checkbox"
                  checked={form.promoted}
                  onChange={e => {
                    updateField('promoted', e.target.checked);
                    if (!e.target.checked) {
                      updateField('promo_plan', '');
                      setSelectedPlan(null);
                    }
                  }}
                />
                🚀 Boost my listing (10x more views - Recommended!)
              </label>

              {form.promoted && (
                <div className="boost-grid">
                  {promotionPlans.map(plan => (
                    <div
                      key={plan.id}
                      className={`boost-card ${form.promo_plan === plan.id ? 'active' : ''}`}
                      onClick={() => selectBoostPlan(plan)}
                    >
                      <div className="boost-icon">{plan.icon}</div>
                      <div className="boost-name">{plan.name}</div>
                      <div className="boost-price">₦{plan.price.toLocaleString()}</div>
                      <small>{plan.duration} • {plan.features?.join(', ')}</small>
                      {plan.price === 0 && <span className="free-badge">FREE</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 6: // 🔥 STEP 7: PREVIEW MODE
        return (
          <div className="step-content preview-mode">
            <div className="product-preview-card">
              <div className="preview-header">
                {form.promoted && <div className="boost-badge-large">🚀 BOOSTED LISTING</div>}
                <div className="quality-badge-large">Quality: {qualityScore}%</div>
              </div>
              
              <h3 className="preview-title">{form.title || 'Your Product'}</h3>
              
              <div className="preview-images">
                {imagePreviews.slice(0, 4).map((src, i) => (
                  <img key={i} src={src} className="preview-image-large" />
                ))}
              </div>

              <div className="preview-price-large">
                ₦{form.price || '0'}
                {form.discount_price && (
                  <span className="discount-price">was ₦{form.discount_price}</span>
                )}
              </div>

              <div className="preview-details">
                <div><strong>{form.brand} {form.model}</strong></div>
                <div>{form.condition} • {form.city}, {form.state}</div>
                {form.promoted && <div>⭐ Featured • {selectedPlan?.duration}</div>}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // 🔥 FIELD OPTIONS HELPER (ALL CONFIGS)
  const getFieldOptions = useCallback((field) => {
    const options = {
      brand: availableBrands,
      model: availableModels,
      ram: ramOptions,
      storage: storageOptions,
      color: colors,
      engine: engines,
      fuel_type: fuelTypes,
      year: years,
      transmission: ['Manual', 'Automatic', 'CVT']
    };
    return options[field] || [];
  }, [availableBrands, availableModels]);

  return (
    <div className="marketplace-form">
      {/* 🔥 ENTERPRISE PROGRESS BAR */}
      <div className="step-progress-container">
        <div className="progress-bar-wrapper">
          <div 
            className={`progress-fill ${qualityScore >= 80 ? 'excellent' : qualityScore >= 60 ? 'good' : ''}`}
            style={{ width: `${((currentStep + 1) / 7) * 100}%` }}
          />
        </div>
        <div className="progress-info">
          <span>Step {currentStep + 1} of 7</span>
          <div className="quality-score-display">
            Quality Score: <strong>{qualityScore}%</strong>
            <div className="score-bar">
              <div className="score-fill" style={{ width: `${qualityScore}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 STEP NAVIGATION */}
      <div className="step-nav-container">
        {steps.map((step, index) => (
          <button
            key={step.id}
            className={`step-nav-btn 
              ${index === currentStep ? 'active' : ''} 
              ${index < currentStep && steps[index].validate() ? 'completed' : ''}
              ${index > currentStep ? 'disabled' : ''}`}
            onClick={() => index <= currentStep && setCurrentStep(index)}
            disabled={index > currentStep}
          >
            <span className="step-icon">{step.icon}</span>
            <span className="step-title">{step.title}</span>
            {index < currentStep && steps[index].validate() && <FaCheckCircle className="step-check" />}
          </button>
        ))}
      </div>

      {/* 🔥 CURRENT STEP CONTENT */}
      <div className="step-content-wrapper">
        {renderStep()}
      </div>

      {/* 🔥 STEP ACTIONS */}
      <div className="step-actions">
        {currentStep > 0 && (
          <button className="btn btn-secondary" onClick={prevStep}>
            ← Previous Step
          </button>
        )}
        
        {currentStep < 6 ? (
          <button 
            className={`btn btn-primary ${!steps[currentStep].validate() ? 'disabled' : ''}`}
            onClick={nextStep}
            disabled={!steps[currentStep].validate()}
          >
            Next Step →
          </button>
        ) : form.promoted && selectedPlan?.price > 0 ? (
          <PaystackButton
            publicKey={paystackKey}
            email={user?.email}
            amount={selectedPlan.price * 100}
            currency="NGN"
            text={`🚀 Publish with ${selectedPlan.name} (₦${selectedPlan.price.toLocaleString()})`}
            onSuccess={handlePaymentSuccess}
          />
        ) : (
          <button 
            className="btn btn-success-large" 
            onClick={handlePublish}
            disabled={loading}
          >
            {loading ? (
              <>
                <FaSpinner className="spinner" />
                Publishing...
              </>
            ) : (
              `🚀 Publish Product • Quality: ${qualityScore}%`
            )}
          </button>
        )}
      </div>
    </div>
  );
}
