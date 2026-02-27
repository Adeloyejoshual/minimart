// src/pages/Marketplace/AddProduct.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import CustomDropdown from '../../components/CustomDropdown';
import './AddProduct.css';

// ✅ All config imports (even if some are empty, we guard them)
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

// ✅ Example promotion plans (you can remove later / replace with backend data)
const promotionPlans = [
  { id: 'free', name: 'Free Listing', price: 0, duration: '7 days' }
];

const AddProduct = () => {
  const { user, isAuthenticated } = useAuth0();

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
  const [termsAccepted, setTermsAccepted] = useState(
    localStorage.getItem('termsAccepted') === 'true'
  );

  // ✅ Guarded data access (no crash if a config is undefined)
  const categoriesList = Object.keys(categoryFields || {});
  const categoryBrands  = Array.isArray(brands?.[category]) ? brands[category] : [];
  const categoryModels  = Array.isArray(models?.[category]?.[formData.brand])
    ? models[category][formData.brand]
    : [];
  const categoryFeatures = Array.isArray(featuresByCategory?.[category])
    ? featuresByCategory[category]
    : [];
  const stateCities     = Array.isArray(locationsByState?.[state])
    ? locationsByState[state]
    : [];

  // ✅ Reset model when brand changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, model: '' }));
  }, [formData.brand]);

  // ✅ Reset all fields when category changes
  useEffect(() => {
    if (category) {
      setSelectedFeatures([]);
      setFormData(prev => ({
        ...prev,
        brand: '', model: '', condition: '', color: '',
        ram: '', storage: '', sim: '', engine: '',
        fuel_type: '', transmission: '', year: '', mileage: '', used_detail: ''
      }));
    }
  }, [category]);

  // ✅ Safe dynamic field options
  const getFieldOptions = (fieldName) => {
    if (fieldName === 'model' && formData.brand && category) {
      return categoryModels;
    }

    const optionsMap = {
      brand:        categoryBrands,
      condition:    Array.isArray(conditions) ? conditions : [],
      used_detail:  Array.isArray(usedDetails) ? usedDetails : [],
      color:        Array.isArray(colors) ? colors : [],
      ram:          Array.isArray(ramOptions) ? ramOptions : [],
      storage:      Array.isArray(storageOptions) ? storageOptions : [],
      sim:          Array.isArray(sims) ? sims : [],
      engine:       Array.isArray(engines) ? engines : [],
      fuel_type:    Array.isArray(fuelTypes) ? fuelTypes : [],
      transmission: Array.isArray(fieldOptions?.transmission)
        ? fieldOptions.transmission
        : ['Manual', 'Automatic', 'Semi‑Automatic'],
      year:         Array.isArray(years) ? years : []
    };

    return Array.isArray(optionsMap[fieldName])
      ? optionsMap[fieldName]
      : Array.isArray(fieldOptions?.[fieldName])
        ? fieldOptions[fieldName]
        : [];
  };

  const dynamicFields = Array.isArray(categoryFields?.[category])
    ? categoryFields[category].filter(
        field => !['features', 'transmission', 'mileage'].includes(field)
      )
    : [];

  // ✅ Helpers
  const formatPrice = (value) => {
    return new Intl.NumberFormat('en‑NG').format(parseInt(value) || 0);
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

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setMessage('Maximum 10MB per image');
        return;
      }
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [
        ...prev,
        { file, preview, name: file.name.substring(0, 20) }
      ]);
    }
  }, [imagesPreview.length]);

  const removeImage = useCallback((index) => {
    const item = imagesPreview[index];
    if (item) URL.revokeObjectURL(item.preview);
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

  // ✅ Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!termsAccepted) {
      setMessage('❌ Please accept Terms & Conditions first');
      return;
    }

    if (!isAuthenticated || !user?.email) {
      setMessage('❌ Please login first');
      return;
    }

    const priceNum = parseInt(formData.price.replace(/,/g, ''), 10) || 0;
    if (!formData.title?.trim() || priceNum <= 0 || !formData.phone_number) {
      setMessage('❌ Title, price, and phone number are required');
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing product...');

      const productData = {
        ...formData,
        category,
        state,
        city,
        features: selectedFeatures,
        promotion_plan: selectedPlan ? selectedPlan.id : null,
        poster_name: user.name || 'Anonymous Seller',
        seller_email: user.email,
        country: 'Nigeria',
        price: priceNum
      };

      const formDataSubmit = new FormData();
      Object.entries(productData).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(item => formDataSubmit.append(key, item));
        } else if (value !== null && value !== undefined) {
          formDataSubmit.append(key, String(value));
        }
      });

      imagesPreview.forEach(img => formDataSubmit.append('images', img.file));

      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: formDataSubmit
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`🎉 Product published! ID: ${result.data?._id || result._id}`);

        // Reset form
        setFormData({
          title: '', brand: '', model: '', price: '', phone_number: '',
          description: '', negotiation: 'no', condition: '', color: '',
          ram: '', storage: '', sim: '', engine: '', fuel_type: '',
          transmission: '', year: '', mileage: '', used_detail: ''
        });
        setCategory('');
        setState('');
        setCity('');
        setImagesPreview([]);
        setSelectedFeatures([]);
        setSelectedPlan(null);

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

  // ✅ Always show login message or form
  if (!isAuthenticated) {
    return (
      <div className="login-required" style={{ textAlign: 'center', padding: '2rem' }}>
        🔐 <strong>Please login to add products</strong>
      </div>
    );
  }

  // This is the main form; if page is blank, an error exists in this block.
  return (
    <div className="add-product-container">
      {message && (
        <div className={`message ${message.includes('🎉') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="product-form">
        {/* Product Details */}
        <section className="form-section">
          <h2>📦 Product Details</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Product Title *</label>
              <input
                value={formData.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                type="text"
                placeholder="Tecno Camon 19 32GB Green - Perfect Condition"
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
                placeholder={formData.brand ? `Select ${formData.brand} Model` : 'Select Brand First'}
                className="input-large"
                disabled={!formData.brand || !category}
              />
              {categoryModels.length === 0 && formData.brand && (
                <small style={{ color: '#666', fontSize: '12px' }}>
                  No models found for this brand
                </small>
              )}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="form-section">
          <h2>💰 Pricing</h2>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Price (₦) *</label>
              <input
                value={formData.price}
                onChange={(e) =>
                  updateFormField('price', formatPrice(e.target.value.replace(/,/g, '')))
                }
                type="text"
                placeholder="150,000"
                className="input-large price-input required"
              />
            </div>
            <div className="input-group">
              <label>Promotion Plan</label>
              <CustomDropdown
                options={
                  Array.isArray(promotionPlans)
                    ? promotionPlans.map(p => ({
                        value: p.id,
                        label: `${p.name} - ₦${formatPrice(p.price)} (${p.duration})`
                      }))
                    : []
                }
                value={selectedPlan?.id || ''}
                onChange={(id) => {
                  const plan = Array.isArray(promotionPlans)
                    ? promotionPlans.find(p => String(p.id) === String(id))
                    : undefined;
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

        {/* Specifications */}
        {dynamicFields.length > 0 && (
          <section className="form-section">
            <h2>Specifications</h2>
            <div className="dynamic-grid">
              {dynamicFields.map(renderDynamicField)}
            </div>
          </section>
        )}

        {/* Features */}
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

        {/* Description */}
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

        {/* Location & Contact */}
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
                options={Array.isArray(locationsByState) ? Object.keys(locationsByState) : []}
                value={state}
                onChange={value => {
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

        {/* Images */}
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

        {/* Terms & Submit */}
        <section className="form-section">
          <div className="terms-section">
            <label className="terms-checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => {
                  setTermsAccepted(e.target.checked);
                  localStorage.setItem('termsAccepted', e.target.checked);
                }}
              />
              <span>
                I agree to{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="terms-link">
                  Terms & Conditions
                </a>
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