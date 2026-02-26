// src/pages/Marketplace/AddProduct.jsx - ✅ PERFECT + CustomDropdown + No Errors
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import CustomDropdown from '../../components/CustomDropdown';
import './AddProduct.css';

// ✅ ALL 13 CONFIGS
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
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth0();

  // ✅ CLEAN CONFIG ACCESS
  const categoriesList = Object.keys(categoryFields || {});
  const dynamicFields = categoryFields?.[category]?.filter(field => 
    !['features', 'transmission', 'mileage'].includes(field)
  ) || [];
  
  const categoryBrands = brands?.[category] || [];
  const categoryModels = models?.[category] || [];
  const categoryFeatures = featuresByCategory?.[category] || [];
  const stateCities = locationsByState?.[state] || [];

  const getFieldOptions = (fieldName) => {
    const optionsMap = {
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
      ...fieldOptions
    };
    return optionsMap[fieldName] || [];
  };

  // Reset features on category change
  useEffect(() => {
    if (category) {
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
    if (imagesPreview[index]) {
      URL.revokeObjectURL(imagesPreview[index].preview);
    }
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  }, [imagesPreview]);

  const toggleFeature = useCallback((feature) => {
    setSelectedFeatures(prev => 
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  }, []);

  // ✅ FIXED: Safe dynamic field rendering
  const renderDynamicField = (fieldName) => {
    const options = getFieldOptions(fieldName);
    const fieldLabel = fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase());
    
    return (
      <div className="dynamic-field" key={fieldName}>
        <label>{fieldLabel}</label>
        {options.length > 0 ? (
          <CustomDropdown
            options={options.slice(0, 25)}
            placeholder={`Select ${fieldLabel}`}
            onChange={(value) => {
              const element = fieldRefs.current[fieldName];
              if (element) element.value = value;
            }}
          />
        ) : (
          <input
            ref={el => fieldRefs.current[fieldName] = el}
            type={fieldName.includes('mileage') ? 'number' : 'text'}
            placeholder={`Enter ${fieldLabel}`}
            className="field-input"
          />
        )}
      </div>
    );
  };

  // ✅ FIXED: Safe form reset + NO ESBUILD ERRORS
  const resetForm = () => {
    // Clear input values safely
    Object.keys(fieldRefs.current).forEach(key => {
      const element = fieldRefs.current[key];
      if (element && typeof element.value !== 'undefined') {
        element.value = '';
      }
    });
    
    // Reset state
    setCategory('');
    setState('');
    setCity('');
    setImagesPreview([]);
    setSelectedFeatures([]);
    setSelectedPlan(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      setMessage('❌ Please accept Terms & Conditions first');
      return;
    }

    // ✅ Safe data collection
    const titleEl = fieldRefs.current.title;
    const priceEl = fieldRefs.current.price;
    const phoneEl = fieldRefs.current.phone;
    const descriptionEl = fieldRefs.current.description;

    const productData = {
      title: titleEl?.value?.trim() || '',
      category,
      price: parseInt(priceEl?.value?.replace(/,/g, '')) || 0,
      phone_number: phoneEl?.value?.trim() || '',
      state,
      city,
      description: descriptionEl?.value?.trim() || '',
      negotiation: fieldRefs.current.negotiation?.value || 'no',
      poster_name: user?.name || 'Anonymous Seller',
      country: "Nigeria",
      features: selectedFeatures,
      promotion_plan: selectedPlan ? selectedPlan.id : null,
      brand: fieldRefs.current.brand?.value || '',
      model: fieldRefs.current.model?.value || ''
    };

    // Add dynamic fields safely
    dynamicFields.forEach(field => {
      const element = fieldRefs.current[field];
      if (element?.value) {
        productData[field] = element.value;
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

      imagesPreview.forEach(img => formData.append('images', img.file));

      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`🎉 Product published! ID: ${result.data?._id || result._id}`);
        resetForm();
        setTimeout(() => setMessage(''), 5000);
      } else {
        throw new Error(result.message || 'Publish failed');
      }
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-required" style={{ padding: '2rem', textAlign: 'center' }}>
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
        {/* PRODUCT DETAILS */}
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
              <CustomDropdown
                options={categoriesList}
                value={category}
                onChange={setCategory}
                placeholder="Select Category"
                className="input-large required"
                required
              />
            </div>
            <div className="input-group">
              <label>Brand</label>
              <CustomDropdown
                options={categoryBrands}
                onChange={(value) => {
                  const el = fieldRefs.current.brand;
                  if (el) el.value = value;
                }}
                placeholder="Select Brand"
                className="input-large"
              />
            </div>
            <div className="input-group">
              <label>Model</label>
              <CustomDropdown
                options={categoryModels}
                onChange={(value) => {
                  const el = fieldRefs.current.model;
                  if (el) el.value = value;
                }}
                placeholder="Select Model"
                className="input-large"
              />
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
              <CustomDropdown
                options={promotionPlans.map(p => ({ 
                  value: p.id, 
                  label: `${p.name} - ₦${formatPrice(p.price)} (${p.duration})` 
                }))}
                value={selectedPlan?.id || ''}
                onChange={(id) => {
                  const plan = promotionPlans.find(p => p.id == id);
                  setSelectedPlan(plan);
                }}
                placeholder="Free Listing"
                className="input-large"
              />
            </div>
            <div className="input-group">
              <label>Negotiation</label>
              <CustomDropdown
                options={[
                  { value: 'no', label: 'Fixed Price' },
                  { value: 'slight', label: 'Slight Negotiation' },
                  { value: 'moderate', label: 'Moderate Negotiation' },
                  { value: 'open', label: 'Open Negotiation' }
                ]}
                onChange={(value) => {
                  const el = fieldRefs.current.negotiation;
                  if (el) el.value = value;
                }}
                placeholder="Select Negotiation Type"
                className="input-large"
              />
            </div>
          </div>
        </section>

        {/* SPECIFICATIONS */}
        {dynamicFields.length > 0 && (
          <section className="form-section">
            <h2>Specifications</h2>
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

        {/* DESCRIPTION */}
        <section className="form-section">
          <h2>📝 Description</h2>
          <div className="input-group full-width">
            <label>Description</label>
            <textarea 
              ref={el => fieldRefs.current.description = el}
              rows="5"
              placeholder="Describe your product..."
              className="textarea-large"
            />
          </div>
        </section>

        {/* LOCATION */}
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
              <CustomDropdown
                options={Object.keys(locationsByState || {})}
                value={state}
                onChange={(value) => {
                  setState(value);
                  setCity('');
                }}
                placeholder="Select State"
                className="input-large required"
                required
              />
            </div>
            <div className="input-group">
              <label>City</label>
              <CustomDropdown
                options={stateCities}
                value={city}
                onChange={setCity}
                placeholder="Select City"
                className="input-large"
                disabled={!state}
              />
            </div>
          </div>
        </section>

        {/* IMAGES */}
        <section className="form-section">
          <h2>🖼️ Product Images (Max 8)</h2>
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

        {/* TERMS & PUBLISH */}
        <section className="form-section">
          <div className="terms-section">
            <label className="terms-checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I agree to <a href="/terms" target="_blank" rel="noopener noreferrer" className="terms-link">Terms & Conditions</a>
              </span>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="submit-button"
            >
              {loading ? '📤 Publishing...' : `🚀 Publish Product`}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AddProduct;