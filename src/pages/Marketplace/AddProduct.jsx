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

  // FIXED: Computed fields using categoryRules properly
  const computedFields = {
    availableBrands: form.category ? brands[form.category] || [] : [],
    availableModels: form.brand && form.category ? models[form.category]?.[form.brand] || [] : [],
    categoryFeatures: form.category ? featuresByCategory[form.category] || [] : [],
    // ✅ CORRECT USAGE OF categoryRules
    showCategoryFields: form.category ? categoryRules[form.category] || [] : []
  };

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

  const toggleDeliveryRegion = (region) => {
    setForm(prev => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.includes(region)
        ? prev.deliveryRegions.filter(r => r !== region)
        : [...prev.deliveryRegions, region]
    }));
  };

  // ✅ FULL WORKING PUBLISH FUNCTION
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

      console.log('Submitting:', submitData); // Debug log

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
          `🎉 Product "${form.title}" published successfully! ID: ${result.productId}` : 
          '💾 Product saved as draft!'
        );
        
        // ✅ Promotion handling
        if (status === 'published' && form.promoted && form.promo_plan) {
          const plan = promotionPlans.find(p => p.name === form.promo_plan);
          window.location.href = `/paystack-promote?productId=${result.productId}&plan=${plan.id}`;
        } else {
          window.location.href = '/my-products';
        }
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

  if (isLoading) return <div className="loading-screen">Loading...</div>;
  if (!isAuthenticated) return <div className="loading-screen">Please log in to add products</div>;

  return (
    <div className="add-product-container">
      <div className="add-product-header">
        <h1>Add New Product</h1>
        <p>Complete all sections to list your product</p>
      </div>

      <div className="add-product-main">
        <div className="form-sections">
          
          {/* SECTION 1: BASIC INFO - NO SUBCATEGORY */}
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

              {/* ✅ FIXED: Brand dropdown (no subcategory) */}
              <div className="form-group">
                <label>Brand</label>
                <select
                  value={form.brand}
                  onChange={(e) => updateFormField('brand', e.target.value)}
                >
                  <option value="">Select Brand</option>
                  {getFieldOptions('brand', computedFields).map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Model</label>
                <select
                  value={form.model}
                  onChange={(e) => updateFormField('model', e.target.value)}
                >
                  <option value="">Select Model</option>
                  {getFieldOptions('model', computedFields).map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Describe your product..."
                  maxLength={2000}
                />
              </div>
            </div>
          </section>

          {/* ✅ FIXED: DYNAMIC FIELDS SHOWING PROPERLY */}
          {computedFields.showCategoryFields.length > 0 && (
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
                      {getFieldOptions('condition', computedFields).map(cond => (
                        <option key={cond} value={cond}>{cond}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* RAM */}
                {computedFields.showCategoryFields.includes('ram') && (
                  <div className="form-group">
                    <label>RAM</label>
                    <select 
                      value={form.ram} 
                      onChange={(e) => updateFormField('ram', e.target.value)}
                    >
                      <option value="">Select RAM</option>
                      {getFieldOptions('ram', computedFields).map(ram => (
                        <option key={ram} value={ram}>{ram}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Storage */}
                {computedFields.showCategoryFields.includes('storage') && (
                  <div className="form-group">
                    <label>Storage</label>
                    <select 
                      value={form.storage} 
                      onChange={(e) => updateFormField('storage', e.target.value)}
                    >
                      <option value="">Select Storage</option>
                      {getFieldOptions('storage', computedFields).map(storage => (
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
                      {getFieldOptions('color', computedFields).map(color => (
                        <option key={color} value={color}>{color}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* SIM - Fixed */}
                {computedFields.showCategoryFields.includes('sim') && (
                  <div className="form-group">
                    <label>SIM Type</label>
                    <div className="checkbox-grid">
                      {getFieldOptions('sim', computedFields).map(simType => (
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

                {/* Year - Fixed */}
                {computedFields.showCategoryFields.includes('year') && (
                  <div className="form-group">
                    <label>Year</label>
                    <select 
                      value={form.year} 
                      onChange={(e) => updateFormField('year', e.target.value)}
                    >
                      <option value="">Select Year</option>
                      {getFieldOptions('year', computedFields).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Engine & Fuel */}
                {computedFields.showCategoryFields.includes('engine') && (
                  <>
                    <div className="form-group">
                      <label>Engine</label>
                      <select 
                        value={form.engine} 
                        onChange={(e) => updateFormField('engine', e.target.value)}
                      >
                        <option value="">Select Engine</option>
                        {getFieldOptions('engine', computedFields).map(engine => (
                          <option key={engine} value={engine}>{engine}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Fuel Type</label>
                      <select 
                        value={form.fuel_type} 
                        onChange={(e) => updateFormField('fuel_type', e.target.value)}
                      >
                        <option value="">Select Fuel</option>
                        {getFieldOptions('fuel_type', computedFields).map(fuel => (
                          <option key={fuel} value={fuel}>{fuel}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* PROMOTION SECTION - Added */}
          {form.category && (
            <section className="form-section">
              <h2>Promotion Plans</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Promote Listing</label>
                  <label className="checkbox-label full-width">
                    <input
                      type="checkbox"
                      checked={form.promoted}
                      onChange={(e) => {
                        updateFormField('promoted', e.target.checked);
                        if (!e.target.checked) updateFormField('promo_plan', '');
                      }}
                    />
                    Make this listing featured
                  </label>
                </div>
                {form.promoted && (
                  <div className="form-group">
                    <label>Promotion Plan</label>
                    <select 
                      value={form.promo_plan} 
                      onChange={(e) => updateFormField('promo_plan', e.target.value)}
                    >
                      <option value="">Select Plan</option>
                      {getFieldOptions('promo_plan', computedFields).map(plan => (
                        <option key={plan} value={plan}>{plan}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </section>
          )}

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
            <h3>Publish Product</h3>
            
            {/* Checklist */}
            <div className="checklist">
              <div className={`checklist-item ${form.title ? 'completed' : ''}`}>
                <span className={`check-icon ${form.title ? 'checkmark' : ''}`}>✓</span>
                Product Title
              </div>
              <div className={`checklist-item ${form.phone_number ? 'completed' : ''}`}>
                <span className={`check-icon ${form.phone_number ? 'checkmark' : ''}`}>✓</span>
                Phone Number
              </div>
              <div className={`checklist-item ${images.previews.length > 0 ? 'completed' : ''}`}>
                <span className={`check-icon ${images.previews.length > 0 ? 'checkmark' : ''}`}>✓</span>
                Images ({images.previews.length}/10)
              </div>
            </div>

            {/* Buttons */}
            <div className="publish-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => handleSubmit('draft')}
                disabled={isSubmitting}
              >
                💾 Save Draft
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSubmit('published')}
                disabled={isSubmitting || !form.title || !form.phone_number || images.files.length === 0}
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

            {/* Terms */}
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

      {/* Terms Modal */}
      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Terms & Conditions</h3>
              <button className="modal-close" onClick={() => setShowTerms(false)}>×</button>
            </div>
            <iframe
              src="/terms-policy"
              className="terms-iframe"
              title="Terms & Conditions"
            />
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowTerms(false)}
              >
                Close
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setTermsAccepted(true);
                  setShowTerms(false);
                }}
              >
                I Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}