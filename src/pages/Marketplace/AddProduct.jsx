// src/pages/Marketplace/AddProduct.jsx - ✅ .env AUDIENCE + PRODUCTION READY
import React, { useState, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import CustomDropdown from '../../components/CustomDropdown';
import './AddProduct.css';

// ✅ REACT_APP_ prefix for Create React App
const API_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE || 'https://minimart.localhost';

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
  // ✅ FULL Auth0 destructuring
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  // ✅ FULLY CONTROLLED STATE
  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    model: '',
    price: '',
    phone_number: '',
    description: '',
    negotiation: 'no',
    condition: '',
    color: '',
    ram: '',
    storage: '',
    sim: '',
    engine: '',
    fuel_type: '',
    transmission: '',
    year: '',
    mileage: '',
    used_detail: ''
  });
  
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(localStorage.getItem('termsAccepted') === 'true');

  // ✅ NESTED MODELS + CONFIG DATA
  const categoriesList = Object.keys(categoryFields || {});
  const categoryBrands = brands?.[category] || [];
  const categoryModels = models?.[category]?.[formData.brand] || [];
  const categoryFeatures = featuresByCategory?.[category] || [];
  const stateCities = locationsByState?.[state] || [];

  // ✅ RESET MODEL ON BRAND CHANGE
  useEffect(() => {
    setFormData(prev => ({ ...prev, model: '' }));
  }, [formData.brand]);

  // ✅ RESET ON CATEGORY CHANGE
  useEffect(() => {
    if (category) {
      setSelectedFeatures([]);
      setFormData(prev => ({
        ...prev,
        brand: '',
        model: '',
        condition: '',
        color: '',
        ram: '',
        storage: '',
        sim: '',
        engine: '',
        fuel_type: '',
        transmission: '',
        year: '',
        mileage: '',
        used_detail: ''
      }));
    }
  }, [category]);

  // ✅ FIELD OPTIONS
  const getFieldOptions = (fieldName) => {
    if (fieldName === 'model' && formData.brand && category) {
      return models?.[category]?.[formData.brand] || [];
    }

    const optionsMap = {
      brand: categoryBrands,
      condition: conditions || [],
      used_detail: usedDetails || [],
      color: colors || [],
      ram: ramOptions || [],
      storage: storageOptions || [],
      sim: sims || [],
      engine: engines || [],
      fuel_type: fuelTypes || [],
      transmission: fieldOptions?.transmission || ['Manual', 'Automatic', 'Semi-Automatic'],
      year: years || []
    };
    
    return optionsMap[fieldName] || fieldOptions?.[fieldName] || [];
  };

  const dynamicFields = categoryFields?.[category]?.filter(field => 
    !['features', 'transmission', 'mileage'].includes(field)
  ) || [];

  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-NG').format(parseInt(value) || 0);
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  const renderDynamicField = (fieldName) => {
    const options = getFieldOptions(fieldName);
    const fieldLabel = fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase());
    
    return (
      <div className="dynamic-field" key={fieldName}>
        <label>{fieldLabel}</label>
        {options.length > 0 ? (
          <CustomDropdown
            options={options.slice(0, 25)}
            value={formData[fieldName]}
            onChange={(value) => updateFormField(fieldName, value)}
            placeholder={`Select ${fieldLabel}`}
          />
        ) : (
          <input
            value={formData[fieldName]}
            onChange={(e) => updateFormField(fieldName, e.target.value)}
            type={fieldName.includes('mileage') ? 'number' : 'text'}
            placeholder={`Enter ${fieldLabel}`}
            className="field-input"
          />
        )}
      </div>
    );
  };

  // ✅ FIXED: .env AUTH0 TOKEN + PRODUCTION READY
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      setMessage('❌ Please accept Terms & Conditions first');
      return;
    }

    if (!isAuthenticated) {
      setMessage('❌ Please login first');
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing product...');

      // ✅ .env AUDIENCE FROM ENVIRONMENT
      const token = await getAccessTokenSilently({
        audience: API_AUDIENCE,
        scope: 'write:products'
      });

      const productData = {
        ...formData,
        category,
        state,
        city,
        features: selectedFeatures,
        promotion_plan: selectedPlan ? selectedPlan.id : null,
        poster_name: user?.name || 'Anonymous Seller',
        country: "Nigeria",
        price: parseInt(formData.price.replace(/,/g, '')) || 0
      };

      if (!productData.title.trim() || productData.price <= 0 || !productData.phone_number) {
        setMessage('❌ Title, price, and phone number required');
        return;
      }

      const formDataSubmit = new FormData();
      Object.entries(productData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => formDataSubmit.append(key, item));
        } else if (value !== null && value !== undefined && value !== '') {
          formDataSubmit.append(key, value);
        }
      });

      imagesPreview.forEach(img => formDataSubmit.append('images', img.file));

      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,  // ✅ .env FIXED
        },
        body: formDataSubmit
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`🎉 Product published! ID: ${result.data?._id || result._id}`);
        
        // RESET FORM
        setFormData({
          title: '', brand: '', model: '', price: '', phone_number: '',
          description: '', negotiation: 'no', condition: '', color: '',
          ram: '', storage: '', sim: '', engine: '', fuel_type: '',
          transmission: '', year: '', mileage: '', used_detail: ''
        });
        setCategory(''); setState(''); setCity(''); 
        setImagesPreview([]); setSelectedFeatures([]); setSelectedPlan(null);
        
        setTimeout(() => setMessage(''), 5000);
      } else {
        throw new Error(result.message || 'Publish failed');
      }
    } catch (error) {
      console.error('Publish error:', error);
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
                value={formData.title}
                onChange={(e) => updateFormField('title', e.target.value)}
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
              />
            </div>
            <div className="input-group">
              <label>Brand</label>
              <CustomDropdown
                options={categoryBrands}
                value={formData.brand}
                onChange={(value) => updateFormField('brand', value)}
                placeholder="Select Brand"
                className="input-large"
                disabled={!category}
              />
            </div>
            <div className="input-group">
              <label>Model</label>
              <CustomDropdown
                options={categoryModels}
                value={formData.model}
                onChange={(value) => updateFormField('model', value)}
                placeholder={formData.brand ? `Select ${formData.brand} Model` : "Select Brand First"}
                className="input-large"
                disabled={!formData.brand || !category}
              />
              {categoryModels.length === 0 && formData.brand && (
                <small style={{color: '#666', fontSize: '12px'}}>No models found for this brand</small>
              )}
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
                value={formData.price}
                onChange={(e) => updateFormField('price', formatPrice(e.target.value.replace(/,/g, '')))}
                type="text"
                placeholder="150,000"
                className="input-large price-input required"
                required
              />
            </div>
            <div className="input-group">
              <label>Promotion Plan</label>
              <CustomDropdown
                options={promotionPlans?.map(p => ({ 
                  value: p.id, 
                  label: `${p.name} - ₦${formatPrice(p.price)} (${p.duration})` 
                })) || []}
                value={selectedPlan?.id || ''}
                onChange={(id) => {
                  const plan = promotionPlans?.find(p => p.id == id);
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
                value={formData.negotiation}
                onChange={(value) => updateFormField('negotiation', value)}
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
          </section>
        )}

        {/* DESCRIPTION */}
        <section className="form-section">
          <h2>📝 Description</h2>
          <div className="input-group full-width">
            <label>Description</label>
            <textarea 
              value={formData.description}
              onChange={(e) => updateFormField('description', e.target.value)}
              rows="5"
              className="textarea-large"
              placeholder="Tell buyers more about your product..."
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
                value={formData.phone_number}
                onChange={(e) => updateFormField('phone_number', e.target.value)}
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
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  localStorage.setItem('termsAccepted', e.target.checked);
                }}
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
              {loading ? '📤 Publishing...' : '🚀 Publish Product'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AddProduct;