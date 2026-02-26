// src/pages/Marketplace/AddProduct.jsx - ✅ FULL CONFIG INTEGRATION
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './AddProduct.css';

// ✅ ALL YOUR CONFIGS
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
  const [exchangePossible, setExchangePossible] = useState(false);
  
  const fieldRefs = useRef({});
  const fileInputRef = useRef(null);

  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  // ✅ COMPUTED FROM YOUR FULL CONFIGS
  const dynamicFields = category ? categoryFields[category] || [] : [];
  const categoryBrands = category ? brands[category] || [] : [];
  const categoryModels = category ? models[category] || [] : [];
  const categoryFeatures = category ? featuresByCategory[category] || [] : [];
  const stateCities = state ? locationsByState[state] || [] : [];

  // ✅ FULL FIELD OPTIONS MAPPING
  const getFieldOptions = (fieldName) => {
    return fieldOptions[fieldName] ||
           (fieldName === 'brand' ? categoryBrands : []) ||
           (fieldName === 'model' ? categoryModels : []) ||
           (fieldName === 'condition' ? conditions : []) ||
           (fieldName === 'used_detail' ? usedDetails : []) ||
           (fieldName === 'color' ? colors : []) ||
           (fieldName === 'ram' ? ramOptions : []) ||
           (fieldName === 'storage' ? storageOptions : []) ||
           (fieldName === 'sim' ? sims : []) ||
           (fieldName === 'engine' ? engines : []) ||
           (fieldName === 'fuel_type' ? fuelTypes : []) ||
           (fieldName === 'year' ? years : []) ||
           (fieldName === 'features' ? categoryFeatures : []);
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
      const shortName = file.name.length > 25 ? 
        `${file.name.substring(0, 22)}...${file.name.split('.').pop()}` : file.name;
      const preview = URL.createObjectURL(file);
      setImagesPreview(prev => [...prev, { 
        file, preview, name: shortName, originalName: file.name 
      }]);
    });
  }, [imagesPreview.length]);

  const removeImage = useCallback((index) => {
    const img = imagesPreview[index];
    URL.revokeObjectURL(img.preview);
    setImagesPreview(prev => prev.filter((_, i) => i !== index));
  }, [imagesPreview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ✅ PERFECT MATCH YOUR MONGODB SCHEMA
    const productData = {
      title: fieldRefs.current.title?.value || '',
      category,
      brand: fieldRefs.current.brand?.value || '',
      model: fieldRefs.current.model?.value || '',
      condition: fieldRefs.current.condition?.value || '',
      ram: fieldRefs.current.ram?.value || '',
      storage: fieldRefs.current.storage?.value || '',
      color: fieldRefs.current.color?.value || '',
      sim: fieldRefs.current.sim?.value || '',
      engine: fieldRefs.current.engine?.value || '',
      mileage: fieldRefs.current.mileage?.value || null,
      year: fieldRefs.current.year?.value || null,
      fuel_type: fieldRefs.current.fuel_type?.value || '',
      transmission: fieldRefs.current.transmission?.value || '',
      description: fieldRefs.current.description?.value || '',
      price: parseInt(fieldRefs.current.price?.value) || 0,
      negotiation: fieldRefs.current.negotiation?.checked ? "Yes" : "No",
      phone_number: fieldRefs.current.phone?.value || '',
      poster_name: user?.name || 'Anonymous',
      country: "Nigeria",
      state,
      city: fieldRefs.current.city?.value || '',
      location: fieldRefs.current.city?.value || '',
      exchange_possible: exchangePossible,
      features: fieldRefs.current.features?.value || '',
      images: imagesPreview.map(img => img.originalName),
      promoted: false,
      promo_plan: ""
    };

    console.log('🚀 SUBMITTING EXACT DB STRUCTURE:', productData);

    if (!productData.title.trim() || !productData.price || productData.price <= 0) {
      setMessage('❌ Title and valid price required');
      fieldRefs.current.title?.focus();
      return;
    }

    try {
      setLoading(true);
      setMessage('🚀 Publishing to database...');

      const token = await getAccessTokenSilently();
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData)
      });

      if (response.ok) {
        const result = await response.json();
        setMessage(`🎉 Product published successfully! ID: ${result._id}`);
        
        // RESET FORM
        Object.keys(fieldRefs.current).forEach(key => {
          if (fieldRefs.current[key]) fieldRefs.current[key].value = '';
        });
        fieldRefs.current.negotiation && (fieldRefs.current.negotiation.checked = false);
        setCategory(''); setState(''); setImagesPreview([]); setExchangePossible(false);
        fieldRefs.current.title?.focus();
        
        setTimeout(() => setMessage(''), 5000);
      } else {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error('❌ Publish error:', error);
      setMessage(`❌ Publish failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (fieldName) => {
    const options = getFieldOptions(fieldName);
    const isCheckbox = fieldName === 'negotiation';
    const isSelect = options.length > 1 && !isCheckbox;

    return (
      <div className="dynamic-field">
        <label className="field-label">
          {fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())}
        </label>
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
            type={fieldName === 'price' ? 'number' : fieldName.includes('mileage') ? 'number' : 'text'}
            placeholder={`Enter ${fieldName}`}
            className="field-input"
          />
        )}
      </div>
    );
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

      <div className="form-grid">
        {/* MAIN FORM */}
        <form onSubmit={handleSubmit} className="product-form">
          <header className="form-header">
            <h1 className="form-title">Add New Product</h1>
            <div className="user-info">
              <div className="seller-name">{user?.name?.split(' ')[0] || 'Seller'}</div>
              <div className="field-count">{dynamicFields.length} dynamic fields</div>
            </div>
          </header>

          {/* BASIC INFO */}
          <section className="form-section">
            <div className="input-grid">
              <div className="input-group">
                <label className="input-label required">Product Title *</label>
                <input 
                  ref={el => fieldRefs.current.title = el}
                  type="text" 
                  placeholder="Tecno Camon 19 32GB Green - Brand New"
                  className="input-large required"
                  required 
                />
              </div>
              <div className="input-group">
                <label className="input-label required">Price (₦) *</label>
                <input 
                  ref={el => fieldRefs.current.price = el}
                  type="number" 
                  placeholder="150000"
                  className="input-large required"
                  required 
                />
              </div>
            </div>
          </section>

          {/* LOCATION & CONTACT */}
          <section className="form-section">
            <div className="input-grid-dense">
              <div className="input-group">
                <label className="input-label required">Category *</label>
                <select 
                  ref={el => fieldRefs.current.category = el}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-dense required"
                  required
                >
                  <option value="">Select Category</option>
                  {Object.keys(categoryFields).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">State</label>
                <select 
                  ref={el => fieldRefs.current.state = el}
                  onChange={(e) => setState(e.target.value)}
                  className="input-dense"
                >
                  <option value="">Select State</option>
                  {Object.keys(locationsByState).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">City</label>
                <select ref={el => fieldRefs.current.city = el} className="input-dense">
                  <option value="">Select City</option>
                  {stateCities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Phone</label>
                <input 
                  ref={el => fieldRefs.current.phone = el}
                  type="tel" 
                  placeholder="08012345678"
                  className="input-dense"
                />
              </div>
            </div>
          </section>

          {/* DYNAMIC FIELDS */}
          {dynamicFields.length > 0 && (
            <section className="form-section dynamic-section">
              <h3 className="section-title">
                {category} Details ({dynamicFields.length} fields)
              </h3>
              <div className="dynamic-grid">
                {dynamicFields.map(renderField)}
              </div>
            </section>
          )}

          {/* DESCRIPTION & OPTIONS */}
          <section className="form-section">
            <div className="flex-grid">
              <div className="textarea-group">
                <label className="input-label">Description</label>
                <textarea 
                  ref={el => fieldRefs.current.description = el}
                  rows="5"
                  placeholder="Describe your product condition, features, usage..."
                  className="textarea-large"
                />
              </div>
              <div className="options-group">
                <label className="checkbox-label">
                  <input 
                    ref={el => fieldRefs.current.negotiation = el}
                    type="checkbox"
                    className="checkbox"
                  />
                  <span>Negotiation Allowed</span>
                </label>
                <label className="checkbox-label">
                  <input 
                    type="checkbox"
                    checked={exchangePossible}
                    onChange={(e) => setExchangePossible(e.target.checked)}
                    className="checkbox"
                  />
                  <span>Exchange Possible</span>
                </label>
              </div>
            </div>
          </section>

          {/* IMAGES */}
          <section className="form-section">
            <label className="input-label large">🖼️ Product Images (Max 8, 10MB each)</label>
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleImages}
              className="file-upload"
            />
          </section>

          {imagesPreview.length > 0 && (
            <section className="image-preview-section">
              <div className="images-grid">
                {imagesPreview.map((img, index) => (
                  <div key={img.name} className="image-preview">
                    <img src={img.preview} alt="Preview" />
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
            </section>
          )}

          <button
            type="submit"
            disabled={loading}
            className="submit-button"
          >
            {loading ? '📤 Publishing...' : `🚀 Publish ${category || 'Product'}`}
          </button>
        </form>

        {/* PREVIEW */}
        <aside className="preview-sidebar">
          <div className="preview-card">
            <h3 className="preview-title">📊 Live Preview</h3>
            <div className="preview-items">
              <div className="preview-item">
                <span>Title:</span>
                <strong>{fieldRefs.current.title?.value?.substring(0, 25) || 'Enter title'}...</strong>
              </div>
              <div className="preview-item">
                <span>Price:</span>
                <strong className="price-preview">
                  ₦{parseInt(fieldRefs.current.price?.value || 0).toLocaleString()}
                </strong>
              </div>
              <div className="preview-item">
                <span>Category:</span>
                <strong>{category || 'Select'}</strong>
              </div>
              <div className="preview-item">
                <span>Images:</span>
                <strong>{imagesPreview.length}/8</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AddProduct;