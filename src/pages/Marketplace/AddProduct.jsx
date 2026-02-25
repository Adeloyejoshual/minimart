// src/pages/Marketplace/AddProduct.jsx - ENTERPRISE GRADE ✅
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './AddProduct.css'; // Your enterprise glassmorphism styles

// ✅ ALL YOUR CONFIG IMPORTS
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

const AddProduct = () => {
  // Main form state
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    condition: '',
    location: '',
    state: '',
    description: '',
    stock: '',
    brand: '',
    model: '',
    features: [],
    promotion: null
  });

  // Dynamic UI state
  const [dynamicFields, setDynamicFields] = useState([]);
  const [imagePreview, setImagePreview] = useState('');
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeChecklist, setActiveChecklist] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const fileInputRef = useRef(null);

  // Products list
  const [products, setProducts] = useState([]);

  // Load products
  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/marketplace/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : data.products || []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Dynamic fields based on category
  useEffect(() => {
    if (formData.category && categoryFields[formData.category]) {
      setDynamicFields(categoryFields[formData.category]);
    } else {
      setDynamicFields([]);
    }
  }, [formData.category]);

  // Cloudinary direct upload
  const uploadToCloudinary = (imageFile) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('upload_preset', '0HoyRB6wC0eba-Cbat0nhiIRoa8');

      fetch('https://api.cloudinary.com/v1_1/di6zeyneq/image/upload', {
        method: 'POST',
        body: formData
      })
      .then(res => res.json())
      .then(data => resolve(data.secure_url))
      .catch(reject);
    });
  };

  const handleChange = async (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'images') {
      const newImages = Array.from(files);
      setImages(prev => [...prev, ...newImages]);
      if (files[0]) {
        setImagePreview(URL.createObjectURL(files[0]));
      }
      return;
    }

    if (name === 'state' && locationsByState[value]) {
      setFormData(prev => ({ ...prev, [name]: value, location: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.price || formData.price <= 0) newErrors.price = 'Valid price required';
    if (!formData.category) newErrors.category = 'Category required';
    
    // Category rules
    if (formData.category && categoryRules[formData.category]) {
      categoryRules[formData.category].forEach(rule => {
        if (!formData[rule.field]) {
          newErrors[rule.field] = rule.message;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setMessage('Please fix errors before submitting');
      return;
    }

    if (!termsAccepted) {
      setMessage('Please accept terms & conditions');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // Upload images first
      let imageUrls = [];
      for (const image of images) {
        const url = await uploadToCloudinary(image);
        imageUrls.push(url);
      }

      // Save to backend
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock) || 0,
          images: imageUrls,
          features: formData.features || []
        })
      });

      if (response.ok) {
        setMessage('🎉 Product published successfully!');
        setActiveChecklist([true, true, true]);
        fetchProducts();
        
        // Reset form
        setFormData({
          name: '', price: '', category: '', condition: '', location: '',
          state: '', description: '', stock: '', brand: '', model: '', features: []
        });
        setImages([]);
        setImagePreview('');
        setTermsAccepted(false);
      } else {
        setMessage('❌ Failed to publish: ' + await response.text());
      }
    } catch (error) {
      setMessage('❌ Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    if (index === 0) setImagePreview(images[1] ? URL.createObjectURL(images[1]) : '');
  };

  const toggleFeature = (feature) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  const getLocationOptions = () => {
    if (formData.state && locationsByState[formData.state]) {
      return locationsByState[formData.state];
    }
    return [];
  };

  const getBrandOptions = () => {
    return formData.category ? (brands[formData.category] || []) : [];
  };

  const getModelOptions = () => {
    return formData.category && formData.brand 
      ? (models[formData.category]?.[formData.brand] || []) 
      : [];
  };

  const checklistComplete = activeChecklist.filter(Boolean).length === 3;

  return (
    <div className="add-product-container">
      {/* Success/Error Message */}
      {message && (
        <div className={`error-banner ${message.includes('🎉') ? 'bg-green-100 border-green-300' : ''}`}>
          <span>{message}</span>
          <button className="close-btn" onClick={() => setMessage('')}>×</button>
        </div>
      )}

      <div className="add-product-header">
        <h1>Add New Product</h1>
        <p>Sell faster with dynamic category forms, Nigerian locations & promotion boosts</p>
      </div>

      <div className="add-product-main">
        {/* MAIN FORM */}
        <div className="form-sections">
          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <h2>Product Details</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={errors.name ? 'error' : ''}
                    placeholder="e.g. iPhone 15 Pro Max 256GB"
                  />
                  {errors.name && <span className="error-text">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label>Price (₦) *</label>
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleChange}
                    className={errors.price ? 'error' : ''}
                    placeholder="150000"
                  />
                  {errors.price && <span className="error-text">{errors.price}</span>}
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={errors.category ? 'error' : ''}
                  >
                    <option value="">Select category</option>
                    <option value="electronics">Electronics</option>
                    <option value="vehicles">Vehicles</option>
                    <option value="fashion">Fashion</option>
                    <option value="real-estate">Real Estate</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Condition</label>
                  <select name="condition" value={formData.condition} onChange={handleChange}>
                    <option value="">Select condition</option>
                    {conditions.map(cond => (
                      <option key={cond.value} value={cond.value}>{cond.label}</option>
                    ))}
                  </select>
                </div>

                {formData.category === 'electronics' && (
                  <>
                    <div className="form-group">
                      <label>RAM</label>
                      <select name="ram" onChange={handleChange}>
                        <option value="">Select RAM</option>
                        {ramOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Storage</label>
                      <select name="storage" onChange={handleChange}>
                        <option value="">Select storage</option>
                        {storageOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="form-section">
              <h2>Location</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>State</label>
                  <select 
                    name="state" 
                    value={formData.state} 
                    onChange={handleChange}
                  >
                    <option value="">Select state</option>
                    {Object.keys(locationsByState).map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <select 
                    name="location" 
                    value={formData.location}
                    onChange={handleChange}
                    disabled={!formData.state}
                  >
                    <option value="">Select location</option>
                    {getLocationOptions().map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {dynamicFields.length > 0 && (
              <div className="form-section">
                <h2>Category Specific</h2>
                <div className="form-grid">
                  {dynamicFields.map(field => (
                    <div key={field.name} className="form-group">
                      <label>{field.label}</label>
                      <select name={field.name} onChange={handleChange}>
                        <option value="">{field.placeholder || 'Select'}</option>
                        {field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-section full-width">
              <h2>Images</h2>
              <div 
                className="image-upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-placeholder">
                  <div className="upload-icon">📸</div>
                  <p>Click to upload product images</p>
                  <small>PNG, JPG up to 10MB</small>
                </div>
                {imagePreview && (
                  <div className="image-previews">
                    {images.map((img, index) => (
                      <div key={index} className="image-preview">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                        />
                        <button 
                          className="remove-image"
                          onClick={() => removeImage(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              <input
                ref={fileInputRef}
                name="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleChange}
                className="hidden"
              />
            </div>

            <div className="form-group full-width">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="5"
                placeholder="Tell buyers why they should buy this product..."
              />
            </div>

            <div className="terms-checkbox" onClick={() => setTermsAccepted(!termsAccepted)}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I agree to <button className="terms-link">Terms & Conditions</button> and 
                listing guidelines
              </span>
            </div>

            <div className="publish-buttons">
              <button 
                type="submit" 
                disabled={loading || !checklistComplete}
                className={`btn btn-primary ${loading ? 'loading' : ''}`}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Publishing...
                  </>
                ) : (
                  '🚀 Publish Product'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="publish-panel">
            <h3>Before Publishing</h3>
            <div className="checklist">
              <div className={`checklist-item ${activeChecklist[0] ? 'completed' : ''}`}>
                <div className={`check-icon ${activeChecklist[0] ? 'checkmark' : ''}`}>
                  {activeChecklist[0] ? '✓' : '○'}
                </div>
                <span>Complete all required fields</span>
              </div>
              <div className={`checklist-item ${activeChecklist[1] ? 'completed' : ''}`}>
                <div className={`check-icon ${activeChecklist[1] ? 'checkmark' : ''}`}>
                  {activeChecklist[1] ? '✓' : '○'}
                </div>
                <span>Upload quality images</span>
              </div>
              <div className={`checklist-item ${activeChecklist[2] ? 'completed' : ''}`}>
                <div className={`check-icon ${activeChecklist[2] ? 'checkmark' : ''}`}>
                  {activeChecklist[2] ? '✓' : '○'}
                </div>
                <span>Accept terms & conditions</span>
              </div>
            </div>

            <div className="promotion-section">
              <h4>Boost Sales Instantly</h4>
              <div className="promotion-plans-preview">
                {promotionPlans.slice(0, 3).map(plan => (
                  <div key={plan.id} className="promotion-card">
                    <plan.icon className="promotion-icon" />
                    <div>
                      <div className="promotion-name">{plan.name}</div>
                      <div className="promotion-price">
                        ₦{getActivePrice(plan.price, plan.discount).toLocaleString()}
                        <span className="duration">{plan.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {products.length > 0 && (
        <div className="products-preview" style={{ marginTop: '4rem' }}>
          <h2>Recently Added ({products.length})</h2>
          <div className="products-grid">
            {products.slice(0, 6).map(product => (
              <div key={product._id} className="product-card">
                <img src={product.image || product.images?.[0]} alt={product.name} />
                <h3>{product.name}</h3>
                <div className="price">₦{Number(product.price).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddProduct;