// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

// Config imports
import { categoryFields } from "../../config/categoryFields";
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
import { sims } from "../../config/sim";
import { years } from "../../config/years";
import Toast from "../../components/Toast";
import "./AddProduct.css";

const DRAFT_KEY = "marketplace_product_draft";

export default function AddMarketplaceProduct() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading, getAccessTokenSilently } = useAuth0();

  // Core state
  const [form, setForm] = useState({
    title: "",
    category: "",
    subcategory: "",
    brand: "",
    model: "",
    condition: "",
    usedDetail: "",
    ram: "",
    storage: "",
    color: "",
    engine: "",
    fuelType: "",
    year: "",
    transmission: "",
    simSupport: [],
    features: [],
    price: "",
    discountPrice: "",
    description: "",
    videoUrl: "",
    state: "",
    city: "",
    phonePrimary: "",
    phoneSecondary: "",
    posterName: "",
    deliveryRegions: [],
    isNegotiable: false,
    isExchange: false,
    isFlashSale: false,
    socialLink: "",
    isPromoted: false,
    promotionPlan: null,
    paymentSuccess: false,
  });

  const [images, setImages] = useState({ files: [], previews: [] });
  const [ui, setUi] = useState({
    loading: false,
    modal: null, // 'selection', 'preview', 'payment', 'delivery'
    selectionField: "",
    errors: {},
    previewData: null,
  });

  const [deliveryForm, setDeliveryForm] = useState({
    regionName: "",
    price: "",
    freeShipping: false,
  });

  const scrollRef = useRef(0);
  const rules = categoryFields[form.category]?.[form.subcategory] || {};

  // Built-in Cloudinary upload
  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_PRESET || 'ml_default');
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_NAME || 'demo'}/image/upload`,
      { method: 'POST', body: formData }
    );
    const data = await response.json();
    return data.secure_url;
  };

  // Effects
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      const parsed = JSON.parse(draft);
      setForm(parsed);
      if (parsed.images) {
        setImages({
          files: parsed.images.files || [],
          previews: parsed.images.previews || []
        });
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, images }));
  }, [form, images]);

  // Core handlers
  const updateField = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setUi(prev => ({ ...prev, errors: { ...prev.errors, [key]: "" } }));
  }, []);

  const showToast = useCallback((message, type = "info") => {
    // Implement toast logic
    console.log(`Toast: ${type} - ${message}`);
  }, []);

  const openSelectionModal = (field) => {
    scrollRef.current = window.scrollY;
    setUi(prev => ({ ...prev, modal: 'selection', selectionField: field }));
  };

  const closeModal = () => {
    setUi(prev => ({ ...prev, modal: null, selectionField: "" }));
    setTimeout(() => window.scrollTo(0, scrollRef.current), 100);
  };

  const selectOption = (field, value) => {
    if (field === 'features' || field === 'simSupport') {
      const current = form[field] || [];
      const newValue = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      updateField(field, newValue);
    } else {
      updateField(field, value);
    }
    if (!['features', 'simSupport'].includes(field)) {
      closeModal();
    }
  };

  // Image handlers
  const handleImages = (files) => {
    const newFiles = Array.from(files).slice(0, rules.maxImages - images.files.length);
    if (newFiles.length) {
      setImages(prev => ({
        files: [...prev.files, ...newFiles],
        previews: [...prev.previews, ...newFiles.map(f => URL.createObjectURL(f))]
      }));
    }
  };

  const removeImage = (index) => {
    setImages(prev => ({
      files: prev.files.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index)
    }));
  };

  // Delivery region handlers
  const addDeliveryRegion = () => {
    if (!deliveryForm.regionName.trim()) return;
    
    setForm(prev => ({
      ...prev,
      deliveryRegions: [
        ...prev.deliveryRegions,
        { ...deliveryForm, id: Date.now() }
      ]
    }));
    
    setDeliveryForm({ regionName: "", price: "", freeShipping: false });
    setUi(prev => ({ ...prev, modal: null }));
  };

  const removeDeliveryRegion = (id) => {
    setForm(prev => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.filter(r => r.id !== id)
    }));
  };

  // Validation
  const validateForm = () => {
    const errors = {};
    
    if (!form.title.trim()) errors.title = "Title is required";
    if (!form.category) errors.category = "Category is required";
    if (!form.state) errors.state = "State is required";
    if (!form.city) errors.city = "City/LGA is required";
    if (!form.phonePrimary || form.phonePrimary.length < 10) errors.phonePrimary = "Valid phone required";
    if (!form.price || Number(form.price) <= 0) errors.price = "Valid price required";
    if (images.files.length === 0) errors.images = "At least 1 image required";

    setUi(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  // Promotion payment
  const handlePromotionPayment = async (plan) => {
    if (!window.PaystackPop) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.onload = () => handlePromotionPayment(plan);
      document.body.appendChild(script);
      return;
    }

    const handler = window.PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_KEY,
      email: user.email,
      amount: plan.price * 100,
      currency: "NGN",
      metadata: { promotionPlanId: plan.id, userId: user.sub },
      callback: () => {
        updateField('promotionPlan', plan);
        updateField('paymentSuccess', true);
        updateField('isPromoted', true);
        showToast("Payment successful!");
      }
    });
    handler.openIframe();
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setUi(prev => ({ ...prev, loading: true }));

      // Upload images
      const uploadedImages = await Promise.allSettled(
        images.files.map(uploadImage)
      ).then(results => results.filter(r => r.status === 'fulfilled').map(r => r.value));

      const token = await getAccessTokenSilently();
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
          images: uploadedImages,
          ownerId: user.sub,
          ownerEmail: user.email,
          ownerName: form.posterName || user.name,
          createdAt: new Date().toISOString(),
        })
      });

      if (!response.ok) throw new Error('Failed to publish product');

      localStorage.removeItem(DRAFT_KEY);
      navigate('/marketplace');
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setUi(prev => ({ ...prev, loading: false }));
    }
  };

  // Show preview modal
  const showPreview = () => {
    if (!validateForm()) return;
    setUi(prev => ({ 
      ...prev, 
      modal: 'preview',
      previewData: { ...form, images: images.previews }
    }));
  };

  // Render field selector modal
  const renderSelectionModal = () => {
    const field = ui.selectionField;
    const fieldConfig = {
      category: { options: Object.keys(categoryFields), title: "Select Category" },
      subcategory: { options: categoryFields[form.category] ? Object.keys(categoryFields[form.category]) : [], title: "Select Subcategory" },
      brand: { options: brands[form.category] || [], title: "Select Brand" },
      model: { options: models[`${form.category}-${form.brand}`] || [], title: "Select Model" },
      condition: { options: conditions, title: "Select Condition" },
      usedDetail: { options: usedDetails, title: "Select Used Condition" },
      ram: { options: ramOptions, title: "Select RAM" },
      storage: { options: storageOptions, title: "Select Storage" },
      color: { options: colors, title: "Select Color" },
      engine: { options: engines, title: "Select Engine Size" },
      fuelType: { options: fuelTypes, title: "Select Fuel Type" },
      year: { options: years, title: "Select Year" },
      transmission: { options: ["Manual", "Automatic", "AMT"], title: "Select Transmission" },
      state: { options: Object.keys(locationsByState), title: "Select State" },
      city: { options: form.state ? locationsByState[form.state] : [], title: "Select City/LGA" },
      simSupport: { options: sims, title: "SIM Support", multi: true },
      features: { options: featuresByCategory[`${form.category}-${form.subcategory}`] || [], title: "Select Features", multi: true },
    };

    const config = fieldConfig[field];
    if (!config) return null;

    return (
      <div className="modal-overlay" onClick={closeModal}>
        <div className="selection-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <button onClick={closeModal}>←</button>
            <h3>{config.title}</h3>
          </div>
          <div className="search-input">
            <input placeholder="Search..." />
          </div>
          <div className="options-list">
            {config.options.map(option => (
              <div
                key={option}
                className={`option-item ${config.multi 
                  ? form[field]?.includes(option) 
                  : form[field] === option ? 'selected' : ''
                }`}
                onClick={() => selectOption(field, option)}
              >
                {config.multi && form[field]?.includes(option) && "✓"} {option}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="add-product-page">
      <header className="page-header">
        <button onClick={() => navigate(-1)}>← Back</button>
        <h1>🚀 Post New Marketplace Product</h1>
      </header>

      {/* Product Details Section */}
      <section className="form-section">
        <h2>Product Details</h2>
        <div className="form-grid">
          <Field label="Title *" value={form.title} onChange={e => updateField('title', e.target.value)} />
          
          <Field label="Category *" onClick={() => openSelectionModal('category')}>
            {form.category || "Select category"}
          </Field>

          {form.category && (
            <>
              <Field label="Subcategory" onClick={() => openSelectionModal('subcategory')}>
                {form.subcategory || "Select subcategory"}
              </Field>
              <Field label="Brand" onClick={() => openSelectionModal('brand')}>
                {form.brand || "Select brand"}
              </Field>
              <Field label="Model" onClick={() => openSelectionModal('model')}>
                {form.model || "Select model"}
              </Field>
            </>
          )}

          {rules.condition && (
            <>
              <Field label="Condition" onClick={() => openSelectionModal('condition')}>
                {form.condition || "Select condition"}
              </Field>
              {form.condition === 'Used' && (
                <Field label="Used Detail" onClick={() => openSelectionModal('usedDetail')}>
                  {form.usedDetail || "Select used condition"}
                </Field>
              )}
            </>
          )}

          {rules.dynamicFields?.map(field => (
            <Field key={field} label={field} onClick={() => openSelectionModal(field)}>
              {form[field] || `Select ${field}`}
            </Field>
          ))}

          {rules.simSupport && (
            <Field label="SIM Support" onClick={() => openSelectionModal('simSupport')}>
              {form.simSupport.length ? form.simSupport.join(', ') : "Select SIM types"}
            </Field>
          )}

          {rules.features && (
            <Field label="Features" onClick={() => openSelectionModal('features')}>
              {form.features.length ? form.features.join(', ') : "Select features"}
            </Field>
          )}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="form-section">
        <h2>Pricing & Boost</h2>
        <div className="form-grid">
          <Field 
            label="Price *" 
            type="price"
            value={form.price}
            onChange={e => updateField('price', e.target.value.replace(/D/g, ''))}
          />
          <Field 
            label="Discount Price" 
            type="price"
            value={form.discountPrice}
            onChange={e => updateField('discountPrice', e.target.value.replace(/D/g, ''))}
          />
          
          <div className="checkbox-row">
            <label>
              <input 
                type="checkbox" 
                checked={form.isPromoted}
                onChange={e => updateField('isPromoted', e.target.checked)}
              />
              Promote listing
            </label>
          </div>

          {form.isPromoted && (
            <div className="promotion-plans">
              {promotionPlans.map(plan => (
                <div key={plan.id} className="promotion-card" onClick={() => handlePromotionPayment(plan)}>
                  <div className="plan-info">
                    <span>{plan.icon}</span>
                    <div>
                      <strong>{plan.name}</strong>
                      <span>{plan.duration}</span>
                    </div>
                  </div>
                  <div className="plan-price">
                    {plan.price === 0 ? 'FREE' : `₦${plan.price}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Media Section */}
      <section className="form-section">
        <h2>Description & Media</h2>
        <div className="form-grid">
          <Field 
            label="Description"
            as="textarea"
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            rows={4}
          />
          
          <div className="image-upload-section">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={e => handleImages(e.target.files)}
            />
            <div className="image-previews">
              {images.previews.map((preview, index) => (
                <div key={index} className="image-preview">
                  <img src={preview} alt="Preview" />
                  <button onClick={() => removeImage(index)}>×</button>
                </div>
              ))}
            </div>
          </div>

          <Field 
            label="Video Link (optional)"
            value={form.videoUrl}
            onChange={e => updateField('videoUrl', e.target.value)}
            placeholder="https://youtube.com/..."
          />
        </div>
      </section>

      {/* Delivery & Contact */}
      <section className="form-section">
        <h2>Delivery & Contact</h2>
        <div className="form-grid">
          <div className="delivery-regions">
            <button onClick={() => setUi(prev => ({ ...prev, modal: 'delivery' }))}>
              + Add Delivery Region
            </button>
            {form.deliveryRegions.map(region => (
              <div key={region.id} className="delivery-region">
                <span>{region.regionName}</span>
                <span>{region.freeShipping ? 'Free' : `₦${region.price}`}</span>
                <button onClick={() => removeDeliveryRegion(region.id)}>×</button>
              </div>
            ))}
          </div>

          <Field label="State *" onClick={() => openSelectionModal('state')}>
            {form.state || "Select state"}
          </Field>
          
          <Field label="City/LGA *" onClick={() => openSelectionModal('city')}>
            {form.city || "Select city"}
          </Field>

          <Field label="Primary Phone *" value={form.phonePrimary} onChange={e => updateField('phonePrimary', e.target.value)} />
          <Field label="Additional Phone" value={form.phoneSecondary} onChange={e => updateField('phoneSecondary', e.target.value)} />
          <Field label="Your Name" value={form.posterName} onChange={e => updateField('posterName', e.target.value)} />
        </div>
      </section>

      {/* Additional Options */}
      <section className="form-section">
        <h2>Additional Options</h2>
        <div className="checkbox-grid">
          <label>
            <input 
              type="checkbox" 
              checked={form.isNegotiable}
              onChange={e => updateField('isNegotiable', e.target.checked)}
            />
            Price Negotiable
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={form.isExchange}
              onChange={e => updateField('isExchange', e.target.checked)}
            />
            Exchange Possible
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={form.isFlashSale}
              onChange={e => updateField('isFlashSale', e.target.checked)}
            />
            Flash Sale
          </label>
        </div>
        <Field 
          label="Social/WhatsApp Link"
          value={form.socialLink}
          onChange={e => updateField('socialLink', e.target.value)}
        />
      </section>

      {/* Submit */}
      <section className="submit-section">
        <button className="preview-btn" onClick={showPreview} disabled={ui.loading}>
          Preview & Publish
        </button>
        <button className="publish-btn" onClick={handleSubmit} disabled={ui.loading || authLoading}>
          {ui.loading ? 'Publishing...' : 'Publish Now'}
        </button>
      </section>

      {/* Modals */}
      {ui.modal === 'selection' && renderSelectionModal()}
      {ui.modal === 'delivery' && (
        <DeliveryModal
          form={deliveryForm}
          setForm={setDeliveryForm}
          onSave={addDeliveryRegion}
          onClose={() => setUi(prev => ({ ...prev, modal: null }))}
        />
      )}
    </div>
  );
}

// Reusable Field Component
const Field = ({ label, children, onClick, value, onChange, as = "input", type = "text", ...props }) => (
  <div className="form-field" onClick={onClick}>
    <label>{label}</label>
    {as === "textarea" ? (
      <textarea value={value} onChange={onChange} {...props} />
    ) : (
      <input 
        type={type === "price" ? "text" : type} 
        value={value} 
        onChange={onChange} 
        {...props} 
      />
    )}
    {children}
  </div>
);

// Delivery Modal Component
const DeliveryModal = ({ form, setForm, onSave, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" onClick={e => e.stopPropagation()}>
      <h3>Add Delivery Region</h3>
      <Field 
        label="Region Name" 
        value={form.regionName}
        onChange={e => setForm(prev => ({ ...prev, regionName: e.target.value }))}
      />
      <Field 
        label="Delivery Price (₦)"
        type="price"
        value={form.price}
        onChange={e => setForm(prev => ({ ...prev, price: e.target.value.replace(/D/g, '') }))}
      />
      <label>
        <input
          type="checkbox"
          checked={form.freeShipping}
          onChange={e => setForm(prev => ({ ...prev, freeShipping: e.target.checked }))}
        />
        Free Shipping
      </label>
      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={onSave}>Add Region</button>
      </div>
    </div>
  </div>
);