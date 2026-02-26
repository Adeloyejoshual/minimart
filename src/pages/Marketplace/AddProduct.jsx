// src/pages/Marketplace/AddProduct.jsx - ✅ ALL 13 CONFIGS + 7-SECTIONS
import React, { useState, useRef, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './AddProduct.css';

// ✅ ALL YOUR 13 CONFIGS - SAFE IMPORTS
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
  const [activeSection, setActiveSection] = useState(1);
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const fieldRefs = useRef({});
  const fileInputRef = useRef(null);
  const { user, isAuthenticated } = useAuth0();

  // ✅ DYNAMIC FIELDS FROM ALL CONFIGS
  const dynamicFields = category ? categoryFields[category] || [] : [];
  const categoryBrands = category ? brands[category] || [] : [];
  const categoryModels = category ? models[category] || [] : [];
  const stateCities = state ? locationsByState[state] || [] : [];

  const getFieldOptions = (field) => {
    const optionsMap = {
      condition: conditions,
      used_detail: usedDetails,
      color: colors,
      ram: ramOptions,
      storage: storageOptions,
      sim: sims,
      engine: engines,
      fuel_type: fuelTypes,
      transmission: fieldOptions.transmission || [],
      year: years
    };
    return optionsMap[field] || fieldOptions[field] || [];
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

  const renderDynamicField = (fieldName) => {
    const options = getFieldOptions(fieldName);
    const isSelect = options.length > 0;
    
    return (
      <div className="dynamic-field" key={fieldName}>
        <label>{fieldName.replace(/_/g, ' ').replace(/\bw/g, l => l.toUpperCase())}</label>
        {isSelect ? (
          <select ref={el => fieldRefs.current[fieldName] = el}>
            <option value="">{`Select ${fieldName}`}</option>
            {options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input 
            ref={el => fieldRefs.current[fieldName] = el}
            type={fieldName.includes('price|mileage') ? 'number' : 'text'}
            placeholder={`Enter ${fieldName}`}
          />
        )}
      </div>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    
    // ✅ ALL FIELDS FROM FORM + DYNAMIC FIELDS
    const staticFields = {
      title: fieldRefs.current.title?.value?.trim() || '',
      category,
      price: parseInt(fieldRefs.current.price?.value) || 0,
      phone_number: fieldRefs.current.phone?.value || '',
      poster_name: user?.name || 'Anonymous Seller',
      country: 'Nigeria',
      state,
      description: fieldRefs.current.description?.value || ''
    };

    // Add static fields
    Object.entries(staticFields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Add dynamic fields
    dynamicFields.forEach(field => {
      const value = fieldRefs.current[field]?.value;
      if (value) formData.append(field, value);
    });

    // Add images
    imagesPreview.forEach(img => formData.append('images', img.file));

    try {
      setLoading(true);
      setMessage('🚀 Publishing to Cloudinary & Database...');

      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage(`🎉 Product published! ID: ${result.data?._id || result._id}`);
        // Reset form
        Object.keys(fieldRefs.current).forEach(key => {
          const el = fieldRefs.current[key];
          if (el) el.value = '';
        });
        setCategory(''); setState(''); setImagesPreview([]);
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
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h2>🔐 Please Login</h2>
        <p>Sign in to publish products</p>
      </div>
    );
  }

  return (
    <div className="enterprise-form">
      {message && (
        <div className={`message ${message.includes('🎉') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="form-wrapper">
        {/* 🧭 7-SECTION NAVIGATION */}
        <nav className="section-nav">
          {[
            'Product Details', 'Pricing', 'Description', 
            'Dynamic Fields', 'Images', 'Location', 'Publish'
          ].map((title, index) => (
            <button
              key={index}
              className={`nav-btn ${activeSection === index + 1 ? 'active' : ''}`}
              onClick={() => setActiveSection(index + 1)}
            >
              {index + 1}. {title}
            </button>
          ))}
        </nav>

        {/* 📋 MAIN FORM */}
        <form onSubmit={handleSubmit} className="enterprise-product-form">
          
          {/* SECTION 1: PRODUCT DETAILS */}
          {activeSection === 1 && (
            <section className="form-section">
              <h2>📦 Product Details</h2>
              <div className="input-grid-2">
                <div className="input-group">
                  <label>Product Title *</label>
                  <input ref={el => fieldRefs.current.title = el} required placeholder="Tecno Camon 19" />
                </div>
                <div className="input-group">
                  <label>Category *</label>
                  <select onChange={(e) => setCategory(e.target.value)} required>
                    <option value="">Select Category</option>
                    {Object.keys(categoryFields).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Brand</label>
                  <select ref={el => fieldRefs.current.brand = el}>
                    <option value="">Select Brand</option>
                    {categoryBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 2: PRICING */}
          {activeSection === 2 && (
            <section className="form-section">
              <h2>💰 Pricing</h2>
              <div className="input-grid-2">
                <div className="input-group">
                  <label>Price (₦) *</label>
                  <input ref={el => fieldRefs.current.price = el} type="number" min="0" required />
                </div>
              </div>
            </section>
          )}

          {/* SECTION 3: DESCRIPTION */}
          {activeSection === 3 && (
            <section className="form-section">
              <h2>📝 Description</h2>
              <div className="input-group full-width">
                <label>Description</label>
                <textarea 
                  ref={el => fieldRefs.current.description = el} 
                  rows="6" 
                  placeholder="Describe your product..."
                />
              </div>
            </section>
          )}

          {/* SECTION 4: DYNAMIC FIELDS - ALL YOUR CONFIGS */}
          {activeSection === 4 && dynamicFields.length > 0 && (
            <section className="form-section">
              <h2>⚙️ {category} Specifications</h2>
              <div className="dynamic-grid">
                {dynamicFields.map(renderDynamicField)}
              </div>
            </section>
          )}

          {/* SECTION 5: IMAGES */}
          {activeSection === 5 && (
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
                      <img src={img.preview} alt="Preview" />
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
          )}

          {/* SECTION 6: LOCATION & CONTACT */}
          {activeSection === 6 && (
            <section className="form-section">
              <h2>📍 Location & Contact</h2>
              <div className="input-grid-2">
                <div className="input-group">
                  <label>Phone Number *</label>
                  <input ref={el => fieldRefs.current.phone = el} required placeholder="08012345678" />
                </div>
                <div className="input-group">
                  <label>State *</label>
                  <select onChange={(e) => setState(e.target.value)} required>
                    <option value="">Select State</option>
                    {Object.keys(locationsByState).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>City</label>
                  <select ref={el => fieldRefs.current.city = el}>
                    <option value="">Select City</option>
                    {stateCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 7: PUBLISH */}
          {activeSection === 7 && (
            <section className="form-section preview-section">
              <h2>🚀 Ready to Publish</h2>
              <div className="preview-card">
                <h3>{fieldRefs.current.title?.value || 'Your Product'}</h3>
                <div className="preview-price">
                  ₦{parseInt(fieldRefs.current.price?.value || 0).toLocaleString()}
                </div>
                <div className="preview-meta">
                  <span>{category} • {fieldRefs.current.brand?.value}</span>
                  <span>{fieldRefs.current.city?.value || 'Nationwide'}</span>
                </div>
                {imagesPreview.length > 0 && (
                  <div className="preview-images">
                    {imagesPreview.slice(0, 3).map((img, i) => (
                      <img key={i} src={img.preview} alt="Preview" />
                    ))}
                  </div>
                )}
              </div>
              <button 
                type="submit" 
                disabled={loading || !fieldRefs.current.title?.value}
                className="publish-btn"
              >
                {loading ? '📤 Publishing...' : `🚀 Publish ${category || 'Product'}`}
              </button>
            </section>
          )}
        </form>
      </div>
    </div>
  );
};

export default AddProduct;