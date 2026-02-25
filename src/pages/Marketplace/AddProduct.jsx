// AddProduct.jsx - YOUR CATEGORIES + WORKING BACKEND
import React, { useState, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import './AddProduct.css';

// ✅ YOUR CATEGORY CONFIGS
import { categoryFields } from "../../config/categoryFields";
import { categoryRules } from "../../config/categoryRules";
import { conditions } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { promotionPlans } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";

export default function AddProduct() {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Full form state with your categories
  const [form, setForm] = useState({
    title: '', description: '', category: '', brand: '', model: '',
    condition: '', price: '', discount_price: '', phone_number: '',
    state: 'Lagos', city: '', status: 'draft',
    ram: '', storage: '', color: '', engine: '', fuel_type: '',
    features: {}
  });

  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateField = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
    setMessage('');
  };

  const addImages = (e) => {
    const newImages = Array.from(e.target.files).slice(0, 5);
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // ✅ YOUR CATEGORY DYNAMIC FIELDS
  const currentCategoryFields = categoryFields[form.category] || {};
  const currentRules = categoryRules[form.category] || {};
  const currentFeatures = featuresByCategory[form.category] || [];
  const currentLocations = locationsByState[form.state] || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ✅ YOUR CATEGORY VALIDATION
    if (currentRules.required && !currentRules.required.every(field => form[field])) {
      setMessage('❌ Required fields missing for this category');
      return;
    }

    if (!form.title || !form.price || !form.phone_number) {
      setMessage('❌ Title, price, and phone required');
      return;
    }

    setLoading(true);
    
    try {
      const token = await getAccessTokenSilently();
      
      const submitData = {
        ...form,
        price: parseInt(form.price),
        discount_price: form.discount_price ? parseInt(form.discount_price) : 0,
        sellerId: user.sub,
        images: images.map(img => img.name || 'test.jpg')
      };

      const response = await fetch('https://minimart-ivrm.onrender.com/api/marketplace/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage(`🎉 "${form.title}" published successfully!`);
        setTimeout(() => navigate('/my-products'), 2000);
      } else {
        setMessage('❌ ' + (result.message || 'Publish failed'));
      }
    } catch (error) {
      setMessage('❌ Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <div className="loading">Please log in</div>;
  }

  return (
    <div className="add-product-page">
      <div className="add-product-card">
        <h1>📦 Add New Product</h1>
        
        {message && (
          <div className={`message ${message.startsWith('🎉') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* BASIC INFO */}
          <div className="form-section">
            <h3>📋 Basic Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Title *</label>
                <input 
                  required 
                  value={form.title} 
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="iPhone 15 Pro Max 256GB"
                />
              </div>
              <div className="form-group">
                <label>Price (₦) *</label>
                <input 
                  required 
                  type="number" 
                  value={form.price} 
                  onChange={(e) => updateField('price', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category *</label>
                <select 
                  value={form.category} 
                  onChange={(e) => {
                    updateField('category', e.target.value);
                    // Reset category-specific fields
                    setForm(prev => ({
                      ...prev,
                      category: e.target.value,
                      brand: '', model: '', ram: '', storage: '', color: '',
                      engine: '', fuel_type: '', features: {}
                    }));
                  }}
                >
                  <option value="">Select Category</option>
                  {Object.keys(categoryFields).map(cat => (
                    <option key={cat} value={cat}>{catFields[cat]?.label || cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Condition</label>
                <select value={form.condition} onChange={(e) => updateField('condition', e.target.value)}>
                  <option value="">Select...</option>
                  {conditions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Brand</label>
                <select value={form.brand} onChange={(e) => updateField('brand', e.target.value)}>
                  <option value="">Select Brand</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Model</label>
                <select value={form.model} onChange={(e) => updateField('model', e.target.value)}>
                  <option value="">Select Model</option>
                  {models[form.brand]?.map(m => <option key={m} value={m}>{m}</option>) || []}
                </select>
              </div>
            </div>
          </div>

          {/* CATEGORY SPECIFIC FIELDS */}
          {form.category && (
            <div className="form-section">
              <h3>⚙️ {currentCategoryFields.label || form.category} Details</h3>
              <div className="form-row">
                {currentCategoryFields.fields?.map(field => (
                  <div key={field.name} className="form-group">
                    <label>{field.label}</label>
                    <select 
                      value={form[field.name]} 
                      onChange={(e) => updateField(field.name, e.target.value)}
                    >
                      <option value="">{field.placeholder || 'Select...'}</option>
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LOCATION */}
          <div className="form-section">
            <h3>📍 Location</h3>
            <div className="form-row">
              <div className="form-group">
                <label>State</label>
                <select 
                  value={form.state} 
                  onChange={(e) => {
                    updateField('state', e.target.value);
                    updateField('city', '');
                  }}
                >
                  {Object.keys(locationsByState).map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>City/Area</label>
                <select value={form.city} onChange={(e) => updateField('city', e.target.value)}>
                  <option value="">Select City</option>
                  {currentLocations.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PHONE & DESCRIPTION */}
          <div className="form-row">
            <div className="form-group">
              <label>Phone Number *</label>
              <input 
                required 
                type="tel" 
                value={form.phone_number} 
                onChange={(e) => updateField('phone_number', e.target.value)}
              />
            </div>
            <div className="form-group"></div>
          </div>

          <div className="form-group full">
            <label>Description</label>
            <textarea 
              rows="4"
              value={form.description} 
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe your product in detail..."
            />
          </div>

          {/* IMAGES */}
          <div className="form-section">
            <h3>📸 Photos (Max 5)</h3>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={addImages}
              style={{ marginBottom: '1rem' }}
            />
            {images.length > 0 && (
              <div className="image-preview-grid">
                {images.map((img, index) => (
                  <div key={index} className="image-preview">
                    <img src={URL.createObjectURL(img)} alt="Preview" />
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
          </div>

          {/* SUBMIT */}
          <div className="submit-buttons">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/my-products')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '🚀 Publishing...' : '🚀 Publish Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}