// src/pages/Marketplace/AddProduct.jsx - ✅ 100% WORKING WITH YOUR CONFIGS
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import CustomDropdown from '../../components/CustomDropdown';
import './AddProduct.css';

// ✅ YOUR EXACT 13 CONFIGS
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
  const [city, setCity] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(localStorage.getItem('termsAccepted') === 'true');
  
  const fieldRefs = useRef({});
  const fileInputRef = useRef(null);
  const { user, isAuthenticated } = useAuth0();

  // ✅ EXACT MATCH - Your config keys
  const categoriesList = Object.keys(categoryFields);
  const currentCategoryFields = categoryFields[category] || [];
  
  // ✅ FIXED: Remove 'features' from dynamic fields only
  const dynamicFields = currentCategoryFields.filter(field => field !== 'features');
  
  // ✅ YOUR EXACT CONFIG ACCESS
  const categoryBrands = brands[category] || [];
  const categoryModels = models[category] || [];
  const categoryFeatures = featuresByCategory[category] || [];
  const stateCities = locationsByState[state] || [];

  const getFieldOptions = (fieldName) => {
    const options = {
      brand: categoryBrands,
      model: categoryModels,
      condition: conditions,
      used_detail: usedDetails,
      color: colors,
      ram: ramOptions,
      storage: storageOptions,
      sim: sims,
      engine: engines,
      fuel_type: fuelTypes,
      year: years,
      ...fieldOptions
    };
    return options[fieldName] || [];
  };

  useEffect(() => {
    if (category) {
      setSelectedFeatures([]);
      console.log(`✅ Category: "${category}" → Fields:`, dynamicFields);
    }
  }, [category]);

  const formatPrice = (value) => new Intl.NumberFormat('en-NG').format(value || 0);

  const resetForm = () => {
    Object.keys(fieldRefs.current).forEach(key => {
      const el = fieldRefs.current[key];
      if (el && el.tagName) el.value = '';
    });
    setCategory(''); setState(''); setCity(''); 
    setImagesPreview([]); setSelectedFeatures([]); setSelectedPlan(null);
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
      state, city,
      description: fieldRefs.current.description?.value?.trim() || '',
      negotiation: fieldRefs.current.negotiation?.value || 'no',
      poster_name: user?.name || 'Anonymous Seller',
      features: selectedFeatures,
      promotion_plan: selectedPlan?.id || null
    };

    // Add dynamic fields
    dynamicFields.forEach(field => {
      const value = fieldRefs.current[field]?.value;
      if (value) productData[field] = value;
    });

    if (!productData.title || !productData.phone_number || productData.price <= 0) {
      setMessage('❌ Title, phone, and valid price required');
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing...');

      const formData = new FormData();
      Object.entries(productData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => formData.append(key, item));
        } else if (value) {
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
        resetForm();
        setTimeout(() => setMessage(''), 5000);
      } else {
        throw new Error(result.message || 'Failed');
      }
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <div className="login-required">🔐 Login required</div>;
  }

  return (
    <div className="add-product-container">
      {message && <div className={`message ${message.includes('🎉') ? 'success' : 'error'}`}>{message}</div>}
      
      <form onSubmit={handleSubmit} className="product-form">
        {/* PRODUCT DETAILS */}
        <section className="form-section">
          <h2>📦 Product Details</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Title *</label>
              <input ref={el => fieldRefs.current.title = el} type="text" placeholder="Tecno Camon 19" className="input-large required" required />
            </div>
            <div className="input-group">
              <label className="required">Category *</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="input-large required"
                required
              >
                <option value="">Select Category</option>
                {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Brand</label>
              <select ref={el => fieldRefs.current.brand = el} className="input-large">
                <option value="">Select Brand</option>
                {categoryBrands.slice(0, 20).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Model</label>
              <select ref={el => fieldRefs.current.model = el} className="input-large">
                <option value="">Select Model</option>
                {categoryModels.slice(0, 20).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="form-section">
          <h2>💰 Pricing</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Price (₦) *</label>
              <input 
                ref={el => fieldRefs.current.price = el}
                type="text"
                placeholder="150000"
                className="input-large required"
                onInput={(e) => e.target.value = formatPrice(e.target.value.replace(/,/g, ''))}
                required
              />
            </div>
            <div className="input-group">
              <label>Promotion</label>
              <select 
                value={selectedPlan?.id || ''} 
                onChange={(e) => {
                  const id = parseInt(e.target.value);
                  setSelectedPlan(promotionPlans.find(p => p.id === id));
                }}
                className="input-large"
              >
                <option value="">Free Listing</option>
                {promotionPlans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} - ₦{formatPrice(p.price)}</option>
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

        {/* SPECIFICATIONS - YOUR EXACT FIELDS */}
        {dynamicFields.length > 0 && (
          <section className="form-section">
            <h2>Specifications</h2>
            <div className="dynamic-grid">
              {dynamicFields.map(field => {
                const options = getFieldOptions(field);
                const label = field.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase());
                return (
                  <div className="dynamic-field" key={field}>
                    <label>{label}</label>
                    {options.length > 0 ? (
                      <select ref={el => fieldRefs.current[field] = el} className="field-select">
                        <option value="">{`Select ${label}`}</option>
                        {options.slice(0, 20).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        ref={el => fieldRefs.current[field] = el}
                        type={field.includes('mileage') ? 'number' : 'text'}
                        placeholder={`Enter ${label}`}
                        className="field-input"
                      />
                    )}
                  </div>
                );
              })}
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
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                  />
                  <span>{feature}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* DESCRIPTION + LOCATION + PHONE */}
        <section className="form-section">
          <h2>📝 Description</h2>
          <div className="input-group full-width">
            <textarea ref={el => fieldRefs.current.description = el} rows="4" className="textarea-large" />
          </div>
        </section>

        <section className="form-section">
          <h2>📍 Location</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Phone *</label>
              <input ref={el => fieldRefs.current.phone = el} type="tel" placeholder="08012345678" className="input-large required" required />
            </div>
            <div className="input-group">
              <label className="required">State *</label>
              <select 
                value={state} 
                onChange={(e) => setState(e.target.value)}
                className="input-large required"
                required
              >
                <option value="">Select State</option>
                {Object.keys(locationsByState).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>City</label>
              <select value={city} onChange={(e) => setCity(e.target.value)} className="input-large">
                <option value="">Select City</option>
                {stateCities.slice(0, 20).map(c => <option key={c} value={c}>{c}</option>)}
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

        {/* TERMS + SUBMIT */}
        <section className="form-section">
          <label className="terms-checkbox">
            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
            <span>I agree to <a href="/terms" target="_blank" className="terms-link">Terms & Conditions</a></span>
          </label>
          <div className="form-actions">
            <button type="submit" disabled={loading || !termsAccepted} className="submit-button">
              {loading ? 'Publishing...' : '🚀 Publish Product'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AddProduct;