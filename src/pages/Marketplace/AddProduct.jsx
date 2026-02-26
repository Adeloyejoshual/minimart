// src/pages/Marketplace/AddProduct.jsx - ✅ NO PAYPAL + PURE PAYSTACK
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './AddProduct.css';

// ✅ ALL YOUR 13 CONFIGS - SAFE ACCESS
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

  // ✅ SAFE CONFIG ACCESS - NO CRASH
  const safeCategoryFields = categoryFields || {};
  const safeBrands = brands || {};
  const safeModels = models || {};
  const safeFeatures = featuresByCategory || {};
  const safeLocations = locationsByState || {};

  const categoriesList = Object.keys(safeCategoryFields).length > 0 ? Object.keys(safeCategoryFields) : ['Phones & Tablets', 'Vehicles', 'Electronics'];
  const dynamicFields = safeCategoryFields[category]?.filter(field => 
    !['features', 'transmission', 'mileage'].includes(field)
  ) || [];
  const categoryBrands = safeBrands[category] || [];
  const categoryModels = safeModels[category] || [];
  const categoryFeatures = safeFeatures[category] || [];
  const stateCities = safeLocations[state] || [];

  useEffect(() => {
    if (category) setSelectedFeatures([]);
  }, [category]);

  const getFieldOptions = (fieldName) => {
    const options = {
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
      year: years || []
    };
    return options[fieldName] || [];
  };

  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-NG').format(value || 0);
  };

  const handleImages = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length + imagesPreview.length > 8) {
      setMessage('Maximum 8 images');
      return;
    }
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) return;
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { file, preview, name: file.name.substring(0, 20) }]);
    });
    e.target.value = '';
  }, [imagesPreview.length]);

  const removeImage = useCallback((index) => {
    URL.revokeObjectURL(imagesPreview[index].preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  }, [imagesPreview]);

  const toggleFeature = (feature) => {
    setSelectedFeatures(prev => 
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    );
  };

  const renderDynamicField = (fieldName) => {
    const options = getFieldOptions(fieldName);
    return (
      <div className="dynamic-field" key={fieldName}>
        <label>{fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())}</label>
        {options.length > 0 ? (
          <select ref={el => fieldRefs.current[fieldName] = el} className="field-select">
            <option value="">{`Select ${fieldName}`}</option>
            {options.slice(0, 20).map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            ref={el => fieldRefs.current[fieldName] = el}
            type={fieldName.includes('mileage') ? 'number' : 'text'}
            placeholder={`Enter ${fieldName}`}
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
      promotion_plan: selectedPlan ? selectedPlan.id : null
    };

    dynamicFields.forEach(field => {
      const value = fieldRefs.current[field]?.value;
      if (value) productData[field] = value;
    });

    if (!productData.title || productData.price <= 0 || !productData.phone_number) {
      setMessage('❌ Title, price, and phone required');
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing...');

      const formData = new FormData();
      Object.entries(productData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => formData.append(key, item));
        } else {
          formData.append(key, value);
        }
      });
      imagesPreview.forEach(img => formData.append('images', img.file));

      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`🎉 Published! ID: ${result.data?._id}`);
        Object.keys(fieldRefs.current).forEach(key => fieldRefs.current[key] && (fieldRefs.current[key].value = ''));
        setCategory(''); setState(''); setImagesPreview([]); setSelectedFeatures([]); setSelectedPlan(null); setTermsAccepted(false);
      } else {
        throw new Error(result.message || 'Failed');
      }
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return <div className="login-required">🔐 Login required</div>;

  return (
    <div className="add-product-container">
      {message && <div className={`message ${message.includes('🎉') ? 'success' : 'error'}`}>{message}</div>}
      
      <form onSubmit={handleSubmit} className="product-form">
        {/* PRODUCT DETAILS */}
        <section className="form-section">
          <h2>📦 Product Details</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Product Title *</label>
              <input ref={el => fieldRefs.current.title = el} type="text" placeholder="Tecno Camon 19" className="input-large required" required />
            </div>
            <div className="input-group">
              <label className="required">Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-large required" required>
                <option value="">Select Category</option>
                {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Brand</label>
              <select ref={el => fieldRefs.current.brand = el} className="input-large">
                <option value="">Select Brand</option>
                {categoryBrands.slice(0, 20).map(brand => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Model</label>
              <select ref={el => fieldRefs.current.model = el} className="input-large">
                <option value="">Select Model</option>
                {categoryModels.slice(0, 20).map(model => <option key={model} value={model}>{model}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* PRICING & PROMOTION */}
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
                onInput={(e) => e.target.value = formatPrice(e.target.value.replace(/,/g, ''))}
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
          </div>
        </section>

        {/* SPECIFICATIONS */}
        {dynamicFields.length > 0 && (
          <section className="form-section">
            <h2>Specifications ({dynamicFields.length})</h2>
            <div className="dynamic-grid">
              {dynamicFields.map(renderDynamicField)}
            </div>
          </section>
        )}

        {/* FEATURES */}
        {categoryFeatures.length > 0 && (
          <section className="form-section">
            <h2>✨ Features</h2>
            <div className="features-grid">
              {categoryFeatures.slice(0, 12).map(feature => (
                <label key={feature} className="feature-checkbox">
                  <input type="checkbox" checked={selectedFeatures.includes(feature)} onChange={() => toggleFeature(feature)} />
                  <span>{feature}</span>
                </label>
              ))}
            </div>
            {selectedFeatures.length > 0 && (
              <div className="selected-features">Selected: {selectedFeatures.join(', ')}</div>
            )}
          </section>
        )}

        {/* DESCRIPTION */}
        <section className="form-section">
          <h2>📝 Description</h2>
          <div className="input-group full-width">
            <label>Description</label>
            <textarea ref={el => fieldRefs.current.description = el} rows="5" className="textarea-large" />
          </div>
        </section>

        {/* LOCATION */}
        <section className="form-section">
          <h2>📍 Location</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Phone *</label>
              <input ref={el => fieldRefs.current.phone = el} type="tel" placeholder="08012345678" className="input-large required" required />
            </div>
            <div className="input-group">
              <label className="required">State *</label>
              <select onChange={(e) => setState(e.target.value)} className="input-large required" required>
                <option value="">Select State</option>
                {Object.keys(safeLocations).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>City</label>
              <select ref={el => fieldRefs.current.city = el} className="input-large">
                <option value="">Select City</option>
                {stateCities.slice(0, 20).map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* IMAGES */}
        <section className="form-section">
          <h2>🖼️ Images (Max 8)</h2>
          <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImages} className="file-upload" />
          {imagesPreview.length > 0 && (
            <div className="images-grid">
              {imagesPreview.map((img, i) => (
                <div key={i} className="image-preview">
                  <img src={img.preview} alt="Preview" />
                  <button type="button" onClick={() => removeImage(i)} className="remove-image">×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* TERMS & SUBMIT */}
        <section className="form-section">
          <label className="terms-checkbox">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
            <span>I agree to <strong>Terms & Conditions</strong></span>
          </label>
          <div className="form-actions">
            <button type="submit" disabled={loading || !termsAccepted} className="submit-button">
              {loading ? 'Publishing...' : `🚀 Publish${selectedPlan ? ` + ${selectedPlan.name}` : ''}`}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AddProduct;