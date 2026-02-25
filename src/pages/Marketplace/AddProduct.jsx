import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './AddProduct.css';
import { categoryFields } from "../../config/categoryFields";
import { categoryRules } from "../../config/categoryRules";
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

const initializeForm = (user) => ({  
  title: "", description: "", price: "", discount_price: "", category: "", brand: "", model: "",  
  condition: "", used_detail: "", ram: "", storage: "", color: "", sim: [], features: [], engine: "", mileage: "",  
  year: "", fuel_type: "", transmission: "", phone_number: user?.phone_number || "", additional_phone: "",  
  poster_name: user?.name || "", state: "", city: "", social_link: "", images: [], video_link: "", promoted: false,  
  promo_plan: "", flash_sale: false, exchange_possible: false, negotiable: false, deliveryRegions: []  
});

function getFieldOptions(field, computed) {  
  const optionsMap = {  
    brand: computed.availableBrands,   
    model: computed.availableModels,   
    condition: conditions,   
    ram: ramOptions,   
    storage: storageOptions,   
    color: colors,   
    sim: ["Single SIM", "Dual SIM", "eSIM", "eSIM + Physical"],
    engine: engines,   
    fuel_type: fuelTypes,   
    year: Array.from({length: 30}, (_, i) => (new Date().getFullYear() - i).toString()),
    transmission: ["Manual", "Automatic", "CVT", "AMT"],
    promo_plan: promotionPlans.map(p => p.name)
  };  
  return optionsMap[field] || [];  
}

export default function AddMarketplaceProduct() {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState(() => initializeForm(user));
  const [images, setImages] = useState({ files: [], previews: [] });
  const [cities, setCities] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // ✅ FIXED: Using YOUR categoryFields structure properly
  const computedFields = {
    availableBrands: form.category ? brands[form.category] || [] : [],
    availableModels: form.brand && form.category ? models[form.category]?.[form.brand] || [] : [],
    categoryFeatures: form.category ? featuresByCategory[form.category] || [] : [],
    // ✅ CORRECT: Use YOUR categoryFields as showCategoryFields
    showCategoryFields: form.category ? categoryFields[form.category] || [] : []
  };

  console.log('Category:', form.category);
  console.log('Show fields:', computedFields.showCategoryFields);
  console.log('Available brands:', computedFields.availableBrands);

  // Update cities when state changes
  useEffect(() => {
    if (form.state && locationsByState[form.state]) {
      setCities(locationsByState[form.state]);
    } else {
      setCities([]);
    }
  }, [form.state]);

  const updateFormField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Format price with commas
  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-NG').format(value).replace(/,/g, ',');
  };

  const parsePrice = (value) => {
    return value.replace(/,/g, '');
  };

  const handlePriceChange = (e, field) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    updateFormField(field, formatPrice(value));
  };

  const handleImageUpload = (e) => {
    const newFiles = Array.from(e.target.files);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    
    setImages(prev => ({
      files: [...prev.files, ...newFiles],
      previews: [...prev.previews, ...newPreviews]
    }));
    updateFormField('images', [...form.images, ...newFiles.map(f => f.name)]);
  };

  const removeImage = (index) => {
    setImages({
      files: images.files.filter((_, i) => i !== index),
      previews: images.previews.filter((_, i) => i !== index)
    });
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const toggleFeature = (feature) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  const toggleSim = (simType) => {
    setForm(prev => ({
      ...prev,
      sim: prev.sim.includes(simType)
        ? prev.sim.filter(s => s !== simType)
        : [...prev.sim, simType]
    }));
  };

  const handleSubmit = async (status = 'draft') => {
    if (!termsAccepted) {
      setShowTerms(true);
      return;
    }

    if (!form.title.trim() || !form.phone_number.trim() || images.files.length === 0) {
      alert('Please fill required fields: Title, Phone, and add at least 1 image');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      
      const submitData = {
        ...form,
        sellerId: user.sub,
        sellerEmail: user.email,
        sellerName: user.name,
        price: parsePrice(form.price),
        discount_price: parsePrice(form.discount_price || '0'),
        images: images.files.map(f => f.name),
        status,
        createdAt: new Date().toISOString()
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (response.ok) {
        alert(status === 'published' ? 
          `🎉 Product "${form.title}" published successfully!` : 
          '💾 Product saved as draft!'
        );
        window.location.href = '/my-products';
      } else {
        throw new Error(result.message || 'Failed to save product');
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <ProfessionalLoadingSpinner />;
  if (!isAuthenticated) return <ProfessionalLoadingSpinner message="Please log in..." />;

  return (
    <div className="add-product-container">
      <div className="add-product-header">
        <h1>Add New Product</h1>
        <p>Complete all sections to list your product</p>
      </div>

      <div className="add-product-main">
        <div className="form-sections">
          
          {/* SECTION 1: BASIC INFO */}
          <section className="form-section">
            <h2>1. Basic Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Product Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateFormField('title', e.target.value)}
                  placeholder="iPhone 15 Pro Max 256GB"
                  maxLength={100}
                />
              </div>
              
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => updateFormField('category', e.target.value)}
                >
                  <option value="">Select Category</option>
                  {Object.keys(categoryFields).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* ✅ Brand - Shows after category selection */}
              {form.category && computedFields.availableBrands.length > 0 && (
                <div className="form-group">
                  <label>Brand</label>
                  <select
                    value={form.brand}
                    onChange={(e) => updateFormField('brand', e.target.value)}
                  >
                    <option value="">Select Brand</option>
                    {computedFields.availableBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Model - Shows after brand selection */}
              {form.brand && computedFields.availableModels.length > 0 && (
                <div className="form-group">
                  <label>Model</label>
                  <select
                    value={form.model}
                    onChange={(e) => updateFormField('model', e.target.value)}
                  >
                    <option value="">Select Model</option>
                    {computedFields.availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Describe your product..."
                />
              </div>
            </div>
          </section>

          {/* ✅ FIXED: DYNAMIC SPECIFICATIONS - NOW WORKS */}
          {form.category && computedFields.showCategoryFields.length > 0 && (
            <section className="form-section">
              <h2>2. Specifications</h2>
              <div className="form-grid">
                
                {/* Condition */}
                {computedFields.showCategoryFields.includes('condition') && (
                  <div className="form-group">
                    <label>Condition</label>
                    <select 
                      value={form.condition} 
                      onChange={(e) => updateFormField('condition', e.target.value)}
                    >
                      <option value="">Select Condition</option>
                      {conditions.map(cond => (
                        <option key={cond} value={cond}>{cond}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* RAM - NOW SHOWS */}
                {computedFields.showCategoryFields.includes('ram') && (
                  <div className="form-group">
                    <label>RAM</label>
                    <select 
                      value={form.ram} 
                      onChange={(e) => updateFormField('ram', e.target.value)}
                    >
                      <option value="">Select RAM</option>
                      {ramOptions.map(ram => (
                        <option key={ram} value={ram}>{ram}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Storage - NOW SHOWS */}
                {computedFields.showCategoryFields.includes('storage') && (
                  <div className="form-group">
                    <label>Storage</label>
                    <select 
                      value={form.storage} 
                      onChange={(e) => updateFormField('storage', e.target.value)}
                    >
                      <option value="">Select Storage</option>
                      {storageOptions.map(storage => (
                        <option key={storage} value={storage}>{storage}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Color */}
                {computedFields.showCategoryFields.includes('color') && (
                  <div className="form-group">
                    <label>Color</label>
                    <select 
                      value={form.color} 
                      onChange={(e) => updateFormField('color', e.target.value)}
                    >
                      <option value="">Select Color</option>
                      {colors.map(color => (
                        <option key={color} value={color}>{color}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* SIM */}
                {computedFields.showCategoryFields.includes('sim') && (
                  <div className="form-group">
                    <label>SIM Type</label>
                    <div className="checkbox-grid">
                      {["Single SIM", "Dual SIM", "eSIM", "eSIM + Physical"].map(simType => (
                        <label key={simType} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={form.sim.includes(simType)}
                            onChange={() => toggleSim(simType)}
                          />
                          {simType}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Year - NOW SHOWS */}
                {computedFields.showCategoryFields.includes('year') && (
                  <div className="form-group">
                    <label>Year</label>
                    <select 
                      value={form.year} 
                      onChange={(e) => updateFormField('year', e.target.value)}
                    >
                      <option value="">Select Year</option>
                      {Array.from({length: 30}, (_, i) => (new Date().getFullYear() - i).toString()).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Engine */}
                {computedFields.showCategoryFields.includes('engine') && (
                  <div className="form-group">
                    <label>Engine</label>
                    <select 
                      value={form.engine} 
                      onChange={(e) => updateFormField('engine', e.target.value)}
                    >
                      <option value="">Select Engine</option>
                      {engines.map(engine => (
                        <option key={engine} value={engine}>{engine}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Fuel Type */}
                {computedFields.showCategoryFields.includes('fuel_type') && (
                  <div className="form-group">
                    <label>Fuel Type</label>
                    <select 
                      value={form.fuel_type} 
                      onChange={(e) => updateFormField('fuel_type', e.target.value)}
                    >
                      <option value="">Select Fuel</option>
                      {fuelTypes.map(fuel => (
                        <option key={fuel} value={fuel}>{fuel}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Transmission */}
                {computedFields.showCategoryFields.includes('transmission') && (
                  <div className="form-group">
                    <label>Transmission</label>
                    <select 
                      value={form.transmission} 
                      onChange={(e) => updateFormField('transmission', e.target.value)}
                    >
                      <option value="">Select Transmission</option>
                      {["Manual", "Automatic", "CVT", "AMT"].map(trans => (
                        <option key={trans} value={trans}>{trans}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Mileage */}
                {computedFields.showCategoryFields.includes('mileage') && (
                  <div className="form-group">
                    <label>Mileage (km)</label>
                    <input
                      type="number"
                      value={form.mileage}
                      onChange={(e) => updateFormField('mileage', e.target.value)}
                      placeholder="50000"
                    />
                  </div>
                )}

                {/* Features */}
                {computedFields.showCategoryFields.includes('features') && computedFields.categoryFeatures.length > 0 && (
                  <div className="form-group full-width">
                    <label>Features</label>
                    <div className="checkbox-grid-2">
                      {computedFields.categoryFeatures.slice(0, 12).map(feature => (
                        <label key={feature} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={form.features.includes(feature)}
                            onChange={() => toggleFeature(feature)}
                          />
                          {feature}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* PROMOTION */}
          <section className="form-section">
            <h2>Promotion</h2>
            <div className="form-grid">
              <div className="form-group">
                <label className="checkbox-label full-width">
                  <input
                    type="checkbox"
                    checked={form.promoted}
                    onChange={(e) => {
                      updateFormField('promoted', e.target.checked);
                      if (!e.target.checked) updateFormField('promo_plan', '');
                    }}
                  />
                  <span>Promote this listing</span>
                </label>
              </div>
              {form.promoted && promotionPlans.length > 0 && (
                <div className="form-group">
                  <label>Promotion Plan</label>
                  <select 
                    value={form.promo_plan} 
                    onChange={(e) => updateFormField('promo_plan', e.target.value)}
                  >
                    <option value="">Select Plan</option>
                    {promotionPlans.map(plan => (
                      <option key={plan.name} value={plan.name}>
                        {plan.name} (₦{plan.price}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* PRICING */}
          <section className="form-section">
            <h2>Pricing</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Price (₦) *</label>
                <input
                  type="text"
                  value={form.price}
                  onChange={(e) => handlePriceChange(e, 'price')}
                  placeholder="50,000"
                />
              </div>
              <div className="form-group">
                <label>Discount Price (₦)</label>
                <input
                  type="text"
                  value={form.discount_price}
                  onChange={(e) => handlePriceChange(e, 'discount_price')}
                  placeholder="45,000"
                />
              </div>
              <div className="form-group checkbox-row">
                <label className="checkbox-label full-width">
                  <input
                    type="checkbox"
                    checked={form.negotiable}
                    onChange={(e) => updateFormField('negotiable', e.target.checked)}
                  />
                  Price Negotiable
                </label>
                <label className="checkbox-label full-width">
                  <input
                    type="checkbox"
                    checked={form.flash_sale}
                    onChange={(e) => updateFormField('flash_sale', e.target.checked)}
                  />
                  Flash Sale
                </label>
              </div>
            </div>
          </section>

          {/* IMAGES */}
          <section className="form-section">
            <h2>Images *</h2>
            <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="upload-placeholder">
                <div className="upload-icon">📸</div>
                <p>Click to upload (Max 10 images)</p>
                <small>{images.previews.length}/10 images</small>
              </div>
            </div>
            {images.previews.length > 0 && (
              <div className="image-previews">
                {images.previews.map((preview, index) => (
                  <div key={index} className="image-preview">
                    <img src={preview} alt="Preview" />
                    <button 
                      className="remove-image"
                      onClick={() => removeImage(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* CONTACT */}
          <section className="form-section">
            <h2>Contact Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  value={form.phone_number}
                  onChange={(e) => updateFormField('phone_number', e.target.value)}
                  placeholder="08012345678"
                />
              </div>
              <div className="form-group">
                <label>State *</label>
                <select
                  value={form.state}
                  onChange={(e) => updateFormField('state', e.target.value)}
                >
                  <option value="">Select State</option>
                  {Object.keys(locationsByState).map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>City</label>
                <select
                  value={form.city}
                  onChange={(e) => updateFormField('city', e.target.value)}
                >
                  <option value="">Select City</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

        </div>

        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="publish-panel">
            <h3>Ready to Publish?</h3>
            
            <div className="checklist">
              <div className={`checklist-item ${form.title.trim() ? 'completed' : ''}`}>
                <span className={`check-icon ${form.title.trim() ? 'checkmark' : ''}`}>✓</span>
                Title ({form.title.length}/100)
              </div>
              <div className={`checklist-item ${form.phone_number.trim() ? 'completed' : ''}`}>
                <span className={`check-icon ${form.phone_number.trim() ? 'checkmark' : ''}`}>✓</span>
                Phone Number
              </div>
              <div className={`checklist-item ${images.previews.length > 0 ? 'completed' : ''}`}>
                <span className={`check-icon ${images.previews.length > 0 ? 'checkmark' : ''}`}>✓</span>
                Images ({images.previews.length}/10)
              </div>
              <div className={`checklist-item ${termsAccepted ? 'completed' : ''}`}>
                <span className={`check-icon ${termsAccepted ? 'checkmark' : ''}`}>✓</span>
                Terms Accepted
              </div>
            </div>

            <div className="publish-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => handleSubmit('draft')}
                disabled={isSubmitting}
              >
                💾 Save Draft
              </button>
              <button
                className={`btn btn-primary ${isSubmitting || !form.title.trim() || !form.phone_number.trim() || images.files.length === 0 || !termsAccepted ? 'disabled' : ''}`}
                onClick={() => handleSubmit('published')}
                disabled={isSubmitting || !form.title.trim() || !form.phone_number.trim() || images.files.length === 0 || !termsAccepted}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    Publishing...
                  </>
                ) : (
                  '🚀 Publish Product'
                )}
              </button>
            </div>

            <div className="terms-section">
              <label className="terms-checkbox">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span>
                  I agree to <button className="terms-link" onClick={() => setShowTerms(true)}>
                    Terms & Conditions
                  </button>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ PROFESSIONAL LOADING SCREEN */}
      {false && (
        <ProfessionalLoadingSpinner />
      )}
    </div>
  );
}

// ✅ PROFESSIONAL ANIMATED LOADING SPINNER
function ProfessionalLoadingSpinner({ message = "Loading Add Product..." }) {
  return (
    <div className="professional-loader">
      <div className="loader-container">
        <div className="loader-ring">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <div className="loader-glow"></div>
        <div className="loader-text">
          <div className="loader-title">{message}</div>
          <div className="loader-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <div className="loader-particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
      </div>
    </div>
  );
}