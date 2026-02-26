
// src/pages/Marketplace/AddProduct.jsx - ✅ 7-SECTIONS ENTERPRISE LAYOUT
import React, { useState, useRef, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './AddProduct.css';

// ✅ ALL YOUR CONFIGS
import { categoryFields, subcategories } from '../../config/categoryFields';
import { brands } from '../../config/brands';
import { colors } from '../../config/colors';
import { conditions } from '../../config/conditions';
import { locationsByState } from '../../config/locationsByState';
import { models } from '../../config/models';

const AddProduct = () => {
  // SECTION STATES
  const [activeSection, setActiveSection] = useState(1);
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [state, setState] = useState('');
  const [imagesPreview, setImagesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const fieldRefs = useRef({});

  const { user, isAuthenticated } = useAuth0();

  // DYNAMIC OPTIONS
  const categoryBrands = category ? brands[category] || [] : [];
  const categorySubcats = category ? subcategories[category] || [] : [];
  const categoryModels = category ? models[category] || [] : [];
  const stateCities = state ? locationsByState[state] || [] : [];

  const handleImages = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length + imagesPreview.length > 8) {
      setMessage('Maximum 8 images');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('title', fieldRefs.current.title?.value?.trim() || '');
    formData.append('category', category);
    formData.append('subcategory', subcategory);
    formData.append('brand', fieldRefs.current.brand?.value || '');
    formData.append('model', fieldRefs.current.model?.value || '');
    formData.append('condition', fieldRefs.current.condition?.value || '');
    formData.append('quantity', fieldRefs.current.quantity?.value || '1');
    formData.append('price', fieldRefs.current.price?.value || '0');
    formData.append('discount_price', fieldRefs.current.discount_price?.value || '');
    formData.append('negotiation', fieldRefs.current.negotiation?.checked ? 'Yes' : 'No');
    formData.append('description', fieldRefs.current.description?.value || '');
    formData.append('features', fieldRefs.current.features?.value || '');
    formData.append('phone_number', fieldRefs.current.phone?.value || '');
    formData.append('state', state);
    formData.append('city', fieldRefs.current.city?.value || '');
    formData.append('poster_name', user?.name || 'Anonymous');
    
    imagesPreview.forEach(img => formData.append('images', img.file));

    try {
      setLoading(true);
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (response.ok) {
        setMessage(`🎉 Product published! ID: ${result.data?._id}`);
        // Reset form
        Object.keys(fieldRefs.current).forEach(key => fieldRefs.current[key].value = '');
        setCategory(''); setSubcategory(''); setState(''); setImagesPreview([]);
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

  const SectionNav = () => (
    <nav className="section-nav">
      {[
        'Product Details', 'Pricing', 'Description', 'Images', 
        'Shipping', 'Contact', 'Preview'
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
  );

  if (!isAuthenticated) {
    return <div className="login-required">🔐 Please login</div>;
  }

  return (
    <div className="enterprise-form">
      {message && (
        <div className={`message ${message.includes('🎉') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="form-wrapper">
        {/* 🧭 SECTION NAVIGATION */}
        <SectionNav />

        {/* 📋 MAIN FORM */}
        <form onSubmit={handleSubmit} className="enterprise-product-form">
          
          {/* SECTION 1: PRODUCT DETAILS */}
          {activeSection === 1 && (
            <section className="form-section">
              <h2>📦 Product Details</h2>
              <div className="input-grid-2">
                <div className="input-group">
                  <label>Product Name *</label>
                  <input ref={el => fieldRefs.current.title = el} required />
                </div>
                <div className="input-group">
                  <label>Category *</label>
                  <select 
                    ref={el => fieldRefs.current.category = el} 
                    onChange={e => setCategory(e.target.value)}
                    required
                  >
                    <option value="">Select Category</option>
                    {Object.keys(categoryFields).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Subcategory</label>
                  <select 
                    onChange={e => setSubcategory(e.target.value)}
                    value={subcategory}
                  >
                    <option value="">Select Subcategory</option>
                    {categorySubcats.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
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
                <div className="input-group">
                  <label>Model</label>
                  <input ref={el => fieldRefs.current.model = el} />
                </div>
                <div className="input-group">
                  <label>Condition</label>
                  <select ref={el => fieldRefs.current.condition = el}>
                    <option value="">Select Condition</option>
                    {conditions.map(cond => (
                      <option key={cond} value={cond}>{cond}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Quantity</label>
                  <input 
                    ref={el => fieldRefs.current.quantity = el} 
                    type="number" 
                    min="1"
                    defaultValue="1"
                  />
                </div>
              </div>
            </section>
          )}

          {/* SECTION 2: PRICING */}
          {activeSection === 2 && (
            <section className="form-section">
              <h2>💰 Pricing & Offers</h2>
              <div className="input-grid-2">
                <div className="input-group">
                  <label>Price (₦) *</label>
                  <input ref={el => fieldRefs.current.price = el} type="number" required />
                </div>
                <div className="input-group">
                  <label>Discount Price (Optional)</label>
                  <input ref={el => fieldRefs.current.discount_price = el} type="number" />
                </div>
                <label className="checkbox-group">
                  <input ref={el => fieldRefs.current.negotiation = el} type="checkbox" />
                  Allow Negotiation
                </label>
                <div className="input-group">
                  <label>Flash Sale End Date</label>
                  <input type="date" />
                </div>
              </div>
            </section>
          )}

          {/* SECTION 3: DESCRIPTION */}
          {activeSection === 3 && (
            <section className="form-section">
              <h2>📝 Description & Details</h2>
              <div className="input-grid-2">
                <div className="input-group full-width">
                  <label>Short Description</label>
                  <input ref={el => fieldRefs.current.short_desc = el} />
                </div>
                <div className="input-group full-width">
                  <label>Full Description</label>
                  <textarea 
                    ref={el => fieldRefs.current.description = el} 
                    rows="6"
                    placeholder="Tell buyers about your product..."
                  />
                </div>
                <div className="input-group full-width">
                  <label>Key Features (comma separated)</label>
                  <input 
                    ref={el => fieldRefs.current.features = el}
                    placeholder="5G, 128GB, Fast Charging"
                  />
                </div>
              </div>
            </section>
          )}

          {/* SECTION 4: IMAGES */}
          {activeSection === 4 && (
            <section className="form-section">
              <h2>🖼️ Product Images</h2>
              <div className="file-upload-zone">
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={handleImages}
                  className="file-input"
                />
                <p>Drag & drop or click to upload (Max 8 images, 10MB each)</p>
              </div>
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

          {/* SECTION 5: SHIPPING */}
          {activeSection === 5 && (
            <section className="form-section">
              <h2>🚚 Shipping & Delivery</h2>
              <div className="input-grid-2">
                <div className="input-group">
                  <label>Shipping Cost</label>
                  <input type="number" placeholder="Free / ₦2000" />
                </div>
                <div className="input-group">
                  <label>Delivery Areas</label>
                  <select multiple>
                    <option>Lagos</option>
                    <option>Abuja</option>
                    <option>Port Harcourt</option>
                  </select>
                </div>
                <label className="checkbox-group">
                  <input type="checkbox" /> Free Shipping
                </label>
              </div>
            </section>
          )}

          {/* SECTION 6: CONTACT */}
          {activeSection === 6 && (
            <section className="form-section">
              <h2>📞 Contact & Location</h2>
              <div className="input-grid-2">
                <div className="input-group">
                  <label>Phone/WhatsApp *</label>
                  <input ref={el => fieldRefs.current.phone = el} required />
                </div>
                <div className="input-group">
                  <label>Email (Optional)</label>
                  <input type="email" />
                </div>
                <div className="input-group">
                  <label>State *</label>
                  <select 
                    ref={el => fieldRefs.current.state = el}
                    onChange={e => setState(e.target.value)}
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

          {/* SECTION 7: PREVIEW & PUBLISH */}
          {activeSection === 7 && (
            <section className="form-section preview-section">
              <h2>👀 Preview & Publish</h2>
              <div className="preview-content">
                <div className="preview-card">
                  <h3>{fieldRefs.current.title?.value || 'Your Product'}</h3>
                  <div className="preview-price">
                    ₦{parseInt(fieldRefs.current.price?.value || 0).toLocaleString()}
                  </div>
                  <div className="preview-meta">
                    <span>{category} • {fieldRefs.current.brand?.value}</span>
                    <span>{fieldRefs.current.city?.value}, {state}</span>
                  </div>
                </div>
                
                <div className="publish-actions">
                  <label className="checkbox-group">
                    <input type="checkbox" required /> 
                    I agree to terms & conditions
                  </label>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="publish-btn"
                  >
                    {loading ? '🚀 Publishing...' : '🚀 Publish Product'}
                  </button>
                </div>
              </div>
            </section>
          )}

        </form>
      </div>
    </div>
  );
};

export default AddProduct;