// src/pages/Marketplace/AddProduct.jsx - ✅ CustomDropdown + Terms Page + Clean
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import CustomDropdown from '../../components/CustomDropdown'; // ✅ CustomDropdown
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

  // ✅ CLEAN CONFIG ACCESS - No numbers/counts
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

  useEffect(() => {
    if (category) setSelectedFeatures([]);
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
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    );
  };

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
            onChange={(value) => fieldRefs.current[fieldName].value = value}
            ref={el => fieldRefs.current[fieldName] = el}
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      setMessage('❌ Please accept Terms & Conditions first');
      return;
    }

    const productData = {
      title: fieldRefs.current.title?.value?.trim() || '',
      category,
      price: parseInt(fieldRefs.current.price?.value?.replace(/,/g, '')) || 0,
      phone_number: fieldRefs.current.phone?.value?.trim() || '',
      state,
      city,
      description: fieldRefs.current.description?.value?.trim() || '',
      negotiation: fieldRefs.current.negotiation?.value || 'no',
      poster_name: user?.name || 'Anonymous Seller',
      country: "Nigeria",
      features: selectedFeatures,
      promotion_plan: selectedPlan ? selectedPlan.id : null
    };

    // Add dynamic fields
    Object.keys(fieldRefs.current).forEach(key => {
      if (dynamicFields.includes(key) && fieldRefs.current[key]?.value) {
        productData[key] = fieldRefs.current[key].value;
      }
    });

    if (!productData.title || productData.price <= 0 || !productData.phone_number) {
      setMessage('❌ Title, price, and phone required');
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
        setMessage(`🎉 Product published! ID: ${result.data?._id}`);
        // Reset form
        Object.keys(fieldRefs.current).forEach(key => fieldRefs.current[key]?.value = '');
        setCategory(''); setState(''); setCity(''); setImagesPreview([]); 
        setSelectedFeatures([]); setSelectedPlan(null);
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
    return <div className="login-required">🔐 Please login to add products</div>;
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
                ref={el => fieldRefs.current.brand = el}
                placeholder="Select Brand"
                className="input-large"
              />
            </div>
            <div className="input-group">
              <label>Model</label>
              <CustomDropdown
                options={categoryModels}
                ref={el => fieldRefs.current.model = el}
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
                options={promotionPlans.map(p => ({ value: p.id, label: `${p.name} - ₦${formatPrice(p.price)} (${p.duration})` }))}
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
                ref={el => fieldRefs.current.negotiation = el}
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
              <div className="selected-features">Selected: {selectedFeatures.join(', ')}</div>
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
          <h2>🖼️ Product Images</h2>
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

        {/* TERMS LINK + PUBLISH */}
        <section className="form-section">
          <div className="terms-section">
            <label className="terms-checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I agree to <a href="/terms" target="_blank" className="terms-link">Terms & Conditions</a>
              </span>
            </label>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              disabled={loading || !termsAccepted}
              className="submit-button"
            >
              {loading ? '📤 Publishing...' : '🚀 Publish Product'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AddProduct;