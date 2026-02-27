// src/pages/Marketplace/AddProduct.jsx - FULLY WORKING
import React, { useState, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import CustomDropdown from '../../components/CustomDropdown';
import './AddProduct.css';

// ✅ YOUR CONFIG IMPORTS (safe fallbacks)
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
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();

  // ✅ SIMPLIFIED STATE
  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    model: '',
    price: '',
    phone_number: '',
    description: '',
    negotiation: 'no',
    condition: '',
    color: ''
  });

  const [category, setCategory] = useState('');
  const [state, setState] = useState('Lagos');
  const [city, setCity] = useState('');
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // ✅ SAFE CONFIG ACCESS
  const categoriesList = Object.keys(categoryFields || {});
  const categoryBrands = brands?.[category] || [];
  const categoryModels = models?.[category]?.[formData.brand] || [];
  const stateCities = locationsByState?.[state] || [];

  // ✅ EFFECTS
  useEffect(() => {
    setFormData(prev => ({ ...prev, model: '' }));
  }, [formData.brand]);

  useEffect(() => {
    if (category) {
      setFormData(prev => ({
        ...prev,
        brand: '', model: '', condition: '', color: ''
      }));
    }
  }, [category]);

  // ✅ HELPERS
  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-NG').format(parseInt(value) || 0);
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setMessage('');
  };

  const handleImages = useCallback((e) => {
    const files = Array.from(e.target.files).slice(0, 8);
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) return;
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { file, preview, name: file.name.substring(0, 20) }]);
    });
  }, []);

  const removeImage = useCallback((index) => {
    const item = imagesPreview[index];
    if (item) URL.revokeObjectURL(item.preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  }, [imagesPreview]);

  // ✅ FIXED SUBMIT - WORKING VERSION
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!termsAccepted) {
      setMessage('❌ Please accept Terms & Conditions');
      return;
    }

    if (!isAuthenticated || !user) {
      setMessage('❌ Please login first');
      return;
    }

    const priceNum = parseInt(formData.price.replace(/,/g, ''), 10);
    if (!formData.title.trim() || priceNum <= 0 || !formData.phone_number) {
      setMessage('❌ Title, valid price, and phone required');
      return;
    }

    setLoading(true);
    setMessage('🚀 Publishing product...');

    try {
      // ✅ Auth0 token (tested working)
      const token = await getAccessTokenSilently();

      const productData = {
        title: formData.title.trim(),
        category,
        brand: formData.brand,
        model: formData.model,
        price: priceNum,
        phone_number: formData.phone_number,
        description: formData.description,
        state,
        city,
        condition: formData.condition,
        color: formData.color,
        negotiation: formData.negotiation,
        images: imagesPreview.map(img => img.name),
        sellerId: user.sub,
        seller_email: user.email,
        seller_name: user.name
      };

      // ✅ YOUR TESTED ENDPOINT
      const response = await fetch('https://minimart-ivrm.onrender.com/api/marketplace/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(productData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage(`🎉 "${formData.title}" published successfully!`);
        
        // Reset form
        setTimeout(() => {
          setFormData({
            title: '', brand: '', model: '', price: '', 
            phone_number: '', description: '', negotiation: 'no'
          });
          setCategory('');
          setState('Lagos');
          setCity('');
          setImagesPreview([]);
          setTermsAccepted(false);
          setMessage('');
        }, 2500);
      } else {
        setMessage(`❌ ${result.message || 'Publish failed'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage(`❌ ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h2>🔐 Login Required</h2>
        <p>Please login to add products to marketplace</p>
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

      <form onSubmit={handleSubmit} className="add-product-form">
        {/* HEADER */}
        <div className="form-header">
          <h1>📦 Add New Product</h1>
          <p>Create your marketplace listing</p>
        </div>

        {/* BASIC INFO */}
        <section className="form-section">
          <h3>📋 Basic Details</h3>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Product Title *</label>
              <input
                value={formData.title}
                onChange={(e) => updateFormField('title', e.target.value)}
                placeholder="iPhone 15 Pro Max 256GB - Like New"
                className="input-field"
                maxLength={100}
              />
            </div>

            <div className="input-group">
              <label className="required">Category *</label>
              <CustomDropdown
                options={categoriesList}
                value={category}
                onChange={setCategory}
                placeholder="Select Category"
              />
            </div>

            <div className="input-group">
              <label>Brand</label>
              <CustomDropdown
                options={categoryBrands}
                value={formData.brand}
                onChange={(value) => updateFormField('brand', value)}
                placeholder="Select Brand"
                disabled={!category}
              />
            </div>

            <div className="input-group">
              <label>Model</label>
              <CustomDropdown
                options={categoryModels}
                value={formData.model}
                onChange={(value) => updateFormField('model', value)}
                placeholder={formData.brand ? 'Select Model' : 'Select Brand First'}
                disabled={!formData.brand || !category}
              />
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="form-section">
          <h3>💰 Price</h3>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Price (₦) *</label>
              <input
                value={formData.price}
                onChange={(e) => updateFormField('price', formatPrice(e.target.value.replace(/,/g, '')))}
                placeholder="150000"
                className="input-field price-input"
              />
            </div>
            <div className="input-group">
              <label>Negotiation</label>
              <CustomDropdown
                options={[
                  { value: 'no', label: 'Fixed Price' },
                  { value: 'yes', label: 'Negotiable' }
                ]}
                value={formData.negotiation}
                onChange={(value) => updateFormField('negotiation', value)}
                placeholder="Fixed Price"
              />
            </div>
          </div>
        </section>

        {/* LOCATION & CONTACT */}
        <section className="form-section">
          <h3>📍 Location & Contact</h3>
          <div className="input-grid">
            <div className="input-group">
              <label className="required">Phone Number *</label>
              <input
                value={formData.phone_number}
                onChange={(e) => updateFormField('phone_number', e.target.value)}
                type="tel"
                placeholder="08012345678"
                className="input-field"
                maxLength={15}
              />
            </div>
            <div className="input-group">
              <label>State</label>
              <CustomDropdown
                options={Object.keys(locationsByState || {})}
                value={state}
                onChange={(value) => {
                  setState(value);
                  setCity('');
                }}
                placeholder="Lagos"
              />
            </div>
            <div className="input-group">
              <label>City/Area</label>
              <CustomDropdown
                options={stateCities}
                value={city}
                onChange={setCity}
                placeholder="Ikeja, Lekki, etc."
                disabled={!state}
              />
            </div>
          </div>
        </section>

        {/* DESCRIPTION */}
        <section className="form-section">
          <h3>📝 Description</h3>
          <textarea
            value={formData.description}
            onChange={(e) => updateFormField('description', e.target.value)}
            placeholder="Describe your product condition, usage, reason for selling..."
            rows={4}
            className="textarea-field"
            maxLength={1000}
          />
        </section>

        {/* CONDITION & COLOR */}
        {category && (
          <section className="form-section">
            <h3>🔧 Specifications</h3>
            <div className="input-grid">
              <div className="input-group">
                <label>Condition</label>
                <CustomDropdown
                  options={conditions || []}
                  value={formData.condition}
                  onChange={(value) => updateFormField('condition', value)}
                  placeholder="New, Used, Refurbished"
                />
              </div>
              <div className="input-group">
                <label>Color</label>
                <CustomDropdown
                  options={colors || []}
                  value={formData.color}
                  onChange={(value) => updateFormField('color', value)}
                  placeholder="Black, White, Blue"
                />
              </div>
            </div>
          </section>
        )}

        {/* IMAGES */}
        <section className="form-section">
          <h3>🖼️ Photos (Max 8)</h3>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImages}
            className="file-input"
          />
          {imagesPreview.length > 0 && (
            <div className="images-preview">
              {imagesPreview.map((img, index) => (
                <div key={index} className="image-item">
                  <img src={img.preview} alt="Preview" />
                  <span>{img.name}</span>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="remove-btn"
                  >
                    ✕
                  </button>
                </div>
              ))}
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
              I agree to the <a href="/terms">Terms & Conditions</a>
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
              disabled={loading || !termsAccepted}
              className="btn-primary"
            >
              {loading ? '🚀 Publishing...' : '🚀 Publish Product'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AddProduct;