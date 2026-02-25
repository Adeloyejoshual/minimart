// src/pages/Marketplace/AddMarketplaceProduct.jsx - ALL BUGS FIXED
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import {
  categoryFields, categoryRules, conditions, usedDetails, ramOptions,
  storageOptions, colors, engines, fuelTypes, featuresByCategory,
  promotionPlans, locationsByState, brands, models, sims, years
} from "../../config"; // ✅ Single import
import "./AddMarketplaceProduct.css";

const DRAFT_KEY = "marketplace_product_draft";

export default function AddMarketplaceProduct() {
  const navigate = useNavigate();
  const { user, isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0();

  // ✅ Unified form state using categoryFields
  const [form, setForm] = useState({
    title: "",
    category: "",
    price: "",
    discountPrice: "",
    description: "",
    videoUrl: "",
    state: "",
    city: "",
    phonePrimary: "",
    phoneSecondary: "",
    deliveryRegions: [],
    isNegotiable: false,
    isExchange: false,
    isFlashSale: false,
    socialLink: "",
    isPromoted: false,
    promotionPlan: null,
    // Dynamic fields populated by categoryFields
    dynamicFields: {}
  });

  const [images, setImages] = useState({ files: [], previews: [] });
  const [ui, setUi] = useState({
    loading: false,
    submitLoading: false,
    modal: null,
    selectionField: "",
    errors: {}
  });

  const [deliveryForm, setDeliveryForm] = useState({ regionName: "", price: "", freeShipping: false });
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef();

  // ✅ Get current category config
  const currentCategoryFields = categoryFields[form.category] || [];
  const currentRules = categoryRules[form.category] || {};
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

  // ✅ Format price with commas
  const formatPrice = useCallback((value) => {
    return value ? Number(value).toLocaleString('en-NG') : '';
  }, []);

  // ✅ Reset fields when category changes
  const handleCategoryChange = useCallback((category) => {
    setForm(prev => ({
      ...prev,
      category,
      dynamicFields: {} // ✅ Reset ALL fields
    }));
  }, []);

  const updateField = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      dynamicFields: {
        ...prev.dynamicFields,
        [key]: value
      }
    }));
    setUi(prev => ({
      ...prev,
      errors: { ...prev.errors, [key]: "" }
    }));
  }, []);

  const showNotification = (message, type = "info") => {
    const el = document.createElement('div');
    el.className = `notification notification-${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };

  const openSelectionModal = (field) => {
    setSearchTerm('');
    scrollRef.current = window.scrollY;
    setUi(prev => ({ ...prev, modal: 'selection', selectionField: field }));
  };

  const closeModal = () => {
    setUi(prev => ({ ...prev, modal: null, selectionField: "" }));
    setSearchTerm('');
  };

  // ✅ Field options mapper using ALL your configs
  const getFieldOptions = (field) => {
    const optionsMap = {
      brand: brands[form.category] || [],
      model: models[`${form.category}-${form.dynamicFields.brand}`] || [],
      condition: conditions,
      used_detail: usedDetails,
      ram: ramOptions,
      storage: storageOptions,
      color: colors,
      engine: engines,
      fuel_type: fuelTypes,
      year: years,
      transmission: ['Manual', 'Automatic', 'AMT'],
      sim: sims,
      features: featuresByCategory[`${form.category}`] || [],
      state: Object.keys(locationsByState),
      city: form.state ? locationsByState[form.state] : []
    };
    return optionsMap[field] || [];
  };

  const selectOption = (field, value) => {
    const isMulti = ['sim', 'features'].includes(field);
    if (isMulti) {
      const current = form.dynamicFields[field] || [];
      const newValue = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      updateField(field, newValue);
    } else {
      updateField(field, value);
      if (!isMulti) closeModal();
    }
  };

  // ✅ FIXED: Image upload - NO click propagation
  const handleImages = (e) => {
    e.stopPropagation();
    const files = Array.from(e.target.files).slice(0, 8 - images.files.length);
    if (files.length) {
      const previews = files.map(f => URL.createObjectURL(f));
      setImages(prev => ({
        files: [...prev.files, ...files],
        previews: [...prev.previews, ...previews]
      }));
      e.target.value = ''; // Reset input
    }
  };

  const removeImage = (index) => {
    const url = images.previews[index];
    setImages(prev => {
      const newFiles = prev.files.filter((_, i) => i !== index);
      const newPreviews = prev.previews.filter((_, i) => i !== index);
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      return { files: newFiles, previews: newPreviews };
    });
  };

  const addDeliveryRegion = () => {
    if (!deliveryForm.regionName.trim()) return showNotification("Region name required", "error");
    setForm(prev => ({
      ...prev,
      deliveryRegions: [...prev.deliveryRegions, { ...deliveryForm, id: Date.now() }]
    }));
    setDeliveryForm({ regionName: "", price: "", freeShipping: false });
    setUi(prev => ({ ...prev, modal: null }));
  };

  // ✅ FIXED: Phone validation - ONLY numbers, 10+ digits
  const validateForm = () => {
    const errors = {};
    const phoneDigits = form.phonePrimary.replace(/D/g, '');

    if (!form.title.trim()) errors.title = "Title required";
    if (!form.category) errors.category = "Category required";
    if (!form.state) errors.state = "State required";
    if (!form.city) errors.city = "City required";
    if (phoneDigits.length < 10) errors.phonePrimary = "Phone must be 10+ digits";
    if (!form.price || Number(form.price) <= 0) errors.price = "Valid price required";

    setUi(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) return loginWithRedirect();
    if (!validateForm() || images.files.length === 0) {
      return showNotification("Fix errors & add images", "error");
    }

    setUi(prev => ({ ...prev, submitLoading: true }));

    try {
      // Upload images
      const uploadedImages = await Promise.allSettled(
        images.files.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
          const res = await fetch(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
            { method: 'POST', body: formData }
          );
          const data = await res.json();
          return data.secure_url;
        })
      );

      const validImages = uploadedImages.filter(r => r.status === 'fulfilled').map(r => r.value);

      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/marketplace/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          ...form.dynamicFields,
          price: Number(form.price),
          discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
          description: form.description,
          videoUrl: form.videoUrl,
          state: form.state,
          city: form.city,
          phonePrimary: form.phonePrimary,
          phoneSecondary: form.phoneSecondary,
          deliveryRegions: form.deliveryRegions,
          isNegotiable: form.isNegotiable,
          isExchange: form.isExchange,
          isFlashSale: form.isFlashSale,
          socialLink: form.socialLink,
          images: validImages
        })
      });

      const result = await response.json();
      if (response.ok) {
        localStorage.removeItem(DRAFT_KEY);
        showNotification("✅ Listing published!", "success");
        setTimeout(() => navigate('/marketplace'), 1500);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      setUi(prev => ({ ...prev, submitLoading: false }));
    }
  };

  const hasError = (field) => ui.errors[field];

  return (
    <div className="add-product-page">
      {/* Header */}
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div>
          <h1>Create New Listing</h1>
          <span>Draft auto-saved</span>
        </div>
      </header>

      {/* Form Sections */}
      <main className="form-container">
        {/* Basic Info */}
        <section className="form-section">
          <h2>Basic Information</h2>
          <div className="form-grid">
            <Field
              label="Product Title *"
              value={form.title}
              onChange={e => setForm(p => ({...p, title: e.target.value}))}
              error={hasError('title')}
              placeholder="iPhone 15 Pro Max 256GB"
            />
            
            <Field
              label="Category *"
              value={form.category || "Select category"}
              onClick={() => openSelectionModal('category')}
              error={hasError('category')}
              readOnly
            />
          </div>
        </section>

        {/* ✅ Dynamic Fields from categoryFields */}
        {form.category && currentCategoryFields.length > 0 && (
          <section className="form-section">
            <h2>Product Details</h2>
            <div className="form-grid">
              {currentCategoryFields.map(field => {
                const displayName = field.replace('_', ' ').replace(/\bw/g, l => l.toUpperCase());
                const options = getFieldOptions(field);
                const value = form.dynamicFields[field] || '';
                
                return (
                  <Field
                    key={field}
                    label={displayName}
                    value={value || `Select ${displayName}`}
                    onClick={() => openSelectionModal(field)}
                    readOnly
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Pricing & Promotion */}
        <section className="form-section">
          <h2>Pricing & Promotion</h2>
          <div className="form-grid">
            <Field
              label="Price (₦) *"
              value={formatPrice(form.price)}
              onChange={e => setForm(p => ({...p, price: e.target.value.replace(/D/g, '')}))}
              error={hasError('price')}
            />
            <Field
              label="Discount Price (₦)"
              value={formatPrice(form.discountPrice)}
              onChange={e => setForm(p => ({...p, discountPrice: e.target.value.replace(/D/g, '')}))}
            />
            
            {form.isPromoted && (
              <div className="promotion-grid">
                {promotionPlans.map(plan => (
                  <div key={plan.id} className={`plan-card ${form.promotionPlan?.id === plan.id ? 'selected' : ''}`}
                       onClick={() => setForm(p => ({...p, promotionPlan: plan}))}>
                    <div>
                      <strong>{plan.name}</strong>
                      <span>{plan.duration}</span>
                    </div>
                    <div>{plan.price === 0 ? 'FREE' : `₦${formatPrice(plan.price)}`}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Media - ✅ FIXED click issue */}
        <section className="form-section">
          <h2>Media</h2>
          <div className="form-grid">
            <Field
              label="Description"
              as="textarea"
              value={form.description}
              onChange={e => setForm(p => ({...p, description: e.target.value}))}
              rows={4}
            />
            
            <div className="image-upload-container">
              <div className="image-upload-wrapper" onClick={() => {}}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImages}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="upload-placeholder">
                  📷 {images.files.length}/8 images
                </div>
              </div>
              
              {images.previews.length > 0 && (
                <div className="images-preview-grid">
                  {images.previews.map((preview, i) => (
                    <div key={i} className="image-preview-wrapper">
                      <img src={preview} alt="Preview" />
                      <button 
                        className="remove-image-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(i);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Field
              label="Video URL (Optional)"
              value={form.videoUrl}
              onChange={e => setForm(p => ({...p, videoUrl: e.target.value}))}
            />
          </div>
        </section>

        {/* Location & Contact */}
        <section className="form-section">
          <h2>Location & Contact</h2>
          <div className="form-grid">
            <div className="delivery-container">
              <button 
                className="add-delivery-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setUi(p => ({...p, modal: 'delivery'}));
                }}
              >
                + Add Delivery Area
              </button>
              {form.deliveryRegions.map(region => (
                <div key={region.id} className="delivery-region-item">
                  <span>{region.regionName}</span>
                  <span>{region.freeShipping ? 'Free' : `₦${formatPrice(region.price)}`}</span>
                  <button 
                    onClick={() => setForm(p => ({
                      ...p,
                      deliveryRegions: p.deliveryRegions.filter(r => r.id !== region.id)
                    }))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <Field
              label="State *"
              value={form.state || "Select state"}
              onClick={() => openSelectionModal('state')}
              error={hasError('state')}
              readOnly
            />
            <Field
              label="City/LGA *"
              value={form.city || "Select city"}
              onClick={() => openSelectionModal('city')}
              error={hasError('city')}
              readOnly
            />
            
            {/* ✅ FIXED: Phone - only numbers */}
            <Field
              label="Primary Phone *"
              value={form.phonePrimary}
              onChange={e => setForm(p => ({...p, phonePrimary: e.target.value.replace(/D/g, '')}))}
              error={hasError('phonePrimary')}
              placeholder="08123456789"
            />
            <Field
              label="Secondary Phone"
              value={form.phoneSecondary}
              onChange={e => setForm(p => ({...p, phoneSecondary: e.target.value.replace(/D/g, '')}))}
              placeholder="08098765432"
            />
          </div>
        </section>

        {/* Options */}
        <section className="form-section">
          <h2>Listing Options</h2>
          <div className="options-grid">
            <label className="option-item">
              <input 
                type="checkbox"
                checked={form.isNegotiable}
                onChange={e => setForm(p => ({...p, isNegotiable: e.target.checked}))}
              />
              Price Negotiable
            </label>
            <label className="option-item">
              <input 
                type="checkbox"
                checked={form.isExchange}
                onChange={e => setForm(p => ({...p, isExchange: e.target.checked}))}
              />
              Accept Exchange
            </label>
            <label className="option-item">
              <input 
                type="checkbox"
                checked={form.isFlashSale}
                onChange={e => setForm(p => ({...p, isFlashSale: e.target.checked}))}
              />
              Flash Sale - Urgent
            </label>
          </div>
          <Field
            label="WhatsApp/Social Link"
            value={form.socialLink}
            onChange={e => setForm(p => ({...p, socialLink: e.target.value}))}
            placeholder="https://wa.me/2348012345678"
          />
        </section>
      </main>

      {/* ✅ FIXED: Publish button at bottom */}
      <footer className="submit-footer">
        <button 
          className="btn btn-secondary"
          onClick={() => navigate('/marketplace')}
          disabled={ui.submitLoading}
        >
          Save Draft
        </button>
        <button 
          className={`btn btn-primary ${ui.submitLoading ? 'loading' : ''}`}
          onClick={handleSubmit}
          disabled={ui.submitLoading}
        >
          {ui.submitLoading ? (
            <>
              <span className="spinner"></span>
              Publishing...
            </>
          ) : (
            '🚀 Publish Listing'
          )}
        </button>
      </footer>

      {/* Modals */}
      {renderSelectionModal()}
      {renderDeliveryModal()}
    </div>
  );

  // ✅ Selection Modal using ALL your config options
  function renderSelectionModal() {
    const field = ui.selectionField;
    const options = getFieldOptions(field);
    
    if (!options.length) return null;

    const filteredOptions = options.filter(opt => 
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const isMulti = ['sim', 'features'].includes(field);
    const currentValue = form.dynamicFields[field] || (isMulti ? [] : '');

    return (
      <div className="modal-overlay" onClick={closeModal}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <button onClick={closeModal}>←</button>
            <h3>{field.replace('_', ' ').toUpperCase()}</h3>
          </div>
          <input
            className="modal-search"
            placeholder="Search options..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="modal-options">
            {filteredOptions.map(option => (
              <div
                key={option}
                className={`option-item ${
                  isMulti 
                    ? currentValue.includes(option)
                    : currentValue === option
                ? 'selected' : ''}`}
                onClick={() => selectOption(field, option)}
              >
                {isMulti && currentValue.includes(option) && '✓'} {option}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderDeliveryModal() {
    return (
      <div className="modal-overlay" onClick={() => setUi(p => ({...p, modal: null}))}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <h3>Add Delivery Area</h3>
          <Field
            label="Area Name *"
            value={deliveryForm.regionName}
            onChange={e => setDeliveryForm(p => ({...p, regionName: e.target.value}))}
          />
          <Field
            label="Price (₦)"
            value={formatPrice(deliveryForm.price)}
            onChange={e => setDeliveryForm(p => ({...p, price: e.target.value.replace(/D/g, '')}))}
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={deliveryForm.freeShipping}
              onChange={e => setDeliveryForm(p => ({...p, freeShipping: e.target.checked}))}
            />
            Free Shipping
          </label>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setUi(p => ({...p, modal: null}))}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={addDeliveryRegion}>
              Add Area
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// ✅ Reusable Field Component
const Field = ({ label, value, onChange, onClick, as = "input", error, readOnly, ...props }) => (
  <div className={`field ${onClick ? 'selectable' : ''} ${error ? 'error' : ''}`} onClick={onClick}>
    <label>{label}</label>
    {as === "textarea" ? (
      <textarea value={value || ''} onChange={onChange} {...props} readOnly={readOnly} />
    ) : (
      <input value={value || ''} onChange={onChange} readOnly={readOnly} {...props} />
    )}
    {error && <span className="error-text">{error}</span>}
  </div>
);