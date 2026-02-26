// src/pages/Marketplace/AddProduct.jsx - ✅ ALL 13 CONFIGS BULLETPROOF
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './AddProduct.css';

// ✅ ALL YOUR 13 CONFIGS - FULLY UTILIZED
import { categoryFields } from '../../config/categoryFields';
import { brands } from '../../config/brands';
import { colors } from '../../config/colors';
import { conditions, usedDetails } from '../../config/conditions';
import { engines } from '../../config/engines';
import { featuresByCategory } from '../../config/featuresByCategory';
import { fieldOptions } from '../../config/fieldOptions';
import { fuelTypes } from '../../config/fuelTypes';
import { locationsByState } from '../../config/locationsByState';
import { models } from '../../config/models';
import { ramOptions } from '../../config/ramOptions';
import { sims } from '../../config/sim';
import { storageOptions } from '../../config/storageOptions';
import { years } from '../../config/years';
import { promotionPlans } from '../../config/promotion';

const AddProduct = () => {
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const fieldRefs = useRef({});
  const fileInputRef = useRef(null);
  const { user, isAuthenticated } = useAuth0();

  // ✅ BULLETPROOF CONFIG ACCESS - Uses ALL 13 imports
  const categoriesList = Object.keys(categoryFields || {}).length > 0 ? Object.keys(categoryFields) : [];
  const dynamicFields = categoryFields?.[category]?.filter(field => 
    !['features', 'transmission', 'mileage'].includes(field)
  ) || [];
  
  const categoryBrands = brands?.[category] || [];
  const categoryModels = models?.[category] || [];
  const categoryFeatures = featuresByCategory?.[category] || [];
  const stateCities = locationsByState?.[state] || [];

  // ✅ COMPREHENSIVE FIELD OPTIONS - ALL 13 configs
  const getFieldOptions = (fieldName) => {
    const optionsMap = {
      // Your 13 configs
      brand: categoryBrands,
      model: categoryModels,
      condition: conditions || [],
      used_detail: usedDetails || [],
      color: colors || [],
      ram: ramOptions || [],
      storage: storageOptions || [],
      sim: sims || [],
      engine: engines || [],
      fuel_type: fuelTypes || [],
      transmission: ['Manual', 'Automatic', 'Semi-Automatic'],
      year: years || [],
      
      // fieldOptions catch-all
      ...fieldOptions
    };
    return optionsMap[fieldName] || [];
  };

  // Reset features when category changes
  useEffect(() => {
    if (category && selectedFeatures.length > 0) {
      setSelectedFeatures([]);
    }
  }, [category]);

  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-NG').format(value || 0);
  };

  const handleImages = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length + imagesPreview.length > 8) {
      setMessage('Maximum 8 images allowed');
      return;
    }
    
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        setMessage('Maximum 10MB per image');
        return;
      }
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { file, preview, name: file.name.substring(0, 20) }]);
    });
    e.target.value = '';
  }, [imagesPreview.length]);

  const removeImage = useCallback((index) => {
    URL.revokeObjectURL(imagesPreview[index].preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  }, [imagesPreview]);

  const toggleFeature = useCallback((feature) => {
    setSelectedFeatures(prev => 
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  }, []);

  const renderDynamicField = (fieldName) => {
    const options = getFieldOptions(fieldName);
    const fieldLabel = fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase());
    
    return (
      <div className="dynamic-field" key={fieldName}>
        <label>{fieldLabel}</label>
        {options.length > 0 ? (
          <select ref={el => fieldRefs.current[fieldName] = el} className="field-select">
            <option value="">{`Select ${fieldLabel}`}</option>
            {options.slice(0, 25).map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            ref={el => fieldRefs.current[fieldName] = el}
            type={fieldName.includes('mileage|price|year') ? 'number' : 'text'}
            placeholder={`Enter ${fieldLabel}`}
            className="field-input"
          />
        )}
      </div>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      setMessage('❌ Please accept Terms & Conditions');
      return;
    }

    const productData = {
      title: fieldRefs.current.title?.value?.trim() || '',
      category,
      price: parseInt(fieldRefs.current.price?.value?.replace(/,/g, '')) || 0,
      phone_number: fieldRefs.current.phone?.value?.trim() || '',
      state,
      city: fieldRefs.current.city?.value || '',
      description: fieldRefs.current.description?.value?.trim() || '',
      negotiation: fieldRefs.current.negotiation?.value || 'no',
      poster_name: user?.name || 'Anonymous Seller',
      country: "Nigeria",
      features: selectedFeatures,
      promotion_plan: selectedPlan ? selectedPlan.id : null,
      brand: fieldRefs.current.brand?.value || '',
      model: fieldRefs.current.model?.value || ''
    };

    // Add ALL dynamic fields from your 13 configs
    Object.keys(fieldRefs.current).forEach(key => {
      if (dynamicFields.includes(key) && fieldRefs.current[key]?.value) {
        productData[key] = fieldRefs.current[key].value;
      }
    });

    if (!productData.title || productData.price <= 0 || !productData.phone_number) {
      setMessage('❌ Title, price, and phone number required');
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing product...');

      const formData = new FormData();
      Object.entries(productData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => formData.append(key, item));
        } else if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });

      imagesPreview.forEach((img, index) => {
        formData.append('images', img.file);
      });

      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`🎉 Product published successfully! ID: ${result.data?._id || result._id}`);
        
        // Reset ALL form fields
        Object.keys(fieldRefs.current).forEach(key => {
          const el = fieldRefs.current[key];
          if (el) el.value = '';
        });
        setCategory(''); 
        setState(''); 
        setImagesPreview([]); 
        setSelectedFeatures([]); 
        setSelectedPlan(null); 
        setTermsAccepted(false);
        
        setTimeout(() => setMessage(''), 5000);
      } else {
        throw new Error(result.message || 'Publish failed');
      }
    } catch (error) {
      console.error('Publish error:', error);
      setMessage(`❌ Publish failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-required">
        <h2>🔐 Please login to add products</h2>
      </div>
    );
  }

  return (
    <div className="add-product-container">
      {message && (
        <div className={`message ${message.includes('🎉') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="product-form">
        {/* 1. PRODUCT DETAILS - Uses brands, models */}
        <section className="form-section">
          <h2>📦 Product Details</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Product Title *</label>
              <input 
                ref={el => fieldRefs.current.title = el}
                type="text" 
                placeholder="Tecno Camon 19 32GB Green"
                className="input-large required"
                required 
              />
            </div>
            <div className="input-group">
              <label className="required">Category *</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-large required"
                required
              >
                <option value="">Select Category ({categoriesList.length} available)</option>
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>
                    {cat} {categoryFields?.[cat]?.length ? `(${categoryFields[cat].length} fields)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Brand</label>
              <select ref={el => fieldRefs.current.brand = el} className="input-large">
                <option value="">Select Brand ({categoryBrands.length} options)</option>
                {categoryBrands.slice(0, 25).map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Model</label>
              <select ref={el => fieldRefs.current.model = el} className="input-large">
                <option value="">Select Model ({categoryModels.length} options)</option>
                {categoryModels.slice(0, 25).map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 2. PRICING - Uses promotionPlans */}
        <section className="form-section">
          <h2>💰 Pricing & Promotion</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Price (₦) *</label>
              <input 
                ref={el => fieldRefs.current.price = el}
                type="text"
                placeholder="150,000"
                className="input-large price-input required"
                onInput={(e) => {
                  let value = e.target.value.replace(/,/g, '');
                  e.target.value = formatPrice(value);
                }}
                required
              />
            </div>
            <div className="input-group">
              <label>Promotion Plan</label>
              <select 
                value={selectedPlan?.id || ''} 
                onChange={(e) => {
                  const planId = parseInt(e.target.value);
                  const plan = promotionPlans.find(p => p.id === planId);
                  setSelectedPlan(plan);
                }}
                className="input-large"
              >
                <option value="">Free Listing</option>
                {promotionPlans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - ₦{formatPrice(plan.price)} ({plan.duration})
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Negotiation</label>
              <select ref={el => fieldRefs.current.negotiation = el} className="input-large">
                <option value="no">Fixed Price</option>
                <option value="slight">Slight Negotiation</option>
                <option value="moderate">Moderate Negotiation</option>
                <option value="open">Open Negotiation</option>
              </select>
            </div>
          </div>
        </section>

        {/* 3. SPECIFICATIONS - Uses categoryFields + ALL 13 configs */}
        {dynamicFields.length > 0 && (
          <section className="form-section">
            <h2>Specifications ({dynamicFields.length} fields)</h2>
            <div className="dynamic-grid">
              {dynamicFields.map(renderDynamicField)}
            </div>
          </section>
        )}

        {/* 4. FEATURES - Uses featuresByCategory */}
        {categoryFeatures.length > 0 && (
          <section className="form-section">
            <h2>✨ Features ({categoryFeatures.length} available)</h2>
            <div className="features-grid">
              {categoryFeatures.slice(0, 12).map(feature => (
                <label key={feature} className="feature-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  <span>{feature}</span>
                </label>
              ))}
            </div>
            {selectedFeatures.length > 0 && (
              <div className="selected-features">
                Selected: {selectedFeatures.join(', ')}
              </div>
            )}
          </section>
        )}

        {/* 5. DESCRIPTION */}
        <section className="form-section">
          <h2>📝 Description</h2>
          <div className="input-group full-width">
            <label>Description</label>
            <textarea 
              ref={el => fieldRefs.current.description = el}
              rows="5"
              placeholder="Describe your product condition, features, usage..."
              className="textarea-large"
            />
          </div>
        </section>

        {/* 6. LOCATION - Uses locationsByState */}
        <section className="form-section">
          <h2>📍 Location & Contact</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Phone Number *</label>
              <input 
                ref={el => fieldRefs.current.phone = el}
                type="tel" 
                placeholder="08012345678"
                className="input-large required"
                required
              />
            </div>
            <div className="input-group">
              <label className="required">State *</label>
              <select 
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="input-large required"
                required
              >
                <option value="">Select State ({Object.keys(locationsByState || {}).length} states)</option>
                {Object.keys(locationsByState || {}).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>City</label>
              <select ref={el => fieldRefs.current.city = el} className="input-large">
                <option value="">Select City ({stateCities.length} cities)</option>
                {stateCities.slice(0, 25).map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 7. IMAGES */}
        <section className="form-section">
          <h2>🖼️ Product Images (Max 8, 10MB each)</h2>
          <input 
            ref={fileInputRef}
            type="file" 
            multiple 
            accept="image/*" 
            onChange={handleImages}
            className="file-upload"
          />
          {imagesPreview.length > 0 && (
            <div className="images-grid">
              {imagesPreview.map((img, index) => (
                <div key={index} className="image-preview">
                  <img src={img.preview} alt={`Preview ${index}`} />
                  <div className="image-name">{img.name}</div>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="remove-image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 8. TERMS & PUBLISH */}
        <section className="form-section">
          <div className="terms-section">
            <label className="terms-checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>I agree to <strong>Terms & Conditions</strong> and marketplace policies</span>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="submit-button"
            >
              {loading ? '📤 Publishing...' : `🚀 Publish Product${selectedPlan ? ` + ${selectedPlan.name}` : ''}`}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AddProduct;