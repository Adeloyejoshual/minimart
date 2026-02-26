// src/pages/Marketplace/AddProduct.jsx - ✅ ALL SECTIONS VISIBLE + FIXED PUBLISH
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './AddProduct.css';

// ✅ ALL YOUR 13 CONFIGS
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

const AddProduct = () => {
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  
  const fieldRefs = useRef({});
  const fileInputRef = useRef(null);
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  // ✅ ALL CONFIG COMPUTATIONS
  const dynamicFields = category ? categoryFields[category] || [] : [];
  const categoryBrands = category ? brands[category] || [] : [];
  const categoryModels = category ? models[category] || [] : [];
  const categoryFeatures = category ? featuresByCategory[category] || [] : [];
  const stateCities = state ? locationsByState[state] || [] : [];

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
      setImagesPreview(prev => [...prev, { 
        file, preview, name: file.name.substring(0, 20) 
      }]);
    });
    e.target.value = '';
  }, [imagesPreview.length]);

  const removeImage = useCallback((index) => {
    URL.revokeObjectURL(imagesPreview[index].preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  }, [imagesPreview]);

  // ✅ FIXED FEATURES CHECKBOX HANDLER
  const toggleFeature = (feature) => {
    setSelectedFeatures(prev => 
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

  const renderDynamicField = (fieldName) => {
    const options = getFieldOptions(fieldName);
    const isCheckbox = fieldName === 'negotiation';
    const isSelect = options.length > 1;

    return (
      <div className="dynamic-field" key={fieldName}>
        <label>{fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())}</label>
        {isCheckbox ? (
          <input 
            ref={el => fieldRefs.current[fieldName] = el}
            type="checkbox"
            className="field-checkbox"
          />
        ) : isSelect ? (
          <select ref={el => fieldRefs.current[fieldName] = el} className="field-select">
            <option value="">{`Select ${fieldName}`}</option>
            {options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            ref={el => fieldRefs.current[fieldName] = el}
            type={fieldName.includes('price|mileage|year') ? 'number' : 'text'}
            placeholder={`Enter ${fieldName}`}
            className="field-input"
          />
        )}
      </div>
    );
  };

  // ✅ FIXED PUBLISHING - FormData + All Fields + Debug
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('🚀 FORM SUBMISSION STARTED');
    
    const productData = {
      title: fieldRefs.current.title?.value?.trim() || '',
      category,
      brand: fieldRefs.current.brand?.value || '',
      model: fieldRefs.current.model?.value || '',
      condition: fieldRefs.current.condition?.value || '',
      price: parseInt(fieldRefs.current.price?.value) || 0,
      phone_number: fieldRefs.current.phone?.value || '',
      state,
      city: fieldRefs.current.city?.value || '',
      description: fieldRefs.current.description?.value?.trim() || '',
      negotiation: fieldRefs.current.negotiation?.checked ? "Yes" : "No",
      poster_name: user?.name || 'Anonymous Seller',
      country: "Nigeria",
      features: selectedFeatures,
      images: imagesPreview.map(img => img.file),
      exchange_possible: false,
      status: 'active'
    };

    // Add dynamic fields
    dynamicFields.forEach(field => {
      const value = fieldRefs.current[field]?.value;
      if (value) productData[field] = value;
    });

    console.log('📦 PRODUCT DATA:', productData);

    if (!productData.title || productData.price <= 0) {
      setMessage('❌ Title and price required');
      return;
    }

    if (!productData.phone_number.trim()) {
      setMessage('❌ Phone number required');
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing product...');

      const formData = new FormData();
      
      // Add all fields to FormData
      Object.entries(productData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => formData.append(key, item));
        } else if (value !== null && value !== undefined) {
          formData.append(key, value);
        }
      });

      // Add image files separately
      imagesPreview.forEach((img, index) => {
        formData.append('images', img.file);
      });

      console.log('📤 FormData keys:', Array.from(formData.keys()));
      
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: formData
      });

      console.log('📡 Response status:', response.status);
      
      const result = await response.json();
      console.log('📥 Response data:', result);

      if (response.ok) {
        setMessage(`🎉 Product published successfully! ID: ${result.data?._id || result._id}`);
        
        // Reset form
        Object.keys(fieldRefs.current).forEach(key => {
          const el = fieldRefs.current[key];
          if (el) {
            if (el.type === 'checkbox') el.checked = false;
            else el.value = '';
          }
        });
        setCategory(''); 
        setState(''); 
        setImagesPreview([]); 
        setSelectedFeatures([]);
        
        setTimeout(() => setMessage(''), 5000);
      } else {
        console.error('❌ Backend error:', result);
        throw new Error(result.message || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Publish error:', error);
      setMessage(`❌ Publish failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <div className="login-required">🔐 Please login to add products</div>;
  }

  return (
    <div className="add-product-container">
      {message && (
        <div className={`message ${message.includes('🎉') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="product-form all-sections-visible">
        {/* SECTION 1: PRODUCT DETAILS */}
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
                onChange={(e) => setCategory(e.target.value)}
                className="input-large required"
                required
              >
                <option value="">Select Category</option>
                {Object.keys(categoryFields).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Brand</label>
              <select ref={el => fieldRefs.current.brand = el} className="input-large">
                <option value="">Select Brand</option>
                {categoryBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 2: PRICING */}
        <section className="form-section">
          <h2>💰 Pricing</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Price (₦) *</label>
              <input 
                ref={el => fieldRefs.current.price = el}
                type="number" 
                min="0"
                step="1000"
                placeholder="150000"
                className="input-large required"
                required 
              />
            </div>
            <div className="input-group checkbox-group">
              <label className="checkbox-label">
                <input 
                  ref={el => fieldRefs.current.negotiation = el}
                  type="checkbox"
                  className="checkbox"
                />
                Negotiation Allowed
              </label>
            </div>
          </div>
        </section>

        {/* SECTION 3: SPECIFICATIONS - ALL YOUR CONFIGS */}
        {dynamicFields.length > 0 && (
          <section className="form-section">
            <h2>⚙️ Specifications</h2>
            <div className="dynamic-grid">
              {dynamicFields.map(renderDynamicField)}
            </div>
          </section>
        )}

        {/* SECTION 4: FEATURES CHECKBOXES */}
        {categoryFeatures.length > 0 && (
          <section className="form-section">
            <h2>✨ Features</h2>
            <div className="features-grid">
              {categoryFeatures.map(feature => (
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

        {/* SECTION 5: DESCRIPTION */}
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

        {/* SECTION 6: LOCATION & CONTACT */}
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
                onChange={(e) => setState(e.target.value)}
                className="input-large required"
                required
              >
                <option value="">Select State</option>
                {Object.keys(locationsByState).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>City</label>
              <select ref={el => fieldRefs.current.city = el} className="input-large">
                <option value="">Select City</option>
                {stateCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 7: IMAGES */}
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

        {/* PUBLISH BUTTON */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className="submit-button"
          >
            {loading ? '📤 Publishing...' : `🚀 Publish ${category || 'Product'}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProduct;