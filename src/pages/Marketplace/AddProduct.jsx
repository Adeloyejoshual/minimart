import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import PaystackPop from '@paystack/inline-js';
import './AddProduct.css';
import { categoryFields } from "../../config/categoryFields";
import { categoryRules } from "../../config/categoryRules"; // ✅ Using rules for validation
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


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

const initializeForm = (user) => ({  
  title: "", description: "", price: "", discount_price: "", category: "", brand: "", model: "",  
  condition: "", used_detail: "", ram: "", storage: "", color: "", sim: [], features: [], engine: "", mileage: "",  
  year: "", fuel_type: "", transmission: "", phone_number: user?.phone_number || "", additional_phone: "",  
  poster_name: user?.name || "", state: "", city: "", social_link: "", images: [], video_link: "", promoted: false,  
  promo_plan: "", flash_sale: false, exchange_possible: false, negotiable: false, deliveryRegions: [],
  errors: {}
});

export default function AddMarketplaceProduct() {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState(() => initializeForm(user));
  const [images, setImages] = useState({ files: [], previews: [], urls: [] });
  const [cities, setCities] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Memoized computed fields
  const computedFields = useMemo(() => ({
    availableBrands: form.category ? brands[form.category] || [] : [],
    availableModels: form.brand && form.category ? models[form.category]?.[form.brand] || [] : [],
    categoryFeatures: form.category ? featuresByCategory[form.category] || [] : [],
    showCategoryFields: form.category ? categoryFields[form.category] || [] : []
  }), [form.category, form.brand]);

  // Years options
  const years = useMemo(() => 
    Array.from({length: 30}, (_, i) => (new Date().getFullYear() - i).toString()),
    []
  );

  // Update cities when state changes
  useEffect(() => {
    if (form.state && locationsByState[form.state]) {
      setCities(locationsByState[form.state]);
    } else {
      setCities([]);
    }
  }, [form.state]);

  // Cleanup image URLs
  useEffect(() => {
    return () => {
      images.previews.forEach(preview => {
        if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
      });
    };
  }, []);

  const updateFormField = useCallback((field, value) => {
    setForm(prev => ({ 
      ...prev, 
      [field]: value,
      errors: { ...prev.errors, [field]: '' }
    }));
  }, []);

  const validateForm = useCallback(() => {
    const errors = {};
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.phone_number.trim()) errors.phone = 'Phone number is required';
    if (images.files.length === 0) errors.images = 'At least 1 image is required';
    if (!form.category) errors.category = 'Category is required';
    if (!termsAccepted) errors.terms = 'Terms must be accepted';
    return errors;
  }, [form.title, form.phone_number, form.category, images.files.length, termsAccepted]);

  // Format price with commas (Nigerian locale)
  const formatPrice = useCallback((value) => {
    const num = value.replace(/[^0-9]/g, '');
    return new Intl.NumberFormat('en-NG').format(num);
  }, []);

  const handlePriceChange = (e, field) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    updateFormField(field, new Intl.NumberFormat('en-NG').format(value));
  };

  // Cloudinary image upload
  const uploadImagesToCloudinary = useCallback(async (files) => {
    setUploadingImages(true);
    try {
      const uploadPromises = files.map(file =>
        new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
          
          fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
          })
          .then(res => res.json())
          .then(resolve)
          .catch(reject);
        })
      );
      
      const results = await Promise.all(uploadPromises);
      return results.map(result => result.secure_url);
    } catch (error) {
      console.error('Image upload failed:', error);
      throw new Error('Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  }, []);

  const handleImageUpload = async (e) => {
    const newFiles = Array.from(e.target.files).slice(0, 10 - images.files.length);
    
    // Validate files
    const validFiles = newFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`Invalid file type: ${file.name}`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`File too large: ${file.name} (max 5MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length !== newFiles.length) {
      e.target.value = null;
      return;
    }

    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    
    setImages(prev => ({
      files: [...prev.files, ...validFiles],
      previews: [...prev.previews, ...newPreviews],
      urls: [...prev.urls]
    }));
  };

  const removeImage = (index) => {
    const preview = images.previews[index];
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    
    setImages({
      files: images.files.filter((_, i) => i !== index),
      previews: images.previews.filter((_, i) => i !== index),
      urls: images.urls.filter((_, i) => i !== index)
    });
  };

  const toggleFeature = useCallback((feature) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  }, []);

  const toggleSim = useCallback((simType) => {
    setForm(prev => ({
      ...prev,
      sim: prev.sim.includes(simType)
        ? prev.sim.filter(s => s !== simType)
        : [...prev.sim, simType]
    }));
  }, []);

  const handlePromotionPayment = async () => {
    if (!form.promo_plan) return;

    const plan = promotionPlans.find(p => p.name === form.promo_plan);
    if (!plan) return;

    const paystackHandler = PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: plan.price * 100, // kobo
      currency: 'NGN',
      ref: `promote_${Date.now()}`,
      label: `Promote: ${form.title}`,
      callback: async (response) => {
        try {
          const token = await getAccessTokenSilently();
          await fetch(`${API_BASE_URL}/api/products/${response.reference}/promote`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ promo_plan: form.promo_plan })
          });
          alert('✅ Promotion activated successfully!');
        } catch (error) {
          alert('❌ Promotion payment failed');
        }
      },
      onClose: () => {
        console.log('Payment cancelled');
      }
    });
    paystackHandler.openIframe();
  };

  const handleSubmit = async (status = 'draft') => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setForm(prev => ({ ...prev, errors }));
      setSubmitError('Please fix the errors above');
      return;
    }

    if (!termsAccepted) {
      setShowTerms(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Upload images to Cloudinary
      const imageUrls = await uploadImagesToCloudinary(images.files);
      
      const token = await getAccessTokenSilently();
      const submitData = {
        ...form,
        sellerId: user.sub,
        sellerEmail: user.email,
        sellerName: user.name,
        price: form.price.replace(/,/g, ''),
        discount_price: form.discount_price.replace(/,/g, '') || '0',
        images: imageUrls,
        status,
        createdAt: new Date().toISOString()
      };

      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (response.ok) {
        if (status === 'published' && form.promoted && form.promo_plan) {
          await handlePromotionPayment();
        }
        
        alert(status === 'published' ? 
          `🎉 "${form.title}" published successfully!` : 
          '💾 Saved as draft!'
        );
        
        // Reset form
        setForm(initializeForm(user));
        setImages({ files: [], previews: [], urls: [] });
        setTermsAccepted(false);
        if (fileInputRef.current) fileInputRef.current.value = null;
        window.location.href = '/my-products';
      } else {
        throw new Error(result.message || 'Failed to save product');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitError(error.message || 'Failed to submit product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <ProfessionalLoadingSpinner message="Loading form..." />;
  if (!isAuthenticated) return <ProfessionalLoadingSpinner message="Please log in to add products..." />;

  return (
    <div className="add-product-container">
      <div className="add-product-header">
        <h1>Add New Product</h1>
        <p>List your item for sale on Minimart Marketplace</p>
      </div>

      {submitError && (
        <div className="error-banner">
          <span>❌ {submitError}</span>
          <button onClick={() => setSubmitError('')} className="close-btn">×</button>
        </div>
      )}

      <div className="add-product-main">
        <div className="form-sections">
          
          {/* BASIC INFO */}
          <section className="form-section">
            <h2>1. Basic Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Product Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateFormField('title', e.target.value)}
                  placeholder="iPhone 15 Pro Max 256GB Alpine Green"
                  maxLength={100}
                  className={form.errors.title ? 'error' : ''}
                />
                {form.errors.title && <span className="error-text">{form.errors.title}</span>}
              </div>
              
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => updateFormField('category', e.target.value)}
                  className={form.errors.category ? 'error' : ''}
                >
                  <option value="">Select Category</option>
                  {Object.keys(categoryFields).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {form.errors.category && <span className="error-text">{form.errors.category}</span>}
              </div>

              {form.category && computedFields.availableBrands.length > 0 && (
                <div className="form-group">
                  <label>Brand</label>
                  <select
                    value={form.brand}
                    onChange={(e) => updateFormField('brand', e.target.value)}
                  >
                    <option value="">Select Brand</option>
                    {computedFields.availableBrands.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.brand && computedFields.availableModels.length > 0 && (
                <div className="form-group">
                  <label>Model</label>
                  <select
                    value={form.model}
                    onChange={(e) => updateFormField('model', e.target.value)}
                  >
                    <option value="">Select Model</option>
                    {computedFields.availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Describe your product in detail..."
                  maxLength={1000}
                />
              </div>
            </div>
          </section>

          {/* SPECIFICATIONS */}
          {form.category && computedFields.showCategoryFields.length > 0 && (
            <section className="form-section">
              <h2>2. Specifications</h2>
              <div className="form-grid">
                {computedFields.showCategoryFields.includes('condition') && (
                  <div className="form-group">
                    <label>Condition</label>
                    <select value={form.condition} onChange={(e) => updateFormField('condition', e.target.value)}>
                      <option value="">Select Condition</option>
                      {conditions.map(cond => <option key={cond} value={cond}>{cond}</option>)}
                    </select>
                  </div>
                )}

                {computedFields.showCategoryFields.includes('ram') && (
                  <div className="form-group">
                    <label>RAM</label>
                    <select value={form.ram} onChange={(e) => updateFormField('ram', e.target.value)}>
                      <option value="">Select RAM</option>
                      {ramOptions.map(ram => <option key={ram} value={ram}>{ram}</option>)}
                    </select>
                  </div>
                )}

                {computedFields.showCategoryFields.includes('storage') && (
                  <div className="form-group">
                    <label>Storage</label>
                    <select value={form.storage} onChange={(e) => updateFormField('storage', e.target.value)}>
                      <option value="">Select Storage</option>
                      {storageOptions.map(storage => <option key={storage} value={storage}>{storage}</option>)}
                    </select>
                  </div>
                )}

                {computedFields.showCategoryFields.includes('color') && (
                  <div className="form-group">
                    <label>Color</label>
                    <select value={form.color} onChange={(e) => updateFormField('color', e.target.value)}>
                      <option value="">Select Color</option>
                      {colors.map(color => <option key={color} value={color}>{color}</option>)}
                    </select>
                  </div>
                )}

                {computedFields.showCategoryFields.includes('sim') && (
                  <div className="form-group">
                    <label>SIM Type</label>
                    <div className="checkbox-grid">
                      {["Single SIM", "Dual SIM", "eSIM", "eSIM + Physical"].map(simType => (
                        <label key={simType} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={form.sim.includes(simType)}
                            onChange={() => toggleSim(simType)}
                          />
                          {simType}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {computedFields.showCategoryFields.includes('year') && (
                  <div className="form-group">
                    <label>Year</label>
                    <select value={form.year} onChange={(e) => updateFormField('year', e.target.value)}>
                      <option value="">Select Year</option>
                      {years.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                )}

                {computedFields.showCategoryFields.includes('engine') && (
                  <div className="form-group">
                    <label>Engine</label>
                    <select value={form.engine} onChange={(e) => updateFormField('engine', e.target.value)}>
                      <option value="">Select Engine</option>
                      {engines.map(engine => <option key={engine} value={engine}>{engine}</option>)}
                    </select>
                  </div>
                )}

                {computedFields.showCategoryFields.includes('fuel_type') && (
                  <div className="form-group">
                    <label>Fuel Type</label>
                    <select value={form.fuel_type} onChange={(e) => updateFormField('fuel_type', e.target.value)}>
                      <option value="">Select Fuel</option>
                      {fuelTypes.map(fuel => <option key={fuel} value={fuel}>{fuel}</option>)}
                    </select>
                  </div>
                )}

                {computedFields.showCategoryFields.includes('transmission') && (
                  <div className="form-group">
                    <label>Transmission</label>
                    <select value={form.transmission} onChange={(e) => updateFormField('transmission', e.target.value)}>
                      <option value="">Select Transmission</option>
                      {["Manual", "Automatic", "CVT", "AMT"].map(trans => (
                        <option key={trans} value={trans}>{trans}</option>
                      ))}
                    </select>
                  </div>
                )}

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

                {computedFields.showCategoryFields.includes('features') && computedFields.categoryFeatures.length > 0 && (
                  <div className="form-group full-width">
                    <label>Features</label>
                    <div className="checkbox-grid-2">
                      {computedFields.categoryFeatures.slice(0, 12).map(feature => (
                        <label key={feature} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={form.features.includes(feature)}
                            onChange={() => toggleFeature(feature)}
                          />
                          {feature}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* PRICING */}
          <section className="form-section">
            <h2>3. Pricing</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Price (₦) *</label>
                <input
                  type="text"
                  value={form.price}
                  onChange={(e) => handlePriceChange(e, 'price')}
                  placeholder="150000"
                />
              </div>
              <div className="form-group">
                <label>Discount Price (₦)</label>
                <input
                  type="text"
                  value={form.discount_price}
                  onChange={(e) => handlePriceChange(e, 'discount_price')}
                  placeholder="135000"
                />
              </div>
              <div className="form-group checkbox-row">
                <label className="checkbox-label full-width">
                  <input
                    type="checkbox"
                    checked={form.negotiable}
                    onChange={(e) => updateFormField('negotiable', e.target.checked)}
                  />
                  Price Negotiable
                </label>
                <label className="checkbox-label full-width">
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

          {/* PROMOTION */}
          <section className="form-section">
            <h2>4. Promotion</h2>
            <div className="form-grid">
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
                  <span>Promote this listing (Paystack payment required)</span>
                </label>
              </div>
              {form.promoted && (
                <div className="form-group">
                  <label>Promotion Plan</label>
                  <select value={form.promo_plan} onChange={(e) => updateFormField('promo_plan', e.target.value)}>
                    <option value="">Select Plan</option>
                    {promotionPlans.map(plan => (
                      <option key={plan.name} value={plan.name}>
                        {plan.name} (₦{plan.price}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* IMAGES */}
          <section className="form-section">
            <h2>5. Images * (Max 10)</h2>
            <div className="form-group">
              <span className={form.errors.images ? 'error-text' : ''}>
                {form.errors.images || `${images.previews.length}/10 images`}
              </span>
              <div className="image-upload-area" onClick={() => fileInputRef.current?.click()}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImages || images.files.length >= 10}
                  className="hidden"
                />
                <div className="upload-placeholder">
                  <div className="upload-icon">📸</div>
                  <p>{uploadingImages ? 'Uploading...' : 'Click to upload images'}</p>
                  <small>Max 5MB each, JPG/PNG</small>
                </div>
              </div>
            </div>
            
            {images.previews.length > 0 && (
              <div className="image-previews">
                {images.previews.map((preview, index) => (
                  <div key={index} className="image-preview">
                    <img src={preview} alt={`Preview ${index + 1}`} />
                    <button 
                      className="remove-image"
                      onClick={() => removeImage(index)}
                      disabled={uploadingImages}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* CONTACT */}
          <section className="form-section">
            <h2>6. Contact Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  value={form.phone_number}
                  onChange={(e) => updateFormField('phone_number', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="08012345678"
                  className={form.errors.phone ? 'error' : ''}
                  maxLength={11}
                />
                {form.errors.phone && <span className="error-text">{form.errors.phone}</span>}
              </div>
              <div className="form-group">
                <label>State *</label>
                <select
                  value={form.state}
                  onChange={(e) => updateFormField('state', e.target.value)}
                >
                  <option value="">Select State</option>
                  {Object.keys(locationsByState).map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>City</label>
                <select
                  value={form.city}
                  onChange={(e) => updateFormField('city', e.target.value)}
                >
                  <option value="">Select City</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* SIDEBAR */}
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
              <div className={`checklist-item ${form.category ? 'completed' : ''}`}>
                <span className={`check-icon ${form.category ? 'checkmark' : ''}`}>✓</span>
                Category
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
                disabled={isSubmitting || uploadingImages}
              >
                💾 Save Draft
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSubmit('published')}
                disabled={isSubmitting || uploadingImages || !form.title.trim() || !form.phone_number.trim() || images.files.length === 0 || !termsAccepted || !form.category}
              >
                {isSubmitting || uploadingImages ? (
                  <>
                    <span className="spinner"></span>
                    {isSubmitting ? 'Publishing...' : 'Uploading...'}
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
                  I agree to <button type="button" className="terms-link" onClick={() => setShowTerms(true)}>
                    Terms & Conditions
                  </button> and listing guidelines
                </span>
              </label>
              {form.errors.terms && <span className="error-text">{form.errors.terms}</span>}
            </div>

            {form.promoted && form.promo_plan && (
              <div className="promo-info">
                <small>Promotion: ₦{promotionPlans.find(p => p.name === form.promo_plan)?.price}/mo (Paystack)</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {showTerms && (
        <div className="terms-modal">
          <div className="terms-overlay" onClick={() => setShowTerms(false)} />
          <div className="terms-content">
            <h3>Terms & Conditions</h3>
            <div className="terms-body">
              <p>1. All listings must be accurate and honest.</p>
              <p>2. No prohibited items (weapons, drugs, etc.).</p>
              <p>3. Images must represent actual product.</p>
              <p>4. Respond to inquiries within 24hrs.</p>
              <p>5. Platform not liable for transactions.</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowTerms(false)}>
                I Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Professional Loading Spinner Component
function ProfessionalLoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="professional-loader">
      <div className="loader-container">
        <div className="loader-ring">
          <div></div><div></div><div></div><div></div>
        </div>
        <div className="loader-glow"></div>
        <div className="loader-text">
          <div className="loader-title">{message}</div>
          <div className="loader-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>
  );
}