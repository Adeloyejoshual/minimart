import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
import './AddProduct.css';
import { categoryFields } from "../../config/categoryFields";
import { categoryRules } from "../../config/categoryRules";
import { conditions, usedDetails } from "../../config/conditions";
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

const initializeForm = (user) => ({  
  title: "", description: "", price: "", discount_price: "", category: "", brand: "", model: "",  
  condition: "", used_detail: "", ram: "", storage: "", color: "", sim: [], features: [], engine: "", mileage: "",  
  year: "", fuel_type: "", transmission: "", phone_number: user?.phone_number || "", additional_phone: "",  
  poster_name: user?.name || "", state: "", city: "", social_link: "", images: [], video_link: "", promoted: false,  
  promo_plan: "", flash_sale: false, exchange_possible: false, negotiable: false, deliveryRegions: []  
});

function getFieldOptions(field, computed) {  
  const optionsMap = {  
    brand: computed.availableBrands,   
    model: computed.availableModels,   
    condition: conditions,   
    ram: ramOptions,   
    storage: storageOptions,   
    color: colors,   
    sim: ["Single SIM", "Dual SIM", "eSIM", "eSIM + Physical"],
    engine: engines,   
    fuel_type: fuelTypes,   
    year: Array.from({length: 30}, (_, i) => (new Date().getFullYear() - i).toString()),
    transmission: ["Manual", "Automatic", "CVT", "AMT"],
    promo_plan: promotionPlans.map(p => p.name)
  };  
  return optionsMap[field] || [];  
}

const DROPDOWN_FIELDS = {
  condition: "Condition",
  ram: "RAM", 
  storage: "Storage",
  color: "Color",
  engine: "Engine",
  fuel_type: "Fuel Type",
  year: "Year",
  transmission: "Transmission"
};

const CHECKBOX_FIELDS = {
  sim: "SIM Type",
  features: "Features"
};

export default function AddMarketplaceProduct() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState(() => initializeForm(user));
  const [images, setImages] = useState({ files: [], previews: [] });
  const [cities, setCities] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);

  const computedFields = {
    availableBrands: form.category ? brands[form.category] || [] : [],
    availableModels: form.brand && form.category ? models[form.category]?.[form.brand] || [] : [],
    categoryFeatures: form.category ? featuresByCategory[form.category] || [] : [],
    showCategoryFields: form.category ? categoryFields[form.category] || [] : []
  };

  // Effects
  useEffect(() => {
    if (form.state && locationsByState[form.state]) {
      setCities(locationsByState[form.state]);
    } else {
      setCities([]);
    }
  }, [form.state]);

  const updateFormField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Price formatting
  const formatPrice = (value) => new Intl.NumberFormat('en-NG').format(value);
  const parsePrice = (value) => value.replace(/,/g, '');
  const handlePriceChange = (e, field) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    updateFormField(field, formatPrice(value));
  };

  // Image handling
  const handleImageUpload = (e) => {
    const newFiles = Array.from(e.target.files).slice(0, 10 - images.files.length);
    if (newFiles.length === 0) return;
    
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setImages(prev => ({
      files: [...prev.files, ...newFiles],
      previews: [...prev.previews, ...newPreviews]
    }));
    updateFormField('images', [...form.images, ...newFiles.map(f => f.name)]);
    addToast(`${newFiles.length} image(s) uploaded!`);
  };

  const removeImage = (index) => {
    setImages({
      files: images.files.filter((_, i) => i !== index),
      previews: images.previews.filter((_, i) => i !== index)
    });
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Dynamic field toggles
  const toggleArrayField = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const handleSubmit = async (status = 'draft') => {
    if (!termsAccepted) {
      addToast('Please accept Terms & Conditions first', 'error');
      return;
    }

    if (!form.title.trim()) {
      addToast('Product title is required', 'error');
      return;
    }
    if (!form.phone_number.trim()) {
      addToast('Phone number is required', 'error');
      return;
    }
    if (images.files.length === 0) {
      addToast('At least 1 image is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      const submitData = {
        ...form,
        sellerId: user.sub,
        sellerEmail: user.email,
        sellerName: user.name,
        price: parsePrice(form.price),
        discount_price: parsePrice(form.discount_price || '0'),
        images: images.files.map(f => f.name),
        status,
        createdAt: new Date().toISOString()
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        addToast(`Product "${form.title}" ${status === 'published' ? 'published!' : 'saved as draft!'}`);
        setTimeout(() => navigate('/my-products'), 2000);
      } else {
        throw new Error('Failed to save product');
      }
    } catch (error) {
      addToast(`Error: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !isAuthenticated) return <LoadingSpinner />;

  return (
    <div className="add-product-container">
      {/* Header with Back Arrow */}
      <div className="add-product-header">
        <button className="back-arrow" onClick={() => navigate(-1)}>
          ←
        </button>
        <h1>Basic Information</h1>
        <p>Complete all sections to list your product</p>
      </div>

      <div className="add-product-main">
        <div className="form-sections">
          {/* Basic Info */}
          <section className="form-section">
            <h2>Basic Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Product Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateFormField('title', e.target.value)}
                  placeholder="iPhone 15 Pro Max 256GB"
                  maxLength={100}
                />
              </div>
              
              <div className="form-group">
                <label>Category *</label>
                <CustomDropdown
                  options={Object.keys(categoryFields)}
                  value={form.category}
                  onChange={(value) => updateFormField('category', value)}
                  placeholder="Select Category"
                />
              </div>

              {form.category && computedFields.availableBrands.length > 0 && (
                <div className="form-group">
                  <label>Brand</label>
                  <CustomDropdown
                    options={computedFields.availableBrands}
                    value={form.brand}
                    onChange={(value) => updateFormField('brand', value)}
                    placeholder="Select Brand"
                  />
                </div>
              )}

              {form.brand && computedFields.availableModels.length > 0 && (
                <div className="form-group">
                  <label>Model</label>
                  <CustomDropdown
                    options={computedFields.availableModels}
                    value={form.model}
                    onChange={(value) => updateFormField('model', value)}
                    placeholder="Select Model"
                  />
                </div>
              )}

              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Describe your product..."
                />
              </div>
            </div>
          </section>

          {/* ✅ DYNAMIC FIELD MAPPING */}
          {form.category && computedFields.showCategoryFields.length > 0 && (
            <section className="form-section">
              <h2>Specifications</h2>
              <div className="form-grid">
                {/* Dynamic Dropdown Fields */}
                {computedFields.showCategoryFields.map(field => {
                  if (DROPDOWN_FIELDS[field]) {
                    return (
                      <div key={field} className="form-group">
                        <label>{DROPDOWN_FIELDS[field]}</label>
                        <CustomDropdown
                          options={getFieldOptions(field, computedFields)}
                          value={form[field]}
                          onChange={(value) => updateFormField(field, value)}
                          placeholder={`Select ${DROPDOWN_FIELDS[field]}`}
                        />
                      </div>
                    );
                  }
                  return null;
                })}

                {/* Dynamic Checkbox Fields */}
                {computedFields.showCategoryFields.map(field => {
                  if (CHECKBOX_FIELDS[field]) {
                    const options = field === 'sim' 
                      ? ["Single SIM", "Dual SIM", "eSIM", "eSIM + Physical"]
                      : computedFields.categoryFeatures.slice(0, 12);
                    return (
                      <div key={field} className="form-group full-width">
                        <label>{CHECKBOX_FIELDS[field]}</label>
                        <div className="checkbox-grid">
                          {options.map(option => (
                            <label key={option} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={form[field]?.includes(option)}
                                onChange={() => toggleArrayField(field, option)}
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}

                {/* Mileage - Special number input */}
                {computedFields.showCategoryFields.includes('mileage') && (
                  <div className="form-group">
                    <label>Mileage (km)</label>
                    <input
                      type="number"
                      value={form.mileage}
                      onChange={(e) => updateFormField('mileage', e.target.value)}
                      placeholder="50000"
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Pricing & Promotion */}
          <section className="form-section">
            <h2>Pricing & Promotion</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Price (₦) *</label>
                <input
                  type="text"
                  value={form.price}
                  onChange={(e) => handlePriceChange(e, 'price')}
                  placeholder="50,000"
                />
              </div>
              <div className="form-group">
                <label>Discount Price (₦)</label>
                <input
                  type="text"
                  value={form.discount_price}
                  onChange={(e) => handlePriceChange(e, 'discount_price')}
                  placeholder="45,000"
                />
              </div>
              <div className="form-group checkbox-row">
                <label className="checkbox-label full-width">
                  <input type="checkbox" checked={form.negotiable} onChange={(e) => updateFormField('negotiable', e.target.checked)} />
                  Price Negotiable
                </label>
                <label className="checkbox-label full-width">
                  <input type="checkbox" checked={form.flash_sale} onChange={(e) => updateFormField('flash_sale', e.target.checked)} />
                  Flash Sale
                </label>
              </div>
              <div className="form-group">
                <label className="checkbox-label full-width">
                  <input
                    type="checkbox"
                    checked={form.promoted}
                    onChange={(e) => {
                      updateFormField('promoted', e.target.checked);
                      if (!e.target.checked) updateFormField('promo_plan', '');
                    }}
                  />
                  <span>Promote this listing</span>
                </label>
                {form.promoted && (
                  <CustomDropdown
                    options={promotionPlans.map(p => p.name)}
                    value={form.promo_plan}
                    onChange={(value) => updateFormField('promo_plan', value)}
                    placeholder="Select Plan"
                  />
                )}
              </div>
            </div>
          </section>

          {/* Professional Image Uploader */}
          <section className="form-section">
            <h2>Product Images *</h2>
            <div className="professional-image-uploader">
              <div 
                className="image-upload-zone" 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleImageUpload({ target: { files: e.dataTransfer.files } });
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="upload-content">
                  <div className="upload-icon">📸</div>
                  <h3>Drop images here or click to browse</h3>
                  <p>Max 10 images • JPG, PNG up to 10MB each</p>
                  <div className="upload-stats">
                    <span>{images.previews.length}/10 images</span>
                  </div>
                </div>
              </div>
              
              {images.previews.length > 0 && (
                <div className="image-gallery">
                  {images.previews.map((preview, index) => (
                    <div key={index} className="image-item">
                      <img src={preview} alt={`Preview ${index}`} />
                      <div className="image-overlay">
                        <button 
                          className="image-action remove-btn"
                          onClick={() => removeImage(index)}
                          title="Remove"
                        >
                          ×
                        </button>
                        <button className="image-action reorder-btn" title="Reorder">
                          ↕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Contact */}
          <section className="form-section">
            <h2>Contact Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  value={form.phone_number}
                  onChange={(e) => updateFormField('phone_number', e.target.value)}
                  placeholder="08012345678"
                />
              </div>
              <div className="form-group">
                <label>State *</label>
                <CustomDropdown
                  options={Object.keys(locationsByState)}
                  value={form.state}
                  onChange={(value) => updateFormField('state', value)}
                  placeholder="Select State"
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <CustomDropdown
                  options={cities}
                  value={form.city}
                  onChange={(value) => updateFormField('city', value)}
                  placeholder="Select City"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="publish-panel">
            <h3>Ready to Publish?</h3>
            <div className="checklist">
              <div className={`checklist-item ${form.title.trim() ? 'completed' : ''}`}>
                <span className={`check-icon ${form.title.trim() ? 'checkmark' : ''}`}>✓</span>
                Title ({form.title.length}/100)
              </div>
              <div className={`checklist-item ${form.phone_number.trim() ? 'completed' : ''}`}>
                <span className={`check-icon ${form.phone_number.trim() ? 'checkmark' : ''}`}>✓</span>
                Phone Number
              </div>
              <div className={`checklist-item ${images.previews.length > 0 ? 'completed' : ''}`}>
                <span className={`check-icon ${images.previews.length > 0 ? 'checkmark' : ''}`}>✓</span>
                Images ({images.previews.length}/10)
              </div>
              <div className={`checklist-item ${termsAccepted ? 'completed' : ''}`}>
                <span className={`check-icon ${termsAccepted ? 'checkmark' : ''}`}>✓</span>
                Terms Accepted
              </div>
            </div>

            <div className="publish-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => handleSubmit('draft')}
                disabled={isSubmitting}
              >
                💾 Save Draft
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSubmit('published')}
                disabled={isSubmitting || !form.title.trim() || !form.phone_number.trim() || images.files.length === 0 || !termsAccepted}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    Publishing...
                  </>
                ) : (
                  '🚀 Publish Product'
                )}
              </button>
            </div>

            <div className="terms-section">
              <label className="terms-checkbox">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span>
                  I agree to <button 
                    className="terms-link" 
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('/terms-policy');
                    }}
                  >
                    Terms & Conditions
                  </button>
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Custom Dropdown Component
const CustomDropdown = ({ options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="custom-dropdown" onClick={() => setOpen(!open)}>
      <div className="dropdown-display">
        <span>{value || placeholder}</span>
        <svg className={`dropdown-arrow ${open ? 'rotated' : ''}`} viewBox="0 0 24 24">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>
      {open && (
        <div className="dropdown-options">
          {options.map(option => (
            <div
              key={option}
              className={`dropdown-option ${value === option ? 'selected' : ''}`}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};