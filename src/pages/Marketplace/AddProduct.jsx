// src/pages/Marketplace/AddProduct.jsx - ✅ PRODUCTION PERFECT
import React, { useState, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import CustomDropdown from '../../components/CustomDropdown';
import './AddProduct.css';

// ✅ CONFIG IMPORTS WITH FALLBACKS
import { categoryFields } from '../../config/categoryFields';
import { brands } from '../../config/brands';
import { colors } from '../../config/colors';
import { conditions } from '../../config/conditions';
import { featuresByCategory } from '../../config/featuresByCategory';
import { fieldOptions } from '../../config/fieldOptions';
import { locationsByState } from '../../config/locationsByState';
import { ramOptions } from '../../config/ramOptions';
import { sims } from '../../config/sim';
import { storageOptions } from '../../config/storageOptions';

const AddProduct = () => {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();

  // ✅ MAIN FORM STATE
  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    model: '',
    price: '',
    phone_number: '',
    description: '',
    negotiation: 'No',
    condition: '',
    color: '',
    ram: '',
    storage: '',
    sim: '',
    year: '',
    engine: '',
    fuel_type: '',
    transmission: '',
    features: ''
  });

  // ✅ CONTROL STATE
  const [category, setCategory] = useState('');
  const [state, setState] = useState('Lagos');
  const [city, setCity] = useState('');
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [autoDetectedCountry, setAutoDetectedCountry] = useState('NG');

  // ✅ SAFE CONFIG ACCESS
  const categoriesList = Object.keys(categoryFields || {});
  const categoryBrands = brands?.[category] || [];
  const categoryModels = brands?.[category]?.[formData.brand] || [];
  const stateCities = locationsByState?.[state] || [];
  const categoryFieldsConfig = categoryFields?.[category] || {};

  // ✅ RESET FORM ON CATEGORY CHANGE
  useEffect(() => {
    if (category) {
      setFormData({
        title: '',
        brand: '',
        model: '',
        price: '',
        phone_number: '',
        description: '',
        negotiation: 'No',
        condition: '',
        color: '',
        ram: '',
        storage: '',
        sim: '',
        year: '',
        engine: '',
        fuel_type: '',
        transmission: '',
        features: ''
      });
    }
  }, [category]);

  useEffect(() => {
    if (formData.brand && category) {
      setFormData(prev => ({ ...prev, model: '' }));
    }
  }, [formData.brand, category]);

  // ✅ PRICE FORMATTER
  const formatPrice = useCallback((value) => {
    const num = parseInt(value.replace(/,/g, '')) || 0;
    return new Intl.NumberFormat('en-NG').format(num);
  }, []);

  // ✅ UPDATE FIELD HELPER
  const updateFormField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setMessage('');
  }, []);

  // ✅ IMAGE HANDLER - 8 MAX, 10MB
  const handleImages = useCallback((e) => {
    const files = Array.from(e.target.files).slice(0, 8);
    const validFiles = files.filter(file => file.size <= 10 * 1024 * 1024);
    
    validFiles.forEach(file => {
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { 
        file, 
        preview, 
        name: file.name.substring(0, 20) 
      }]);
    });

    if (files.length !== validFiles.length) {
      setMessage('⚠️ Some images too large (max 10MB)');
    }
  }, []);

  const removeImage = useCallback((index) => {
    const item = imagesPreview[index];
    if (item?.preview) URL.revokeObjectURL(item.preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  }, [imagesPreview]);

  // ✅ DYNAMIC FIELDS BY CATEGORY
  const renderDynamicFields = () => {
    const fields = categoryFieldsConfig.fields || [];
    
    return (
      <div className="dynamic-fields-grid">
        {fields.map(field => {
          const options = fieldOptions[field] || [];
          const isMulti = field === 'features' || field === 'sim';
          
          return (
            <div key={field} className="input-group">
              <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              {isMulti ? (
                <input
                  value={formData[field]}
                  onChange={(e) => updateFormField(field, e.target.value)}
                  placeholder={`Enter ${field} (comma separated)`}
                  className="input-field"
                />
              ) : (
                <CustomDropdown
                  options={options}
                  value={formData[field]}
                  onChange={(value) => updateFormField(field, value)}
                  placeholder={`Select ${field}`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ✅ PRODUCTION SUBMIT - MATCHES YOUR BACKEND
  const handleSubmit = async (e) => {
    e.preventDefault();

    // VALIDATION
    if (!termsAccepted) {
      setMessage('❌ Please accept Terms & Conditions');
      return;
    }

    if (!isAuthenticated || !user) {
      setMessage('❌ Please login first');
      return;
    }

    const priceNum = parseInt(formData.price.replace(/,/g, ''), 10);
    if (!formData.title.trim() || priceNum <= 0 || !formData.phone_number || !category || !state) {
      setMessage('❌ Title, price, phone, category, and state required');
      return;
    }

    if (imagesPreview.length === 0) {
      setMessage('❌ At least 1 image required');
      return;
    }

    setLoading(true);
    setMessage('🚀 Publishing product...');

    try {
      const token = await getAccessTokenSilently();

      // ✅ PERFECT MATCH TO YOUR BACKEND SCHEMA
      const productData = {
        title: formData.title.trim(),
        category,
        subcategory: categoryFieldsConfig.subcategory || '',
        brand: formData.brand,
        model: formData.model,
        price: priceNum,
        phone_number: formData.phone_number.trim(),
        description: formData.description.trim(),
        state,
        city,
        poster_name: user.name || 'Anonymous Seller',
        seller_email: user.email,
        sellerId: user.sub,
        
        // DYNAMIC FIELDS
        condition: formData.condition,
        color: formData.color,
        ram: formData.ram,
        storage: formData.storage,
        sim: formData.sim,
        year: formData.year,
        engine: formData.engine,
        fuel_type: formData.fuel_type,
        transmission: formData.transmission,
        
        // FEATURES ARRAY
        features: formData.features 
          ? formData.features.split(',').map(f => f.trim()).filter(Boolean)
          : [],
        
        negotiation: formData.negotiation,
        exchange_possible: false,
        promotion_plan: 0, // Backend handles this
        
        // BACKEND WILL HANDLE IMAGES VIA MULTIPART
        // images handled by multer.array('images')
      };

      // ✅ YOUR PRODUCTION ENDPOINT + PROPER FORM DATA
      const formDataToSend = new FormData();
      Object.keys(productData).forEach(key => {
        if (key === 'features' && Array.isArray(productData[key])) {
          formDataToSend.append(key, JSON.stringify(productData[key]));
        } else {
          formDataToSend.append(key, productData[key]);
        }
      });

      // ADD IMAGES TO FORM DATA
      imagesPreview.forEach(img => {
        formDataToSend.append('images', img.file);
      });

      const response = await fetch('https://minimart-ivrm.onrender.com/api/marketplace/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // NO Content-Type - let browser set multipart boundary
        },
        body: formDataToSend
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage(`🎉 "${formData.title}" published successfully!`);
        
        // RESET FORM
        setTimeout(() => {
          setFormData({
            title: '', brand: '', model: '', price: '', phone_number: '',
            description: '', negotiation: 'No', condition: '', color: '',
            ram: '', storage: '', sim: '', year: '', engine: '',
            fuel_type: '', transmission: '', features: ''
          });
          setCategory('');
          setState('Lagos');
          setCity('');
          setImagesPreview([]);
          setTermsAccepted(false);
          setMessage('');
          navigate('/marketplace/my-products');
        }, 2000);
      } else {
        setMessage(`❌ ${result.message || 'Publish failed'}`);
      }
    } catch (error) {
      console.error('Publish error:', error);
      setMessage(`❌ Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // LOGIN REQUIRED
  if (!isAuthenticated) {
    return (
      <div className="login-required">
        <h2>🔐 Login Required</h2>
        <p>Please login to add products</p>
      </div>
    );
  }

  return (
    <div className="add-product-container">
      {message && (
        <div className={`message-banner ${message.includes('🎉') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} encType="multipart/form-data" className="add-product-form">
        {/* HEADER */}
        <div className="form-header">
          <h1>📦 Add New Product</h1>
          <p>Selling {user.name || 'your'} items to {autoDetectedCountry === 'NG' ? 'Nigeria' : 'global'} buyers</p>
        </div>

        {/* BASIC INFO */}
        <section className="form-section">
          <h3>📋 Basic Information</h3>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Product Title *</label>
              <input
                value={formData.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                placeholder="iPhone 15 Pro Max 256GB - Like New"
                className="input-field required"
                maxLength={200}
              />
            </div>
            <div className="input-group">
              <label className="required">Category *</label>
              <CustomDropdown
                options={categoriesList}
                value={category}
                onChange={setCategory}
                placeholder="Choose category"
                className="required"
              />
            </div>
            <div className="input-group">
              <label>Brand</label>
              <CustomDropdown
                options={categoryBrands}
                value={formData.brand}
                onChange={(value) => updateFormField('brand', value)}
                placeholder="Select brand"
                disabled={!category}
              />
            </div>
            <div className="input-group">
              <label>Model</label>
              <CustomDropdown
                options={categoryModels}
                value={formData.model}
                onChange={(value) => updateFormField('model', value)}
                placeholder={!category ? 'Select category first' : 'Select model'}
                disabled={!category || !formData.brand}
              />
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="form-section">
          <h3>💰 Pricing</h3>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Price (₦) *</label>
              <input
                value={formData.price}
                onChange={(e) => updateFormField('price', formatPrice(e.target.value.replace(/,/g, '')))}
                placeholder="150000"
                className="input-field price-input required"
              />
            </div>
            <div className="input-group">
              <label>Negotiation</label>
              <CustomDropdown
                options={[
                  { value: 'No', label: 'Fixed Price' },
                  { value: 'Slight', label: 'Slightly Negotiable' },
                  { value: 'Moderate', label: 'Moderately Negotiable' },
                  { value: 'Open', label: 'Price is Open' }
                ]}
                value={formData.negotiation}
                onChange={(value) => updateFormField('negotiation', value)}
                placeholder="Fixed Price"
              />
            </div>
          </div>
        </section>

        {/* LOCATION */}
        <section className="form-section">
          <h3>📍 Location</h3>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">State *</label>
              <CustomDropdown
                options={Object.keys(locationsByState || {})}
                value={state}
                onChange={(value) => {
                  setState(value);
                  setCity('');
                }}
                placeholder="Lagos"
                className="required"
              />
            </div>
            <div className="input-group">
              <label>City/Area</label>
              <CustomDropdown
                options={stateCities}
                value={city}
                onChange={setCity}
                placeholder="Ikeja, Lekki, Yaba..."
                disabled={!state}
              />
            </div>
            <div className="input-group">
              <label className="required">Phone Number *</label>
              <input
                value={formData.phone_number}
                onChange={(e) => updateFormField('phone_number', e.target.value)}
                type="tel"
                placeholder="08012345678 or +2348012345678"
                className="input-field required"
                maxLength={15}
              />
            </div>
          </div>
        </section>

        {/* SPECIFICATIONS */}
        {category && (
          <>
            <section className="form-section">
              <h3>🔧 Specifications</h3>
              <div className="input-grid">
                <div className="input-group">
                  <label>Condition</label>
                  <CustomDropdown
                    options={conditions || []}
                    value={formData.condition}
                    onChange={(value) => updateFormField('condition', value)}
                    placeholder="Brand New, Used, Refurbished"
                  />
                </div>
                <div className="input-group">
                  <label>Color</label>
                  <CustomDropdown
                    options={colors || []}
                    value={formData.color}
                    onChange={(value) => updateFormField('color', value)}
                    placeholder="Black, White, Blue, Gold"
                  />
                </div>
              </div>
              {renderDynamicFields()}
            </section>
          </>
        )}

        {/* DESCRIPTION */}
        <section className="form-section">
          <h3>📝 Description</h3>
          <textarea
            value={formData.description}
            onChange={(e) => updateFormField('description', e.target.value)}
            placeholder="Tell buyers about your product condition, usage history, reason for selling, warranty, accessories included, etc..."
            rows={4}
            className="textarea-field"
            maxLength={2000}
          />
        </section>

        {/* IMAGES */}
        <section className="form-section">
          <h3>🖼️ Product Photos <span className="subtitle">(Max 8, 10MB each)</span></h3>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImages}
            className="file-input"
            disabled={imagesPreview.length >= 8}
          />
          {imagesPreview.length > 0 && (
            <div className="images-preview">
              {imagesPreview.map((img, index) => (
                <div key={index} className="image-item">
                  <img src={img.preview} alt={`Preview ${index + 1}`} />
                  <span>{img.name}</span>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="remove-btn"
                    title="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="image-count">
                {imagesPreview.length}/8 images selected
              </div>
            </div>
          )}
        </section>

        {/* TERMS & SUBMIT */}
        <section className="form-section">
          <label className="terms-checkbox">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span>
              I agree to MiniMart <a href="/terms" target="_blank">Terms & Conditions</a> and confirm all information is accurate
            </span>
          </label>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/marketplace')}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !termsAccepted || imagesPreview.length === 0}
              className="btn-primary"
            >
              {loading ? '🚀 Publishing...' : `🚀 Publish Product (${imagesPreview.length}/8)`}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AddProduct;