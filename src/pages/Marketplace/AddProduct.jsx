// src/pages/AddMarketplaceProduct.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import CustomDropdown from './CustomDropdown';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
import {
  API_BASE_URL,
  MAX_IMAGES,
  MIN_DESCRIPTION_LENGTH
} from '../config/constants';
import { categoryFields } from "../config/categoryFields";
import { categoryRules } from "../config/categoryRules";
import { conditions } from "../config/conditions";
import { ramOptions } from "../config/ram";
import { storageOptions } from "../config/storage";
import { colors } from "../config/color";
import { engines } from "../config/engine";
import { fuelTypes } from "../config/fuelTypes";
import { featuresByCategory } from "../config/features";
import { promotionPlans } from "../config/promotion";
import { locationsByState } from "../config/locationsByState";
import { brands } from "../config/brands";
import { models } from "../config/models";
import './AddProduct.css';

const FIELD_CONFIG = {
  dropdown: {
    condition: "Condition",
    ram: "RAM", 
    storage: "Storage",
    color: "Color",
    engine: "Engine",
    fuel_type: "Fuel Type",
    year: "Year",
    transmission: "Transmission"
  },
  checkbox: {
    sim: "SIM Type",
    features: "Features"
  }
};

const AddMarketplaceProduct = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);
  
  // Form state
  const [form, setForm] = useState({
    title: "", description: "", price: "", discount_price: "", category: "", 
    brand: "", model: "", condition: "", ram: "", storage: "", color: "", 
    sim: [], features: [], engine: "", mileage: "", year: "", fuel_type: "", 
    transmission: "", phone_number: user?.phone_number || "", state: "", city: "",
    promoted: false, promo_plan: "", flash_sale: false, negotiable: false
  });
  
  const [images, setImages] = useState({ files: [], previews: [] });
  const [cities, setCities] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Computed fields
  const computedFields = {
    availableBrands: form.category ? brands[form.category] || [] : [],
    availableModels: form.brand && form.category ? models[form.category]?.[form.brand] || [] : [],
    categoryFeatures: form.category ? featuresByCategory[form.category] || [] : [],
    showCategoryFields: form.category ? categoryFields[form.category] || [] : [],
    categoryRules: form.category ? categoryRules[form.category] || {} : {}
  };

  // Effects
  useEffect(() => {
    if (form.state && locationsByState[form.state]) {
      setCities(locationsByState[form.state]);
      if (form.city && !locationsByState[form.state].includes(form.city)) {
        updateFormField('city', '');
      }
    } else {
      setCities([]);
      updateFormField('city', '');
    }
  }, [form.state]);

  useEffect(() => {
    const timers = toasts.map(toast => 
      setTimeout(() => removeToast(toast.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  // Validation
  const canPublish = form.title.trim() && form.phone_number.trim() && 
                   images.files.length > 0 && termsAccepted && !isSubmitting;

  // Event handlers
  const updateFormField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Price formatting
  const formatPrice = useCallback((value) => 
    new Intl.NumberFormat('en-NG').format(value), []);
  
  const handlePriceChange = useCallback((e, field) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    updateFormField(field, formatPrice(value));
  }, [updateFormField]);

  // Image handling with compression
  const compressImage = useCallback((file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const MAX_WIDTH = 1200;
        let { width, height } = img;
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      };
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const validateImage = useCallback((file) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      addToast('Only JPG, PNG, WebP allowed', 'error');
      return false;
    }
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      addToast('Image must be under 10MB', 'error');
      return false;
    }
    return true;
  }, [addToast]);

  const handleImageUpload = useCallback(async (e) => {
    const inputFiles = e.target?.files || e.dataTransfer.files;
    const newFiles = Array.from(inputFiles)
      .filter(validateImage)
      .slice(0, MAX_IMAGES - images.files.length);
    
    if (newFiles.length === 0) return;

    const compressedFiles = await Promise.all(
      newFiles.map(compressImage)
    ).then(blobs => blobs.map(blob => new File([blob], 'compressed.jpg', { type: 'image/jpeg' })));

    const newPreviews = compressedFiles.map(file => URL.createObjectURL(file));
    setImages(prev => ({
      files: [...prev.files, ...compressedFiles],
      previews: [...prev.previews, ...newPreviews]
    }));
    addToast(`+${compressedFiles.length} images!`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [images.files.length, addToast, validateImage, MAX_IMAGES]);

  // Drag & Drop images
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    
    setImages(prev => {
      const newFiles = [...prev.files];
      const newPreviews = [...prev.previews];
      const draggedFile = newFiles[draggedIndex];
      const draggedPreview = newPreviews[draggedIndex];
      
      newFiles.splice(draggedIndex, 1);
      newPreviews.splice(draggedIndex, 1);
      newFiles.splice(dropIndex, 0, draggedFile);
      newPreviews.splice(dropIndex, 0, draggedPreview);
      
      return { files: newFiles, previews: newPreviews };
    });
    setDraggedIndex(null);
  }, [draggedIndex]);

  const removeImage = useCallback((index) => {
    URL.revokeObjectURL(images.previews[index]);
    setImages(prev => ({
      files: prev.files.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index)
    }));
    addToast('Image removed');
  }, [images.previews]);

  const toggleArrayField = useCallback((field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field]?.includes(value)
        ? prev[field].filter(item => item !== value)
        : [...(prev[field] || []), value]
    }));
  }, []);

  const getFieldOptions = useCallback((field) => {
    const optionsMap = {
      category: Object.keys(categoryFields),
      brand: computedFields.availableBrands,
      model: computedFields.availableModels,
      condition: conditions,
      ram: ramOptions,
      storage: storageOptions,
      color: colors,
      engine: engines,
      fuel_type: fuelTypes,
      year: Array.from({length: 30}, (_, i) => (new Date().getFullYear() - i).toString()),
      transmission: ["Manual", "Automatic", "CVT", "AMT"],
      promo_plan: promotionPlans.map(p => p.name),
      state: Object.keys(locationsByState)
    };
    return optionsMap[field] || [];
  }, [computedFields]);

  // Submit
  const handleSubmit = async (status = 'draft') => {
    if (!canPublish && status === 'published') {
      addToast('Complete all required fields', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getAccessTokenSilently();
      const formData = new FormData();
      
      images.files.forEach((file, index) => {
        formData.append(`images[${index}]`, file);
      });
      
      Object.entries(form).forEach(([key, value]) => {
        if (key !== 'images') {
          formData.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
        }
      });
      
      formData.append('sellerId', user.sub);
      formData.append('sellerEmail', user.email);
      formData.append('sellerName', user.name);
      formData.append('status', status);

      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const result = await response.json().catch(() => ({}));
      
      if (response.ok) {
        addToast(`"${form.title}" ${status === 'published' ? 'published!' : 'saved!'}`);
        setTimeout(() => navigate('/my-products'), 2000);
      } else {
        throw new Error(result.message || 'Failed to save');
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
      {/* Header */}
      <div className="add-product-header">
        <button className="back-arrow" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div>
          <h1>Add Product</h1>
          <p>Complete all sections to list your product</p>
        </div>
      </div>

      <div className="add-product-main">
        <div className="form-sections">
          {/* Basic Information */}
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
                  fieldId="category"
                  options={getFieldOptions('category')}
                  value={form.category}
                  onChange={updateFormField}
                  placeholder="Select Category"
                />
              </div>

              {form.category && computedFields.availableBrands.length > 0 && (
                <div className="form-group">
                  <label>Brand</label>
                  <CustomDropdown
                    fieldId="brand"
                    options={getFieldOptions('brand')}
                    value={form.brand}
                    onChange={updateFormField}
                    placeholder="Select Brand"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Model</label>
                <CustomDropdown
                  fieldId="model"
                  options={getFieldOptions('model')}
                  value={form.model}
                  onChange={updateFormField}
                  placeholder="Select Model"
                />
              </div>

              <div className="form-group full-width">
                <label>Description {form.description.length < MIN_DESCRIPTION_LENGTH ? ` (min ${MIN_DESCRIPTION_LENGTH})` : ''}</label>
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Describe your product..."
                  maxLength={2000}
                />
                <small>{form.description.length}/{MIN_DESCRIPTION_LENGTH} chars</small>
              </div>
            </div>
          </section>

          {/* Dynamic Specifications */}
          {form.category && computedFields.showCategoryFields.length > 0 && (
            <section className="form-section">
              <h2>Specifications</h2>
              <div className="form-grid">
                {computedFields.showCategoryFields.map(field => {
                  if (FIELD_CONFIG.dropdown[field]) {
                    return (
                      <div key={field} className="form-group">
                        <label>{FIELD_CONFIG.dropdown[field]}</label>
                        <CustomDropdown
                          fieldId={field}
                          options={getFieldOptions(field)}
                          value={form[field]}
                          onChange={updateFormField}
                          placeholder={`Select ${FIELD_CONFIG.dropdown[field]}`}
                        />
                      </div>
                    );
                  }
                  
                  if (FIELD_CONFIG.checkbox[field]) {
                    const options = field === 'sim' 
                      ? ["Single SIM", "Dual SIM", "eSIM", "eSIM + Physical"]
                      : computedFields.categoryFeatures.slice(0, 12);
                    return (
                      <div key={field} className="form-group full-width">
                        <label>{FIELD_CONFIG.checkbox[field]}</label>
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
              </div>
            </section>
          )}

          {/* Pricing */}
          <section className="form-section">
            <h2>Pricing</h2>
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
                <label>Discount Price</label>
                <input
                  type="text"
                  value={form.discount_price}
                  onChange={(e) => handlePriceChange(e, 'discount_price')}
                  placeholder="45,000"
                />
              </div>
              <div className="form-group checkbox-row">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={form.negotiable} 
                    onChange={(e) => updateFormField('negotiable', e.target.checked)} 
                  />
                  Price Negotiable
                </label>
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={form.flash_sale} 
                    onChange={(e) => updateFormField('flash_sale', e.target.checked)} 
                  />
                  Flash Sale
                </label>
              </div>
            </div>
          </section>

          {/* Images */}
          <section className="form-section">
            <h2>Images * ({images.previews.length}/{MAX_IMAGES})</h2>
            <div className="professional-image-uploader">
              <div 
                className="image-upload-zone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageUpload}
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
                  <div className="upload-icon">⬆</div>
                  <h3>Click + or drag images</h3>
                  <p>Max {MAX_IMAGES} • JPG/PNG • Auto-compressed</p>
                </div>
              </div>

              {images.previews.length > 0 && (
                <div className="image-gallery">
                  {images.previews.map((preview, index) => (
                    <div
                      key={index}
                      className={`image-item ${draggedIndex === index ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                    >
                      <img src={preview} alt={`Preview ${index}`} />
                      <div className="image-overlay">
                        <button 
                          className="image-action remove-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(index);
                          }}
                        >
                          ×
                        </button>
                        <button className="image-action reorder-btn">↕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Contact */}
          <section className="form-section">
            <h2>Contact</h2>
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
                  fieldId="state"
                  options={getFieldOptions('state')}
                  value={form.state}
                  onChange={updateFormField}
                  placeholder="Select State"
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <CustomDropdown
                  fieldId="city"
                  options={cities}
                  value={form.city}
                  onChange={updateFormField}
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
                Images ({images.previews.length}/{MAX_IMAGES})
              </div>
              <div className={`checklist-item ${termsAccepted ? 'completed' : ''}`}>
                <span className={`check-icon ${termsAccepted ? 'checkmark' : ''}`}>✓</span>
                Terms
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
                className={`btn btn-primary ${!canPublish ? 'disabled' : ''}`} 
                onClick={() => handleSubmit('published')}
                disabled={!canPublish}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    Publishing...
                  </>
                ) : (
                  '🚀 Publish'
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
                      window.open('/terms-policy', '_blank');
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

      {/* Toasts */}
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
};

export default AddProduct;