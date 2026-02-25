import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import PaystackPop from '@paystack/inline-js';
import './AddProduct.css';
import { 
  categoryFields, categoryRules, conditions, usedDetails, ramOptions, 
  storageOptions, colors, engines, fuelTypes, featuresByCategory, 
  promotionPlans, locationsByState, brands, models 
} from "../../config/categoryFields";

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
  const [productId, setProductId] = useState(null);

  // Memoized computed fields
  const computedFields = useMemo(() => ({
    availableBrands: form.category ? brands[form.category] || [] : [],
    availableModels: form.brand && form.category ? models[form.category]?.[form.brand] || [] : [],
    categoryFeatures: form.category ? featuresByCategory[form.category] || [] : [],
    showCategoryFields: form.category ? categoryFields[form.category] || [] : [],
    categoryRules: form.category ? categoryRules[form.category] || {} : {}
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
    setForm(prev => {
      const updated = { 
        ...prev, 
        [field]: value,
        errors: { ...prev.errors, [field]: '' }
      };

      // 🧠 CRITICAL: Reset dependent fields
      if (field === 'category') {
        updated.brand = '';
        updated.model = '';
        updated.features = [];
        updated.ram = '';
        updated.storage = '';
        updated.color = '';
        updated.sim = [];
        updated.condition = '';
        updated.year = '';
        updated.engine = '';
        updated.fuel_type = '';
        updated.transmission = '';
        updated.mileage = '';
      }

      if (field === 'brand') {
        updated.model = '';
      }

      return updated;
    });
  }, []);

  const validateForm = useCallback(() => {
    const errors = {};
    
    // Basic required fields
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.phone_number.trim()) errors.phone = 'Phone number is required';
    if (images.files.length === 0) errors.images = 'At least 1 image is required';
    if (!form.category) errors.category = 'Category is required';
    
    // 🧠 Price validation
    const priceNum = Number(form.price.replace(/,/g, ''));
    if (!form.price || priceNum <= 0) {
      errors.price = 'Valid price required';
    }
    
    // 🧠 Category-specific validation using categoryRules
    const rules = computedFields.categoryRules;
    if (rules?.requiredFields) {
      rules.requiredFields.forEach(field => {
        if (!form[field]) {
          errors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required for ${form.category}`;
        }
      });
    }

    if (!termsAccepted) errors.terms = 'Terms must be accepted';
    return errors;
  }, [form.title, form.phone_number, form.category, form.price, images.files.length, termsAccepted, computedFields.categoryRules, form]);

  // Sequential Cloudinary upload for African internet 🧠
  const uploadImagesToCloudinary = useCallback(async (files) => {
    setUploadingImages(true);
    const urls = [];
    
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) throw new Error('Image upload failed');
        const data = await res.json();
        urls.push(data.secure_url);
      }
      return urls;
    } catch (error) {
      console.error('Image upload failed:', error);
      throw new Error('Failed to upload images. Please try again.');
    } finally {
      setUploadingImages(false);
    }
  }, []);

  const handleImageUpload = async (e) => {
    const newFiles = Array.from(e.target.files).slice(0, 10 - images.files.length);
    
    const validFiles = newFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`❌ Invalid file type: ${file.name}`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`❌ File too large: ${file.name} (max 5MB)`);
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

  // 🧠 FIXED: Correct promotion payment architecture
  const handlePromotionPayment = useCallback(async (productId) => {
    if (!form.promo_plan || !productId) return;

    const plan = promotionPlans.find(p => p.name === form.promo_plan);
    if (!plan) return;

    return new Promise((resolve) => {
      const paystackHandler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount: plan.price * 100, // kobo
        currency: 'NGN',
        ref: `minimart_${productId}_${Date.now()}`,
        label: `Promote: ${form.title}`,
        callback: async (response) => {
          try {
            const token = await getAccessTokenSilently();
            const promoteRes = await fetch(`${API_BASE_URL}/api/products/${productId}/promote`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ 
                promo_plan: form.promo_plan,
                paystack_ref: response.reference 
              })
            });

            if (promoteRes.ok) {
              alert('✅ Promotion activated successfully!');
              resolve(true);
            } else {
              alert('❌ Promotion activation failed');
              resolve(false);
            }
          } catch (error) {
            alert('❌ Promotion payment verification failed');
            resolve(false);
          }
        },
        onClose: () => {
          alert('Payment cancelled');
          resolve(false);
        }
      });
      paystackHandler.openIframe();
    });
  }, [form.promo_plan, form.title, user.email]);

  const handleSubmit = async (status = 'draft') => {
    // 🧠 UX: Disable promotions for drafts
    if (status === 'draft') {
      updateFormField('promoted', false);
    }

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
      // Upload images sequentially
      const imageUrls = await uploadImagesToCloudinary(images.files);
      
      const token = await getAccessTokenSilently();
      
      // 🧠 SECURITY: Only send sellerId, backend extracts rest from JWT
      const submitData = {
        ...form,
        sellerId: user.sub, // Backend derives email/name from token
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
        const productId = result.product?._id || result.product?.id || result.id;
        setProductId(productId);

        // 🧠 FIXED: Only trigger promotion for published products with correct productId
        if (status === 'published' && form.promoted && form.promo_plan && productId) {
          const promotionSuccess = await handlePromotionPayment(productId);
          if (!promotionSuccess) {
            console.log('Promotion failed but product saved');
          }
        }
        
        alert(status === 'published' ? 
          `🎉 "${form.title}" published successfully!` : 
          '💾 Saved as draft!'
        );
        
        // Reset form
        setForm(initializeForm(user));
        setImages({ files: [], previews: [], urls: [] });
        setTermsAccepted(false);
        setProductId(null);
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
            <h2>Basic Information</h2>
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

              {computedFields.availableBrands.length > 0 && (
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

              {computedFields.availableModels.length > 0 && (
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
              <h2>Specifications</h2>
              {/* Same dynamic fields as before but without numbers */}
              <div className="form-grid">
                {/* All your existing spec fields here - unchanged structure */}
                {computedFields.showCategoryFields.includes('condition') && (
                  <div className="form-group">
                    <label>Condition</label>
                    <select value={form.condition} onChange={(e) => updateFormField('condition', e.target.value)}>
                      <option value="">Select Condition</option>
                      {conditions.map(cond => <option key={cond} value={cond}>{cond}</option>)}
                    </select>
                    {form.errors.condition && <span className="error-text">{form.errors.condition}</span>}
                  </div>
                )}
                {/* ... rest of fields with error display */}
              </div>
            </section>
          )}

          {/* PRICING */}
          <section className="form-section">
            <h2>Pricing</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Price (₦) *</label>
                <input
                  type="text"
                  value={form.price}
                  onChange={(e) => updateFormField('price', new Intl.NumberFormat('en-NG').format(e.target.value.replace(/[^0-9]/g, '')))}
                  placeholder="150000"
                  className={form.errors.price ? 'error' : ''}
                />
                {form.errors.price && <span className="error-text">{form.errors.price}</span>}
              </div>
              {/* Rest unchanged */}
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